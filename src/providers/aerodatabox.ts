// AeroDataBox Provider Implementation

import type {
  DataProvider,
  Flight,
  Aircraft,
  Airport,
  Airline,
  AircraftLeg,
  FlightTrack,
  AeroDataBoxFlight,
  AeroDataBoxAircraft,
  SearchRequest,
  FlightLookupResult,
  AircraftFlightsResult,
  FlightTrackResult,
  ConfidenceLevel,
  ProviderConfig,
  ApiResponse,
  FlightStatus,
} from '../types';
import { BaseProvider, ProviderRegistry, providerRegistry } from './base';

export class AeroDataBoxProvider extends BaseProvider {
  readonly id: DataProvider = 'aerodatabox';
  readonly name = 'AeroDataBox';
  
  readonly config: ProviderConfig = {
    id: 'aerodatabox',
    name: 'AeroDataBox',
    base_url: 'https://api.aerodatabox.com',
    auth_type: 'api_key',
    enabled: true,
    rate_limit_per_day: 40000,
    rate_limit_per_minute: 300,
    commercial_use: true,
    data_retention_days: 365,
    config: {
      tiers: { tier1: 1, tier2: 2, tier3: 6 },
      endpoints: {
        flight_number: '/flights/number/{flightNumber}/{date}',
        flight_number_dir: '/flights/number/{flightNumber}/{date}/{depOrArr}',
        aircraft_reg: '/aircrafts/reg/{reg}',
        aircraft_icao24: '/aircrafts/icao24/{icao24}',
        aircraft_all: '/aircrafts/{searchBy}/{searchParam}/all',
        airline_fleet: '/airlines/{airlineCode}/aircrafts',
        airport: '/airports/icao/{code}',
        airport_iata: '/airports/iata/{code}',
      },
    },
  };
  
  private apiKey: string;
  private apiHost: string;
  
  constructor() {
    super();
    this.apiKey = process.env.AERODATABOX_API_KEY || '';
    this.apiHost = process.env.AERODATABOX_API_HOST || 'api.aerodatabox.com';
  }
  
  isAvailable(): boolean {
    return super.isAvailable() && Boolean(this.apiKey);
  }
  
  protected async makeRequest<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    if (!this.apiKey) {
      throw new Error('AeroDataBox API key not configured');
    }
    
