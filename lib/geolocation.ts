/**
 * Geolocation helpers for the attendance module (CLAUDE.md Section 7).
 * Pure math (Haversine) plus a cross-platform position fetcher that uses the
 * native Capacitor Geolocation plugin in the APK and falls back to the browser
 * Geolocation API on the web.
 */

import type { OfficeLocation } from "./types";

const EARTH_RADIUS_METERS = 6_371_000;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeoPosition extends Coordinates {
  accuracy: number | null;
  /** True if the OS reported a mock/spoofed provider (native only). */
  isMock: boolean;
}

/** Great-circle distance between two lat/long points, in meters (Haversine). */
export function haversineDistanceMeters(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/** Whether the employee is within an office's geofence radius. */
export function isWithinRadius(
  employee: Coordinates,
  office: Coordinates,
  radiusMeters: number,
): boolean {
  return haversineDistanceMeters(employee, office) <= radiusMeters;
}

export interface NearestOfficeResult {
  office: OfficeLocation;
  distanceMeters: number;
  within: boolean;
}

/** Pick the closest office to a position (supports multiple branches). */
export function nearestOffice(
  position: Coordinates,
  offices: OfficeLocation[],
): NearestOfficeResult | null {
  let best: NearestOfficeResult | null = null;
  for (const office of offices) {
    const distanceMeters = haversineDistanceMeters(position, {
      latitude: office.latitude,
      longitude: office.longitude,
    });
    if (!best || distanceMeters < best.distanceMeters) {
      best = {
        office,
        distanceMeters,
        within: distanceMeters <= office.radius_meters,
      };
    }
  }
  return best;
}

/** Human-friendly distance, e.g. "12 m" or "1.4 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Get the current position. Uses the native Capacitor plugin inside the APK
 * (with a mock-provider flag where the OS reports it) and the browser
 * Geolocation API on the web. Throws on permission denial / unavailability.
 */
export async function getCurrentPosition(): Promise<GeoPosition> {
  // --- Native (Capacitor / APK) ---
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor?.isNativePlatform?.()) {
      const { Geolocation } = await import("@capacitor/geolocation");
      const perm = await Geolocation.requestPermissions();
      if (perm.location === "denied") {
        throw new Error("Location permission denied.");
      }
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10_000,
      });
      // Some Android builds expose a mock/simulated flag on coords.
      const coords = pos.coords as typeof pos.coords & {
        simulated?: boolean;
        isFromMockProvider?: boolean;
      };
      return {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy ?? null,
        isMock: Boolean(coords.simulated ?? coords.isFromMockProvider ?? false),
      };
    }
  } catch (err) {
    // If native path exists but failed (e.g. denied), surface it.
    if (err instanceof Error && /denied|permission/i.test(err.message)) {
      throw err;
    }
    // Otherwise fall through to the web API.
  }

  // --- Web fallback ---
  return new Promise<GeoPosition>((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy ?? null,
          isMock: false, // browser API cannot report mock providers
        }),
      (err) => reject(new Error(err.message || "Unable to get your location.")),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}
