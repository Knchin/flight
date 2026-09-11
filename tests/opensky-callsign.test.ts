import { describe, it, expect } from 'vitest';
import { buildCallsignCandidates } from '../src/providers/opensky';

describe('buildCallsignCandidates', () => {
  it('should map IATA flight number to ICAO callsign', () => {
    expect(buildCallsignCandidates('FR9034')).toContain('RYR9034');
  });

  it('should keep IATA form as a candidate too', () => {
    expect(buildCallsignCandidates('FR9034')).toContain('FR9034');
  });

  it('should map multiple known IATA prefixes', () => {
    expect(buildCallsignCandidates('U2')).toBeDefined();
    expect(buildCallsignCandidates('U28765')).toContain('EZY8765');
    expect(buildCallsignCandidates('W6123')).toContain('WZZ123');
    expect(buildCallsignCandidates('BA900')).toContain('BAW900');
  });

  it('should accept an ICAO-format callsign as-is', () => {
    expect(buildCallsignCandidates('RYR9034')).toEqual(['RYR9034']);
  });

  it('should handle lowercase input', () => {
    expect(buildCallsignCandidates('fr9034')).toContain('RYR9034');
  });

  it('should return empty for unparseable input', () => {
    expect(buildCallsignCandidates('abc')).toEqual([]);
    expect(buildCallsignCandidates('')).toEqual([]);
  });

  it('should handle flight numbers without digits', () => {
    expect(buildCallsignCandidates('U2')).toEqual([]);
  });
});