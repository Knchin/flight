# Aviation Data Provider Capability Matrix

**Research Date:** 2026-09-10
**Last Updated:** 2026-09-10

---

## Executive Summary

For the aircraft rotation reconstruction use case (flight number → aircraft → complete daily rotation), the optimal provider combination is:

| Priority | Provider | Role | Key Strength |
|----------|----------|------|--------------|
| Primary | **OpenSky Network** | Aircraft rotation reconstruction | Free, `/flights/aircraft` returns all sectors for an ICAO24 in a day |
| Secondary | **AeroDataBox** | Flight lookup by number/date, schedules | Affordable, historical + scheduled data, 365-day history |
| Tertiary | **FlightAware AeroAPI** | Flight lookup, historical tracks | Deep historical data (2011+), Foresight predictions |
| Optional | **AviationStack** | Flight lookup, schedules | Simple flight lookup by flight number + date |
| Optional | **ADS-B Exchange** | Real-time ADS-B positions | 250ms updates, community API available |

---

## Detailed Capability Matrix

| Capability | OpenSky | AeroDataBox | FlightAware AeroAPI | AviationStack | ADS-B Exchange | FR24 API |
|------------|---------|-------------|---------------------|---------------|----------------|----------|
| **Flight number lookup** | ❌ | ✅ `/flights/number/{num}/{date}` | ✅ `/flights/{ident}` | ✅ `/flights?flight_iata=FR9034` | ❌ | ✅ |
| **Date-specific flight lookup** | ❌ (via `/flights/all` 2hr window) | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Aircraft registration** | ❌ (only ICAO24) | ✅ `/aircrafts/reg/{reg}` | ✅ | ✅ | ✅ | ✅ |
| **ICAO24 / Mode-S** | ✅ Core identifier | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Callsign** | ✅ In state vectors/flights | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Historical flights (by flight)** | ⚠️ `/flights/all` (2hr window only) | ✅ Up to 365 days | ✅ From 2011 (Standard+) | ✅ Last 3 months | ❌ | ✅ |
| **Historical flights (by aircraft)** | ✅ `/flights/aircraft` (2-day window, nightly batch) | ✅ Flight history endpoint | ✅ `/history/aircraft/{reg}/last_flight` | ❌ | ✅ Daily positions | ✅ |
| **Live aircraft positions** | ✅ `/states/all` | ✅ Live positions | ✅ | ✅ | ✅ 250ms | ✅ |
| **Historical ADS-B positions** | ✅ `/tracks` (30 days) | ❌ | ✅ Track endpoint | ❌ | ✅ Daily positions (paid) | ✅ |
| **Flight tracks** | ✅ `/tracks` (experimental, 30 days) | ❌ | ✅ `/flights/{id}/track` | ❌ | ✅ | ✅ |
| **Airport information** | ✅ Basic | ✅ Comprehensive | ✅ | ✅ | ✅ | ✅ |
| **Scheduled departure/arrival** | ❌ (estimated only) | ✅ Schedules up to 365 days | ✅ | ✅ | ⚠️ Operations context | ✅ |
| **Actual departure/arrival** | ✅ (from ADS-B) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Delay information** | ⚠️ Inferred from actual vs estimated | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| **Aircraft type** | ✅ Category only | ✅ Full type info | ✅ | ✅ | ✅ | ✅ |
| **Operator/Airline** | ❌ (country only) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Rate limits** | Credit-based (4000/day std) | API units (tiered) | Result sets (10/min Personal) | 100/month free | 10k/mo Community | Subscription-based |
| **Authentication** | OAuth2 client credentials | API Key (header) | API Key (x-apikey header) | API Key (query) | API Key (RapidAPI) | API Token |
| **Free tier** | ✅ Anonymous (limited) + free account | ✅ 400 units/mo (RapidAPI) / data contribution | ✅ Personal: $5/mo credit | ✅ 100 requests/mo | ✅ $10/mo Community | ❌ |
| **Data retention** | 30 days tracks, flights nightly batch | 365 days history | 2011+ (Standard+) | 3 months | 10 years (Enterprise) | Varies |
| **Commercial use** | ❌ Non-commercial only | ✅ Paid plans | ✅ Standard+ | ✅ Paid plans | ✅ Enterprise only | ✅ Paid |
| **Storage/redistribution** | ❌ Not permitted | 7 days standard, extended on paid | Per tier | Per plan | Enterprise only | 30 days max |

---

## Provider Selection Rationale

### OpenSky Network (Primary - Free)
**Why:** The `/flights/aircraft` endpoint is uniquely valuable - it returns **all flights operated by a specific ICAO24 within a date range (max 2 days)**. This is exactly what we need for rotation reconstruction.

**Limitations:**
- Non-commercial use only
- Flights updated nightly (not real-time)
- No registration data (only ICAO24)
- No scheduled times (only actual from ADS-B)
- 2-day window per request
- Tracks limited to 30 days

### AeroDataBox (Secondary - Affordable)
**Why:** Best balance of affordability and capability for flight lookup by number + date, schedules, and historical data. Direct subscription avoids marketplace markup.

**Key endpoints for our use case:**
- `/flights/number/{flightNumber}/{date}` - Find flight by number + date
- `/flights/number/{flightNumber}/{date}/{depOrArr}` - With departure/arrival context
- `/aircrafts/reg/{reg}` - Get aircraft details by registration
- `/aircrafts/icao24/{icao24}` - Get aircraft by Mode-S
- Historical flight data up to 365 days
- Schedules up to 365 days future

