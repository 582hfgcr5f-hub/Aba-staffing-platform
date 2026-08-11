"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { DatabaseState } from "@/app/components/database-state";
import { createDetailHref, createListReturnHref, getListNavigationParams, restoreListScroll } from "@/app/components/detail-navigation";
import { useTechnicianDatabase } from "@/app/data/technicians-store";
import {
  createTechnicianMetrics,
  createTechnicianSearchPredicate,
  createTechnicianSlug,
  downloadTechniciansCsv,
  formatCurrencyPerHour,
  getClientStatusTone,
  getTechnicianStatusTone,
  parseTravelMinutes,
  sortTechnicians,
} from "@/app/data/technicians-utils";
import { type TechnicianProfile } from "@/app/data/technicians";

const navItems = [
  { label: "Dashboard", icon: "▣", href: "/" },
  { label: "Staffing Queue", icon: "✓", href: "/staffing-queue" },
  { label: "Technicians", icon: "👥", href: "/technicians", active: true },
  { label: "Clients", icon: "📋", href: "/cases" },
  { label: "Interviews", icon: "🗓️", href: "/interviews" },
  { label: "Map", icon: "🗺️", href: "/map" },
  { label: "Reports", icon: "📈", href: "#" },
  { label: "Settings", icon: "⚙️", href: "#" },
];

const statusFilters = ["All", "Interview", "Available", "Assigned", "Active"] as const;
const statusOptions = ["Interview", "Available", "Assigned", "Active"] as const;
const stateOptions = [
  { label: "Iowa", value: "IA" },
  { label: "New Mexico", value: "NM" },
] as const;
const employmentOptions = ["Full-time", "Part-time"] as const;
const dayOptions = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

const sortOptions = [
  { label: "Name A-Z", value: "name-asc" },
  { label: "Name Z-A", value: "name-desc" },
  { label: "City", value: "city" },
  { label: "Travel Radius", value: "travel-radius" },
  { label: "Pay", value: "pay" },
  { label: "Most Clients", value: "most-clients" },
  { label: "Fewest Clients", value: "fewest-clients" },
  { label: "Recently Added", value: "recently-added" },
] as const;

type TechnicianFormState = {
  id?: string;
  name: string;
  city: string;
  state: string;
  status: string;
  phone: string;
  email: string;
  zip: string;
  employmentType: string;
  experience: string;
  preferredStartTime: string;
  preferredEndTime: string;
  availableDays: string[];
  travelMinutes: string;
  desiredPay: string;
  centralReachExperience: string;
  preferredContactMethod: string;
  rating: string;
  notes: string;
};

function createEmptyForm(): TechnicianFormState {
  return {
    name: "",
    city: "",
    state: "NM",
    status: "Interview",
    phone: "",
    email: "",
    zip: "",
    employmentType: "",
    experience: "",
    preferredStartTime: "",
    preferredEndTime: "",
    availableDays: [],
    travelMinutes: "",
    desiredPay: "",
    centralReachExperience: "",
    preferredContactMethod: "",
    rating: "",
    notes: "",
  };
}

function createInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getClientBadgeLabel(status: string) {
  if (status === "Active") return "🟢 Active";
  if (status === "Pending") return "🟡 Pending";
  if (status === "Assigned") return "🔵 Assigned";
  if (status === "On Hold") return "🔴 On Hold";
  return status;
}

function formFromTechnician(technician: TechnicianProfile): TechnicianFormState {
  return {
    id: technician.id,
    name: technician.name,
    city: technician.city,
    state: technician.state,
    status: technician.status,
    phone: technician.phone,
    email: technician.email,
    zip: technician.zip ?? "",
    employmentType: technician.employmentType,
    experience: technician.experience ?? "",
    preferredStartTime: technician.preferredStartTime ?? "",
    preferredEndTime: technician.preferredEndTime ?? "",
    availableDays: technician.availableDays ?? [],
    travelMinutes: technician.travelMinutes ? `${technician.travelMinutes}` : "",
    desiredPay: technician.desiredPay ?? "",
    centralReachExperience: technician.centralReachExperience,
    preferredContactMethod: technician.preferredContactMethod,
    rating: technician.rating ?? "",
    notes: technician.notes ?? technician.recruiterNotes,
  };
}

