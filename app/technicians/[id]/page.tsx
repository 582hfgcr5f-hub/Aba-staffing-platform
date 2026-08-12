"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { DatabaseState } from "@/app/components/database-state";
import { DetailNavigation } from "@/app/components/detail-navigation";
import { PairingConfirmation } from "@/app/components/pairing-confirmation";
import { formatScheduleText, formatTimeRange, formatUsDate, formatUsDateTime, formatWeeklyAvailability } from "@/app/data/display-formatters";
import { getInterviewResumeUrl } from "@/app/data/interviews-adapter";
import { addOperationalNote, deleteOperationalNote, deleteTechnicianFile, fetchOperationalActivity, fetchOperationalNotes, getTechnicianFileUrl, logOperationalActivity, uploadTechnicianFile, type OperationalActivity, type OperationalNote } from "@/app/data/operational-adapter";
import { useTechnicianDatabase } from "@/app/data/technicians-store";
import { type TechnicianProfile } from "@/app/data/technicians";
import { createTechnicianSlug, formatCurrencyPerHour, getClientStatusTone, getTechnicianStatusTone, normalizeState, parseTravelMinutes } from "@/app/data/technicians-utils";
import { type CaseProfile, type SharedMatchResult } from "@/app/data/staffing-types";
import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";

const navItems = [
  { label: "Dashboard", icon: "▣", href: "/" },
  { label: "Staffing Queue", icon: "✓", href: "/staffing-queue" },
  { label: "Technicians", icon: "👥", href: "/technicians", active: true },
  { label: "Cases", icon: "📋", href: "/cases" },
  { label: "Interviews", icon: "🗓️", href: "/interviews" },
  { label: "Map", icon: "🗺️", href: "/map" },
  { label: "Reports", icon: "📈", href: "#" },
  { label: "Settings", icon: "⚙️", href: "#" },
];

