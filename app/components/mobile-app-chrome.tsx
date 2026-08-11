"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const primaryItems = [
  { label: "Dashboard", icon: "▣", href: "/" },
  { label: "Technicians", icon: "👥", href: "/technicians" },
  { label: "Cases", icon: "▤", href: "/cases" },
  { label: "Interviews", icon: "◷", href: "/interviews" },
] as const;

const moreItems = [
  { label: "Staffing Queue", icon: "✓", href: "/staffing-queue" },
  { label: "Map", icon: "⌖", href: "/map" },
  { label: "Reports", icon: "▥", href: "#" },
  { label: "Settings", icon: "⚙", href: "#" },
] as const;

type MobileAppChromeProps = {
  title: string;
  backHref?: string;
  actionLabel?: string;
  actionHref?: string;
};

export function MobileAppChrome({ title, backHref, actionLabel = "More actions", actionHref }: MobileAppChromeProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <header className="mobile-top-bar md:hidden">
        {backHref ? <Link href={backHref} className="mobile-top-bar__back" aria-label="Go back">←</Link> : <span className="mobile-top-bar__brand">ABA</span>}
        <p className="mobile-top-bar__title">{title}</p>
        {actionHref ? <Link href={actionHref} className="mobile-top-bar__action" aria-label={actionLabel}>•••</Link> : <button type="button" className="mobile-top-bar__action" aria-label={actionLabel} onClick={() => setMoreOpen(true)}>•••</button>}
      </header>

      {moreOpen ? <div className="mobile-more-sheet md:hidden" role="dialog" aria-modal="true" aria-label="More navigation"><button type="button" className="mobile-more-sheet__backdrop" aria-label="Close navigation" onClick={() => setMoreOpen(false)} /><div className="mobile-more-sheet__panel"><div className="mobile-more-sheet__handle" /><div className="mobile-more-sheet__header"><h2>More</h2><button type="button" onClick={() => setMoreOpen(false)} aria-label="Close">×</button></div>{moreItems.map((item) => <Link key={item.label} href={item.href} onClick={() => setMoreOpen(false)} className="mobile-more-sheet__link"><span>{item.icon}</span>{item.label}</Link>)}</div></div> : null}

      <nav className="mobile-bottom-nav md:hidden" aria-label="Primary navigation">
        {primaryItems.map((item) => <Link key={item.label} href={item.href} className="mobile-bottom-nav__item"><span>{item.icon}</span><span>{item.label}</span></Link>)}
        <button type="button" className="mobile-bottom-nav__item" onClick={() => setMoreOpen(true)}><span>•••</span><span>More</span></button>
      </nav>
    </>
  );
}

export function MobileAppShell() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  const segments = pathname.split("/").filter(Boolean);
  const section = segments[0] ?? "dashboard";
  const detailLabel = segments[1]?.replaceAll("-", " ");
  const label = detailLabel
    ? detailLabel.replace(/\b\w/g, (character) => character.toUpperCase())
    : ({ dashboard: "Dashboard", technicians: "Technicians", cases: "Cases", interviews: "Interviews", "staffing-queue": "Staffing Queue", map: "Map" }[section] ?? "ABA Staffing");
  const backHref = detailLabel ? `/${section}` : undefined;

  return <MobileAppChrome title={label} backHref={backHref} />;
}
