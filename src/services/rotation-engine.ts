// Rotation Engine - Core logic for aircraft rotation reconstruction

import type {
  Flight,
  Aircraft,
  AircraftLeg,
  CompleteRotation,
  RotationSector,
  DelayPropagation,
  ConfidenceLevel,
  SearchRequest,
  SearchResult,
  SearchDebugInfo,
  MatchScore,
  RotationLinkScore,
  DataProvider,
  FlightStatus,
} from '../types';
import { providerRegistry, getProviderForCapability } from '../providers';
import { TypedSupabaseClient } from '../lib/supabase';

// ============================================================
// MATCHING & SCORING
// ============================================================

/**
 * Score the match between an ADS-B leg and a scheduled flight
 */
export function scoreLegFlightMatch(leg: AircraftLeg, flight: Flight): MatchScore {
  const breakdown = {
    registration_match: 0,
    icao24_match: 0,
    callsign_match: 0,
    flight_number_match: 0,
    airport_time_match: 0,
    aircraft_type_match: 0,
    provider_confirmation: 0,
  };
  
  // ICAO24 exact match (strongest signal)
  if (leg.icao24 && flight.aircraft_icao24 && 
      leg.icao24.toLowerCase() === flight.aircraft_icao24.toLowerCase()) {
    breakdown.icao24_match = 40;
  }
  
  // Registration match (if available)
  if (leg.raw_data?.registration && flight.aircraft_id) {
    // Would need aircraft registration from DB
    breakdown.registration_match = 50;
  }
  
  // Callsign match (e.g., RYR9034)
  if (leg.callsign && flight.callsign) {
    const legCallsign = leg.callsign.trim().toUpperCase();
    const flightCallsign = flight.callsign.trim().toUpperCase();
    if (legCallsign === flightCallsign) {
      breakdown.callsign_match = 25;
    } else if (legCallsign.includes(flightCallsign) || flightCallsign.includes(legCallsign)) {
      breakdown.callsign_match = 15;
    }
  }
  
  // Flight number match (from callsign)
  if (leg.callsign && flight.flight_number) {
    const legNum = extractFlightNumberFromCallsign(leg.callsign);
    if (legNum && legNum === flight.flight_number) {
      breakdown.flight_number_match = 20;
    }
  }
  
  // Airport/time compatibility
  if (leg.est_departure_icao && flight.origin_icao &&
      leg.est_departure_icao === flight.origin_icao) {
    breakdown.airport_time_match += 10;
  }
  if (leg.est_arrival_icao && flight.destination_icao &&
      leg.est_arrival_icao === flight.destination_icao) {
    breakdown.airport_time_match += 10;
  }
  
  // Time compatibility (within reasonable window)
  if (flight.scheduled_departure && leg.first_seen) {
    const schedDep = new Date(flight.scheduled_departure).getTime();
    const actualDep = new Date(leg.first_seen).getTime();
    const diffMinutes = Math.abs(schedDep - actualDep) / 60000;
    if (diffMinutes <= 60) breakdown.airport_time_match += 10;
    else if (diffMinutes <= 180) breakdown.airport_time_match += 5;
  }
  
  // Aircraft type match (if available)
  if (leg.raw_data?.aircraft_type && flight.aircraft_id) {
    breakdown.aircraft_type_match = 10;
  }
  
  // Multi-provider confirmation (would be set during fusion)
  // breakdown.provider_confirmation = ...;
  
  const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  
  let confidence: ConfidenceLevel = 'UNKNOWN';
  if (total >= 80) confidence = 'HIGH';
  else if (total >= 50) confidence = 'MEDIUM';
  else if (total >= 25) confidence = 'LOW';
  
  return { total, breakdown, confidence };
}

/**
 * Score the connection between two consecutive legs
 */
