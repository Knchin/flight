#!/usr/bin/env node
/**
 * Nightly Aviation Data Ingestion
 * 
 * This script runs via GitHub Actions to:
 * 1. Refresh aircraft rotations for recently searched flights
 * 2. Update airport/airline reference data
 * 3. Log sync runs
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FORCE_REFRESH = process.env.FORCE_REFRESH === 'true';

async function logSyncRun(jobName, provider, status, stats = {}) {
  const { error } = await supabase.from('sync_runs').insert({
    job_name: jobName,
    provider,
    status,
    records_fetched: stats.fetched || 0,
    records_inserted: stats.inserted || 0,
    records_updated: stats.updated || 0,
    records_failed: stats.failed || 0,
    error_message: stats.error || null,
    started_at: stats.startedAt || new Date().toISOString(),
    completed_at: new Date().toISOString(),
    duration_ms: stats.duration || 0,
  });
  if (error) console.error('Failed to log sync run:', error);
}

async function getRecentlySearchedFlights(days = 7, limit = 100) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('search_cache')
    .select('flight_number, flight_date, aircraft_icao24:result_data->aircraft->icao24')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
}

async function refreshAircraftRotation(icao24, date) {
  // This would call the rotation reconstruction logic
  // For now, we just mark it for refresh
  console.log(`Would refresh rotation for ${icao24} on ${date}`);
  return { success: true };
}

async function updateAirportsFromAeroDataBox() {
  if (!process.env.AERODATABOX_API_KEY) {
    console.log('AeroDataBox not configured, skipping airport update');
    return { inserted: 0, updated: 0 };
  }
  
  // This would fetch airports from AeroDataBox and upsert
  // Placeholder for now
  console.log('Updating airports from AeroDataBox...');
  return { inserted: 0, updated: 0 };
}

async function updateAirlinesFromAeroDataBox() {
  if (!process.env.AERODATABOX_API_KEY) {
    console.log('AeroDataBox not configured, skipping airline update');
    return { inserted: 0, updated: 0 };
  }
  
  console.log('Updating airlines from AeroDataBox...');
  return { inserted: 0, updated: 0 };
}

async function main() {
  const startTime = Date.now();
  console.log(`Starting nightly ingestion at ${new Date().toISOString()}`);
  
  try {
    // Log start
    await logSyncRun('nightly_ingestion', 'multiple', 'started', { startedAt: new Date().toISOString() });
    
    // 1. Update reference data
    console.log('\n=== Updating Reference Data ===');
    await updateAirportsFromAeroDataBox();
    await updateAirlinesFromAeroDataBox();
    
    // 2. Get recently searched flights
    console.log('\n=== Checking Recent Searches ===');
    const recentSearches = await getRecentlySearchedFlights(7, 50);
    console.log(`Found ${recentSearches.length} recent searches`);
    
    // 3. Refresh rotations for unique aircraft
    const uniqueAircraft = new Map();
    for (const search of recentSearches) {
      const icao24 = search.result_data?.aircraft?.icao24;
      if (icao24) {
        const key = `${icao24}|${search.flight_date}`;
        if (!uniqueAircraft.has(key)) {
          uniqueAircraft.set(key, { icao24, date: search.flight_date });
        }
      }
    }
    
    console.log(`\n=== Refreshing ${uniqueAircraft.size} Aircraft Rotations ===`);
    let refreshed = 0;
    for (const { icao24, date } of uniqueAircraft.values()) {
      try {
        await refreshAircraftRotation(icao24, date);
        refreshed++;
        // Rate limiting
        await new Promise(r => setTimeout(r, 100));
      } catch (err) {
        console.error(`Failed to refresh ${icao24} on ${date}:`, err.message);
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`\nCompleted in ${duration}ms. Refreshed ${refreshed} rotations.`);
    
    await logSyncRun('nightly_ingestion', 'multiple', 'success', {
      fetched: recentSearches.length,
      inserted: refreshed,
      duration,
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Ingestion failed:', error);
    await logSyncRun('nightly_ingestion', 'multiple', 'failed', {
      error: error.message,
      duration,
    });
    process.exit(1);
  }
}

main();