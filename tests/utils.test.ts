import { describe, it, expect } from 'vitest';
import { DateTime, Zone } from 'luxon';

// Test timezone conversion utilities
describe('Date/Time Utilities', () => {
  
  describe('UTC to Airport Timezone', () => {
    it('should convert UTC to Madrid time (CEST)', () => {
      const utc = '2026-09-10T14:10:00Z';
      const madrid = DateTime.fromISO(utc, { zone: 'utc' }).setZone('Europe/Madrid');
      expect(madrid.hour).toBe(16); // CEST is UTC+2
      expect(madrid.minute).toBe(10);
    });
    
    it('should convert UTC to Madrid time (CET) in winter', () => {
      const utc = '2026-01-10T14:10:00Z';
      const madrid = DateTime.fromISO(utc, { zone: 'utc' }).setZone('Europe/Madrid');
      expect(madrid.hour).toBe(15); // CET is UTC+1
    });
    
    it('should convert UTC to Paris time', () => {
      const utc = '2026-09-10T14:10:00Z';
      const paris = DateTime.fromISO(utc, { zone: 'utc' }).setZone('Europe/Paris');
      expect(paris.hour).toBe(16); // CEST is UTC+2
    });
    
    it('should convert UTC to London time (BST)', () => {
      const utc = '2026-09-10T14:10:00Z';
      const london = DateTime.fromISO(utc, { zone: 'utc' }).setZone('Europe/London');
      expect(london.hour).toBe(15); // BST is UTC+1
    });
    
    it('should convert UTC to London time (GMT) in winter', () => {
      const utc = '2026-01-10T14:10:00Z';
      const london = DateTime.fromISO(utc, { zone: 'utc' }).setZone('Europe/London');
      expect(london.hour).toBe(14); // GMT is UTC+0
    });
    
    it('should handle US timezones', () => {
      const utc = '2026-09-10T14:10:00Z';
      const ny = DateTime.fromISO(utc, { zone: 'utc' }).setZone('America/New_York');
      expect(ny.hour).toBe(10); // EDT is UTC-4
    });
  });
  
  describe('Date parsing and formatting', () => {
    it('should parse ISO date strings correctly', () => {
      const date = DateTime.fromISO('2026-09-10');
      expect(date.year).toBe(2026);
      expect(date.month).toBe(9);
      expect(date.day).toBe(10);
    });
    
    it('should parse ISO datetime strings correctly', () => {
      const dt = DateTime.fromISO('2026-09-10T14:10:00Z');
      expect(dt.year).toBe(2026);
      expect(dt.month).toBe(9);
      expect(dt.day).toBe(10);
      expect(dt.hour).toBe(14);
      expect(dt.minute).toBe(10);
    });
    
    it('should format dates for display', () => {
      const dt = DateTime.fromISO('2026-09-10T14:10:00Z').setZone('Europe/Madrid');
      const formatted = dt.toLocaleString({ 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        timeZoneName: 'short'
      });
      expect(formatted).toContain('Sep');
      expect(formatted).toContain('10');
    });
  });
  
  describe('Turnaround calculation', () => {
    it('should calculate turnaround in minutes', () => {
      const arrival = DateTime.fromISO('2026-09-10T10:05:00Z');
      const departure = DateTime.fromISO('2026-09-10T10:47:00Z');
      const turnaround = departure.diff(arrival, 'minutes').minutes;
      expect(Math.round(turnaround)).toBe(42);
    });
    
    it('should handle overnight turnarounds', () => {
      const arrival = DateTime.fromISO('2026-09-10T23:30:00Z');
      const departure = DateTime.fromISO('2026-09-11T01:30:00Z');
      const turnaround = departure.diff(arrival, 'minutes').minutes;
      expect(Math.round(turnaround)).toBe(120);
    });
  });
  
  describe('Delay calculation', () => {
    it('should calculate departure delay', () => {
      const scheduled = DateTime.fromISO('2026-09-10T14:10:00Z');
      const actual = DateTime.fromISO('2026-09-10T14:47:00Z');
      const delay = actual.diff(scheduled, 'minutes').minutes;
      expect(Math.round(delay)).toBe(37);
    });
    
    it('should calculate negative delay (early)', () => {
      const scheduled = DateTime.fromISO('2026-09-10T14:10:00Z');
      const actual = DateTime.fromISO('2026-09-10T14:05:00Z');
      const delay = actual.diff(scheduled, 'minutes').minutes;
      expect(Math.round(delay)).toBe(-5);
    });
    
    it('should handle zero delay', () => {
      const scheduled = DateTime.fromISO('2026-09-10T14:10:00Z');
      const actual = DateTime.fromISO('2026-09-10T14:10:00Z');
      const delay = actual.diff(scheduled, 'minutes').minutes;
      expect(Math.round(delay)).toBe(0);
    });
  });
});

