import { describe, expect, it } from "vitest";

import {
  assignCaseInDatabase,
  nextTechnicianStatus,
  recomputeDerivedData,
  unassignCaseInDatabase,
} from "../data/assignment-workflow";
import {
  buildMatchesForCase,
  buildMatchesForTechnician,
  formatRequiredScheduleSummary,
  normalizeRequiredCaseWindow,
  parseDaysFromText,
  parseTimeRangeToMinutes,
} from "../data/smart-match-engine";
import { type CaseProfile, type RouteInfo, type StaffingDatabase } from "../data/staffing-types";
import { type TechnicianProfile } from "../data/technicians";

function tech(overrides: Partial<TechnicianProfile> = {}): TechnicianProfile {
  return {
    id: "tech-1",
    name: "Alex Tech",
    city: "Albuquerque",
    state: "NM",
    zip: "87101",
    status: "Available",
    phone: "000",
    email: "alex@example.com",
    preferredContactMethod: "Email",
    employmentType: "Full-time",
    travelRadius: "45",
    travelMinutes: 45,
    desiredPay: "",
    hours: "Mon-Fri 8:00 AM-5:00 PM",
    preferredStartTime: "8:00 AM",
    preferredEndTime: "5:00 PM",
    availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    availableStartDate: "",
    centralReachExperience: "",
    rating: "",
    notes: "",
    certifications: [],
    availability: "Open",
    clients: [],
    recruiterNotes: "",
    documents: [],
    latitude: 35.1,
    longitude: -106.6,
    ...overrides,
  };
}

function caseItem(overrides: Partial<CaseProfile> = {}): CaseProfile {
  return {
    id: "case-1",
    name: "Client One",
    city: "Albuquerque",
    state: "NM",
    address: "Albuquerque, NM",
    requiredDays: ["Monday"],
    requiredStartTime: "09:00",
    requiredEndTime: "12:00",
    requiredScheduleText: "Monday-Tuesday, 9:00 AM-12:00 PM",
    urgency: "Medium",
    status: "Open Client",
    ...overrides,
  };
}

function route(minutes: number, miles = 10): RouteInfo {
  return {
    driveTimeMinutes: minutes,
    driveDistanceMiles: miles,
    routeStatus: "ok",
  };
}

function db(overrides: Partial<StaffingDatabase> = {}): StaffingDatabase {
  return {
    technicians: [tech()],
    cases: [caseItem()],
    assignments: [],
    assignmentHistory: [],
    ...overrides,
  };
}

