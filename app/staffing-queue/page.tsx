"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DatabaseState } from "@/app/components/database-state";
import { PairingConfirmation } from "@/app/components/pairing-confirmation";
import { formatDaysSummary, formatRequiredScheduleSummary, normalizeRequiredCaseWindow } from "@/app/data/smart-match-engine";
import { useTechnicianDatabase } from "@/app/data/technicians-store";
import { createTechnicianSlug, normalizeState } from "@/app/data/technicians-utils";
import { type AssignmentRecord, type CaseProfile, type SharedMatchResult } from "@/app/data/staffing-types";

const navItems = [
  { label: "Dashboard", icon: "▣", href: "/" },
  { label: "Staffing Queue", icon: "✓", href: "/staffing-queue", active: true },
  { label: "Technicians", icon: "👥", href: "/technicians" },
  { label: "Cases", icon: "📋", href: "/cases" },
  { label: "Interviews", icon: "🗓️", href: "/interviews" },
  { label: "Map", icon: "🗺️", href: "/map" },
  { label: "Reports", icon: "📈", href: "#" },
  { label: "Settings", icon: "⚙️", href: "#" },
];

const filterOptions = ["Open + Assigned", "All", "Iowa", "New Mexico", "Open", "Assigned", "Active", "Pending", "On Hold"] as const;
const sortOptions = ["Client Name", "State", "Status", "Most Matches", "Fewest Matches", "Shortest Drive", "Start Readiness"] as const;

type StartReadiness = "READY TO START" | "ALMOST READY" | "BLOCKED";
type QueueRow = {
  caseItem: CaseProfile;
  matches: SharedMatchResult[];
  bestMatch: SharedMatchResult | null;
  assignment: AssignmentRecord | null;
  assignedTechnicianName: string | null;
  startReadiness: StartReadiness;
  missingItems: string[];
};

function isIncludedCaseStatus(status: string) {
  return ["Open", "Assigned", "Active", "Pending", "On Hold"].includes(status);
}

function formatState(state: string) {
  const normalized = normalizeState(state);
  if (normalized === "IA") return "Iowa";
  if (normalized === "NM") return "New Mexico";
  return state;
}

function formatSchedule(caseItem: CaseProfile) {
  const window = normalizeRequiredCaseWindow(caseItem.requiredStartTime, caseItem.requiredEndTime);
  if (window && !window.isAmbiguous && caseItem.requiredDays.length > 0) {
    return formatRequiredScheduleSummary({
      days: caseItem.requiredDays,
      startMinutes: window.startMinutes,
      endMinutes: window.endMinutes,
    });
  }
  return caseItem.requiredScheduleText || "Schedule pending";
}

function getStartReadiness(caseItem: CaseProfile, assignment: AssignmentRecord | null, match: SharedMatchResult | null) {
  const missingItems: string[] = [];
  const hasSchedule = Boolean(normalizeRequiredCaseWindow(caseItem.requiredStartTime, caseItem.requiredEndTime)) && caseItem.requiredDays.length > 0;
  const hasLocation = Boolean(caseItem.address || (caseItem.latitude !== undefined && caseItem.longitude !== undefined));

  if (!assignment) missingItems.push("Technician");
  if (assignment && match?.availabilityStatus !== "Available") missingItems.push("Technician availability confirmation");
  if (!caseItem.bcba?.trim()) missingItems.push("BCBA");
  if (!hasLocation) missingItems.push("Case location confirmation");
  if (!hasSchedule) missingItems.push("Schedule confirmation");
  if (!caseItem.startDate) missingItems.push("Start date");

  if (!assignment || !hasLocation || !hasSchedule || match?.scheduleCompatibility === "Conflict") {
    return { startReadiness: "BLOCKED" as const, missingItems };
  }
  if (missingItems.length <= 2) return { startReadiness: "ALMOST READY" as const, missingItems };
  return { startReadiness: "BLOCKED" as const, missingItems };
}

function readinessTone(readiness: StartReadiness) {
  if (readiness === "READY TO START") return "bg-emerald-50 text-emerald-700";
  if (readiness === "ALMOST READY") return "bg-amber-50 text-amber-700";
  return "bg-rose-50 text-rose-700";
}

function technicianInitials(name?: string) {
  return name?.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "--";
}

function pendingValue(value?: string | number | null) {
  return value === undefined || value === null || value === "" ? "Pending confirmation" : value;
}

