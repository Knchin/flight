// Provider exports and factory

export type { AviationDataProvider, BaseProvider, ProviderRegistry } from './base';
export { providerRegistry } from './base';
export { OpenSkyProvider } from './opensky';
export { AeroDataBoxProvider } from './aerodatabox';
export { FlightAwareProvider } from './flightaware';
export { AviationStackProvider } from './aviationstack';

import { providerRegistry, ProviderRegistry } from './base';
import { OpenSkyProvider } from './opensky';
import { AeroDataBoxProvider } from './aerodatabox';
import { FlightAwareProvider } from './flightaware';
import { AviationStackProvider } from './aviationstack';

/**
 * Initialize all providers based on environment variables
 * Call this once at application startup
 */
export function initializeProviders(): ProviderRegistry {
  // Register OpenSky
  if (process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET) {
    try {
      const provider = new OpenSkyProvider();
      providerRegistry.register(provider);
      console.log('[Providers] OpenSky registered');
    } catch (e) {
      console.warn('[Providers] OpenSky registration failed:', e);
    }
  }
  
  // Register AeroDataBox
  if (process.env.AERODATABOX_API_KEY) {
    try {
      const provider = new AeroDataBoxProvider();
      providerRegistry.register(provider);
      console.log('[Providers] AeroDataBox registered');
    } catch (e) {
      console.warn('[Providers] AeroDataBox registration failed:', e);
    }
  }
  
  // Register FlightAware
  if (process.env.FLIGHTAWARE_API_KEY) {
    try {
      const provider = new FlightAwareProvider();
      providerRegistry.register(provider);
      console.log('[Providers] FlightAware registered');
    } catch (e) {
      console.warn('[Providers] FlightAware registration failed:', e);
    }
  }
  
  // Register AviationStack
  if (process.env.AVIATIONSTACK_API_KEY) {
    try {
      const provider = new AviationStackProvider();
      providerRegistry.register(provider);
      console.log('[Providers] AviationStack registered');
    } catch (e) {
      console.warn('[Providers] AviationStack registration failed:', e);
    }
  }
  
  console.log('[Providers] Enabled:', providerRegistry.getEnabledIds().join(', ') || 'none');
  return providerRegistry;
}

/**
 * Get the best provider for a specific capability
 */
export function getProviderForCapability(capability: 'flight_lookup' | 'aircraft_rotation' | 'flight_track' | 'airport_info'): ReturnType<typeof providerRegistry.get> {
  const providers = providerRegistry.getEnabled();
  
  switch (capability) {
    case 'aircraft_rotation':
      // OpenSky is the only one with /flights/aircraft
      return providers.find(p => p.id === 'opensky');
      
    case 'flight_lookup':
      // Prefer AviationStack (unblocked) > FlightAware > AeroDataBox
      // AeroDataBox is last because its Cloudflare WAF blocks requests
      // from Cloudflare Pages Functions IP ranges.
      return providers.find(p => p.id === 'aviationstack') ||
             providers.find(p => p.id === 'flightaware') ||
             providers.find(p => p.id === 'aerodatabox');
      
    case 'flight_track':
      // FlightAware has best tracks, OpenSky has experimental
      return providers.find(p => p.id === 'flightaware') ||
             providers.find(p => p.id === 'opensky');
      
    case 'airport_info':
      // AeroDataBox has good airport data
      return providers.find(p => p.id === 'aerodatabox') ||
             providers.find(p => p.id === 'aviationstack') ||
             providers.find(p => p.id === 'flightaware');
      
    default:
      return providers[0];
  }
}

export { providerRegistry as default };