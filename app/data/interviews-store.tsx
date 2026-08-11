"use client";

import { useCallback, useEffect, useState } from "react";
import { type InterviewRecord, type InterviewStatus } from "@/app/data/interviews";
import { fetchInterviewEvents, fetchInterviews, logInterviewEvent, updateInterviewStatus, upsertInterviewRecord } from "@/app/data/interviews-adapter";
import { getSupabaseBrowserClient, getSupabaseConfigError } from "@/app/lib/supabase/client";

function formatInterviewLoadError(error: unknown) {
  void error;
  return "Interviews could not be loaded. Please try again.";
}

export function useInterviews() {
  const [interviews, setInterviews] = useState<InterviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshInterviews = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setErrorMessage(getSupabaseConfigError() ?? "Supabase client is unavailable.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setInterviews(await fetchInterviews(client));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(formatInterviewLoadError(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshInterviews(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshInterviews]);

  const saveInterview = useCallback(async (input: Omit<InterviewRecord, "id"> & { id?: string }) => {
    const client = getSupabaseBrowserClient();
    if (!client) return { ok: false, message: getSupabaseConfigError() ?? "Supabase client is unavailable." } as const;
    try {
      const saved = await upsertInterviewRecord(client, input);
      await logInterviewEvent(client, saved.id, input.id ? "Updated" : "Created", input.id ? "Interview details updated." : "Interview created.");
      await refreshInterviews();
      return { ok: true, interview: saved } as const;
    } catch {
      return { ok: false, message: "Unable to save the interview. Please try again." } as const;
    }
  }, [refreshInterviews]);

  const setInterviewStatus = useCallback(async (interviewId: string, status: InterviewStatus, detail?: string) => {
    const client = getSupabaseBrowserClient();
    if (!client) return { ok: false, message: getSupabaseConfigError() ?? "Supabase client is unavailable." } as const;
    try {
      await updateInterviewStatus(client, interviewId, status, detail);
      await refreshInterviews();
      return { ok: true } as const;
    } catch {
      return { ok: false, message: "Unable to update the interview. Please try again." } as const;
    }
  }, [refreshInterviews]);

  const getInterviewEvents = useCallback(async (interviewId: string) => {
    const client = getSupabaseBrowserClient();
    if (!client) return [];
    return fetchInterviewEvents(client, interviewId);
  }, []);

  return { interviews, loading, errorMessage, refreshInterviews, saveInterview, setInterviewStatus, getInterviewEvents };
}