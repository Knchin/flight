#!/usr/bin/env node
/**
 * Refresh Rotations for Recently Searched Flights
 * 
 * Called after nightly ingestion to ensure rotations are up-to-date
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getRotationCacheKeys(limit = 100) {
  const { data, error } = await supabase
    .from('rotation_cache')
    .select('icao24, rotation_date, expires_at')
    .gt('expires_at', new Date().toISOString())
    .order('computed_at', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
}

async function refreshRotation(icao24, date) {
  // Mark cache as expired to force refresh on next search
  const { error } = await supabase
    .from('rotation_cache')
    .update({ expires_at: new Date().toISOString() })
    .eq('icao24', icao24)
    .eq('rotation_date', date);
  
  if (error) throw error;
  return true;
}

async function main() {
  console.log(`Starting rotation refresh at ${new Date().toISOString()}`);
  
  try {
    const cacheEntries = await getRotationCacheKeys(200);
    console.log(`Found ${cacheEntries.length} cached rotations`);
    
    let refreshed = 0;
    for (const entry of cacheEntries) {
      try {
        await refreshRotation(entry.icao24, entry.rotation_date);
        refreshed++;
        await new Promise(r => setTimeout(r, 50));
      } catch (err) {
        console.error(`Failed to refresh ${entry.icao24}:`, err.message);
      }
    }
    
    console.log(`Refreshed ${refreshed} rotation cache entries`);
  } catch (error) {
    console.error('Refresh failed:', error);
    process.exit(1);
  }
}

main();