// OpenSky Network Provider Implementation

import type {
  DataProvider,
  Flight,
  Aircraft,
  Airport,
  Airline,
  AircraftLeg,
  FlightTrack,
  OpenSkyFlight,
  OpenSkyTrack,
  SearchRequest,
  FlightLookupResult,
  AircraftFlightsResult,
  FlightTrackResult,
  ConfidenceLevel,
  ProviderConfig,
  ApiResponse,
} from '../types';
import { BaseProvider, ProviderRegistry, providerRegistry } from './base';

interface OpenSkyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface OpenSkyStateVector {
  icao24: string;
  callsign: string | null;
  origin_country: string;
  time_position: number | null;
  last_contact: number;
  longitude: number | null;
  latitude: number | null;
  baro_altitude: number | null;
  on_ground: boolean;
  velocity: number | null;
  true_track: number | null;
  vertical_rate: number | null;
  sensors: number[] | null;
  geo_altitude: number | null;
  squawk: string | null;
  spi: boolean;
  position_source: number;
  category: number;
}

interface OpenSkyStatesResponse {
  time: number;
  states: OpenSkyStateVector[] | null;
}

export class OpenSkyProvider extends BaseProvider {
  readonly id: DataProvider = 'opensky';
  readonly name = 'OpenSky Network';
  
  readonly config: ProviderConfig = {
    id: 'opensky',
    name: 'OpenSky Network',
    base_url: 'https://opensky-network.org/api',
    auth_type: 'oauth2',
    enabled: true,
    rate_limit_per_day: 4000,
    rate_limit_per_minute: 100,
    commercial_use: false,
    data_retention_days: 30,
    config: {
      token_url: 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',
      endpoints: {
        flights_aircraft: '/flights/aircraft',
        flights_all: '/flights/all',
        flights_arrival: '/flights/arrival',
        flights_departure: '/flights/departure',
        tracks: '/tracks',
        states_all: '/states/all',
      },
    },
  };
  
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private clientId: string;
  private clientSecret: string;
  
  constructor() {
    super();
    this.clientId = process.env.OPENSKY_CLIENT_ID || '';
    this.clientSecret = process.env.OPENSKY_CLIENT_SECRET || '';
  }
  
