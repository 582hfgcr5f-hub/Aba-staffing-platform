import { type SupabaseClient } from "@supabase/supabase-js";
import { recomputeDerivedData } from "@/app/data/assignment-workflow";
import {
  DAY_ORDER,
  formatMinutesToTimeLabel,
  formatRequiredScheduleSummary,
  normalizeRequiredCaseWindow,
  parseRequiredTimeToMinutes,
} from "@/app/data/smart-match-engine";
import {
  type AssignmentHistoryRecord,
  type AssignmentRecord,
  type CaseProfile,
  type DayName,
  type StaffingDatabase,
} from "@/app/data/staffing-types";
import { type TechnicianProfile } from "@/app/data/technicians";
import { normalizeState, parseTravelMinutes } from "@/app/data/technicians-utils";
import {
  type AssignmentInsert,
  type AssignmentRow,
  type AvailabilityInsert,
  type AvailabilityRow,
  type CaseInsert,
  type CaseRow,
  type Database,
  type Json,
  type TechnicianInsert,
  type TechnicianRow,
} from "@/app/data/supabase-types";

type SupabaseDbClient = SupabaseClient<Database>;

type TechnicianDocument = { name: string; type: string; updated: string; path?: string };

function isDayName(value: string): value is DayName {
  return DAY_ORDER.includes(value as DayName);
}

function dayNameToIndex(day: DayName) {
  return DAY_ORDER.indexOf(day);
}

function indexToDayName(index: number): DayName | null {
  return DAY_ORDER[index] ?? null;
}

function formatTimeValue(value?: string | null) {
  if (!value) return "";
  const minutes = parseRequiredTimeToMinutes(value);
  return minutes === null ? value : formatMinutesToTimeLabel(minutes);
}

function buildHoursSummary(days: DayName[], startTime?: string | null, endTime?: string | null, fallback?: string | null) {
  if (days.length > 0 && startTime && endTime) {
    const window = normalizeRequiredCaseWindow(startTime, endTime);
    if (window && !window.isAmbiguous) {
      return formatRequiredScheduleSummary({
        days,
        startMinutes: window.startMinutes,
        endMinutes: window.endMinutes,
      });
    }
  }

  if (startTime && endTime) {
    return `${formatTimeValue(startTime)}-${formatTimeValue(endTime)}`;
  }

  return fallback ?? "";
}

function normalizeCaseDays(days: string[] | null | undefined) {
  return (days ?? []).filter(isDayName);
}

function parseDocuments(value: Json | null): TechnicianDocument[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const name = typeof item.name === "string" ? item.name : "";
    const type = typeof item.type === "string" ? item.type : "";
    const updated = typeof item.updated === "string" ? item.updated : "";
    const path = typeof item.path === "string" ? item.path : undefined;

    if (!name || !type || !updated) return [];
    return [{ name, type, updated, path }];
  });
}

function buildAssignmentHistory(
  assignments: AssignmentRecord[],
  technicians: TechnicianProfile[],
  cases: CaseProfile[]
): AssignmentHistoryRecord[] {
  return assignments
    .map((assignment) => {
      const technician = technicians.find((item) => item.id === assignment.technicianId);
      const caseItem = cases.find((item) => item.id === assignment.caseId);

      return {
        id: assignment.id,
        assignmentId: assignment.id,
        dateTime: assignment.assignedAt,
        technicianId: assignment.technicianId,
        technicianName: technician?.name ?? assignment.technicianId,
        caseId: assignment.caseId,
        caseName: caseItem?.name ?? assignment.caseId,
        requiredSchedule: assignment.requiredScheduleAtAssignment,
        driveTimeMinutes: assignment.driveTimeMinutesAtAssignment,
        driveDistanceMiles: assignment.driveDistanceMilesAtAssignment,
        previousTechnicianStatus: assignment.previousTechnicianStatus,
        newTechnicianStatus: assignment.newTechnicianStatus,
        assignmentStatus: assignment.status,
        unassignedDate: assignment.unassignedAt,
      } satisfies AssignmentHistoryRecord;
    })
    .sort((left, right) => left.dateTime.localeCompare(right.dateTime));
}