describe("schedule parsing", () => {
  it("parses M-F day ranges", () => {
    expect(parseDaysFromText("M-F")).toEqual(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  });

  it("parses 9 AM-2 PM", () => {
    expect(parseTimeRangeToMinutes("9 AM-2 PM")).toEqual({ startMinutes: 540, endMinutes: 840 });
  });

  it("normalizes case windows and formats schedule summary", () => {
    const normalized = normalizeRequiredCaseWindow("9:00", "05:00");
    expect(normalized?.isAmbiguous).toBe(false);

    expect(
      formatRequiredScheduleSummary({
        days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        startMinutes: 540,
        endMinutes: 1020,
      })
    ).toBe("Monday-Friday, 9:00 AM-5:00 PM");
  });
});

describe("shared matching engine", () => {
  it("valid assignment is Ready to Assign", () => {
    const matches = buildMatchesForCase({
      caseItem: caseItem(),
      technicians: [tech()],
      assignments: [],
      cases: [caseItem()],
      getRouteInfo: () => route(18, 8),
    });

    expect(matches[0]?.readinessStatus).toBe("Ready to Assign");
  });

  it("state mismatch returns Different State", () => {
    const matches = buildMatchesForCase({
      caseItem: caseItem({ state: "IA" }),
      technicians: [tech({ state: "NM" })],
      assignments: [],
      cases: [caseItem({ state: "IA" })],
      getRouteInfo: () => route(15),
    });

    expect(matches[0]?.readinessStatus).toBe("Different State");
  });

  it("outside travel radius returns Outside Travel Radius", () => {
    const matches = buildMatchesForCase({
      caseItem: caseItem(),
      technicians: [tech({ travelMinutes: 30, travelRadius: "30" })],
      assignments: [],
      cases: [caseItem()],
      getRouteInfo: () => route(57, 25),
    });

    expect(matches[0]?.readinessStatus).toBe("Outside Travel Radius");
  });

  it("exact schedule match remains Ready to Assign", () => {
    const matches = buildMatchesForCase({
      caseItem: caseItem({ requiredDays: ["Monday"], requiredStartTime: "10:00", requiredEndTime: "12:00" }),
      technicians: [tech({ hours: "Monday 8:00 AM-5:00 PM" })],
      assignments: [],
      cases: [caseItem()],
      getRouteInfo: () => route(20),
    });

    expect(matches[0]?.scheduleCompatibility).toBe("Full");
    expect(matches[0]?.readinessStatus).toBe("Ready to Assign");
  });

  it("missing service coordinates do not block assignment", () => {
    const matches = buildMatchesForCase({
      caseItem: caseItem({ requiredDays: ["Monday"], requiredStartTime: "10:00", requiredEndTime: "12:00" }),
      technicians: [tech({ hours: "Monday 8:00 AM-5:00 PM" })],
      assignments: [],
      cases: [caseItem()],
      getRouteInfo: () => ({ driveTimeMinutes: null, driveDistanceMiles: null, routeStatus: "missing-coordinates" }),
    });

    expect(matches[0]?.readinessStatus).toBe("Ready to Assign");
  });

  it("partial schedule mismatch becomes Schedule Conflict", () => {
    const matches = buildMatchesForCase({
      caseItem: caseItem({ requiredDays: ["Monday"], requiredStartTime: "10:00", requiredEndTime: "15:00" }),
      technicians: [tech({ hours: "Monday 10:00 AM-12:00 PM" })],
      assignments: [],
      cases: [caseItem()],
      getRouteInfo: () => route(20),
    });

    expect(matches[0]?.readinessStatus).toBe("Schedule Conflict");
  });

  it("existing overlapping case becomes Schedule Conflict", () => {
    const overlapCase = caseItem({ id: "case-existing", name: "Existing", requiredDays: ["Monday"], requiredStartTime: "10:00", requiredEndTime: "12:00", requiredScheduleText: "Monday 10:00 AM-12:00 PM" });
    const incomingCase = caseItem({ id: "case-new", name: "Incoming", requiredDays: ["Monday"], requiredStartTime: "11:00", requiredEndTime: "13:00", requiredScheduleText: "Monday 11:00 AM-1:00 PM" });

    const matches = buildMatchesForCase({
      caseItem: incomingCase,
      technicians: [tech()],
      assignments: [
        {
          id: "a1",
          technicianId: "tech-1",
          caseId: "case-existing",
          status: "Assigned",
          assignedAt: new Date().toISOString(),
          assignedBy: "test",
          driveTimeMinutesAtAssignment: 10,
          driveDistanceMilesAtAssignment: 5,
          requiredScheduleAtAssignment: "",
          previousTechnicianStatus: "Available",
          newTechnicianStatus: "Assigned",
        },
      ],
      cases: [overlapCase, incomingCase],
      getRouteInfo: () => route(10),
    });

    expect(matches[0]?.readinessStatus).toBe("Schedule Conflict");
    expect(matches[0]?.conflictReasons.some((reason) => reason.code === "existing_case_overlap")).toBe(true);
  });

  it("multiple non-overlapping clients remain assignable", () => {
    const existingA = caseItem({ id: "case-a", name: "A", requiredDays: ["Monday"], requiredStartTime: "08:00", requiredEndTime: "09:00", requiredScheduleText: "Monday 8:00 AM-9:00 AM" });
    const existingB = caseItem({ id: "case-b", name: "B", requiredDays: ["Monday"], requiredStartTime: "13:00", requiredEndTime: "14:00", requiredScheduleText: "Monday 1:00 PM-2:00 PM" });
    const incoming = caseItem({ id: "case-c", name: "C", requiredDays: ["Monday"], requiredStartTime: "10:00", requiredEndTime: "12:00", requiredScheduleText: "Monday 10:00 AM-12:00 PM" });

    const matches = buildMatchesForCase({
      caseItem: incoming,
      technicians: [tech()],
      assignments: [
        {
          id: "a1",
          technicianId: "tech-1",
          caseId: "case-a",
          status: "Assigned",
          assignedAt: new Date().toISOString(),
          assignedBy: "test",
          driveTimeMinutesAtAssignment: 10,
          driveDistanceMilesAtAssignment: 5,
          requiredScheduleAtAssignment: "",
          previousTechnicianStatus: "Available",
          newTechnicianStatus: "Assigned",
        },
        {
          id: "a2",
          technicianId: "tech-1",
          caseId: "case-b",
          status: "Assigned",
          assignedAt: new Date().toISOString(),
          assignedBy: "test",
          driveTimeMinutesAtAssignment: 10,
          driveDistanceMilesAtAssignment: 5,
          requiredScheduleAtAssignment: "",
          previousTechnicianStatus: "Assigned",
          newTechnicianStatus: "Assigned",
        },
      ],
      cases: [existingA, existingB, incoming],
      getRouteInfo: () => route(12),
    });

    expect(matches[0]?.readinessStatus).toBe("Ready to Assign");
  });

  it("technician-to-cases uses reverse ranking by drive then schedule", () => {
    const results = buildMatchesForTechnician({
      technician: tech({ id: "tech-1" }),
      technicians: [tech({ id: "tech-1" })],
      cases: [
        caseItem({ id: "c1", name: "Beta", urgency: "High", requiredDays: ["Monday"], requiredStartTime: "09:00", requiredEndTime: "12:00" }),
        caseItem({ id: "c2", name: "Alpha", urgency: "Low", requiredDays: ["Monday"], requiredStartTime: "09:00", requiredEndTime: "12:00" }),
      ],
      assignments: [],
      getRouteInfo: (_tech, item) => (item.id === "c1" ? route(12) : route(18)),
    });

    expect(results[0]?.caseItem.id).toBe("c1");
  });
});

describe("assignment workflow", () => {
  it("creates a valid assignment", () => {
    const result = assignCaseInDatabase({
      database: db(),
      technicianId: "tech-1",
      caseId: "case-1",
      getRouteInfo: () => route(20),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.database.assignments).toHaveLength(1);
      expect(result.database.assignmentHistory).toHaveLength(1);
    }
  });

  it("blocks duplicate assignment", () => {
    const existingDb = db({
      assignments: [
        {
          id: "a-existing",
          technicianId: "tech-1",
          caseId: "case-1",
          status: "Assigned",
          assignedAt: new Date().toISOString(),
          assignedBy: "test",
          driveTimeMinutesAtAssignment: 10,
          driveDistanceMilesAtAssignment: 5,
          requiredScheduleAtAssignment: "",
          previousTechnicianStatus: "Available",
          newTechnicianStatus: "Assigned",
        },
      ],
    });

    const result = assignCaseInDatabase({
      database: existingDb,
      technicianId: "tech-1",
      caseId: "case-1",
      getRouteInfo: () => route(10),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("already assigned");
    }
  });

  it("unassigns a relationship and keeps technician/client records intact", () => {
    const assigned = assignCaseInDatabase({
      database: db(),
      technicianId: "tech-1",
      caseId: "case-1",
      getRouteInfo: () => route(10),
    });

    expect(assigned.ok).toBe(true);
    if (!assigned.ok) return;

    const unassigned = unassignCaseInDatabase({
      database: assigned.database,
      assignmentId: assigned.assignment.id,
    });

    expect(unassigned.ok).toBe(true);
    if (unassigned.ok) {
      expect(unassigned.database.assignments[0]?.status).toBe("Unassigned");
      expect(unassigned.database.technicians[0]?.id).toBe("tech-1");
      expect(unassigned.database.cases[0]?.id).toBe("case-1");
    }
  });

  it("recalculates technician status", () => {
    const technician = tech({ status: "Available" });

    const statusAssigned = nextTechnicianStatus(technician, [
      {
        id: "a1",
        technicianId: "tech-1",
        caseId: "case-1",
        status: "Assigned",
        assignedAt: new Date().toISOString(),
        assignedBy: "test",
        driveTimeMinutesAtAssignment: 1,
        driveDistanceMilesAtAssignment: 1,
        requiredScheduleAtAssignment: "",
        previousTechnicianStatus: "Available",
        newTechnicianStatus: "Assigned",
      },
    ]);

    expect(statusAssigned).toBe("Assigned");

    const statusAvailable = nextTechnicianStatus(technician, []);
    expect(statusAvailable).toBe("Available");
  });

  it("revalidates and rejects if schedule changes before confirmation", () => {
    const initialDb = db();
    const readyMatch = buildMatchesForCase({
      caseItem: initialDb.cases[0],
      technicians: initialDb.technicians,
      assignments: initialDb.assignments,
      cases: initialDb.cases,
      getRouteInfo: () => route(12),
    })[0];

    expect(readyMatch?.readinessStatus).toBe("Ready to Assign");

    const updatedDb: StaffingDatabase = {
      ...initialDb,
      technicians: [
        {
          ...initialDb.technicians[0],
          hours: "Monday 1:00 PM-2:00 PM",
        },
      ],
    };

    const result = assignCaseInDatabase({
      database: recomputeDerivedData(updatedDb),
      technicianId: "tech-1",
      caseId: "case-1",
      getRouteInfo: () => route(12),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("cannot be completed");
    }
  });
});
