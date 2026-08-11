import { type SupabaseClient } from "@supabase/supabase-js";

const TECHNICIAN_FILES_BUCKET = "technician-files";

export type OperationalNote = { id: string; note: string; caseId?: string; createdAt: string };
export type OperationalActivity = { id: string; eventType: string; detail: string; createdAt: string; caseId?: string; technicianId?: string };
export type DashboardActivity = OperationalActivity & { source: "operational" | "interview" | "assignment"; interviewId?: string };

function message(error: unknown, action: string) {
  void error;
  return `${action} could not be completed. Please try again.`;
}

export async function fetchOperationalNotes(client: SupabaseClient, subject: "technician" | "case", id: string) {
  const table = subject === "technician" ? "technician_notes" : "case_notes";
  const column = subject === "technician" ? "technician_id" : "case_id";
  const { data, error } = await client.from(table).select("*").eq(column, id).order("created_at", { ascending: false });
  if (error) throw new Error(message(error, "Notes"));
  return (data ?? []).map((item: { id: string; note: string; case_id?: string | null; created_at: string }): OperationalNote => ({ id: item.id, note: item.note, caseId: item.case_id ?? undefined, createdAt: item.created_at }));
}

export async function addOperationalNote(client: SupabaseClient, subject: "technician" | "case", id: string, note: string, caseId?: string) {
  const result = subject === "technician"
    ? await client.from("technician_notes").insert({ technician_id: id, note, case_id: caseId ?? null })
    : await client.from("case_notes").insert({ case_id: id, note });
  const { error } = result;
  if (error) throw new Error(message(error, "Saving note"));
}

export async function deleteOperationalNote(client: SupabaseClient, subject: "technician" | "case", noteId: string) {
  const table = subject === "technician" ? "technician_notes" : "case_notes";
  const { error } = await client.from(table).delete().eq("id", noteId);
  if (error) throw new Error(message(error, "Deleting note"));
}

export async function fetchOperationalActivity(client: SupabaseClient, subject: "technician" | "case", id: string) {
  const column = subject === "technician" ? "technician_id" : "case_id";
  const { data, error } = await client.from("operational_activity").select("*").eq(column, id).order("created_at", { ascending: false });
  if (error) throw new Error(message(error, "Activity history"));
  return (data ?? []).map((item: { id: string; event_type: string; detail?: string | null; created_at: string; case_id?: string | null; technician_id?: string | null }): OperationalActivity => ({ id: item.id, eventType: item.event_type, detail: item.detail ?? "", createdAt: item.created_at, caseId: item.case_id ?? undefined, technicianId: item.technician_id ?? undefined }));
}

export async function fetchDashboardActivity(client: SupabaseClient) {
  const [operationalResult, interviewResult, assignmentResult] = await Promise.all([
    client.from("operational_activity").select("*").order("created_at", { ascending: false }).limit(20),
    client.from("interview_events").select("*").order("created_at", { ascending: false }).limit(20),
    client.from("assignments").select("*").order("assigned_at", { ascending: false }).limit(20),
  ]);

  if (operationalResult.error || interviewResult.error || assignmentResult.error) {
    throw new Error("Recent activity could not be loaded.");
  }

  const operational = (operationalResult.data ?? []).map((item: { id: string; event_type: string; detail?: string | null; created_at: string; case_id?: string | null; technician_id?: string | null }): DashboardActivity => ({
    id: `operational-${item.id}`,
    source: "operational",
    eventType: item.event_type,
    detail: item.detail ?? "",
    createdAt: item.created_at,
    caseId: item.case_id ?? undefined,
    technicianId: item.technician_id ?? undefined,
  }));
  const interviews = (interviewResult.data ?? []).map((item: { id: string; interview_id: string; event_type: string; detail?: string | null; created_at: string }): DashboardActivity => ({
    id: `interview-${item.id}`,
    source: "interview",
    eventType: item.event_type,
    detail: item.detail ?? "",
    createdAt: item.created_at,
    interviewId: item.interview_id,
  }));
  const assignments = (assignmentResult.data ?? []).flatMap((item: { id: string; technician_id: string; case_id: string; assigned_at: string; started_at?: string | null; unassigned_at?: string | null }) => {
    const events: DashboardActivity[] = [{ id: `assignment-${item.id}`, source: "assignment", eventType: "Technician assigned", detail: "Technician assigned to case.", createdAt: item.assigned_at, technicianId: item.technician_id, caseId: item.case_id }];
    if (item.started_at) events.push({ id: `assignment-started-${item.id}`, source: "assignment", eventType: "Case started", detail: "Case service started.", createdAt: item.started_at, technicianId: item.technician_id, caseId: item.case_id });
    if (item.unassigned_at) events.push({ id: `assignment-unassigned-${item.id}`, source: "assignment", eventType: "Technician unassigned", detail: "Technician removed from case.", createdAt: item.unassigned_at, technicianId: item.technician_id, caseId: item.case_id });
    return events;
  });

  return [...operational, ...interviews, ...assignments].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)).slice(0, 12);
}

export async function logOperationalActivity(client: SupabaseClient, input: { technicianId?: string; caseId?: string; eventType: string; detail?: string }) {
  const { error } = await client.from("operational_activity").insert({ technician_id: input.technicianId ?? null, case_id: input.caseId ?? null, event_type: input.eventType, detail: input.detail ?? null });
  if (error) throw new Error(message(error, "Activity logging"));
}

export async function uploadTechnicianFile(client: SupabaseClient, technicianId: string, file: File, category: string) {
  if (file.size > 10 * 1024 * 1024) throw new Error("Documents must be 10 MB or smaller.");
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!extension) throw new Error("Choose a file with an extension.");
  const path = `${technicianId}/${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const { error } = await client.storage.from(TECHNICIAN_FILES_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw new Error(message(error, "Document upload"));
  return { path, name: file.name, type: category, updated: new Date().toISOString() };
}

export async function getTechnicianFileUrl(client: SupabaseClient, path: string) {
  const { data, error } = await client.storage.from(TECHNICIAN_FILES_BUCKET).createSignedUrl(path, 600);
  if (error || !data?.signedUrl) throw new Error(message(error, "Opening document"));
  return data.signedUrl;
}

export async function deleteTechnicianFile(client: SupabaseClient, path: string) {
  const { error } = await client.storage.from(TECHNICIAN_FILES_BUCKET).remove([path]);
  if (error) throw new Error(message(error, "Document removal"));
}