export function scoreRotationLink(legA: AircraftLeg, legB: AircraftLeg): RotationLinkScore {
  const breakdown = {
    same_icao24: 0,
    compatible_airports: 0,
    compatible_times: 0,
    same_callsign_prefix: 0,
    multi_provider: 0,
  };
  
  // Same aircraft (ICAO24)
  if (legA.icao24 === legB.icao24) {
    breakdown.same_icao24 = 50;
  }
  
  // Compatible airports: legA arrival = legB departure
  if (legA.est_arrival_icao && legB.est_departure_icao &&
      legA.est_arrival_icao === legB.est_departure_icao) {
    breakdown.compatible_airports = 30;
  }
  
  // Compatible turnaround time (20 min to 6 hours)
  const turnaroundMinutes = (new Date(legB.first_seen).getTime() - new Date(legA.last_seen).getTime()) / 60000;
  if (turnaroundMinutes >= 20 && turnaroundMinutes <= 360) {
    breakdown.compatible_times = 20;
  } else if (turnaroundMinutes >= 10 && turnaroundMinutes <= 720) {
    breakdown.compatible_times = 10;
  }
  
  // Same airline prefix in callsign
  if (legA.callsign && legB.callsign) {
    const prefixA = legA.callsign.trim().slice(0, 3).toUpperCase();
    const prefixB = legB.callsign.trim().slice(0, 3).toUpperCase();
    if (prefixA === prefixB && prefixA.length === 3) {
      breakdown.same_callsign_prefix = 10;
    }
  }
  
  const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  
  let confidence: ConfidenceLevel = 'UNKNOWN';
  if (total >= 80) confidence = 'HIGH';
  else if (total >= 50) confidence = 'MEDIUM';
  else if (total >= 25) confidence = 'LOW';
  
  return { total, breakdown, confidence };
}

/**
 * Extract flight number from callsign (e.g., "RYR9034" -> "FR9034")
 * This is airline-specific; Ryanair uses RYR prefix with FR flight numbers
 */
/**
 * Extract flight number from callsign (e.g., "RYR9034" -> "FR9034")
 * This is airline-specific; Ryanair uses RYR prefix with FR flight numbers
 */
export function extractFlightNumberFromCallsign(callsign: string): string | null {
  // Common patterns:
  // RYR9034 -> FR9034 (Ryanair)
  // EZY1234 -> U21234 (easyJet)
  // WZZ123 -> W6123 (Wizz Air)
  // BAW123 -> BA123 (British Airways)
  // AFR123 -> AF123 (Air France)
  // DLH123 -> LH123 (Lufthansa)
  // IBE123 -> IB123 (Iberia)
  // KLM123 -> KL123 (KLM)
  // VLG123 -> VY123 (Vueling)
  // EXS123 -> LS123 (Jet2)
  // TOM123 -> BY123 (TUI)
  
  const prefixMap: Record<string, string> = {
    'RYR': 'FR',
    'EZY': 'U2',
    'WZZ': 'W6',
    'BAW': 'BA',
    'AFR': 'AF',
    'DLH': 'LH',
    'IBE': 'IB',
    'KLM': 'KL',
    'VLG': 'VY',
    'EXS': 'LS',
    'TOM': 'BY',
    'VOE': 'V7',
    'NOZ': 'N4',
    'TVF': 'T7',
    'TRA': 'HV',
  };
  
  const prefix = callsign.slice(0, 3).toUpperCase();
  const iataPrefix = prefixMap[prefix];
  
  if (iataPrefix) {
    const numPart = callsign.slice(3);
    if (/^\d+$/.test(numPart)) {
      return iataPrefix + numPart;
    }
  }
  
  // If no mapping, return as-is if it looks like a flight number
  if (/^[A-Z]{2}\d+$/.test(callsign)) {
    return callsign;
  }
  
  return null;
}

// ============================================================
// DELAY PROPAGATION ANALYSIS
// ============================================================

