/*
  # Fix segment check constraint and seed all vehicle models

  Drops the restrictive segment check constraint and replaces it with
  a broader one that includes all real-world segment names, then seeds
  all OEM models.
*/

ALTER TABLE vehicle_models DROP CONSTRAINT IF EXISTS vehicle_models_segment_check;

ALTER TABLE vehicle_models ADD CONSTRAINT vehicle_models_segment_check
  CHECK (segment IN ('', 'scooter', 'commuter', 'sport', 'sports', 'cruiser', 'adventure', 'electric', 'moped', 'retro', 'naked'));

-- ============================================================
-- HERO models
-- ============================================================
INSERT INTO vehicle_models (oem_id, name, slug, segment, fuel_types, start_year, sort_order)
SELECT o.id, v.name, v.slug, v.segment, v.fuel_types::text[], v.start_year, v.sort_order
FROM vehicle_oems o
JOIN (VALUES
  ('Splendor Plus',  'splendor-plus',  'commuter',  '{petrol}', 2000, 1),
  ('HF Deluxe',      'hf-deluxe',      'commuter',  '{petrol}', 2005, 2),
  ('Passion Pro',    'passion-pro',    'commuter',  '{petrol}', 2001, 3),
  ('Glamour',        'glamour',        'commuter',  '{petrol}', 2005, 4),
  ('Super Splendor', 'super-splendor', 'commuter',  '{petrol}', 2002, 5),
  ('Xpulse 200',     'xpulse-200',     'adventure', '{petrol}', 2019, 6),
  ('Xtreme 125R',    'xtreme-125r',    'sports',    '{petrol}', 2021, 7),
  ('Karizma XMR',    'karizma-xmr',    'sports',    '{petrol}', 2023, 8),
  ('Destini 125',    'destini-125',    'scooter',   '{petrol}', 2018, 9),
  ('Pleasure Plus',  'pleasure-plus',  'scooter',   '{petrol}', 2006, 10),
  ('Maestro Edge',   'maestro-edge',   'scooter',   '{petrol}', 2012, 11)
) AS v(name, slug, segment, fuel_types, start_year, sort_order) ON true
WHERE o.slug = 'hero'
ON CONFLICT (oem_id, slug) DO UPDATE SET
  name = EXCLUDED.name, segment = EXCLUDED.segment,
  fuel_types = EXCLUDED.fuel_types, start_year = EXCLUDED.start_year,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- HONDA models
-- ============================================================
INSERT INTO vehicle_models (oem_id, name, slug, segment, fuel_types, start_year, sort_order)
SELECT o.id, v.name, v.slug, v.segment, v.fuel_types::text[], v.start_year, v.sort_order
FROM vehicle_oems o
JOIN (VALUES
  ('Activa 6G',   'activa-6g',   'scooter',  '{petrol}', 2019, 1),
  ('Dio',         'dio',         'scooter',  '{petrol}', 2001, 2),
  ('Shine',       'shine',       'commuter', '{petrol}', 2006, 3),
  ('Unicorn',     'unicorn',     'commuter', '{petrol}', 2004, 4),
  ('SP125',       'sp125',       'commuter', '{petrol}', 2019, 5),
  ('Hornet 2.0',  'hornet-2',    'sports',   '{petrol}', 2020, 6),
  ('CB350',       'cb350',       'cruiser',  '{petrol}', 2021, 7),
  ('Hness CB350', 'hness-cb350', 'cruiser',  '{petrol}', 2020, 8),
  ('Activa 125',  'activa-125',  'scooter',  '{petrol}', 2013, 9),
  ('Aviator',     'aviator',     'scooter',  '{petrol}', 2004, 10),
  ('Grazia',      'grazia',      'scooter',  '{petrol}', 2017, 11)
) AS v(name, slug, segment, fuel_types, start_year, sort_order) ON true
WHERE o.slug = 'honda'
ON CONFLICT (oem_id, slug) DO UPDATE SET
  name = EXCLUDED.name, segment = EXCLUDED.segment,
  fuel_types = EXCLUDED.fuel_types, start_year = EXCLUDED.start_year,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- TVS models
