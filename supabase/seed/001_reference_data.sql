-- Seed data for airports and airlines
-- Run after initial schema

-- ============================================================
-- AIRPORTS (Major airports for European routes)
-- ============================================================
INSERT INTO airports (icao_code, iata_code, name, city, country, timezone, latitude, longitude, altitude_ft) VALUES
-- Spain
('LEVC', 'VLC', 'Valencia Airport', 'Valencia', 'Spain', 'Europe/Madrid', 39.4893, -0.4816, 230),
('LEMD', 'MAD', 'Adolfo Suárez Madrid–Barajas Airport', 'Madrid', 'Spain', 'Europe/Madrid', 40.4983, -3.5676, 1998),
('LEBL', 'BCN', 'Barcelona–El Prat Airport', 'Barcelona', 'Spain', 'Europe/Madrid', 41.2974, 2.0784, 12),
('LEAL', 'ALC', 'Alicante–Elche Airport', 'Alicante', 'Spain', 'Europe/Madrid', 38.2822, -0.5582, 141),
('LEMG', 'AGP', 'Málaga–Costa del Sol Airport', 'Málaga', 'Spain', 'Europe/Madrid', 36.6749, -4.4991, 52),
('LEPA', 'PMI', 'Palma de Mallorca Airport', 'Palma', 'Spain', 'Europe/Madrid', 39.5536, 2.7278, 27),
('LEIB', 'IBZ', 'Ibiza Airport', 'Ibiza', 'Spain', 'Europe/Madrid', 38.8729, 1.3731, 24),
('GCLP', 'LPA', 'Gran Canaria Airport', 'Las Palmas', 'Spain', 'Atlantic/Canary', 27.9319, -15.3866, 78),
('GCTS', 'TFN', 'Tenerife North Airport', 'Tenerife', 'Spain', 'Atlantic/Canary', 28.4827, -16.3415, 2073),
('GCRR', 'ACE', 'Lanzarote Airport', 'Lanzarote', 'Spain', 'Atlantic/Canary', 28.9455, -13.6052, 46),

-- Italy
('LIME', 'BGY', 'Milan Bergamo Airport', 'Milan', 'Italy', 'Europe/Rome', 45.6739, 9.7042, 787),
('LIMC', 'MXP', 'Milan Malpensa Airport', 'Milan', 'Italy', 'Europe/Rome', 45.6306, 8.7281, 767),
('LINP', 'LIN', 'Milan Linate Airport', 'Milan', 'Italy', 'Europe/Rome', 45.4451, 9.2767, 353),
('LIRF', 'FCO', 'Rome Fiumicino Airport', 'Rome', 'Italy', 'Europe/Rome', 41.8003, 12.2389, 13),
('LIPE', 'NAP', 'Naples Airport', 'Naples', 'Italy', 'Europe/Rome', 40.8860, 14.2908, 294),
('LIPZ', 'VCE', 'Venice Marco Polo Airport', 'Venice', 'Italy', 'Europe/Rome', 45.5053, 12.3519, 7),
('LIRN', 'CIA', 'Rome Ciampino Airport', 'Rome', 'Italy', 'Europe/Rome', 41.7994, 12.5949, 427),
('LIMF', 'TRN', 'Turin Airport', 'Turin', 'Italy', 'Europe/Rome', 45.2008, 7.6496, 989),

-- France
('LFPG', 'CDG', 'Paris Charles de Gaulle Airport', 'Paris', 'France', 'Europe/Paris', 49.0097, 2.5479, 392),
('LFOB', 'BVA', 'Paris Beauvais Airport', 'Beauvais', 'France', 'Europe/Paris', 49.4544, 2.1128, 359),
('LFPO', 'ORY', 'Paris Orly Airport', 'Paris', 'France', 'Europe/Paris', 48.7233, 2.3794, 291),
('LFLL', 'LYS', 'Lyon–Saint-Exupéry Airport', 'Lyon', 'France', 'Europe/Paris', 45.7256, 5.0811, 821),
('LFML', 'MRS', 'Marseille Provence Airport', 'Marseille', 'France', 'Europe/Paris', 43.4367, 5.2150, 74),
('LFBO', 'TLS', 'Toulouse–Blagnac Airport', 'Toulouse', 'France', 'Europe/Paris', 43.6291, 1.3678, 499),
('LFQQ', 'LIL', 'Lille Airport', 'Lille', 'France', 'Europe/Paris', 50.5633, 3.0869, 157),