export function analyzeDelayPropagation(sectors: RotationSector[]): DelayPropagation[] {
  const propagations: DelayPropagation[] = [];
  
  for (let i = 0; i < sectors.length - 1; i++) {
    const current = sectors[i];
    const next = sectors[i + 1];
    
    const arrDelay = current.arrival_delay_minutes;
    const nextDepDelay = next.departure_delay_minutes;
    
    let likelihood: DelayPropagation['propagation_likelihood'] = 'INSUFFICIENT_DATA';
    let explanation = '';
    
    if (arrDelay === null || nextDepDelay === null) {
      likelihood = 'INSUFFICIENT_DATA';
      explanation = 'Missing actual arrival or departure time for delay calculation';
    } else if (arrDelay > 15 && nextDepDelay > 15) {
      // Both delayed significantly
      // Turnaround is stored on the NEXT sector (the departing sector)
      const turnaroundActual = next.turnaround_minutes || 0;
      const turnaroundScheduled = calculateScheduledTurnaround(current, next);
      
      if (turnaroundScheduled && Math.abs(turnaroundActual - turnaroundScheduled) <= 30) {
        // Turnaround maintained despite delays - likely propagation
        likelihood = 'LIKELY_PROPAGATED';
        explanation = `Aircraft arrived ${arrDelay} min late and next flight departed ${nextDepDelay} min late with similar turnaround time (${turnaroundActual} min actual vs ${turnaroundScheduled} min scheduled). Consistent with delay propagation.`;
      } else {
        likelihood = 'CONSISTENT_WITH';
        explanation = `Aircraft arrived ${arrDelay} min late and next flight departed ${nextDepDelay} min late. Consistent with delay propagation but turnaround time changed significantly.`;
      }
    } else if (arrDelay > 15 && nextDepDelay <= 15) {
      // Aircraft arrived late but next flight departed on time (recovered)
      likelihood = 'POSSIBLE_FACTOR';
      explanation = `Aircraft arrived ${arrDelay} min late but next flight departed on time (${nextDepDelay} min delay). Delay may have been absorbed during turnaround.`;
    } else if (arrDelay <= 15 && nextDepDelay > 15) {
      // Aircraft on time but next flight delayed (new delay)
      likelihood = 'NO_PROPAGATION';
      explanation = `Aircraft arrived on time (${arrDelay} min) but next flight departed ${nextDepDelay} min late. Delay likely originated at this sector, not propagated.`;
    } else {
      likelihood = 'NO_PROPAGATION';
      explanation = 'No significant delays detected in this connection';
    }
    
    propagations.push({
      sector_index: i,
      flight_number: next.flight?.flight_number || next.leg.callsign || 'UNKNOWN',
      arrival_delay_minutes: arrDelay,
      departure_delay_minutes: nextDepDelay,
      propagation_likelihood: likelihood,
      explanation,
    });
  }
  
  return propagations;
}

function calculateScheduledTurnaround(current: RotationSector, next: RotationSector): number | null {
  if (!current.flight?.scheduled_arrival || !next.flight?.scheduled_departure) return null;
  return (new Date(next.flight.scheduled_departure).getTime() - new Date(current.flight.scheduled_arrival).getTime()) / 60000;
}

// ============================================================
// ROTATION RECONSTRUCTION
// ============================================================

