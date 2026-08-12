"use client";

import { APIProvider, InfoWindow, Map, Marker } from "@vis.gl/react-google-maps";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { DatabaseState } from "@/app/components/database-state";
import { formatScheduleText, formatUsDate } from "@/app/data/display-formatters";
import { DAY_ORDER, formatRequiredScheduleSummary, normalizeRequiredCaseWindow } from "@/app/data/smart-match-engine";
import { useTechnicianDatabase } from "@/app/data/technicians-store";
import { createTechnicianSlug, downloadTechniciansCsv, getTechnicianClientCount, normalizeState } from "@/app/data/technicians-utils";
import { type CaseProfile, type ReadinessStatus, type RouteInfo, type SharedMatchResult } from "@/app/data/staffing-types";
import { type TechnicianProfile } from "@/app/data/technicians";
import { buildServiceLocationAddress, geocodeServiceLocation } from "@/app/data/geocoding";

const navItems = [
  { label: "Dashboard", icon: "▣", href: "/" },
  { label: "Staffing Queue", icon: "✓", href: "/staffing-queue" },
  { label: "Technicians", icon: "👥", href: "/technicians" },
  { label: "Cases", icon: "📋", href: "/cases" },
  { label: "Interviews", icon: "🗓️", href: "/interviews" },
  { label: "Map", icon: "🗺️", href: "/map", active: true },
  { label: "Reports", icon: "📈", href: "#" },
  { label: "Settings", icon: "⚙️", href: "#" },
];

type LocationItem = {
  id: string;
  name: string;
  city: string;
  state: string;
  kind: "Technician" | "Client" | "Location";
  status: string;
  lat: number;
  lng: number;
  markerColor: string;
};

type LocationSearchResult = {
  id: string;
  placeId: string;
  primaryText: string;
  secondaryText: string;
};

type GoogleMapsAuthFailureWindow = Window & {
  gm_authFailure?: () => void;
};

const mapCenter = { lat: 35.1107, lng: -106.61 };
function getPinIcon(color: string) {
  const safeColor = color.replace("#", "");
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48"><path fill="#${safeColor}" d="M18 0C8.1 0 0 8.1 0 18c0 12.6 18 30 18 30s18-17.4 18-30C36 8.1 27.9 0 18 0z"/><circle cx="18" cy="18" r="9" fill="white"/></svg>`)}`;
}

function getHighlightedPinIcon(color: string) {
  const safeColor = color.replace("#", "");
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="44" height="56" viewBox="0 0 44 56"><circle cx="22" cy="20" r="15" fill="rgba(59,130,246,0.25)"/><path fill="#${safeColor}" d="M22 4C13.2 4 6 11.2 6 20c0 11.2 16 27 16 27s16-15.8 16-27C38 11.2 30.8 4 22 4z"/><circle cx="22" cy="20" r="8" fill="white"/></svg>`)}`;
}