-- UK
('EGLL', 'LHR', 'London Heathrow Airport', 'London', 'UK', 'Europe/London', 51.4700, -0.4543, 83),
('EGKK', 'LGW', 'London Gatwick Airport', 'London', 'UK', 'Europe/London', 51.1481, -0.1903, 203),
('EGSS', 'STN', 'London Stansted Airport', 'London', 'UK', 'Europe/London', 51.8850, 0.2350, 348),
('EGMC', 'SEN', 'London Southend Airport', 'London', 'UK', 'Europe/London', 51.5714, 0.6956, 160),
('EGGP', 'LPL', 'Liverpool John Lennon Airport', 'Liverpool', 'UK', 'Europe/London', 53.3336, -2.8497, 81),
('EGCC', 'MAN', 'Manchester Airport', 'Manchester', 'UK', 'Europe/London', 53.3537, -2.2749, 257),
('EGPH', 'EDI', 'Edinburgh Airport', 'Edinburgh', 'UK', 'Europe/London', 55.9500, -3.3725, 135),
('EGGD', 'BRS', 'Bristol Airport', 'Bristol', 'UK', 'Europe/London', 51.3827, -2.7191, 622),

-- Germany
('EDDF', 'FRA', 'Frankfurt Airport', 'Frankfurt', 'Germany', 'Europe/Berlin', 50.0379, 8.5622, 364),
('EDDM', 'MUC', 'Munich Airport', 'Munich', 'Germany', 'Europe/Berlin', 48.3538, 11.7861, 1487),
('EDDB', 'BER', 'Berlin Brandenburg Airport', 'Berlin', 'Germany', 'Europe/Berlin', 52.3667, 13.5033, 156),
('EDDH', 'HAM', 'Hamburg Airport', 'Hamburg', 'Germany', 'Europe/Berlin', 53.6304, 9.9882, 53),
('EDDK', 'CGN', 'Cologne Bonn Airport', 'Cologne', 'Germany', 'Europe/Berlin', 50.8659, 7.1427, 302),
('EDDS', 'STR', 'Stuttgart Airport', 'Stuttgart', 'Germany', 'Europe/Berlin', 48.6899, 9.2219, 1276),

-- Portugal
('LPPT', 'LIS', 'Lisbon Airport', 'Lisbon', 'Portugal', 'Europe/Lisbon', 38.7742, -9.1342, 374),
('LPPR', 'OPO', 'Porto Airport', 'Porto', 'Portugal', 'Europe/Lisbon', 41.2481, -8.6814, 228),
('LPFR', 'FAO', 'Faro Airport', 'Faro', 'Portugal', 'Europe/Lisbon', 37.0144, -7.9659, 24),

-- Ireland
('EIDW', 'DUB', 'Dublin Airport', 'Dublin', 'Ireland', 'Europe/Dublin', 53.4213, -6.2701, 242),
('EICK', 'ORK', 'Cork Airport', 'Cork', 'Ireland', 'Europe/Dublin', 51.8413, -8.4911, 502),
('EINN', 'SNN', 'Shannon Airport', 'Shannon', 'Ireland', 'Europe/Dublin', 52.7020, -8.9248, 46),

-- Other European
('EHAM', 'AMS', 'Amsterdam Schiphol Airport', 'Amsterdam', 'Netherlands', 'Europe/Amsterdam', 52.3086, 4.7639, -11),
('EDDB', 'BRU', 'Brussels Airport', 'Brussels', 'Belgium', 'Europe/Brussels', 50.9014, 4.4844, 184),
('LSZH', 'ZRH', 'Zurich Airport', 'Zurich', 'Switzerland', 'Europe/Zurich', 47.4647, 8.5492, 1416),
('LOWW', 'VIE', 'Vienna Airport', 'Vienna', 'Austria', 'Europe/Vienna', 48.1103, 16.5697, 600),
('EKCH', 'CPH', 'Copenhagen Airport', 'Copenhagen', 'Denmark', 'Europe/Copenhagen', 55.6181, 12.6560, 17),
('ESSA', 'ARN', 'Stockholm Arlanda Airport', 'Stockholm', 'Sweden', 'Europe/Stockholm', 59.6519, 17.9186, 137),
('ENG', 'OSL', 'Oslo Airport', 'Oslo', 'Norway', 'Europe/Oslo', 60.1939, 11.1004, 681),
('EFHK', 'HEL', 'Helsinki Airport', 'Helsinki', 'Finland', 'Europe/Helsinki', 60.3172, 24.9633, 179),
('LGAV', 'ATH', 'Athens Airport', 'Athens', 'Greece', 'Europe/Athens', 37.9364, 23.9445, 308),
('LROP', 'OTP', 'Bucharest Airport', 'Bucharest', 'Romania', 'Europe/Bucharest', 44.5711, 26.0850, 314),
('LKPR', 'PRG', 'Prague Airport', 'Prague', 'Czech Republic', 'Europe/Prague', 50.1008, 14.2600, 1247),
('EPWA', 'WAW', 'Warsaw Chopin Airport', 'Warsaw', 'Poland', 'Europe/Warsaw', 52.1657, 20.9671, 353),
('LHBP', 'BUD', 'Budapest Airport', 'Budapest', 'Hungary', 'Europe/Budapest', 47.4298, 19.2611, 495);

