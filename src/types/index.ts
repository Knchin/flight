// Core TypeScript types for the Aircraft Rotation Tracker

// ============================================================
// ENUMS & CONSTANTS
// ============================================================

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export type FlightStatus = 
  | 'scheduled' 
  | 'active' 
  | 'landed' 
  | 'cancelled' 
  | 'diverted' 
  | 'unknown';

export type DataProvider = 
  | 'opensky' 
  | 'aerodatabox' 
  | 'flightaware' 
  | 'aviationstack' 
  | 'adsbexchange' 
  | 'fr24';

export type TimeSource = 'scheduled' | 'actual' | 'estimated' | 'inferred';

// ============================================================
// CORE ENTITIES
// ============================================================

export interface Airline {
  id: number;
  icao_code: string;
  iata_code: string | null;
  name: string;
  callsign: string | null;
  country: string | null;
  active: boolean;
}

export interface Airport {
  icao_code: string;
  iata_code: string | null;
  name: string;
  city: string | null;
  country: string | null;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
  altitude_ft: number | null;
  elevation?: number | null;  // Alias for altitude_ft (AeroDataBox uses 'elevation')
  icao?: string;  // AeroDataBox response uses 'icao'
  iata?: string;  // AeroDataBox response uses 'iata'
}

export interface Aircraft {
  id: string;
  icao24: string;
  registration: string | null;
  aircraft_type: string | null;
  type_name: string | null;
  operator_icao: string | null;
  serial_number: string | null;
  year_built: number | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  status: string;
}

export interface Flight {
  id: string;
  flight_number: string;
  callsign: string | null;
  airline_icao: string | null;
  origin_icao: string;
  destination_icao: string;
  scheduled_departure: string | null;
  scheduled_arrival: string | null;
  actual_departure: string | null;
  actual_arrival: string | null;
  estimated_departure: string | null;
  estimated_arrival: string | null;
  flight_date: string;
  aircraft_id: string | null;
  aircraft_icao24: string | null;
  scheduled_aircraft_id: string | null;
  scheduled_aircraft_icao24: string | null;
  status: FlightStatus;
  source: DataProvider | null;
  confidence: ConfidenceLevel;
  confidence_score: number;
  distance_km: number | null;
  flight_duration_min: number | null;
  created_at: string;
  updated_at: string;
}

export interface FlightSource {
  id: string;
  flight_id: string;
  provider: DataProvider;
  raw_data: Record<string, any>;
  parsed_data: Record<string, any> | null;
  flight_number: string | null;
  callsign: string | null;
  origin_icao: string | null;
  destination_icao: string | null;
  scheduled_departure: string | null;
  scheduled_arrival: string | null;
  actual_departure: string | null;
  actual_arrival: string | null;
  aircraft_icao24: string | null;
  aircraft_registration: string | null;
  aircraft_type: string | null;
  airline_icao: string | null;
  confidence_score: number;
  fetched_at: string;
}

// ============================================================
// AIRCRAFT LEGS (ADS-B sectors)
// ============================================================

export interface AircraftLeg {
  id: string;
  aircraft_id: string;
  icao24: string;
  callsign: string | null;
  first_seen: string;
  last_seen: string;
  est_departure_icao: string | null;
  est_arrival_icao: string | null;
  est_departure_horiz_dist_m: number | null;
  est_departure_vert_dist_m: number | null;
  est_arrival_horiz_dist_m: number | null;
  est_arrival_vert_dist_m: number | null;
  departure_candidates_count: number | null;
  arrival_candidates_count: number | null;
  matched_flight_id: string | null;
  match_score: number;
  match_confidence: ConfidenceLevel;
  provider: DataProvider;
  raw_data: Record<string, any> | null;
}

export interface FlightTrack {
  id: string;
  flight_id: string | null;
  aircraft_leg_id: string | null;
  icao24: string;
  callsign: string | null;
  start_time: string;
  end_time: string;
  path: TrackPoint[];
  provider: DataProvider;
  fetched_at: string;
}

