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
        timeout: 20_000,
        maximumAge: 0,
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
  // A single getCurrentPosition() on iOS/Safari frequently returns a CACHED,
  // low-accuracy fix (e.g. your last location) and never waits for the real GPS
  // lock — so "refresh" appears stuck. Instead we watchPosition() and keep the
  // best reading, resolving early once the fix is accurate (<= 60 m) or after a
  // window, so we get a fresh, precise position.
  return new Promise<GeoPosition>((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported on this device."));
      return;
    }

    const GOOD_ACCURACY_M = 60;
    const MAX_WAIT_MS = 20_000;
    let best: GeoPosition | null = null;
    let watchId: number | null = null;

    const cleanup = () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      cleanup();
      if (best) resolve(best);
      else
        reject(
          new Error(
            "Couldn't get an accurate location. Move near a window/outdoors and try again.",
          ),
        );
    }, MAX_WAIT_MS);

    watchId = navigator.geolocation.watchPosition(
      (p) => {
        const acc = p.coords.accuracy ?? Number.POSITIVE_INFINITY;
        const reading: GeoPosition = {
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy ?? null,
          isMock: false, // browser API cannot report mock providers
        };
        // Keep the most accurate reading seen so far.
        if (!best || acc < (best.accuracy ?? Number.POSITIVE_INFINITY)) {
          best = reading;
        }
        // Accurate enough → done.
        if (acc <= GOOD_ACCURACY_M) {
          cleanup();
          resolve(best);
        }
      },
      (err) => {
        // If we already have any fix, use it; otherwise surface the error.
        if (best) {
          cleanup();
          resolve(best);
        } else {
          cleanup();
          reject(new Error(err.message || "Unable to get your location."));
        }
      },
      { enableHighAccuracy: true, timeout: MAX_WAIT_MS, maximumAge: 0 },
    );
  });
}
