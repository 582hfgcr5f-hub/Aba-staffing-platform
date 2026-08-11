import { type SupabaseClient } from "@supabase/supabase-js";
import { type EvaluationGrade, type InterviewEvent, type InterviewRecord, type InterviewStatus } from "@/app/data/interviews";
import { type Database, type InterviewInsert, type InterviewRow } from "@/app/data/supabase-types";
import { normalizeState } from "@/app/data/technicians-utils";

type SupabaseDbClient = SupabaseClient<Database>;
const RESUME_BUCKET = "interview-resumes";

function formatResumeStorageError(error: unknown, action: string) {
  void error;
  return `Resume ${action} could not be completed. Please try again.`;
}

function mapInterviewRow(row: InterviewRow): InterviewRecord {
  return {
    id: row.id,
    candidateName: row.candidate_name,
    phone: row.phone ?? "",
    email: row.email ?? "",
    city: row.city,
    state: normalizeState(row.state),
    zip: row.zip ?? "",
    scheduledAt: row.scheduled_at,
    status: row.status as InterviewStatus,
    experience: row.experience ?? "",
    desiredPay: row.desired_pay ?? "",
    employmentType: row.employment_type ?? "",
    availability: row.availability ?? "",
    availableDays: row.available_days ?? [],
    preferredStartTime: row.preferred_start_time ?? "",
    preferredEndTime: row.preferred_end_time ?? "",
    travelRadiusMinutes: row.travel_radius_minutes ?? undefined,
    centralReachExperience: row.centralreach_experience ?? "",
    preferredContact: row.preferred_contact ?? "",
    rating: row.rating ?? "",
    recruiterNotes: row.recruiter_notes ?? "",
    yearsAba: row.years_aba ?? undefined,
    yearsRbt: row.years_rbt ?? undefined,
    inHomeExperience: row.in_home_experience ?? undefined,
    clinicExperience: row.clinic_experience ?? undefined,
    severeBehaviorsExperience: row.severe_behaviors_experience ?? undefined,
    preferredAgeGroup: row.preferred_age_group ?? "",
    earliestStartDate: row.earliest_start_date ?? "",
    certifications: row.certifications ?? [],
    certificationOther: row.certification_other ?? "",
    skills: row.skills ?? [],
    skillOther: row.skill_other ?? "",
    communicationScore: row.communication_score ?? undefined,
    professionalismScore: row.professionalism_score ?? undefined,
    abaExperienceScore: row.aba_experience_score ?? undefined,
    scheduleFlexibilityScore: row.schedule_flexibility_score ?? undefined,
    overallRecommendationScore: row.overall_recommendation_score ?? undefined,
    communicationGrade: (row.communication_grade as EvaluationGrade | null) ?? undefined,
    professionalismGrade: (row.professionalism_grade as EvaluationGrade | null) ?? undefined,
    abaExperienceGrade: (row.aba_experience_grade as EvaluationGrade | null) ?? undefined,
    scheduleFlexibilityGrade: (row.schedule_flexibility_grade as EvaluationGrade | null) ?? undefined,
    overallRecommendationGrade: (row.overall_recommendation_grade as EvaluationGrade | null) ?? undefined,
    offerPay: row.offer_pay ?? "",
    offerNotes: row.offer_notes ?? "",
    offerDate: row.offer_date ?? "",
    interviewOutcome: (row.interview_outcome as InterviewRecord["interviewOutcome"]) ?? "",
    caseRecommendation: row.case_recommendation ?? "",
    caseRecommendationId: row.case_recommendation_id ?? undefined,
    resumePath: row.resume_path ?? "",
    resumeName: row.resume_name ?? "",
    resumeMimeType: row.resume_mime_type ?? "",
    backgroundCheckSubmitted: row.background_check_submitted,
    backgroundCleared: row.background_cleared,
    drugScreen: row.drug_screen,
    cprVerified: row.cpr_verified,
    rbtLicenseVerified: row.rbt_license_verified,
    technicianId: row.technician_id ?? undefined,
  };
}

