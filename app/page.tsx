import Link from "next/link";

const navItems = [
  { label: "Dashboard", icon: "▣", active: true, href: "/" },
  { label: "Technicians", icon: "👥", href: "/technicians" },
  { label: "Cases", icon: "📋", href: "#" },
  { label: "Interviews", icon: "🗓️", href: "#" },
  { label: "Map", icon: "🗺️", href: "#" },
  { label: "Reports", icon: "📈", href: "#" },
  { label: "Settings", icon: "⚙️", href: "#" },
];

const stats = [
  { label: "Active Cases", value: "24", change: "+4 this week", accent: "from-blue-600 to-cyan-500" },
  { label: "Available Techs", value: "18", change: "6 on standby", accent: "from-sky-600 to-blue-500" },
  { label: "Assigned Cases", value: "12", change: "3 pending review", accent: "from-indigo-600 to-blue-500" },
  { label: "Interview Candidates", value: "9", change: "2 today", accent: "from-cyan-600 to-sky-500" },
];

const recentCases = [
  { client: "Bright Path School", technician: "Maya Chen", status: "In Progress" },
  { client: "Northview Clinic", technician: "Jordan Lee", status: "Scheduled" },
  { client: "Riverstone Center", technician: "Elena Cruz", status: "Awaiting Approval" },
];

const technicians = [
  { name: "Alicia Brooks", specialty: "Early Childhood", availability: "Available" },
  { name: "Dev Patel", specialty: "Adult Services", availability: "On Route" },
  { name: "Nina Flores", specialty: "School-Based", availability: "Available" },
];

const interviews = [
  { time: "09:30", candidate: "Sophia Kim", role: "Behavior Technician" },
  { time: "11:00", candidate: "Marcus Hall", role: "Clinical Supervisor" },
  { time: "02:15", candidate: "Lena Ortiz", role: "RBT Candidate" },
];

export default function Home() {
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
            {navItems.map((item) => {
              const content = (
                <>
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </>
              );

              if (item.label === "Technicians") {
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                      item.active
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <button
                  key={item.label}
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                    item.active
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {content}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <header className="mb-6 flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 p-6 text-white shadow-xl shadow-blue-100 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-100">Operations Center</p>
              <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Welcome back, team</h1>
              <p className="mt-2 text-sm text-blue-50/90">Monitor staffing demand, technician readiness, and interview pipeline from one control center.</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-sm text-blue-50">Today&apos;s coverage</p>
              <p className="text-xl font-semibold">94% staffed</p>
            </div>
          </header>

          <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className={`inline-flex rounded-full bg-gradient-to-r ${stat.accent} px-3 py-1 text-xs font-semibold text-white`}>
                  {stat.label}
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-semibold text-slate-900">{stat.value}</p>
                    <p className="mt-1 text-sm text-slate-500">{stat.change}</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-slate-100" />
                </div>
              </div>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
            <div className="space-y-6">
              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Recent Active Cases</h2>
                    <p className="text-sm text-slate-500">Live status of the most active caseloads</p>
                  </div>
                  <button className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">View all</button>
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 font-medium">Client</th>
                        <th className="px-4 py-3 font-medium">Technician</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentCases.map((item) => (
                        <tr key={item.client} className="border-t border-slate-200 bg-white">
                          <td className="px-4 py-3 font-medium text-slate-800">{item.client}</td>
                          <td className="px-4 py-3 text-slate-600">{item.technician}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Available Technicians</h2>
                <p className="mt-1 text-sm text-slate-500">Quick access to ready-to-deploy staff</p>
                <div className="mt-4 space-y-3">
                  {technicians.map((person) => (
                    <div key={person.name} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-800">{person.name}</p>
                        <p className="text-sm text-slate-500">{person.specialty}</p>
                      </div>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                        {person.availability}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Upcoming Interviews</h2>
                  <p className="text-sm text-slate-500">Scheduled conversations this afternoon</p>
                </div>
                <button className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">+ Add</button>
              </div>
              <div className="space-y-3">
                {interviews.map((interview) => (
                  <div key={interview.candidate} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800">{interview.candidate}</p>
                        <p className="text-sm text-slate-500">{interview.role}</p>
                      </div>
                      <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-blue-700 shadow-sm">
                        {interview.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
