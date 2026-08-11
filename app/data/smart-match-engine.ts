import { getTechnicianClientCount, normalizeState, parseTravelMinutes } from "./technicians-utils";
import {
  type AssignmentRecord,
  type AssignmentValidationResult,
  type CaseProfile,
  type DayName,
  type MatchReason,
  type ReadinessStatus,
  type RouteInfo,
  type SharedMatchResult,
} from "./staffing-types";
import { type TechnicianProfile } from "./technicians";

export const DAY_ORDER: DayName[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export type NormalizedSchedule = {
  days: DayName[];
  startMinutes: number;
  endMinutes: number;
  source: string;
};

export type DailyAvailability = {
  raw: string;
  normalized: NormalizedSchedule[];
  parseWarnings: string[];
};

export type ExistingCaseSchedule = {
  caseId?: string;
  clientName: string;
  status: string;
  rawSchedule: string;
  normalized: NormalizedSchedule[];
};

export type NormalizedCaseWindow = {
  startMinutes: number;
  endMinutes: number;
  isAmbiguous: boolean;
};

type ParsedTimeToken = {
  minutes: number;
  explicitMeridiem: boolean;
};

const DAY_ALIASES: Array<{ regex: RegExp; day: DayName }> = [
  { regex: /\bmonday\b|\bmon\b/i, day: "Monday" },
  { regex: /\btuesday\b|\btue\b|\btues\b/i, day: "Tuesday" },
  { regex: /\bwednesday\b|\bwed\b/i, day: "Wednesday" },
  { regex: /\bthursday\b|\bthu\b|\bthur\b|\bthurs\b/i, day: "Thursday" },
  { regex: /\bfriday\b|\bfri\b/i, day: "Friday" },
  { regex: /\bsaturday\b|\bsat\b/i, day: "Saturday" },
  { regex: /\bsunday\b|\bsun\b/i, day: "Sunday" },
];

const STAFFABLE_STATUSES = new Set(["Available", "Assigned", "Active", "Interview"]);

function cleanText(input: string) {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

function hasOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

function urgencyWeight(urgency?: string) {
  if (urgency === "High") return 0;
  if (urgency === "Medium") return 1;
  return 2;
}

export function formatMinutesToTimeLabel(totalMinutes: number): string {
  const normalized = Math.max(0, Math.min(24 * 60, totalMinutes));
  const hour24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function formatDaysSummary(days: DayName[]): string {
  if (days.length === 0) return "";
  const indexes = days.map((day) => DAY_ORDER.indexOf(day)).sort((a, b) => a - b);
  const ranges: Array<[number, number]> = [];

  for (const index of indexes) {
    const last = ranges[ranges.length - 1];
    if (!last) {
      ranges.push([index, index]);
      continue;
    }
    if (index === last[1] + 1) {
      last[1] = index;
      continue;
    }
    ranges.push([index, index]);
  }

  return ranges
    .map(([start, end]) => (start === end ? DAY_ORDER[start] : `${DAY_ORDER[start]}-${DAY_ORDER[end]}`))
    .join(", ");
}

export function formatRequiredScheduleSummary(input: {
  days: DayName[];
  startMinutes: number;
  endMinutes: number;
}): string {
  const dayLabel = formatDaysSummary(input.days);
  if (!dayLabel) return "";
  return `${dayLabel}, ${formatMinutesToTimeLabel(input.startMinutes)}-${formatMinutesToTimeLabel(input.endMinutes)}`;
}

export function parseRequiredTimeToMinutes(value: string): number | null {
  const cleaned = value.trim();
  if (!cleaned) return null;

  const amPmMatch = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (amPmMatch) {
    const hour = Number.parseInt(amPmMatch[1], 10);
    const minutes = amPmMatch[2] ? Number.parseInt(amPmMatch[2], 10) : 0;
    const meridiem = amPmMatch[3].toLowerCase();
    if (!Number.isFinite(hour) || !Number.isFinite(minutes) || hour < 1 || hour > 12 || minutes < 0 || minutes > 59) return null;
    const normalizedHour = hour % 12 + (meridiem === "pm" ? 12 : 0);
    return normalizedHour * 60 + minutes;
  }

  const match = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function parseCaseTimeToken(value: string): { minutes: number; hasMeridiem: boolean } | null {
  const cleaned = value.trim();
  if (!cleaned) return null;

  const amPmMatch = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (amPmMatch) {
    const hour = Number.parseInt(amPmMatch[1], 10);
    const minutes = amPmMatch[2] ? Number.parseInt(amPmMatch[2], 10) : 0;
    const meridiem = amPmMatch[3].toLowerCase();
    if (!Number.isFinite(hour) || !Number.isFinite(minutes) || hour < 1 || hour > 12 || minutes < 0 || minutes > 59) return null;
    const normalizedHour = hour % 12 + (meridiem === "pm" ? 12 : 0);
    return { minutes: normalizedHour * 60 + minutes, hasMeridiem: true };
  }

  const timeMatch = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) return null;
  const hours = Number.parseInt(timeMatch[1], 10);
  const minutes = Number.parseInt(timeMatch[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { minutes: hours * 60 + minutes, hasMeridiem: false };
}

export function normalizeRequiredCaseWindow(startValue: string, endValue: string): NormalizedCaseWindow | null {
  const startToken = parseCaseTimeToken(startValue);
  const endToken = parseCaseTimeToken(endValue);
  if (!startToken || !endToken) return null;

  const startMinutes = startToken.minutes;
  let endMinutes = endToken.minutes;
  let isAmbiguous = false;

  if (endMinutes <= startMinutes && !endToken.hasMeridiem && !startToken.hasMeridiem) {
    if (startMinutes >= 7 * 60) {
      endMinutes += 12 * 60;
    } else {
      isAmbiguous = true;
    }
  }

  if (endMinutes <= startMinutes) {
    isAmbiguous = true;
  }

  return { startMinutes, endMinutes, isAmbiguous };
}

export function parseDaysFromText(text: string): DayName[] {
  const value = cleanText(text);
  const daySet = new Set<DayName>();
  if (!value) return [];

  if (/\bweekdays\b/.test(value) || /\bm\s*[-–]\s*f\b/.test(value) || /\bmon\s*[-–]\s*fri\b/.test(value) || /\bmonday\s+through\s+friday\b/.test(value)) {
    daySet.add("Monday");
    daySet.add("Tuesday");
    daySet.add("Wednesday");
    daySet.add("Thursday");
    daySet.add("Friday");
  }

  if (/\bweekend\b/.test(value) || /\bsat\s*[-–]\s*sun\b/.test(value) || /\bsaturday\s+through\s+sunday\b/.test(value)) {
    daySet.add("Saturday");
    daySet.add("Sunday");
  }

  for (const alias of DAY_ALIASES) {
    if (alias.regex.test(value)) {
      daySet.add(alias.day);
    }
  }

  return DAY_ORDER.filter((day) => daySet.has(day));
}

function parseSingleTimeToken(rawToken: string, forceMeridiem: "am" | "pm" | null): ParsedTimeToken | null {
  const token = rawToken.trim().toLowerCase();
  const match = token.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;

  const hourRaw = Number.parseInt(match[1], 10);
  const minutesRaw = match[2] ? Number.parseInt(match[2], 10) : 0;
  const meridiemRaw = (match[3]?.toLowerCase() as "am" | "pm" | undefined) ?? forceMeridiem;

  if (!Number.isFinite(hourRaw) || !Number.isFinite(minutesRaw) || minutesRaw < 0 || minutesRaw > 59) return null;

  if (meridiemRaw) {
    if (hourRaw < 1 || hourRaw > 12) return null;
    let hours = hourRaw % 12;
    if (meridiemRaw === "pm") hours += 12;
    return { minutes: hours * 60 + minutesRaw, explicitMeridiem: Boolean(match[3]) };
  }

  if (hourRaw < 0 || hourRaw > 23) return null;
  return { minutes: hourRaw * 60 + minutesRaw, explicitMeridiem: false };
}

export function parseTimeRangeToMinutes(rawRange: string): { startMinutes: number; endMinutes: number } | null {
  const match = rawRange.trim().match(/^(.*?)\s*[-–]\s*(.*?)$/);
  if (!match) return null;

  const startRaw = match[1].trim();
  const endRaw = match[2].trim();
  const startHasMeridiem = /\b(am|pm)\b/i.test(startRaw);
  const endHasMeridiem = /\b(am|pm)\b/i.test(endRaw);

  if (startHasMeridiem || endHasMeridiem) {
    const inferredForStart = startHasMeridiem ? null : (endRaw.match(/\b(am|pm)\b/i)?.[1]?.toLowerCase() as "am" | "pm" | undefined) ?? null;
    const inferredForEnd = endHasMeridiem ? null : (startRaw.match(/\b(am|pm)\b/i)?.[1]?.toLowerCase() as "am" | "pm" | undefined) ?? null;
    const parsedStart = parseSingleTimeToken(startRaw, inferredForStart);
    const parsedEnd = parseSingleTimeToken(endRaw, inferredForEnd);
    if (!parsedStart || !parsedEnd) return null;
    if (parsedEnd.minutes <= parsedStart.minutes) return null;
    return { startMinutes: parsedStart.minutes, endMinutes: parsedEnd.minutes };
  }

  const parsedStart = parseSingleTimeToken(startRaw, null);
  const parsedEnd = parseSingleTimeToken(endRaw, null);
  if (!parsedStart || !parsedEnd) return null;

  const startHour = Math.floor(parsedStart.minutes / 60);
  const endHour = Math.floor(parsedEnd.minutes / 60);

  if (startHour > 12 || endHour > 12) {
    if (parsedEnd.minutes <= parsedStart.minutes) return null;
    return { startMinutes: parsedStart.minutes, endMinutes: parsedEnd.minutes };
  }

  if (startHour >= 8 && endHour <= 7) {
    return { startMinutes: parsedStart.minutes, endMinutes: parsedEnd.minutes + 12 * 60 };
  }

  if (startHour >= 1 && startHour <= 6 && endHour > startHour && endHour <= 8) {
    return { startMinutes: parsedStart.minutes + 12 * 60, endMinutes: parsedEnd.minutes + 12 * 60 };
  }

  if (startHour >= 7 && endHour > startHour && endHour <= 12) {
    return { startMinutes: parsedStart.minutes, endMinutes: parsedEnd.minutes };
  }

  return null;
}

export function normalizeAvailability(raw: string): DailyAvailability {
  const warnings: string[] = [];
  const normalized: NormalizedSchedule[] = [];

  const segments = raw
    .split(/[;|]/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (const segment of segments) {
    const timeMatch = segment.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (!timeMatch) {
      warnings.push(`Missing time range in "${segment}".`);
      continue;
    }

    const range = parseTimeRangeToMinutes(timeMatch[1]);
    if (!range) {
      warnings.push(`Ambiguous time range in "${segment}".`);
      continue;
    }

    const dayPart = segment.replace(timeMatch[1], " ").trim();
    const days = parseDaysFromText(dayPart);
    if (days.length === 0) {
      warnings.push(`Missing or unknown days in "${segment}".`);
      continue;
    }

    normalized.push({
      days,
      startMinutes: range.startMinutes,
      endMinutes: range.endMinutes,
      source: segment,
    });
  }

  return { raw, normalized, parseWarnings: warnings };
}

export function normalizeExistingCaseSchedule(clientName: string, status: string, rawSchedule: string, caseId?: string): ExistingCaseSchedule {
  return {
    caseId,
    clientName,
    status,
    rawSchedule,
    normalized: normalizeAvailability(rawSchedule).normalized,
  };
}

export function isCompleteCaseWindow(requiredWindow: NormalizedCaseWindow | null, requiredDays: DayName[], requiredState: string) {
  return Boolean(requiredWindow && !requiredWindow.isAmbiguous && requiredDays.length > 0 && normalizeState(requiredState) !== "");
}

function determineReadinessStatus(primaryReason: MatchReason | null): ReadinessStatus {
  if (!primaryReason) return "Ready to Assign";
  if (primaryReason.code === "route_unavailable") return "Travel Needs Confirmation";
  if (primaryReason.code === "state_mismatch") return "Different State";
  if (primaryReason.code === "outside_travel_radius") return "Outside Travel Radius";
  if (primaryReason.code === "availability_missing") return "Needs Availability Confirmation";
  return "Schedule Conflict";
}

function toExistingCaseSchedules(
  technician: TechnicianProfile,
  assignments: AssignmentRecord[],
  casesById: Map<string, CaseProfile>
): ExistingCaseSchedule[] {
  const scheduled = assignments.filter(
    (assignment) => assignment.technicianId === technician.id && assignment.status !== "Unassigned"
  );

  return scheduled
    .map((assignment) => {
      const caseItem = casesById.get(assignment.caseId);
      if (!caseItem) return null;
      return normalizeExistingCaseSchedule(caseItem.name, `${caseItem.status}`, caseItem.requiredScheduleText, caseItem.id);
    })
    .filter((value): value is ExistingCaseSchedule => value !== null);
}

function evaluateSingleMatch(input: {
  technician: TechnicianProfile;
  caseItem: CaseProfile;
  routeInfo: RouteInfo;
  assignments: AssignmentRecord[];
  existingCases: ExistingCaseSchedule[];
}): SharedMatchResult {
  const { technician, caseItem, routeInfo } = input;
  const reasons: MatchReason[] = [];
  const transparency: string[] = [];
  const techState = normalizeState(technician.state);
  const caseState = normalizeState(caseItem.state);

  if (techState !== caseState) {
    reasons.push({ code: "state_mismatch", message: "Different state." });
  }

  const driveLimit = technician.travelMinutes ?? parseTravelMinutes(technician.travelRadius) ?? 45;
  if (routeInfo.routeStatus !== "ok") {
    reasons.push({ code: "route_unavailable", message: "Route request unavailable; travel needs confirmation." });
  }

  if (routeInfo.driveTimeMinutes !== null && routeInfo.driveTimeMinutes > driveLimit) {
    reasons.push({
      code: "outside_travel_radius",
      message: `${routeInfo.driveTimeMinutes} minute drive exceeds technician limit of ${driveLimit} minutes.`,
    });
  }

  if (!STAFFABLE_STATUSES.has(technician.status)) {
    reasons.push({
      code: "status_not_eligible",
      message: `Technician status ${technician.status} does not allow assignment.`,
    });
  }

  const requiredWindow = normalizeRequiredCaseWindow(caseItem.requiredStartTime, caseItem.requiredEndTime);
  if (!requiredWindow || requiredWindow.isAmbiguous) {
    reasons.push({ code: "invalid_time_range", message: "Case required hours are missing or invalid." });
  }

  const availability = normalizeAvailability(technician.hours || technician.availability || "");
  if (availability.normalized.length === 0) {
    reasons.push({ code: "availability_missing", message: "Technician availability is missing or ambiguous." });
  }

  if (requiredWindow && !requiredWindow.isAmbiguous && availability.normalized.length > 0) {
    for (const day of caseItem.requiredDays) {
      const slots = availability.normalized.filter((slot) => slot.days.includes(day));
      if (slots.length === 0) {
        reasons.push({ code: "day_unavailable", message: `${day} availability is missing.` });
        continue;
      }

      const hasCoveringSlot = slots.some(
        (slot) => slot.startMinutes <= requiredWindow.startMinutes && slot.endMinutes >= requiredWindow.endMinutes
      );
      if (!hasCoveringSlot) {
        reasons.push({ code: "hours_mismatch", message: `Required hours are not fully covered on ${day}.` });
      }
    }
  }

  if (requiredWindow && !requiredWindow.isAmbiguous) {
    for (const existing of input.existingCases) {
      if (existing.caseId === caseItem.id) continue;

      if (existing.normalized.length === 0) {
        reasons.push({
          code: "existing_case_unparseable",
          message: `Existing case schedule for ${existing.clientName} is not parseable.`,
        });
        continue;
      }

      for (const day of caseItem.requiredDays) {
        const overlapsDay = existing.normalized.filter(
          (slot) => slot.days.includes(day) && hasOverlap(slot.startMinutes, slot.endMinutes, requiredWindow.startMinutes, requiredWindow.endMinutes)
        );
        if (overlapsDay.length > 0) {
          reasons.push({
            code: "existing_case_overlap",
            message: `Existing case overlaps ${day} ${formatMinutesToTimeLabel(requiredWindow.startMinutes)}-${formatMinutesToTimeLabel(requiredWindow.endMinutes)}.`,
          });
          break;
        }
      }
    }
  }

  const duplicate = input.assignments.some(
    (assignment) => assignment.technicianId === technician.id && assignment.caseId === caseItem.id && assignment.status !== "Unassigned"
  );
  if (duplicate) {
    reasons.push({ code: "duplicate_assignment", message: "Technician is already assigned to this client/case." });
  }

  const primaryReason =
    reasons.find((reason) => reason.code === "state_mismatch") ??
    reasons.find((reason) => reason.code === "outside_travel_radius") ??
    reasons.find((reason) => reason.code === "availability_missing") ??
    reasons[0] ??
    null;

  const readinessStatus = determineReadinessStatus(primaryReason);
  const scheduleCompatibility =
    reasons.some((r) => r.code === "existing_case_overlap" || r.code === "day_unavailable" || r.code === "hours_mismatch")
      ? "Conflict"
      : reasons.some((r) => r.code === "availability_missing" || r.code === "existing_case_unparseable")
        ? "Unknown"
        : "Full";

  const travelCompatibility =
    reasons.some((r) => r.code === "outside_travel_radius")
      ? "Outside Radius"
      : routeInfo.routeStatus === "ok"
        ? "Within Radius"
        : "Unknown";

  const availabilityStatus =
    reasons.some((r) => r.code === "day_unavailable" || r.code === "hours_mismatch" || r.code === "existing_case_overlap")
      ? "Unavailable"
      : reasons.some((r) => r.code === "availability_missing" || r.code === "existing_case_unparseable")
        ? "Needs Confirmation"
        : "Available";

  if (routeInfo.driveTimeMinutes !== null) {
    transparency.push(`${routeInfo.driveTimeMinutes} minute drive`);
  }
  if (scheduleCompatibility === "Full") {
    transparency.push("Required hours match");
    transparency.push(`${formatDaysSummary(caseItem.requiredDays)} available`);
    transparency.push("No schedule conflicts");
  }
  transparency.push(...reasons.map((reason) => reason.message));

  return {
    technician,
    caseItem,
    driveTimeMinutes: routeInfo.driveTimeMinutes,
    driveDistanceMiles: routeInfo.driveDistanceMiles,
    scheduleCompatibility,
    travelCompatibility,
    availabilityStatus,
    currentClientCount: getTechnicianClientCount(technician),
    conflictReasons: reasons,
    readinessStatus,
    transparency,
  };
}

export function rankTechnicianMatches(a: SharedMatchResult, b: SharedMatchResult) {
  const aReady = a.readinessStatus === "Ready to Assign" ? 0 : 1;
  const bReady = b.readinessStatus === "Ready to Assign" ? 0 : 1;
  if (aReady !== bReady) return aReady - bReady;

  const timeDelta = (a.driveTimeMinutes ?? Number.POSITIVE_INFINITY) - (b.driveTimeMinutes ?? Number.POSITIVE_INFINITY);
  if (timeDelta !== 0) return timeDelta;

  const distanceDelta = (a.driveDistanceMiles ?? Number.POSITIVE_INFINITY) - (b.driveDistanceMiles ?? Number.POSITIVE_INFINITY);
  if (distanceDelta !== 0) return distanceDelta;

  const clientDelta = a.currentClientCount - b.currentClientCount;
  if (clientDelta !== 0) return clientDelta;

  return a.technician.name.localeCompare(b.technician.name);
}

export function rankCaseMatchesForTechnician(a: SharedMatchResult, b: SharedMatchResult) {
  const timeDelta = (a.driveTimeMinutes ?? Number.POSITIVE_INFINITY) - (b.driveTimeMinutes ?? Number.POSITIVE_INFINITY);
  if (timeDelta !== 0) return timeDelta;

  const aSchedule = a.scheduleCompatibility === "Full" ? 0 : a.scheduleCompatibility === "Unknown" ? 1 : 2;
  const bSchedule = b.scheduleCompatibility === "Full" ? 0 : b.scheduleCompatibility === "Unknown" ? 1 : 2;
  if (aSchedule !== bSchedule) return aSchedule - bSchedule;

  const urgencyDelta = urgencyWeight(a.caseItem.urgency) - urgencyWeight(b.caseItem.urgency);
  if (urgencyDelta !== 0) return urgencyDelta;

  return a.caseItem.name.localeCompare(b.caseItem.name);
}

export function validateAssignment(match: SharedMatchResult): AssignmentValidationResult {
  return {
    ok: match.readinessStatus === "Ready to Assign",
    readinessStatus: match.readinessStatus,
    reasons: match.conflictReasons,
    transparency: match.transparency,
  };
}

export function buildMatchesForCase(input: {
  caseItem: CaseProfile;
  technicians: TechnicianProfile[];
  assignments: AssignmentRecord[];
  cases: CaseProfile[];
  getRouteInfo: (technician: TechnicianProfile, caseItem: CaseProfile) => RouteInfo;
  sameStateOnly?: boolean;
}) {
  const casesById = new Map(input.cases.map((caseItem) => [caseItem.id, caseItem]));

  return input.technicians
    .filter(
      (technician) =>
        !input.sameStateOnly || normalizeState(technician.state) === normalizeState(input.caseItem.state)
    )
    .map((technician) =>
      evaluateSingleMatch({
        technician,
        caseItem: input.caseItem,
        routeInfo: input.getRouteInfo(technician, input.caseItem),
        assignments: input.assignments,
        existingCases: toExistingCaseSchedules(technician, input.assignments, casesById),
      })
    )
    .sort(rankTechnicianMatches);
}

export function buildMatchesForTechnician(input: {
  technician: TechnicianProfile;
  cases: CaseProfile[];
  technicians: TechnicianProfile[];
  assignments: AssignmentRecord[];
  getRouteInfo: (technician: TechnicianProfile, caseItem: CaseProfile) => RouteInfo;
}) {
  const casesById = new Map(input.cases.map((caseItem) => [caseItem.id, caseItem]));
  const existingCases = toExistingCaseSchedules(input.technician, input.assignments, casesById);

  return input.cases
    .filter(
      (caseItem) =>
        caseItem.status === "Open" ||
        caseItem.status === "Assigned" ||
        caseItem.status === "Open Client" ||
        caseItem.status === "Assigned Client"
    )
    .map((caseItem) =>
      evaluateSingleMatch({
        technician: input.technician,
        caseItem,
        routeInfo: input.getRouteInfo(input.technician, caseItem),
        assignments: input.assignments,
        existingCases,
      })
    )
    .sort(rankCaseMatchesForTechnician);
}