function mapTechnicianRow(row: TechnicianRow, availabilityRows: AvailabilityRow[]): TechnicianProfile {
  const availableDays = availabilityRows
    .map((item) => indexToDayName(item.day_of_week))
    .filter((item): item is DayName => item !== null);
  const firstAvailability = availabilityRows[0];
  const preferredStartTime = row.preferred_start_time ?? firstAvailability?.start_time ?? undefined;
  const preferredEndTime = row.preferred_end_time ?? firstAvailability?.end_time ?? undefined;

  return {
    id: row.id,
    name: row.name,
    city: row.city,
    state: normalizeState(row.state),
    zip: row.zip ?? undefined,
    status: row.status,
    phone: row.phone ?? "",
    email: row.email ?? "",
    preferredContactMethod: row.preferred_contact ?? "",
    employmentType: row.employment_type ?? "",
    experience: row.experience ?? undefined,
    travelRadius:
      row.travel_radius_minutes !== null && row.travel_radius_minutes !== undefined
        ? `${row.travel_radius_minutes} min`
        : "",
    travelMinutes: row.travel_radius_minutes ?? undefined,
    desiredPay: row.desired_pay ?? undefined,
    hours: buildHoursSummary(availableDays, preferredStartTime, preferredEndTime, row.hours),
    preferredStartTime,
    preferredEndTime,
    availableDays,
    availableStartDate: row.available_start_date ?? "",
    centralReachExperience: row.centralreach_experience ?? "",
    rating: row.rating ?? undefined,
    notes: row.notes ?? undefined,
    certifications: row.certifications ?? [],
    availability: row.availability ?? "Open for new assignments",
    clients: [],
    recruiterNotes: row.recruiter_notes ?? row.notes ?? "",
    yearsAba: row.years_aba ?? undefined,
    yearsRbt: row.years_rbt ?? undefined,
    inHomeExperience: row.in_home_experience ?? undefined,
    clinicExperience: row.clinic_experience ?? undefined,
    severeBehaviorsExperience: row.severe_behaviors_experience ?? undefined,
    preferredAgeGroup: row.preferred_age_group ?? undefined,
    skills: row.skills ?? [],
    certificationOther: row.certification_other ?? undefined,
    skillOther: row.skill_other ?? undefined,
    backgroundCheckSubmitted: row.background_check_submitted,
    backgroundCleared: row.background_cleared,
    drugScreen: row.drug_screen,
    cprVerified: row.cpr_verified,
    rbtLicenseVerified: row.rbt_license_verified,
    documents: parseDocuments(row.documents),
    profilePhotoPath: row.profile_photo_path ?? undefined,
    profilePhotoName: row.profile_photo_name ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
  };
}

function mapCaseRow(row: CaseRow): CaseProfile {
  return {
    id: row.id,
    name: row.client_name,
    city: row.city,
    state: normalizeState(row.state),
    zip: row.zip ?? undefined,
    address: row.address ?? undefined,
    contactName: row.contact_name ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    preferredContact: row.preferred_contact ?? undefined,
    bcbaPhone: row.bcba_phone ?? undefined,
    bcbaEmail: row.bcba_email ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    requiredDays: normalizeCaseDays(row.required_days),
    requiredStartTime: row.start_time ?? "",
    requiredEndTime: row.end_time ?? "",
    requiredScheduleText: row.required_schedule_text ?? "",
    startDate: row.start_date ?? undefined,
    bcba: row.bcba ?? undefined,
    preferredTechnicianGender: row.preferred_technician_gender ?? undefined,
    urgency: (row.urgency as CaseProfile["urgency"]) ?? undefined,
    status: row.status as CaseProfile["status"],
    notes: row.notes ?? undefined,
  };
}

function mapAssignmentRow(row: AssignmentRow): AssignmentRecord {
  return {
    id: row.id,
    technicianId: row.technician_id,
    caseId: row.case_id,
    status: row.status as AssignmentRecord["status"],
    assignedAt: row.assigned_at,
    assignedBy: row.assigned_by ?? "Coordinator",
    driveTimeMinutesAtAssignment: row.drive_time_minutes,
    driveDistanceMilesAtAssignment: row.drive_distance_miles,
    requiredScheduleAtAssignment: row.required_schedule_at_assignment ?? "",
    previousTechnicianStatus: row.previous_technician_status ?? "Available",
    newTechnicianStatus: row.new_technician_status ?? row.status,
    startedAt: row.started_at ?? undefined,
    unassignedAt: row.unassigned_at ?? undefined,
    notes: row.notes ?? undefined,
  };
}