-- ============================================================
INSERT INTO vehicle_models (oem_id, name, slug, segment, fuel_types, start_year, sort_order)
SELECT o.id, v.name, v.slug, v.segment, v.fuel_types::text[], v.start_year, v.sort_order
FROM vehicle_oems o
JOIN (VALUES
  ('Apache RTR 160', 'apache-rtr-160', 'sports',   '{petrol}',   2008, 1),
  ('Apache RTR 200', 'apache-rtr-200', 'sports',   '{petrol}',   2016, 2),
  ('Raider 125',     'raider-125',     'commuter', '{petrol}',   2021, 3),
  ('Jupiter',        'jupiter',        'scooter',  '{petrol}',   2013, 4),
  ('NTorq 125',      'ntorq-125',      'scooter',  '{petrol}',   2018, 5),
  ('Sport',          'sport',          'commuter', '{petrol}',   2002, 6),
  ('Radeon',         'radeon',         'commuter', '{petrol}',   2018, 7),
  ('iQube',          'iqube',          'scooter',  '{electric}', 2020, 8),
  ('Ronin',          'ronin',          'naked',    '{petrol}',   2022, 9),
  ('Zest',           'zest',           'scooter',  '{petrol}',   2014, 10)
) AS v(name, slug, segment, fuel_types, start_year, sort_order) ON true
WHERE o.slug = 'tvs'
ON CONFLICT (oem_id, slug) DO UPDATE SET
  name = EXCLUDED.name, segment = EXCLUDED.segment,
  fuel_types = EXCLUDED.fuel_types, start_year = EXCLUDED.start_year,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- BAJAJ models
-- ============================================================
INSERT INTO vehicle_models (oem_id, name, slug, segment, fuel_types, start_year, sort_order)
SELECT o.id, v.name, v.slug, v.segment, v.fuel_types::text[], v.start_year, v.sort_order
FROM vehicle_oems o
JOIN (VALUES
  ('Pulsar 125',  'pulsar-125',   'sports',   '{petrol}',   2019, 1),
  ('Pulsar 150',  'pulsar-150',   'sports',   '{petrol}',   2001, 2),
  ('Pulsar NS200','pulsar-ns200', 'sports',   '{petrol}',   2012, 3),
  ('Pulsar N250', 'pulsar-n250',  'sports',   '{petrol}',   2021, 4),
  ('Dominar 400', 'dominar-400',  'sports',   '{petrol}',   2017, 5),
  ('Platina',     'platina',      'commuter', '{petrol}',   2006, 6),
  ('CT110',       'ct110',        'commuter', '{petrol}',   2018, 7),
  ('Avenger',     'avenger',      'cruiser',  '{petrol}',   2002, 8),
  ('Chetak EV',   'chetak-ev',    'scooter',  '{electric}', 2020, 9)
) AS v(name, slug, segment, fuel_types, start_year, sort_order) ON true
WHERE o.slug = 'bajaj'
ON CONFLICT (oem_id, slug) DO UPDATE SET
  name = EXCLUDED.name, segment = EXCLUDED.segment,
  fuel_types = EXCLUDED.fuel_types, start_year = EXCLUDED.start_year,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- YAMAHA models
-- ============================================================
INSERT INTO vehicle_models (oem_id, name, slug, segment, fuel_types, start_year, sort_order)
SELECT o.id, v.name, v.slug, v.segment, v.fuel_types::text[], v.start_year, v.sort_order
FROM vehicle_oems o
JOIN (VALUES
  ('R15',       'r15',       'sports',   '{petrol}', 2008, 1),
  ('MT15',      'mt15',      'naked',    '{petrol}', 2019, 2),
  ('FZ',        'fz',        'naked',    '{petrol}', 2008, 3),
  ('Fascino',   'fascino',   'scooter',  '{petrol}', 2015, 4),
  ('RayZR',     'rayzr',     'scooter',  '{petrol}', 2017, 5),
  ('Aerox 155', 'aerox-155', 'scooter',  '{petrol}', 2021, 6),
  ('RX100',     'rx100',     'commuter', '{petrol}', 1985, 7),
  ('Fazer',     'fazer',     'sports',   '{petrol}', 2009, 8)
) AS v(name, slug, segment, fuel_types, start_year, sort_order) ON true
WHERE o.slug = 'yamaha'
ON CONFLICT (oem_id, slug) DO UPDATE SET
  name = EXCLUDED.name, segment = EXCLUDED.segment,
  fuel_types = EXCLUDED.fuel_types, start_year = EXCLUDED.start_year,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- ROYAL ENFIELD models
