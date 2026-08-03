"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const navItems = [
  { label: "Dashboard", icon: "▣", href: "/" },
  { label: "Technicians", icon: "👥", href: "/technicians", active: true },
  { label: "Cases", icon: "📋", href: "#" },
  { label: "Interviews", icon: "🗓️", href: "#" },
  { label: "Map", icon: "🗺️", href: "#" },
  { label: "Reports", icon: "📈", href: "#" },
  { label: "Settings", icon: "⚙️", href: "#" },
];

const technicians = [
  {
    name: "Alicia Brooks",
    city: "Des Moines",
    state: "IA",
    status: "Active",
    clients: [
      { name: "Bright Path School", color: "green" },
      { name: "Riverstone Center", color: "green" },
    ],
    phone: "+1 (515) 555-0142",
    email: "alicia@abastaffing.com",
  },
  {
    name: "Dev Patel",
    city: "Albuquerque",
    state: "NM",
    status: "Assigned",
    clients: [
      { name: "Northview Clinic", color: "yellow" },
      { name: "Cedar Springs", color: "yellow" },
    ],
    phone: "+1 (505) 555-0178",
    email: "dev@abastaffing.com",
  },
  {
    name: "Nina Flores",
    city: "Cedar Rapids",
    state: "IA",
    status: "Available",
    clients: [{ name: "Lakeside Learning", color: "green" }],
    phone: "+1 (319) 555-0197",
    email: "nina@abastaffing.com",
  },
  {
    name: "Marcus Hall",
    city: "Santa Fe",
    state: "NM",
    status: "Interview",
    clients: [{ name: "Sunrise Center", color: "yellow" }],
    phone: "+1 (505) 555-0114",
    email: "marcus@abastaffing.com",
  },
];

export default function TechniciansPage() {
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("All");

  const filteredTechnicians = useMemo(() => {
    return technicians.filter((tech) => {
      const matchesSearch = `${tech.name} ${tech.city} ${tech.state} ${tech.clients.map((client) => client.name).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesLocation = location === "All" || tech.state === location;
      return matchesSearch && matchesLocation;
    });
  }, [location, search]);

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
          <header className="mb-6 flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 p-6 text-white shadow-xl shadow-blue-100 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-100">Technician Network</p>
              <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Field team overview</h1>
              <p className="mt-2 text-sm text-blue-50/90">Find specialists by location, monitor client coverage, and coordinate outreach quickly.</p>
            </div>
            <button className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50">
              + Add Technician
            </button>
          </header>

          <section className="mb-6 flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search technician or client"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-0 transition focus:border-blue-400 focus:bg-white md:max-w-md"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setLocation("All")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${location === "All" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setLocation("IA")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${location === "IA" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
              >
                Iowa
              </button>
              <button
                type="button"
                onClick={() => setLocation("NM")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${location === "NM" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
              >
                New Mexico
              </button>
            </div>
          </section>

          <section className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {filteredTechnicians.map((tech) => (
              <article key={tech.name} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{tech.name}</h2>
                    <p className="text-sm text-slate-500">{tech.city}, {tech.state}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
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

                <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  {tech.clients.map((client) => (
                    <button
                      key={client.name}
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-left text-sm text-slate-700 shadow-sm transition hover:bg-blue-50"
                    >
                      <span>{client.name}</span>
                      <span className={`h-2.5 w-2.5 rounded-full ${client.color === "green" ? "bg-emerald-500" : "bg-amber-500"}`} />
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
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
              </article>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
}