export interface TrackPoint {
  time: number;           // Unix timestamp
  latitude: number | null;
  longitude: number | null;
  baro_altitude: number | null;
  true_track: number | null;
  on_ground: boolean;
}

// ============================================================
// ROTATION & SEARCH
// ============================================================

export interface RotationSector {
  // The ADS-B leg
  leg: AircraftLeg;
  
  // The matched scheduled flight (if any)
  flight: Flight | null;
  
  // Computed fields
  turnaround_minutes: number | null;        // Time since previous sector arrival
  departure_delay_minutes: number | null;   // Actual vs scheduled departure
  arrival_delay_minutes: number | null;     // Actual vs scheduled arrival
  is_user_flight: boolean;                  // The flight user searched for
  
  // Confidence
  leg_flight_match_confidence: ConfidenceLevel;
  connection_confidence: ConfidenceLevel;   // Connection to previous sector
}

export interface DelayPropagation {
  sector_index: number;
  flight_number: string;
  arrival_delay_minutes: number | null;
  departure_delay_minutes: number | null;
  propagation_likelihood: 'LIKELY_PROPAGATED' | 'CONSISTENT_WITH' | 'POSSIBLE_FACTOR' | 'INSUFFICIENT_DATA' | 'NO_PROPAGATION';
  explanation: string;
}

export interface CompleteRotation {
  aircraft: Aircraft;
  aircraft_identification_confidence: ConfidenceLevel;
  date: string;
  sectors: RotationSector[];
  delay_propagation: DelayPropagation[];
  data_sources: DataProvider[];
  cache_hit: boolean;
  providers_queried: DataProvider[];
  generated_at: string;
  warnings: string[];
}

export interface SearchRequest {
  flight_number: string;
  date: string;           // YYYY-MM-DD format
}

export interface SearchResult {
  success: boolean;
  rotation: CompleteRotation | null;
  error: string | null;
  debug_info: SearchDebugInfo | null;
}

export interface SearchDebugInfo {
  search_key: string;
  flight_found: boolean;
  aircraft_identified: boolean;
  aircraft_icao24: string | null;
  aircraft_registration: string | null;
  aircraft_confidence: ConfidenceLevel;
  previous_sectors: number;
  following_sectors: number;
  providers_used: DataProvider[];
  cache_hit: boolean;
  provider_calls: number;
  execution_time_ms: number;
}

// ============================================================
// PROVIDER RESPONSES
// ============================================================

export interface OpenSkyFlight {
  icao24: string;
  firstSeen: number;
  estDepartureAirport: string;
  lastSeen: number;
  estArrivalAirport: string;
  callsign: string;
  estDepartureAirportHorizDistance: number;
  estDepartureAirportVertDistance: number;
  estArrivalAirportHorizDistance: number;
  estArrivalAirportVertDistance: number;
  departureAirportCandidatesCount: number;
  arrivalAirportCandidatesCount: number;
}

export interface OpenSkyTrack {
  icao24: string;
  startTime: number;
  endTime: number;
  callsign: string | null;
  path: Array<[number, number | null, number | null, number | null, number | null, boolean]>;
}

export interface AeroDataBoxFlight {
  number: string;
  icao: string;
  iata: string;
  callsign: string;
  status: string;
  departure: {
    airport: { icao: string; iata: string; name: string; };
    scheduledTime: { utc: string; local: string; };
    actualTime: { utc: string; local: string; } | null;
    estimatedTime: { utc: string; local: string; } | null;
    terminal: string | null;
    gate: string | null;
    runway: string | null;
  };
  arrival: {
    airport: { icao: string; iata: string; name: string; };
    scheduledTime: { utc: string; local: string; };
    actualTime: { utc: string; local: string; } | null;
    estimatedTime: { utc: string; local: string; } | null;
    terminal: string | null;
    gate: string | null;
    runway: string | null;
  };
  aircraft: {
    reg: string;
    icao24: string;
    type: { icao: string; iata: string; name: string; };
  };
  airline: { icao: string; iata: string; name: string; };
  codeshare: { airline: { icao: string; iata: string; }; number: string; } | null;
}

