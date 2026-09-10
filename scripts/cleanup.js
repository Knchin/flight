#!/usr/bin/env node
/**
 * Cleanup Old Data
 * 
 * Removes expired cache entries and old sync run logs
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanupSearchCache() {
  const { error, count } = await supabase
    .from('search_cache')
    .delete()
    .lt('expires_at', new Date().toISOString());
  
  if (error) throw error;
  console.log(`Cleaned up ${count || 0} expired search cache entries`);
  return count || 0;
}

async function cleanupRotationCache() {
  const { error, count } = await supabase
    .from('rotation_cache')
    .delete()
    .lt('expires_at', new Date().toISOString());
  
  if (error) throw error;
  console.log(`Cleaned up ${count || 0} expired rotation cache entries`);
  return count || 0;
}

async function cleanupSyncRuns() {
  // Keep last 1000 sync runs
  const { data: oldRuns, error: selectError } = await supabase
    .from('sync_runs')
    .select('id')
    .order('started_at', { ascending: false })
    .range(1000, 10000);
  
  if (selectError) throw selectError;
  
  if (oldRuns && oldRuns.length > 0) {
    const ids = oldRuns.map(r => r.id);
    const { error, count } = await supabase
      .from('sync_runs')
      .delete()
      .in('id', ids);
    
    if (error) throw error;
    console.log(`Cleaned up ${count || 0} old sync run records`);
    return count || 0;
  }
  
  return 0;
}

async function cleanupFlightSources() {
  // Clean flight sources older than 90 days for flights that no longer exist
  const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  
  const { error, count } = await supabase
    .from('flight_sources')
    .delete()
    .lt('fetched_at', cutoff);
  
  if (error) throw error;
  console.log(`Cleaned up ${count || 0} old flight source records`);
  return count || 0;
}

async function main() {
  console.log(`Starting cleanup at ${new Date().toISOString()}`);
  
  try {
    await cleanupSearchCache();
    await cleanupRotationCache();
    await cleanupSyncRuns();
    await cleanupFlightSources();
    
    console.log('Cleanup completed successfully');
  } catch (error) {
    console.error('Cleanup failed:', error);
    process.exit(1);
  }
}

main();