function toInterviewInsert(interview: Omit<InterviewRecord, "id"> & { id?: string }): InterviewInsert {
  return {
    id: interview.id,
    candidate_name: interview.candidateName.trim(),
    phone: interview.phone.trim() || null,
    email: interview.email.trim().toLowerCase() || null,
    city: interview.city.trim(),
    state: normalizeState(interview.state),
    zip: interview.zip.trim() || null,
    scheduled_at: interview.scheduledAt,
    status: interview.status,
    experience: interview.experience.trim() || null,
    desired_pay: interview.desiredPay.trim() || null,
    employment_type: interview.employmentType.trim() || null,
    availability: interview.availability.trim() || null,
    available_days: interview.availableDays,
    preferred_start_time: interview.preferredStartTime.trim() || null,
    preferred_end_time: interview.preferredEndTime.trim() || null,
    travel_radius_minutes: interview.travelRadiusMinutes ?? null,
    centralreach_experience: interview.centralReachExperience.trim() || null,
    preferred_contact: interview.preferredContact.trim() || null,
    rating: interview.rating.trim() || null,
    recruiter_notes: interview.recruiterNotes.trim() || null,
    years_aba: interview.yearsAba ?? null,
    years_rbt: interview.yearsRbt ?? null,
    in_home_experience: interview.inHomeExperience ?? null,
    clinic_experience: interview.clinicExperience ?? null,
    severe_behaviors_experience: interview.severeBehaviorsExperience ?? null,
    preferred_age_group: interview.preferredAgeGroup.trim() || null,
    earliest_start_date: interview.earliestStartDate || null,
    certifications: interview.certifications,
    certification_other: interview.certificationOther.trim() || null,
    skills: interview.skills,
    skill_other: interview.skillOther.trim() || null,
    communication_score: interview.communicationScore ?? null,
    professionalism_score: interview.professionalismScore ?? null,
    aba_experience_score: interview.abaExperienceScore ?? null,
    schedule_flexibility_score: interview.scheduleFlexibilityScore ?? null,
    overall_recommendation_score: interview.overallRecommendationScore ?? null,
    communication_grade: interview.communicationGrade ?? null,
    professionalism_grade: interview.professionalismGrade ?? null,
    aba_experience_grade: interview.abaExperienceGrade ?? null,
    schedule_flexibility_grade: interview.scheduleFlexibilityGrade ?? null,
    overall_recommendation_grade: interview.overallRecommendationGrade ?? null,
    offer_pay: interview.offerPay.trim() || null,
    offer_notes: interview.offerNotes.trim() || null,
    offer_date: interview.offerDate || null,
    interview_outcome: interview.interviewOutcome || null,
    case_recommendation: interview.caseRecommendation.trim() || null,
    case_recommendation_id: interview.caseRecommendationId ?? null,
    resume_path: interview.resumePath || null,
    resume_name: interview.resumeName || null,
    resume_mime_type: interview.resumeMimeType || null,
    background_check_submitted: interview.backgroundCheckSubmitted,
    background_cleared: interview.backgroundCleared,
    drug_screen: interview.drugScreen,
    cpr_verified: interview.cprVerified,
    rbt_license_verified: interview.rbtLicenseVerified,
    technician_id: interview.technicianId ?? null,
  };
}

export async function fetchInterviews(client: SupabaseDbClient) {
  const { data, error } = await client.from("interviews").select("*").order("scheduled_at");
  if (error) throw error;
  return data.map(mapInterviewRow);
}

export async function fetchInterviewEvents(client: SupabaseDbClient, interviewId: string) {
  const { data, error } = await client.from("interview_events").select("*").eq("interview_id", interviewId).order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((event): InterviewEvent => ({
    id: event.id,
    interviewId: event.interview_id,
    eventType: event.event_type,
    detail: event.detail ?? "",
    createdAt: event.created_at,
  }));
}

export async function upsertInterviewRecord(client: SupabaseDbClient, interview: Omit<InterviewRecord, "id"> & { id?: string }) {
  const { data, error } = await client.from("interviews").upsert(toInterviewInsert(interview), { onConflict: "dedupe_key" }).select("*").single();
  if (error) throw error;
  return mapInterviewRow(data);
}

export async function updateInterviewStatus(client: SupabaseDbClient, interviewId: string, status: InterviewStatus, detail?: string) {
  const { error } = await client.from("interviews").update({ status }).eq("id", interviewId);
  if (error) throw error;
  const eventType = {
    Completed: "Interview completed",
    "Follow Up": "Follow up",
    Offer: "Offer made",
    Hired: "Hired",
    Declined: "Declined",
    "No Show": "No Show",
    Scheduled: "Interview scheduled",
  }[status];
  await logInterviewEvent(client, interviewId, eventType, detail ?? `Status changed to ${status}.`);
}

export async function linkInterviewTechnician(client: SupabaseDbClient, interviewId: string, technicianId: string) {
  const { error } = await client.from("interviews").update({ status: "Hired", technician_id: technicianId }).eq("id", interviewId);
  if (error) throw error;
  await logInterviewEvent(client, interviewId, "Hired", "Candidate converted to a technician record.");
}

export async function logInterviewEvent(client: SupabaseDbClient, interviewId: string, eventType: string, detail?: string) {
  const { error } = await client.from("interview_events").insert({ interview_id: interviewId, event_type: eventType, detail: detail ?? null });
  if (error) throw error;
}

export async function uploadInterviewResume(client: SupabaseDbClient, interviewId: string, file: File) {
  validateInterviewResumeFile(file);

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${interviewId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await client.storage.from(RESUME_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw new Error(formatResumeStorageError(error, "upload"));
  return { path, name: file.name, mimeType: file.type };
}

export function validateInterviewResumeFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowedExtensions = ["pdf", "doc", "docx", "rtf", "txt"];
  if (!allowedExtensions.includes(extension)) throw new Error("Upload a PDF, DOC, DOCX, RTF, or TXT resume.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Resume files must be 10 MB or smaller.");
}

export async function deleteInterviewResume(client: SupabaseDbClient, path: string) {
  if (!path) return;
  const { error } = await client.storage.from(RESUME_BUCKET).remove([path]);
  if (error) throw new Error(formatResumeStorageError(error, "removal"));
}

export async function getInterviewResumeUrl(client: SupabaseDbClient, path: string) {
  const { data, error } = await client.storage.from(RESUME_BUCKET).createSignedUrl(path, 60 * 10);
  if (error || !data?.signedUrl) throw new Error(formatResumeStorageError(error, "view"));
  return data.signedUrl;
}