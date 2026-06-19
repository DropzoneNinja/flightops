// OpenSky state vector — 17-element positional tuple per API docs:
// [0]  icao24: string
// [1]  callsign: string | null
// [2]  origin_country: string
// [3]  time_position: number | null  (unix timestamp of last position fix)
// [4]  last_contact: number          (unix timestamp of last any message)
// [5]  longitude: number | null
// [6]  latitude: number | null
// [7]  baro_altitude: number | null  (metres)
// [8]  on_ground: boolean
// [9]  velocity: number | null       (m/s)
// [10] true_track: number | null     (degrees clockwise from north)
// [11] vertical_rate: number | null  (m/s)
// [12] sensors: number[] | null
// [13] geo_altitude: number | null   (metres)
// [14] squawk: string | null
// [15] spi: boolean
// [16] position_source: number
export type OpenSkyStateVector = [
  string,
  string | null,
  string,
  number | null,
  number,
  number | null,
  number | null,
  number | null,
  boolean,
  number | null,
  number | null,
  number | null,
  number[] | null,
  number | null,
  string | null,
  boolean,
  number,
];

export interface OpenSkyApiResponse {
  time: number;
  states: OpenSkyStateVector[] | null;
}
