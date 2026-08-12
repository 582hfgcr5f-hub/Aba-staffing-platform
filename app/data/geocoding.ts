export function buildServiceLocationAddress(input: { address?: string; city?: string; state?: string; zip?: string }) {
  return [input.address, input.city, input.state, input.zip]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join(", ");
}

export function extractGeocodeParts(parts: Array<{ long_name?: string; short_name?: string; types?: string[] }>) {
  const getValue = (types: string[]) => {
    const found = parts.find((part) => part.types?.some((type) => types.includes(type)));
    return found?.long_name || found?.short_name || "";
  };

  return {
    city: getValue(["locality", "postal_town"]) || "",
    state: getValue(["administrative_area_level_1"]) || "",
    zip: getValue(["postal_code"]) || "",
  };
}

export function describeGeocodeError(status: string, errorMessage?: string) {
  return errorMessage ? `Google Geocoding API error: ${status} - ${errorMessage}` : `Google Geocoding API error: ${status}`;
}

export async function geocodeServiceLocation(
  input: { address?: string; city?: string; state?: string; zip?: string },
  apiKey: string,
): Promise<{ lat: number; lng: number; formattedAddress: string; placeId?: string; city: string; state: string; zip: string }> {
  const fullAddress = buildServiceLocationAddress(input);
  if (!fullAddress.trim()) {
    throw new Error("Service address is missing or incomplete.");
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", fullAddress);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Google Geocoding API request failed (${response.status}).`);
  }

  const payload = await response.json() as {
    status?: string;
    results?: Array<{
      formatted_address?: string;
      place_id?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
      address_components?: Array<{ long_name?: string; short_name?: string; types?: string[] }>;
    }>;
    error_message?: string;
  };

  if (payload.status !== "OK") {
    throw new Error(describeGeocodeError(payload.status ?? "UNKNOWN_ERROR", payload.error_message));
  }

  const first = payload.results?.[0];
  if (!first) {
    throw new Error("Google Geocoding API returned no results for the supplied address.");
  }

  const lat = first.geometry?.location?.lat;
  const lng = first.geometry?.location?.lng;
  if (typeof lat !== "number" || typeof lng !== "number") {
    throw new Error("Google Geocoding API returned coordinates that could not be used.");
  }

  const parts = extractGeocodeParts(first.address_components ?? []);

  return {
    lat,
    lng,
    formattedAddress: first.formatted_address ?? fullAddress,
    placeId: first.place_id,
    city: parts.city,
    state: parts.state,
    zip: parts.zip,
  };
}
