"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DatabaseState } from "@/app/components/database-state";
import { createDetailHref, createListReturnHref, getListNavigationParams, restoreListScroll } from "@/app/components/detail-navigation";
import { formatScheduleText, formatTimeRange, formatUsDate } from "@/app/data/display-formatters";
import { useTechnicianDatabase } from "@/app/data/technicians-store";
import { normalizeState } from "@/app/data/technicians-utils";
import { type CaseProfile, type DayName } from "@/app/data/staffing-types";

const navItems = [
  { label: "Dashboard", icon: "▣", href: "/" },
  { label: "Staffing Queue", icon: "✓", href: "/staffing-queue" },
  { label: "Technicians", icon: "👥", href: "/technicians" },
  { label: "Cases", icon: "📋", href: "/cases", active: true },
  { label: "Interviews", icon: "🗓️", href: "/interviews" },
  { label: "Map", icon: "🗺️", href: "/map" },
  { label: "Reports", icon: "📈", href: "#" },
  { label: "Settings", icon: "⚙️", href: "#" },
];

const caseStatusOptions = ["Open", "Assigned", "Active", "Pending", "On Hold"] as const;
const urgencyOptions = ["Low", "Medium", "High"] as const;
const dayOptions: DayName[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type CaseFormState = {
  id?: string;
  name: string;
  city: string;
  state: string;
  status: string;
  address: string;
  zip: string;
  contactName: string;
  phone: string;
  email: string;
  requiredDays: DayName[];
  requiredStartTime: string;
  requiredEndTime: string;
  preferredTechnicianGender: string;
  requiredScheduleText: string;
  startDate: string;
  bcba: string;
  urgency: string;
  notes: string;
};

function createEmptyCaseForm(): CaseFormState {
  return {
    name: "",
    city: "",
    state: "NM",
    status: "Open",
    address: "",
    zip: "",
    contactName: "",
    phone: "",
    email: "",
    requiredDays: [],
    requiredStartTime: "",
    requiredEndTime: "",
    preferredTechnicianGender: "",
    requiredScheduleText: "",
    startDate: "",
    bcba: "",
    urgency: "Medium",
    notes: "",
  };
}

function formFromCase(caseItem: CaseProfile): CaseFormState {
  return {
    id: caseItem.id,
    name: caseItem.name,
    city: caseItem.city,
    state: caseItem.state,
    status: caseItem.status,
    address: caseItem.address ?? "",
    zip: caseItem.zip ?? "",
    contactName: caseItem.contactName ?? "",
    phone: caseItem.phone ?? "",
    email: caseItem.email ?? "",
    requiredDays: caseItem.requiredDays,
    requiredStartTime: caseItem.requiredStartTime,
    requiredEndTime: caseItem.requiredEndTime,
    preferredTechnicianGender: caseItem.preferredTechnicianGender ?? "",
    requiredScheduleText: caseItem.requiredScheduleText ?? "",
    startDate: caseItem.startDate ?? "",
    bcba: caseItem.bcba ?? "",
    urgency: caseItem.urgency ?? "Medium",
    notes: caseItem.notes ?? "",
  };
}

export default function CasesPage() {
  const { cases, findMatchingTechnicians, upsertCase, deleteCase, loading, errorMessage, refreshDatabase } = useTechnicianDatabase();
  const [stateFilter, setStateFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [formState, setFormState] = useState<CaseFormState>(createEmptyCaseForm());
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const params = getListNavigationParams();
    const timer = window.setTimeout(() => {
      setStateFilter(params.get("state") ?? "All");
      setStatusFilter(params.get("status") ?? "All");
      if (params.get("add") === "1") {
        setFormMode("add");
        setFormState(createEmptyCaseForm());
        setFormError("");
        setIsFormOpen(true);
      }
      restoreListScroll(params);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const visibleCases = useMemo(() => {
    return cases.filter((caseItem) => {
      const matchesState = stateFilter === "All" || normalizeState(caseItem.state) === normalizeState(stateFilter);
      const matchesStatus = statusFilter === "All" || caseItem.status === statusFilter;
      return matchesState && matchesStatus;
    });
  }, [cases, stateFilter, statusFilter]);

  const openAddForm = () => {
    setFormMode("add");
    setFormState(createEmptyCaseForm());
    setFormError("");
    setIsFormOpen(true);
  };

  const openEditForm = (caseItem: CaseProfile) => {
    setFormMode("edit");
    setFormState(formFromCase(caseItem));
    setFormError("");
    setIsFormOpen(true);
  };

  const handleSaveCase = async () => {
    if (!formState.name.trim() || !formState.city.trim() || !formState.state || !formState.status) {
      setFormError("Please complete all required fields.");
      return;
    }

    const result = await upsertCase({
      id: formState.id,
      name: formState.name.trim(),
      city: formState.city.trim(),
      state: normalizeState(formState.state),
      status: formState.status as CaseProfile["status"],
      address: formState.address.trim() || undefined,
      zip: formState.zip.trim() || undefined,
      contactName: formState.contactName.trim() || undefined,
      phone: formState.phone.trim() || undefined,
      email: formState.email.trim() || undefined,
      requiredDays: formState.requiredDays,
      requiredStartTime: formState.requiredStartTime,
      requiredEndTime: formState.requiredEndTime,
      requiredScheduleText: formState.requiredScheduleText.trim(),
      preferredTechnicianGender: formState.preferredTechnicianGender.trim() || undefined,
      startDate: formState.startDate || undefined,
      bcba: formState.bcba.trim() || undefined,
      urgency: formState.urgency as CaseProfile["urgency"],
      notes: formState.notes.trim() || undefined,
    });

    if (!result.ok) {
      setFormError(result.message);
      return;
    }

    setIsFormOpen(false);
    setFormState(createEmptyCaseForm());
    setFormError("");
  };

  const handleDeleteCase = async (caseItem: CaseProfile) => {
    if (!confirm(`Delete ${caseItem.name}? This removes related assignments from shared data.`)) return;
    const result = await deleteCase(caseItem.id);
    if (!result.ok) {
      setFormError(result.message);
    }
  };

  if (loading) {
    return <DatabaseState title="Loading cases" message="Fetching client cases from Supabase." />;
  }

  if (errorMessage) {
    return <DatabaseState title="Case data unavailable" message={errorMessage} actionLabel="Retry" onAction={() => void refreshDatabase()} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto flex max-w-[1700px] flex-col lg:flex-row">
        <aside className="w-full border-b border-slate-200 bg-white/80 p-6 backdrop-blur lg:w-72 lg:border-b-0 lg:border-r">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-lg font-semibold text-white shadow-lg shadow-blue-200">AB</div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">ABA</p>
              <h2 className="text-lg font-semibold text-slate-900">Staffing Platform</h2>
            </div>
          </div>
          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link key={item.label} href={item.href} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${item.active ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <header className="mb-6 flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 p-6 text-white shadow-xl shadow-blue-100 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-100">Case Intake</p>
              <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Client Cases</h1>
              <p className="mt-2 text-sm text-blue-50/90">Find matching technicians for every open or assigned case.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={openAddForm} className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-blue-700">
                + Add Case
              </button>
              {(["All", "NM", "IA"] as const).map((value) => (
                <button key={value} type="button" onClick={() => setStateFilter(value)} className={`rounded-full px-3 py-2 text-sm font-semibold ${stateFilter === value ? "bg-white text-blue-700" : "bg-white/20 text-white"}`}>
                  {value}
                </button>
              ))}
              {(["All", ...caseStatusOptions] as const).map((value) => (
                <button key={value} type="button" onClick={() => setStatusFilter(value)} className={`rounded-full px-3 py-2 text-sm font-semibold ${statusFilter === value ? "bg-cyan-500 text-white" : "bg-white/20 text-white"}`}>
                  {value}
                </button>
              ))}
            </div>
          </header>

          {isFormOpen ? (
            <section className="mb-6 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <button type="button" onClick={() => setIsFormOpen(false)} className="text-sm font-semibold text-blue-700 hover:text-blue-800">← Back to Cases</button>
              <h2 className="mt-3 text-lg font-semibold text-slate-900">{formMode === "add" ? "Add Case" : "Edit Case"}</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="text-sm text-slate-600">Client Name *
                  <input value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">City *
                  <input value={formState.city} onChange={(event) => setFormState((current) => ({ ...current, city: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">State *
                  <select value={formState.state} onChange={(event) => setFormState((current) => ({ ...current, state: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <option value="NM">New Mexico</option>
                    <option value="IA">Iowa</option>
                  </select>
                </label>
                <label className="text-sm text-slate-600">Case Status *
                  <select value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                    {caseStatusOptions.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-600">Address
                  <input value={formState.address} onChange={(event) => setFormState((current) => ({ ...current, address: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">ZIP
                  <input value={formState.zip} onChange={(event) => setFormState((current) => ({ ...current, zip: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">Case Contact Name
                  <input value={formState.contactName} onChange={(event) => setFormState((current) => ({ ...current, contactName: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">Phone
                  <input value={formState.phone} onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">Email
                  <input value={formState.email} onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <fieldset className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 md:col-span-2">
                  <legend className="px-1">Required Days</legend>
                  <div className="mt-1 grid grid-cols-2 gap-2 md:grid-cols-4">
                    {dayOptions.map((day) => (
                      <label key={day} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formState.requiredDays.includes(day)}
                          onChange={() =>
                            setFormState((current) => ({
                              ...current,
                              requiredDays: current.requiredDays.includes(day)
                                ? current.requiredDays.filter((item) => item !== day)
                                : [...current.requiredDays, day],
                            }))
                          }
                        />
                        <span>{day}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="text-sm text-slate-600">Required Start Time
                  <input type="time" value={formState.requiredStartTime} onChange={(event) => setFormState((current) => ({ ...current, requiredStartTime: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">Required End Time
                  <input type="time" value={formState.requiredEndTime} onChange={(event) => setFormState((current) => ({ ...current, requiredEndTime: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">Preferred Technician Gender
                  <input value={formState.preferredTechnicianGender} onChange={(event) => setFormState((current) => ({ ...current, preferredTechnicianGender: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">Required Schedule Text
                  <input value={formState.requiredScheduleText} onChange={(event) => setFormState((current) => ({ ...current, requiredScheduleText: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">Start Date
                  <input type="date" value={formState.startDate} onChange={(event) => setFormState((current) => ({ ...current, startDate: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">BCBA
                  <input value={formState.bcba} onChange={(event) => setFormState((current) => ({ ...current, bcba: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">Urgency
                  <select value={formState.urgency} onChange={(event) => setFormState((current) => ({ ...current, urgency: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                    {urgencyOptions.map((urgency) => (
                      <option key={urgency} value={urgency}>{urgency}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-600 md:col-span-2">Notes
                  <textarea value={formState.notes} onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))} rows={3} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
              </div>
              {formError ? <p className="mt-3 text-sm text-rose-600">{formError}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={handleSaveCase} className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Save</button>
                <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
              </div>
            </section>
          ) : null}

          <section className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(330px,1fr))]">
            {visibleCases.map((caseItem) => {
              const matchCount = findMatchingTechnicians(caseItem.id).length;
              const listHref = createListReturnHref("/cases", { state: stateFilter, status: statusFilter });
              const profileHref = createDetailHref(`/cases/${caseItem.id}`, listHref);
              return (
                <article key={caseItem.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">{caseItem.name}</h2>
                      <p className="mt-1 text-sm text-slate-500">{caseItem.city}, {caseItem.state}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{caseItem.status}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">Days: {caseItem.requiredDays.join(", ") || "TBD"}</p>
                  <p className="mt-1 text-sm text-slate-600">Hours: {formatScheduleText(caseItem.requiredScheduleText, formatTimeRange(caseItem.requiredStartTime, caseItem.requiredEndTime))}</p>
                  <p className="mt-1 text-sm text-slate-600">Start: {formatUsDate(caseItem.startDate, "TBD")}</p>
                  <p className="mt-1 text-sm text-slate-600">BCBA: {caseItem.bcba || "TBD"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => openEditForm(caseItem)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Edit Case</button>
                    <button type="button" onClick={() => handleDeleteCase(caseItem)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">Delete Case</button>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link href={profileHref} className="rounded-2xl bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white">View Profile</Link>
                    <Link href={profileHref} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-700">Find Matching Technicians</Link>
                    <a href={`mailto:?subject=${encodeURIComponent(`Case Update - ${caseItem.name}`)}`} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-700">Email</a>
                    <Link href="/map" className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-700">View Map</Link>
                  </div>
                  <p className="mt-4 text-xs text-slate-500">Smart Match candidates: {matchCount}</p>
                </article>
              );
            })}
          </section>
        </main>
      </div>
    </div>
  );
}
