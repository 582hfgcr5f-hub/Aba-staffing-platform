"use client";

import { type ReactNode } from "react";
import { AuthProvider, RequireStaffAuth } from "@/app/components/auth-provider";
import { StaffingDatabaseProvider } from "@/app/data/staffing-store";

export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider><RequireStaffAuth><StaffingDatabaseProvider>{children}</StaffingDatabaseProvider></RequireStaffAuth></AuthProvider>;
}