export default function TechniciansPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { technicians, importTechniciansFromCsv, upsertTechnician, deleteTechnician, loading, errorMessage, refreshDatabase } = useTechnicianDatabase();

  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>("All");
  const [sortOption, setSortOption] = useState<(typeof sortOptions)[number]["value"]>("name-asc");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [formState, setFormState] = useState<TechnicianFormState>(createEmptyForm());
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const params = getListNavigationParams();
    const timer = window.setTimeout(() => {
      setSearch(params.get("search") ?? "");
      setStateFilter(params.get("state") ?? "All");
      setStatusFilter((params.get("status") as (typeof statusFilters)[number] | null) ?? "All");
      setSortOption((params.get("sort") as (typeof sortOptions)[number]["value"] | null) ?? "name-asc");
      if (params.get("add") === "1") {
        setFormMode("add");
        setFormState(createEmptyForm());
        setFormError("");
        setIsFormOpen(true);
      }
      restoreListScroll(params);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const metrics = useMemo(() => createTechnicianMetrics(technicians), [technicians]);

  const visibleTechnicians = useMemo(() => {
    const matchesSearch = createTechnicianSearchPredicate(search);
    const filtered = technicians.filter((tech) => {
      const matchesState = stateFilter === "All" || tech.state === stateFilter;
      const matchesStatus = statusFilter === "All" || tech.status === statusFilter;
      return matchesSearch(tech) && matchesState && matchesStatus;
    });

    return sortTechnicians(filtered, sortOption);
  }, [search, stateFilter, statusFilter, sortOption, technicians]);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;
    const csvText = await file.text();
    await importTechniciansFromCsv(csvText);
  };

  const openAddForm = () => {
    setFormMode("add");
    setFormState(createEmptyForm());
    setFormError("");
    setIsFormOpen(true);
  };

  const openEditForm = (technician: TechnicianProfile) => {
    setFormMode("edit");
    setFormState(formFromTechnician(technician));
    setFormError("");
    setIsFormOpen(true);
  };

  const handleSaveTechnician = async () => {
    if (!formState.name.trim() || !formState.city.trim() || !formState.state || !formState.status) {
      setFormError("Please complete all required fields.");
      return;
    }

    const travelMinutes = formState.travelMinutes.trim() ? Number.parseInt(formState.travelMinutes, 10) : null;
    const previous = formState.id ? technicians.find((item) => item.id === formState.id) : null;

    const result = await upsertTechnician({
      id: formState.id,
      name: formState.name.trim(),
      city: formState.city.trim(),
      state: formState.state,
      status: formState.status,
      phone: formState.phone.trim(),
      email: formState.email.trim(),
      zip: formState.zip.trim() || undefined,
      preferredContactMethod: formState.preferredContactMethod.trim(),
      employmentType: formState.employmentType || "Full-time",
      experience: formState.experience.trim() || undefined,
      travelRadius:
        travelMinutes !== null && Number.isFinite(travelMinutes)
          ? `${Math.max(0, travelMinutes)} min`
          : previous?.travelRadius || "",
      travelMinutes: travelMinutes !== null && Number.isFinite(travelMinutes) ? Math.max(0, travelMinutes) : undefined,
      desiredPay: formState.desiredPay.trim() || undefined,
      hours:
        formState.preferredStartTime && formState.preferredEndTime
          ? `${formState.preferredStartTime}-${formState.preferredEndTime}`
          : previous?.hours || "",
      preferredStartTime: formState.preferredStartTime || undefined,
      preferredEndTime: formState.preferredEndTime || undefined,
      availableDays: formState.availableDays,
      availableStartDate: previous?.availableStartDate || new Date().toISOString().slice(0, 10),
      centralReachExperience: formState.centralReachExperience,
      rating: formState.rating.trim() || undefined,
      notes: formState.notes.trim() || undefined,
      certifications: previous?.certifications || [],
      availability: previous?.availability || "Open for new assignments",
      clients: previous?.clients || [],
      recruiterNotes: formState.notes.trim(),
      documents: previous?.documents || [],
      latitude: previous?.latitude,
      longitude: previous?.longitude,
    });

    if (!result.ok) {
      setFormError(result.message);
      return;
    }

    setIsFormOpen(false);
    setFormState(createEmptyForm());
    setFormError("");
  };

  const handleDeleteTechnician = async (technician: TechnicianProfile) => {
    if (!confirm(`Delete ${technician.name}? This removes technician assignments and keeps cases in shared data.`)) return;
    const result = await deleteTechnician(technician.id);
    if (!result.ok) {
      setFormError(result.message);
    }
  };

  if (loading) {
    return <DatabaseState title="Loading technicians" message="Fetching technician records from Supabase." />;
  }

  if (errorMessage) {
    return <DatabaseState title="Technician data unavailable" message={errorMessage} actionLabel="Retry" onAction={() => void refreshDatabase()} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto flex max-w-[1700px] flex-col lg:flex-row">
        <aside className="w-full border-b border-slate-200 bg-white/80 p-6 backdrop-blur lg:w-72 lg:border-b-0 lg:border-r">
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
          <header className="mb-6 flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 p-6 text-white shadow-xl shadow-blue-100 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-100">Technician Network</p>
              <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Field team overview</h1>
              <p className="mt-2 text-sm text-blue-50/90">Find specialists by location, review assignments, and coordinate outreach quickly.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button type="button" onClick={openAddForm} className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50">
                + Add Technician
              </button>
              <button type="button" onClick={handleImportClick} className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50">
                📥 Import Technicians
              </button>
              <button type="button" onClick={() => downloadTechniciansCsv(technicians)} className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50">
                📤 Export Technicians
              </button>
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportChange} />
            </div>
          </header>

          {isFormOpen ? (
            <section className="mb-6 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <button type="button" onClick={() => setIsFormOpen(false)} className="text-sm font-semibold text-blue-700 hover:text-blue-800">← Back to Technicians</button>
              <h2 className="mt-3 text-lg font-semibold text-slate-900">{formMode === "add" ? "Add Technician" : "Edit Technician"}</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="text-sm text-slate-600">Technician Name *
                  <input value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">City *
                  <input value={formState.city} onChange={(event) => setFormState((current) => ({ ...current, city: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">State *
                  <select value={formState.state} onChange={(event) => setFormState((current) => ({ ...current, state: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                    {stateOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-600">Status *
                  <select value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-600">Phone
                  <input value={formState.phone} onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">Email
                  <input value={formState.email} onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">ZIP
                  <input value={formState.zip} onChange={(event) => setFormState((current) => ({ ...current, zip: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">Employment Type
                  <select value={formState.employmentType} onChange={(event) => setFormState((current) => ({ ...current, employmentType: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <option value="">Select</option>
                    {employmentOptions.map((option) => (
                      <option key={option} value={option}>{option === "Full-time" ? "Full Time" : "Part Time"}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-600">Experience
                  <input value={formState.experience} onChange={(event) => setFormState((current) => ({ ...current, experience: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">Preferred Start Time
                  <input type="time" value={formState.preferredStartTime} onChange={(event) => setFormState((current) => ({ ...current, preferredStartTime: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">Preferred End Time
                  <input type="time" value={formState.preferredEndTime} onChange={(event) => setFormState((current) => ({ ...current, preferredEndTime: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <fieldset className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 md:col-span-2">
                  <legend className="px-1">Available Days</legend>
                  <div className="mt-1 grid grid-cols-2 gap-2 md:grid-cols-4">
                    {dayOptions.map((day) => (
                      <label key={day} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formState.availableDays.includes(day)}
                          onChange={() =>
                            setFormState((current) => ({
                              ...current,
                              availableDays: current.availableDays.includes(day)
                                ? current.availableDays.filter((item) => item !== day)
                                : [...current.availableDays, day],
                            }))
                          }
                        />
                        <span>{day}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="text-sm text-slate-600">Travel Radius in Minutes
                  <input type="number" min="0" value={formState.travelMinutes} onChange={(event) => setFormState((current) => ({ ...current, travelMinutes: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">Desired Pay
                  <input value={formState.desiredPay} onChange={(event) => setFormState((current) => ({ ...current, desiredPay: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">CentralReach Experience
                  <input value={formState.centralReachExperience} onChange={(event) => setFormState((current) => ({ ...current, centralReachExperience: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">Preferred Contact
                  <input value={formState.preferredContactMethod} onChange={(event) => setFormState((current) => ({ ...current, preferredContactMethod: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600">Rating
                  <input value={formState.rating} onChange={(event) => setFormState((current) => ({ ...current, rating: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" />
                </label>
                <label className="text-sm text-slate-600 md:col-span-2">Notes
                  <textarea value={formState.notes} onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" rows={3} />
                </label>
              </div>
              {formError ? <p className="mt-3 text-sm text-rose-600">{formError}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={handleSaveTechnician} className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Save</button>
                <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
              </div>
            </section>
          ) : null}

          <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            {[
              { label: "Total Technicians", value: metrics.total },
              { label: "Available", value: metrics.available },
              { label: "Assigned", value: metrics.assigned },
              { label: "Interview", value: metrics.interview },
              { label: "Active", value: metrics.active },
              { label: "Average Travel Radius", value: metrics.averageTravelRadius === null ? "—" : `${metrics.averageTravelRadius} min` },
            ].map((stat) => (
              <div key={stat.label} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{stat.label}</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{stat.value}</p>
              </div>
            ))}
          </section>

          <section className="mb-6 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:flex-1">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, phone, email, city, ZIP, or client name"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white md:max-w-[420px]"
                />

                <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <span className="whitespace-nowrap font-medium">Sort</span>
                  <select value={sortOption} onChange={(event) => setSortOption(event.target.value as (typeof sortOptions)[number]["value"])} className="bg-transparent pr-2 outline-none">
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap justify-end gap-2 xl:ml-auto">
                <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1">
                  {(["IA", "NM", "All"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setStateFilter(option)}
                      className={`rounded-full px-3 py-2 text-sm font-medium transition ${stateFilter === option ? "bg-blue-600 text-white" : "text-slate-700"}`}
                    >
                      {option === "IA" ? "Iowa" : option === "NM" ? "New Mexico" : "All States"}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1">
                  {statusFilters.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setStatusFilter(option)}
                      className={`rounded-full px-3 py-2 text-sm font-medium transition ${statusFilter === option ? "bg-cyan-600 text-white" : "text-slate-700"}`}
                    >
                      {option === "All" ? "All Status" : option}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {visibleTechnicians.length === 0 ? (
            <div className="rounded-[24px] border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              No technicians match the selected filters.
            </div>
          ) : (
            <section className="mx-auto grid w-full max-w-[1700px] gap-6 [grid-template-columns:repeat(auto-fit,minmax(340px,1fr))]">
              {visibleTechnicians.map((tech) => {
                const listHref = createListReturnHref("/technicians", { search, state: stateFilter, status: statusFilter, sort: sortOption });
                const profileHref = createDetailHref(`/technicians/${createTechnicianSlug(tech.name)}`, listHref);
                const viewMapHref = `/map?focus=${encodeURIComponent(createTechnicianSlug(tech.name))}`;
                const travelMinutes = parseTravelMinutes(tech.travelMinutes ?? tech.travelRadius);
                const payRate = formatCurrencyPerHour(tech.desiredPay);
                const clientCount = tech.clients.length;
                const summaryTravel = travelMinutes === null ? null : `${travelMinutes} min`;

                return (
                  <article
                    key={tech.id}
                    onClick={() => router.push(profileHref)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(profileHref);
                      }
                    }}
                    className="flex h-full min-h-[360px] w-full cursor-pointer flex-col rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="mb-3 flex justify-end gap-2">
                      <button type="button" onClick={(event) => { event.stopPropagation(); openEditForm(tech); }} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Edit Technician</button>
                      <button type="button" onClick={(event) => { event.stopPropagation(); handleDeleteTechnician(tech); }} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">Delete Technician</button>
                    </div>

                    <div className="relative mb-4 min-h-[70px]">
                      <div className="flex items-start gap-3 pr-24">
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white shadow-sm">
                          {createInitials(tech.name)}
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-lg font-semibold text-slate-900">{tech.name}</h2>
                          <div className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                            <span>📍</span>
                            <span>{tech.city}, {tech.state}</span>
                          </div>
                          <div className="mt-1 text-sm text-slate-500">
                            <span className="font-medium text-slate-600">Hours:</span> {tech.hours}
                          </div>
                          {travelMinutes !== null ? (
                            <div className="mt-1 text-sm text-slate-500">
                              <span className="font-medium text-slate-600">Travel:</span> {travelMinutes} minutes
                            </div>
                          ) : null}
                          {payRate ? (
                            <div className="mt-1 text-sm text-slate-500">
                              <span className="font-medium text-slate-600">Pay:</span> {payRate}/hr
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <span className={`absolute right-0 top-0 rounded-full px-3 py-1 text-xs font-semibold ${getTechnicianStatusTone(tech.status)}`}>
                        {tech.status}
                      </span>
                    </div>

                    <div className="mb-4">
                      <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Clients</h3>
                      <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        {tech.clients.length > 0 ? (
                          tech.clients.map((client) => (
                            <div key={client.name} className="flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-left text-sm text-slate-700 shadow-sm">
                              <span>{client.name}</span>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getClientStatusTone(client.status)}`}>
                                {getClientBadgeLabel(client.status)}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl bg-white px-3 py-2 text-sm text-slate-500 shadow-sm">
                            No current clients
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-auto flex flex-col gap-2 pt-2">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <a
                          href={`tel:${tech.phone}`}
                          onClick={(event) => event.stopPropagation()}
                          className="flex items-center justify-center rounded-2xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                        >
                          📞 Call
                        </a>
                        <a
                          href={`mailto:${tech.email}`}
                          onClick={(event) => event.stopPropagation()}
                          className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          ✉️ Email
                        </a>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            router.push(viewMapHref);
                          }}
                          className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          🗺 View Map
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          router.push(`/map?match=${encodeURIComponent(createTechnicianSlug(tech.name))}`);
                        }}
                        className="inline-flex items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        ⭐ Find Matching Cases
                      </button>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>Clients: {clientCount}</span>
                        <span>Status: {tech.status}</span>
                        <span>Travel: {summaryTravel ?? "—"}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
