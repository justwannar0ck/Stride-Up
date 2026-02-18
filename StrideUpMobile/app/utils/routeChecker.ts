import { RouteWaypoint } from '../services/challengeService';

interface GPSPoint {
  latitude: number;
  longitude: number;
}

/**
 * Haversine distance in meters between two GPS points
 */
function haversineMeters(a: GPSPoint, b: GPSPoint): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinLon * sinLon;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Checks which waypoints have been reached (in order) given a GPS track.
 *
 * Returns the index of the last waypoint that was reached.
 * e.g. if waypoints = [start, cp1, cp2, end] and user passed start + cp1,
 *   returns 1 (index of cp1).
 * Returns -1 if start hasn't been reached.
 */
export function checkWaypointProgress(
  waypoints: RouteWaypoint[], // sorted by .order
  gpsTrack: GPSPoint[]
): {
  reachedIndex: number;
  allCleared: boolean;
  reachedWaypoints: boolean[];
} {
  const reachedWaypoints = waypoints.map(() => false);
  let nextRequired = 0; // the next waypoint that must be reached (in order)

  for (const point of gpsTrack) {
    if (nextRequired >= waypoints.length) break;

    const wp = waypoints[nextRequired];
    const dist = haversineMeters(point, {
      latitude: wp.latitude,
      longitude: wp.longitude,
    });

    if (dist <= wp.radius_meters) {
      reachedWaypoints[nextRequired] = true;
      nextRequired++;
    }
  }

  return {
    reachedIndex: nextRequired - 1,
    allCleared: nextRequired >= waypoints.length,
    reachedWaypoints,
  };
}