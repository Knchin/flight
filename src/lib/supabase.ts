// Supabase client for server-side usage (Cloudflare Pages Functions)

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy client: created on first use so that env is populated before first call
// (Cloudflare injects env via context.env per-request, not process.env).
let client: ReturnType<typeof createClient> | null = null;

export function getSupabase(env: Record<string, string | undefined> = {}) {
  if (!client) {
    const supabaseUrl =
      env.SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseServiceKey =
      env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      '';

    if (!supabaseUrl || !supabaseServiceKey) {
      const missing = [
        !supabaseUrl ? 'SUPABASE_URL' : null,
        !supabaseServiceKey ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
      ].filter(Boolean);
      throw new Error(
        `[Supabase] Missing required env var(s): ${missing.join(', ')}. ` +
        'Set them in Cloudflare Pages → Settings → Environment variables (Production) or in wrangler.toml [vars], then redeploy.',
      );
    }

    client = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return client;
}

// Type-safe wrapper for common queries
export type TypedSupabaseClient = SupabaseClient<any, 'public', any>;

// Flight queries
export async function findFlightByNumberDate(
  supabase: TypedSupabaseClient,
  flightNumber: string,
  date: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from('flights')
    .select('*')
    .eq('flight_number', flightNumber.toUpperCase())
    .eq('flight_date', date)
    .order('scheduled_departure', { ascending: true, nullsFirst: false });
  
  if (error) throw error;
  return data || [];
}

export async function getAircraftByIcao24(
  supabase: TypedSupabaseClient,
  icao24: string
): Promise<any | null> {
  const { data, error } = await supabase
    .from('aircraft')
    .select('*')
    .eq('icao24', icao24.toLowerCase())
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getAircraftLegsForDate(
  supabase: TypedSupabaseClient,
  icao24: string,
  date: string,
  windowHours: number = 2
): Promise<any[]> {
  const baseDate = new Date(date + 'T00:00:00Z');
  const begin = new Date(baseDate.getTime() - windowHours * 3600 * 1000).toISOString();
  const end = new Date(baseDate.getTime() + (24 + windowHours) * 3600 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('aircraft_legs')
    .select('*')
    .eq('icao24', icao24.toLowerCase())
    .gte('first_seen', begin)
    .lt('first_seen', end)
    .order('first_seen', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

export async function getFlightsForAircraftDate(
  supabase: TypedSupabaseClient,
  aircraftId: string,
  date: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from('flights')
    .select('*')
    .eq('aircraft_id', aircraftId)
    .eq('flight_date', date)
    .order('scheduled_departure', { ascending: true, nullsFirst: false });
  
  if (error) throw error;
  return data || [];
}

export async function upsertFlight(
  supabase: TypedSupabaseClient,
  flightData: any
): Promise<string> {
  const { data, error } = await supabase
    .from('flights')
    .upsert(flightData, {
      onConflict: 'flight_number,flight_date,origin_icao,destination_icao',
      ignoreDuplicates: false,
    })
    .select('id')
    .single();
  
  if (error) throw error;
  return data.id;
}

export async function upsertAircraft(
  supabase: TypedSupabaseClient,
  aircraftData: any
): Promise<string> {
  const { data, error } = await supabase
    .from('aircraft')
    .upsert(aircraftData, {
      onConflict: 'icao24',
      ignoreDuplicates: false,
    })
    .select('id')
    .single();
  
  if (error) throw error;
  return data.id;
}

export async function upsertAircraftLegs(
  supabase: TypedSupabaseClient,
  legs: any[]
): Promise<void> {
  if (legs.length === 0) return;
  
  const { error } = await supabase
    .from('aircraft_legs')
    .upsert(legs, {
      onConflict: 'id',
      ignoreDuplicates: false,
    });
  
  if (error) throw error;
}

export async function logSyncRun(
  supabase: TypedSupabaseClient,
  runData: {
    job_name: string;
    provider?: string;
    status: 'started' | 'success' | 'failed' | 'partial';
    records_fetched?: number;
    records_inserted?: number;
    records_updated?: number;
    records_failed?: number;
    error_message?: string;
    started_at?: string;
    completed_at?: string;
    duration_ms?: number;
  }
): Promise<void> {
  const { error } = await supabase.from('sync_runs').insert(runData);
  if (error) throw error;
}

export async function cacheSearchResult(
  supabase: TypedSupabaseClient,
  key: string,
  flightNumber: string,
  date: string,
  result: any,
  providers: string[],
  ttlHours: number
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();
  
  const { error } = await supabase.from('search_cache').upsert({
    search_key: key,
    flight_number: flightNumber,
    flight_date: date,
    result_data: result,
    providers_used: providers,
    cache_hit: false,
    expires_at: expiresAt,
  });
  
  if (error) throw error;
}

export async function getCachedSearchResult(
  supabase: TypedSupabaseClient,
  key: string
): Promise<any | null> {
  const { data, error } = await supabase
    .from('search_cache')
    .select('result_data')
    .eq('search_key', key)
    .gt('expires_at', new Date().toISOString())
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data?.result_data || null;
}