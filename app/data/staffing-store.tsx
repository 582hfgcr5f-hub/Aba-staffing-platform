"use client";

import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  assignCaseInDatabase,
  unassignCaseInDatabase,
} from "./assignment-workflow";
import {
  buildMatchesForCase,
  buildMatchesForTechnician,
  formatRequiredScheduleSummary,
  normalizeRequiredCaseWindow,
  rankCaseMatchesForTechnician,
} from "./smart-match-engine";
import {
  dedupeTechnicians,
  importTechniciansCsv,
  normalizeState,
} from "./technicians-utils";
import { getSupabaseBrowserClient, getSupabaseConfigError } from "@/app/lib/supabase/client";
import { type AssignmentRecord, type CaseProfile, type DayName, type RouteInfo, type SharedMatchResult, type StaffingDatabase } from "./staffing-types";
import {
  fetchStaffingDatabase,
  importTechnicianRecords,
  insertAssignmentRecord,
  upsertCaseRecord,
  upsertTechnicianRecord,
} from "./supabase-adapter";
import { type TechnicianProfile } from "./technicians";

function missingRouteInfo(technician: TechnicianProfile, caseItem: CaseProfile): RouteInfo {
  if (
    typeof technician.latitude !== "number" ||
    typeof technician.longitude !== "number" ||
    typeof caseItem.latitude !== "number" ||
    typeof caseItem.longitude !== "number"
  ) {
    return {
      driveTimeMinutes: null,
      driveDistanceMiles: null,
      routeStatus: "missing-coordinates",
    };
  }

  return {
    driveTimeMinutes: null,
    driveDistanceMiles: null,
    routeStatus: "route-failed",
  };
}

function routeCacheKey(technician: TechnicianProfile, caseItem: CaseProfile) {
  return [technician.id, technician.latitude, technician.longitude, caseItem.id, caseItem.latitude, caseItem.longitude].join(":");
}


const emptyDatabase: StaffingDatabase = {
  technicians: [],
  cases: [],
  assignments: [],
  assignmentHistory: [],
};

type AssignCaseParams = {
  technicianId: string;
  caseId: string;
  assignedBy?: string;
};

