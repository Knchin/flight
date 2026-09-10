// Cloudflare Pages Function - API endpoint for methodology info
// GET /api/methodology

export async function onRequestGet(): Promise<Response> {
  const methodology = {
    title: 'Aircraft Rotation Reconstruction Methodology',
    version: '1.0',
    last_updated: '2026-09-10',
    overview: 'This application reconstructs the complete daily journey (rotation) of a physical aircraft from a user\'s flight number. The core challenge is connecting a commercial flight number to a physical aircraft (via registration/ICAO24), then finding all sectors that aircraft operated that day.',
    
    data_sources: {
      primary: {
        provider: 'OpenSky Network',
        role: 'Aircraft rotation reconstruction (ADS-B derived)',
        endpoints_used: [
          '/flights/aircraft - Returns all flights for an ICAO24 within a date range (max 2 days)',
          '/tracks - Flight trajectory (experimental, 30-day limit)',
        ],
        strengths: [
          'Direct access to ADS-B derived flight sectors',
          'No flight number lookup needed - works from ICAO24',
          'Actual departure/arrival times from ADS-B',
          'Free for non-commercial use',
        ],
        limitations: [
          'Non-commercial use only',
          'Flights updated nightly (batch process)',
          'No registration data (only ICAO24)',
          'No scheduled times (only actual from ADS-B)',
          'Estimated airports with confidence scores',
          '2-day max window per request',
          'Tracks limited to 30 days history',
        ],
      },
      secondary: {
        provider: 'AeroDataBox',
        role: 'Flight lookup by number + date, aircraft details, schedules',
        endpoints_used: [
          '/flights/number/{flightNumber}/{date} - Flight by number and date',
          '/aircrafts/reg/{reg} - Aircraft by registration',
          '/aircrafts/icao24/{icao24} - Aircraft by Mode-S',
          '/airlines/{code}/aircrafts - Airline fleet',
        ],
        strengths: [
          'Flight lookup by IATA flight number + date',
          'Registration, ICAO24, aircraft type, operator',
          'Scheduled + actual + estimated times',
          'Historical data up to 365 days',
          'Schedules up to 365 days future',
          'Affordable pricing',
        ],
        limitations: [
          'API units-based pricing (tiered)',
          'Rate limits vary by tier',
          'Data coverage not global',
        ],
      },
      tertiary: {
        provider: 'FlightAware AeroAPI',
        role: 'Deep historical data, Foresight predictions',
        endpoints_used: [
          '/flights/{ident} - Current flight by ident',
          '/history/flights/{ident} - Historical flights (Standard+)',
          '/history/aircraft/{reg}/last_flight - Aircraft last flight',
          '/flights/{id}/track - Full ADS-B track',
        ],
        strengths: [
          'Historical data from 2011',
          'Foresight predictive ETAs',
          'Global coverage',
          'Personal tier free for non-commercial',
        ],
        limitations: [
          'Historical data requires Standard+ ($100/mo)',
          'Usage-based pricing',
          'Personal tier limited to current flights',
        ],
      },
      fallback: {
        provider: 'AviationStack',
        role: 'Simple flight lookup fallback',
        strengths: ['Simple flight lookup by number + date', 'Free tier 100/mo'],
        limitations: ['Very limited free tier', 'Historical only on paid plans'],
      },
    },
    
    algorithm: {
      step_1_flight_lookup: {
        description: 'Find the requested flight by flight number and date',
        providers: ['AeroDataBox (primary)', 'FlightAware', 'AviationStack'],
        output: 'Flight details including registration, ICAO24, aircraft type, operator, scheduled/actual times',
        confidence_scoring: 'Registration + ICAO24 + callsign + flight number + airport/time match = HIGH/MEDIUM/LOW',
      },
      step_2_aircraft_identification: {
        description: 'Resolve the physical aircraft identity',
        signals: [
          'Registration exact match across providers (+50)',
          'ICAO24 exact match (+40)',
          'Callsign match (e.g., RYR9034) (+25)',
          'Flight number match (+20)',
          'Airport/time compatibility (+15)',
          'Aircraft type match (+10)',
        ],
        thresholds: 'HIGH ≥ 80, MEDIUM 50-79, LOW 25-49, UNKNOWN < 25',
      },
      step_3_rotation_reconstruction: {
        description: 'Get all ADS-B sectors for the aircraft on that date',
        provider: 'OpenSky /flights/aircraft',
        window: 'Calendar day ± 2 hours for overnight rotations',
        output: 'Chronological list of ADS-B sectors with actual times, estimated airports, callsigns',
      },
      step_4_leg_flight_matching: {
        description: 'Match each ADS-B sector to a scheduled flight',
        method: 'Multi-signal scoring (ICAO24, callsign, airports, times, flight number)',
        output: 'Each sector linked to scheduled flight (or marked as unmatched)',
      },
      step_5_rotation_assembly: {
        description: 'Build complete rotation with turnarounds and delays',
        calculations: [
          'Turnaround = Next sector departure - Current sector arrival',
          'Departure delay = Actual departure - Scheduled departure',
          'Arrival delay = Actual arrival - Scheduled arrival',
        ],
      },
      step_6_delay_propagation: {
        description: 'Analyze whether delays propagated through the rotation',
        logic: 'For each consecutive sector pair: if prior arrival delayed >15min AND next departure delayed >15min AND turnaround maintained → "Likely propagated"',
        categories: [
          'LIKELY_PROPAGATED - Strong evidence of propagation',
          'CONSISTENT_WITH - Delays align but turnaround changed',
          'POSSIBLE_FACTOR - Prior delay but next flight recovered',
          'NO_PROPAGATION - Delay originated at this sector',
          'INSUFFICIENT_DATA - Missing actual times',
        ],
      },
    },
    
    confidence_system: {
      levels: ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'],
      aircraft_identification: 'Based on multi-provider agreement on registration/ICAO24',
      leg_flight_matching: 'Based on scoring algorithm (ICAO24, callsign, airports, times)',
      rotation_links: 'Based on same ICAO24 + compatible airports + compatible turnaround',
      delay_propagation: 'Based on temporal consistency of delays across sectors',
    },
    
    limitations: [
      'OpenSky: Non-commercial only, flights updated nightly, estimated airports',
      'Aircraft swaps: Cannot detect if scheduled aircraft differs from actual without multiple sources',
      'Missing sectors: ADS-B coverage gaps may miss sectors, especially over oceans/remote areas',
      'Registration changes: Aircraft may change registration; we track by ICAO24',
      'Callsign reuse: Same callsign may be used by different aircraft on different days',
      'Timezone handling: All times stored UTC, displayed in airport local time',
      'Midnight crossings: Searches ±2 hours around midnight to capture overnight sectors',
    ],
    
    privacy_compliance: {
      opensky: 'Non-commercial use only, cite original paper',
      aerodatabox: '7-day cache standard, extended on paid plans, attribution on free',
      flightaware: 'Per tier, no redistribution of raw data',
      aviationstack: 'Per plan, attribution required',
    },
    
    example_scenario: {
      user_search: 'FR9034 on 2026-09-10',
      step_1: 'AeroDataBox finds FR9034: registration 9H-XXXX, ICAO24 48xx04, type B38M, operator RYR',
      step_2: 'OpenSky /flights/aircraft?icao24=48xx04 returns 4 sectors for 2026-09-10',
      step_3: 'Matching: Sector 1 (RYR4632 VLC→BGY) + Sector 2 (RYR219 BGY→ALC) + Sector 3 (RYR9034 ALC→BVA) + Sector 4 (RYRxxx BVA→...)',
      step_4: 'Turnarounds: 42min, 1h18m, 55min',
      step_5: 'Delays: FR4632 arr +37min → FR219 dep +39min → FR9034 dep +41min',
      step_6: 'Propagation: LIKELY_PROPAGATED (consistent delays, maintained turnarounds)',
    },
  };
  
  return new Response(JSON.stringify(methodology, null, 2), {
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}