-- ============================================================
INSERT INTO vehicle_models (oem_id, name, slug, segment, fuel_types, start_year, sort_order)
SELECT o.id, v.name, v.slug, v.segment, v.fuel_types::text[], v.start_year, v.sort_order
FROM vehicle_oems o
JOIN (VALUES
  ('Classic 350',     'classic-350',     'retro',     '{petrol}', 2009, 1),
  ('Bullet 350',      'bullet-350',      'cruiser',   '{petrol}', 1955, 2),
  ('Hunter 350',      'hunter-350',      'retro',     '{petrol}', 2022, 3),
  ('Meteor 350',      'meteor-350',      'cruiser',   '{petrol}', 2020, 4),
  ('Himalayan',       'himalayan',       'adventure', '{petrol}', 2016, 5),
  ('Interceptor 650', 'interceptor-650', 'retro',     '{petrol}', 2019, 6),
  ('Continental GT',  'continental-gt',  'retro',     '{petrol}', 2014, 7)
) AS v(name, slug, segment, fuel_types, start_year, sort_order) ON true
WHERE o.slug = 'royal-enfield'
ON CONFLICT (oem_id, slug) DO UPDATE SET
  name = EXCLUDED.name, segment = EXCLUDED.segment,
  fuel_types = EXCLUDED.fuel_types, start_year = EXCLUDED.start_year,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- SUZUKI models
-- ============================================================
INSERT INTO vehicle_models (oem_id, name, slug, segment, fuel_types, start_year, sort_order)
SELECT o.id, v.name, v.slug, v.segment, v.fuel_types::text[], v.start_year, v.sort_order
FROM vehicle_oems o
JOIN (VALUES
  ('Access 125',     'access-125',     'scooter',   '{petrol}', 2007, 1),
  ('Burgman Street', 'burgman-street', 'scooter',   '{petrol}', 2018, 2),
  ('Gixxer',         'gixxer',         'sports',    '{petrol}', 2014, 3),
  ('Avenis',         'avenis',         'scooter',   '{petrol}', 2021, 4),
  ('Hayabusa',       'hayabusa',       'sports',    '{petrol}', 1999, 5),
  ('V-Strom SX',     'v-strom-sx',     'adventure', '{petrol}', 2022, 6)
) AS v(name, slug, segment, fuel_types, start_year, sort_order) ON true
WHERE o.slug = 'suzuki'
ON CONFLICT (oem_id, slug) DO UPDATE SET
  name = EXCLUDED.name, segment = EXCLUDED.segment,
  fuel_types = EXCLUDED.fuel_types, start_year = EXCLUDED.start_year,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- KTM models
-- ============================================================
INSERT INTO vehicle_models (oem_id, name, slug, segment, fuel_types, start_year, sort_order)
SELECT o.id, v.name, v.slug, v.segment, v.fuel_types::text[], v.start_year, v.sort_order
FROM vehicle_oems o
JOIN (VALUES
  ('Duke 125',      'duke-125',      'naked',     '{petrol}', 2018, 1),
  ('Duke 200',      'duke-200',      'naked',     '{petrol}', 2012, 2),
  ('Duke 390',      'duke-390',      'naked',     '{petrol}', 2013, 3),
  ('RC 200',        'rc-200',        'sports',    '{petrol}', 2014, 4),
  ('RC 390',        'rc-390',        'sports',    '{petrol}', 2014, 5),
  ('Adventure 390', 'adventure-390', 'adventure', '{petrol}', 2020, 6)
) AS v(name, slug, segment, fuel_types, start_year, sort_order) ON true
WHERE o.slug = 'ktm'
ON CONFLICT (oem_id, slug) DO UPDATE SET
  name = EXCLUDED.name, segment = EXCLUDED.segment,
  fuel_types = EXCLUDED.fuel_types, start_year = EXCLUDED.start_year,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- ATHER models
-- ============================================================
INSERT INTO vehicle_models (oem_id, name, slug, segment, fuel_types, start_year, sort_order)
SELECT o.id, v.name, v.slug, v.segment, v.fuel_types::text[], v.start_year, v.sort_order
FROM vehicle_oems o
JOIN (VALUES
  ('450X',  '450x',  'scooter', '{electric}', 2019, 1),
  ('450S',  '450s',  'scooter', '{electric}', 2022, 2),
  ('Rizta', 'rizta', 'scooter', '{electric}', 2024, 3)
) AS v(name, slug, segment, fuel_types, start_year, sort_order) ON true
WHERE o.slug = 'ather'
ON CONFLICT (oem_id, slug) DO UPDATE SET
  name = EXCLUDED.name, segment = EXCLUDED.segment,
  fuel_types = EXCLUDED.fuel_types, start_year = EXCLUDED.start_year,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- OLA ELECTRIC models
-- ============================================================
INSERT INTO vehicle_models (oem_id, name, slug, segment, fuel_types, start_year, sort_order)
SELECT o.id, v.name, v.slug, v.segment, v.fuel_types::text[], v.start_year, v.sort_order
FROM vehicle_oems o
JOIN (VALUES
  ('S1 Pro', 's1-pro', 'scooter', '{electric}', 2021, 1),
  ('S1 Air', 's1-air', 'scooter', '{electric}', 2022, 2),
  ('S1 X',   's1-x',   'scooter', '{electric}', 2023, 3)
) AS v(name, slug, segment, fuel_types, start_year, sort_order) ON true
WHERE o.slug = 'ola-electric'
ON CONFLICT (oem_id, slug) DO UPDATE SET
  name = EXCLUDED.name, segment = EXCLUDED.segment,
  fuel_types = EXCLUDED.fuel_types, start_year = EXCLUDED.start_year,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- AMPERE models
