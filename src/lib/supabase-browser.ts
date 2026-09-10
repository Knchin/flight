// Supabase client for browser/frontend usage

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Type-safe wrapper for common queries (browser-safe, read-only)
export async function searchFlightsBrowser(
  flightNumber: string,
  date: string
): Promise<any[]> {
  const { data, error } = await supabaseBrowser
    .from('flights')
    .select('*')
    .eq('flight_number', flightNumber.toUpperCase())
    .eq('flight_date', date)
    .order('scheduled_departure', { ascending: true, nullsFirst: false });
  
  if (error) throw error;
  return data || [];
}

export async function getAircraftBrowser(icao24: string): Promise<any | null> {
  const { data, error } = await supabaseBrowser
    .from('aircraft')
    .select('*')
    .eq('icao24', icao24.toLowerCase())
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getRotationCacheBrowser(icao24: string, date: string): Promise<any | null> {
  const { data, error } = await supabaseBrowser
    .from('rotation_cache')
    .select('rotation_data')
    .eq('icao24', icao24.toLowerCase())
    .eq('rotation_date', date)
    .gt('expires_at', new Date().toISOString())
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data?.rotation_data || null;
}

export async function getAirportsBrowser(): Promise<any[]> {
  const { data, error } = await supabaseBrowser
    .from('airports')
    .select('icao_code, iata_code, name, city, country, timezone, latitude, longitude')
    .eq('active', true)
    .order('name');
  
  if (error) throw error;
  return data || [];
}

export async function getAirlinesBrowser(): Promise<any[]> {
  const { data, error } = await supabaseBrowser
    .from('airlines')
    .select('icao_code, iata_code, name, callsign, country')
    .eq('active', true)
    .order('name');
  
  if (error) throw error;
  return data || [];
}