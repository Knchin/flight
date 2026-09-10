// AviationStack Provider Implementation

import type {
  DataProvider,
  Flight,
  Aircraft,
  Airport,
  Airline,
  AircraftLeg,
  FlightTrack,
  AviationStackFlight,
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

export class AviationStackProvider extends BaseProvider {
  readonly id: DataProvider = 'aviationstack';
  readonly name = 'AviationStack';
  
  readonly config: ProviderConfig = {
    id: 'aviationstack',
    name: 'AviationStack',
    base_url: 'https://api.aviationstack.com/v1',
    auth_type: 'api_key',
    enabled: true,
    rate_limit_per_day: 10000,
    rate_limit_per_minute: 100,
    commercial_use: true,
    data_retention_days: 90,
    config: {
      endpoints: {
        flights: '/flights',
        airports: '/airports',
        airlines: '/airlines',
        airplanes: '/airplanes',
      },
    },
  };
  
  private apiKey: string;
  
  constructor() {
    super();
    this.apiKey = process.env.AVIATIONSTACK_API_KEY || '';
  }
  
  isAvailable(): boolean {
    return super.isAvailable() && Boolean(this.apiKey);
  }
  
  protected async makeRequest<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    if (!this.apiKey) {
      throw new Error('AviationStack API key not configured');
    }
    
    const url = new URL(`${this.config.base_url}${endpoint}`);
    url.searchParams.set('access_key', this.apiKey);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    
    const response = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('AviationStack authentication failed');
      }
      if (response.status === 429) {
        throw new Error('Rate limited');
      }
      if (response.status === 404) {
        return { success: true, data: null, error: 'Not found', meta: { provider: this.id, cached: false, rate_limit_remaining: null } };
      }
      throw new Error(`AviationStack API error: ${response.status}`);
    }
    
    const data = await response.json() as T;
    return {
      success: true,
      data,
      error: null,
      meta: { provider: this.id, cached: false, rate_limit_remaining: null },
    };
  }
  
  async searchFlight(request: SearchRequest): Promise<FlightLookupResult> {
    const flightNumber = this.normalizeFlightNumber(request.flight_number);
    const date = request.date;
    
    // Search by flight IATA number and date
    const response = await this.makeRequest<{ data: AviationStackFlight[] }>(
      this.config.config.endpoints.flights,
      {
        flight_iata: flightNumber,
        flight_date: date,
        limit: '10',
      }
    );
    
    if (!response.success || !response.data?.data || response.data.data.length === 0) {
      return {
        flight: null,
        aircraft: null,
        confidence: 'UNKNOWN',
        sources: [],
        raw_responses: { aviationstack: response.data },
      };
    }
    
    // Take the first matching flight
    const flightData = response.data.data[0];
    return this.parseFlightResponse(flightData, response);
  }
  
  private parseFlightResponse(flightData: AviationStackFlight, rawResponse: ApiResponse<any>): FlightLookupResult {
    const aircraft: Aircraft = {
      id: '',
      icao24: flightData.aircraft?.icao24?.toLowerCase() || '',
      registration: flightData.aircraft?.registration || null,
      aircraft_type: flightData.aircraft?.icao || null,
      type_name: null, // Would need separate lookup
      operator_icao: flightData.airline?.icao || null,
      serial_number: null,
      year_built: null,
      first_seen_at: null,
      last_seen_at: null,
      status: 'active',
    };
    
    const flight: Flight = {
      id: '',
      flight_number: flightData.flight?.iata || flightData.flight?.number || '',
      callsign: flightData.flight?.icao || null,
      airline_icao: flightData.airline?.icao || null,
      origin_icao: flightData.departure?.icao || '',
      destination_icao: flightData.arrival?.icao || '',
      scheduled_departure: flightData.departure?.scheduled ? new Date(flightData.departure.scheduled).toISOString() : null,
      scheduled_arrival: flightData.arrival?.scheduled ? new Date(flightData.arrival.scheduled).toISOString() : null,
      actual_departure: flightData.departure?.actual ? new Date(flightData.departure.actual).toISOString() : null,
      actual_arrival: flightData.arrival?.actual ? new Date(flightData.arrival.actual).toISOString() : null,
      estimated_departure: flightData.departure?.estimated ? new Date(flightData.departure.estimated).toISOString() : null,
      estimated_arrival: flightData.arrival?.estimated ? new Date(flightData.arrival.estimated).toISOString() : null,
      flight_date: flightData.flight_date,
      aircraft_id: '',
      aircraft_icao24: flightData.aircraft?.icao24?.toLowerCase() || '',
      scheduled_aircraft_id: null,
      scheduled_aircraft_icao24: null,
      status: this.mapStatus(flightData.flight_status),
      source: 'aviationstack',
      confidence: 'MEDIUM',
      confidence_score: 70,
      distance_km: null,
      flight_duration_min: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    let confidence: ConfidenceLevel = 'MEDIUM';
    let score = 70;
    
    if (flightData.aircraft?.icao24 && flightData.aircraft?.registration) {
      confidence = 'HIGH';
      score = 85;
    }
    
    return {
      flight,
      aircraft,
      confidence,
      sources: ['aviationstack'],
      raw_responses: { aviationstack: rawResponse.data },
    };
  }
  
  async getAircraftForFlight(flight: Flight): Promise<Aircraft | null> {
    if (!flight.aircraft_icao24 && !flight.aircraft_id) return null;
    
    // AviationStack has /airplanes endpoint but not by ICAO24 directly
    return null;
  }
  
  async getAircraftFlights(icao24: string, date: string, windowHours: number = 2): Promise<AircraftFlightsResult> {
    return { legs: [], aircraft: null, rotation_date: date, confidence: 'UNKNOWN' };
  }
  
  async getFlightTrack(icao24: string, time: number): Promise<FlightTrackResult> {
    return { track: null, confidence: 'UNKNOWN' };
  }
  
  async getAirport(icao: string): Promise<Airport | null> {
    const response = await this.makeRequest<{ data: Airport[] }>(
      this.config.config.endpoints.airports,
      { icao_code: icao.toUpperCase() }
    );
    return response.data?.data?.[0] || null;
  }
  
  async getAirline(icao: string): Promise<Airline | null> {
    const response = await this.makeRequest<{ data: Airline[] }>(
      this.config.config.endpoints.airlines,
      { icao_code: icao.toUpperCase() }
    );
    return response.data?.data?.[0] || null;
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
}

// Auto-register if credentials available
if (typeof process !== 'undefined' && process.env.AVIATIONSTACK_API_KEY) {
  const provider = new AviationStackProvider();
  providerRegistry.register(provider);
}

export { AviationStackProvider as default };