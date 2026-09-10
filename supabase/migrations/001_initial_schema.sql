-- Aircraft Rotation Tracker Database Schema
-- Supabase PostgreSQL

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- AIRLINES
-- ============================================================
CREATE TABLE airlines (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    icao_code CHAR(3) UNIQUE NOT NULL,
    iata_code CHAR(2),
    name TEXT NOT NULL,
    callsign TEXT,
    country TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_airlines_iata ON airlines(iata_code);
CREATE INDEX idx_airlines_callsign ON airlines(callsign);

-- ============================================================
-- AIRPORTS
-- ============================================================
CREATE TABLE airports (
    icao_code CHAR(4) PRIMARY KEY,
    iata_code CHAR(3),
    name TEXT NOT NULL,
    city TEXT,
    country TEXT,
    timezone TEXT NOT NULL,  -- IANA timezone e.g., "Europe/Madrid"
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    altitude_ft INTEGER,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_airports_iata ON airports(iata_code);
CREATE INDEX idx_airports_country ON airports(country);

-- ============================================================
-- AIRCRAFT
-- ============================================================
CREATE TABLE aircraft (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    icao24 CHAR(6) UNIQUE NOT NULL,  -- 6-char hex Mode-S address
    registration TEXT,                -- Tail number e.g., "9H-XXXX"
    aircraft_type CHAR(4),            -- ICAO type designator e.g., "B38M"
    type_name TEXT,                   -- Full name e.g., "Boeing 737-8200"
    operator_icao CHAR(3),            -- Airline ICAO code
    serial_number TEXT,
    year_built INTEGER,
    first_seen_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active',     -- active, retired, stored, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_aircraft_registration ON aircraft(registration);
CREATE INDEX idx_aircraft_operator ON aircraft(operator_icao);
CREATE INDEX idx_aircraft_type ON aircraft(aircraft_type);

-- ============================================================
-- FLIGHTS (Normalized flight records)
-- ============================================================
CREATE TABLE flights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Flight identification
    flight_number TEXT NOT NULL,              -- e.g., "FR9034" (IATA format)
    callsign TEXT,                            -- e.g., "RYR9034" (ICAO format)
    airline_icao CHAR(3) REFERENCES airlines(icao_code),
    
    -- Route
    origin_icao CHAR(4) REFERENCES airports(icao_code),
    destination_icao CHAR(4) REFERENCES airports(icao_code),
    
    -- Scheduled times (UTC)
    scheduled_departure TIMESTAMPTZ,
    scheduled_arrival TIMESTAMPTZ,
    
    -- Actual times from ADS-B (UTC)
    actual_departure TIMESTAMPTZ,
    actual_arrival TIMESTAMPTZ,
    
    -- Estimated times (from providers)
    estimated_departure TIMESTAMPTZ,
    estimated_arrival TIMESTAMPTZ,
    
    -- Flight date (based on scheduled departure date in UTC)
    flight_date DATE NOT NULL,
    
    -- Aircraft linkage
    aircraft_id UUID REFERENCES aircraft(id),
    aircraft_icao24 CHAR(6),                  -- Denormalized for queries
    scheduled_aircraft_id UUID REFERENCES aircraft(id),  -- For swap detection
    scheduled_aircraft_icao24 CHAR(6),
    
    -- Status
    status TEXT DEFAULT 'unknown',            -- scheduled, active, landed, cancelled, diverted, unknown
    
    -- Data quality
    source TEXT,                              -- Primary provider: 'opensky', 'aerodatabox', 'flightaware', etc.
    confidence TEXT DEFAULT 'unknown',        -- HIGH, MEDIUM, LOW, UNKNOWN
    confidence_score INTEGER DEFAULT 0,       -- 0-100
    
    -- Metadata
    distance_km NUMERIC,
    flight_duration_min INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicates
    UNIQUE (flight_number, flight_date, origin_icao, destination_icao)
);

CREATE INDEX idx_flights_number_date ON flights(flight_number, flight_date);
CREATE INDEX idx_flights_callsign_date ON flights(callsign, flight_date);
CREATE INDEX idx_flights_aircraft_date ON flights(aircraft_id, flight_date);
CREATE INDEX idx_flights_aircraft_icao24_date ON flights(aircraft_icao24, flight_date);
CREATE INDEX idx_flights_date ON flights(flight_date);
CREATE INDEX idx_flights_status ON flights(status);
CREATE INDEX idx_flights_origin_dest ON flights(origin_icao, destination_icao);

-- ============================================================
-- FLIGHT SOURCES (Multi-provider evidence for each flight)
-- ============================================================
CREATE TABLE flight_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flight_id UUID NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,                   -- 'opensky', 'aerodatabox', 'flightaware', 'aviationstack', 'adsbexchange'
    raw_data JSONB NOT NULL,                  -- Full raw provider response
    parsed_data JSONB,                        -- Normalized fields extracted
    
    -- Key fields for matching
    flight_number TEXT,
    callsign TEXT,
    origin_icao CHAR(4),
    destination_icao CHAR(4),
    scheduled_departure TIMESTAMPTZ,
    scheduled_arrival TIMESTAMPTZ,
    actual_departure TIMESTAMPTZ,
    actual_arrival TIMESTAMPTZ,
    aircraft_icao24 CHAR(6),
    aircraft_registration TEXT,
    aircraft_type CHAR(4),
    airline_icao CHAR(3),
    
    confidence_score INTEGER DEFAULT 0,       -- 0-100 per provider
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (flight_id, provider)
);

CREATE INDEX idx_flight_sources_flight ON flight_sources(flight_id);
CREATE INDEX idx_flight_sources_provider ON flight_sources(provider);
CREATE INDEX idx_flight_sources_icao24 ON flight_sources(aircraft_icao24);

-- ============================================================
-- AIRCRAFT LEGS (ADS-B sectors from OpenSky /flights/aircraft)
-- ============================================================
CREATE TABLE aircraft_legs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aircraft_id UUID NOT NULL REFERENCES aircraft(id) ON DELETE CASCADE,
    icao24 CHAR(6) NOT NULL,
    callsign TEXT,
    
    -- Times (UTC)
    first_seen TIMESTAMPTZ NOT NULL,          -- First ADS-B contact (departure)
    last_seen TIMESTAMPTZ NOT NULL,           -- Last ADS-B contact (arrival)
    
    -- Estimated airports from ADS-B
    est_departure_icao CHAR(4),
    est_arrival_icao CHAR(4),
    est_departure_horiz_dist_m INTEGER,       -- Horizontal distance to airport
    est_departure_vert_dist_m INTEGER,        -- Vertical distance to airport
    est_arrival_horiz_dist_m INTEGER,
    est_arrival_vert_dist_m INTEGER,
    departure_candidates_count INTEGER,
    arrival_candidates_count INTEGER,
    
    -- Matched flight (if linked to scheduled flight)
    matched_flight_id UUID REFERENCES flights(id),
    match_score INTEGER DEFAULT 0,            -- 0-100
    match_confidence TEXT DEFAULT 'unknown',  -- HIGH, MEDIUM, LOW, UNKNOWN
    
    -- Source
    provider TEXT DEFAULT 'opensky',
    raw_data JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_aircraft_legs_aircraft_time ON aircraft_legs(aircraft_id, first_seen);
CREATE INDEX idx_aircraft_legs_icao24_time ON aircraft_legs(icao24, first_seen);
CREATE INDEX idx_aircraft_legs_matched_flight ON aircraft_legs(matched_flight_id);
CREATE INDEX idx_aircraft_legs_airports ON aircraft_legs(est_departure_icao, est_arrival_icao);

-- ============================================================
-- FLIGHT TRACKS (ADS-B trajectory points)
-- ============================================================
CREATE TABLE flight_tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flight_id UUID REFERENCES flights(id) ON DELETE CASCADE,
    aircraft_leg_id UUID REFERENCES aircraft_legs(id) ON DELETE CASCADE,
    icao24 CHAR(6) NOT NULL,
    callsign TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    path JSONB NOT NULL,                      -- Array of [time, lat, lon, alt, track, on_ground]
    provider TEXT DEFAULT 'opensky',
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_flight_tracks_flight ON flight_tracks(flight_id);
CREATE INDEX idx_flight_tracks_leg ON flight_tracks(aircraft_leg_id);
CREATE INDEX idx_flight_tracks_icao24_time ON flight_tracks(icao24, start_time);

-- ============================================================
-- ROTATION CACHE (Precomputed daily rotations)
-- ============================================================
CREATE TABLE rotation_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aircraft_id UUID NOT NULL REFERENCES aircraft(id),
    icao24 CHAR(6) NOT NULL,
    rotation_date DATE NOT NULL,
    
    -- The complete rotation as JSON
    rotation_data JSONB NOT NULL,             -- { aircraft, sectors[], delays[], propagation[] }
    
    -- Metadata
    sectors_count INTEGER DEFAULT 0,
    providers_used TEXT[],                    -- ['opensky', 'aerodatabox', ...]
    confidence_overall TEXT DEFAULT 'unknown',
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    UNIQUE (icao24, rotation_date)
);