function normalizeSearchValue(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function extractAddressField(parts: Array<{ longText?: string; shortText?: string; types?: string[] }>, key: string) {
  const found = parts.find((part) => part.types?.includes(key));
  return found?.shortText || found?.longText || "";
}

function parseAddressParts(parts: Array<{ longText?: string; shortText?: string; types?: string[] }>) {
  const city = extractAddressField(parts, "locality") || extractAddressField(parts, "postal_town");
  const state = extractAddressField(parts, "administrative_area_level_1");
  const zip = extractAddressField(parts, "postal_code");
  const zipSuffix = extractAddressField(parts, "postal_code_suffix");

  return {
    city,
    state,
    zip: zip && zipSuffix ? `${zip}-${zipSuffix}` : zip,
  };
}

function getStatusTone(status: string) {
  if (status === "Ready to Assign") return "bg-emerald-50 text-emerald-700";
  if (status === "Travel Needs Confirmation") return "bg-amber-50 text-amber-700";
  if (status === "Needs Availability Confirmation") return "bg-amber-50 text-amber-700";
  if (status === "Different State") return "bg-rose-50 text-rose-700";
  if (status === "Outside Travel Radius") return "bg-rose-50 text-rose-700";
  if (status === "Schedule Conflict") return "bg-rose-50 text-rose-700";
  if (status === "Active") return "bg-emerald-50 text-emerald-700";
  if (status === "Assigned") return "bg-amber-50 text-amber-700";
  if (status === "Interview") return "bg-sky-50 text-sky-700";
  return "bg-blue-50 text-blue-700";
}

function caseScheduleLabel(caseItem: CaseProfile) {
  const normalized = normalizeRequiredCaseWindow(caseItem.requiredStartTime, caseItem.requiredEndTime);
  if (!normalized || normalized.isAmbiguous) return formatScheduleText(caseItem.requiredScheduleText, "Needs schedule confirmation");
  return formatRequiredScheduleSummary({
    days: caseItem.requiredDays,
    startMinutes: normalized.startMinutes,
    endMinutes: normalized.endMinutes,
  });
}

function createCaseOutlookEmail(match: SharedMatchResult) {
  const subject = `New ABA Case Assignment - ${match.caseItem.name}`;
  const lines = [
    `Technician: ${match.technician.name}`,
    `Client: ${match.caseItem.name}`,
    `Location: ${match.caseItem.address || `${match.caseItem.city}, ${match.caseItem.state}`}`,
    `Days: ${match.caseItem.requiredDays.join(", ")}`,
    `Hours: ${caseScheduleLabel(match.caseItem)}`,
    `Start Date: ${formatUsDate(match.caseItem.startDate, "TBD")}`,
    `BCBA: ${match.caseItem.bcba || "TBD"}`,
    `Drive Time: ${match.driveTimeMinutes ?? "Unknown"} minutes`,
    `Notes: ${match.caseItem.notes || ""}`,
  ];
  return `mailto:${encodeURIComponent(match.technician.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}

function isActiveCaseStatus(status: CaseProfile["status"]) {
  return status === "Active" || status === "Active Client";
}

function isAssignedCaseStatus(status: CaseProfile["status"]) {
  return status === "Assigned" || status === "Assigned Client";
}

function isOpenCaseStatus(status: CaseProfile["status"]) {
  return status === "Open" || status === "Open Client";
}

function isAvailableTechnicianStatus(status: string) {
  return status === "Available";
}

function isAssignedTechnicianStatus(status: string) {
  return status === "Assigned";
}

function isActiveTechnicianStatus(status: string) {
  return status === "Active";
}

function isInterviewTechnicianStatus(status: string) {
  return status === "Interview";
}

function buildCaseLocation(caseItem: CaseProfile): LocationItem | null {
  if (typeof caseItem.latitude !== "number" || typeof caseItem.longitude !== "number") return null;
  const markerColor = isActiveCaseStatus(caseItem.status)
    ? "#a855f7"
    : isAssignedCaseStatus(caseItem.status)
      ? "#f59e0b"
      : "#ef4444";

  return {
    id: caseItem.id,
    name: caseItem.name,
    city: caseItem.city,
    state: caseItem.state,
    kind: "Client",
    status: caseItem.status,
    lat: caseItem.latitude,
    lng: caseItem.longitude,
    markerColor,
  };
}

function buildTechnicianLocation(technician: TechnicianProfile): LocationItem | null {
  if (typeof technician.latitude !== "number" || typeof technician.longitude !== "number") return null;
  const markerColor =
    technician.status === "Active" ? "#10b981" : technician.status === "Assigned" ? "#f59e0b" : technician.status === "Interview" ? "#2563eb" : "#3b82f6";

  return {
    id: technician.id,
    name: technician.name,
    city: technician.city,
    state: technician.state,
    kind: "Technician",
    status: technician.status,
    lat: technician.latitude,
    lng: technician.longitude,
    markerColor,
  };
}

type RouteMatrixElement = {
  destinationIndex?: number;
  condition?: string;
  duration?: string;
  distanceMeters?: number;
};

function parseRouteMatrixResponse(payload: string): RouteMatrixElement[] {
  try {
    const parsed = JSON.parse(payload) as RouteMatrixElement[] | RouteMatrixElement;
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return payload
      .split("\n")
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as RouteMatrixElement];
        } catch {
          return [];
        }
      });
  }
}

function RouteMatrixPrefetcher({
  apiKey,
  caseItem,
  technicians,
  cacheRouteInfo,
  isRouteCached,
  onDiagnostic,
}: {
  apiKey: string;
  caseItem: CaseProfile | null;
  technicians: TechnicianProfile[];
  cacheRouteInfo: (technician: TechnicianProfile, caseItem: CaseProfile, route: RouteInfo) => void;
  isRouteCached: (technician: TechnicianProfile, caseItem: CaseProfile) => boolean;
  onDiagnostic: (message: string) => void;
}) {
  useEffect(() => {
    if (!caseItem || typeof caseItem.latitude !== "number" || typeof caseItem.longitude !== "number") return;
    const candidates = technicians.filter((technician) =>
      normalizeState(technician.state) === normalizeState(caseItem.state) &&
      typeof technician.latitude === "number" &&
      typeof technician.longitude === "number" &&
      !isRouteCached(technician, caseItem)
    );
    if (candidates.length === 0) return;

    let cancelled = false;
    const calculateRoutes = async () => {
      try {
        const response = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "originIndex,destinationIndex,condition,duration,distanceMeters",
          },
          body: JSON.stringify({
            origins: [{ waypoint: { location: { latLng: { latitude: caseItem.latitude, longitude: caseItem.longitude } } } }],
            destinations: candidates.map((technician) => ({ waypoint: { location: { latLng: { latitude: technician.latitude, longitude: technician.longitude } } } })),
            travelMode: "DRIVE",
          }),
        });
        const body = await response.text();
        if (!response.ok) throw new Error(`Google Routes request failed (${response.status}).`);
        const elements = parseRouteMatrixResponse(body);
        const routes = new globalThis.Map(elements.map((element) => [element.destinationIndex, element]));
        if (cancelled) return;
        candidates.forEach((technician, index) => {
          const element = routes.get(index);
          const durationSeconds = element?.duration ? Number.parseFloat(element.duration) : NaN;
          if (element?.condition === "ROUTE_EXISTS" && Number.isFinite(durationSeconds) && typeof element.distanceMeters === "number") {
            cacheRouteInfo(technician, caseItem, {
              driveTimeMinutes: Math.max(1, Math.round(durationSeconds / 60)),
              driveDistanceMiles: Number((element.distanceMeters / 1609.344).toFixed(1)),
              routeStatus: "ok",
            });
            return;
          }
          cacheRouteInfo(technician, caseItem, { driveTimeMinutes: null, driveDistanceMiles: null, routeStatus: "route-failed" });
        });
      } catch {
        if (cancelled) return;
        candidates.forEach((technician) => cacheRouteInfo(technician, caseItem, { driveTimeMinutes: null, driveDistanceMiles: null, routeStatus: "route-failed" }));
        onDiagnostic("Route estimates are temporarily unavailable.");
      }
    };
    void calculateRoutes();
    return () => { cancelled = true; };
  }, [apiKey, cacheRouteInfo, caseItem, isRouteCached, onDiagnostic, technicians]);

  return null;
}

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 text-slate-800">
          <div className="p-8 text-sm text-slate-500">Loading map...</div>
        </div>
      }
    >
      <MapPageContent />
    </Suspense>
  );
}

function MapPageContent() {
  const {
    technicians,
    cases,
    assignments,
    findMatchingTechnicians,
    findMatchingCases,
    createDraftCase,
    assignCase,
    upsertCase,
    upsertTechnician,
    cacheRouteInfo,
    isRouteCached,
    loading,
    errorMessage,
    refreshDatabase,
  } = useTechnicianDatabase();

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const [selectedState, setSelectedState] = useState("All");
  const [selectedType, setSelectedType] = useState("none");
  const [selectedLocation, setSelectedLocation] = useState<LocationItem | null>(null);
  const [mapViewport, setMapViewport] = useState(mapCenter);
  const [mapZoom, setMapZoom] = useState(6);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [locationSearchResults, setLocationSearchResults] = useState<LocationSearchResult[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [focusedTechnicianId, setFocusedTechnicianId] = useState("");
  const [potentialLocation, setPotentialLocation] = useState<LocationItem | null>(null);
  const [clientName, setClientName] = useState("");
  const [caseAddress, setCaseAddress] = useState("");
  const [caseZip, setCaseZip] = useState("");
  const [requiredStartTime, setRequiredStartTime] = useState("");
  const [requiredEndTime, setRequiredEndTime] = useState("");
  const [requiredDays, setRequiredDays] = useState<string[]>([]);
  const [caseState, setCaseState] = useState("");
  const [caseCity, setCaseCity] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [pendingMatch, setPendingMatch] = useState<SharedMatchResult | null>(null);
  const [assignmentMessage, setAssignmentMessage] = useState("");
  const [locationConfirmationTarget, setLocationConfirmationTarget] = useState<{ kind: "Technician" | "Client"; id: string } | null>(null);
  const [mapDiagnostic, setMapDiagnostic] = useState("");

  const searchParams = useSearchParams();
  const focusSlug = searchParams.get("focus") ?? "";
  const matchSlug = searchParams.get("match") ?? "";

  const requiredWindow = useMemo(() => normalizeRequiredCaseWindow(requiredStartTime, requiredEndTime), [requiredStartTime, requiredEndTime]);

  useEffect(() => {
    const mapsWindow = window as GoogleMapsAuthFailureWindow;
    const previousAuthFailureHandler = mapsWindow.gm_authFailure;

    mapsWindow.gm_authFailure = () => {
      window.setTimeout(() => {
        setMapDiagnostic("The map is temporarily unavailable. You can continue managing staffing records.");
      }, 0);
    };

    return () => {
      if (previousAuthFailureHandler) {
        mapsWindow.gm_authFailure = previousAuthFailureHandler;
      } else {
        delete mapsWindow.gm_authFailure;
      }
    };
  }, []);

  const technicianLocations = useMemo(
    () => technicians.map((tech) => buildTechnicianLocation(tech)).filter(Boolean) as LocationItem[],
    [technicians]
  );

  const caseLocations = useMemo(() => cases.map(buildCaseLocation).filter(Boolean) as LocationItem[], [cases]);
  const missingCoordinateCount = useMemo(
    () => technicians.filter((item) => item.latitude === undefined || item.longitude === undefined).length + cases.filter((item) => item.latitude === undefined || item.longitude === undefined).length,
    [cases, technicians]
  );

  const locations = useMemo(() => {
    return potentialLocation
      ? [...technicianLocations, ...caseLocations, potentialLocation]
      : [...technicianLocations, ...caseLocations];
  }, [caseLocations, potentialLocation, technicianLocations]);

  const filteredLocations = useMemo(() => {
    return locations.filter((location) => {
      const normalizedLocationState = normalizeState(location.state);
      const normalizedSelectedState = selectedState === "All" ? "All" : normalizeState(selectedState);
      const matchesState = normalizedSelectedState === "All" || normalizedLocationState === normalizedSelectedState;
      const matchesType =
        selectedType === "none" ? location.kind === "Location" :
        selectedType === "All" ||
        (selectedType === "available-technicians" && location.kind === "Technician" && location.status === "Available") ||
        (selectedType === "active-technicians" && location.kind === "Technician" && location.status === "Active") ||
        (selectedType === "assigned-technicians" && location.kind === "Technician" && location.status === "Assigned") ||
        (selectedType === "interview-technicians" && location.kind === "Technician" && location.status === "Interview") ||
        (selectedType === "open-clients" && location.kind === "Client" && isOpenCaseStatus(location.status as CaseProfile["status"])) ||
        (selectedType === "active-clients" && location.kind === "Client" && isActiveCaseStatus(location.status as CaseProfile["status"])) ||
        location.kind === "Location";

      return matchesState && matchesType;
    });
  }, [locations, selectedState, selectedType]);

  const focusedTechnicianFromQuery = useMemo(() => {
    const incoming = decodeURIComponent(focusSlug || matchSlug);
    return technicians.find((tech) => createTechnicianSlug(tech.name) === incoming || tech.id === incoming) ?? null;
  }, [focusSlug, matchSlug, technicians]);

  const focusedTechnician = useMemo(() => {
    if (focusedTechnicianId) {
      return technicians.find((tech) => tech.id === focusedTechnicianId) ?? null;
    }
    return focusedTechnicianFromQuery;
  }, [focusedTechnicianFromQuery, focusedTechnicianId, technicians]);

  const queryFocusedLocation = useMemo(() => {
    if (!focusedTechnicianFromQuery) return null;
    return technicianLocations.find((item) => item.id === focusedTechnicianFromQuery.id) ?? null;
  }, [focusedTechnicianFromQuery, technicianLocations]);

  const selectedCase = useMemo(() => cases.find((item) => item.id === selectedCaseId) ?? null, [cases, selectedCaseId]);
  const searchMode = locationConfirmationTarget ? "all" : focusedTechnician ? "case-for-technician" : selectedCase ? "technician-for-case" : "all";
  const searchPlaceholder =
    searchMode === "case-for-technician"
      ? `Search cases for ${focusedTechnician?.name}...`
      : searchMode === "technician-for-case"
        ? `Search technicians for ${selectedCase?.name}...`
        : "Search technician, client, case, or location…";

  const normalizedSearchTerm = useMemo(() => normalizeSearchValue(searchTerm), [searchTerm]);

  const technicianSearchResults = useMemo(() => {
    if (!normalizedSearchTerm) return [] as TechnicianProfile[];
    return technicians
      .filter((tech) => tech.name.toLowerCase().includes(normalizedSearchTerm))
      .slice(0, 6);
  }, [normalizedSearchTerm, technicians]);

  const caseSearchResults = useMemo(() => {
    if (!normalizedSearchTerm) return [] as CaseProfile[];
    return cases
      .filter((caseItem) => caseItem.name.toLowerCase().includes(normalizedSearchTerm))
      .slice(0, 6);
  }, [cases, normalizedSearchTerm]);

  const filteredTechniciansForPanel = useMemo(() => {
    const normalizedSelectedState = selectedState === "All" ? "All" : normalizeState(selectedState);
    return technicians.filter((tech) => {
      const matchesState = normalizedSelectedState === "All" || normalizeState(tech.state) === normalizedSelectedState;
      if (!matchesState) return false;

      if (selectedType === "none") return false;
      if (selectedType === "All") return true;
      if (selectedType === "available-technicians") return isAvailableTechnicianStatus(tech.status);
      if (selectedType === "active-technicians") return isActiveTechnicianStatus(tech.status);
      if (selectedType === "assigned-technicians") return isAssignedTechnicianStatus(tech.status);
      if (selectedType === "interview-technicians") return isInterviewTechnicianStatus(tech.status);

      return false;
    });
  }, [selectedState, selectedType, technicians]);

  const filteredCasesForPanel = useMemo(() => {
    const normalizedSelectedState = selectedState === "All" ? "All" : normalizeState(selectedState);
    return cases.filter((caseItem) => {
      const matchesState = normalizedSelectedState === "All" || normalizeState(caseItem.state) === normalizedSelectedState;
      if (!matchesState) return false;

      if (selectedType === "none") return false;
      if (selectedType === "All") return true;
      if (selectedType === "open-clients") return isOpenCaseStatus(caseItem.status);
      if (selectedType === "active-clients") return isActiveCaseStatus(caseItem.status);

      return false;
    });
  }, [cases, selectedState, selectedType]);

  const caseMatches = selectedCase ? findMatchingTechnicians(selectedCase.id) : [] as SharedMatchResult[];

  const draftMatches = useMemo(() => {
    if (!requiredWindow || requiredDays.length === 0 || !caseState.trim()) return [] as SharedMatchResult[];
    const created = createDraftCase({
      name: clientName || "Potential Case",
      city: caseCity || "Unknown",
      state: caseState,
      requiredDays: requiredDays as never[],
      requiredStartTime,
      requiredEndTime,
      zip: caseZip || undefined,
      address: caseAddress || undefined,
      urgency: "Medium",
    });
    return created.matches;
  }, [caseAddress, caseCity, caseState, caseZip, clientName, createDraftCase, requiredDays, requiredEndTime, requiredStartTime, requiredWindow]);

  const activeMatchList = selectedCase ? caseMatches : draftMatches;

  const summaryItems = [
    { label: "Technicians", value: technicians.length },
    { label: "Open Cases", value: cases.filter((item) => isOpenCaseStatus(item.status)).length },
    { label: "Assigned Relationships", value: assignments.filter((item) => item.status !== "Unassigned").length },
    {
      label: "Ready to Assign",
      value: activeMatchList.filter((match) => match.readinessStatus === "Ready to Assign").length,
    },
  ];

  const caseWindowReady = Boolean(requiredWindow && requiredDays.length > 0 && caseState.trim());
  const canSearchLocations = searchMode === "all" && searchTerm.trim().length >= 2;
  const visibleLocationResults = canSearchLocations ? locationSearchResults : [];

  const searchHasResults = technicianSearchResults.length > 0 || caseSearchResults.length > 0 || visibleLocationResults.length > 0;
  const activeCenteredLocation = selectedLocation ?? queryFocusedLocation;

  const focusLocationOnMap = (location: LocationItem, zoom = 10) => {
    setSelectedLocation(location);
    setMapViewport({ lat: location.lat, lng: location.lng });
    setMapZoom(zoom);
  };

  const clearSelectionContext = () => {
    setFocusedTechnicianId("");
    setSelectedCaseId("");
    setSelectedLocation(null);
    setPotentialLocation(null);
    setPendingMatch(null);
    setAssignmentMessage("");
    setSearchTerm("");
    setIsSearchOpen(false);
  };

  const handleRunTechnicianToCase = (caseItem: CaseProfile) => {
    if (!focusedTechnician) return;
    const location = caseLocations.find((item) => item.id === caseItem.id);
    if (location) {
      focusLocationOnMap(location, 10);
    }

    const match = findMatchingCases(focusedTechnician.id).find((item) => item.caseItem.id === caseItem.id);
    if (match && match.readinessStatus === "Ready to Assign") {
      setPendingMatch(match);
    }
    setAssignmentMessage("");
    setSearchTerm(caseItem.name);
    setIsSearchOpen(false);
  };

  const handleRunCaseToTechnician = (technician: TechnicianProfile) => {
    if (!selectedCase) return;
    const location = technicianLocations.find((item) => item.id === technician.id);
    if (location) {
      focusLocationOnMap(location, 10);
    }

    const match = findMatchingTechnicians(selectedCase.id).find((item) => item.technician.id === technician.id);
    if (match && match.readinessStatus === "Ready to Assign") {
      setPendingMatch(match);
    }
    setAssignmentMessage("");
    setSearchTerm(technician.name);
    setIsSearchOpen(false);
  };

  const handleSelectTechnician = (technician: TechnicianProfile) => {
    setFocusedTechnicianId(technician.id);
    setSelectedCaseId("");
    setPendingMatch(null);
    setAssignmentMessage("");
    setPotentialLocation(null);
    setSearchTerm(technician.name);
    setIsSearchOpen(false);

    const location = technicianLocations.find((item) => item.id === technician.id);
    if (location) {
      focusLocationOnMap(location, 10);
    }
  };

  const handleSelectCase = (caseItem: CaseProfile) => {
    setFocusedTechnicianId("");
    setSelectedCaseId(caseItem.id);
    setPendingMatch(null);
    setAssignmentMessage("");
    setPotentialLocation(null);

    setClientName(caseItem.name);
    setCaseAddress(caseItem.address ?? "");
    setCaseCity(caseItem.city);
    setCaseState(caseItem.state);
    setCaseZip(caseItem.zip ?? "");
    setRequiredStartTime(caseItem.requiredStartTime);
    setRequiredEndTime(caseItem.requiredEndTime);
    setRequiredDays(caseItem.requiredDays);

    setSearchTerm(caseItem.name);
    setIsSearchOpen(false);

    const location = caseLocations.find((item) => item.id === caseItem.id);
    if (location) {
      focusLocationOnMap(location, 10);
    }
  };

  const handleConfirmCaseLocation = async (caseItem: CaseProfile) => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
    const nextAddress = buildServiceLocationAddress({
      address: caseItem.address,
      city: caseItem.city,
      state: caseItem.state,
      zip: caseItem.zip,
    });

    if (!nextAddress || !apiKey) {
      setAssignmentMessage("Google Maps API key is not configured, or the case address is incomplete.");
      return;
    }

    try {
      const result = await geocodeServiceLocation({
        address: caseItem.address,
        city: caseItem.city,
        state: caseItem.state,
        zip: caseItem.zip,
      }, apiKey);

      const saved = await upsertCase({
        ...caseItem,
        address: result.formattedAddress || caseItem.address,
        city: result.city || caseItem.city,
        state: normalizeState(result.state || caseItem.state),
        zip: result.zip || caseItem.zip,
        latitude: result.lat,
        longitude: result.lng,
      });

      if (!saved.ok) {
        throw new Error(saved.message);
      }

      setAssignmentMessage("Service location saved.");
      setMapDiagnostic("");
      setLocationConfirmationTarget(null);
      setPotentialLocation(null);
      setSelectedCaseId(caseItem.id);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown geocoding error.";
      setAssignmentMessage(detail);
      setMapDiagnostic(detail);
    }
  };

  const handleSelectLocation = async (locationResult: LocationSearchResult) => {
    const confirmationTarget = locationConfirmationTarget;
    setFocusedTechnicianId("");
    setSelectedCaseId("");
    setPendingMatch(null);
    setAssignmentMessage("");

    setSearchTerm(locationResult.primaryText);
    setIsSearchOpen(false);

    const places = window.google?.maps?.places;
    if (!places) return;

    let lat: number | null = null;
    let lng: number | null = null;
    let formattedAddress = locationResult.primaryText;
    let city = "";
    let state = "";
    let zip = "";

    try {
      const PlaceClass = (places as unknown as {
        Place?: new (input: { id: string }) => {
          formattedAddress?: string;
          location?: { lat: () => number; lng: () => number };
          addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
          fetchFields: (input: { fields: string[] }) => Promise<void>;
        };
      }).Place;

      if (PlaceClass) {
        const place = new PlaceClass({ id: locationResult.placeId });
        await place.fetchFields({ fields: ["displayName", "formattedAddress", "location", "addressComponents"] });

        formattedAddress = place.formattedAddress || formattedAddress;
        lat = place.location?.lat() ?? null;
        lng = place.location?.lng() ?? null;

        const parts = parseAddressParts(place.addressComponents ?? []);
        city = parts.city;
        state = parts.state;
        zip = parts.zip;
      } else {
        const geocoder = new window.google.maps.Geocoder();
        const geocoded = await geocoder.geocode({ placeId: locationResult.placeId });
        const first = geocoded.results[0];

        if (first) {
          formattedAddress = first.formatted_address || formattedAddress;
          lat = first.geometry.location.lat();
          lng = first.geometry.location.lng();

          const parts = parseAddressParts(
            first.address_components.map((part) => ({
              longText: part.long_name,
              shortText: part.short_name,
              types: part.types,
            }))
          );
          city = parts.city;
          state = parts.state;
          zip = parts.zip;
        }
      }
    } catch {
      setMapDiagnostic("Google Places could not resolve that location. Select another result to confirm coordinates.");
    }

    const normalizedStateValue = normalizeState(state);
    if (city) setCaseCity(city);
    if (normalizedStateValue) setCaseState(normalizedStateValue);
    if (zip) setCaseZip(zip);
    setCaseAddress(formattedAddress);

    if (!clientName.trim()) {
      setClientName("Potential Case");
    }

    if (confirmationTarget && lat !== null && lng !== null) {
      if (confirmationTarget.kind === "Client") {
        const existingCase = cases.find((item) => item.id === confirmationTarget.id);
        if (existingCase) {
          const result = await upsertCase({ ...existingCase, address: formattedAddress || existingCase.address, city: city || existingCase.city, state: normalizedStateValue || existingCase.state, zip: zip || existingCase.zip, latitude: lat, longitude: lng });
          setAssignmentMessage(result.ok ? `Location confirmed for ${existingCase.name}.` : result.message);
        }
      } else {
        const existingTechnician = technicians.find((item) => item.id === confirmationTarget.id);
        if (existingTechnician) {
          const result = await upsertTechnician({ ...existingTechnician, latitude: lat, longitude: lng });
          setAssignmentMessage(result.ok ? `Location confirmed for ${existingTechnician.name}.` : result.message);
        }
      }
      setLocationConfirmationTarget(null);
      setPotentialLocation(null);
      return;
    }

    if (lat !== null && lng !== null) {
      const tempLocation: LocationItem = {
        id: `location-${locationResult.placeId}`,
        name: locationResult.primaryText,
        city: city || "",
        state: normalizedStateValue || "",
        kind: "Location",
        status: "Potential Case",
        lat,
        lng,
        markerColor: "#ef4444",
      };

      setPotentialLocation(tempLocation);
      focusLocationOnMap(tempLocation, 11);
    } else {
      setPotentialLocation(null);
    }
  };

  useEffect(() => {
    if (searchMode !== "all") return;

    const search = searchTerm.trim();
    if (!search || search.length < 2) return;

    const places = window.google?.maps?.places;
    if (!places) {
      const unavailableTimer = window.setTimeout(() => setMapDiagnostic("Google Places API is unavailable. Check the Places API permission for this key."), 0);
      return () => window.clearTimeout(unavailableTimer);
    }

    let cancelled = false;

    const lookup = async () => {
      try {
        const suggestionApi = places as unknown as {
          AutocompleteSuggestion?: {
            fetchAutocompleteSuggestions?: (input: {
              input: string;
              language?: string;
              region?: string;
              includedRegionCodes?: string[];
            }) => Promise<{
              suggestions: Array<{
                placePrediction?: {
                  placeId?: string;
                  text?: { text?: string };
                  structuredFormat?: {
                    mainText?: { text?: string };
                    secondaryText?: { text?: string };
                  };
                };
              }>;
            }>;
          };
          AutocompleteService?: new () => {
            getPlacePredictions: (
              request: { input: string; componentRestrictions?: { country: string } },
              callback: (
                predictions: Array<{
                  place_id: string;
                  structured_formatting?: { main_text?: string; secondary_text?: string };
                  description: string;
                }> | null,
                status: string
              ) => void
            ) => void;
          };
        };

        if (suggestionApi.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
          const response = await suggestionApi.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: search,
            language: "en",
            region: "US",
            includedRegionCodes: ["us"],
          });

          if (cancelled) return;

          const next = (response.suggestions ?? [])
            .map((suggestion, index) => {
              const prediction = suggestion.placePrediction;
              const placeId = prediction?.placeId;
              if (!placeId) return null;

              const primaryText =
                prediction.structuredFormat?.mainText?.text ||
                prediction.text?.text ||
                "Location";
              const secondaryText = prediction.structuredFormat?.secondaryText?.text || "";

              return {
                id: `${placeId}-${index}`,
                placeId,
                primaryText,
                secondaryText,
              } as LocationSearchResult;
            })
            .filter((item): item is LocationSearchResult => Boolean(item))
            .slice(0, 6);

          setLocationSearchResults(next);
          setIsLoadingLocations(false);
          return;
        }

        if (suggestionApi.AutocompleteService) {
          const service = new suggestionApi.AutocompleteService();
          service.getPlacePredictions(
            { input: search, componentRestrictions: { country: "us" } },
            (predictions, status) => {
              if (cancelled) return;
              const okStatus = window.google?.maps?.places?.PlacesServiceStatus?.OK;

              if (status !== okStatus || !predictions) {
                setLocationSearchResults([]);
                setIsLoadingLocations(false);
                return;
              }

              const next = predictions.slice(0, 6).map((prediction, index) => ({
                id: `${prediction.place_id}-${index}`,
                placeId: prediction.place_id,
                primaryText: prediction.structured_formatting?.main_text || prediction.description,
                secondaryText: prediction.structured_formatting?.secondary_text || "",
              }));

              setLocationSearchResults(next);
              setIsLoadingLocations(false);
            }
          );
          return;
        }

        setLocationSearchResults([]);
        setIsLoadingLocations(false);
      } catch {
        if (!cancelled) {
          setLocationSearchResults([]);
          setIsLoadingLocations(false);
          setMapDiagnostic("Google Places search failed. Saved technician and case search remains available.");
        }
      }
    };

    const timer = window.setTimeout(() => {
      setIsLoadingLocations(true);
      void lookup();
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchMode, searchTerm]);

  const handleConfirmAssignment = async () => {
    if (!pendingMatch) return;
    const result = await assignCase({ technicianId: pendingMatch.technician.id, caseId: pendingMatch.caseItem.id });
    if (!result.ok) {
      setAssignmentMessage(result.message);
      return;
    }
    setAssignmentMessage(`Assigned ${pendingMatch.technician.name} to ${pendingMatch.caseItem.name}.`);
    setPendingMatch(null);
  };

  const handleFindMatches = () => {
    setAssignmentMessage("");
    if (!selectedCaseId) {
      setPendingMatch(null);
    }
  };

  if (loading) {
    return <DatabaseState title="Loading staffing map" message="Fetching technicians, cases, and assignments from Supabase." />;
  }

  if (errorMessage) {
    return <DatabaseState title="Map data unavailable" message={errorMessage} actionLabel="Retry" onAction={() => void refreshDatabase()} />;
  }

  return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <div className="mx-auto flex max-w-[1700px] flex-col lg:flex-row">
          <aside className="w-full border-b border-slate-200 bg-white/80 p-6 backdrop-blur lg:w-72 lg:border-b-0 lg:border-r">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-lg font-semibold text-white shadow-lg shadow-blue-200">AB</div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">ABA</p>
                <h2 className="text-lg font-semibold text-slate-900">Staffing Platform</h2>
              </div>
            </div>
            <nav className="space-y-2">
              {navItems.map((item) => (
                <Link key={item.label} href={item.href} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${item.active ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>

          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <header className="mb-6 flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 p-6 text-white shadow-xl shadow-blue-100 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-100">Location Intelligence</p>
                <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Staffing Map</h1>
                <p className="mt-2 text-sm text-blue-50/90">Unified Smart Match across map, technicians, cases, and assignments.</p>
              </div>
              <button type="button" onClick={() => downloadTechniciansCsv(technicians)} className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50">Technicians</button>
            </header>

            <section className="relative mb-6 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <label htmlFor="map-global-search" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Global Search
              </label>
              <input
                id="map-global-search"
                value={searchTerm}
                onFocus={() => setIsSearchOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setIsSearchOpen(false), 120);
                }}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setIsSearchOpen(true);
                }}
                placeholder={searchPlaceholder}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
              />

              {searchMode !== "all" ? (
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={clearSelectionContext}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    Clear / Back
                  </button>
                </div>
              ) : null}

              {isSearchOpen && normalizedSearchTerm ? (
                <div className="absolute left-4 right-4 top-[92px] z-20 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                  {searchHasResults || (canSearchLocations && isLoadingLocations) ? (
                    <div className="space-y-3">
                      {searchMode !== "case-for-technician" ? (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Technicians</p>
                          {technicianSearchResults.length > 0 ? (
                            <div className="space-y-1">
                              {technicianSearchResults.map((tech) => (
                                <button
                                  key={tech.id}
                                  type="button"
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    if (searchMode === "technician-for-case") {
                                      handleRunCaseToTechnician(tech);
                                      return;
                                    }
                                    handleSelectTechnician(tech);
                                  }}
                                  className="w-full rounded-xl px-3 py-2 text-left transition hover:bg-slate-100"
                                >
                                  <p className="text-sm font-semibold text-slate-900">{tech.name}</p>
                                  <p className="text-xs text-slate-500">{tech.status}</p>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-400">No technician results</p>
                          )}
                        </div>
                      ) : null}

                      {searchMode !== "technician-for-case" ? (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Cases</p>
                          {caseSearchResults.length > 0 ? (
                            <div className="space-y-1">
                              {caseSearchResults.map((caseItem) => (
                                <button
                                  key={caseItem.id}
                                  type="button"
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    if (searchMode === "case-for-technician") {
                                      handleRunTechnicianToCase(caseItem);
                                      return;
                                    }
                                    handleSelectCase(caseItem);
                                  }}
                                  className="w-full rounded-xl px-3 py-2 text-left transition hover:bg-slate-100"
                                >
                                  <p className="text-sm font-semibold text-slate-900">{caseItem.name}</p>
                                  <p className="text-xs text-slate-500">{caseItem.status}</p>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-400">No case results</p>
                          )}
                        </div>
                      ) : null}

                      {searchMode === "all" ? (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Locations</p>
                          {canSearchLocations && isLoadingLocations ? (
                            <p className="text-sm text-slate-400">Searching locations...</p>
                          ) : visibleLocationResults.length > 0 ? (
                            <div className="space-y-1">
                              {visibleLocationResults.map((locationResult) => (
                                <button
                                  key={locationResult.id}
                                  type="button"
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    void handleSelectLocation(locationResult);
                                  }}
                                  className="w-full rounded-xl px-3 py-2 text-left transition hover:bg-slate-100"
                                >
                                  <p className="text-sm font-semibold text-slate-900">{locationResult.primaryText}</p>
                                  <p className="text-xs text-slate-500">{locationResult.secondaryText || "Google Location"}</p>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-400">No location results</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No matches found</p>
                  )}
                </div>
              ) : null}
            </section>

            <section className="mobile-filter-chips mb-6 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  {(["All", "IA", "NM"] as const).map((option) => (
                    <button key={option} type="button" onClick={() => setSelectedState(option)} className={`rounded-full px-3 py-2 text-sm font-medium transition ${selectedState === option ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                      {option === "All" ? "All States" : option === "IA" ? "Iowa" : "New Mexico"}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Clear Filter", value: "none" },
                    { label: "Available Technicians", value: "available-technicians" },
                    { label: "Active Technicians", value: "active-technicians" },
                    { label: "Assigned Technicians", value: "assigned-technicians" },
                    { label: "Interview Candidates", value: "interview-technicians" },
                    { label: "Open Cases", value: "open-clients" },
                    { label: "Active Clients", value: "active-clients" },
                  ].map((option) => (
                    <button key={option.value} type="button" onClick={() => setSelectedType(option.value)} className={`rounded-full px-3 py-2 text-sm font-medium transition ${selectedType === option.value ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Map View</h2>
                    <p className="text-sm text-slate-500">Interactive staffing locations</p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">Live</div>
                </div>
                {apiKey ? (
                  <div className="mobile-map-canvas h-[440px] overflow-hidden rounded-[24px] border border-slate-200">
                    <APIProvider
                      apiKey={apiKey}
                      libraries={["places", "routes"]}
                      onError={() => setMapDiagnostic("The map is temporarily unavailable. You can continue managing staffing records.")}
                    >
                      <RouteMatrixPrefetcher apiKey={apiKey} caseItem={selectedCase} technicians={technicians} cacheRouteInfo={cacheRouteInfo} isRouteCached={isRouteCached} onDiagnostic={setMapDiagnostic} />
                      <Map
                        defaultCenter={mapCenter}
                        defaultZoom={6}
                        center={activeCenteredLocation ? { lat: activeCenteredLocation.lat, lng: activeCenteredLocation.lng } : mapViewport}
                        zoom={activeCenteredLocation ? 10 : mapZoom}
                        mapId="staffing-map"
                      >
                        {filteredLocations.map((location) => (
                          <Marker
                            key={`${location.id}-${location.kind}`}
                            position={{ lat: location.lat, lng: location.lng }}
                            icon={activeCenteredLocation?.id === location.id && activeCenteredLocation.kind === location.kind ? getHighlightedPinIcon(location.markerColor) : getPinIcon(location.markerColor)}
                            zIndex={activeCenteredLocation?.id === location.id && activeCenteredLocation.kind === location.kind ? 1000 : undefined}
                            onClick={() => {
                              focusLocationOnMap(location, mapZoom);
                              if (location.kind === "Technician") {
                                const technician = technicians.find((item) => item.id === location.id);
                                if (technician) {
                                  if (searchMode === "technician-for-case") {
                                    handleRunCaseToTechnician(technician);
                                  } else {
                                    handleSelectTechnician(technician);
                                  }
                                }
                              } else if (location.kind === "Client") {
                                const caseItem = cases.find((item) => item.id === location.id);
                                if (caseItem) {
                                  if (searchMode === "case-for-technician") {
                                    handleRunTechnicianToCase(caseItem);
                                  } else {
                                    handleSelectCase(caseItem);
                                  }
                                }
                              }
                            }}
                          />
                        ))}
                        {selectedLocation ? (
                          <InfoWindow position={{ lat: selectedLocation.lat, lng: selectedLocation.lng }} onCloseClick={() => setSelectedLocation(null)}>
                            <div className="max-w-[220px] text-sm text-slate-700">
                              <p className="font-semibold text-slate-900">{selectedLocation.name}</p>
                              <p className="mt-1">{selectedLocation.city}, {selectedLocation.state}</p>
                              <p className="mt-1">{selectedLocation.kind}</p>
                              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{selectedLocation.status}</p>
                            </div>
                          </InfoWindow>
                        ) : null}
                      </Map>
                    </APIProvider>
                  </div>
                ) : (
                  <div className="flex min-h-[440px] items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <div className="max-w-md">
                      <p className="text-lg font-semibold text-slate-800">Google Maps could not be loaded because the API key is missing.</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment to display the interactive map.</p>
                    </div>
                  </div>
                )}
                {mapDiagnostic ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Map notice: {mapDiagnostic}</p> : null}
                {missingCoordinateCount > 0 ? <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">Location diagnostic: {missingCoordinateCount} saved record{missingCoordinateCount === 1 ? " is" : "s are"} missing coordinates. Select the record and use Confirm Location.</p> : null}
              </div>

              <section className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                {focusedTechnician ? (
                  <div className="rounded-[24px] border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-semibold text-slate-900">Technician Profile</h3>
                      <button type="button" onClick={clearSelectionContext} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                        Clear / Back
                      </button>
                    </div>
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                      <p className="font-semibold text-slate-900">{focusedTechnician.name}</p>
                      <p className="mt-1">{focusedTechnician.city}, {focusedTechnician.state} {focusedTechnician.zip ?? ""}</p>
                      <p className="mt-1">Phone: {focusedTechnician.phone}</p>
                      <p className="mt-1">Email: {focusedTechnician.email}</p>
                      <p className="mt-1">Status: {focusedTechnician.status}</p>
                      <p className="mt-1">Availability: {focusedTechnician.hours || "Needs availability confirmation"}</p>
                      {focusedTechnician.latitude === undefined || focusedTechnician.longitude === undefined ? <button type="button" onClick={() => { setLocationConfirmationTarget({ kind: "Technician", id: focusedTechnician.id }); setSearchTerm(""); setIsSearchOpen(true); }} className="mt-3 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Confirm Location</button> : null}
                    </div>
                  </div>
                ) : selectedCase ? (
                  <div className="rounded-[24px] border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-semibold text-slate-900">Client / Case Profile</h3>
                      <button type="button" onClick={clearSelectionContext} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                        Clear / Back
                      </button>
                    </div>
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                      <p className="font-semibold text-slate-900">{selectedCase.name}</p>
                      <p className="mt-1">{selectedCase.address || "N/A"}</p>
                      <p className="mt-1">{selectedCase.city}, {selectedCase.state} {selectedCase.zip ?? ""}</p>
                      <p className="mt-1">Status: {selectedCase.status}</p>
                      <p className="mt-1">Required Days: {selectedCase.requiredDays.join(", ") || "N/A"}</p>
                      <p className="mt-1">Schedule: {formatScheduleText(selectedCase.requiredScheduleText, "N/A")}</p>
                      {selectedCase.latitude === undefined || selectedCase.longitude === undefined ? (
                        <button type="button" onClick={() => void handleConfirmCaseLocation(selectedCase)} className="mt-3 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Confirm Location</button>
                      ) : (
                        <>
                          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Location Confirmed</p>
                          <button type="button" onClick={() => void handleConfirmCaseLocation(selectedCase)} className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Reconfirm Location</button>
                        </>
                      )}
                    </div>
                  </div>
                ) : selectedType === "none" ? (
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"><h3 className="text-base font-semibold text-slate-900">Selection Panel</h3><p className="mt-2 text-sm text-slate-500">Select a filter, search, or map marker to view results.</p></div>
                ) : (
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-base font-semibold text-slate-900">Selection Panel</h3>
                    <p className="mt-2 text-sm text-slate-500">Choose a result to auto-load its full saved record and switch matching direction.</p>
                    {(selectedType === "open-clients" || selectedType === "active-clients") ? (
                      <div className="mt-3 space-y-2">
                        {filteredCasesForPanel.map((item) => (
                          <button key={item.id} type="button" onClick={() => handleSelectCase(item)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left">
                            <p className="font-semibold text-slate-800">{item.name}</p>
                            <p className="text-xs text-slate-500">{item.status}</p>
                          </button>
                        ))}
                        {filteredCasesForPanel.length === 0 ? <p className="text-sm text-slate-500">No cases for this filter.</p> : null}
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {filteredTechniciansForPanel.map((tech) => (
                          <button key={tech.id} type="button" onClick={() => handleSelectTechnician(tech)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left">
                            <p className="font-semibold text-slate-800">{tech.name}</p>
                            <p className="text-xs text-slate-500">{tech.status}</p>
                          </button>
                        ))}
                        {filteredTechniciansForPanel.length === 0 ? <p className="text-sm text-slate-500">No technicians for this filter.</p> : null}
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-base font-semibold text-slate-900">Potential Case Location</h3>
                  <p className="mt-2 text-sm text-slate-500">Build a case and find matching technicians.</p>
                  <div className="mt-4 space-y-3">
                    <label className="block text-sm text-slate-600"><span className="mb-1 block">Client name</span><input value={clientName} onChange={(event) => setClientName(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400" /></label>
                    <label className="block text-sm text-slate-600"><span className="mb-1 block">Address</span><input value={caseAddress} onChange={(event) => setCaseAddress(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400" /></label>
                    <label className="block text-sm text-slate-600"><span className="mb-1 block">City</span><input value={caseCity} onChange={(event) => setCaseCity(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400" /></label>
                    <label className="block text-sm text-slate-600"><span className="mb-1 block">ZIP</span><input value={caseZip} onChange={(event) => setCaseZip(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400" /></label>
                    <label className="block text-sm text-slate-600"><span className="mb-1 block">Start time</span><input type="time" value={requiredStartTime} onChange={(event) => setRequiredStartTime(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400" /></label>
                    <label className="block text-sm text-slate-600"><span className="mb-1 block">End time</span><input type="time" value={requiredEndTime} onChange={(event) => setRequiredEndTime(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400" /></label>
                    <fieldset className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                      <legend className="px-1 text-sm">Days of the week</legend>
                      <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {DAY_ORDER.map((day) => (
                          <label key={day} className="flex items-center gap-2">
                            <input type="checkbox" checked={requiredDays.includes(day)} onChange={() => setRequiredDays((current) => (current.includes(day) ? current.filter((value) => value !== day) : [...current, day]))} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            <span>{day}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <label className="block text-sm text-slate-600"><span className="mb-1 block">State</span><input value={caseState} onChange={(event) => setCaseState(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400" /></label>
                  </div>
                  <button onClick={handleFindMatches} type="button" className="mt-4 rounded-2xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">Find Matching Technicians</button>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <h3 className="text-base font-semibold text-slate-900">Smart Match Results</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {summaryItems.map((item) => (
                      <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                        <p className="mt-1 text-2xl font-semibold text-slate-900">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {caseWindowReady || selectedCase ? (
                    <div className="mt-4 space-y-3">
                      {activeMatchList.map((match) => {
                        const readiness = match.readinessStatus as ReadinessStatus;
                        return (
                          <div key={`${match.caseItem.id}-${match.technician.id}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusTone(readiness)}`}>{readiness}</p>
                            <p className="mt-2 font-semibold text-slate-800">{match.technician.name}</p>
                            <p className="mt-1 text-sm text-slate-500">{match.technician.city}, {match.technician.state}</p>
                            <p className="mt-1 text-sm text-slate-600">Drive: {match.driveTimeMinutes ?? "Unknown"} min • {match.driveDistanceMiles ?? "Unknown"} mi</p>
                            <p className="mt-1 text-sm text-slate-600">Schedule: {match.scheduleCompatibility}</p>
                            <p className="mt-1 text-sm text-slate-600">Current clients: {getTechnicianClientCount(match.technician)}</p>
                            <ul className="mt-2 space-y-1 text-xs text-slate-600">
                              {match.transparency.slice(0, 4).map((line) => (
                                <li key={line}>- {line}</li>
                              ))}
                            </ul>
                            <div className="mt-3 flex gap-2">
                              <a href={`tel:${match.technician.phone}`} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Call</a>
                              <a href={`mailto:${match.technician.email}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Email</a>
                              <Link href={`/map?focus=${encodeURIComponent(createTechnicianSlug(match.technician.name))}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">View Map</Link>
                              {readiness === "Ready to Assign" ? (
                                <button type="button" onClick={() => setPendingMatch(match)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Assign Technician</button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {assignmentMessage ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{assignmentMessage}</div>
                  ) : null}
                </div>
              </section>
            </section>

            {pendingMatch ? (
              <section className="mt-6 rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Confirm Assignment</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Client / Case</p>
                    <p className="mt-2 font-semibold text-slate-900">{pendingMatch.caseItem.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{pendingMatch.caseItem.address || `${pendingMatch.caseItem.city}, ${pendingMatch.caseItem.state}`}</p>
                    <p className="mt-1 text-sm text-slate-600">ZIP: {pendingMatch.caseItem.zip || "N/A"}</p>
                    <p className="mt-1 text-sm text-slate-600">State: {pendingMatch.caseItem.state}</p>
                    <p className="mt-1 text-sm text-slate-600">Required days: {pendingMatch.caseItem.requiredDays.join(", ")}</p>
                    <p className="mt-1 text-sm text-slate-600">Required hours: {caseScheduleLabel(pendingMatch.caseItem)}</p>
                    <p className="mt-1 text-sm text-slate-600">Start date: {formatUsDate(pendingMatch.caseItem.startDate, "TBD")}</p>
                    <p className="mt-1 text-sm text-slate-600">BCBA: {pendingMatch.caseItem.bcba || "TBD"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Technician</p>
                    <p className="mt-2 font-semibold text-slate-900">{pendingMatch.technician.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{pendingMatch.technician.city}, {pendingMatch.technician.state}</p>
                    <p className="mt-1 text-sm text-slate-600">Current clients: {pendingMatch.currentClientCount}</p>
                    <p className="mt-1 text-sm text-slate-600">Drive time: {pendingMatch.driveTimeMinutes ?? "Unknown"} min</p>
                    <p className="mt-1 text-sm text-slate-600">Distance: {pendingMatch.driveDistanceMiles ?? "Unknown"} mi</p>
                    <p className="mt-1 text-sm text-slate-600">Availability: {pendingMatch.availabilityStatus}</p>
                    <p className="mt-1 text-sm text-slate-600">Travel radius: {pendingMatch.technician.travelMinutes ?? pendingMatch.technician.travelRadius}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Validation</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    <li>- State match: {normalizeState(pendingMatch.technician.state) === normalizeState(pendingMatch.caseItem.state) ? "Pass" : "Fail"}</li>
                    <li>- Drive time within radius: {pendingMatch.travelCompatibility === "Within Radius" ? "Pass" : "Fail"}</li>
                    <li>- Days match: {pendingMatch.scheduleCompatibility === "Full" ? "Pass" : "Fail"}</li>
                    <li>- Hours match: {pendingMatch.scheduleCompatibility === "Full" ? "Pass" : "Fail"}</li>
                    <li>- No schedule overlap: {pendingMatch.conflictReasons.some((reason) => reason.code === "existing_case_overlap") ? "Fail" : "Pass"}</li>
                    <li>- Technician status allows assignment: {pendingMatch.conflictReasons.some((reason) => reason.code === "status_not_eligible") ? "Fail" : "Pass"}</li>
                  </ul>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={handleConfirmAssignment} className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white">Confirm Assignment</button>
                  <a href={createCaseOutlookEmail(pendingMatch)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Email Assignment Details</a>
                  <button type="button" onClick={() => setPendingMatch(null)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>
                </div>
              </section>
            ) : null}
          </main>
        </div>
      </div>
  );
}
