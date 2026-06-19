export interface AircraftPosition {
  icao24: string;
  callsign: string | null;
  lat: number;
  lon: number;
  altitude_m: number | null;
  on_ground: boolean;
  velocity_mps: number | null;
  heading_deg: number | null;
  vertical_rate_mps: number | null;
  last_contact: number;
}