CREATE INDEX idx_rotation_cache_aircraft_date ON rotation_cache(aircraft_id, rotation_date);
CREATE INDEX idx_rotation_cache_expires ON rotation_cache(expires_at);

-- ============================================================
-- SEARCH CACHE (Flight number + date search results)
-- ============================================================
CREATE TABLE search_cache (
    search_key TEXT PRIMARY KEY,              -- e.g., "FR9034|2026-09-10"
    flight_number TEXT NOT NULL,
    flight_date DATE NOT NULL,
    result_data JSONB NOT NULL,               -- Full response for the search
    providers_used TEXT[],
    cache_hit BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_search_cache_expires ON search_cache(expires_at);
CREATE INDEX idx_search_cache_flight_date ON search_cache(flight_number, flight_date);

-- ============================================================
-- SYNC RUNS (GitHub Actions ingestion logging)
-- ============================================================
CREATE TABLE sync_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_name TEXT NOT NULL,                   -- 'nightly_ingestion', 'refresh_rotation', 'cleanup'
    provider TEXT,                            -- Which provider was used
    status TEXT NOT NULL,                     -- 'started', 'success', 'failed', 'partial'
    records_fetched INTEGER DEFAULT 0,
    records_inserted INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER
);

CREATE INDEX idx_sync_runs_job_time ON sync_runs(job_name, started_at);
CREATE INDEX idx_sync_runs_status ON sync_runs(status);

