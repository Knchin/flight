# Aircraft Rotation Tracker

> Reconstruct the complete daily journey of a physical aircraft from a flight number.

## Overview

This application answers a simple question: **"What aircraft is operating my flight, where did it come from earlier today, and where does it go afterward?"**

The user enters a flight number (e.g., `FR9034`) and a date. The application:
1. Identifies the physical aircraft (registration, ICAO24, type, operator)
2. Reconstructs its complete daily rotation using ADS-B data
3. Shows all sectors before and after the requested flight
4. Calculates turnaround times and analyzes delay propagation

## Features

- **Complete Daily Rotation**: See every sector the aircraft flew that day
- **Actual vs Scheduled Times**: ADS-B derived actual times compared to scheduled
- **Turnaround Analysis**: Ground time between each sector
- **Delay Propagation**: Understand if delays cascaded through the rotation
- **Interactive Map**: Visualize the complete journey
- **Multi-Source Verification**: Cross-references OpenSky, AeroDataBox, FlightAware
- **Confidence Scoring**: Every connection has a confidence level (HIGH/MEDIUM/LOW)
- **Data Transparency**: See exactly which provider contributed each piece of data

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Aviation    │     │  GitHub     │     │  Supabase   │     │ Cloudflare  │
│ APIs        │────▶│  Actions    │────▶│  PostgreSQL │────▶│  Pages      │
│ (OpenSky,   │     │  Ingestion  │     │  (Cache +   │     │  (React +   │
│  AeroDataBox,│     │  (Nightly)  │     │  Rotation   │     │  API)       │
│  FlightAware)│     │             │     │  Engine)    │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### Data Flow

```
User: FR9034 + 2026-09-10
         │
         ▼
┌─────────────────────────────────────┐
│  Flight Lookup (parallel)           │
│  AeroDataBox / FlightAware /        │
│  AviationStack                      │
└─────────────────────────────────────┘
         │
         ▼
   Aircraft: 9H-XXXX (ICAO24: 48xx04)
   Type: B38M (Boeing 737-8200)
   Operator: RYR (Ryanair)
         │
         ▼
┌─────────────────────────────────────┐
│  OpenSky: /flights/aircraft         │
│  icao24=48xx04, date=2026-09-10    │
└─────────────────────────────────────┘
         │
         ▼
   All ADS-B sectors for that aircraft:
   FR4632 VLC→BGY (08:15-10:05)
   FR219  BGY→ALC (10:47-12:52)
   FR9034 ALC→BVA (14:10-16:25) ← YOUR FLIGHT
   FRxxx  BVA→... (17:20-...)
         │
         ▼
   Match sectors → flights, calculate turnarounds,
   analyze delay propagation, assign confidence
         │
         ▼
   Complete Rotation Display
```

## Quick Start

### Prerequisites

- Node.js 18+
- Supabase account
- API keys for at least one flight lookup provider (AeroDataBox recommended) and OpenSky

### Installation

```bash
# Clone and install
git clone <repo>
cd aircraft-rotation-tracker
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your API keys

# Set up database
npx supabase db push
# Or run migrations manually in Supabase dashboard

# Start development
npm run dev
```

### Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key for backend |
| `OPENSKY_CLIENT_ID` | Yes | OpenSky OAuth client ID |
| `OPENSKY_CLIENT_SECRET` | Yes | OpenSky OAuth client secret |
| `AERODATABOX_API_KEY` | Recommended | RapidAPI key for AeroDataBox |
| `FLIGHTAWARE_API_KEY` | Optional | For historical data & Foresight |
| `AVIATIONSTACK_API_KEY` | Optional | Fallback flight lookup |

### Provider Setup

1. **OpenSky Network** (Required for rotation):
   - Register at https://opensky-network.org
   - Create API client at https://opensky-network.org/my-opensky/account
   - Note: Non-commercial use only

2. **AeroDataBox** (Recommended for flight lookup):
   - Subscribe at https://rapid.aerodatabox.com/ or https://apimarket.aerodatabox.com/
   - Free tier: 400 API units/month
   - Starter: $19/month (40,000 units)

3. **FlightAware AeroAPI** (Optional):
   - Sign up at https://www.flightaware.com/aeroapi/signup/personal
   - Personal tier: Free ($5/month credit)
   - Standard: $100/month minimum (historical data)

## Database Schema

