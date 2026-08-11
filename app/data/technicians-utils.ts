import { type TechnicianClient, type TechnicianProfile, technicianProfiles as initialTechnicianProfiles } from "./technicians";

export const technicianDatabaseStorageKey = "aba-staffing-platform.technicians.v1";

const csvHeaders = [
  "Name",
  "Phone",
  "Email",
  "City",
  "State",
  "ZIP",
  "Status",
  "Employment Type",
  "Experience",
  "Preferred Start Time",
  "Preferred End Time",
  "Available Days",
  "Travel Radius",
  "Desired Pay",
  "CentralReach Experience",
  "Preferred Contact",
  "Rating",
  "Notes",
  "Current Client(s)",
  "Client Schedule(s)",
];

export type TechnicianCsvRow = Record<(typeof csvHeaders)[number], string>;

export function cloneTechnicianProfiles(profiles: TechnicianProfile[] = initialTechnicianProfiles) {
  return profiles.map((profile) => ({
    ...profile,
    certifications: [...profile.certifications],
    clients: profile.clients.map((client) => ({ ...client })),
    documents: profile.documents.map((document) => ({ ...document })),
    availableDays: profile.availableDays ? [...profile.availableDays] : undefined,
  }));
}

export function createTechnicianSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function normalizeState(value: string) {
  const compact = value.replace(/[^a-z0-9]/gi, "").toLowerCase();

  if (!compact) return "";
  if (compact === "nm" || compact === "newmexico") return "NM";
  if (compact === "ia" || compact === "iowa") return "IA";

  return value.trim().toUpperCase();
}

export function parseTravelMinutes(value?: string | number) {
  if (typeof value === "number") return Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
  if (!value) return null;

  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;

  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
}

export function formatCurrencyPerHour(value?: string) {
  if (!value) return "";
  const cleaned = value.trim().replace(/^\$+\s*/, "").replace(/\s*(?:\/\s*(?:hr|hour)|per\s+hour)\.?\s*$/i, "").trim();
  if (!cleaned) return "";
  return `$${cleaned}/hr`;
}

export function formatTechnicianSearchText(profile: TechnicianProfile) {
  const clientNames = profile.clients.map((client) => client.name).join(" ");
  return [
    profile.name,
    profile.phone,
    profile.email,
    profile.city,
    profile.state,
    profile.zip ?? "",
    clientNames,
  ]
    .join(" ")
    .toLowerCase();
}

function escapeCsvValue(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current);
  return cells;
}

function normalizeCsvValue(value: string) {
  return value.replace(/^\uFEFF/, "").trim();
}