-- ============================================================
-- AIRLINES (Major European carriers)
-- ============================================================
INSERT INTO airlines (icao_code, iata_code, name, callsign, country) VALUES
-- Low-cost
('RYR', 'FR', 'Ryanair', 'RYANAIR', 'Ireland'),
('EZY', 'U2', 'easyJet', 'EASY', 'UK'),
('WZZ', 'W6', 'Wizz Air', 'WIZZAIR', 'Hungary'),
('VLG', 'VY', 'Vueling', 'VUELING', 'Spain'),
('NOZ', 'N4', 'Neos Air', 'NEOS', 'Italy'),
('TVF', 'T7', 'Transavia France', 'FRANCE SOLEIL', 'France'),
('TRA', 'HV', 'Transavia', 'TRANSAVIA', 'Netherlands'),
('VOE', 'V7', 'Volotea', 'VOLOTEA', 'Spain'),
('JAF', 'JO', 'Jet2.com', 'CHANNEX', 'UK'),

-- Legacy/Flag carriers
('BAW', 'BA', 'British Airways', 'SPEEDBIRD', 'UK'),
('AFR', 'AF', 'Air France', 'AIRFRANS', 'France'),
('DLH', 'LH', 'Lufthansa', 'LUFTHANSA', 'Germany'),
('IBE', 'IB', 'Iberia', 'IBERIA', 'Spain'),
('KLM', 'KL', 'KLM', 'KLM', 'Netherlands'),
('SAS', 'SK', 'SAS', 'SCANDINAVIAN', 'Sweden'),
('SWR', 'LX', 'Swiss', 'SWISS', 'Switzerland'),
('AUA', 'OS', 'Austrian', 'AUSTRIAN', 'Austria'),
('TAP', 'TP', 'TAP Air Portugal', 'AIR PORTUGAL', 'Portugal'),
('EIN', 'EI', 'Aer Lingus', 'SHAMROCK', 'Ireland'),
('LOT', 'LO', 'LOT Polish Airlines', 'POLISH', 'Poland'),
('CSA', 'OK', 'Czech Airlines', 'CSA', 'Czech Republic'),
('MAH', 'MH', 'Malev', 'MALEV', 'Hungary'), -- defunct but historical
('AEE', 'A3', 'Aegean Airlines', 'AEGEAN', 'Greece'),
('THY', 'TK', 'Turkish Airlines', 'TURKISH', 'Turkey'),
('ELY', 'LY', 'El Al', 'ELAL', 'Israel'),
('MSR', 'MS', 'EgyptAir', 'EGYPTAIR', 'Egypt'),

-- Regional/Others
('CFE', 'W2', 'BA CityFlyer', 'FLYER', 'UK'),
('BEE', 'BE', 'Flybe', 'JERSEY', 'UK'),
('LOG', 'LM', 'Loganair', 'LOGAN', 'UK'),
('EZY', 'U2', 'easyJet', 'EASY', 'UK'),
('EXS', 'LS', 'Jet2.com', 'CHANNEX', 'UK'),
('TOM', 'BY', 'TUI Airways', 'TOMJET', 'UK'),
('TCX', 'MT', 'Thomas Cook', 'KESTREL', 'UK'), -- defunct
('EZS', 'DS', 'easyJet Switzerland', 'EASY', 'Switzerland'),
('OEI', 'O2', 'easyJet Europe', 'EASY', 'Austria'),

-- Cargo
('CLX', 'CV', 'Cargolux', 'CARGOLUX', 'Luxembourg'),
('GCR', 'GH', 'Titan Airways', 'ZAP', 'UK'),
('EXS', 'LS', 'Jet2.com', 'CHANNEX', 'UK');

-- ============================================================
-- UPDATE AIRCRAFT OPERATOR WITH VALID AIRLINE CODES
-- ============================================================
-- This will be populated as flights are ingested