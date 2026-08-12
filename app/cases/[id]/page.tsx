"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DatabaseState } from "@/app/components/database-state";
import { DetailNavigation } from "@/app/components/detail-navigation";
import { formatScheduleText, formatTimeRange, formatUsDate, formatUsDateTime } from "@/app/data/display-formatters";
import { addOperationalNote, deleteOperationalNote, fetchOperationalActivity, fetchOperationalNotes, logOperationalActivity, type OperationalActivity, type OperationalNote } from "@/app/data/operational-adapter";
import { useTechnicianDatabase } from "@/app/data/technicians-store";
import { createTechnicianSlug, normalizeState } from "@/app/data/technicians-utils";
import { type CaseProfile, type DayName, type SharedMatchResult } from "@/app/data/staffing-types";
import { buildServiceLocationAddress, geocodeServiceLocation } from "@/app/data/geocoding";
import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";

const navItems = [
  { label: "Dashboard", href: "/" }, { label: "Staffing Queue", href: "/staffing-queue" }, { label: "Technicians", href: "/technicians" },
  { label: "Cases", href: "/cases", active: true }, { label: "Interviews", href: "/interviews" }, { label: "Map", href: "/map" },
];

function createAssignmentEmail(match: SharedMatchResult) {
  const subject = `New ABA Case Assignment - ${match.caseItem.name}`;
  const body = [
    `Technician: ${match.technician.name}`,
    `Client: ${match.caseItem.name}`,
    `Location: ${match.caseItem.address || `${match.caseItem.city}, ${match.caseItem.state}`}`,
    `Days: ${match.caseItem.requiredDays.join(", ")}`,
    `Hours: ${formatTimeRange(match.caseItem.requiredStartTime, match.caseItem.requiredEndTime)}`,
    `Start Date: ${formatUsDate(match.caseItem.startDate, "TBD")}`,
    `BCBA: ${match.caseItem.bcba || "TBD"}`,
    `Drive Time: ${match.driveTimeMinutes ?? "Unknown"} minutes`,
    `Notes: ${match.caseItem.notes || ""}`,
  ].join("\n");

  return `mailto:${encodeURIComponent(match.technician.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

type CaseEditFormState = {
  name: string;
  city: string;
  state: string;
  status: CaseProfile["status"];
  address: string;
  zip: string;
  contactName: string;
  phone: string;
  email: string;
  preferredContact: string;
  requiredDays: DayName[];
  requiredStartTime: string;
  requiredEndTime: string;
  startDate: string;
  bcba: string;
  notes: string;
};

function createEditCaseState(caseItem: CaseProfile): CaseEditFormState {
  return {
    name: caseItem.name,
    city: caseItem.city,
    state: caseItem.state,
    status: caseItem.status,
    address: caseItem.address ?? "",
    zip: caseItem.zip ?? "",
    contactName: caseItem.contactName ?? "",
    phone: caseItem.phone ?? "",
    email: caseItem.email ?? "",
    preferredContact: caseItem.preferredContact ?? "",
    requiredDays: caseItem.requiredDays,
    requiredStartTime: caseItem.requiredStartTime,
    requiredEndTime: caseItem.requiredEndTime,
    startDate: caseItem.startDate ?? "",
    bcba: caseItem.bcba ?? "",
    notes: caseItem.notes ?? "",
  };
}

export default function CaseProfilePage() {
  const params = useParams<{ id: string }>();
  const { cases, technicians, assignments, findMatchingTechnicians, assignCase, unassignCase, markCaseStarted, upsertCase, loading, errorMessage, refreshDatabase } = useTechnicianDatabase();
  const [pendingMatch, setPendingMatch] = useState<SharedMatchResult | null>(null);
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState<OperationalNote[]>([]);
  const [activity, setActivity] = useState<OperationalActivity[]>([]);
  const [noteText, setNoteText] = useState("");
  const [operationalError, setOperationalError] = useState("");
  const [isEditingCase, setIsEditingCase] = useState(false);
  const [editCaseState, setEditCaseState] = useState<CaseEditFormState | null>(null);
  const [editCaseError, setEditCaseError] = useState("");

  const caseItem = useMemo(() => cases.find((item) => item.id === params.id) ?? null, [cases, params.id]);
  const matches = useMemo(() => (caseItem ? findMatchingTechnicians(caseItem.id) : []), [caseItem, findMatchingTechnicians]);

  const caseAssignments = useMemo(() => {
    if (!caseItem) return [];
    return assignments.filter((assignment) => assignment.caseId === caseItem.id && assignment.status !== "Unassigned");
  }, [assignments, caseItem]);
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

  async function saveEditedCase() {
    if (!caseItem || !editCaseState) return;

    const result = await upsertCase({
      ...caseItem,
      name: editCaseState.name.trim() || caseItem.name,
      city: editCaseState.city.trim() || caseItem.city,
      state: normalizeState(editCaseState.state || caseItem.state),
      status: editCaseState.status,
      address: editCaseState.address.trim() || undefined,
      zip: editCaseState.zip.trim() || undefined,
      contactName: editCaseState.contactName.trim() || undefined,
      phone: editCaseState.phone.trim() || undefined,
      email: editCaseState.email.trim() || undefined,
      preferredContact: editCaseState.preferredContact.trim() || undefined,
      requiredDays: editCaseState.requiredDays,
      requiredStartTime: editCaseState.requiredStartTime,
      requiredEndTime: editCaseState.requiredEndTime,
      startDate: editCaseState.startDate || undefined,
      bcba: editCaseState.bcba.trim() || undefined,
      notes: editCaseState.notes.trim() || undefined,
    });

    if (!result.ok) {
      setEditCaseError(result.message);
      return;
    }

    setIsEditingCase(false);
    setEditCaseState(null);
    setEditCaseError("");
    setMessage("Case updated.");
  }

  async function confirmServiceLocation() {
    if (!caseItem) return;

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
    const fullAddress = buildServiceLocationAddress({
      address: caseItem.address,
      city: caseItem.city,
      state: caseItem.state,
      zip: caseItem.zip,
    });

    if (!fullAddress || !apiKey) {
      setMessage("Google Maps API key is missing or the case address is incomplete.");
      return;
    }

    try {
      const geocode = await geocodeServiceLocation({
        address: caseItem.address,
        city: caseItem.city,
        state: caseItem.state,
        zip: caseItem.zip,
      }, apiKey);

      const result = await upsertCase({
        ...caseItem,
        address: geocode.formattedAddress || caseItem.address,
        city: geocode.city || caseItem.city,
        state: geocode.state || caseItem.state,
        zip: geocode.zip || caseItem.zip,
        latitude: geocode.lat,
        longitude: geocode.lng,
      });

      if (!result.ok) {
        throw new Error(result.message);
      }

      setMessage("Service location saved.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown geocoding error.";
      setMessage(detail);
    }
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
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{caseItem.name}</h1>
            <button type="button" onClick={() => { setEditCaseState(createEditCaseState(caseItem)); setEditCaseError(""); setIsEditingCase(true); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Edit Case</button>
          </div>
          <p className="mt-2 text-slate-600">{caseItem.address || `${caseItem.city}, ${caseItem.state}`}</p>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-800">Service Location</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${caseItem.latitude !== undefined && caseItem.longitude !== undefined ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {caseItem.latitude !== undefined && caseItem.longitude !== undefined ? "Location Confirmed" : "Needs Confirmation"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => void confirmServiceLocation()} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white">
                {caseItem.latitude !== undefined && caseItem.longitude !== undefined ? "Reconfirm Location" : "Confirm Location"}
              </button>
            </div>
          </div>
          {isEditingCase && editCaseState ? (
            <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">Edit Case</h2>
                <button type="button" onClick={() => { setIsEditingCase(false); setEditCaseError(""); setEditCaseState(null); }} className="text-xs font-semibold text-slate-600">Close</button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm text-slate-600">Client name
                  <input value={editCaseState.name} onChange={(event) => setEditCaseState((current) => current ? { ...current, name: event.target.value } : current)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">Status
                  <select value={editCaseState.status} onChange={(event) => setEditCaseState((current) => current ? { ...current, status: event.target.value as CaseProfile["status"] } : current)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2">
                    {(["Open", "Assigned", "Active", "Pending", "On Hold", "Open Client", "Assigned Client", "Active Client"] as const).map((status) => (<option key={status} value={status}>{status}</option>))}
                  </select>
                </label>
                <label className="text-sm text-slate-600">Address
                  <input value={editCaseState.address} onChange={(event) => setEditCaseState((current) => current ? { ...current, address: event.target.value } : current)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">City
                  <input value={editCaseState.city} onChange={(event) => setEditCaseState((current) => current ? { ...current, city: event.target.value } : current)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">State
                  <input value={editCaseState.state} onChange={(event) => setEditCaseState((current) => current ? { ...current, state: event.target.value } : current)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">ZIP
                  <input value={editCaseState.zip} onChange={(event) => setEditCaseState((current) => current ? { ...current, zip: event.target.value } : current)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">Parent / guardian
                  <input value={editCaseState.contactName} onChange={(event) => setEditCaseState((current) => current ? { ...current, contactName: event.target.value } : current)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">Phone
                  <input value={editCaseState.phone} onChange={(event) => setEditCaseState((current) => current ? { ...current, phone: event.target.value } : current)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">Email
                  <input value={editCaseState.email} onChange={(event) => setEditCaseState((current) => current ? { ...current, email: event.target.value } : current)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">Preferred contact
                  <input value={editCaseState.preferredContact} onChange={(event) => setEditCaseState((current) => current ? { ...current, preferredContact: event.target.value } : current)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">Required start time
                  <input type="time" value={editCaseState.requiredStartTime} onChange={(event) => setEditCaseState((current) => current ? { ...current, requiredStartTime: event.target.value } : current)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">Required end time
                  <input type="time" value={editCaseState.requiredEndTime} onChange={(event) => setEditCaseState((current) => current ? { ...current, requiredEndTime: event.target.value } : current)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">Start date
                  <input type="date" value={editCaseState.startDate} onChange={(event) => setEditCaseState((current) => current ? { ...current, startDate: event.target.value } : current)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">BCBA
                  <input value={editCaseState.bcba} onChange={(event) => setEditCaseState((current) => current ? { ...current, bcba: event.target.value } : current)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2" />
                </label>
                <fieldset className="text-sm text-slate-600 md:col-span-2">
                  <legend className="mb-2">Required days</legend>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const).map((day) => (
                      <label key={day} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-2">
                        <input type="checkbox" checked={editCaseState.requiredDays.includes(day)} onChange={() => setEditCaseState((current) => current ? { ...current, requiredDays: current.requiredDays.includes(day) ? current.requiredDays.filter((item) => item !== day) : [...current.requiredDays, day] } : current)} />
                        <span>{day}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="text-sm text-slate-600 md:col-span-2">Notes
                  <textarea value={editCaseState.notes} onChange={(event) => setEditCaseState((current) => current ? { ...current, notes: event.target.value } : current)} rows={3} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2" />
                </label>
              </div>
              {editCaseError ? <p className="mt-3 text-sm text-rose-600">{editCaseError}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => void saveEditedCase()} className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Save Changes</button>
                <button type="button" onClick={() => { setIsEditingCase(false); setEditCaseState(null); setEditCaseError(""); }} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
              </div>
            </div>
          ) : null}
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm"><p className="font-semibold text-slate-900">Parent / guardian</p><p className="mt-1 text-slate-600">{caseItem.contactName || "Not recorded"}</p><div className="mt-2 flex gap-2">{caseItem.phone ? <a href={`tel:${caseItem.phone}`} className="font-semibold text-blue-700">Call</a> : null}{caseItem.email ? <a href={`mailto:${caseItem.email}`} className="font-semibold text-blue-700">Email</a> : null}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm"><p className="font-semibold text-slate-900">BCBA</p><p className="mt-1 text-slate-600">{caseItem.bcba || "Not assigned"}</p><div className="mt-2 flex gap-2">{caseItem.bcbaPhone ? <a href={`tel:${caseItem.bcbaPhone}`} className="font-semibold text-blue-700">Call</a> : null}{caseItem.bcbaEmail ? <a href={`mailto:${caseItem.bcbaEmail}`} className="font-semibold text-blue-700">Email</a> : null}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm"><p className="font-semibold text-slate-900">Preferred contact</p><p className="mt-1 text-slate-600">{caseItem.preferredContact || "Not specified"}</p><Link className="mt-2 inline-block font-semibold text-blue-700" href={`/map?focus=${encodeURIComponent(caseItem.id)}`}>Open map</Link></div>
          </div>
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
                        if (!confirm("Unassign this technician from the case?")) return;
                        const result = await unassignCase(assignment.id);
                        setMessage(result.ok ? "Assignment removed." : result.message);
                      }}
                      className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                    >
                      Unassign
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
            <h2 className="text-lg font-semibold text-slate-900">Find Matching Technicians</h2>
            <div className="mt-3 space-y-3">
              {matches.map((match) => (
                <div key={match.technician.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{match.technician.name}</p>
                      <p className="text-sm text-slate-600">{match.technician.city}, {match.technician.state}</p>
                      <p className="mt-1 text-sm text-slate-600">Drive: {match.driveTimeMinutes ?? "Unknown"} min • {match.driveDistanceMiles ?? "Unknown"} mi</p>
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
                    {match.readinessStatus === "Ready to Assign" ? (
                      <button type="button" onClick={() => setPendingMatch(match)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Assign Technician</button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {pendingMatch ? (
            <div className="mt-6 rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="text-lg font-semibold text-slate-900">Confirm Assignment</h3>
              <p className="mt-2 text-sm text-slate-700">Revalidation runs again when confirming the assignment.</p>
              <ul className="mt-3 space-y-1 text-sm text-slate-700">
                <li>- State match: {normalizeState(pendingMatch.technician.state) === normalizeState(caseItem.state) ? "Pass" : "Fail"}</li>
                <li>- Drive time within radius: {pendingMatch.travelCompatibility === "Within Radius" ? "Pass" : "Fail"}</li>
                <li>- Days and hours match: {pendingMatch.scheduleCompatibility === "Full" ? "Pass" : "Fail"}</li>
                <li>- No overlap: {pendingMatch.conflictReasons.some((reason) => reason.code === "existing_case_overlap") ? "Fail" : "Pass"}</li>
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const result = await assignCase({ technicianId: pendingMatch.technician.id, caseId: caseItem.id });
                    setMessage(result.ok ? `Assigned ${pendingMatch.technician.name}.` : result.message);
                    if (result.ok) setPendingMatch(null);
                  }}
                  className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Confirm Assignment
                </button>
                <a href={createAssignmentEmail(pendingMatch)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Email Assignment Details</a>
                <button type="button" onClick={() => setPendingMatch(null)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>
              </div>
            </div>
          ) : null}

          {message ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{message}</div> : null}
          {operationalError ? <p className="mt-4 text-sm text-amber-700">{operationalError}</p> : null}
        </section>
        </main>
      </div>
    </div>
  );
}
