import { buildMatchesForCase, formatRequiredScheduleSummary, normalizeRequiredCaseWindow, validateAssignment } from "./smart-match-engine";
import { createTechnicianSlug } from "./technicians-utils";
import {
  type AssignmentHistoryRecord,
  type AssignmentRecord,
  type CaseProfile,
  type RouteInfo,
  type SharedMatchResult,
  type StaffingDatabase,
} from "./staffing-types";
import { type TechnicianProfile } from "./technicians";

function inferCaseStatusFromAssignments(
  caseId: string,
  currentStatus: CaseProfile["status"],
  assignments: AssignmentRecord[]
): CaseProfile["status"] {
  const active = assignments.some((item) => item.caseId === caseId && item.status === "Active");
  if (active) return "Active";
  const assigned = assignments.some((item) => item.caseId === caseId && item.status === "Assigned");
  if (assigned) return "Assigned";

  if (currentStatus === "Pending" || currentStatus === "On Hold") {
    return currentStatus;
  }

  return "Open";
}

export function nextTechnicianStatus(
  technician: TechnicianProfile,
  assignments: AssignmentRecord[]
): TechnicianProfile["status"] {
  const current = assignments.filter(
    (assignment) => assignment.technicianId === technician.id && assignment.status !== "Unassigned"
  );
  const hasActive = current.some((assignment) => assignment.status === "Active");
  const hasAssigned = current.some((assignment) => assignment.status === "Assigned");

  if (hasActive) return "Active";
  if (hasAssigned) return "Assigned";
  if (technician.status === "Interview") return "Interview";
  return "Available";
}

export function deriveAssignmentStatus(startDate?: string): AssignmentRecord["status"] {
  if (!startDate) return "Assigned";
  const parsed = new Date(startDate);
  if (Number.isNaN(parsed.getTime())) return "Assigned";
  return parsed <= new Date() ? "Active" : "Assigned";
}

function caseToClientSchedule(caseItem: CaseProfile) {
  const normalized = normalizeRequiredCaseWindow(caseItem.requiredStartTime, caseItem.requiredEndTime);
  if (!normalized || normalized.isAmbiguous) {
    return caseItem.requiredScheduleText || "Schedule pending";
  }
  return formatRequiredScheduleSummary({
    days: caseItem.requiredDays,
    startMinutes: normalized.startMinutes,
    endMinutes: normalized.endMinutes,
  });
}

export function recomputeDerivedData(data: StaffingDatabase): StaffingDatabase {
  const cases = data.cases.map((caseItem) => ({
    ...caseItem,
    status: inferCaseStatusFromAssignments(caseItem.id, caseItem.status, data.assignments),
  }));

  const caseById = new Map(cases.map((caseItem) => [caseItem.id, caseItem]));

  const technicians = data.technicians.map((technician) => {
    const linkedCaseIds = data.assignments
      .filter((assignment) => assignment.technicianId === technician.id && assignment.status !== "Unassigned")
      .map((assignment) => assignment.caseId);

    const linkedClients = linkedCaseIds
      .map((caseId) => caseById.get(caseId))
      .filter((caseItem): caseItem is CaseProfile => Boolean(caseItem))
      .map((caseItem) => ({
        name: caseItem.name,
        city: caseItem.city,
        schedule: caseToClientSchedule(caseItem),
        status: caseItem.status === "Active" || caseItem.status === "Active Client" ? "Active" : "Assigned",
      }));

    const existingByName = new Map(technician.clients.map((client) => [client.name, client]));
    for (const linkedClient of linkedClients) {
      existingByName.set(linkedClient.name, linkedClient);
    }

    const nextAssignments = data.assignments.filter(
      (assignment) => assignment.technicianId === technician.id
    );

    return {
      ...technician,
      clients: Array.from(existingByName.values()),
      status: nextTechnicianStatus(technician, nextAssignments),
      availability:
        nextAssignments.filter((assignment) => assignment.status !== "Unassigned").length > 0
          ? "Partially booked"
          : "Open for new assignments",
    };
  });

  return {
    ...data,
    technicians,
    cases,
  };
}

