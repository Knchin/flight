// Cloudflare Pages Function - Debug endpoint
// GET /api/debug

import { supabase } from '../../src/lib/supabase';

export async function onRequestGet(context: any): Promise<Response> {
  const { request, env } = context;
  
  if (env) {
    Object.assign(process.env, env);
  }
  
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'status';
  
  try {
    switch (action) {
      case 'status': {
        // Provider status
        const providers = [
          { id: 'opensky', configured: !!(process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET) },
          { id: 'aerodatabox', configured: !!process.env.AERODATABOX_API_KEY },
          { id: 'flightaware', configured: !!process.env.FLIGHTAWARE_API_KEY },
          { id: 'aviationstack', configured: !!process.env.AVIATIONSTACK_API_KEY },
        ];
        
        // Database stats
        const [flightsCount, aircraftCount, legsCount, cacheCount] = await Promise.all([
          supabase.from('flights').select('id', { count: 'exact', head: true }),
          supabase.from('aircraft').select('id', { count: 'exact', head: true }),
          supabase.from('aircraft_legs').select('id', { count: 'exact', head: true }),
          supabase.from('search_cache').select('id', { count: 'exact', head: true }),
        ]);
        
        return new Response(JSON.stringify({
          providers,
          database: {
            flights: flightsCount.count || 0,
            aircraft: aircraftCount.count || 0,
            aircraft_legs: legsCount.count || 0,
            search_cache: cacheCount.count || 0,
          },
          env: {
            supabase_configured: !!process.env.SUPABASE_URL,
          },
        }, null, 2), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      case 'recent-searches': {
        const { data } = await supabase
          .from('search_cache')
          .select('search_key, flight_number, flight_date, created_at, expires_at')
          .order('created_at', { ascending: false })
          .limit(20);
        
        return new Response(JSON.stringify(data, null, 2), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      case 'sync-runs': {
        const { data } = await supabase
          .from('sync_runs')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(50);
        
        return new Response(JSON.stringify(data, null, 2), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      case 'clear-cache': {
        const { error } = await supabase.from('search_cache').delete().neq('search_key', '');
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, message: 'Cache cleared' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}