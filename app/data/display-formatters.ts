import { formatDaysSummary, formatMinutesToTimeLabel, parseRequiredTimeToMinutes } from "@/app/data/smart-match-engine";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "2-digit",
  day: "2-digit",
  year: "numeric",
});

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  month: "2-digit",
  day: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function asDate(value?: string | null) {
  if (!value) return null;
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatUsDate(value?: string | null, empty = "Not provided") {
  const date = asDate(value);
  return date ? dateFormatter.format(date) : empty;
}

export function formatUsDateTime(value?: string | null, empty = "Not provided") {
  const date = asDate(value);
  if (!date) return empty;
  const parts = timestampFormatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("month")}/${part("day")}/${part("year")} at ${part("hour")}:${part("minute")} ${part("dayPeriod")}`;
}

export function formatTime(value?: string | null, empty = "Not provided") {
  if (!value) return empty;
  const minutes = parseRequiredTimeToMinutes(value);
  return minutes === null ? value : formatMinutesToTimeLabel(minutes);
}

export function formatTimeRange(start?: string | null, end?: string | null, empty = "Not provided") {
  if (!start || !end) return empty;
  return `${formatTime(start)}–${formatTime(end)}`;
}

export function formatScheduleText(value?: string | null, empty = "Not provided") {
  if (!value) return empty;
  return value.replace(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/g, (_match, start: string, end: string) => formatTimeRange(start, end));
}

export function formatWeeklyAvailability(days?: string[], start?: string | null, end?: string | null) {
  if (!days?.length) return "Not provided";
  return `${formatDaysSummary(days as Parameters<typeof formatDaysSummary>[0])}\n${formatTimeRange(start, end)}`;
}