function toTechnicianInsert(profile: Omit<TechnicianProfile, "id"> & { id?: string }): TechnicianInsert {
  const availableDays = (profile.availableDays ?? []).filter(isDayName);
  const travelRadiusMinutes = parseTravelMinutes(profile.travelMinutes ?? profile.travelRadius);

  return {
    id: profile.id,
    name: profile.name.trim(),
    phone: profile.phone.trim() || null,
    email: profile.email.trim().toLowerCase() || null,
    city: profile.city.trim(),
    state: normalizeState(profile.state),
    zip: profile.zip?.trim() || null,
    status: profile.status,
    employment_type: profile.employmentType.trim() || null,
    experience: profile.experience?.trim() || null,
    preferred_start_time: profile.preferredStartTime?.trim() || null,
    preferred_end_time: profile.preferredEndTime?.trim() || null,
    travel_radius_minutes: travelRadiusMinutes,
    desired_pay: profile.desiredPay?.trim() || null,
    centralreach_experience: profile.centralReachExperience.trim() || null,
    preferred_contact: profile.preferredContactMethod.trim() || null,
    rating: profile.rating?.trim() || null,
    notes: profile.notes?.trim() || null,
    hours: buildHoursSummary(availableDays, profile.preferredStartTime, profile.preferredEndTime, profile.hours),
    available_start_date: profile.availableStartDate || null,
    certifications: profile.certifications,
    availability: profile.availability || null,
    recruiter_notes: profile.recruiterNotes.trim() || null,
    years_aba: profile.yearsAba ?? null,
    years_rbt: profile.yearsRbt ?? null,
    in_home_experience: profile.inHomeExperience ?? null,
    clinic_experience: profile.clinicExperience ?? null,
    severe_behaviors_experience: profile.severeBehaviorsExperience ?? null,
    preferred_age_group: profile.preferredAgeGroup?.trim() || null,
    skills: profile.skills ?? [],
    certification_other: profile.certificationOther?.trim() || null,
    skill_other: profile.skillOther?.trim() || null,
    background_check_submitted: profile.backgroundCheckSubmitted ?? false,
    background_cleared: profile.backgroundCleared ?? false,
    drug_screen: profile.drugScreen ?? false,
    cpr_verified: profile.cprVerified ?? false,
    rbt_license_verified: profile.rbtLicenseVerified ?? false,
    documents: profile.documents as Json,
    profile_photo_path: profile.profilePhotoPath ?? null,
    profile_photo_name: profile.profilePhotoName ?? null,
    latitude: profile.latitude ?? null,
    longitude: profile.longitude ?? null,
  };
}

function toAvailabilityInserts(technicianId: string, profile: Omit<TechnicianProfile, "id"> & { id?: string }): AvailabilityInsert[] {
  const startTime = profile.preferredStartTime?.trim() || null;
  const endTime = profile.preferredEndTime?.trim() || null;

  return (profile.availableDays ?? [])
    .filter(isDayName)
    .map((day) => ({
      technician_id: technicianId,
      day_of_week: dayNameToIndex(day),
      start_time: startTime,
      end_time: endTime,
    }));
}

function toCaseInsert(caseItem: Omit<CaseProfile, "id"> & { id?: string }): CaseInsert {
  return {
    id: caseItem.id,
    client_name: caseItem.name.trim(),
    address: caseItem.address?.trim() || null,
    city: caseItem.city.trim(),
    state: normalizeState(caseItem.state),
    zip: caseItem.zip?.trim() || null,
    status: caseItem.status,
    required_days: caseItem.requiredDays,
    start_time: caseItem.requiredStartTime || null,
    end_time: caseItem.requiredEndTime || null,
    start_date: caseItem.startDate || null,
    bcba: caseItem.bcba?.trim() || null,
    notes: caseItem.notes?.trim() || null,
    contact_name: caseItem.contactName?.trim() || null,
    phone: caseItem.phone?.trim() || null,
    email: caseItem.email?.trim().toLowerCase() || null,
    preferred_contact: caseItem.preferredContact?.trim() || null,
    bcba_phone: caseItem.bcbaPhone?.trim() || null,
    bcba_email: caseItem.bcbaEmail?.trim().toLowerCase() || null,
    preferred_technician_gender: caseItem.preferredTechnicianGender?.trim() || null,
    urgency: caseItem.urgency ?? null,
    required_schedule_text: caseItem.requiredScheduleText.trim() || null,
    latitude: caseItem.latitude ?? null,
    longitude: caseItem.longitude ?? null,
  };
}

