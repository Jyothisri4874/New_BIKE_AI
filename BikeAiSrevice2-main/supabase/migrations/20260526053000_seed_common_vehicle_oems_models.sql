/*
  # Seed common two-wheeler OEMs and models

  Adds idempotent active OEM/model rows required by customer booking and
  dealer search. This migration does not create service centers.
*/

INSERT INTO vehicle_oems (name, slug, country, is_ev_brand, sort_order, is_active)
VALUES
  ('Honda', 'honda', 'Japan', false, 10, true),
  ('Hero', 'hero', 'India', false, 20, true),
  ('TVS', 'tvs', 'India', false, 30, true),
  ('Bajaj', 'bajaj', 'India', false, 40, true),
  ('Royal Enfield', 'royal-enfield', 'India', false, 50, true),
  ('Yamaha', 'yamaha', 'Japan', false, 60, true),
  ('Suzuki', 'suzuki', 'Japan', false, 70, true),
  ('KTM', 'ktm', 'Austria', false, 80, true),
  ('Ola Electric', 'ola-electric', 'India', true, 90, true),
  ('Ather', 'ather', 'India', true, 100, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  country = EXCLUDED.country,
  is_ev_brand = EXCLUDED.is_ev_brand,
  sort_order = EXCLUDED.sort_order,
  is_active = true;

WITH model_seed(oem_slug, name, slug, segment, fuel_types, start_year, sort_order) AS (
  VALUES
    ('honda', 'Activa 6G', 'activa-6g', 'scooter', ARRAY['petrol']::text[], 2019, 1),
    ('honda', 'Activa 125', 'activa-125', 'scooter', ARRAY['petrol']::text[], 2013, 2),
    ('honda', 'Shine', 'shine', 'commuter', ARRAY['petrol']::text[], 2006, 3),
    ('honda', 'SP125', 'sp125', 'commuter', ARRAY['petrol']::text[], 2019, 4),
    ('honda', 'Unicorn', 'unicorn', 'commuter', ARRAY['petrol']::text[], 2004, 5),
    ('hero', 'Splendor Plus', 'splendor-plus', 'commuter', ARRAY['petrol']::text[], 2000, 1),
    ('hero', 'HF Deluxe', 'hf-deluxe', 'commuter', ARRAY['petrol']::text[], 2005, 2),
    ('hero', 'Passion Pro', 'passion-pro', 'commuter', ARRAY['petrol']::text[], 2001, 3),
    ('hero', 'Glamour', 'glamour', 'commuter', ARRAY['petrol']::text[], 2005, 4),
    ('hero', 'Xpulse 200', 'xpulse-200', 'adventure', ARRAY['petrol']::text[], 2019, 5),
    ('tvs', 'Jupiter', 'jupiter', 'scooter', ARRAY['petrol']::text[], 2013, 1),
    ('tvs', 'NTorq 125', 'ntorq-125', 'scooter', ARRAY['petrol']::text[], 2018, 2),
    ('tvs', 'Apache RTR 160', 'apache-rtr-160', 'sports', ARRAY['petrol']::text[], 2008, 3),
    ('tvs', 'Raider 125', 'raider-125', 'commuter', ARRAY['petrol']::text[], 2021, 4),
    ('tvs', 'iQube', 'iqube', 'scooter', ARRAY['electric']::text[], 2020, 5),
    ('bajaj', 'Pulsar 150', 'pulsar-150', 'sports', ARRAY['petrol']::text[], 2001, 1),
    ('bajaj', 'Pulsar NS200', 'pulsar-ns200', 'sports', ARRAY['petrol']::text[], 2012, 2),
    ('bajaj', 'Platina', 'platina', 'commuter', ARRAY['petrol']::text[], 2006, 3),
    ('bajaj', 'Avenger', 'avenger', 'cruiser', ARRAY['petrol']::text[], 2002, 4),
    ('bajaj', 'Chetak EV', 'chetak-ev', 'scooter', ARRAY['electric']::text[], 2020, 5),
    ('royal-enfield', 'Classic 350', 'classic-350', 'retro', ARRAY['petrol']::text[], 2009, 1),
    ('royal-enfield', 'Bullet 350', 'bullet-350', 'cruiser', ARRAY['petrol']::text[], 1955, 2),
    ('royal-enfield', 'Hunter 350', 'hunter-350', 'retro', ARRAY['petrol']::text[], 2022, 3),
    ('royal-enfield', 'Meteor 350', 'meteor-350', 'cruiser', ARRAY['petrol']::text[], 2020, 4),
    ('royal-enfield', 'Himalayan', 'himalayan', 'adventure', ARRAY['petrol']::text[], 2016, 5),
    ('yamaha', 'FZ', 'fz', 'naked', ARRAY['petrol']::text[], 2008, 1),
    ('yamaha', 'MT15', 'mt15', 'naked', ARRAY['petrol']::text[], 2019, 2),
    ('yamaha', 'R15', 'r15', 'sports', ARRAY['petrol']::text[], 2008, 3),
    ('yamaha', 'Fascino', 'fascino', 'scooter', ARRAY['petrol']::text[], 2015, 4),
    ('yamaha', 'RayZR', 'rayzr', 'scooter', ARRAY['petrol']::text[], 2017, 5),
    ('suzuki', 'Access 125', 'access-125', 'scooter', ARRAY['petrol']::text[], 2007, 1),
    ('suzuki', 'Burgman Street', 'burgman-street', 'scooter', ARRAY['petrol']::text[], 2018, 2),
    ('suzuki', 'Avenis', 'avenis', 'scooter', ARRAY['petrol']::text[], 2021, 3),
    ('suzuki', 'Gixxer', 'gixxer', 'sports', ARRAY['petrol']::text[], 2014, 4),
    ('suzuki', 'V-Strom SX', 'v-strom-sx', 'adventure', ARRAY['petrol']::text[], 2022, 5),
    ('ktm', 'Duke 200', 'duke-200', 'naked', ARRAY['petrol']::text[], 2012, 1),
    ('ktm', 'Duke 390', 'duke-390', 'naked', ARRAY['petrol']::text[], 2013, 2),
    ('ktm', 'RC 200', 'rc-200', 'sports', ARRAY['petrol']::text[], 2014, 3),
    ('ktm', 'RC 390', 'rc-390', 'sports', ARRAY['petrol']::text[], 2014, 4),
    ('ktm', 'Adventure 390', 'adventure-390', 'adventure', ARRAY['petrol']::text[], 2020, 5),
    ('ola-electric', 'S1 Pro', 's1-pro', 'scooter', ARRAY['electric']::text[], 2021, 1),
    ('ola-electric', 'S1 Air', 's1-air', 'scooter', ARRAY['electric']::text[], 2022, 2),
    ('ola-electric', 'S1 X', 's1-x', 'scooter', ARRAY['electric']::text[], 2023, 3),
    ('ather', '450X', '450x', 'scooter', ARRAY['electric']::text[], 2019, 1),
    ('ather', '450S', '450s', 'scooter', ARRAY['electric']::text[], 2022, 2),
    ('ather', 'Rizta', 'rizta', 'scooter', ARRAY['electric']::text[], 2024, 3)
)
INSERT INTO vehicle_models (oem_id, name, slug, segment, fuel_types, start_year, sort_order, is_active)
SELECT o.id, m.name, m.slug, m.segment, m.fuel_types, m.start_year, m.sort_order, true
FROM model_seed m
JOIN vehicle_oems o ON o.slug = m.oem_slug
ON CONFLICT (oem_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  segment = EXCLUDED.segment,
  fuel_types = EXCLUDED.fuel_types,
  start_year = EXCLUDED.start_year,
  sort_order = EXCLUDED.sort_order,
  is_active = true;

UPDATE service_centers
SET supported_oems = array_replace(supported_oems, 'royalenfield', 'royal-enfield')
WHERE supported_oems @> ARRAY['royalenfield']::text[];