function parseStringList(value: string) {
  return value
    .split(/[;|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function pairClients(names: string, schedules: string): TechnicianClient[] {
  const nameList = parseStringList(names);
  const scheduleList = parseStringList(schedules);
  const clientCount = Math.max(nameList.length, scheduleList.length);

  return Array.from({ length: clientCount }, (_, index) => ({
    name: nameList[index] ?? "",
    city: "",
    schedule: scheduleList[index] ?? "",
    status: "",
  })).filter((client) => client.name || client.schedule);
}

function profileToCsvRow(profile: TechnicianProfile): string[] {
  const currentClients = profile.clients.map((client) => client.name).join("; ");
  const clientSchedules = profile.clients.map((client) => client.schedule).join("; ");

  return [
    profile.name,
    profile.phone,
    profile.email,
    profile.city,
    profile.state,
    profile.zip ?? "",
    profile.status,
    profile.employmentType,
    profile.experience ?? "",
    profile.preferredStartTime ?? "",
    profile.preferredEndTime ?? "",
    profile.availableDays?.join(", ") ?? "",
    profile.travelRadius,
    profile.desiredPay ?? "",
    profile.centralReachExperience,
    profile.preferredContactMethod,
    profile.rating ?? "",
    profile.notes ?? profile.recruiterNotes,
    currentClients,
    clientSchedules,
  ];
}

export function exportTechniciansCsv(profiles: TechnicianProfile[]) {
  const rows = cloneTechnicianProfiles(profiles).map(profileToCsvRow).map((row) => row.map((value) => escapeCsvValue(value)).join(","));

  return `\uFEFF${[csvHeaders.map((value) => escapeCsvValue(value)).join(","), ...rows].join("\r\n")}`;
}

export function downloadTechniciansCsv(profiles: TechnicianProfile[]) {
  if (typeof window === "undefined") return;

  const content = exportTechniciansCsv(profiles);
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = "technicians.csv";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function importTechniciansCsv(csvText: string) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [] as TechnicianProfile[];

  const headers = splitCsvLine(normalizeCsvValue(lines[0] ?? "")).map((header) => header.trim());
  const indexByHeader = new Map(headers.map((header, index) => [header, index]));

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line).map(normalizeCsvValue);
    const value = (header: keyof TechnicianCsvRow) => cells[indexByHeader.get(header) ?? -1] ?? "";
    const name = value("Name");

    return {
      id: createTechnicianSlug(name || value("Email") || crypto.randomUUID()),
      name,
      city: value("City"),
      state: value("State"),
      zip: value("ZIP"),
      status: value("Status"),
      phone: value("Phone"),
      email: value("Email"),
      preferredContactMethod: value("Preferred Contact"),
      employmentType: value("Employment Type"),
      experience: value("Experience"),
      travelRadius: value("Travel Radius"),
      travelMinutes: parseTravelMinutes(value("Travel Radius")) ?? undefined,
      desiredPay: value("Desired Pay"),
      hours: value("Preferred Start Time") || value("Preferred End Time") || "",
      preferredStartTime: value("Preferred Start Time"),
      preferredEndTime: value("Preferred End Time"),
      availableDays: parseStringList(value("Available Days")),
      availableStartDate: "",
      centralReachExperience: value("CentralReach Experience"),
      certifications: [],
      availability: "",
      rating: value("Rating"),
      notes: value("Notes"),
      recruiterNotes: value("Notes"),
      clients: pairClients(value("Current Client(s)"), value("Client Schedule(s)")),
      documents: [],
      latitude: undefined,
      longitude: undefined,
    } satisfies TechnicianProfile;
  });
}

export function dedupeTechnicians(profiles: TechnicianProfile[]) {
  const map = new Map<string, TechnicianProfile>();

  for (const profile of profiles) {
    const key = profile.id || createTechnicianSlug(profile.name);
    map.set(key, { ...profile, id: key });
  }

  return Array.from(map.values());
}

export function buildTechnicianLocation(profile: TechnicianProfile) {
  if (typeof profile.latitude !== "number" || typeof profile.longitude !== "number") return null;

  return {
    name: profile.name,
    city: profile.city,
    state: profile.state,
    kind: "Technician" as const,
    status: profile.status,
    statusTone:
      profile.status === "Active"
        ? "bg-emerald-50 text-emerald-700"
        : profile.status === "Assigned"
          ? "bg-amber-50 text-amber-700"
          : profile.status === "Interview"
            ? "bg-sky-50 text-sky-700"
            : "bg-blue-50 text-blue-700",
    lat: profile.latitude,
    lng: profile.longitude,
    markerColor:
      profile.status === "Active"
        ? "#10b981"
        : profile.status === "Assigned"
          ? "#f59e0b"
          : profile.status === "Interview"
            ? "#2563eb"
            : "#3b82f6",
  };
}

export function getTechnicianClientCount(profile: TechnicianProfile) {
  return profile.clients.length;
}

