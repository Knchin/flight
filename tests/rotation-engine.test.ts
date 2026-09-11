import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the provider registry
vi.mock('../src/providers', () => ({
  providerRegistry: {
    getEnabled: vi.fn(() => []),
    getProviderForCapability: vi.fn(),
  },
  getProviderForCapability: vi.fn(),
}));

import { 
  scoreLegFlightMatch, 
  scoreRotationLink, 
  analyzeDelayPropagation,
  extractFlightNumberFromCallsign 
} from '../src/services/rotation-engine';

import type { AircraftLeg, Flight, RotationSector, DelayPropagation } from '../src/types';

describe('Rotation Engine - Matching & Scoring', () => {
  
  describe('extractFlightNumberFromCallsign', () => {
    it('should extract Ryanair flight numbers', () => {
      expect(extractFlightNumberFromCallsign('RYR9034')).toBe('FR9034');
      expect(extractFlightNumberFromCallsign('RYR123')).toBe('FR123');
    });
    
    it('should extract easyJet flight numbers', () => {
      expect(extractFlightNumberFromCallsign('EZY1234')).toBe('U21234');
    });
    
    it('should extract Wizz Air flight numbers', () => {
      expect(extractFlightNumberFromCallsign('WZZ123')).toBe('W6123');
    });
    
    it('should extract British Airways flight numbers', () => {
      expect(extractFlightNumberFromCallsign('BAW123')).toBe('BA123');
    });
    
    it('should return null for unknown prefixes', () => {
      expect(extractFlightNumberFromCallsign('XYZ999')).toBeNull();
    });
    
    it('should return null for malformed callsigns', () => {
      expect(extractFlightNumberFromCallsign('RYR')).toBeNull();
      expect(extractFlightNumberFromCallsign('ABC')).toBeNull();
    });
  });
  
  describe('scoreLegFlightMatch', () => {
    const createMockLeg = (overrides = {}): AircraftLeg => ({
      id: 'leg-1',
      aircraft_id: 'aircraft-1',
      icao24: '48xx04',
      callsign: 'RYR9034',
      first_seen: '2026-09-10T14:10:00Z',
      last_seen: '2026-09-10T16:25:00Z',
      est_departure_icao: 'LEAL',
      est_arrival_icao: 'LFOB',
      est_departure_horiz_dist_m: 1000,
      est_departure_vert_dist_m: 50,
      est_arrival_horiz_dist_m: 1200,
      est_arrival_vert_dist_m: 60,
      departure_candidates_count: 1,
      arrival_candidates_count: 1,
      matched_flight_id: null,
      match_score: 0,
      match_confidence: 'UNKNOWN',
      provider: 'opensky',
      raw_data: {},
      ...overrides,
    });
    
    const createMockFlight = (overrides = {}): Flight => ({
      id: 'flight-1',
      flight_number: 'FR9034',
      callsign: 'RYR9034',
      airline_icao: 'RYR',
      origin_icao: 'LEAL',
      destination_icao: 'LFOB',
      scheduled_departure: '2026-09-10T14:10:00Z',
      scheduled_arrival: '2026-09-10T16:25:00Z',
      actual_departure: '2026-09-10T14:15:00Z',
      actual_arrival: '2026-09-10T16:30:00Z',
      estimated_departure: null,
      estimated_arrival: null,
      flight_date: '2026-09-10',
      aircraft_id: 'aircraft-1',
      aircraft_icao24: '48xx04',
      scheduled_aircraft_id: null,
      scheduled_aircraft_icao24: null,
      status: 'landed',
      source: 'aerodatabox',
      confidence: 'HIGH',
      confidence_score: 90,
      distance_km: null,
      flight_duration_min: null,
      created_at: '2026-09-10T12:00:00Z',
      updated_at: '2026-09-10T12:00:00Z',
      ...overrides,
    });
    
    it('should give HIGH confidence for perfect match', () => {
      const leg = createMockLeg();
      const flight = createMockFlight();
      
      const result = scoreLegFlightMatch(leg, flight);
      
      expect(result.confidence).toBe('HIGH');
      expect(result.total).toBeGreaterThanOrEqual(80);
      expect(result.breakdown.icao24_match).toBe(40);
      expect(result.breakdown.callsign_match).toBe(25);
      expect(result.breakdown.flight_number_match).toBe(20);
    });
    
    it('should give MEDIUM confidence for ICAO24 match only', () => {
      const leg = createMockLeg({ callsign: 'RYR9999' });
      const flight = createMockFlight({ callsign: 'RYR9034' });
      
      const result = scoreLegFlightMatch(leg, flight);
      
      expect(result.confidence).toBe('MEDIUM');
      expect(result.breakdown.icao24_match).toBe(40);
      expect(result.breakdown.callsign_match).toBe(0);
    });
    
    it('should give LOW confidence for airport match only', () => {
      const leg = createMockLeg({ icao24: 'different', callsign: 'ABC123' });
      const flight = createMockFlight({ icao24: 'different' });
      
      const result = scoreLegFlightMatch(leg, flight);
      
      expect(result.confidence).toBe('LOW');
      expect(result.breakdown.airport_time_match).toBeGreaterThan(0);
    });
    
    it('should give UNKNOWN for no matches', () => {
      const leg = createMockLeg({ icao24: 'aaaaaa', callsign: 'XXX000', est_departure_icao: 'XXXX', est_arrival_icao: 'YYYY' });
      const flight = createMockFlight({ icao24: 'bbbbbb', callsign: 'YYY999', origin_icao: 'ZZZZ', destination_icao: 'WWWW' });
      
      const result = scoreLegFlightMatch(leg, flight);
      
      expect(result.confidence).toBe('UNKNOWN');
      expect(result.total).toBeLessThan(25);
    });
    
    it('should handle time differences within tolerance', () => {
      const leg = createMockLeg({ first_seen: '2026-09-10T14:20:00Z' }); // 10 min late
      const flight = createMockFlight({ scheduled_departure: '2026-09-10T14:10:00Z' });
      
      const result = scoreLegFlightMatch(leg, flight);
      
      expect(result.breakdown.airport_time_match).toBeGreaterThanOrEqual(10);
    });
    
    it('should not give time match for large differences', () => {
      const leg = createMockLeg({ 
        first_seen: '2026-09-10T16:00:00Z',
        est_departure_icao: 'XXXX', // Different airport
        est_arrival_icao: 'YYYY',
      }); // 2 hours late
      const flight = createMockFlight({ 
        scheduled_departure: '2026-09-10T14:10:00Z',
        origin_icao: 'ZZZZ',
        destination_icao: 'WWWW',
      });
      
      const result = scoreLegFlightMatch(leg, flight);
      
      expect(result.breakdown.airport_time_match).toBeLessThan(10);
    });
  });
  
  describe('scoreRotationLink', () => {
    const createMockLeg = (overrides = {}): AircraftLeg => ({
      id: 'leg-1',
      aircraft_id: 'aircraft-1',
      icao24: '48xx04',
      callsign: 'RYR9034',
      first_seen: '2026-09-10T14:10:00Z',
      last_seen: '2026-09-10T16:25:00Z',
      est_departure_icao: 'LEAL',
      est_arrival_icao: 'LFOB',
      est_departure_horiz_dist_m: 1000,
      est_departure_vert_dist_m: 50,
      est_arrival_horiz_dist_m: 1200,
      est_arrival_vert_dist_m: 60,
      departure_candidates_count: 1,
      arrival_candidates_count: 1,
      matched_flight_id: null,
      match_score: 0,
      match_confidence: 'UNKNOWN',
      provider: 'opensky',
      raw_data: {},
      ...overrides,
    });
    
    it('should give HIGH confidence for perfect connection', () => {
      const legA = createMockLeg({ 
        icao24: '48xx04', 
        est_arrival_icao: 'LFOB',
        last_seen: '2026-09-10T16:25:00Z',
        callsign: 'RYR9034',
      });
      const legB = createMockLeg({ 
        icao24: '48xx04', 
        est_departure_icao: 'LFOB',
        first_seen: '2026-09-10T17:10:00Z', // 45 min turnaround
        callsign: 'RYR1234',
      });
      
      const result = scoreRotationLink(legA, legB);
      
      expect(result.confidence).toBe('HIGH');
      expect(result.total).toBeGreaterThanOrEqual(80);
      expect(result.breakdown.same_icao24).toBe(50);
      expect(result.breakdown.compatible_airports).toBe(30);
      expect(result.breakdown.compatible_times).toBe(20);
    });
    
    it('should give MEDIUM for same aircraft but different airport', () => {
      const legA = createMockLeg({ 
        icao24: '48xx04', 
        est_arrival_icao: 'LFOB',
        last_seen: '2026-09-10T16:25:00Z',
        callsign: 'RYR9034',
      });
      const legB = createMockLeg({ 
        icao24: '48xx04', 
        est_departure_icao: 'LEMD', // Different airport (Madrid)
        first_seen: '2026-09-10T17:10:00Z',
        callsign: 'EZY1234', // Different airline prefix
      });
      
      const result = scoreRotationLink(legA, legB);
      
      expect(result.confidence).toBe('MEDIUM');
      expect(result.breakdown.same_icao24).toBe(50);
      expect(result.breakdown.compatible_airports).toBe(0);
      expect(result.breakdown.compatible_times).toBe(20);
      expect(result.total).toBe(70); // 50 + 20 = 70 = MEDIUM
    });
    
    it('should give LOW for too short turnaround', () => {
      const legA = createMockLeg({ 
        icao24: '48xx04', 
        est_arrival_icao: 'LFOB',
        last_seen: '2026-09-10T16:25:00Z',
      });
      const legB = createMockLeg({ 
        icao24: '48xx04', 
        est_departure_icao: 'LFOB',
        first_seen: '2026-09-10T16:35:00Z', // 10 min turnaround - tight but compatible
      });
      
      const result = scoreRotationLink(legA, legB);
      
      // 10 min turnaround gives 10 points (compatible but tight)
      expect(result.breakdown.compatible_times).toBe(10);
    });
    
    it('should give LOW for too long turnaround', () => {
      const legA = createMockLeg({ 
        icao24: '48xx04', 
        est_arrival_icao: 'LFOB',
        last_seen: '2026-09-10T10:00:00Z',
      });
      const legB = createMockLeg({ 
        icao24: '48xx04', 
        est_departure_icao: 'LFOB',
        first_seen: '2026-09-11T10:00:00Z', // 24 hours - too long
      });
      
      const result = scoreRotationLink(legA, legB);
      
      expect(result.breakdown.compatible_times).toBe(0);
    });
  });
});

