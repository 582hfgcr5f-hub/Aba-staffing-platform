"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const navItems = [
  { label: "Dashboard", icon: "▣", href: "/" },
  { label: "Technicians", icon: "👥", href: "/technicians", active: true },
  { label: "Clients", icon: "📋", href: "#" },
  { label: "Interviews", icon: "🗓️", href: "#" },
  { label: "Map", icon: "🗺️", href: "#" },
  { label: "Reports", icon: "📈", href: "#" },
  { label: "Settings", icon: "⚙️", href: "#" },
];

const technicians = [
  {
    name: "Amanda Espinoza",
    city: "Rio Rancho",
    state: "NM",
    status: "Interview",
    clients: [],
    phone: "505-974-9867",
    email: "A_c_espinoza@outlook.com",
    quickStats: { employmentType: "Full Time", hours: "Available immediately", travelRadius: "45-minute travel" },
  },
  {
    name: "Lezlee Yancey",
    city: "Carlsbad",
    state: "NM",
    status: "Active",
    clients: [
      { name: "Allison Arenivar", color: "green" },
      { name: "Damian Navarro", color: "green" },
      { name: "Akaius Brewer", color: "green" },
    ],
    phone: "575-725-8009",
    email: "Yanceyl@hotmail.com",
    quickStats: { employmentType: "Full Time", hours: "10:00 AM–8:00 PM", travelRadius: "45-minute travel" },
  },
  {
    name: "Samantha Cruz",
    city: "Albuquerque",
    state: "NM",
    status: "Assigned",
    clients: [{ name: "Ezeriah Vigil", color: "yellow" }],
    phone: "831-756-9677",
    email: "Simplyysamm04@gmail.com",
    quickStats: { employmentType: "Full Time", hours: "Weekdays, flexible", travelRadius: "45-minute travel" },
  },
  {
    name: "Molly Pace",
    city: "Sioux City",
    state: "IA",
    status: "Available",
    clients: [{ name: "Alpha Zaidon", color: "green" }],
    phone: "712-301-4878",
    email: "mollypace69@yahoo.com",
    quickStats: { employmentType: "Full Time", hours: "8:00 AM–4:30 PM", travelRadius: "35-minute travel" },
  },
];

export default function TechniciansPage() {
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("NM");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortOption, setSortOption] = useState("name-asc");

  const visibleTechnicians = useMemo(() => {
    const filtered = technicians.filter((tech) => {
      const matchesSearch = tech.name.toLowerCase().includes(search.toLowerCase());
      const matchesState = stateFilter === "All" || tech.state === stateFilter;
      const matchesStatus = statusFilter === "All" || tech.status === statusFilter;
      return matchesSearch && matchesState && matchesStatus;
    });

    const sorted = [...filtered];

    switch (sortOption) {
      case "city-asc":
        sorted.sort((a, b) => a.city.localeCompare(b.city));
        break;
      case "clients-desc":
        sorted.sort((a, b) => b.clients.length - a.clients.length);
        break;
      case "clients-asc":
        sorted.sort((a, b) => a.clients.length - b.clients.length);
        break;
      case "name-asc":
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return sorted;
  }, [search, stateFilter, statusFilter, sortOption]);

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
            <button className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50">
              + Add Technician
            </button>
          </header>

          <section className="mb-6 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:flex-1">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by technician name"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white md:max-w-[320px]"
                />

                <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <span className="whitespace-nowrap font-medium">Sort</span>
                  <select
                    value={sortOption}
                    onChange={(event) => setSortOption(event.target.value)}
                    className="bg-transparent pr-2 outline-none"
                  >
                    <option value="name-asc">Name A–Z</option>
                    <option value="city-asc">City A–Z</option>
                    <option value="clients-desc">Most Clients</option>
                    <option value="clients-asc">Fewest Clients</option>
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap justify-end gap-2 xl:ml-auto">
                <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1">
                  {(["IA", "NM"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setStateFilter(option)}
                      className={`rounded-full px-3 py-2 text-sm font-medium transition ${stateFilter === option ? "bg-blue-600 text-white" : "text-slate-700"}`}
                    >
                      {option === "IA" ? "Iowa" : "New Mexico"}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1">
                  {(["All", "Interview", "Available", "Assigned", "Active"] as const).map((option) => (
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
              {visibleTechnicians.map((tech) => (
                <article key={tech.name} className="flex h-full min-h-[360px] w-full flex-col rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="relative mb-4 min-h-[70px]">
                    <div className="flex items-start gap-3 pr-24">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white shadow-sm">
                        {tech.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">{tech.name}</h2>
                        <div className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                          <span>📍</span>
                          <span>{tech.city}, {tech.state}</span>
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          <span className="font-medium text-slate-600">Hours:</span> {tech.quickStats?.hours}
                        </div>
                      </div>
                    </div>
                    <span className={`absolute right-0 top-0 rounded-full px-3 py-1 text-xs font-semibold ${
                      tech.status === "Active"
                        ? "bg-emerald-50 text-emerald-700"
                        : tech.status === "Assigned"
                          ? "bg-amber-50 text-amber-700"
                          : tech.status === "Interview"
                            ? "bg-sky-50 text-sky-700"
                            : "bg-blue-50 text-blue-700"
                    }`}>
                      {tech.status}
                    </span>
                  </div>

                  <div className="mb-4">
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Clients</h3>
                    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      {tech.clients.length > 0 ? (
                        tech.clients.map((client) => (
                          <button
                            key={client.name}
                            type="button"
                            className="flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-left text-sm text-slate-700 shadow-sm transition hover:bg-blue-50"
                          >
                            <span>{client.name}</span>
                            <span className={`h-2.5 w-2.5 rounded-full ${client.color === "green" ? "bg-emerald-500" : "bg-amber-500"}`} />
                          </button>
                        ))
                      ) : (
                        <div className="rounded-xl bg-white px-3 py-2 text-sm text-slate-500 shadow-sm">
                          No current clients
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-auto flex flex-col gap-2 pt-2">
                    <div className="flex gap-2">
                      <a
                        href={`tel:${tech.phone}`}
                        className="flex flex-1 items-center justify-center rounded-2xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                      >
                        Phone
                      </a>
                      <a
                        href={`mailto:${tech.email}`}
                        className="flex flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Email
                      </a>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Assign Client
                    </button>
                    <Link
                      href={`/technicians/${tech.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`}
                      className="inline-flex items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                    >
                      Open Profile
                    </Link>
                  </div>
                </article>
              ))}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