export async function fetchStaffingDatabase(client: SupabaseDbClient): Promise<StaffingDatabase> {
  const [techniciansResult, availabilityResult, casesResult, assignmentsResult] = await Promise.all([
    client.from("technicians").select("*").order("name"),
    client.from("technician_availability").select("*").order("day_of_week"),
    client.from("cases").select("*").order("client_name"),
    client.from("assignments").select("*").order("assigned_at"),
  ]);

  if (techniciansResult.error) throw techniciansResult.error;
  if (availabilityResult.error) throw availabilityResult.error;
  if (casesResult.error) throw casesResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;

  const availabilityByTechnician = new Map<string, AvailabilityRow[]>();
  for (const availability of availabilityResult.data) {
    const current = availabilityByTechnician.get(availability.technician_id) ?? [];
    current.push(availability);
    availabilityByTechnician.set(availability.technician_id, current);
  }

  const technicians = techniciansResult.data.map((row) => mapTechnicianRow(row, availabilityByTechnician.get(row.id) ?? []));
  const cases = casesResult.data.map(mapCaseRow);
  const assignments = assignmentsResult.data.map(mapAssignmentRow);
  const assignmentHistory = buildAssignmentHistory(assignments, technicians, cases);

  return recomputeDerivedData({
    technicians,
    cases,
    assignments,
    assignmentHistory,
  });
}

export async function upsertTechnicianRecord(
  client: SupabaseDbClient,
  profile: Omit<TechnicianProfile, "id"> & { id?: string }
) {
  const payload = toTechnicianInsert(profile);
  const { data, error } = await client
    .from("technicians")
    .upsert(payload, { onConflict: "dedupe_key" })
    .select("id")
    .single();

  if (error) throw error;

  const technicianId = data.id;
  const { error: deleteAvailabilityError } = await client
    .from("technician_availability")
    .delete()
    .eq("technician_id", technicianId);

  if (deleteAvailabilityError) throw deleteAvailabilityError;

  const availabilityRows = toAvailabilityInserts(technicianId, profile);
  if (availabilityRows.length > 0) {
    const { error: availabilityError } = await client
      .from("technician_availability")
      .insert(availabilityRows);

    if (availabilityError) throw availabilityError;
  }

  return technicianId;
}

export async function importTechnicianRecords(client: SupabaseDbClient, profiles: TechnicianProfile[]) {
  for (const profile of profiles) {
    await upsertTechnicianRecord(client, profile);
  }
}

export async function upsertCaseRecord(client: SupabaseDbClient, caseItem: Omit<CaseProfile, "id"> & { id?: string }) {
  const { error } = await client.from("cases").upsert(toCaseInsert(caseItem), { onConflict: "dedupe_key" });
  if (error) throw error;
}

export async function insertAssignmentRecord(client: SupabaseDbClient, assignment: AssignmentRecord) {
  const payload: AssignmentInsert = {
    id: assignment.id,
    technician_id: assignment.technicianId,
    case_id: assignment.caseId,
    status: assignment.status,
    assigned_at: assignment.assignedAt,
    started_at: assignment.startedAt ?? (assignment.status === "Active" ? assignment.assignedAt : null),
    unassigned_at: assignment.unassignedAt ?? null,
    drive_time_minutes: assignment.driveTimeMinutesAtAssignment,
    drive_distance_miles: assignment.driveDistanceMilesAtAssignment,
    notes: assignment.notes ?? null,
    assigned_by: assignment.assignedBy,
    required_schedule_at_assignment: assignment.requiredScheduleAtAssignment,
    previous_technician_status: assignment.previousTechnicianStatus,
    new_technician_status: assignment.newTechnicianStatus,
  };

  const { error } = await client.from("assignments").insert(payload);
  if (error) throw error;
}