-- ============================================================
INSERT INTO vehicle_models (oem_id, name, slug, segment, fuel_types, start_year, sort_order)
SELECT o.id, v.name, v.slug, v.segment, v.fuel_types::text[], v.start_year, v.sort_order
FROM vehicle_oems o
JOIN (VALUES
  ('Magnus', 'magnus', 'scooter', '{electric}', 2018, 1),
  ('Primus', 'primus', 'scooter', '{electric}', 2022, 2),
  ('Zeal',   'zeal',   'scooter', '{electric}', 2020, 3)
) AS v(name, slug, segment, fuel_types, start_year, sort_order) ON true
WHERE o.slug = 'ampere'
ON CONFLICT (oem_id, slug) DO UPDATE SET
  name = EXCLUDED.name, segment = EXCLUDED.segment,
  fuel_types = EXCLUDED.fuel_types, start_year = EXCLUDED.start_year,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- PURE EV models
-- ============================================================
INSERT INTO vehicle_models (oem_id, name, slug, segment, fuel_types, start_year, sort_order)
SELECT o.id, v.name, v.slug, v.segment, v.fuel_types::text[], v.start_year, v.sort_order
FROM vehicle_oems o
JOIN (VALUES
  ('EPluto', 'epluto', 'scooter', '{electric}', 2019, 1),
  ('Etryst', 'etryst', 'scooter', '{electric}', 2021, 2)
) AS v(name, slug, segment, fuel_types, start_year, sort_order) ON true
WHERE o.slug = 'pure-ev'
ON CONFLICT (oem_id, slug) DO UPDATE SET
  name = EXCLUDED.name, segment = EXCLUDED.segment,
  fuel_types = EXCLUDED.fuel_types, start_year = EXCLUDED.start_year,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- REVOLT models
-- ============================================================
INSERT INTO vehicle_models (oem_id, name, slug, segment, fuel_types, start_year, sort_order)
SELECT o.id, v.name, v.slug, v.segment, v.fuel_types::text[], v.start_year, v.sort_order
FROM vehicle_oems o
JOIN (VALUES
  ('RV400', 'rv400', 'commuter', '{electric}', 2019, 1),
  ('RV1',   'rv1',   'commuter', '{electric}', 2023, 2)
) AS v(name, slug, segment, fuel_types, start_year, sort_order) ON true
WHERE o.slug = 'revolt'
ON CONFLICT (oem_id, slug) DO UPDATE SET
  name = EXCLUDED.name, segment = EXCLUDED.segment,
  fuel_types = EXCLUDED.fuel_types, start_year = EXCLUDED.start_year,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- ULTRAVIOLETTE models
-- ============================================================
INSERT INTO vehicle_models (oem_id, name, slug, segment, fuel_types, start_year, sort_order)
SELECT o.id, v.name, v.slug, v.segment, v.fuel_types::text[], v.start_year, v.sort_order
FROM vehicle_oems o
JOIN (VALUES
  ('F77', 'f77', 'sports', '{electric}', 2023, 1)
) AS v(name, slug, segment, fuel_types, start_year, sort_order) ON true
WHERE o.slug = 'ultraviolette'
ON CONFLICT (oem_id, slug) DO UPDATE SET
  name = EXCLUDED.name, segment = EXCLUDED.segment,
  fuel_types = EXCLUDED.fuel_types, start_year = EXCLUDED.start_year,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- Service intervals — petrol commuter template (Splendor Plus)
-- ============================================================
INSERT INTO service_intervals (model_id, interval_km, interval_months, service_type, description)
SELECT m.id, s.interval_km, s.interval_months, s.service_type, s.description
FROM vehicle_models m
JOIN vehicle_oems o ON o.id = m.oem_id
CROSS JOIN (VALUES
  (500,   1,  'free_service',    '1st Free Service — running-in check'),
  (2000,  3,  'free_service',    '2nd Free Service'),
  (4000,  6,  'free_service',    '3rd Free Service'),
  (6000,  6,  'general_service', 'Regular Service — engine oil and filters'),
  (12000, 12, 'minor_service',   'Minor Service — air filter, spark plug'),
  (24000, 24, 'major_service',   'Major Service — full tune-up')
) AS s(interval_km, interval_months, service_type, description)
WHERE o.slug = 'hero' AND m.slug = 'splendor-plus';