export function getAverageTravelRadiusMinutes(profiles: TechnicianProfile[]) {
  const values = profiles.map((profile) => parseTravelMinutes(profile.travelMinutes ?? profile.travelRadius)).filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function loadTechnicianProfilesFromStorage() {
  if (typeof window === "undefined") return cloneTechnicianProfiles();

  const raw = window.localStorage.getItem(technicianDatabaseStorageKey);
  if (!raw) return cloneTechnicianProfiles();

  try {
    const parsed = JSON.parse(raw) as TechnicianProfile[];
    if (!Array.isArray(parsed)) return cloneTechnicianProfiles();
    return dedupeTechnicians(parsed);
  } catch {
    return cloneTechnicianProfiles();
  }
}

export function saveTechnicianProfilesToStorage(profiles: TechnicianProfile[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(technicianDatabaseStorageKey, JSON.stringify(dedupeTechnicians(profiles)));
}

export function reconcileImportedTechnicians(existing: TechnicianProfile[], imported: TechnicianProfile[]) {
  if (imported.length === 0) return existing;
  return dedupeTechnicians(imported);
}

export function createTechnicianMetrics(profiles: TechnicianProfile[]) {
  const total = profiles.length;
  const available = profiles.filter((profile) => profile.status === "Available").length;
  const assigned = profiles.filter((profile) => profile.status === "Assigned").length;
  const interview = profiles.filter((profile) => profile.status === "Interview").length;
  const active = profiles.filter((profile) => profile.status === "Active").length;
  const averageTravelRadius = getAverageTravelRadiusMinutes(profiles);

  return { total, available, assigned, interview, active, averageTravelRadius };
}

export function sortTechnicians(profiles: TechnicianProfile[], sortOption: string) {
  const sorted = [...profiles];

  switch (sortOption) {
    case "name-desc":
      sorted.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case "city":
      sorted.sort((a, b) => a.city.localeCompare(b.city));
      break;
    case "travel-radius":
      sorted.sort((a, b) => (parseTravelMinutes(a.travelMinutes ?? a.travelRadius) ?? Number.POSITIVE_INFINITY) - (parseTravelMinutes(b.travelMinutes ?? b.travelRadius) ?? Number.POSITIVE_INFINITY));
      break;
    case "pay":
      sorted.sort((a, b) => (Number.parseFloat((b.desiredPay ?? "").replace(/[^0-9.]/g, "")) || 0) - (Number.parseFloat((a.desiredPay ?? "").replace(/[^0-9.]/g, "")) || 0));
      break;
    case "most-clients":
      sorted.sort((a, b) => b.clients.length - a.clients.length);
      break;
    case "fewest-clients":
      sorted.sort((a, b) => a.clients.length - b.clients.length);
      break;
    case "recently-added":
      sorted.sort((a, b) => (b.availableStartDate || "").localeCompare(a.availableStartDate || ""));
      break;
    case "name-asc":
    default:
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }

  return sorted;
}

export function createTechnicianSearchPredicate(search: string) {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return () => true;

  return (profile: TechnicianProfile) => formatTechnicianSearchText(profile).includes(normalized);
}

export function getClientStatusTone(status: string) {
  if (status === "Active") return "bg-emerald-50 text-emerald-700";
  if (status === "Pending") return "bg-amber-50 text-amber-700";
  if (status === "Assigned") return "bg-sky-50 text-sky-700";
  if (status === "On Hold") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

export function getTechnicianStatusTone(status: string) {
  if (status === "Active") return "bg-emerald-50 text-emerald-700";
  if (status === "Assigned") return "bg-amber-50 text-amber-700";
  if (status === "Interview") return "bg-sky-50 text-sky-700";
  return "bg-blue-50 text-blue-700";
}

export function getTechnicianSummary(profile: TechnicianProfile) {
  const travel = parseTravelMinutes(profile.travelMinutes ?? profile.travelRadius);

  return {
    clients: profile.clients.length,
    status: profile.status,
    travel,
  };
}

export function buildOpenCasesFromProfiles(profiles: TechnicianProfile[]) {
  return profiles.flatMap((profile) =>
    profile.clients.map((client) => ({
      client: client.name,
      clientLocation: client.city ? `${client.city}, ${profile.state}` : `${profile.city}, ${profile.state}`,
      suggestedTechnician: profile.name,
      technicianLocation: `${profile.city}, ${profile.state}`,
      travelTime: profile.travelMinutes ? `${profile.travelMinutes} min` : "",
      state: profile.state,
    }))
  );
}
