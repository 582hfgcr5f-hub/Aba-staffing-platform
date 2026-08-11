"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function createListReturnHref(listPath: string, values: Record<string, string>) {
  const params = new URLSearchParams(values);
  if (typeof window !== "undefined") params.set("scroll", String(window.scrollY));
  const query = params.toString();
  return query ? `${listPath}?${query}` : listPath;
}

export function createDetailHref(detailPath: string, listHref: string) {
  return `${detailPath}?returnTo=${encodeURIComponent(listHref)}`;
}

export function getListNavigationParams() {
  return typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
}

export function restoreListScroll(params: URLSearchParams) {
  const scroll = Number(params.get("scroll"));
  if (Number.isFinite(scroll) && scroll > 0) window.setTimeout(() => window.scrollTo(0, scroll), 0);
}

export function DetailNavigation({ listHref, listLabel, currentLabel, badge }: { listHref: string; listLabel: string; currentLabel: string; badge?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnHref = searchParams.get("returnTo") ?? listHref;
  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(returnHref, { scroll: false });
  };

  return <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><button type="button" onClick={goBack} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">← Back to {listLabel}</button><nav aria-label="Breadcrumb" className="mt-3 flex flex-wrap items-center gap-2 text-sm"><button type="button" onClick={goBack} className="font-medium text-blue-700 hover:text-blue-800">{listLabel}</button><span className="text-slate-400">›</span><button type="button" onClick={goBack} className="font-semibold text-slate-700 hover:text-blue-700">{currentLabel}</button></nav></div>{badge ? <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">{badge}</span> : null}</div>;
}