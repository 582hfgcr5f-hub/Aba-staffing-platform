"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DatabaseState } from "@/app/components/database-state";
import { DetailNavigation } from "@/app/components/detail-navigation";
import { PairingConfirmation } from "@/app/components/pairing-confirmation";
import { formatScheduleText, formatTimeRange, formatUsDate, formatUsDateTime } from "@/app/data/display-formatters";
import { addOperationalNote, deleteOperationalNote, fetchOperationalActivity, fetchOperationalNotes, logOperationalActivity, type OperationalActivity, type OperationalNote } from "@/app/data/operational-adapter";
import { useTechnicianDatabase } from "@/app/data/technicians-store";
import { createTechnicianSlug, normalizeState } from "@/app/data/technicians-utils";
import { type SharedMatchResult } from "@/app/data/staffing-types";
import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";

const navItems = [
  { label: "Dashboard", href: "/" }, { label: "Staffing Queue", href: "/staffing-queue" }, { label: "Technicians", href: "/technicians" },
  { label: "Cases", href: "/cases", active: true }, { label: "Interviews", href: "/interviews" }, { label: "Map", href: "/map" },
];

export default function CaseProfilePage() {
  const params = useParams<{ id: string }>();
  const { cases, technicians, assignments, findMatchingTechnicians, assignCase, unassignCase, markCaseStarted, loading, errorMessage, refreshDatabase } = useTechnicianDatabase();
  const [pairingConfirmation, setPairingConfirmation] = useState<SharedMatchResult | null>(null);
  const [message, setMessage] = useState("");
  const [isPairing, setIsPairing] = useState(false);
  const [successToast, setSuccessToast] = useState("");
  const [manualPickerOpen, setManualPickerOpen] = useState(false);
  const [notes, setNotes] = useState<OperationalNote[]>([]);
  const [activity, setActivity] = useState<OperationalActivity[]>([]);
  const [noteText, setNoteText] = useState("");
  const [operationalError, setOperationalError] = useState("");

  const caseItem = useMemo(() => cases.find((item) => item.id === params.id) ?? null, [cases, params.id]);
  const matches = useMemo(() => (caseItem ? findMatchingTechnicians(caseItem.id) : []), [caseItem, findMatchingTechnicians]);

  const caseAssignments = useMemo(() => {
    if (!caseItem) return [];
    return assignments.filter((assignment) => assignment.caseId === caseItem.id && assignment.status !== "Unassigned");
  }, [assignments, caseItem]);
  const sameStateTechnicians = useMemo(() => {
    if (!caseItem) return [];
    return technicians.filter((technician) => normalizeState(technician.state) === normalizeState(caseItem.state));
  }, [caseItem, technicians]);
  const assignmentHistory = useMemo(() => caseItem ? assignments.filter((assignment) => assignment.caseId === caseItem.id) : [], [assignments, caseItem]);
  const readiness = useMemo(() => {
    if (!caseItem) return [];
    return [
      { label: "Technician assigned", done: caseAssignments.length > 0 },
      { label: "BCBA recorded", done: Boolean(caseItem.bcba) },
      { label: "Family contact recorded", done: Boolean(caseItem.contactName && (caseItem.phone || caseItem.email)) },
      { label: "Service location saved", done: caseItem.latitude !== undefined && caseItem.longitude !== undefined },
      { label: "Schedule complete", done: caseItem.requiredDays.length > 0 && Boolean(caseItem.requiredStartTime && caseItem.requiredEndTime) },
    ];
  }, [caseAssignments.length, caseItem]);

  useEffect(() => {
    if (!successToast) return;
    const timer = window.setTimeout(() => setSuccessToast(""), 4000);
    return () => window.clearTimeout(timer);
  }, [successToast]);

  useEffect(() => {
    if (!caseItem) return;
    const timer = window.setTimeout(() => {
      const client = getSupabaseBrowserClient();
      if (!client) return;
      void Promise.all([fetchOperationalNotes(client, "case", caseItem.id), fetchOperationalActivity(client, "case", caseItem.id)])
        .then(([nextNotes, nextActivity]) => { setNotes(nextNotes); setActivity(nextActivity); setOperationalError(""); })
        .catch((error: unknown) => setOperationalError(error instanceof Error ? error.message : "Operational history is unavailable."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [caseItem]);

  async function addNote() {
    if (!caseItem || !noteText.trim()) return;
    const client = getSupabaseBrowserClient();
    if (!client) return setOperationalError("Supabase is not configured.");
    try {
      await addOperationalNote(client, "case", caseItem.id, noteText.trim());
      await logOperationalActivity(client, { caseId: caseItem.id, eventType: "Note added", detail: noteText.trim().slice(0, 120) });
      setNotes(await fetchOperationalNotes(client, "case", caseItem.id));
      setActivity(await fetchOperationalActivity(client, "case", caseItem.id));
      setNoteText("");
    } catch (error) { setOperationalError(error instanceof Error ? error.message : "Unable to save note."); }
  }

  if (loading) {
    return <DatabaseState title="Loading case details" message="Fetching the latest case and assignment data from Supabase." />;
  }

  if (errorMessage) {
    return <DatabaseState title="Case details unavailable" message={errorMessage} actionLabel="Retry" onAction={() => void refreshDatabase()} />;
  }

  if (!caseItem) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-slate-700">
        <p>Case not found.</p>
        <Link href="/cases" className="mt-4 inline-flex rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Back to Cases</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        <aside className="w-full border-b border-slate-200 bg-white/80 p-6 backdrop-blur lg:w-64 lg:border-b-0 lg:border-r">
          <div className="mb-8"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">ABA</p><h2 className="text-lg font-semibold text-slate-900">Staffing Platform</h2></div>
          <nav className="space-y-2">{navItems.map((item) => <Link key={item.label} href={item.href} className={`block rounded-2xl px-4 py-3 text-sm font-medium ${item.active ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-600 hover:bg-slate-100"}`}>{item.label}</Link>)}</nav>
        </aside>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <DetailNavigation listHref="/cases" listLabel="Cases" currentLabel={caseItem.name} badge="Case Profile" />

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold text-slate-900">{caseItem.name}</h1>
          <p className="mt-2 text-slate-600">{caseItem.address || `${caseItem.city}, ${caseItem.state}`}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm"><p className="font-semibold text-slate-900">Parent / guardian</p><p className="mt-1 text-slate-600">{caseItem.contactName || "Not recorded"}</p><div className="mt-2 flex gap-2">{caseItem.phone ? <a href={`tel:${caseItem.phone}`} className="font-semibold text-blue-700">Call</a> : null}{caseItem.email ? <a href={`mailto:${caseItem.email}`} className="font-semibold text-blue-700">Email</a> : null}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm"><p className="font-semibold text-slate-900">BCBA</p><p className="mt-1 text-slate-600">{caseItem.bcba || "Not assigned"}</p><div className="mt-2 flex gap-2">{caseItem.bcbaPhone ? <a href={`tel:${caseItem.bcbaPhone}`} className="font-semibold text-blue-700">Call</a> : null}{caseItem.bcbaEmail ? <a href={`mailto:${caseItem.bcbaEmail}`} className="font-semibold text-blue-700">Email</a> : null}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm"><p className="font-semibold text-slate-900">Preferred contact</p><p className="mt-1 text-slate-600">{caseItem.preferredContact || "Not specified"}</p><Link className="mt-2 inline-block font-semibold text-blue-700" href={`/map?focus=${encodeURIComponent(caseItem.id)}`}>Open map</Link></div>
          </div>
          {caseAssignments.length === 0 && caseItem.status !== "Active" && caseItem.status !== "Active Client" ? (
            <button
              type="button"
              onClick={() => {
                const match = matches[0];
                if (match) setPairingConfirmation(match);
              }}
              className="mt-3 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
            >
              Pair Technician
            </button>
          ) : null}
          {caseAssignments.length > 0 && caseItem.status !== "Active" && caseItem.status !== "Active Client" ? (
            <button
              type="button"
              onClick={async () => {
                const result = await markCaseStarted(caseItem.id);
                setMessage(result.ok ? "Case marked as started." : result.message);
              }}
              className="mt-3 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
            >
              Mark Case Started
            </button>
          ) : null}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Status: {caseItem.status}</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Required days: {caseItem.requiredDays.join(", ") || "TBD"}</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Required hours: {formatScheduleText(caseItem.requiredScheduleText, formatTimeRange(caseItem.requiredStartTime, caseItem.requiredEndTime))}</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">BCBA: {caseItem.bcba || "TBD"}</div>
          </div>

          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-lg font-semibold text-slate-900">Current Assignments</h2>
            <div className="mt-3 space-y-2">
              {caseAssignments.length === 0 ? <p className="text-sm text-slate-500">No assigned technicians.</p> : null}
              {caseAssignments.map((assignment) => {
                const technician = technicians.find((item) => item.id === assignment.technicianId);
                const techName = technician?.name ?? assignment.technicianId;
                return (
                  <div key={assignment.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="font-semibold text-slate-800">{techName}</p>
                    <p className="text-sm text-slate-600">Status: {assignment.status}</p>
                    {technician ? <Link href={`/technicians/${createTechnicianSlug(technician.name)}`} className="mt-2 inline-block text-xs font-semibold text-blue-700">Open technician profile</Link> : null}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm("Unpair this technician from the case?")) return;
                        const result = await unassignCase(assignment.id);
                        setMessage(result.ok ? "Assignment removed." : result.message);
                      }}
                      className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                    >
                      Unpair Technician
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-900">Start readiness</h2><span className={`rounded-full px-3 py-1 text-xs font-semibold ${readiness.every((item) => item.done) ? "bg-emerald-100 text-emerald-700" : readiness.filter((item) => item.done).length >= 3 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>{readiness.every((item) => item.done) ? "Ready to Start" : readiness.filter((item) => item.done).length >= 3 ? "Almost Ready" : "Blocked"}</span></div>
              <div className="mt-4 space-y-2">{readiness.map((item) => <div key={item.label} className="flex justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><span>{item.label}</span><strong className={item.done ? "text-emerald-700" : "text-rose-700"}>{item.done ? "Complete" : "Missing"}</strong></div>)}</div>
            </section>
            <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"><h2 className="text-lg font-semibold text-slate-900">Assignment history</h2><div className="mt-4 space-y-3">{assignmentHistory.length ? assignmentHistory.map((assignment) => { const technician = technicians.find((item) => item.id === assignment.technicianId); return <div key={assignment.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><div className="flex justify-between gap-2"><strong>{technician?.name ?? assignment.technicianId}</strong><span className="text-slate-500">{assignment.status}</span></div><p className="mt-1 text-slate-600">Assigned {formatUsDate(assignment.assignedAt)}{assignment.unassignedAt ? ` · Unassigned ${formatUsDate(assignment.unassignedAt)}` : ""}</p></div>; }) : <p className="text-sm text-slate-500">No assignment history yet.</p>}</div></section>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"><h2 className="text-lg font-semibold text-slate-900">Case notes</h2><textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Add a timestamped internal note" className="mt-4 min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none ring-blue-200 focus:ring-2" /><button type="button" onClick={() => void addNote()} className="mt-3 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Add Note</button><div className="mt-4 space-y-3">{notes.map((note) => <div key={note.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><p>{note.note}</p><div className="mt-2 flex justify-between text-xs text-slate-500"><span>{formatUsDateTime(note.createdAt)}</span><button onClick={() => { const client = getSupabaseBrowserClient(); if (client) void deleteOperationalNote(client, "case", note.id).then(() => setNotes((current) => current.filter((item) => item.id !== note.id))).catch((error: unknown) => setOperationalError(error instanceof Error ? error.message : "Unable to delete note.")); }} className="font-semibold text-rose-700">Delete</button></div></div>)}</div></section>
            <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"><h2 className="text-lg font-semibold text-slate-900">Activity history</h2><div className="mt-4 space-y-3">{activity.length ? activity.map((event) => <div key={event.id} className="border-l-2 border-blue-300 pl-3"><p className="text-sm font-semibold text-slate-800">{event.eventType}</p><p className="text-sm text-slate-600">{event.detail}</p><p className="mt-1 text-xs text-slate-500">{formatUsDateTime(event.createdAt)}</p></div>) : <p className="text-sm text-slate-500">No logged activity yet.</p>}</div></section>
          </div>

          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Find Matching Technicians</h2>
              <button type="button" onClick={() => setManualPickerOpen((current) => !current)} className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Choose Technician</button>
            </div>

            {manualPickerOpen ? (
              <div className="mt-4 space-y-3">
                {sameStateTechnicians.map((technician) => {
                  const match = matches.find((item) => item.technician.id === technician.id) ?? null;
                  const isInactive = !["Available", "Assigned", "Active", "Interview"].includes(technician.status);
                  const hasDuplicateAssignment = Boolean(match?.conflictReasons.some((reason) => reason.code === "duplicate_assignment"));
                  const hasActualOverlap = Boolean(match?.conflictReasons.some((reason) => reason.code === "existing_case_overlap"));
                  const blocked = isInactive || hasDuplicateAssignment || hasActualOverlap;
                  const warning = match && (match.readinessStatus === "Travel Needs Confirmation" || match.readinessStatus === "Needs Availability Confirmation" || match.readinessStatus === "Outside Travel Radius") ? "Travel information is informational for manual pairing." : undefined;

                  return (
                    <div key={technician.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{technician.name}</p>
                          <p className="text-sm text-slate-600">{technician.city}, {technician.state}</p>
                          <p className="mt-1 text-sm text-slate-600">Availability: {technician.hours || technician.availability || "Not provided"}</p>
                          <p className="mt-1 text-sm text-slate-600">Travel: {match?.driveTimeMinutes ?? "Unknown"} min • {match?.driveDistanceMiles ?? "Unknown"} mi</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{technician.status}</span>
                      </div>
                      {warning ? <p className="mt-2 text-xs text-amber-700">Warning: {warning}</p> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={blocked}
                          onClick={() => {
                            const selectedMatch = matches.find((item) => item.technician.id === technician.id) ?? ({
                              technician,
                              caseItem,
                              driveTimeMinutes: null,
                              driveDistanceMiles: null,
                              scheduleCompatibility: "Unknown",
                              travelCompatibility: "Unknown",
                              availabilityStatus: "Needs Confirmation",
                              currentClientCount: 0,
                              conflictReasons: [],
                              readinessStatus: "Travel Needs Confirmation",
                              transparency: ["Manual pairing override enabled."],
                            } as SharedMatchResult);
                            setPairingConfirmation(selectedMatch);
                            setManualPickerOpen(false);
                          }}
                          className={`rounded-xl px-3 py-2 text-xs font-semibold ${blocked ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400" : "bg-blue-600 text-white"}`}
                        >
                          {blocked ? "Unavailable" : "Select Technician"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="mt-3 space-y-3">
              {matches.map((match) => {
                const blockedReason = match.conflictReasons[0]?.message ?? (match.readinessStatus === "Ready to Assign" ? "Ready to pair" : "Cannot pair with this client.");
                const isDuplicateAssignment = match.conflictReasons.some((reason) => reason.code === "duplicate_assignment");
                const isInactiveTechnician = !["Available", "Assigned", "Active", "Interview"].includes(match.technician.status);
                const isScheduleConflict = match.readinessStatus === "Schedule Conflict" || match.conflictReasons.some((reason) => ["day_unavailable", "hours_mismatch", "existing_case_overlap"].includes(reason.code));
                const shouldRenderPairButton = !isDuplicateAssignment && !isInactiveTechnician;
                const pairButtonDisabled = isScheduleConflict;
                const pairButtonTitle = pairButtonDisabled ? "Schedule Conflict" : blockedReason;
                return (
                <div key={match.technician.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{match.technician.name}</p>
                      <p className="text-sm text-slate-600">{match.technician.city}, {match.technician.state}</p>
                      <p className="mt-1 text-sm text-slate-600">Status: {match.technician.status}</p>
                      <p className="mt-1 text-sm text-slate-600">Availability: {match.technician.hours || "Not provided"}</p>
                      <p className="mt-1 text-sm text-slate-600">Drive: {match.driveTimeMinutes ?? "Unknown"} min • {match.driveDistanceMiles ?? "Unknown"} mi</p>
                      <p className="mt-1 text-sm text-slate-600">Current Clients: {match.currentClientCount}</p>
                      <p className="mt-1 text-sm text-slate-600">Schedule Compatibility: {match.scheduleCompatibility}</p>
                      <p className="mt-1 text-sm text-slate-600">Readiness: {match.readinessStatus}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{match.readinessStatus}</span>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    {match.transparency.slice(0, 4).map((line) => (
                      <li key={line}>- {line}</li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={`tel:${match.technician.phone}`} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Call</a>
                    <a href={`mailto:${match.technician.email}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Email</a>
                    <Link href={`/map?focus=${encodeURIComponent(createTechnicianSlug(match.technician.name))}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">View Map</Link>
                    {shouldRenderPairButton ? (
                      <button
                        type="button"
                        disabled={pairButtonDisabled}
                        title={pairButtonDisabled ? pairButtonTitle : undefined}
                        onClick={() => setPairingConfirmation(match)}
                        className={`rounded-xl px-3 py-2 text-xs font-semibold ${pairButtonDisabled ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400" : "bg-blue-600 text-white"}`}
                      >
                        {pairButtonDisabled ? "Schedule Conflict" : "Pair Technician"}
                      </button>
                    ) : null}
                  </div>
                  {!shouldRenderPairButton ? <p className="mt-2 text-xs text-rose-700">Blocked: {blockedReason}</p> : null}
                  {pairButtonDisabled ? <p className="mt-2 text-xs text-rose-700">Blocked: {blockedReason}</p> : null}
                </div>
              );})}
            </div>
          </div>

          <PairingConfirmation
            open={Boolean(pairingConfirmation)}
            technicianName={pairingConfirmation?.technician.name ?? ""}
            caseName={caseItem.name}
            clientSchedule={caseItem.requiredScheduleText || "Schedule pending"}
            technicianAvailability={pairingConfirmation?.technician.hours || pairingConfirmation?.technician.availability || "Availability pending"}
            travelStatus={pairingConfirmation?.readinessStatus === "Travel Needs Confirmation" ? "Needs Confirmation" : pairingConfirmation?.travelCompatibility === "Within Radius" ? "Confirmed" : "Needs Confirmation"}
            warningMessage={pairingConfirmation && (pairingConfirmation.readinessStatus === "Travel Needs Confirmation" || pairingConfirmation.readinessStatus === "Needs Availability Confirmation") ? "Travel has not been confirmed for this technician and client." : undefined}
            confirmLabel={pairingConfirmation && (pairingConfirmation.readinessStatus === "Travel Needs Confirmation" || pairingConfirmation.readinessStatus === "Needs Availability Confirmation") ? "Pair Anyway" : "Confirm Pairing"}
            onCancel={() => setPairingConfirmation(null)}
            onConfirm={async () => {
              if (!pairingConfirmation) return;
              setIsPairing(true);
              const result = await assignCase({
                technicianId: pairingConfirmation.technician.id,
                caseId: caseItem.id,
                manualOverride: true,
              });
              setMessage(result.ok ? `Assigned ${pairingConfirmation.technician.name}.` : `Pairing failed: ${result.message}`);
              if (result.ok) {
                setSuccessToast(`Paired ${pairingConfirmation.technician.name} with ${caseItem.name}.`);
              } else {
                console.error("Pairing failed", result);
              }
              setIsPairing(false);
              if (result.ok) {
                setPairingConfirmation(null);
              }
            }}
            isSaving={isPairing}
          />

          {successToast ? <div role="status" className="fixed bottom-6 right-6 z-[60] rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-lg">{successToast}</div> : null}
          {message ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{message}</div> : null}
          {operationalError ? <p className="mt-4 text-sm text-amber-700">{operationalError}</p> : null}
        </section>
        </main>
      </div>
    </div>
  );
}
