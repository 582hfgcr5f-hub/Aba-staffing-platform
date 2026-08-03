import Link from "next/link";
import { notFound } from "next/navigation";

const navItems = [
  { label: "Dashboard", icon: "▣", href: "/" },
  { label: "Technicians", icon: "👥", href: "/technicians", active: true },
  { label: "Cases", icon: "📋", href: "#" },
  { label: "Interviews", icon: "🗓️", href: "#" },
  { label: "Map", icon: "🗺️", href: "#" },
  { label: "Reports", icon: "📈", href: "#" },
  { label: "Settings", icon: "⚙️", href: "#" },
];

const technicianProfiles = [
  {
    id: "amanda-espinoza",
    name: "Amanda Espinoza",
    city: "Rio Rancho",
    state: "NM",
    status: "Interview",
    phone: "505-974-9867",
    email: "A_c_espinoza@outlook.com",
    employmentType: "Contract",
    travelRadius: "50 miles",
    certifications: ["RBT", "CPR/AED"],
    availability: "Open for interviews", 
    assignedClients: [{ name: "Pending onboarding", status: "assigned" }],
    recruiterNotes: "Strong communication and quick turnaround. Prefers school-based placements near Albuquerque.",
  },
  {
    id: "lezlee-yancey",
    name: "Lezlee Yancey",
    city: "Carlsbad",
    state: "NM",
    status: "Active",
    phone: "575-725-8009",
    email: "Yanceyl@hotmail.com",
    employmentType: "Full-time",
    travelRadius: "75 miles",
    certifications: ["RBT", "Behavior Support Specialist"],
    availability: "Available this week",
    assignedClients: [
      { name: "Allison Arenivar", status: "active" },
      { name: "Damian Navarro", status: "active" },
      { name: "Akaius Brewer", status: "active" },
    ],
    recruiterNotes: "Reliable with high-volume scheduling and excellent parent communication.",
  },
  {
    id: "samantha-cruz",
    name: "Samantha Cruz",
    city: "Albuquerque",
    state: "NM",
    status: "Assigned",
    phone: "831-756-9677",
    email: "Simplyysamm04@gmail.com",
    employmentType: "Part-time",
    travelRadius: "30 miles",
    certifications: ["RBT", "First Aid"],
    availability: "Booked for 2 days",
    assignedClients: [{ name: "Ezeriah Vigil", status: "assigned" }],
    recruiterNotes: "Excellent fit for in-home services and flexible scheduling.",
  },
  {
    id: "molly-pace",
    name: "Molly Pace",
    city: "Sioux City",
    state: "IA",
    status: "Available",
    phone: "712-301-4878",
    email: "mollypace69@yahoo.com",
    employmentType: "Full-time",
    travelRadius: "40 miles",
    certifications: ["RBT", "CPR/AED"],
    availability: "Open for new assignments",
    assignedClients: [{ name: "Alpha Zaidon", status: "active" }],
    recruiterNotes: "Warm demeanor, strong rapport with clients, and strong attendance record.",
  },
];

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

type TechnicianProfile = (typeof technicianProfiles)[number];

export default async function TechnicianProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = technicianProfiles.find((item) => item.id === id);

  if (!profile) {
    notFound();
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
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Link href="/technicians" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
              ← Back to Technicians
            </Link>
            <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
              Technician Profile
            </div>
          </div>

          <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
              <div className="flex-shrink-0">
                <img
                  src={createAvatar(profile.name)}
                  alt={`${profile.name} profile`}
                  className="h-40 w-40 rounded-[28px] border border-slate-200 object-cover shadow-md sm:h-52 sm:w-52"
                />
              </div>

              <div className="flex-1">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h1 className="text-3xl font-semibold text-slate-900">{profile.name}</h1>
                    <p className="mt-1 text-lg text-slate-500">{profile.city}, {profile.state}</p>
                    <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                      profile.status === "Active"
                        ? "bg-emerald-50 text-emerald-700"
                        : profile.status === "Assigned"
                          ? "bg-amber-50 text-amber-700"
                          : profile.status === "Interview"
                            ? "bg-sky-50 text-sky-700"
                            : "bg-blue-50 text-blue-700"
                    }`}>
                      {profile.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">
                      Edit Profile
                    </button>
                    <a href={`mailto:${profile.email}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      Email
                    </a>
                    <a href={`tel:${profile.phone}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      Call
                    </a>
                    <button className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      Resume
                    </button>
                    <button className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      Assign Client
                    </button>
                  </div>
                </div>

                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-500">Phone</p>
                    <p className="mt-1 text-base font-medium text-slate-900">{profile.phone}</p>
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-500">Email</p>
                    <p className="mt-1 text-base font-medium text-slate-900">{profile.email}</p>
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-500">Employment Type</p>
                    <p className="mt-1 text-base font-medium text-slate-900">{profile.employmentType}</p>
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-500">Travel Radius</p>
                    <p className="mt-1 text-base font-medium text-slate-900">{profile.travelRadius}</p>
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                    <p className="text-sm font-semibold text-slate-500">Certifications</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {profile.certifications.map((certification) => (
                        <span key={certification} className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm">
                          {certification}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                    <p className="text-sm font-semibold text-slate-500">Availability</p>
                    <p className="mt-1 text-base font-medium text-slate-900">{profile.availability}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <h2 className="text-lg font-semibold text-slate-900">Assigned Clients</h2>
                <div className="mt-4 space-y-3">
                  {profile.assignedClients.map((client) => (
                    <div key={client.name} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
                      <span className="font-medium text-slate-800">{client.name}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${client.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {client.status === "active" ? "Active" : "Assigned"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <h2 className="text-lg font-semibold text-slate-900">Recruiter Notes</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{profile.recruiterNotes}</p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
