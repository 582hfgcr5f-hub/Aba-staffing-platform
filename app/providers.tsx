"use client";

import { type ReactNode } from "react";
import { AuthProvider, RequireStaffAuth } from "@/app/components/auth-provider";
import { AtlasAppShell } from "@/app/components/atlas-app-shell";
import { MobileAppShell } from "@/app/components/mobile-app-chrome";
import { StaffingDatabaseProvider } from "@/app/data/staffing-store";

export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider><RequireStaffAuth><StaffingDatabaseProvider><MobileAppShell /><AtlasAppShell>{children}</AtlasAppShell></StaffingDatabaseProvider></RequireStaffAuth></AuthProvider>;
}