  isAvailable(): boolean {
    return super.isAvailable() && Boolean(this.clientId && this.clientSecret);
  }
  
  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiresAt - 60000) { // Refresh 1 min early
      return this.accessToken;
    }
    
    if (!this.clientId || !this.clientSecret) {
      throw new Error('OpenSky credentials not configured');
    }
    
    const response = await fetch(this.config.config.token_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenSky auth failed: ${response.status}`);
    }
    
    const data: OpenSkyTokenResponse = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = now + data.expires_in * 1000;
    
    return this.accessToken;
  }
  
  protected async makeRequest<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    const token = await this.getAccessToken();
    const url = new URL(`${this.config.base_url}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
    
    const rateLimitRemaining = response.headers.get('X-Rate-Limit-Remaining');
    const rateLimitReset = response.headers.get('X-Rate-Limit-Reset');
    
    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, force refresh
        this.accessToken = null;
        this.tokenExpiresAt = 0;
        return this.makeRequest(endpoint, params); // Retry once
      }
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new Error(`Rate limited. Retry after ${retryAfter || 'unknown'} seconds`);
      }
      if (response.status === 404) {
        return { success: true, data: null, error: 'Not found', meta: { provider: this.id, cached: false, rate_limit_remaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : null } };
      }
      throw new Error(`OpenSky API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as T;
    return {
      success: true,
      data,
      error: null,
      meta: {
        provider: this.id,
        cached: false,
        rate_limit_remaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : null,
      },
    };
  }
  
  async searchFlight(request: SearchRequest): Promise<FlightLookupResult> {
    const flightNumber = this.normalizeFlightNumber(request.flight_number);

    // Build ICAO-format callsign candidates (OpenSky uses ICAO callsigns)
    const candidateCallsigns = buildCallsignCandidates(flightNumber);
    if (candidateCallsigns.length === 0) {
      return {
        flight: null,
        aircraft: null,
        confidence: 'UNKNOWN',
        sources: ['opensky'],
        raw_responses: { error: 'Unable to parse flight number into a callsign' },
      };
    }

    // OpenSky /flights/all only accepts limited intervals, so scan the day in
    // 2-hour windows and collect flights whose callsign matches.
    const baseDate = new Date(request.date + 'T00:00:00Z');
    const dayStart = Math.floor(baseDate.getTime() / 1000);
    const dayEnd = dayStart + 24 * 3600;
    const chunkSize = 2 * 3600;

    const matches: OpenSkyFlight[] = [];
    const exactFlags: boolean[] = [];
    for (let begin = dayStart; begin < dayEnd; begin += chunkSize) {
      const end = Math.min(begin + chunkSize, dayEnd);
      try {
        const flights = await this.getFlightsInInterval(begin, end);
        for (const f of flights) {
          const cs = (f.callsign || '').trim().toUpperCase();
          const exact = candidateCallsigns.includes(cs);
          const partial = !exact && candidateCallsigns.some(c => cs.includes(c) || c.includes(cs));
          if (exact || partial) {
            matches.push(f);
            exactFlags.push(exact);
          }
        }
      } catch (e) {
        console.warn(`[OpenSky] /flights/all scan failed for ${begin}:`, e);
      }
    }

    if (matches.length === 0) {
      return {
        flight: null,
        aircraft: null,
        confidence: 'UNKNOWN',
        sources: ['opensky'],
        raw_responses: { opensky: null },
      };
    }

    // Prefer exact callsign match, then most recent
    const exactIndex = exactFlags.indexOf(true);
    const best = exactIndex !== -1
      ? matches[exactIndex]
      : [...matches].sort((a, b) => b.lastSeen - a.lastSeen)[0];

    const flight: Flight = {
      id: '',
      flight_number: flightNumber,
      callsign: (best.callsign || '').trim().toUpperCase() || null,
      airline_icao: best.callsign?.trim().slice(0, 3).toUpperCase() || null,
      origin_icao: best.estDepartureAirport || '',
      destination_icao: best.estArrivalAirport || '',
      scheduled_departure: new Date(best.firstSeen * 1000).toISOString(),
      scheduled_arrival: new Date(best.lastSeen * 1000).toISOString(),
      actual_departure: new Date(best.firstSeen * 1000).toISOString(),
      actual_arrival: new Date(best.lastSeen * 1000).toISOString(),
      estimated_departure: null,
      estimated_arrival: null,
      flight_date: request.date,
      aircraft_id: '',
      aircraft_icao24: best.icao24.toLowerCase() || null,
      scheduled_aircraft_id: null,
      scheduled_aircraft_icao24: null,
      status: 'landed',
      source: 'opensky',
      confidence: 'MEDIUM',
      confidence_score: 70,
      distance_km: null,
      flight_duration_min: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const aircraft: Aircraft | null = flight.aircraft_icao24 ? {
      id: '',
      icao24: flight.aircraft_icao24,
      registration: null,
      aircraft_type: null,
      type_name: null,
      operator_icao: flight.airline_icao,
      serial_number: null,
      year_built: null,
      first_seen_at: null,
      last_seen_at: null,
      status: 'active',
    } : null;

    return {
      flight,
      aircraft,
      confidence: 'MEDIUM',
      sources: ['opensky'],
      raw_responses: { opensky: matches },
    };
  }

  async getAircraftForFlight(flight: Flight): Promise<Aircraft | null> {
    if (!flight.aircraft_icao24) return null;
    
    // OpenSky doesn't have registration data, only ICAO24
    // We can get aircraft type from state vectors if needed
    return {
      id: '',
      icao24: flight.aircraft_icao24,
      registration: flight.aircraft_id ? '' : null,
      aircraft_type: null,
      type_name: null,
      operator_icao: flight.airline_icao,
      serial_number: null,
      year_built: null,
      first_seen_at: null,
      last_seen_at: null,
      status: 'active',
    };
  }
  
  async getAircraftFlights(
    icao24: string, 
    date: string, 
    windowHours: number = 2
  ): Promise<AircraftFlightsResult> {
    // Parse date and create time window
    const baseDate = new Date(date + 'T00:00:00Z');
    const begin = Math.floor(baseDate.getTime() / 1000) - windowHours * 3600;
    const end = Math.floor(baseDate.getTime() / 1000) + 24 * 3600 + windowHours * 3600;
    
    // OpenSky limits to 2 days max
    const maxEnd = begin + 2 * 24 * 3600;
    const actualEnd = Math.min(end, maxEnd);
    
    const response = await this.makeRequest<OpenSkyFlight[]>(
      this.config.config.endpoints.flights_aircraft,
      {
        icao24: icao24.toLowerCase(),
        begin: begin.toString(),
        end: actualEnd.toString(),
      }
    );
    
    if (!response.success || !response.data) {
      return {
        legs: [],
        aircraft: null,
        rotation_date: date,
        confidence: 'UNKNOWN',
      };
    }
    
    const legs: AircraftLeg[] = response.data.map((f, index) => ({
      id: `${icao24}-${f.firstSeen}-${index}`,
      aircraft_id: '', // Will be linked later
      icao24: f.icao24,
      callsign: f.callsign?.trim() || null,
      first_seen: new Date(f.firstSeen * 1000).toISOString(),
      last_seen: new Date(f.lastSeen * 1000).toISOString(),
      est_departure_icao: f.estDepartureAirport || null,
      est_arrival_icao: f.estArrivalAirport || null,
      est_departure_horiz_dist_m: f.estDepartureAirportHorizDistance,
      est_departure_vert_dist_m: f.estDepartureAirportVertDistance,
      est_arrival_horiz_dist_m: f.estArrivalAirportHorizDistance,
      est_arrival_vert_dist_m: f.estArrivalAirportVertDistance,
      departure_candidates_count: f.departureAirportCandidatesCount,
      arrival_candidates_count: f.arrivalAirportCandidatesCount,
      matched_flight_id: null,
      match_score: 0,
      match_confidence: 'UNKNOWN',
      provider: 'opensky',
      raw_data: f,
    }));
    
    // Sort by first_seen
    legs.sort((a, b) => new Date(a.first_seen).getTime() - new Date(b.first_seen).getTime());
    
    // Determine confidence based on data quality
    let confidence: ConfidenceLevel = 'MEDIUM';
    if (legs.length === 0) confidence = 'UNKNOWN';
    else if (legs.every(l => l.est_departure_icao && l.est_arrival_icao && l.departure_candidates_count && l.departure_candidates_count <= 2)) {
      confidence = 'HIGH';
    }
    
    return {
      legs,
      aircraft: {
        id: '',
        icao24,
        registration: null,
        aircraft_type: null,
        type_name: null,
        operator_icao: null,
        serial_number: null,
        year_built: null,
        first_seen_at: null,
        last_seen_at: null,
        status: 'active',
      },
      rotation_date: date,
      confidence,
    };
  }
  
  async getFlightTrack(icao24: string, time: number): Promise<FlightTrackResult> {
    const response = await this.makeRequest<OpenSkyTrack>(
      this.config.config.endpoints.tracks,
      { icao24: icao24.toLowerCase(), time: time.toString() }
    );
    
    if (!response.success || !response.data) {
      return { track: null, confidence: 'UNKNOWN' };
    }
    
    const track: FlightTrack = {
      id: `${icao24}-${time}`,
      flight_id: null,
      aircraft_leg_id: null,
      icao24: response.data.icao24,
      callsign: response.data.callsign,
      start_time: new Date(response.data.startTime * 1000).toISOString(),
      end_time: new Date(response.data.endTime * 1000).toISOString(),
      path: response.data.path.map(p => ({
        time: p[0],
        latitude: p[1],
        longitude: p[2],
        baro_altitude: p[3],
        true_track: p[4],
        on_ground: p[5],
      })),
      provider: 'opensky',
      fetched_at: new Date().toISOString(),
    };
    
    return { track, confidence: 'HIGH' };
  }
  
  async getAirport(icao: string): Promise<Airport | null> {
    // OpenSky doesn't have a dedicated airport info endpoint
    // We'd need to use another provider or our cached data
    return null;
  }
  
  async getAirline(icao: string): Promise<Airline | null> {
    // OpenSky doesn't have airline info
    return null;
  }
  
  async getRateLimitStatus(): Promise<{ remaining: number; reset: number }> {
    // We'd need to make a request to check headers
    // For now return defaults
    return { remaining: 4000, reset: Date.now() + 24 * 3600 * 1000 };
  }
  
  // Additional OpenSky-specific methods
  
  async getLiveStates(icao24?: string): Promise<OpenSkyStateVector[]> {
    const params: Record<string, string> = {};
    if (icao24) params.icao24 = icao24;
    
    const response = await this.makeRequest<OpenSkyStatesResponse>(
      this.config.config.endpoints.states_all,
      params
    );
    
    return response.data?.states || [];
  }
  
  async getFlightsInInterval(begin: number, end: number): Promise<OpenSkyFlight[]> {
    if (end - begin > 2 * 3600) {
      throw new Error('OpenSky /flights/all interval must not exceed 2 hours');
    }
    
    const response = await this.makeRequest<OpenSkyFlight[]>(
      this.config.config.endpoints.flights_all,
      { begin: begin.toString(), end: end.toString() }
    );
    
    return response.data || [];
  }
  
  async getArrivalsByAirport(airport: string, begin: number, end: number): Promise<OpenSkyFlight[]> {
    if (end - begin > 2 * 24 * 3600) {
      throw new Error('OpenSky /flights/arrival interval must not exceed 2 days');
    }
    
    const response = await this.makeRequest<OpenSkyFlight[]>(
      this.config.config.endpoints.flights_arrival,
      { airport, begin: begin.toString(), end: end.toString() }
    );
    
    return response.data || [];
  }
  
  async getDeparturesByAirport(airport: string, begin: number, end: number): Promise<OpenSkyFlight[]> {
    if (end - begin > 2 * 24 * 3600) {
      throw new Error('OpenSky /flights/departure interval must not exceed 2 days');
    }
    
    const response = await this.makeRequest<OpenSkyFlight[]>(
      this.config.config.endpoints.flights_departure,
      { airport, begin: begin.toString(), end: end.toString() }
    );
    
    return response.data || [];
  }
}

// Auto-register if credentials available
if (typeof process !== 'undefined' && process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET) {
  const provider = new OpenSkyProvider();
  providerRegistry.register(provider);
}

// ============================================================
// IATA -> ICAO airline prefix map (used to build OpenSky callsigns)
// OpenSky /flights/all returns ICAO-format callsigns (e.g. RYR9034),
// while users typically enter IATA flight numbers (e.g. FR9034).
// ============================================================

const iataToIcaoPrefix: Record<string, string> = {
  'FR': 'RYR',
  'U2': 'EZY',
  'W6': 'WZZ',
  'BA': 'BAW',
  'AF': 'AFR',
  'LH': 'DLH',
  'IB': 'IBE',
  'KL': 'KLM',
  'VY': 'VLG',
  'LS': 'EXS',
  'BY': 'TOM',
  'V7': 'VOE',
  'N4': 'NOZ',
  'T7': 'TVF',
  'HV': 'TRA',
  'TK': 'THY',
  'QR': 'QTR',
  'EK': 'UAE',
  'EY': 'ETD',
  'SQ': 'SIA',
  'CX': 'CPA',
  'BR': 'EVA',
  'UA': 'UAL',
  'AA': 'AAL',
  'DL': 'DAL',
  'AC': 'ACA',
  'LX': 'SWR',
  'OS': 'AUA',
  'AY': 'FIN',
  'SK': 'SAS',
  'TP': 'TAP',
  'AZ': 'AZA',
  'BE': 'BEE',
  'SN': 'BEL',
  'LO': 'LOT',
  'OK': 'CSA',
  'SU': 'AFL',
  'A3': 'AEE',
  'RO': 'ROT',
  'JU': 'ASL',
  'PC': 'PGT',
  'BT': 'BTI',
  'DY': 'NAX',
  'D8': 'IBK',
};

export function buildCallsignCandidates(flightNumber: string): string[] {
  const cleaned = (flightNumber || '').trim().toUpperCase();
  if (!cleaned) return [];

  const candidates = new Set<string>();

  // Try a 3-letter ICAO callsign first (e.g. RYR9034)
  const icaoMatch = cleaned.match(/^([A-Z]{3})(\d+)$/);
  if (icaoMatch) {
    candidates.add(cleaned);
  }

  // Try a 2-char IATA prefix (letters, or letter+digit like U2/W6) + digits
  const iataMatch = cleaned.match(/^([A-Z][A-Z0-9])(\d+)$/);
  if (iataMatch) {
    const [, iata, num] = iataMatch;
    const icao = iataToIcaoPrefix[iata];
    if (icao && icao !== '??') candidates.add(icao + num);
    candidates.add(cleaned); // raw IATA form, in case provider stores it that way
  }

  return [...candidates];
}

export { OpenSkyProvider as default };