-- ============================================================
-- DATA SOURCES (Provider configuration & metadata)
-- ============================================================
CREATE TABLE data_sources (
    id TEXT PRIMARY KEY,                      -- 'opensky', 'aerodatabox', 'flightaware', etc.
    name TEXT NOT NULL,
    base_url TEXT,
    auth_type TEXT,                           -- 'oauth2', 'api_key', 'rapidapi'
    rate_limit_per_day INTEGER,
    rate_limit_per_minute INTEGER,
    enabled BOOLEAN DEFAULT true,
    commercial_use BOOLEAN DEFAULT false,
    data_retention_days INTEGER,
    config JSONB,                             -- Provider-specific config
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE airlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE airports ENABLE ROW LEVEL SECURITY;
ALTER TABLE aircraft ENABLE ROW LEVEL SECURITY;
ALTER TABLE flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE flight_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE aircraft_legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE flight_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotation_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;

-- Public read access for all reference data
CREATE POLICY "Public read access" ON airlines FOR SELECT USING (true);
CREATE POLICY "Public read access" ON airports FOR SELECT USING (true);
CREATE POLICY "Public read access" ON aircraft FOR SELECT USING (true);
CREATE POLICY "Public read access" ON flights FOR SELECT USING (true);
CREATE POLICY "Public read access" ON flight_sources FOR SELECT USING (true);
CREATE POLICY "Public read access" ON aircraft_legs FOR SELECT USING (true);
CREATE POLICY "Public read access" ON flight_tracks FOR SELECT USING (true);
CREATE POLICY "Public read access" ON rotation_cache FOR SELECT USING (true);
CREATE POLICY "Public read access" ON search_cache FOR SELECT USING (true);
CREATE POLICY "Public read access" ON data_sources FOR SELECT USING (true);

-- Service role can do everything (for GitHub Actions)
CREATE POLICY "Service role full access" ON airlines FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON airports FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON aircraft FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON flights FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON flight_sources FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON aircraft_legs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON flight_tracks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON rotation_cache FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON search_cache FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON sync_runs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON data_sources FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_airlines_updated_at BEFORE UPDATE ON airlines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_airports_updated_at BEFORE UPDATE ON airports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_aircraft_updated_at BEFORE UPDATE ON aircraft FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_flights_updated_at BEFORE UPDATE ON flights FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_aircraft_legs_updated_at BEFORE UPDATE ON aircraft_legs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rotation_cache_updated_at BEFORE UPDATE ON rotation_cache FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_data_sources_updated_at BEFORE UPDATE ON data_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- INITIAL DATA SOURCES CONFIG
-- ============================================================
INSERT INTO data_sources (id, name, base_url, auth_type, rate_limit_per_day, rate_limit_per_minute, enabled, commercial_use, data_retention_days, config) VALUES
('opensky', 'OpenSky Network', 'https://opensky-network.org/api', 'oauth2', 4000, 100, true, false, 30, '{"token_url": "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token", "endpoints": {"flights_aircraft": "/flights/aircraft", "flights_all": "/flights/all", "tracks": "/tracks", "states_all": "/states/all"}}'),
('aerodatabox', 'AeroDataBox', 'https://api.aerodatabox.com', 'api_key', 40000, 300, true, true, 365, '{"tiers": {"tier1": 1, "tier2": 2, "tier3": 6}, "endpoints": {"flight_number": "/flights/number/{flightNumber}/{date}", "aircraft_reg": "/aircrafts/reg/{reg}", "aircraft_icao24": "/aircrafts/icao24/{icao24}", "airport": "/airports/icao/{code}"}}'),
('flightaware', 'FlightAware AeroAPI', 'https://aeroapi.flightaware.com/aeroapi', 'api_key', 500000, 600, true, true, 3650, '{"endpoints": {"flight": "/flights/{ident}", "history_flight": "/history/flights/{ident}", "history_aircraft": "/history/aircraft/{registration}/last_flight", "track": "/flights/{id}/track"}}'),
('aviationstack', 'AviationStack', 'https://api.aviationstack.com/v1', 'api_key', 10000, 100, true, true, 90, '{"endpoints": {"flights": "/flights", "airports": "/airports", "airlines": "/airlines", "airplanes": "/airplanes"}}'),
('adsbexchange', 'ADS-B Exchange', 'https://gateway.adsbexchange.com/api/aircraft/v2', 'api_key', 10000, 1000, false, false, 1, '{"endpoints": {"aircraft": "/filter", "hex": "/hex/{hex}", "callsign": "/callsign/{callsign}"}}');

-- ============================================================
-- HELPER VIEWS
-- ============================================================

-- View: Flight with full details for display
CREATE VIEW flight_details AS
SELECT
    f.*,
    a.registration,
    a.icao24,
    a.aircraft_type,
    a.type_name,
    a.operator_icao,
    al.name AS airline_name,
    al.callsign AS airline_callsign,
    ap1.iata_code AS origin_iata,
    ap1.name AS origin_name,
    ap1.timezone AS origin_timezone,
    ap2.iata_code AS destination_iata,
    ap2.name AS destination_name,
    ap2.timezone AS destination_timezone,
    EXTRACT(EPOCH FROM (f.actual_arrival - f.actual_departure))/60 AS actual_duration_min,
    EXTRACT(EPOCH FROM (f.scheduled_arrival - f.scheduled_departure))/60 AS scheduled_duration_min,
    CASE 
        WHEN f.actual_departure IS NOT NULL AND f.scheduled_departure IS NOT NULL
        THEN EXTRACT(EPOCH FROM (f.actual_departure - f.scheduled_departure))/60
    END AS departure_delay_min,
    CASE 
        WHEN f.actual_arrival IS NOT NULL AND f.scheduled_arrival IS NOT NULL
        THEN EXTRACT(EPOCH FROM (f.actual_arrival - f.scheduled_arrival))/60
    END AS arrival_delay_min
FROM flights f
LEFT JOIN aircraft a ON f.aircraft_id = a.id
LEFT JOIN airlines al ON f.airline_icao = al.icao_code
LEFT JOIN airports ap1 ON f.origin_icao = ap1.icao_code
LEFT JOIN airports ap2 ON f.destination_icao = ap2.icao_code;

-- View: Aircraft with rotation summary
CREATE VIEW aircraft_rotation_summary AS
SELECT
    a.id,
    a.icao24,
    a.registration,
    a.aircraft_type,
    a.type_name,
    a.operator_icao,
    al.name AS operator_name,
    COUNT(DISTINCT f.id) AS total_flights,
    MIN(f.flight_date) AS first_flight_date,
    MAX(f.flight_date) AS last_flight_date
FROM aircraft a
LEFT JOIN flights f ON a.id = f.aircraft_id
LEFT JOIN airlines al ON a.operator_icao = al.icao_code
GROUP BY a.id, a.icao24, a.registration, a.aircraft_type, a.type_name, a.operator_icao, al.name;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function: Get rotation for aircraft on date
CREATE OR REPLACE FUNCTION get_aircraft_rotation(
    p_icao24 CHAR(6),
    p_date DATE,
    p_window_hours INTEGER DEFAULT 2
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_rotation JSONB;
    v_legs JSONB;
    v_aircraft JSONB;
BEGIN
    -- Get aircraft info
    SELECT jsonb_build_object(
        'id', id,
        'icao24', icao24,
        'registration', registration,
        'aircraft_type', aircraft_type,
        'type_name', type_name,
        'operator_icao', operator_icao
    ) INTO v_aircraft
    FROM aircraft WHERE icao24 = p_icao24;
    
    IF v_aircraft IS NULL THEN
        RETURN jsonb_build_object('error', 'Aircraft not found');
    END IF;
    
    -- Get legs for the date (with window around midnight)
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'callsign', callsign,
            'first_seen', first_seen,
            'last_seen', last_seen,
            'est_departure_icao', est_departure_icao,
            'est_arrival_icao', est_arrival_icao,
            'matched_flight_id', matched_flight_id,
            'match_score', match_score,
            'match_confidence', match_confidence
        ) ORDER BY first_seen
    ) INTO v_legs
    FROM aircraft_legs
    WHERE icao24 = p_icao24
      AND first_seen >= (p_date - INTERVAL '1 day' * (p_window_hours/24))::timestamptz
      AND first_seen < (p_date + INTERVAL '1 day' * (1 + p_window_hours/24))::timestamptz;
    
    v_rotation := jsonb_build_object(
        'aircraft', v_aircraft,
        'date', p_date,
        'sectors', COALESCE(v_legs, '[]'::jsonb),
        'sector_count', jsonb_array_length(COALESCE(v_legs, '[]'::jsonb)),
        'generated_at', NOW()
    );
    
    RETURN v_rotation;
