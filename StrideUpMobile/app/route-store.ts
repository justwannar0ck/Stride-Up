// Simple shared store to pass waypoints from route-builder back to challenge-create
// without any navigation param gymnastics. This is just a module-level variable.

export type WaypointData = {
  order: number;
  waypoint_type: string;
  latitude: number;
  longitude: number;
  name: string;
  radius_meters: number;
};

let _pendingWaypoints: WaypointData[] | null = null;

export function setPendingWaypoints(waypoints: WaypointData[]) {
  _pendingWaypoints = waypoints;
}

export function consumePendingWaypoints(): WaypointData[] | null {
  const data = _pendingWaypoints;
  _pendingWaypoints = null; // consume once
  return data;
}