export function assignCaseInDatabase(input: {
  database: StaffingDatabase;
  technicianId: string;
  caseId: string;
  assignedBy?: string;
  getRouteInfo: (technician: TechnicianProfile, caseItem: CaseProfile) => RouteInfo;
}):
  | {
      ok: true;
      database: StaffingDatabase;
      assignment: AssignmentRecord;
      match: SharedMatchResult;
    }
  | {
      ok: false;
      message: string;
    } {
  const technician = input.database.technicians.find((item) => item.id === input.technicianId);
  const caseItem = input.database.cases.find((item) => item.id === input.caseId);

  if (!technician || !caseItem) {
    return { ok: false, message: "Assignment cannot be completed. Technician or case is missing." };
  }

  const currentMatch = buildMatchesForCase({
    caseItem,
    technicians: [technician],
    assignments: input.database.assignments,
    cases: input.database.cases,
    getRouteInfo: input.getRouteInfo,
  })[0];

  if (!currentMatch) {
    return { ok: false, message: "Assignment cannot be completed. Match data is unavailable." };
  }

  const validation = validateAssignment(currentMatch);
  if (!validation.ok) {
    const specific = validation.reasons[0]?.message ?? "A new conflict was detected.";
    return { ok: false, message: `Assignment cannot be completed. ${specific}` };
  }

  const duplicate = input.database.assignments.some(
    (assignment) =>
      assignment.technicianId === technician.id &&
      assignment.caseId === caseItem.id &&
      assignment.status !== "Unassigned"
  );

  if (duplicate) {
    return {
      ok: false,
      message: "Assignment cannot be completed. Technician is already assigned to this client.",
    };
  }

  const previousStatus = technician.status;
  const assignmentStatus = deriveAssignmentStatus(caseItem.startDate);
  const assignment: AssignmentRecord = {
    id: crypto.randomUUID(),
    technicianId: technician.id,
    caseId: caseItem.id,
    status: assignmentStatus,
    assignedAt: new Date().toISOString(),
    assignedBy: input.assignedBy ?? "Coordinator",
    driveTimeMinutesAtAssignment: currentMatch.driveTimeMinutes,
    driveDistanceMilesAtAssignment: currentMatch.driveDistanceMiles,
    requiredScheduleAtAssignment: caseToClientSchedule(caseItem),
    previousTechnicianStatus: previousStatus,
    newTechnicianStatus: assignmentStatus === "Active" ? "Active" : "Assigned",
  };

  const history: AssignmentHistoryRecord = {
    id: crypto.randomUUID(),
    assignmentId: assignment.id,
    dateTime: assignment.assignedAt,
    technicianId: technician.id,
    technicianName: technician.name,
    caseId: caseItem.id,
    caseName: caseItem.name,
    requiredSchedule: assignment.requiredScheduleAtAssignment,
    driveTimeMinutes: assignment.driveTimeMinutesAtAssignment,
    driveDistanceMiles: assignment.driveDistanceMilesAtAssignment,
    previousTechnicianStatus: previousStatus,
    newTechnicianStatus: assignment.newTechnicianStatus,
    assignmentStatus,
  };

  const recomputed = recomputeDerivedData({
    ...input.database,
    assignments: [...input.database.assignments, assignment],
    assignmentHistory: [...input.database.assignmentHistory, history],
  });

  return { ok: true, database: recomputed, assignment, match: currentMatch };
}

export function unassignCaseInDatabase(input: {
  database: StaffingDatabase;
  assignmentId: string;
}):
  | {
      ok: true;
      database: StaffingDatabase;
    }
  | {
      ok: false;
      message: string;
    } {
  const target = input.database.assignments.find((assignment) => assignment.id === input.assignmentId);
  if (!target || target.status === "Unassigned") {
    return { ok: false, message: "Assignment was not found or is already unassigned." };
  }

  const now = new Date().toISOString();

  const updatedAssignments = input.database.assignments.map((assignment) =>
    assignment.id === input.assignmentId
      ? {
          ...assignment,
          status: "Unassigned" as const,
          unassignedAt: now,
        }
      : assignment
  );

  const updatedHistory = input.database.assignmentHistory.map((history) =>
    history.assignmentId === input.assignmentId
      ? {
          ...history,
          assignmentStatus: "Unassigned" as const,
          unassignedDate: now,
        }
      : history
  );

  return {
    ok: true,
    database: recomputeDerivedData({
      ...input.database,
      assignments: updatedAssignments,
      assignmentHistory: updatedHistory,
    }),
  };
}

export function createCaseIdFromName(name: string) {
  return createTechnicianSlug(name || crypto.randomUUID());
}