const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function createAvatar(name: string) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <rect width="320" height="320" rx="40" fill="#2563eb"/>
      <circle cx="160" cy="120" r="70" fill="#dbeafe"/>
      <path d="M80 280c18-44 58-68 80-68s62 24 80 68" fill="#dbeafe"/>
      <text x="160" y="295" text-anchor="middle" font-size="46" font-family="Arial, sans-serif" fill="white">${initials}</text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default function TechnicianProfilePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { technicians, cases, assignments, unassignCase, findMatchingCases, assignCase, upsertTechnician, loading, errorMessage, refreshDatabase } = useTechnicianDatabase();
  const [assignmentMessage, setAssignmentMessage] = useState("");
  const [notes, setNotes] = useState<OperationalNote[]>([]);
  const [activity, setActivity] = useState<OperationalActivity[]>([]);
  const [noteText, setNoteText] = useState("");
  const [operationalError, setOperationalError] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [showMatches, setShowMatches] = useState(false);
  const [pairingCase, setPairingCase] = useState<SharedMatchResult | null>(null);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [pendingClientAssignment, setPendingClientAssignment] = useState<CaseProfile | null>(null);
  const [clientAssignmentInProgress, setClientAssignmentInProgress] = useState(false);
  const [successToast, setSuccessToast] = useState("");
  const [documentToReplace, setDocumentToReplace] = useState<string | null>(null);
  const [pairingInProgress, setPairingInProgress] = useState(false);
  const [editProfile, setEditProfile] = useState<TechnicianProfile | null>(null);
  const [editError, setEditError] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const profile = useMemo(() => technicians.find((item) => createTechnicianSlug(item.name) === params.id), [params.id, technicians]);

  useEffect(() => {
    if (!profile) return;
    const timer = window.setTimeout(() => {
      const client = getSupabaseBrowserClient();
      if (!client) return;
      void Promise.all([
        fetchOperationalNotes(client, "technician", profile.id),
        fetchOperationalActivity(client, "technician", profile.id),
        profile.profilePhotoPath ? getTechnicianFileUrl(client, profile.profilePhotoPath) : Promise.resolve(""),
      ])
        .then(([nextNotes, nextActivity, nextPhotoUrl]) => {
          setNotes(nextNotes);
          setActivity(nextActivity);
          setPhotoUrl(nextPhotoUrl);
          setOperationalError("");
        })
        .catch((error: unknown) => setOperationalError(error instanceof Error ? error.message : "Operational history is unavailable."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [profile]);

  const travelMinutes = useMemo(() => (profile ? parseTravelMinutes(profile.travelMinutes ?? profile.travelRadius) : null), [profile]);
  const assignmentsForTechnician = useMemo(
    () => (profile ? assignments.filter((assignment) => assignment.technicianId === profile.id && assignment.status !== "Unassigned") : []),
    [assignments, profile]
  );
  const assignedClientCards = useMemo(
    () => assignmentsForTechnician
      .map((assignment) => {
        const caseItem = cases.find((item) => item.id === assignment.caseId);
        if (!caseItem) return null;
        return {
          assignmentId: assignment.id,
          caseId: caseItem.id,
          clientName: caseItem.name,
          city: caseItem.city,
          state: caseItem.state,
          status: assignment.status,
          days: caseItem.requiredDays.join(", ") || "Not provided",
          hours: formatTimeRange(caseItem.requiredStartTime, caseItem.requiredEndTime) || "Not provided",
          bcba: caseItem.bcba || "Not provided",
          startDate: caseItem.startDate ? formatUsDate(caseItem.startDate) : "Not available",
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [assignmentsForTechnician, cases]
  );
  const matchingCases = useMemo(
    () => (profile ? findMatchingCases(profile.id).filter((match) => normalizeState(match.caseItem.state) === normalizeState(profile.state)) : []),
    [findMatchingCases, profile]
  );
  const addClientCandidates = useMemo(
    () => (profile ? cases.filter((caseItem) => {
      const sameState = normalizeState(caseItem.state) === normalizeState(profile.state);
      const isOpenOrAssigned = ["Open", "Assigned", "Active", "Open Client", "Assigned Client", "Active Client"].includes(caseItem.status);
      const isAlreadyAssigned = assignments.some((assignment) => assignment.technicianId === profile.id && assignment.caseId === caseItem.id && assignment.status !== "Unassigned");
      return sameState && isOpenOrAssigned && !isAlreadyAssigned;
    }).sort((left, right) => left.name.localeCompare(right.name)) : []),
    [assignments, cases, profile]
  );

  useEffect(() => {
    if (!successToast) return;
    const timer = window.setTimeout(() => setSuccessToast(""), 4000);
    return () => window.clearTimeout(timer);
  }, [successToast]);

  if (loading) {
    return <DatabaseState title="Loading technician details" message="Fetching the latest technician profile from Supabase." />;
  }

  if (errorMessage) {
    return <DatabaseState title="Technician details unavailable" message={errorMessage} actionLabel="Retry" onAction={() => void refreshDatabase()} />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <div className="mx-auto max-w-3xl p-8">
          <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-900">Technician not found</p>
            <Link href="/technicians" className="mt-4 inline-flex rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">
              Back to Technicians
            </Link>
          </div>
        </div>
      </div>
    );
  }

  async function handlePhotoUpload(file?: File) {
    if (!file) return;
    if (!profile) return;
    const client = getSupabaseBrowserClient();
    if (!client) return setAssignmentMessage("Supabase is not configured.");
    try {
      const uploaded = await uploadTechnicianFile(client, profile.id, file, "profile-photo");
      const result = await upsertTechnician({ ...profile, profilePhotoPath: uploaded.path, profilePhotoName: uploaded.name });
      if (!result.ok) throw new Error(result.message);
      await logOperationalActivity(client, { technicianId: profile.id, eventType: "Profile photo updated", detail: uploaded.name });
      setPhotoUrl(await getTechnicianFileUrl(client, uploaded.path));
      setAssignmentMessage("Profile photo updated.");
    } catch (error) {
      setAssignmentMessage(error instanceof Error ? error.message : "Unable to upload the profile photo.");
    }
  }

  async function handleDocumentUpload(file?: File) {
    if (!file) return;
    if (!profile) return;
    const client = getSupabaseBrowserClient();
    if (!client) return setAssignmentMessage("Supabase is not configured.");
    try {
      const uploaded = await uploadTechnicianFile(client, profile.id, file, "document");
      const documents = documentToReplace
        ? profile.documents.map((document) => document.name === documentToReplace ? uploaded : document)
        : [...profile.documents, uploaded];
      const result = await upsertTechnician({ ...profile, documents });
      if (!result.ok) throw new Error(result.message);
      await logOperationalActivity(client, { technicianId: profile.id, eventType: documentToReplace ? "Document replaced" : "Document uploaded", detail: uploaded.name });
      setAssignmentMessage(documentToReplace ? `${documentToReplace} replaced.` : `${uploaded.name} uploaded.`);
      setDocumentToReplace(null);
    } catch (error) {
      setAssignmentMessage(error instanceof Error ? error.message : "Unable to upload the document.");
    }
  }

  async function removeProfilePhoto() {
    if (!profile?.profilePhotoPath || !confirm("Remove this profile photo?")) return;
    const client = getSupabaseBrowserClient();
    if (!client) return setAssignmentMessage("Supabase is not configured.");
    try {
      await deleteTechnicianFile(client, profile.profilePhotoPath);
      const result = await upsertTechnician({ ...profile, profilePhotoPath: undefined, profilePhotoName: undefined });
      if (!result.ok) throw new Error(result.message);
      await logOperationalActivity(client, { technicianId: profile.id, eventType: "Profile photo removed" });
      setPhotoUrl("");
      setAssignmentMessage("Profile photo removed.");
    } catch (error) { setAssignmentMessage(error instanceof Error ? error.message : "Unable to remove the profile photo."); }
  }
  async function handlePairCase(caseId: string) {
    const match = matchingCases.find((item) => item.caseItem.id === caseId);
    if (!match) return;
    setPairingCase(match);
  }
  async function removeDocument(documentName: string, path?: string) {
    if (!profile || !confirm(`Remove ${documentName}?`)) return;
    const client = getSupabaseBrowserClient();
    if (!client) return setAssignmentMessage("Supabase is not configured.");
    try {
      if (path?.startsWith(`${profile.id}/`)) await deleteTechnicianFile(client, path);
      const result = await upsertTechnician({ ...profile, documents: profile.documents.filter((document) => document.name !== documentName) });
      if (!result.ok) throw new Error(result.message);
      await logOperationalActivity(client, { technicianId: profile.id, eventType: "Document removed", detail: documentName });
      setAssignmentMessage(`${documentName} removed.`);
    } catch (error) { setAssignmentMessage(error instanceof Error ? error.message : "Unable to remove the document."); }
  }

  async function handleAddNote() {
    const text = noteText.trim();
    if (!text) return;
    if (!profile) return;
    const client = getSupabaseBrowserClient();
    if (!client) return setOperationalError("Supabase is not configured.");
    try {
      await addOperationalNote(client, "technician", profile.id, text);
      await logOperationalActivity(client, { technicianId: profile.id, eventType: "Note added", detail: text.slice(0, 120) });
      setNotes(await fetchOperationalNotes(client, "technician", profile.id));
      setActivity(await fetchOperationalActivity(client, "technician", profile.id));
      setNoteText("");
    } catch (error) {
      setOperationalError(error instanceof Error ? error.message : "Unable to save note.");
    }
  }

  async function saveProfileEdits() {
    if (!editProfile) return;
    if (!editProfile.name.trim() || !editProfile.city.trim() || !editProfile.state.trim() || !editProfile.status) {
      setEditError("Please complete name, city, state, and status.");
      return;
    }
    const result = await upsertTechnician({
      ...editProfile,
      name: editProfile.name.trim(),
      city: editProfile.city.trim(),
      state: editProfile.state.trim(),
      phone: editProfile.phone.trim(),
      email: editProfile.email.trim(),
      zip: editProfile.zip?.trim() || undefined,
      employmentType: editProfile.employmentType.trim(),
      desiredPay: editProfile.desiredPay?.trim() || undefined,
      preferredContactMethod: editProfile.preferredContactMethod.trim(),
      centralReachExperience: editProfile.centralReachExperience.trim(),
      recruiterNotes: editProfile.recruiterNotes.trim(),
    });
    if (!result.ok) return setEditError(result.message);
    setEditError("");
    setEditProfile(null);
    setAssignmentMessage("Technician updated.");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        <aside className="w-full border-b border-slate-200 bg-white/80 p-6 backdrop-blur lg:w-64 lg:border-b-0 lg:border-r">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-lg font-semibold text-white shadow-lg shadow-blue-200">
              AB
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">ABA</p>
              <h2 className="text-lg font-semibold text-slate-900">Staffing Platform</h2>
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                  item.active
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <DetailNavigation listHref="/technicians" listLabel="Technicians" currentLabel={profile.name} badge="Technician Profile" />

          <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
              <div className="flex-shrink-0">
                <Image
                  src={photoUrl || createAvatar(profile.name)}
                  alt={`${profile.name} profile`}
                  width={208}
                  height={208}
                  unoptimized
                  className="h-40 w-40 rounded-[28px] border border-slate-200 object-cover shadow-md sm:h-52 sm:w-52"
                />
              </div>

              <div className="flex-1">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h1 className="text-3xl font-semibold text-slate-900">{profile.name}</h1>
                    <p className="mt-1 text-lg text-slate-500">{profile.city}, {profile.state}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getTechnicianStatusTone(profile.status)}`}>
                        {profile.status}
                      </span>
                      <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                        {profile.employmentType}
                      </span>
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                        {profile.travelRadius || "Travel radius not provided"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => { setEditProfile({ ...profile }); setEditError(""); }} className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">
                      Edit Technician
                    </button>
                    <a href={`mailto:${profile.email}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      Email
                    </a>
                    <a href={`tel:${profile.phone}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      Call
                    </a>
                    <button onClick={() => setShowMatches((current) => !current)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      Find Matching Cases
                    </button>
                    <button onClick={() => documentInputRef.current?.click()} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      Upload Document
                    </button>
                    <button onClick={() => router.push(`/map?focus=${encodeURIComponent(createTechnicianSlug(profile.name))}`)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      View Map
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                  <button type="button" onClick={() => photoInputRef.current?.click()} className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50">
                    {photoUrl ? "Change Photo" : "Upload Photo"}
                  </button>
                  {photoUrl ? <button type="button" onClick={() => void removeProfilePhoto()} className="font-semibold text-rose-700 hover:text-rose-800">Remove Photo</button> : null}
                  {profile.rating ? <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700">Rating: {profile.rating}</span> : null}
                  <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handlePhotoUpload(event.target.files?.[0])} />
                  <input ref={documentInputRef} type="file" className="hidden" onChange={(event) => void handleDocumentUpload(event.target.files?.[0])} />
                </div>

                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-500">Phone</p>
                    <p className="mt-1 text-base font-medium text-slate-900">{profile.phone || "Not provided"}</p>
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-500">Email</p>
                    <p className="mt-1 text-base font-medium text-slate-900">{profile.email || "Not provided"}</p>
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-500">Preferred Contact Method</p>
                    <p className="mt-1 text-base font-medium text-slate-900">{profile.preferredContactMethod || "Not provided"}</p>
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-500">Hours</p>
                    <p className="mt-1 text-base font-medium text-slate-900">{formatScheduleText(profile.hours)}</p>
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-500">Available Start Date</p>
                    <p className="mt-1 text-base font-medium text-slate-900">{formatUsDate(profile.availableStartDate)}</p>
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-500">Employment Type</p>
                    <p className="mt-1 text-base font-medium text-slate-900">{profile.employmentType || "Not provided"}</p>
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-500">Travel Radius</p>
                    <p className="mt-1 text-base font-medium text-slate-900">{profile.travelRadius || "Not provided"}</p>
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-500">CentralReach Experience</p>
                    <p className="mt-1 text-base font-medium text-slate-900">{profile.centralReachExperience || "Not provided"}</p>
                  </div>
                  {travelMinutes !== null ? (
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-500">Travel</p>
                      <p className="mt-1 text-base font-medium text-slate-900">{travelMinutes} min</p>
                    </div>
                  ) : null}
                  {profile.desiredPay ? (
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-500">Pay</p>
                      <p className="mt-1 text-base font-medium text-slate-900">{formatCurrencyPerHour(profile.desiredPay)}</p>
                    </div>
                  ) : null}
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                    <p className="text-sm font-semibold text-slate-500">Certifications</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(profile.certifications ?? []).map((certification) => (
                        <span key={certification} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800">
                          {certification}
                        </span>
                      ))}
                      {(profile.certifications ?? []).length === 0 ? <span className="text-sm text-slate-500">No certifications added.</span> : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">Assigned Clients</h2>
                  <button type="button" onClick={() => setShowAddClientModal(true)} className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white">+ Add Client</button>
                </div>
                <div className="mt-4 space-y-3">
                  {assignedClientCards.length === 0 ? <p className="text-sm text-slate-500">No current client assignments.</p> : null}
                  {assignedClientCards.map((client) => (
                    <div key={client.assignmentId} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-800">{client.clientName}</p>
                          <p className="mt-1 text-sm text-slate-500">{client.city}, {client.state}</p>
                          <p className="mt-1 text-sm text-slate-600">Status: {client.status}</p>
                          <p className="text-sm text-slate-600">Days: {client.days}</p>
                          <p className="text-sm text-slate-600">Hours: {client.hours}</p>
                          <p className="text-sm text-slate-600">BCBA: {client.bcba}</p>
                          <p className="text-sm text-slate-600">Start Date: {client.startDate}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getClientStatusTone(client.status)}`}>
                          {client.status}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link href={`/cases/${client.caseId}`} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                          Open Case
                        </Link>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm(`Remove ${profile.name} from ${client.clientName}?`)) return;
                            const result = await unassignCase(client.assignmentId);
                            setAssignmentMessage(result.ok ? `Unassigned ${client.clientName}.` : result.message);
                          }}
                          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                        >
                          Unassign
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <h2 className="text-lg font-semibold text-slate-900">Recruiter Notes</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{profile.recruiterNotes || "No recruiter notes added."}</p>
              </div>
            </div>

            <div className="mt-8 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-900">Documents</h2><button type="button" onClick={() => { setDocumentToReplace(null); documentInputRef.current?.click(); }} className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Upload Document</button></div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {profile.documents.map((document) => (
                  <div key={document.name} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-800">{document.name}</p>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{document.type}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">Uploaded {formatUsDate(document.updated)}</p>
                    {document.path ? (
                      <button
                        type="button"
                        onClick={() => {
                          const client = getSupabaseBrowserClient();
                          if (client) {
                            const openFile = document.path?.startsWith(`${profile.id}/`)
                              ? getTechnicianFileUrl(client, document.path ?? "")
                              : getInterviewResumeUrl(client, document.path ?? "");
                            void openFile
                              .then((url) => window.open(url, "_blank", "noopener,noreferrer"))
                              .catch(() => setAssignmentMessage("Unable to open this resume. Check Supabase Storage access."));
                          }
                        }}
                        className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        View
                      </button>
                    ) : null}
                    <button type="button" onClick={() => { setDocumentToReplace(document.name); documentInputRef.current?.click(); }} className="mt-3 ml-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Replace</button>
                    <button type="button" onClick={() => void removeDocument(document.name, document.path)} className="mt-3 ml-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">Remove</button>
                  </div>
                ))}
                {profile.documents.length === 0 ? <p className="text-sm text-slate-500">No documents uploaded.</p> : null}
              </div>
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-2">
              <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <h2 className="text-lg font-semibold text-slate-900">Availability & readiness</h2>
                <div className="mt-4 space-y-2 text-sm">
                  {weekDays.map((day) => { const available = (profile.availableDays ?? []).includes(day); return <div key={day} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"><span className="font-medium text-slate-700">{day}</span><span className={available ? "font-semibold text-slate-900" : "text-slate-500"}>{available ? formatTimeRange(profile.preferredStartTime, profile.preferredEndTime) : "Not Available"}</span></div>; })}
                </div>
                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-slate-500">Weekly summary</dt><dd className="whitespace-pre-line font-semibold text-slate-900">{formatWeeklyAvailability(profile.availableDays, profile.preferredStartTime, profile.preferredEndTime)}</dd></div>
                  <div><dt className="text-slate-500">Available from</dt><dd className="font-semibold text-slate-900">{formatUsDate(profile.availableStartDate)}</dd></div>
                </dl>
              </section>
              <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <h2 className="text-lg font-semibold text-slate-900">Experience & skills</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <p><span className="text-slate-500">ABA Experience</span><br /><strong>{profile.yearsAba === undefined ? "Not provided" : `${profile.yearsAba} years`}</strong></p>
                  <p><span className="text-slate-500">RBT Experience</span><br /><strong>{profile.yearsRbt === undefined ? "Not provided" : `${profile.yearsRbt} years`}</strong></p>
                  <p><span className="text-slate-500">In-Home Experience</span><br /><strong>{profile.inHomeExperience === undefined ? "Not provided" : profile.inHomeExperience ? "Yes" : "No"}</strong></p>
                  <p><span className="text-slate-500">Clinic Experience</span><br /><strong>{profile.clinicExperience === undefined ? "Not provided" : profile.clinicExperience ? "Yes" : "No"}</strong></p>
                  <p><span className="text-slate-500">Severe Behaviors</span><br /><strong>{profile.severeBehaviorsExperience === undefined ? "Not provided" : profile.severeBehaviorsExperience ? "Yes" : "No"}</strong></p>
                  <p><span className="text-slate-500">Preferred Age Group</span><br /><strong>{profile.preferredAgeGroup || "Not provided"}</strong></p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(profile.skills ?? []).map((skill) => <span key={skill} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{skill}</span>)}
                  {(profile.skills ?? []).length === 0 ? <span className="text-sm text-slate-500">No skills added.</span> : null}
                </div>
              </section>
            </div>

            {showMatches ? <section className="mt-8 rounded-[24px] border border-blue-200 bg-blue-50/40 p-5">
              <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-900">Matching cases</h2><span className="text-sm font-semibold text-blue-700">{matchingCases.length} results</span></div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {matchingCases.map((match) => <div key={match.caseItem.id} className="rounded-2xl border border-blue-100 bg-white p-4">
                  <p className="font-semibold text-slate-900">{match.caseItem.name}</p><p className="mt-1 text-sm text-slate-600">{match.caseItem.city}, {match.caseItem.state} · {formatTimeRange(match.caseItem.requiredStartTime, match.caseItem.requiredEndTime)}</p>
                  <p className="mt-1 text-sm text-slate-600">Drive Time: {match.driveTimeMinutes ?? "Unknown"} min</p>
                  <p className="mt-1 text-sm text-slate-600">Distance: {match.driveDistanceMiles ?? "Unknown"} mi</p>
                  <p className="mt-1 text-sm text-slate-600">Compatibility: {match.readinessStatus}</p>
                  <div className="mt-3 flex flex-wrap gap-2"><Link href={`/cases/${match.caseItem.id}`} className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">Open Case</Link><Link href={`/map?focus=${encodeURIComponent(createTechnicianSlug(profile.name))}`} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">View Map</Link><button type="button" onClick={() => void handlePairCase(match.caseItem.id)} disabled={!(match.readinessStatus === "Ready to Assign" || match.readinessStatus === "Travel Needs Confirmation" || match.readinessStatus === "Needs Availability Confirmation")} title={!(match.readinessStatus === "Ready to Assign" || match.readinessStatus === "Travel Needs Confirmation" || match.readinessStatus === "Needs Availability Confirmation") ? match.conflictReasons[0]?.message ?? "This case is blocked" : undefined} className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${(match.readinessStatus === "Ready to Assign" || match.readinessStatus === "Travel Needs Confirmation" || match.readinessStatus === "Needs Availability Confirmation") ? "bg-emerald-600 text-white" : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"}`}>Pair With Client</button></div>
                </div>)}
              </div>
            </section> : null}

            <div className="mt-8 grid gap-6 xl:grid-cols-2">
              <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <h2 className="text-lg font-semibold text-slate-900">Recruiter notes</h2>
                {profile.recruiterNotes ? <p className="mt-3 text-sm leading-6 text-slate-600">{profile.recruiterNotes}</p> : <p className="mt-3 text-sm text-slate-500">No recruiter notes added.</p>}
                <textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Add a timestamped internal note" className="mt-4 min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none ring-blue-200 focus:ring-2" />
                <button type="button" onClick={() => void handleAddNote()} className="mt-3 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Add Note</button>
                <div className="mt-4 space-y-3">{notes.map((note) => <div key={note.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><p className="text-slate-700">{note.note}</p><div className="mt-2 flex items-center justify-between text-xs text-slate-500"><span>{formatUsDateTime(note.createdAt)}</span><button onClick={() => { const client = getSupabaseBrowserClient(); if (client) void deleteOperationalNote(client, "technician", note.id).then(() => setNotes((current) => current.filter((item) => item.id !== note.id))).catch((error: unknown) => setOperationalError(error instanceof Error ? error.message : "Unable to delete note.")); }} className="font-semibold text-rose-700">Delete</button></div></div>)}{notes.length === 0 ? <p className="text-sm text-slate-500">No timestamped recruiter notes yet.</p> : null}</div>
              </section>
              <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <h2 className="text-lg font-semibold text-slate-900">Activity history</h2>
                <div className="mt-4 space-y-3">{activity.length ? activity.map((event) => <div key={event.id} className="border-l-2 border-blue-300 pl-3"><p className="text-sm font-semibold text-slate-800">{event.eventType}</p><p className="text-sm text-slate-600">{event.detail}</p><p className="mt-1 text-xs text-slate-500">{formatUsDateTime(event.createdAt)}</p></div>) : <p className="text-sm text-slate-500">No logged activity yet.</p>}</div>
              </section>
            </div>

            {operationalError ? <p className="mt-4 text-sm text-amber-700">{operationalError}</p> : null}

            {assignmentMessage ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                {assignmentMessage}
              </div>
            ) : null}
          </section>

          {showAddClientModal ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
              <div className="w-full max-w-3xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Add Client</p>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-900">Choose a case for {profile.name}</h3>
                  </div>
                  <button type="button" onClick={() => setShowAddClientModal(false)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Close</button>
                </div>

                <div className="mt-5 max-h-[70vh] space-y-3 overflow-y-auto">
                  {addClientCandidates.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">No open or assigned cases are available in {profile.state} for this technician.</p>
                  ) : null}
                  {addClientCandidates.map((caseItem) => {
                    const match = findMatchingCases(profile.id).find((item) => item.caseItem.id === caseItem.id) ?? null;
                    const isInactive = !["Available", "Assigned", "Active", "Interview"].includes(profile.status);
                    const hasDuplicateAssignment = assignments.some((assignment) => assignment.technicianId === profile.id && assignment.caseId === caseItem.id && assignment.status !== "Unassigned");
                    const hasActualOverlap = Boolean(match?.conflictReasons.some((reason) => reason.code === "existing_case_overlap"));
                    const warnings = [] as string[];
                    if (match && (match.readinessStatus === "Travel Needs Confirmation" || match.readinessStatus === "Needs Availability Confirmation" || match.readinessStatus === "Outside Travel Radius" || match.driveTimeMinutes == null || match.driveDistanceMiles == null || match.travelCompatibility === "Unknown" || match.availabilityStatus === "Needs Confirmation")) {
                      warnings.push("Travel or availability is informational only for manual assignment.");
                    }
                    const blocked = isInactive || hasDuplicateAssignment || hasActualOverlap;

                    return (
                      <div key={caseItem.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{caseItem.name}</p>
                            <p className="text-sm text-slate-600">{caseItem.city}, {caseItem.state}</p>
                            <p className="mt-1 text-sm text-slate-600">Days: {caseItem.requiredDays.join(", ") || "Not provided"}</p>
                            <p className="text-sm text-slate-600">Hours: {formatTimeRange(caseItem.requiredStartTime, caseItem.requiredEndTime)}</p>
                            <p className="text-sm text-slate-600">Status: {caseItem.status}</p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{caseItem.status}</span>
                        </div>
                        {warnings.length ? <p className="mt-2 text-xs text-amber-700">Warning: {warnings[0]}</p> : null}
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            disabled={blocked}
                            onClick={() => {
                              setPendingClientAssignment(caseItem);
                              setShowAddClientModal(false);
                            }}
                            className={`rounded-xl px-3 py-2 text-xs font-semibold ${blocked ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400" : "bg-blue-600 text-white"}`}
                          >
                            {blocked ? "Unavailable" : "Assign Client"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {pendingClientAssignment ? (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 p-4">
              <div className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Client Assignment</p>
                <h3 className="mt-3 text-2xl font-semibold text-slate-900">Assign {pendingClientAssignment.name} to {profile.name}?</h3>

                <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <div>
                    <p className="font-semibold text-slate-900">Client</p>
                    <p className="mt-1">{pendingClientAssignment.name}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Technician</p>
                    <p className="mt-1">{profile.name}</p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  <button type="button" onClick={() => setPendingClientAssignment(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>
                  <button type="button" disabled={clientAssignmentInProgress} onClick={async () => {
                    setClientAssignmentInProgress(true);
                    const result = await assignCase({
                      technicianId: profile.id,
                      caseId: pendingClientAssignment.id,
                      manualOverride: true,
                    });
                    if (result.ok) {
                      setSuccessToast(`Assigned ${pendingClientAssignment.name} to ${profile.name}.`);
                      setPendingClientAssignment(null);
                    } else {
                      setAssignmentMessage(result.message);
                    }
                    setClientAssignmentInProgress(false);
                  }} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                    {clientAssignmentInProgress ? "Confirming..." : "Confirm Assignment"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {successToast ? <div role="status" className="fixed bottom-6 right-6 z-[70] rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-lg">{successToast}</div> : null}

          <PairingConfirmation
            open={Boolean(pairingCase)}
            technicianName={profile.name}
            caseName={pairingCase?.caseItem.name ?? ""}
            clientSchedule={pairingCase?.caseItem.requiredScheduleText || "Schedule pending"}
            technicianAvailability={profile.hours || profile.availability || "Availability pending"}
            onCancel={() => setPairingCase(null)}
            onConfirm={async () => {
              if (!pairingCase) return;
              setPairingInProgress(true);
              const result = await assignCase({ technicianId: profile.id, caseId: pairingCase.caseItem.id });
              setAssignmentMessage(result.ok ? `Paired ${profile.name} with ${pairingCase.caseItem.name}.` : result.message);
              setPairingInProgress(false);
              if (result.ok) setPairingCase(null);
            }}
            isSaving={pairingInProgress}
          />

          {editProfile ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
              <section role="dialog" aria-modal="true" aria-labelledby="edit-technician-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[24px] bg-white p-6 shadow-2xl">
                <div className="flex items-center justify-between gap-4">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Technician Profile</p><h2 id="edit-technician-title" className="mt-1 text-xl font-semibold text-slate-900">Edit Technician</h2></div>
                  <button type="button" onClick={() => setEditProfile(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Close</button>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-slate-600">Name *<input value={editProfile.name} onChange={(event) => setEditProfile((current) => current ? { ...current, name: event.target.value } : current)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900" /></label>
                  <label className="text-sm text-slate-600">City *<input value={editProfile.city} onChange={(event) => setEditProfile((current) => current ? { ...current, city: event.target.value } : current)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900" /></label>
                  <label className="text-sm text-slate-600">State *<input value={editProfile.state} onChange={(event) => setEditProfile((current) => current ? { ...current, state: event.target.value } : current)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900" /></label>
                  <label className="text-sm text-slate-600">Status *<select value={editProfile.status} onChange={(event) => setEditProfile((current) => current ? { ...current, status: event.target.value } : current)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900"><option>Interview</option><option>Available</option><option>Assigned</option><option>Active</option></select></label>
                  <label className="text-sm text-slate-600">Phone<input value={editProfile.phone} onChange={(event) => setEditProfile((current) => current ? { ...current, phone: event.target.value } : current)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900" /></label>
                  <label className="text-sm text-slate-600">Email<input value={editProfile.email} onChange={(event) => setEditProfile((current) => current ? { ...current, email: event.target.value } : current)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900" /></label>
                  <label className="text-sm text-slate-600">Employment type<input value={editProfile.employmentType} onChange={(event) => setEditProfile((current) => current ? { ...current, employmentType: event.target.value } : current)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900" /></label>
                  <label className="text-sm text-slate-600">Desired pay<input value={editProfile.desiredPay ?? ""} onChange={(event) => setEditProfile((current) => current ? { ...current, desiredPay: event.target.value } : current)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900" /></label>
                  <label className="text-sm text-slate-600">Preferred contact<input value={editProfile.preferredContactMethod} onChange={(event) => setEditProfile((current) => current ? { ...current, preferredContactMethod: event.target.value } : current)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900" /></label>
                  <label className="text-sm text-slate-600">CentralReach experience<input value={editProfile.centralReachExperience} onChange={(event) => setEditProfile((current) => current ? { ...current, centralReachExperience: event.target.value } : current)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900" /></label>
                  <label className="text-sm text-slate-600 md:col-span-2">Recruiter notes<textarea value={editProfile.recruiterNotes} onChange={(event) => setEditProfile((current) => current ? { ...current, recruiterNotes: event.target.value, notes: event.target.value } : current)} className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900" /></label>
                </div>
                {editError ? <p className="mt-4 text-sm text-rose-700">{editError}</p> : null}
                <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setEditProfile(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button type="button" onClick={() => void saveProfileEdits()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">Save Technician</button></div>
              </section>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
