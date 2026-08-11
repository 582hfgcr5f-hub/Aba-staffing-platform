"use client";

import { useStaffingDatabase } from "./staffing-store";

export function useTechnicianDatabase() {
  const database = useStaffingDatabase();

  return {
    ...database,
    resetTechnicians: database.resetDatabase,
  };
}