    const url = new URL(`${this.config.base_url}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    
    const response = await fetch(url.toString(), {
      headers: {
        'X-RapidAPI-Key': this.apiKey,
        'X-RapidAPI-Host': this.apiHost,
        'Accept': 'application/json',
      },
    });
    
    const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
    const rateLimitReset = response.headers.get('X-RateLimit-Reset');
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('AeroDataBox authentication failed: Invalid API key');
      }
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new Error(`Rate limited. Retry after ${retryAfter || 'unknown'} seconds`);
      }
      if (response.status === 404) {
        return { success: true, data: null, error: 'Not found', meta: { provider: this.id, cached: false, rate_limit_remaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : null } };
      }
      const errorText = await response.text();
      throw new Error(`AeroDataBox API error: ${response.status} ${response.statusText} - ${errorText}`);
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
    const date = request.date; // YYYY-MM-DD
    
    // Try direct flight lookup
    const response = await this.makeRequest<AeroDataBoxFlight[]>(
      `/flights/number/${flightNumber}/${date}`,
      { withAircraft: 'true', withReg: 'true' }
    );
    
    if (!response.success || !response.data || response.data.length === 0) {
      // Try departure/arrival specific endpoints
      const depResponse = await this.makeRequest<AeroDataBoxFlight[]>(
        `/flights/number/${flightNumber}/${date}/departure`,
        { withAircraft: 'true', withReg: 'true' }
      );
      
      if (depResponse.success && depResponse.data && depResponse.data.length > 0) {
        return this.parseFlightResponse(depResponse.data[0], response);
      }
      
      const arrResponse = await this.makeRequest<AeroDataBoxFlight[]>(
        `/flights/number/${flightNumber}/${date}/arrival`,
        { withAircraft: 'true', withReg: 'true' }
      );
      
      if (arrResponse.success && arrResponse.data && arrResponse.data.length > 0) {
        return this.parseFlightResponse(arrResponse.data[0], arrResponse);
      }
      
      return {
        flight: null,
        aircraft: null,
        confidence: 'UNKNOWN',
        sources: [],
        raw_responses: { aerodatabox: response.data, departure: depResponse.data, arrival: arrResponse.data },
      };
    }
    
    return this.parseFlightResponse(response.data[0], response);
  }
  
  private parseFlightResponse(flightData: AeroDataBoxFlight, rawResponse: ApiResponse<any>): FlightLookupResult {
    const aircraft: Aircraft = {
      id: '',
      icao24: flightData.aircraft.icao24.toLowerCase(),
      registration: flightData.aircraft.reg,
      aircraft_type: flightData.aircraft.type.icao,
      type_name: flightData.aircraft.type.name,
      operator_icao: flightData.airline.icao,
      serial_number: null,
      year_built: null,
      first_seen_at: null,
      last_seen_at: null,
      status: 'active',
    };
    
    const flight: Flight = {
      id: '',
      flight_number: flightData.number,
      callsign: flightData.callsign,
      airline_icao: flightData.airline.icao,
      origin_icao: flightData.departure.airport.icao,
      destination_icao: flightData.arrival.airport.icao,
      scheduled_departure: flightData.departure.scheduledTime.utc,
      scheduled_arrival: flightData.arrival.scheduledTime.utc,
      actual_departure: flightData.departure.actualTime?.utc || null,
      actual_arrival: flightData.arrival.actualTime?.utc || null,
      estimated_departure: flightData.departure.estimatedTime?.utc || null,
      estimated_arrival: flightData.arrival.estimatedTime?.utc || null,
      flight_date: flightData.departure.scheduledTime.utc.split('T')[0],
      aircraft_id: '',
      aircraft_icao24: flightData.aircraft.icao24.toLowerCase(),
      scheduled_aircraft_id: null,
      scheduled_aircraft_icao24: null,
      status: this.mapStatus(flightData.status),
      source: 'aerodatabox',
      confidence: 'HIGH',
      confidence_score: 90,
      distance_km: null,
      flight_duration_min: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    // Calculate confidence based on data completeness
    let confidence: ConfidenceLevel = 'HIGH';
    let score = 90;
    
    if (!flightData.aircraft.icao24 || !flightData.aircraft.reg) {
      confidence = 'MEDIUM';
      score = 60;
    }
    if (!flightData.departure.actualTime?.utc || !flightData.arrival.actualTime?.utc) {
      // No actual times, only scheduled
      confidence = 'MEDIUM';
      score = Math.min(score, 70);
    }
    
    return {
      flight,
      aircraft,
      confidence,
      sources: ['aerodatabox'],
      raw_responses: { aerodatabox: rawResponse.data },
    };
  }
  
  async getAircraftForFlight(flight: Flight): Promise<Aircraft | null> {
    if (!flight.aircraft_icao24 && !flight.aircraft_id) return null;
    
    // If we have registration, use it; otherwise use ICAO24
    const identifier = flight.aircraft_icao24 || flight.aircraft_id;
    const searchBy = flight.aircraft_icao24 ? 'icao24' : 'id';
    
    try {
      const response = await this.makeRequest<AeroDataBoxAircraft>(
        `/aircrafts/${searchBy}/${identifier}`,
        { withRegistrations: 'true' }
      );
      
      if (!response.success || !response.data) return null;
      
      return {
        id: '',
        icao24: response.data.icao24.toLowerCase(),
        registration: response.data.reg,
        aircraft_type: response.data.type.icao,
        type_name: response.data.type.name,
        operator_icao: response.data.operator?.icao || null,
        serial_number: null,
        year_built: null,
        first_seen_at: null,
        last_seen_at: null,
        status: 'active',
      };
    } catch {
      return null;
    }
  }
  
  async getAircraftFlights(icao24: string, date: string, windowHours: number = 2): Promise<AircraftFlightsResult> {
    // AeroDataBox has flight history by aircraft registration, not ICAO24 directly
    // We'd need to get the aircraft by ICAO24 first to get registration
    // Then use /flights/reg/{reg} or similar
    // For now, return empty - OpenSky is primary for this
    
    return {
      legs: [],
      aircraft: null,
      rotation_date: date,
      confidence: 'UNKNOWN',
    };
  }
  
  async getFlightTrack(icao24: string, time: number): Promise<FlightTrackResult> {
    // AeroDataBox doesn't provide detailed ADS-B tracks
    return { track: null, confidence: 'UNKNOWN' };
  }
  
  async getAirport(icao: string): Promise<Airport | null> {
    const response = await this.makeRequest<Airport>(`/airports/icao/${icao.toUpperCase()}`, { withTime: 'true' });
    
    if (!response.success || !response.data) return null;
    
    const d = response.data;
    return {
      icao_code: d.icao ?? '',
      iata_code: d.iata ?? '',
      name: d.name ?? '',
      city: d.city ?? '',
      country: d.country ?? '',
      timezone: d.timezone ?? '',
      latitude: d.latitude ?? 0,
      longitude: d.longitude ?? 0,
      altitude_ft: d.elevation ?? 0,
    };
  }
  
  async getAirline(icao: string): Promise<Airline | null> {
    // AeroDataBox doesn't have a dedicated airline endpoint
    return null;
  }
  
  private mapStatus(status: string): FlightStatus {
    const statusMap: Record<string, FlightStatus> = {
      'scheduled': 'scheduled',
      'active': 'active',
      'enroute': 'active',
      'landed': 'landed',
      'arrived': 'landed',
      'cancelled': 'cancelled',
      'diverted': 'diverted',
      'delayed': 'active',
      'boarding': 'active',
      'departed': 'active',
    };
    return statusMap[status.toLowerCase()] || 'unknown';
  }
  
  // Additional AeroDataBox methods
  
  async getAircraftByRegistration(registration: string): Promise<AeroDataBoxAircraft | null> {
    const response = await this.makeRequest<AeroDataBoxAircraft>(
      `/aircrafts/reg/${registration}`,
      { withRegistrations: 'true', withImage: 'false' }
    );
    return response.data || null;
  }
  
  async getAircraftByIcao24(icao24: string): Promise<AeroDataBoxAircraft | null> {
    const response = await this.makeRequest<AeroDataBoxAircraft>(
      `/aircrafts/icao24/${icao24.toLowerCase()}`,
      { withRegistrations: 'true', withImage: 'false' }
    );
    return response.data || null;
  }
  
  async getAirlineFleet(airlineCode: string, pageSize = 50): Promise<AeroDataBoxAircraft[]> {
    const response = await this.makeRequest<{ items: AeroDataBoxAircraft[] }>(
      `/airlines/${airlineCode.toUpperCase()}/aircrafts`,
      { pageSize: pageSize.toString(), pageOffset: '0', withRegistrations: 'false' }
    );
    return response.data?.items || [];
  }
  
  async searchAirportsByTerm(term: string, limit = 10): Promise<Airport[]> {
    const response = await this.makeRequest<{ items: Airport[] }>(
      '/airports/search/term',
      { q: term, limit: limit.toString() }
    );
    return response.data?.items || [];
  }
}

// Auto-register if credentials available
if (typeof process !== 'undefined' && process.env.AERODATABOX_API_KEY) {
  const provider = new AeroDataBoxProvider();
  providerRegistry.register(provider);
}

export { AeroDataBoxProvider as default };