export default function StaffingQueuePage() {
  const { cases, technicians, assignments, findMatchingTechnicians, assignCase, markCaseStarted, loading, errorMessage, refreshDatabase } = useTechnicianDatabase();
  const [filter, setFilter] = useState<(typeof filterOptions)[number]>("Open + Assigned");
  const [sortBy, setSortBy] = useState<(typeof sortOptions)[number]>("Client Name");
  const [search, setSearch] = useState("");
  const [selectedRow, setSelectedRow] = useState<QueueRow | null>(null);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const queueRows = useMemo<QueueRow[]>(() => {
    return cases
      .filter((caseItem) => isIncludedCaseStatus(caseItem.status))
      .map((caseItem) => {
        const matches = findMatchingTechnicians(caseItem.id);
        const assignment = assignments.find((item) => item.caseId === caseItem.id && item.status !== "Unassigned") ?? null;
        const assignedMatch = assignment ? matches.find((item) => item.technician.id === assignment.technicianId) ?? null : null;
        const assignedTechnicianName = assignment
          ? technicians.find((item) => item.id === assignment.technicianId)?.name ?? assignment.technicianId
          : null;
        const readiness = getStartReadiness(caseItem, assignment, assignedMatch);

        return {
          caseItem,
          matches,
          bestMatch: matches[0] ?? null,
          assignment,
          assignedTechnicianName,
          ...readiness,
        };
      });
  }, [assignments, cases, findMatchingTechnicians, technicians]);

  const summary = useMemo(() => ({
    open: queueRows.filter((row) => row.caseItem.status === "Open").length,
    ready: queueRows.filter((row) => row.caseItem.status === "Open" && row.bestMatch?.readinessStatus === "Ready to Assign").length,
    travel: queueRows.filter((row) => row.caseItem.status === "Open" && row.bestMatch?.readinessStatus === "Travel Needs Confirmation").length,
    availability: queueRows.filter((row) => row.caseItem.status === "Open" && row.bestMatch?.readinessStatus === "Needs Availability Confirmation").length,
    assigned: queueRows.filter((row) => row.caseItem.status === "Assigned").length,
    readyToStart: queueRows.filter((row) => row.startReadiness === "READY TO START").length,
    blocked: queueRows.filter((row) => row.startReadiness === "BLOCKED").length,
  }), [queueRows]);

  const visibleRows = useMemo(() => {
    const searched = queueRows.filter((row) => {
      const query = search.trim().toLowerCase();
      if (query && !row.caseItem.name.toLowerCase().includes(query)) return false;
      if (filter === "All") return true;
      if (filter === "Open + Assigned") return row.caseItem.status === "Open" || row.caseItem.status === "Assigned";
      if (filter === "Iowa") return normalizeState(row.caseItem.state) === "IA";
      if (filter === "New Mexico") return normalizeState(row.caseItem.state) === "NM";
      return row.caseItem.status === filter;
    });

    return [...searched].sort((left, right) => {
      if (sortBy === "State") return formatState(left.caseItem.state).localeCompare(formatState(right.caseItem.state));
      if (sortBy === "Status") return left.caseItem.status.localeCompare(right.caseItem.status);
      if (sortBy === "Most Matches") return right.matches.length - left.matches.length;
      if (sortBy === "Fewest Matches") return left.matches.length - right.matches.length;
      if (sortBy === "Shortest Drive") return (left.bestMatch?.driveTimeMinutes ?? Infinity) - (right.bestMatch?.driveTimeMinutes ?? Infinity);
      if (sortBy === "Start Readiness") return left.startReadiness.localeCompare(right.startReadiness);
      return left.caseItem.name.localeCompare(right.caseItem.name);
    });
  }, [filter, queueRows, search, sortBy]);

  const handleStart = async (caseId: string) => {
    setIsSaving(true);
    const result = await markCaseStarted(caseId);
    setMessage(result.ok ? "Case marked as started." : result.message);
    setIsSaving(false);
  };

  if (loading) return <DatabaseState title="Loading staffing queue" message="Fetching live cases, assignments, and technicians from Supabase." />;
  if (errorMessage) return <DatabaseState title="Staffing queue unavailable" message={errorMessage} actionLabel="Retry" onAction={() => void refreshDatabase()} />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto flex max-w-[1800px] flex-col lg:flex-row">
        <aside className="w-full border-b border-slate-200 bg-white/80 p-6 backdrop-blur lg:w-72 lg:border-b-0 lg:border-r">
          <div className="mb-8 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-lg font-semibold text-white shadow-lg shadow-blue-200">AB</div><div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">ABA</p><h2 className="text-lg font-semibold text-slate-900">Staffing Platform</h2></div></div>
          <nav className="space-y-2">{navItems.map((item) => <Link key={item.label} href={item.href} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${item.active ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}><span className="text-base">{item.icon}</span>{item.label}</Link>)}</nav>
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <header className="mb-6 rounded-[28px] border border-slate-200 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 p-6 text-white shadow-xl shadow-blue-100">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-100">Operations</p><h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Staffing Queue</h1><p className="mt-2 text-sm text-blue-50/90">Prioritize live staffing needs and assign from one operational view.</p>
          </header>

          <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
            {[["Open Cases", summary.open], ["Ready to Assign", summary.ready], ["Travel Pending", summary.travel], ["Availability Pending", summary.availability], ["Assigned", summary.assigned], ["Ready to Start", summary.readyToStart], ["Blocked Cases", summary.blocked]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p></div>)}
          </section>

          <section className="mb-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search client or case name" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
            <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{filterOptions.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{sortOptions.map((item) => <option key={item}>{item}</option>)}</select>
          </section>

          {message ? <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</p> : null}
          <section className="space-y-4">
            {visibleRows.map((row) => {
              const isAssigned = row.caseItem.status === "Assigned";
              const isActive = row.caseItem.status === "Active";
              const match = row.bestMatch;
              const technician = match?.technician;
              const readinessItems = [
                { label: "Technician Assigned", status: row.assignment ? "complete" : "missing" },
                { label: "BCBA Assigned", status: row.caseItem.bcba?.trim() ? "complete" : "missing" },
                { label: "Planned Start Date", status: row.caseItem.startDate ? "complete" : "missing" },
                { label: "Travel Confirmed", status: !match || match.travelCompatibility === "Unknown" ? "pending" : match.travelCompatibility === "Within Radius" ? "complete" : "missing" },
                { label: "Availability Confirmed", status: !match || match.availabilityStatus === "Needs Confirmation" ? "pending" : match.availabilityStatus === "Available" ? "complete" : "missing" },
              ] as const;
              const completedReadinessItems = readinessItems.filter((item) => item.status === "complete").length;
              const readinessPercent = Math.round((completedReadinessItems / readinessItems.length) * 100);
              return <article key={row.caseItem.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,390px)]"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold text-slate-900">{row.caseItem.name}</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{row.caseItem.status}</span></div><p className="mt-1 text-sm text-slate-500">{row.caseItem.city}, {formatState(row.caseItem.state)}</p><div className="mt-4 grid gap-x-6 gap-y-2 text-sm text-slate-700 sm:grid-cols-2 xl:grid-cols-3"><p><span className="font-semibold">Required days:</span> {formatDaysSummary(row.caseItem.requiredDays) || "Awaiting confirmation"}</p><p><span className="font-semibold">Required hours:</span> {formatSchedule(row.caseItem)}</p><p><span className="font-semibold">BCBA:</span> {row.caseItem.bcba || "Awaiting confirmation"}</p><p><span className="font-semibold">Assigned technician:</span> {row.assignedTechnicianName || "Awaiting confirmation"}</p><p><span className="font-semibold">Smart Match candidates:</span> {row.matches.length}</p><p><span className="font-semibold">Planned start:</span> {row.caseItem.startDate || "Awaiting confirmation"}</p></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><section className="rounded-lg border border-blue-100 bg-blue-50/50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">Best Match</p><div className="mt-3 flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">{technicianInitials(technician?.name)}</div><div className="min-w-0"><p className="truncate font-semibold text-slate-900">{technician?.name || "Awaiting match"}</p><p className="text-xs text-slate-600">Recruiter Rating: {pendingValue(technician?.rating)}</p></div></div><dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-slate-600"><div><dt>Travel time</dt><dd className="font-semibold text-slate-800">{match?.driveTimeMinutes === null || match?.driveTimeMinutes === undefined ? "Pending confirmation" : `${match.driveTimeMinutes} min`}</dd></div><div><dt>Travel distance</dt><dd className="font-semibold text-slate-800">{match?.driveDistanceMiles === null || match?.driveDistanceMiles === undefined ? "Pending confirmation" : `${match.driveDistanceMiles} mi`}</dd></div><div><dt>Availability</dt><dd className="font-semibold text-slate-800">{match?.availabilityStatus ?? "Awaiting confirmation"}</dd></div><div><dt>Schedule</dt><dd className="font-semibold text-slate-800">{match?.scheduleCompatibility === "Unknown" || !match ? "Awaiting confirmation" : match.scheduleCompatibility}</dd></div></dl><p className="mt-3 text-xs text-slate-600">Travel confirmation: <span className="font-semibold text-slate-800">{match?.travelCompatibility === "Unknown" || !match ? "Awaiting confirmation" : match.travelCompatibility}</span></p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => setSelectedRow(row)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">Assign Technician</button>{technician ? <Link href={`/technicians/${createTechnicianSlug(technician.name)}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">View Profile</Link> : <button type="button" disabled className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-400">View Profile</button>}</div></section><section className="rounded-lg border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">Case Readiness</p><span className={`rounded-full px-2 py-1 text-xs font-semibold ${readinessTone(row.startReadiness)}`}>{readinessPercent}% Ready</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${readinessPercent === 100 ? "bg-emerald-500" : readinessPercent >= 60 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${readinessPercent}%` }} /></div><ul className="mt-4 space-y-2 text-xs text-slate-700">{readinessItems.map((item) => <li key={item.label} className="flex items-center justify-between gap-3"><span>{item.label}</span><span className={item.status === "complete" ? "text-emerald-700" : item.status === "pending" ? "text-amber-700" : "text-rose-700"}>{item.status === "complete" ? "✅ complete" : item.status === "pending" ? "⚠ pending" : "❌ missing"}</span></li>)}</ul></section></div><div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setSelectedRow(row)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">Assign Technician</button><Link href={`/cases/${row.caseItem.id}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-500 hover:bg-blue-50">Open Case</Link><Link href={`/map?focus=${encodeURIComponent(row.caseItem.id)}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-500 hover:bg-blue-50">View Map</Link>{row.caseItem.phone ? <a href={`tel:${row.caseItem.phone}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-500 hover:bg-blue-50">Call Family</a> : <button type="button" disabled className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400">Call Family</button>}{row.caseItem.bcbaEmail ? <a href={`mailto:${row.caseItem.bcbaEmail}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-500 hover:bg-blue-50">Email BCBA</a> : <button type="button" disabled className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400">Email BCBA</button>}{isAssigned ? <button type="button" disabled={isSaving} onClick={() => void handleStart(row.caseItem.id)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">Mark Started</button> : null}{isActive ? <Link href={`/cases/${row.caseItem.id}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-500 hover:bg-blue-50">View Case</Link> : null}</div></div></div></article>;
            })}
            {visibleRows.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No live cases match the selected filters.</div> : null}
          </section>
        </main>
      </div>

      {selectedRow ? (
        <PairingConfirmation
          open={Boolean(selectedRow.bestMatch)}
          technicianName={selectedRow.bestMatch?.technician.name ?? ""}
          caseName={selectedRow.caseItem.name}
          clientSchedule={selectedRow.caseItem.requiredScheduleText || "Schedule pending"}
          technicianAvailability={selectedRow.bestMatch?.technician.hours || selectedRow.bestMatch?.technician.availability || "Availability pending"}
          travelStatus={selectedRow.bestMatch?.readinessStatus === "Travel Needs Confirmation" || selectedRow.bestMatch?.readinessStatus === "Outside Travel Radius" ? "Needs Confirmation" : selectedRow.bestMatch?.travelCompatibility === "Within Radius" ? "Confirmed" : "Needs Confirmation"}
          warningMessage={selectedRow.bestMatch && (selectedRow.bestMatch.readinessStatus === "Travel Needs Confirmation" || selectedRow.bestMatch.readinessStatus === "Needs Availability Confirmation" || selectedRow.bestMatch.readinessStatus === "Outside Travel Radius") ? "Travel has not been confirmed for this technician and client." : undefined}
          confirmLabel={selectedRow.bestMatch && (selectedRow.bestMatch.readinessStatus === "Travel Needs Confirmation" || selectedRow.bestMatch.readinessStatus === "Needs Availability Confirmation" || selectedRow.bestMatch.readinessStatus === "Outside Travel Radius") ? "Pair Anyway" : "Confirm Pairing"}
          onCancel={() => setSelectedRow(null)}
          onConfirm={async () => {
            if (!selectedRow.bestMatch) return;
            setIsSaving(true);
            const result = await assignCase({
              technicianId: selectedRow.bestMatch.technician.id,
              caseId: selectedRow.caseItem.id,
              manualOverride: selectedRow.bestMatch.readinessStatus === "Travel Needs Confirmation" || selectedRow.bestMatch.readinessStatus === "Needs Availability Confirmation" || selectedRow.bestMatch.readinessStatus === "Outside Travel Radius",
            });
            setMessage(result.ok ? `Paired ${selectedRow.bestMatch.technician.name} with ${selectedRow.caseItem.name}.` : result.message);
            setIsSaving(false);
            if (result.ok) setSelectedRow(null);
          }}
          isSaving={isSaving}
        />
      ) : null}
    </div>
  );
}