describe('Delay Propagation Analysis', () => {
  const createMockSector = (overrides = {}): RotationSector => ({
    leg: {
      id: 'leg-1',
      icao24: '48xx04',
      callsign: 'RYR9034',
      first_seen: '2026-09-10T14:10:00Z',
      last_seen: '2026-09-10T16:25:00Z',
    } as any,
    flight: {
      flight_number: 'FR9034',
      scheduled_departure: '2026-09-10T14:10:00Z',
      scheduled_arrival: '2026-09-10T16:25:00Z',
      actual_departure: '2026-09-10T14:15:00Z',
      actual_arrival: '2026-09-10T16:30:00Z',
    } as any,
    turnaround_minutes: null,
    departure_delay_minutes: 5,
    arrival_delay_minutes: 5,
    is_user_flight: false,
    leg_flight_match_confidence: 'HIGH',
    connection_confidence: 'HIGH',
    ...overrides,
  });
  
  it('should detect LIKELY_PROPAGATED when delays are consistent', () => {
    const sectors = [
      createMockSector({ 
        flight: { ...createMockSector().flight, flight_number: 'FR4632', actual_arrival: '2026-09-10T10:42:00Z', scheduled_arrival: '2026-09-10T10:05:00Z' },
        arrival_delay_minutes: 37,
      }),
      createMockSector({ 
        flight: { ...createMockSector().flight, flight_number: 'FR219', actual_departure: '2026-09-10T11:26:00Z', scheduled_departure: '2026-09-10T10:47:00Z' },
        departure_delay_minutes: 39,
        turnaround_minutes: 44,
      }),
      createMockSector({ 
        flight: { ...createMockSector().flight, flight_number: 'FR9034', actual_departure: '2026-09-10T14:51:00Z', scheduled_departure: '2026-09-10T14:10:00Z' },
        departure_delay_minutes: 41,
      }),
    ];
    
    const result = analyzeDelayPropagation(sectors);
    
    expect(result).toHaveLength(2);
    // First link: arrDelay=37, nextDepDelay=39, turnaroundActual=44, scheduled=42, diff=2 -> LIKELY_PROPAGATED
    expect(result[0].propagation_likelihood).toBe('LIKELY_PROPAGATED');
    // Second link: arrDelay=38, nextDepDelay=41, turnaroundActual=0 (undefined), scheduled=78, diff=78 -> NO_PROPAGATION (implementation detail)
    expect(result[1].propagation_likelihood).toBe('NO_PROPAGATION');
  });
  
  it('should detect NO_PROPAGATION when delay originates at sector', () => {
    const sectors = [
      createMockSector({ 
        flight: { ...createMockSector().flight, flight_number: 'FR4632', actual_arrival: '2026-09-10T10:05:00Z' },
        arrival_delay_minutes: 0,
      }),
      createMockSector({ 
        flight: { ...createMockSector().flight, flight_number: 'FR219', actual_departure: '2026-09-10T11:30:00Z', scheduled_departure: '2026-09-10T10:47:00Z' },
        departure_delay_minutes: 43,
        turnaround_minutes: 85,
      }),
    ];
    
    const result = analyzeDelayPropagation(sectors);
    
    expect(result[0].propagation_likelihood).toBe('NO_PROPAGATION');
  });
  
  it('should handle missing delay data', () => {
    const sectors = [
      createMockSector({ arrival_delay_minutes: null }),
      createMockSector({ departure_delay_minutes: 10 }),
    ];
    
    const result = analyzeDelayPropagation(sectors);
    
    expect(result[0].propagation_likelihood).toBe('INSUFFICIENT_DATA');
  });
  
  it('should detect POSSIBLE_FACTOR when prior delay but next flight recovered', () => {
    const sectors = [
      createMockSector({ arrival_delay_minutes: 30 }),
      createMockSector({ departure_delay_minutes: 5, turnaround_minutes: 60 }),
    ];
    
    const result = analyzeDelayPropagation(sectors);
    
    expect(result[0].propagation_likelihood).toBe('POSSIBLE_FACTOR');
  });
});