### FlightAware AeroAPI (Tertiary - Deep History)
**Why:** Unmatched historical depth (2011+), Foresight predictions for delay propagation analysis. Personal tier free for non-commercial.

**Key endpoints:**
- `/flights/{ident}` - Flight by ident (IATA/ICAO/callsign)
- `/history/flights/{ident}` - Historical flight (Standard+)
- `/history/aircraft/{registration}/last_flight` - Aircraft's last flight
- `/flights/{id}/track` - Full track with positions

### AviationStack (Optional - Simple Lookup)
**Why:** Simple flight lookup by flight number + date. Free tier very limited (100/mo).

### ADS-B Exchange (Optional - Real-time ADS-B)
**Why:** Best real-time ADS-B data (250ms). Community API affordable for non-commercial. Enterprise for historical.

---

## Data Fusion Strategy

```
User searches: FR9034 + 2026-09-10
                │
                ▼
┌─────────────────────────────────────┐
│  Flight Lookup Providers (parallel)  │
├─────────────────────────────────────┤
│  AeroDataBox: /flights/number/FR9034/2026-09-10     │
│  FlightAware: /flights/FR9034                        │
│  AviationStack: /flights?flight_iata=FR9034&date=... │
└─────────────────────────────────────┘
                │
                ▼
        Merge Results
        - Registration: 9H-XXXX
        - ICAO24: 48xx04
        - Callsign: RYR9034
        - Aircraft Type: B38M
        - Operator: RYR (Ryanair)
        - Scheduled times
        - Confidence scoring
                │
                ▼
┌─────────────────────────────────────┐
│  OpenSky: /flights/aircraft?icao24=48xx04          │
│  begin=2026-09-10T00:00:00Z&end=2026-09-11T00:00:00Z │
└─────────────────────────────────────┘
                │
                ▼
        All ADS-B sectors for that aircraft that day
        - Actual departure/arrival times
        - Actual airports (estimated from ADS-B)
        - Callsigns per sector
                │
                ▼
        Match sectors to scheduled flights
        Calculate turnarounds, delays, propagation
                │
                ▼
        Return Complete Rotation
```

---

## Confidence Scoring Framework

### Aircraft Identification Confidence

| Signal | Weight | Source |
|--------|--------|--------|
| Registration exact match (multiple providers) | +50 | AeroDataBox + FlightAware |
| ICAO24 exact match | +40 | OpenSky + AeroDataBox |
| Callsign match (RYR9034) | +25 | OpenSky + AeroDataBox |
| Flight number match (FR9034) | +20 | AeroDataBox + FlightAware |
| Airport/time compatibility | +15 | Cross-reference |
| Aircraft type match | +10 | AeroDataBox |

**Thresholds:**
- HIGH: ≥ 80
- MEDIUM: 50-79
- LOW: 25-49
- UNKNOWN: < 25

### Rotation Link Confidence (Sector A → Sector B)

| Signal | Weight |
|--------|--------|
| Same ICAO24 (OpenSky) | +50 |
| Compatible airports (arrival A = departure B) | +30 |
| Compatible times (turnaround 20min-6hr) | +20 |
| Same callsign prefix (RYR) | +10 |
| Multiple provider confirmation | +10 |

---

## Rate Limit Strategy

| Provider | Limit | Strategy |
|----------|-------|----------|
| OpenSky | 4000 credits/day (flights bucket) | Cache aggressively, batch requests, use GitHub Actions for nightly ingestion |
| AeroDataBox | 40,000 units/mo (Starter) | Cache in Supabase, 7-day TTL for historical, 1hr for live |
| FlightAware | 10 result sets/min (Personal) | Use only when needed, cache heavily |
| AviationStack | 100/mo free | Fallback only |
| ADS-B Exchange | 10k/mo (Community) | Real-time only, no caching needed |

---

## Cost Estimation (Monthly)

| Scenario | Providers | Est. Cost |
|----------|-----------|-----------|
| Development/Testing | OpenSky (free) + AeroDataBox Free (400 units) | $0 |
| Production (low volume) | OpenSky + AeroDataBox Starter ($19) | $19 |
| Production (medium) | + FlightAware Standard ($100) | $119 |
| Production (high) | + FlightAware Premium ($1000) | $1119 |

---

## Legal/Compliance Notes

| Provider | Commercial Use | Data Retention | Attribution Required |
|----------|----------------|----------------|---------------------|
| OpenSky | ❌ No | Not specified | Yes (cite paper) |
| AeroDataBox | ✅ Paid plans | 7 days standard, extended on paid | Free: Yes, Paid: No |
| FlightAware | ✅ Standard+ | Per tier | Per tier |
| AviationStack | ✅ Paid plans | Per plan | Yes |
| ADS-B Exchange | ✅ Enterprise only | 30 days (Community) | Yes |
| FR24 API | ✅ Paid | 30 days max | Yes |

---

## Recommended Implementation Order

1. **OpenSky + AeroDataBox** - Core functionality, $0-19/mo
2. **Add FlightAware AeroAPI** - Deep history + Foresight, +$100/mo
3. **Add AviationStack** - Fallback for flight lookup, +$50/mo
4. **Add ADS-B Exchange Enterprise** - Real-time precision, custom pricing
5. **Add FR24 API** - If needed for specific coverage, custom pricing

---

## Next Steps

1. Implement provider abstraction layer
2. Build OpenSky provider (primary for rotation)
3. Build AeroDataBox provider (primary for flight lookup)
4. Implement data fusion & confidence scoring
5. Design Supabase schema for caching
6. Build rotation reconstruction engine
7. Create React frontend with timeline visualization
8. Deploy to Cloudflare Pages