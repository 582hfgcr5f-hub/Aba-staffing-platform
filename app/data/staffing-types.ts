import { type TechnicianProfile } from "./technicians";

export const READINESS_STATUSES = [
  "Ready to Assign",
  "Travel Needs Confirmation",
  "Needs Availability Confirmation",
  "Schedule Conflict",
  "Outside Travel Radius",
  "Different State",
] as const;

export type ReadinessStatus = (typeof READINESS_STATUSES)[number];

export type DayName =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export type CaseUrgency = "Low" | "Medium" | "High";

export type CaseProfile = {
  id: string;
  name: string;
  city: string;
  state: string;
  zip?: string;
  address?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
  requiredDays: DayName[];
  requiredStartTime: string;
  requiredEndTime: string;
  requiredScheduleText: string;
  startDate?: string;
  bcba?: string;
  bcbaPhone?: string;
  bcbaEmail?: string;
  preferredContact?: string;
  preferredTechnicianGender?: string;
  urgency?: CaseUrgency;
  status: "Open" | "Assigned" | "Active" | "Pending" | "On Hold" | "Open Client" | "Assigned Client" | "Active Client";
  notes?: string;
};

export type AssignmentStatus = "Assigned" | "Active" | "Unassigned";

export type AssignmentRecord = {
  id: string;
  technicianId: string;
  caseId: string;
  status: AssignmentStatus;
  assignedAt: string;
  assignedBy: string;
  driveTimeMinutesAtAssignment: number | null;
  driveDistanceMilesAtAssignment: number | null;
  requiredScheduleAtAssignment: string;
  previousTechnicianStatus: string;
  newTechnicianStatus: string;
  startedAt?: string;
  unassignedAt?: string;
  notes?: string;
};

export type AssignmentHistoryRecord = {
  id: string;
  assignmentId: string;
  dateTime: string;
  technicianId: string;
  technicianName: string;
  caseId: string;
  caseName: string;
  requiredSchedule: string;
  driveTimeMinutes: number | null;
  driveDistanceMiles: number | null;
  previousTechnicianStatus: string;
  newTechnicianStatus: string;
  assignmentStatus: AssignmentStatus;
  unassignedDate?: string;
};

export type StaffingDatabase = {
  technicians: TechnicianProfile[];
  cases: CaseProfile[];
  assignments: AssignmentRecord[];
  assignmentHistory: AssignmentHistoryRecord[];
};

export type RouteInfo = {
  driveTimeMinutes: number | null;
  driveDistanceMiles: number | null;
  routeStatus: "ok" | "missing-coordinates" | "route-failed";
};

export type ConflictReasonCode =
  | "state_mismatch"
  | "outside_travel_radius"
  | "availability_missing"
  | "day_unavailable"
  | "hours_mismatch"
  | "existing_case_overlap"
  | "existing_case_unparseable"
  | "status_not_eligible"
  | "invalid_time_range"
  | "duplicate_assignment"
  | "route_unavailable";

export type MatchReason = {
  code: ConflictReasonCode;
  message: string;
};

export type SharedMatchResult = {
  technician: TechnicianProfile;
  caseItem: CaseProfile;
  driveTimeMinutes: number | null;
  driveDistanceMiles: number | null;
  scheduleCompatibility: "Full" | "Partial" | "Conflict" | "Unknown";
  travelCompatibility: "Within Radius" | "Outside Radius" | "Unknown";
  availabilityStatus: "Available" | "Needs Confirmation" | "Unavailable";
  currentClientCount: number;
  conflictReasons: MatchReason[];
  readinessStatus: ReadinessStatus;
  transparency: string[];
};

export type AssignmentValidationResult = {
  ok: boolean;
  readinessStatus: ReadinessStatus;
  reasons: MatchReason[];
  transparency: string[];
};