describe('Flight Number Normalization', () => {
  const normalizeFlightNumber = (fn: string) => fn.trim().toUpperCase().replace(/\s+/g, '');
  
  it('should handle standard format', () => {
    expect(normalizeFlightNumber('FR9034')).toBe('FR9034');
    expect(normalizeFlightNumber('BA123')).toBe('BA123');
    expect(normalizeFlightNumber('LH4567')).toBe('LH4567');
  });
  
  it('should handle lowercase', () => {
    expect(normalizeFlightNumber('fr9034')).toBe('FR9034');
    expect(normalizeFlightNumber('ba123')).toBe('BA123');
  });
  
  it('should handle spaces', () => {
    expect(normalizeFlightNumber('FR 9034')).toBe('FR9034');
    expect(normalizeFlightNumber('  FR9034  ')).toBe('FR9034');
    expect(normalizeFlightNumber('FR  9034')).toBe('FR9034');
  });
  
  it('should handle ICAO callsign format', () => {
    expect(normalizeFlightNumber('RYR9034')).toBe('RYR9034');
    expect(normalizeFlightNumber('ryr9034')).toBe('RYR9034');
  });
  
  it('should handle various airline formats', () => {
    expect(normalizeFlightNumber('U2 1234')).toBe('U21234');
    expect(normalizeFlightNumber('W6 123')).toBe('W6123');
    expect(normalizeFlightNumber('VY1234')).toBe('VY1234');
  });
});

describe('Airport Code Validation', () => {
  const isValidIcao = (code: string) => /^[A-Z]{4}$/.test(code.toUpperCase());
  const isValidIata = (code: string) => /^[A-Z]{3}$/.test(code.toUpperCase());
  
  it('should validate ICAO codes', () => {
    expect(isValidIcao('LEMD')).toBe(true);
    expect(isValidIcao('LFOB')).toBe(true);
    expect(isValidIcao('KJFK')).toBe(true);
    expect(isValidIcao('EGLL')).toBe(true);
    expect(isValidIcao('lemd')).toBe(true); // case insensitive
    expect(isValidIcao('LMD')).toBe(false);
    expect(isValidIcao('LEMDR')).toBe(false);
  });
  
  it('should validate IATA codes', () => {
    expect(isValidIata('MAD')).toBe(true);
    expect(isValidIata('BVA')).toBe(true);
    expect(isValidIata('JFK')).toBe(true);
    expect(isValidIata('LHR')).toBe(true);
    expect(isValidIata('mad')).toBe(true);
    expect(isValidIata('MA')).toBe(false);
    expect(isValidIata('MADR')).toBe(false);
  });
});

describe('ICAO24 Validation', () => {
  const isValidIcao24 = (code: string) => /^[0-9A-Fa-f]{6}$/.test(code);
  
  it('should validate ICAO24 hex codes', () => {
    expect(isValidIcao24('48AA04')).toBe(true);
    expect(isValidIcao24('3C6444')).toBe(true);
    expect(isValidIcao24('ABCDEF')).toBe(true);
    expect(isValidIcao24('abcdef')).toBe(true);
    expect(isValidIcao24('123456')).toBe(true);
    expect(isValidIcao24('GHIJKL')).toBe(false);
    expect(isValidIcao24('48XX0')).toBe(false);
    expect(isValidIcao24('48XX044')).toBe(false);
  });
});