END;
$$;

-- Function: Find flight by number and date
CREATE OR REPLACE FUNCTION find_flight_by_number_date(
    p_flight_number TEXT,
    p_date DATE
)
RETURNS SETOF flights
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM flights
    WHERE UPPER(flight_number) = UPPER(p_flight_number)
      AND flight_date = p_date
    ORDER BY scheduled_departure NULLS LAST;
END;
$$;

-- Function: Upsert flight from provider data
CREATE OR REPLACE FUNCTION upsert_flight_from_provider(
    p_flight_number TEXT,
    p_callsign TEXT,
    p_airline_icao CHAR(3),
    p_origin_icao CHAR(4),
    p_destination_icao CHAR(4),
    p_scheduled_departure TIMESTAMPTZ,
    p_scheduled_arrival TIMESTAMPTZ,
    p_actual_departure TIMESTAMPTZ,
    p_actual_arrival TIMESTAMPTZ,
    p_estimated_departure TIMESTAMPTZ,
    p_estimated_arrival TIMESTAMPTZ,
    p_flight_date DATE,
    p_aircraft_icao24 CHAR(6),
    p_aircraft_registration TEXT,
    p_aircraft_type CHAR(4),
    p_status TEXT,
    p_source TEXT,
    p_confidence TEXT,
    p_confidence_score INTEGER,
    p_raw_data JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_flight_id UUID;
    v_aircraft_id UUID;
BEGIN
    -- Get or create aircraft
    IF p_aircraft_icao24 IS NOT NULL THEN
        INSERT INTO aircraft (icao24, registration, aircraft_type, operator_icao)
        VALUES (p_aircraft_icao24, p_aircraft_registration, p_aircraft_type, p_airline_icao)
        ON CONFLICT (icao24) DO UPDATE SET
            registration = COALESCE(p_aircraft_registration, aircraft.registration),
            aircraft_type = COALESCE(p_aircraft_type, aircraft.aircraft_type),
            operator_icao = COALESCE(p_airline_icao, aircraft.operator_icao),
            last_seen_at = GREATEST(COALESCE(p_actual_arrival, p_estimated_arrival, p_scheduled_arrival), aircraft.last_seen_at)
        RETURNING id INTO v_aircraft_id;
    END IF;
    
    -- Upsert flight
    INSERT INTO flights (
        flight_number, callsign, airline_icao,
        origin_icao, destination_icao,
        scheduled_departure, scheduled_arrival,
        actual_departure, actual_arrival,
        estimated_departure, estimated_arrival,
        flight_date,
        aircraft_id, aircraft_icao24,
        status, source, confidence, confidence_score
    ) VALUES (
        p_flight_number, p_callsign, p_airline_icao,
        p_origin_icao, p_destination_icao,
        p_scheduled_departure, p_scheduled_arrival,
        p_actual_departure, p_actual_arrival,
        p_estimated_departure, p_estimated_arrival,
        p_flight_date,
        v_aircraft_id, p_aircraft_icao24,
        p_status, p_source, p_confidence, p_confidence_score
    )
    ON CONFLICT (flight_number, flight_date, origin_icao, destination_icao) DO UPDATE SET
        callsign = COALESCE(p_callsign, flights.callsign),
        airline_icao = COALESCE(p_airline_icao, flights.airline_icao),
        scheduled_departure = COALESCE(p_scheduled_departure, flights.scheduled_departure),
        scheduled_arrival = COALESCE(p_scheduled_arrival, flights.scheduled_arrival),
        actual_departure = COALESCE(p_actual_departure, flights.actual_departure),
        actual_arrival = COALESCE(p_actual_arrival, flights.actual_arrival),
        estimated_departure = COALESCE(p_estimated_departure, flights.estimated_departure),
        estimated_arrival = COALESCE(p_estimated_arrival, flights.estimated_arrival),
        aircraft_id = COALESCE(v_aircraft_id, flights.aircraft_id),
        aircraft_icao24 = COALESCE(p_aircraft_icao24, flights.aircraft_icao24),
        status = COALESCE(p_status, flights.status),
        source = COALESCE(p_source, flights.source),
        confidence = COALESCE(p_confidence, flights.confidence),
        confidence_score = GREATEST(p_confidence_score, flights.confidence_score),
        updated_at = NOW()
    RETURNING id INTO v_flight_id;
    
    -- Store source evidence
    INSERT INTO flight_sources (flight_id, provider, raw_data, parsed_data, confidence_score)
    VALUES (v_flight_id, p_source, p_raw_data, jsonb_build_object(
        'flight_number', p_flight_number,
        'callsign', p_callsign,
        'origin_icao', p_origin_icao,
        'destination_icao', p_destination_icao,
        'scheduled_departure', p_scheduled_departure,
        'actual_departure', p_actual_departure,
        'aircraft_icao24', p_aircraft_icao24,
        'aircraft_registration', p_aircraft_registration
    ), p_confidence_score)
    ON CONFLICT (flight_id, provider) DO UPDATE SET
        raw_data = EXCLUDED.raw_data,
        parsed_data = EXCLUDED.parsed_data,
        confidence_score = EXCLUDED.confidence_score,
        fetched_at = NOW();
    
    RETURN v_flight_id;
END;
$$;