type StaffingStoreValue = StaffingDatabase & {
  loading: boolean;
  errorMessage: string | null;
  routeCacheVersion: number;
  refreshDatabase: () => Promise<void>;
  replaceTechnicians: (nextTechnicians: TechnicianProfile[]) => Promise<void>;
  importTechniciansFromCsv: (csvText: string) => Promise<void>;
  resetDatabase: () => Promise<void>;
  findMatchingTechnicians: (caseId: string) => SharedMatchResult[];
  findMatchingCases: (technicianId: string) => SharedMatchResult[];
  assignCase: (params: AssignCaseParams) => Promise<{ ok: true; assignment: AssignmentRecord } | { ok: false; message: string }>;
  unassignCase: (assignmentId: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  markCaseStarted: (caseId: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  upsertTechnician: (technicianInput: Omit<TechnicianProfile, "id"> & { id?: string }) => Promise<{ ok: true } | { ok: false; message: string }>;
  deleteTechnician: (technicianId: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  upsertCase: (caseInput: Omit<CaseProfile, "id"> & { id?: string }) => Promise<{ ok: true } | { ok: false; message: string }>;
  deleteCase: (caseId: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  createDraftCase: (input: {
    name: string;
    city: string;
    state: string;
    requiredDays: DayName[];
    requiredStartTime: string;
    requiredEndTime: string;
    zip?: string;
    address?: string;
    startDate?: string;
    bcba?: string;
    urgency?: CaseProfile["urgency"];
  }) => { draft: CaseProfile; matches: SharedMatchResult[] };
  getRouteInfo: (technician: TechnicianProfile, caseItem: CaseProfile) => RouteInfo;
  cacheRouteInfo: (technician: TechnicianProfile, caseItem: CaseProfile, route: RouteInfo) => void;
  isRouteCached: (technician: TechnicianProfile, caseItem: CaseProfile) => boolean;
};

const StaffingDatabaseContext = createContext<StaffingStoreValue | null>(null);

export function StaffingDatabaseProvider({ children }: { children: ReactNode }) {
  const [database, setDatabase] = useState<StaffingDatabase>(emptyDatabase);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const routeCache = useRef(new Map<string, RouteInfo>());
  const [routeCacheVersion, setRouteCacheVersion] = useState(0);

  const refreshDatabase = useCallback(async () => {
    const configError = getSupabaseConfigError();
    const client = getSupabaseBrowserClient();

    if (configError || !client) {
      setDatabase(emptyDatabase);
      setErrorMessage(configError ?? "Supabase client is unavailable.");
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const nextDatabase = await fetchStaffingDatabase(client);
      setDatabase(nextDatabase);
      setErrorMessage(null);
    } catch {
      setDatabase(emptyDatabase);
      setErrorMessage("Staffing data could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => void refreshDatabase(), 0);
    return () => window.clearTimeout(refreshTimer);
  }, [refreshDatabase]);

  const replaceTechnicians = useCallback(async (nextTechnicians: TechnicianProfile[]) => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      return;
    }

    for (const technician of dedupeTechnicians(nextTechnicians)) {
      await upsertTechnicianRecord(client, technician);
    }

    await refreshDatabase();
  }, [refreshDatabase]);

  const importTechniciansFromCsv = useCallback(async (csvText: string) => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      return;
    }

    const imported = importTechniciansCsv(csvText);
    await importTechnicianRecords(client, imported);
    await refreshDatabase();
  }, [refreshDatabase]);

  const resetDatabase = useCallback(async () => {
    setDatabase(emptyDatabase);
  }, []);

  const getRouteInfo = useCallback((technician: TechnicianProfile, caseItem: CaseProfile) => {
    const key = routeCacheKey(technician, caseItem);
    const cached = routeCache.current.get(key);
    if (cached) return cached;

    return missingRouteInfo(technician, caseItem);
  }, []);

  const cacheRouteInfo = useCallback((technician: TechnicianProfile, caseItem: CaseProfile, route: RouteInfo) => {
    const key = routeCacheKey(technician, caseItem);
    const previous = routeCache.current.get(key);
    if (
      previous?.driveTimeMinutes === route.driveTimeMinutes &&
      previous?.driveDistanceMiles === route.driveDistanceMiles &&
      previous?.routeStatus === route.routeStatus
    ) return;
    routeCache.current.set(key, route);
    setRouteCacheVersion((version) => version + 1);
  }, []);

  const isRouteCached = useCallback((technician: TechnicianProfile, caseItem: CaseProfile) => {
    return routeCache.current.has(routeCacheKey(technician, caseItem));
  }, []);

  const findMatchingTechnicians = useCallback((caseId: string) => {
    const caseItem = database.cases.find((item) => item.id === caseId);
    if (!caseItem) return [] as SharedMatchResult[];
    return buildMatchesForCase({
      caseItem,
      technicians: database.technicians,
      assignments: database.assignments,
      cases: database.cases,
      getRouteInfo,
      sameStateOnly: true,
    });
  }, [database.assignments, database.cases, database.technicians, getRouteInfo]);

  const findMatchingCases = useCallback((technicianId: string) => {
    const technician = database.technicians.find((item) => item.id === technicianId);
    if (!technician) return [] as SharedMatchResult[];
    return buildMatchesForTechnician({
      technician,
      technicians: database.technicians,
      cases: database.cases,
      assignments: database.assignments,
      getRouteInfo,
    }).sort(rankCaseMatchesForTechnician);
  }, [database.assignments, database.cases, database.technicians, getRouteInfo]);

  const assignCase = useCallback(async (params: AssignCaseParams) => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      return { ok: false, message: getSupabaseConfigError() ?? "Supabase client is unavailable." } as const;
    }

    const latest = await fetchStaffingDatabase(client);
    const result = assignCaseInDatabase({
      database: latest,
      technicianId: params.technicianId,
      caseId: params.caseId,
      assignedBy: params.assignedBy,
      getRouteInfo,
    });

    if (!result.ok) return result;

    await insertAssignmentRecord(client, result.assignment);
    await refreshDatabase();

    return {
      ok: true,
      assignment: result.assignment,
    } as const;
  }, [getRouteInfo, refreshDatabase]);

  const unassignCase = useCallback(async (assignmentId: string) => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      return { ok: false, message: getSupabaseConfigError() ?? "Supabase client is unavailable." } as const;
    }

    const latest = await fetchStaffingDatabase(client);
    const result = unassignCaseInDatabase({ database: latest, assignmentId });
    if (!result.ok) return result;

    const updated = result.database.assignments.find((assignment) => assignment.id === assignmentId);
    if (!updated) {
      return { ok: false, message: "Assignment was not found after unassigning." } as const;
    }

    const { error } = await client
      .from("assignments")
      .update({
        status: updated.status,
        unassigned_at: updated.unassignedAt ?? null,
      })
      .eq("id", assignmentId);

    if (error) {
      return { ok: false, message: "Unable to update the assignment. Please try again." } as const;
    }

    await refreshDatabase();
    return { ok: true } as const;
  }, [refreshDatabase]);

  const markCaseStarted = useCallback(async (caseId: string) => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      return { ok: false, message: getSupabaseConfigError() ?? "Supabase client is unavailable." } as const;
    }

    const latest = await fetchStaffingDatabase(client);
    const caseItem = latest.cases.find((item) => item.id === caseId);

    if (!caseItem) {
      return { ok: false, message: "Case not found." } as const;
    }

    const today = new Date().toISOString().slice(0, 10);
    const nextCases = latest.cases.map((item) =>
      item.id === caseId ? { ...item, startDate: item.startDate || today } : item
    );

    const nextAssignments = latest.assignments.map((assignment) => {
      if (assignment.caseId !== caseId || assignment.status === "Unassigned") {
        return assignment;
      }

      return {
        ...assignment,
        status: "Active" as const,
        newTechnicianStatus: "Active",
      };
    });

    latest.assignmentHistory.map((history) => {
      if (history.caseId !== caseId || history.assignmentStatus === "Unassigned") {
        return history;
      }

      return {
        ...history,
        assignmentStatus: "Active" as const,
        newTechnicianStatus: "Active",
      };
    });

    const startedAt = new Date().toISOString();

    const { error: caseError } = await client
      .from("cases")
      .update({ start_date: nextCases.find((item) => item.id === caseId)?.startDate ?? today })
      .eq("id", caseId);

    if (caseError) {
      return { ok: false, message: "Unable to start the case. Please try again." } as const;
    }

    const assignmentUpdates = nextAssignments.filter((assignment) => assignment.caseId === caseId && assignment.status === "Active");
    for (const assignment of assignmentUpdates) {
      const { error } = await client
        .from("assignments")
        .update({
          status: assignment.status,
          started_at: assignment.startedAt ?? startedAt,
          new_technician_status: assignment.newTechnicianStatus,
        })
        .eq("id", assignment.id);

      if (error) {
        return { ok: false, message: "Unable to start the case. Please try again." } as const;
      }
    }
    await refreshDatabase();
    return { ok: true } as const;
  }, [refreshDatabase]);

  const upsertCase = useCallback(async (caseInput: Omit<CaseProfile, "id"> & { id?: string }) => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      return { ok: false, message: getSupabaseConfigError() ?? "Supabase client is unavailable." } as const;
    }

    try {
      await upsertCaseRecord(client, caseInput);
      await refreshDatabase();
      return { ok: true } as const;
    } catch {
      return { ok: false, message: "Unable to save the case. Please try again." } as const;
    }
  }, [refreshDatabase]);

  const deleteCase = useCallback(async (caseId: string) => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      return { ok: false, message: getSupabaseConfigError() ?? "Supabase client is unavailable." } as const;
    }

    const { error } = await client.from("cases").delete().eq("id", caseId);
    if (error) {
      return { ok: false, message: "Unable to delete the case. Please try again." } as const;
    }

    await refreshDatabase();
    return { ok: true } as const;
  }, [refreshDatabase]);

  const upsertTechnician = useCallback(async (technicianInput: Omit<TechnicianProfile, "id"> & { id?: string }) => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      return { ok: false, message: getSupabaseConfigError() ?? "Supabase client is unavailable." } as const;
    }

    try {
      await upsertTechnicianRecord(client, technicianInput);
      await refreshDatabase();
      return { ok: true } as const;
    } catch {
      return { ok: false, message: "Unable to save the technician. Please try again." } as const;
    }
  }, [refreshDatabase]);

  const deleteTechnician = useCallback(async (technicianId: string) => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      return { ok: false, message: getSupabaseConfigError() ?? "Supabase client is unavailable." } as const;
    }

    const { error } = await client.from("technicians").delete().eq("id", technicianId);
    if (error) {
      return { ok: false, message: "Unable to delete the technician. Please try again." } as const;
    }

    await refreshDatabase();
    return { ok: true } as const;
  }, [refreshDatabase]);

  const createDraftCase = useCallback((input: {
    name: string;
    city: string;
    state: string;
    requiredDays: DayName[];
    requiredStartTime: string;
    requiredEndTime: string;
    zip?: string;
    address?: string;
    startDate?: string;
    bcba?: string;
    urgency?: CaseProfile["urgency"];
  }) => {
    const normalizedState = normalizeState(input.state);
    const window = normalizeRequiredCaseWindow(input.requiredStartTime, input.requiredEndTime);
    const scheduleText = window
      ? formatRequiredScheduleSummary({
          days: input.requiredDays,
          startMinutes: window.startMinutes,
          endMinutes: window.endMinutes,
        })
      : "Schedule needs confirmation";

    const draft: CaseProfile = {
      id: crypto.randomUUID(),
      name: input.name,
      city: input.city,
      state: normalizedState,
      zip: input.zip,
      address: input.address,
      requiredDays: input.requiredDays,
      requiredStartTime: input.requiredStartTime,
      requiredEndTime: input.requiredEndTime,
      requiredScheduleText: scheduleText,
      startDate: input.startDate,
      bcba: input.bcba,
      urgency: input.urgency,
      status: "Open",
    };

    const matches = buildMatchesForCase({
      caseItem: draft,
      technicians: database.technicians,
      assignments: database.assignments,
      cases: database.cases,
      getRouteInfo,
    });

    return { draft, matches };
  }, [database.assignments, database.cases, database.technicians, getRouteInfo]);

  const value = useMemo(() => ({
    ...database,
    loading,
    errorMessage,
    routeCacheVersion,
    refreshDatabase,
    replaceTechnicians,
    importTechniciansFromCsv,
    resetDatabase,
    findMatchingTechnicians,
    findMatchingCases,
    assignCase,
    unassignCase,
    markCaseStarted,
    upsertTechnician,
    deleteTechnician,
    upsertCase,
    deleteCase,
    createDraftCase,
    getRouteInfo,
    cacheRouteInfo,
    isRouteCached,
  }), [
    assignCase,
    cacheRouteInfo,
    createDraftCase,
    database,
    errorMessage,
    findMatchingCases,
    findMatchingTechnicians,
    getRouteInfo,
    isRouteCached,
    importTechniciansFromCsv,
    loading,
    markCaseStarted,
    upsertTechnician,
    deleteTechnician,
    replaceTechnicians,
    refreshDatabase,
    resetDatabase,
    routeCacheVersion,
    unassignCase,
    upsertCase,
    deleteCase,
  ]);

  return <StaffingDatabaseContext.Provider value={value}>{children}</StaffingDatabaseContext.Provider>;
}

export function useStaffingDatabase() {
  const context = useContext(StaffingDatabaseContext);

  if (!context) {
    throw new Error("useStaffingDatabase must be used within StaffingDatabaseProvider.");
  }

  return context;
}
