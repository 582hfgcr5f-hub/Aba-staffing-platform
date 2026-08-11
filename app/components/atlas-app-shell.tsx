"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/app/components/auth-provider";

type AtlasAppShellProps = { children: React.ReactNode };

const navigation = [
  { label: "Operations Center", icon: "▣", href: "/" },
  { label: "Staffing Queue", icon: "✓", href: "/staffing-queue" },
  { label: "Technicians", icon: "👥", href: "/technicians" },
  { label: "Cases", icon: "▤", href: "/cases" },
  { label: "Interviews", icon: "◷", href: "/interviews" },
  { label: "Map", icon: "⌖", href: "/map" },
  { label: "Reports", icon: "▥", href: "#" },
  { label: "Settings", icon: "⚙", href: "#" },
] as const;

const pageMeta: Record<string, { title: string; description: string }> = {
  "/": { title: "Operations Center", description: "Daily staffing priorities and operational visibility" },
  "/staffing-queue": { title: "Staffing Queue", description: "Review assignments, readiness, and active placement work" },
  "/technicians": { title: "Technicians", description: "Manage field team availability and staffing capacity" },
  "/cases": { title: "Cases", description: "Coordinate client needs, coverage, and service starts" },
  "/interviews": { title: "Interviews", description: "Manage recruiting and candidate evaluation" },
  "/map": { title: "Map", description: "Review live geographic staffing coverage" },
};

function getPageMeta(pathname: string) {
  if (pageMeta[pathname]) return pageMeta[pathname];
  if (pathname.startsWith("/technicians/")) return { title: "Technician Profile", description: "Review technician record, assignments, and activity" };
  if (pathname.startsWith("/cases/")) return { title: "Case Profile", description: "Review case readiness, coverage, and activity" };
  if (pathname.startsWith("/interviews/")) return { title: "Interview Profile", description: "Review candidate evaluation and hiring activity" };
  return { title: "Atlas ABA", description: "Operations platform" };
}

export function AtlasAppShell({ children }: AtlasAppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useAuth();
  const [search, setSearch] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  if (pathname === "/login") return <>{children}</>;

  const meta = getPageMeta(pathname);
  const initials = (session?.user.email?.slice(0, 2) || "SA").toUpperCase();
  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = search.trim();
    if (query) router.push(`/technicians?search=${encodeURIComponent(query)}`);
  };

  return <div className="atlas-shell"><aside className="atlas-sidebar"><Link href="/" className="atlas-brand"><span>AB</span><span><small>ATLAS</small><strong>ABA Operations</strong></span></Link><nav aria-label="Primary navigation">{navigation.map((item) => { const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href); return <Link key={item.label} href={item.href} className={active ? "atlas-nav-item atlas-nav-item--active" : "atlas-nav-item"}><span>{item.icon}</span>{item.label}</Link>; })}</nav></aside><div className="atlas-content"><header className="atlas-top-bar"><div><h1>{meta.title}</h1><p>{meta.description}</p></div><div className="atlas-top-bar__actions"><form onSubmit={submitSearch} className="atlas-search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search technicians, clients, cases..." aria-label="Global search" /><button type="submit" aria-label="Search">⌕</button></form><div className="atlas-quick-add"><button type="button" onClick={() => setQuickAddOpen((open) => !open)} className="atlas-button atlas-button--primary">+ Quick Add</button>{quickAddOpen ? <div className="atlas-quick-add__menu"><Link href="/technicians?add=1">Technician</Link><Link href="/cases?add=1">Case</Link><Link href="/interviews?add=1">Interview</Link></div> : null}</div><span className="atlas-avatar" title={session?.user.email ?? "Staff account"}>{initials}</span></div></header><div className="atlas-page">{children}</div></div></div>;
}