export async function reconstructRotation(
  request: SearchRequest,
  supabase: TypedSupabaseClient
): Promise<SearchResult> {
  const startTime = Date.now();
  const debugInfo: SearchDebugInfo = {
    search_key: `${request.flight_number}|${request.date}`,
    flight_found: false,
    aircraft_identified: false,
    aircraft_icao24: null,
    aircraft_registration: null,
    aircraft_confidence: 'UNKNOWN',
    previous_sectors: 0,
    following_sectors: 0,
    providers_used: [],
    cache_hit: false,
    provider_calls: 0,
    execution_time_ms: 0,
  };
  
  try {
    // Step 1: Check cache first
    const cacheKey = `${request.flight_number}|${request.date}`;
    const cached = await getCachedRotation(cacheKey, supabase);
    if (cached) {
      debugInfo.cache_hit = true;
      debugInfo.execution_time_ms = Date.now() - startTime;
      return { success: true, rotation: cached, error: null, debug_info: debugInfo };
    }
    
    // Step 2: Find the requested flight using flight lookup providers
    const flightLookupProvider = getProviderForCapability('flight_lookup');
    if (!flightLookupProvider) {
      throw new Error('No flight lookup provider available. Configure AERODATABOX_API_KEY, FLIGHTAWARE_API_KEY, or AVIATIONSTACK_API_KEY');
    }
    
    debugInfo.providers_used.push(flightLookupProvider.id);
    debugInfo.provider_calls++;
    
    const lookupResult = await flightLookupProvider.searchFlight(request);
    
    if (!lookupResult.flight) {
      return {
        success: false,
        rotation: null,
        error: `Flight ${request.flight_number} not found on ${request.date}`,
        debug_info: { ...debugInfo, execution_time_ms: Date.now() - startTime },
      };
    }
    
    debugInfo.flight_found = true;
    
    const flight = lookupResult.flight;
    const aircraft = lookupResult.aircraft;
    
    // Step 3: Identify the aircraft
    let identifiedAircraft: Aircraft | null = aircraft;
    let aircraftConfidence: ConfidenceLevel = lookupResult.confidence;
    let aircraftIcao24 = flight.aircraft_icao24;
    let aircraftRegistration = flight.aircraft_id; // Would be resolved
    
    if (aircraftIcao24) {
      debugInfo.aircraft_identified = true;
      debugInfo.aircraft_icao24 = aircraftIcao24;
      debugInfo.aircraft_confidence = aircraftConfidence;
    }
    
    // Step 4: Get aircraft's complete daily rotation from OpenSky
    const rotationProvider = getProviderForCapability('aircraft_rotation');
    if (!rotationProvider) {
      throw new Error('No aircraft rotation provider available. Configure OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET');
    }
    
    debugInfo.providers_used.push(rotationProvider.id);
    debugInfo.provider_calls++;
    
    const rotationResult = await rotationProvider.getAircraftFlights(
      aircraftIcao24!,
      request.date,
      2 // 2-hour window around midnight
    );
    
    if (!rotationResult.legs || rotationResult.legs.length === 0) {
      return {
        success: false,
        rotation: null,
        error: `No ADS-B data found for aircraft ${aircraftIcao24} on ${request.date}`,
        debug_info: { ...debugInfo, execution_time_ms: Date.now() - startTime },
      };
    }
    
    // Step 5: Match legs to scheduled flights
    const matchedSectors = await matchLegsToFlights(
      rotationResult.legs,
      flight,
      request.date,
      supabase
    );
    
    // Step 6: Find the requested flight in the rotation
    const userFlightIndex = matchedSectors.findIndex(s => s.is_user_flight);
    debugInfo.previous_sectors = Math.max(0, userFlightIndex);
    debugInfo.following_sectors = matchedSectors.length - debugInfo.previous_sectors - 1;
    
    // Step 7: Calculate delays and propagation
    const delayPropagation = analyzeDelayPropagation(matchedSectors);
    
    // Step 8: Build complete rotation
    const rotation: CompleteRotation = {
      aircraft: identifiedAircraft || {
        id: '',
        icao24: aircraftIcao24!,
        registration: aircraftRegistration,
        aircraft_type: null,
        type_name: null,
        operator_icao: flight.airline_icao,
        serial_number: null,
        year_built: null,
        first_seen_at: null,
        last_seen_at: null,
        status: 'active',
      },
      aircraft_identification_confidence: aircraftConfidence,
      date: request.date,
      sectors: matchedSectors,
      delay_propagation: delayPropagation,
      data_sources: [...new Set(debugInfo.providers_used)],
      cache_hit: false,
      providers_queried: debugInfo.providers_used,
      generated_at: new Date().toISOString(),
      warnings: [],
    };
    
    // Add warnings for data quality issues
    if (matchedSectors.some(s => !s.flight)) {
      rotation.warnings.push('Some sectors could not be matched to scheduled flights');
    }
    if (rotationResult.confidence === 'LOW') {
      rotation.warnings.push('Low confidence in ADS-B sector data');
    }
    if (debugInfo.previous_sectors === 0 && debugInfo.following_sectors === 0) {
      rotation.warnings.push('Only one sector found for this aircraft today');
    }
    
    // Step 9: Cache the result
    await cacheRotation(cacheKey, rotation, supabase);
    
    debugInfo.execution_time_ms = Date.now() - startTime;
    
    return { success: true, rotation, error: null, debug_info: debugInfo };
    
  } catch (error) {
    debugInfo.execution_time_ms = Date.now() - startTime;
    return {
      success: false,
      rotation: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      debug_info: debugInfo,
    };
  }
}

