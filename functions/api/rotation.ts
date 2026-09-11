// Cloudflare Pages Function - API endpoint for aircraft rotation lookup
// POST /api/rotation

import type { SearchRequest, SearchResult } from '../../src/types';
import { initializeProviders } from '../../src/providers';
import { reconstructRotation } from '../../src/services/rotation-engine';
import { getSupabase } from '../../src/lib/supabase';

// Initialize providers on first request
let providersInitialized = false;

function initProviders() {
  if (!providersInitialized) {
    initializeProviders();
    providersInitialized = true;
  }
}

export async function onRequestPost(context: any): Promise<Response> {
  const { request, env } = context;
  
  // Set up environment variables for providers
  if (env) {
    Object.assign(process.env, env);
  }
  
  initProviders();
  
  try {
    const body = await request.json() as SearchRequest;
    
    // Validate request
    if (!body.flight_number || !body.date) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: flight_number and date',
        rotation: null,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Normalize inputs
    const searchRequest: SearchRequest = {
      flight_number: body.flight_number.trim().toUpperCase(),
      date: body.date,
    };
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(searchRequest.date)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD',
        rotation: null,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Execute rotation reconstruction
    const result: SearchResult = await reconstructRotation(searchRequest, getSupabase(env));
    
    const status = result.success ? 200 : 404;
    
    return new Response(JSON.stringify(result), {
      status,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
    
  } catch (error) {
    console.error('Rotation API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      rotation: null,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Also support GET for simple queries
export async function onRequestGet(context: any): Promise<Response> {
  const { request, env } = context;
  
  if (env) {
    Object.assign(process.env, env);
  }
  
  initProviders();
  
  const url = new URL(request.url);
  const flightNumber = url.searchParams.get('flight');
  const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
  
  if (!flightNumber) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing flight parameter',
      rotation: null,
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  const searchRequest: SearchRequest = {
    flight_number: flightNumber.trim().toUpperCase(),
    date,
  };
  
  const result = await reconstructRotation(searchRequest, getSupabase(env));
  const status = result.success ? 200 : 404;
  
  return new Response(JSON.stringify(result), {
    status,
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}