Key tables:
- `airlines` - Airline reference data
- `airports` - Airport reference data with timezones
- `aircraft` - Physical aircraft (ICAO24, registration, type, operator)
- `flights` - Normalized flight records (scheduled + actual)
- `flight_sources` - Multi-provider evidence per flight
- `aircraft_legs` - ADS-B sectors from OpenSky
- `flight_tracks` - ADS-B trajectory points
- `rotation_cache` - Precomputed daily rotations
- `search_cache` - Flight search results
- `sync_runs` - Ingestion job logging

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/rotation` | POST | Reconstruct rotation for flight+date |
| `/api/rotation` | GET | Same as POST (query params) |
| `/api/methodology` | GET | Methodology documentation |
| `/api/debug` | GET | Debug info (status, cache, sync runs) |

### Request Format

```json
POST /api/rotation
{
  "flight_number": "FR9034",
  "date": "2026-09-10"
}
```

### Response Format

```json
{
  "success": true,
  "rotation": {
    "aircraft": { "registration": "9H-XXXX", "type_name": "Boeing 737-8200", ... },
    "aircraft_identification_confidence": "HIGH",
    "date": "2026-09-10",
    "sectors": [
      {
        "leg": { "callsign": "RYR4632", "first_seen": "...", "last_seen": "...", ... },
        "flight": { "flight_number": "FR4632", "scheduled_departure": "...", ... },
        "turnaround_minutes": 42,
        "departure_delay_minutes": 0,
        "arrival_delay_minutes": 37,
        "is_user_flight": false,
        "leg_flight_match_confidence": "HIGH",
        "connection_confidence": "HIGH"
      }
    ],
    "delay_propagation": [
      {
        "sector_index": 0,
        "flight_number": "FR219",
        "arrival_delay_minutes": 37,
        "departure_delay_minutes": 39,
        "propagation_likelihood": "LIKELY_PROPAGATED",
        "explanation": "Aircraft arrived 37 min late and next flight departed 39 min late..."
      }
    ],
    "data_sources": ["opensky", "aerodatabox"],
    "generated_at": "2026-09-10T12:00:00Z"
  },
  "debug_info": { ... }
}
```

## Deployment

### Cloudflare Pages

1. Connect repository to Cloudflare Pages
2. Build command: `npm run build`
3. Output directory: `dist`
4. Add environment variables in Pages dashboard
5. Enable Pages Functions (automatic with `/functions` directory)

### GitHub Actions (Ingestion)

The `.github/workflows/ingest.yml` runs nightly to:
- Fetch aircraft rotations for recently searched flights
- Update airport/airline reference data
- Clean expired cache entries

Configure secrets in GitHub repository settings:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- All provider API keys

## Testing

```bash
# Run tests
npm run test

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Project Structure

```
/
├── src/
│   ├── components/       # React components (Modal, Map, etc.)
│   ├── pages/            # Page components (Home, Result, Methodology)
│   ├── services/         # Core business logic (rotation-engine)
│   ├── providers/        # Aviation data provider implementations
│   ├── lib/              # Utilities (Supabase client)
│   ├── types/            # TypeScript type definitions
│   ├── hooks/            # Custom React hooks
│   ├── App.tsx           # Main app component
│   ├── main.tsx          # Entry point
│   └── App.css           # Styles
├── functions/            # Cloudflare Pages Functions (API)
│   └── api/
│       ├── rotation.ts   # Main rotation endpoint
│       ├── methodology.ts
│       └── debug.ts
├── supabase/
│   ├── migrations/       # Database migrations
│   └── seed/             # Reference data
├── scripts/              # Utility scripts
├── tests/                # Vitest tests
├── docs/                 # Documentation (provider matrix)
└── .github/workflows/    # CI/CD
```

## Confidence System

### Aircraft Identification
| Signal | Weight |
|--------|--------|
| Registration exact match (multiple providers) | +50 |
| ICAO24 exact match | +40 |
| Callsign match (RYR9034) | +25 |
| Flight number match | +20 |
| Airport/time compatibility | +15 |
| Aircraft type match | +10 |

**HIGH ≥ 80, MEDIUM 50-79, LOW 25-49, UNKNOWN < 25**

### Rotation Links
| Signal | Weight |
|--------|--------|
| Same ICAO24 | +50 |
| Compatible airports (arrival = departure) | +30 |
| Compatible turnaround (20min-6hr) | +20 |
| Same callsign prefix | +10 |
| Multi-provider confirmation | +10 |

### Delay Propagation Categories
- **LIKELY_PROPAGATED**: Strong temporal consistency, maintained turnaround
- **CONSISTENT_WITH**: Delays align but turnaround changed
- **POSSIBLE_FACTOR**: Prior delay but next flight recovered
- **NO_PROPAGATION**: Delay originated at this sector
- **INSUFFICIENT_DATA**: Missing actual times

## Limitations

- **OpenSky**: Non-commercial only, nightly batch updates, estimated airports
- **Aircraft swaps**: Cannot detect scheduled vs actual aircraft without multiple sources
- **Coverage gaps**: ADS-B may miss sectors over oceans/remote areas
- **Registration changes**: Tracked by ICAO24, not registration
- **Callsign reuse**: Same callsign may be used by different aircraft on different days

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run `npm run test && npm run typecheck && npm run lint`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- [OpenSky Network](https://opensky-network.org) for ADS-B data
- [AeroDataBox](https://aerodatabox.com) for flight lookup API
- [FlightAware](https://flightaware.com) for AeroAPI
- [AviationStack](https://aviationstack.com) for aviation data
- [ADS-B Exchange](https://adsbexchange.com) for real-time ADS-B
- [Leaflet](https://leafletjs.com) for mapping
- [Supabase](https://supabase.com) for backend
- [Cloudflare Pages](https://pages.cloudflare.com) for hosting