import { beforeAll, afterAll, vi } from 'vitest';

// Mock environment variables for tests
beforeAll(() => {
  process.env.SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  process.env.OPENSKY_CLIENT_ID = 'test-client';
  process.env.OPENSKY_CLIENT_SECRET = 'test-secret';
  process.env.AERODATABOX_API_KEY = 'test-key';
  process.env.FLIGHTAWARE_API_KEY = 'test-key';
  process.env.AVIATIONSTACK_API_KEY = 'test-key';
});

// Mock fetch globally
global.fetch = vi.fn();

// Clean up after tests
afterAll(() => {
  vi.clearAllMocks();
});