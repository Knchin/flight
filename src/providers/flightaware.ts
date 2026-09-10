// FlightAware AeroAPI Provider Implementation

import type {
  DataProvider,
  Flight,
  Aircraft,
  Airport,
  Airline,
  AircraftLeg,
  FlightTrack,
  FlightAwareFlight,
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

export class FlightAwareProvider extends BaseProvider {
  readonly id: DataProvider = 'flightaware';
  readonly name = 'FlightAware AeroAPI';
  
  readonly config: ProviderConfig = {
    id: 'flightaware',
    name: 'FlightAware AeroAPI',
    base_url: 'https://aeroapi.flightaware.com/aeroapi',
    auth_type: 'api_key',
    enabled: true,
    rate_limit_per_day: 500000,
    rate_limit_per_minute: 600,
    commercial_use: true,
    data_retention_days: 3650,
    config: {
      endpoints: {
        flight: '/flights/{ident}',
        history_flight: '/history/flights/{ident}',
        history_aircraft: '/history/aircraft/{registration}/last_flight',
        track: '/flights/{id}/track',
        position: '/flights/{id}/position',
        route: '/flights/{id}/route',
        airports: '/airports',
        airport_flights: '/airports/{id}/flights',
      },
    },
  };
  
  private apiKey: string;
  
  constructor() {
    super();
    this.apiKey = process.env.FLIGHTAWARE_API_KEY || '';
  }
  
  isAvailable(): boolean {
    return super.isAvailable() && Boolean(this.apiKey);
  }
  
  protected async makeRequest<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    if (!this.apiKey) {
      throw new Error('FlightAware API key not configured');
    }
    
    const url = new URL(`${this.config.base_url}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    
    const response = await fetch(url.toString(), {
      headers: {
        'x-apikey': this.apiKey,
        'Accept': 'application/json',
      },
    });
    
    const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
    const rateLimitReset = response.headers.get('X-RateLimit-Reset');
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('FlightAware authentication failed: Invalid API key');
      }
      if (response.status === 403) {
        throw new Error('FlightAware access forbidden: Check subscription tier');
      }
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new Error(`Rate limited. Retry after ${retryAfter || 'unknown'} seconds`);
      }
      if (response.status === 404) {
        return { success: true, data: null, error: 'Not found', meta: { provider: this.id, cached: false, rate_limit_remaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : null } };
      }
      const errorText = await response.text();
      throw new Error(`FlightAware API error: ${response.status} ${response.statusText} - ${errorText}`);
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
    const ident = this.normalizeFlightNumber(request.flight_number);
    const date = request.date;
    
    // Try current flight first
    const response = await this.makeRequest<{ flights: FlightAwareFlight[] }>(
      `/flights/${ident}`,
      { max_pages: '1' }
    );
    
    if (!response.success || !response.data || response.data.flights.length === 0) {
      // Try historical if we have Standard+ tier
      const histResponse = await this.makeRequest<{ flights: FlightAwareFlight[] }>(
        `/history/flights/${ident}`,
        { max_pages: '1', start: date + 'T00:00:00Z', end: date + 'T23:59:59Z' }
      );
      
      if (histResponse.success && histResponse.data && histResponse.data.flights.length > 0) {
        return this.parseFlightResponse(histResponse.data.flights[0], histResponse);
      }
      
      return {
        flight: null,
        aircraft: null,
        confidence: 'UNKNOWN',
        sources: [],
        raw_responses: { current: response.data, historical: histResponse.data },
      };
    }
    
    // Filter by date if multiple flights returned
    const matchingFlight = response.data.flights.find(f => 
      f.scheduled_out.startsWith(date)
    ) || response.data.flights[0];
    
    return this.parseFlightResponse(matchingFlight, response);
  }
  
  private parseFlightResponse(flightData: FlightAwareFlight, rawResponse: ApiResponse<any>): FlightLookupResult {
    const aircraft: Aircraft = {
      id: '',
      icao24: '', // Not directly provided, would need separate lookup
      registration: flightData.registration,
      aircraft_type: flightData.aircraft_type,
      type_name: flightData.aircraft_type, // Could map to full name
      operator_icao: flightData.operator_icao,
      serial_number: null,
      year_built: null,
      first_seen_at: null,
      last_seen_at: null,
      status: 'active',
    };
    
    const flight: Flight = {
      id: '',
      flight_number: flightData.ident_iata || flightData.ident,
      callsign: flightData.ident_icao,
      airline_icao: flightData.operator_icao,
      origin_icao: flightData.origin.code_icao,
      destination_icao: flightData.destination.code_icao,
      scheduled_departure: flightData.scheduled_out,
      scheduled_arrival: flightData.scheduled_in,
      actual_departure: flightData.actual_out,
      actual_arrival: flightData.actual_in,
      estimated_departure: flightData.estimated_out,
      estimated_arrival: flightData.estimated_in,
      flight_date: flightData.scheduled_out.split('T')[0],
      aircraft_id: '',
      aircraft_icao24: '',
      scheduled_aircraft_id: null,
      scheduled_aircraft_icao24: null,
      status: this.mapStatus(flightData.status),
      source: 'flightaware',
      confidence: 'HIGH',
      confidence_score: 95,
      distance_km: null,
      flight_duration_min: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    return {
      flight,
      aircraft,
      confidence: 'HIGH',
      sources: ['flightaware'],
      raw_responses: { flightaware: rawResponse.data },
    };
  }
  
  async getAircraftForFlight(flight: Flight): Promise<Aircraft | null> {
    if (!flight.aircraft_id && !flight.aircraft_icao24) return null;
    
    // Use registration if available
    if (flight.aircraft_id) {
      // Would need to get registration from our DB first
      return null;
    }
    
    return null;
  }
  
  async getAircraftFlights(icao24: string, date: string, windowHours: number = 2): Promise<AircraftFlightsResult> {
    // FlightAware has /history/aircraft/{registration}/last_flight
    // But not by ICAO24 directly
    return {
      legs: [],
      aircraft: null,
      rotation_date: date,
      confidence: 'UNKNOWN',
    };
  }
  
  async getFlightTrack(icao24: string, time: number): Promise<FlightTrackResult> {
    // Would need fa_flight_id first
    return { track: null, confidence: 'UNKNOWN' };
  }
  
  async getAirport(icao: string): Promise<Airport | null> {
    const response = await this.makeRequest<Airport>(`/airports/${icao}`);
    return response.data || null;
  }
  
  async getAirline(icao: string): Promise<Airline | null> {
    const response = await this.makeRequest<Airline>(`/operators/${icao}`);
    return response.data || null;
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
    };
    return statusMap[status.toLowerCase()] || 'unknown';
  }
  
  // Additional methods
  
  async getHistoricalFlight(ident: string, start: string, end: string): Promise<FlightAwareFlight | null> {
    const response = await this.makeRequest<{ flights: FlightAwareFlight[] }>(
      `/history/flights/${ident}`,
      { start, end, max_pages: '1' }
    );
    return response.data?.flights[0] || null;
  }
  
  async getAircraftLastFlight(registration: string): Promise<FlightAwareFlight | null> {
    const response = await this.makeRequest<FlightAwareFlight>(
      `/history/aircraft/${registration}/last_flight`
    );
    return response.data || null;
  }
  
  async getFlightTrackById(faFlightId: string): Promise<FlightTrackResult> {
    const response = await this.makeRequest<{ positions: any[] }>(
      `/flights/${faFlightId}/track`
    );
    
    if (!response.success || !response.data) {
      return { track: null, confidence: 'UNKNOWN' };
    }
    
    const track: FlightTrack = {
      id: faFlightId,
      flight_id: null,
      aircraft_leg_id: null,
      icao24: '',
      callsign: '',
      start_time: '',
      end_time: '',
      path: response.data.positions.map(p => ({
        time: new Date(p.timestamp).getTime(),
        latitude: p.latitude,
        longitude: p.longitude,
        baro_altitude: p.altitude,
        true_track: p.heading,
        on_ground: p.groundspeed === 0,
      })),
      provider: 'flightaware',
      fetched_at: new Date().toISOString(),
    };
    
    return { track, confidence: 'HIGH' };
  }
}

// Auto-register if credentials available
if (typeof process !== 'undefined' && process.env.FLIGHTAWARE_API_KEY) {
  const provider = new FlightAwareProvider();
  providerRegistry.register(provider);
}

export { FlightAwareProvider as default };