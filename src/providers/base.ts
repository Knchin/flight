// Provider abstraction interface and base classes

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
  AeroDataBoxFlight,
  AeroDataBoxAircraft,
  FlightAwareFlight,
  AviationStackFlight,
  SearchRequest,
  SearchResult,
  CompleteRotation,
  ConfidenceLevel,
  MatchScore,
  ApiResponse,
  ProviderConfig,
  Coordinates,
  TimeRange,
} from '../types';

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

// ============================================================
// PROVIDER INTERFACE
// ============================================================

export interface AviationDataProvider {
  readonly id: DataProvider;
  readonly name: string;
  readonly config: ProviderConfig;
  
  // Check if provider is available/configured
  isAvailable(): boolean;
  
  // Flight lookup by flight number + date
  searchFlight(request: SearchRequest): Promise<FlightLookupResult>;
  
  // Get aircraft details for a flight
  getAircraftForFlight(flight: Flight): Promise<Aircraft | null>;
  
  // Get all flights/legs for an aircraft on a date
  getAircraftFlights(icao24: string, date: string, windowHours?: number): Promise<AircraftFlightsResult>;
  
  // Get flight track (ADS-B trajectory)
  getFlightTrack(icao24: string, time: number): Promise<FlightTrackResult>;
  
  // Airport lookup
  getAirport(icao: string): Promise<Airport | null>;
  
  // Airline lookup
  getAirline(icao: string): Promise<Airline | null>;
  
  // Rate limit status
  getRateLimitStatus(): Promise<{ remaining: number; reset: number }>;
}

// ============================================================
// BASE PROVIDER CLASS
// ============================================================

export abstract class BaseProvider implements AviationDataProvider {
  abstract readonly id: DataProvider;
  abstract readonly name: string;
  abstract readonly config: ProviderConfig;
  
  protected abstract makeRequest<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>>;
  
  isAvailable(): boolean {
    return this.config.enabled;
  }
  
  abstract searchFlight(request: SearchRequest): Promise<FlightLookupResult>;
  abstract getAircraftForFlight(flight: Flight): Promise<Aircraft | null>;
  abstract getAircraftFlights(icao24: string, date: string, windowHours?: number): Promise<AircraftFlightsResult>;
  abstract getFlightTrack(icao24: string, time: number): Promise<FlightTrackResult>;
  abstract getAirport(icao: string): Promise<Airport | null>;
  abstract getAirline(icao: string): Promise<Airline | null>;
  
  async getRateLimitStatus(): Promise<{ remaining: number; reset: number }> {
    return { remaining: -1, reset: -1 };
  }
  
  protected calculateConfidence(scores: Partial<Record<keyof MatchScore['breakdown'], number>>): ConfidenceLevel {
    const total = Object.values(scores).reduce((sum, v) => sum + (v || 0), 0);
    if (total >= 80) return 'HIGH';
    if (total >= 50) return 'MEDIUM';
    if (total >= 25) return 'LOW';
    return 'UNKNOWN';
  }
  
  protected normalizeFlightNumber(flightNumber: string): string {
    return flightNumber.trim().toUpperCase().replace(/\s+/g, '');
  }
  
  protected parseDate(dateStr: string): Date {
    // Handle various date formats
    const cleaned = dateStr.replace('Z', '+00:00').replace(' ', 'T');
    return new Date(cleaned);
  }
  
  protected formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
  
  protected formatDateTime(date: Date): string {
    return date.toISOString();
  }
}

// ============================================================
// PROVIDER REGISTRY
// ============================================================

export class ProviderRegistry {
  private providers: Map<DataProvider, AviationDataProvider> = new Map();
  private enabledProviders: DataProvider[] = [];
  
  register(provider: AviationDataProvider): void {
    this.providers.set(provider.id, provider);
    if (provider.isAvailable()) {
      this.enabledProviders.push(provider.id);
    }
  }
  
  get(id: DataProvider): AviationDataProvider | undefined {
    return this.providers.get(id);
  }
  
  getAll(): AviationDataProvider[] {
    return Array.from(this.providers.values());
  }
  
  getEnabled(): AviationDataProvider[] {
    return this.enabledProviders.map(id => this.providers.get(id)!).filter(Boolean);
  }
  
  getEnabledIds(): DataProvider[] {
    return [...this.enabledProviders];
  }
  
  async searchAll(request: SearchRequest): Promise<FlightLookupResult[]> {
    const results: FlightLookupResult[] = [];
    const providers = this.getEnabled();
    
    // Run searches in parallel
    await Promise.allSettled(
      providers.map(async (provider) => {
        try {
          const result = await provider.searchFlight(request);
          if (result.flight) {
            results.push(result);
          }
        } catch (error) {
          console.error(`${provider.name} search failed:`, error);
        }
      })
    );
    
    return results;
  }
  
  async getAircraftFlightsAll(icao24: string, date: string, windowHours = 2): Promise<AircraftFlightsResult[]> {
    const results: AircraftFlightsResult[] = [];
    const providers = this.getEnabled().filter(p => p.id === 'opensky'); // Only OpenSky has this capability
    
    await Promise.allSettled(
      providers.map(async (provider) => {
        try {
          const result = await provider.getAircraftFlights(icao24, date, windowHours);
          if (result.legs.length > 0) {
            results.push(result);
          }
        } catch (error) {
          console.error(`${provider.name} aircraft flights failed:`, error);
        }
      })
    );
    
    return results;
  }
}

// Global registry instance
export const providerRegistry = new ProviderRegistry();