async function matchLegsToFlights(
  legs: AircraftLeg[],
  userFlight: Flight,
  date: string,
  supabase: TypedSupabaseClient
): Promise<RotationSector[]> {
  // Get all scheduled flights for this date from our database
  const { data: scheduledFlights } = await supabase
    .from('flights')
    .select('*')
    .eq('flight_date', date);
  
  const flightMap = new Map(scheduledFlights?.map(f => [f.id, f]) || []);
  
  const sectors: RotationSector[] = [];
  
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    let bestMatch: Flight | null = null;
    let bestScore = 0;
    let bestConfidence: ConfidenceLevel = 'UNKNOWN';
    
    // Try to match with scheduled flights
    for (const scheduledFlight of scheduledFlights || []) {
      const score = scoreLegFlightMatch(leg, scheduledFlight);
      if (score.total > bestScore) {
        bestScore = score.total;
        bestMatch = scheduledFlight;
        bestConfidence = score.confidence;
      }
    }
    
    // Check if this is the user's flight
    const isUserFlight = bestMatch?.flight_number === userFlight.flight_number &&
                         bestMatch?.origin_icao === userFlight.origin_icao &&
                         bestMatch?.destination_icao === userFlight.destination_icao;
    
    // Calculate turnaround from previous sector
    let turnaroundMinutes: number | null = null;
    if (i > 0) {
      const prevLeg = legs[i - 1];
      turnaroundMinutes = (new Date(leg.first_seen).getTime() - new Date(prevLeg.last_seen).getTime()) / 60000;
    }
    
    // Calculate delays
    let departureDelay: number | null = null;
    let arrivalDelay: number | null = null;
    
    if (bestMatch) {
      if (bestMatch.actual_departure && bestMatch.scheduled_departure) {
        departureDelay = (new Date(bestMatch.actual_departure).getTime() - new Date(bestMatch.scheduled_departure).getTime()) / 60000;
      }
      if (bestMatch.actual_arrival && bestMatch.scheduled_arrival) {
        arrivalDelay = (new Date(bestMatch.actual_arrival).getTime() - new Date(bestMatch.scheduled_arrival).getTime()) / 60000;
      }
    }
    
    // Connection confidence with previous sector
    let connectionConfidence: ConfidenceLevel = 'UNKNOWN';
    if (i > 0) {
      connectionConfidence = scoreRotationLink(legs[i - 1], leg).confidence;
    }
    
    sectors.push({
      leg,
      flight: bestMatch,
      turnaround_minutes: turnaroundMinutes ? Math.round(turnaroundMinutes) : null,
      departure_delay_minutes: departureDelay ? Math.round(departureDelay) : null,
      arrival_delay_minutes: arrivalDelay ? Math.round(arrivalDelay) : null,
      is_user_flight: isUserFlight,
      leg_flight_match_confidence: bestConfidence,
      connection_confidence: connectionConfidence,
    });
  }
  
  return sectors;
}

// ============================================================
// CACHING
// ============================================================

async function getCachedRotation(key: string, supabase: TypedSupabaseClient): Promise<CompleteRotation | null> {
  const { data } = await supabase
    .from('search_cache')
    .select('result_data, expires_at')
    .eq('search_key', key)
    .gt('expires_at', new Date().toISOString())
    .single();
  
  if (data) {
    return data.result_data as CompleteRotation;
  }
  return null;
}

async function cacheRotation(key: string, rotation: CompleteRotation, supabase: TypedSupabaseClient): Promise<void> {
  // Cache for 1 hour for today, 24 hours for past dates
  const isToday = rotation.date === new Date().toISOString().split('T')[0];
  const ttlHours = isToday ? 1 : 24;
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();
  
  await supabase.from('search_cache').upsert({
    search_key: key,
    flight_number: rotation.sectors.find(s => s.is_user_flight)?.flight?.flight_number || key.split('|')[0],
    flight_date: rotation.date,
    result_data: rotation,
    providers_used: rotation.providers_queried,
    cache_hit: false,
    expires_at: expiresAt,
  });
}

export { reconstructRotation as default };