export interface AeroDataBoxAircraft {
  id: string;
  reg: string;
  icao24: string;
  type: { icao: string; iata: string; name: string; };
  operator: { icao: string; iata: string; name: string; } | null;
  registrations: Array<{ reg: string; from: string; to: string | null; }> | null;
}

export interface FlightAwareFlight {
  fa_flight_id: string;
  ident: string;
  ident_icao: string;
  ident_iata: string;
  operator: string;
  operator_icao: string;
  operator_iata: string;
  aircraft_type: string;
  registration: string;
  origin: { code: string; code_icao: string; code_iata: string; };
  destination: { code: string; code_icao: string; code_iata: string; };
  scheduled_out: string;
  scheduled_in: string;
  actual_out: string | null;
  actual_in: string | null;
  estimated_out: string | null;
  estimated_in: string | null;
  status: string;
}

export interface AviationStackFlight {
  flight_date: string;
  flight_status: string;
  departure: {
    airport: string;
    timezone: string;
    iata: string;
    icao: string;
    scheduled: string;
    estimated: string;
    actual: string | null;
    estimated_runway: string | null;
    actual_runway: string | null;
    terminal: string | null;
    gate: string | null;
    delay: number | null;
  };
  arrival: {
    airport: string;
    timezone: string;
    iata: string;
    icao: string;
    scheduled: string;
    estimated: string;
    actual: string | null;
    estimated_runway: string | null;
    actual_runway: string | null;
    terminal: string | null;
    gate: string | null;
    delay: number | null;
  };
  airline: { name: string; iata: string; icao: string; };
  flight: { number: string; iata: string; icao: string; codeshared: string | null; };
  aircraft: { registration: string; iata: string; icao: string; icao24: string; };
  live: {
    updated: string;
    latitude: number;
    longitude: number;
    altitude: number;
    direction: number;
    speed_horizontal: number;
    speed_vertical: number;
    is_ground: boolean;
  } | null;
}

// ============================================================
// API RESPONSES
// ============================================================

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  meta?: {
    provider: DataProvider;
    cached: boolean;
    rate_limit_remaining: number | null;
  };
}

export interface ProviderConfig {
  id: DataProvider;
  name: string;
  base_url: string;
  auth_type: 'oauth2' | 'api_key' | 'rapidapi';
  enabled: boolean;
  rate_limit_per_day: number;
  rate_limit_per_minute: number;
  commercial_use: boolean;
  data_retention_days: number;
  config: Record<string, any>;
}

// ============================================================
// UTILITY TYPES
// ============================================================

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface TimeRange {
  start: string;  // ISO 8601
  end: string;    // ISO 8601
}

export interface DateRange {
  start: string;  // YYYY-MM-DD
  end: string;    // YYYY-MM-DD
}

// ============================================================
// MATCHING & SCORING
// ============================================================

export interface MatchScore {
  total: number;
  breakdown: {
    registration_match: number;
    icao24_match: number;
    callsign_match: number;
    flight_number_match: number;
    airport_time_match: number;
    aircraft_type_match: number;
    provider_confirmation: number;
  };
  confidence: ConfidenceLevel;
}

export interface RotationLinkScore {
  total: number;
  breakdown: {
    same_icao24: number;
    compatible_airports: number;
    compatible_times: number;
    same_callsign_prefix: number;
    multi_provider: number;
  };
  confidence: ConfidenceLevel;
}

// Provider result types
export interface FlightLookupResult {
  flight: Flight | null;
  aircraft: Aircraft | null;
  confidence: ConfidenceLevel;
  sources: DataProvider[];
  raw_responses: Record<string, any>;
}

export interface AircraftFlightsResult {
  legs: AircraftLeg[];
  aircraft: Aircraft | null;
  rotation_date: string;
  confidence: ConfidenceLevel;
}

export interface FlightTrackResult {
  track: FlightTrack | null;
  confidence: ConfidenceLevel;
}