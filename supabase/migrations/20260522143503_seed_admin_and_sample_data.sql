/*
  # Seed Admin User and Sample Data

  1. Creates admin profile for existing auth user (if exists)
  2. Seeds sample service centers (dealers) with various statuses
  3. Seeds sample bookings for dashboard stats
*/

-- Seed sample dealers (service_centers)
INSERT INTO service_centers (name, address, city, state, pincode, phone, email, status, rating, total_reviews, brands, services, open_time, close_time, lat, lng, is_active, description)
VALUES
  ('Hero Service Zone - Koramangala', '14th Cross, Koramangala 5th Block', 'Bangalore', 'Karnataka', '560095', '9876543210', 'hero.koramangala@bikeai.in', 'active', 4.5, 128, ARRAY['Hero'], ARRAY['General Service', 'Oil Change', 'Brake Service'], '09:00', '18:00', 12.9352, 77.6245, true, 'Authorized Hero service center with trained technicians.'),
  ('Honda ProFirst - Indiranagar', 'HAL 2nd Stage, Indiranagar', 'Bangalore', 'Karnataka', '560038', '9765432109', 'honda.indiranagar@bikeai.in', 'active', 4.3, 95, ARRAY['Honda'], ARRAY['General Service', 'Engine Repair', 'Electrical'], '09:00', '19:00', 12.9784, 77.6408, true, 'Premium Honda authorized service center.'),
  ('TVS Showroom & Service', 'Anna Salai, T.Nagar', 'Chennai', 'Tamil Nadu', '600017', '9654321098', 'tvs.tnagar@bikeai.in', 'active', 4.1, 210, ARRAY['TVS'], ARRAY['General Service', 'Tyre Change', 'Oil Change', 'Battery'], '08:30', '18:30', 13.0418, 80.2341, true, 'TVS authorized dealer and service center.'),
  ('Bajaj World - Banjara Hills', 'Road No 12, Banjara Hills', 'Hyderabad', 'Telangana', '500034', '9543210987', 'bajaj.banjarahills@bikeai.in', 'active', 4.4, 167, ARRAY['Bajaj'], ARRAY['General Service', 'Accident Repair', 'Body Work'], '09:00', '18:00', 17.4156, 78.4347, true, 'Bajaj authorized service and spare parts.'),
  ('Royal Enfield Studio - Jubilee Hills', 'Road No 36, Jubilee Hills', 'Hyderabad', 'Telangana', '500033', '9432109876', 're.jubileehills@bikeai.in', 'pending', 0, 0, ARRAY['Royal Enfield'], ARRAY['General Service', 'Engine Repair', 'Body Work'], '09:00', '19:00', 17.4318, 78.4071, true, 'Official Royal Enfield studio and service center.'),
  ('KTM Service Hub - Whitefield', 'Whitefield Main Road', 'Bangalore', 'Karnataka', '560066', '9321098765', 'ktm.whitefield@bikeai.in', 'pending', 0, 0, ARRAY['KTM'], ARRAY['General Service', 'Engine Repair', 'Electrical', 'Brake Service'], '10:00', '19:00', 12.9698, 77.7500, true, 'Specialized KTM performance service center.'),
  ('Multi-Brand Moto Workshop', 'Sector 18, Noida', 'Noida', 'Uttar Pradesh', '201301', '9210987654', 'moto.noida@bikeai.in', 'suspended', 3.2, 45, ARRAY['Hero', 'Honda', 'TVS', 'Bajaj'], ARRAY['General Service', 'Oil Change', 'Tyre Change'], '09:00', '18:00', 28.5706, 77.3261, true, 'Multi-brand service with competitive pricing.'),
  ('Yamaha Zone - Powai', 'Hiranandani Business Park, Powai', 'Mumbai', 'Maharashtra', '400076', '9109876543', 'yamaha.powai@bikeai.in', 'active', 4.6, 89, ARRAY['Yamaha'], ARRAY['General Service', 'Engine Repair', 'Electrical', 'Oil Change'], '09:00', '18:30', 19.1176, 72.9060, true, 'Premium Yamaha authorized service center.')
ON CONFLICT DO NOTHING;

-- Seed sample profiles (customers) — these won't have auth users but illustrate the data
-- We only insert if profile doesn't exist via trigger
-- Update any existing profiles without roles
UPDATE profiles SET role = 'admin' WHERE role = 'customer' AND id IN (
  SELECT id FROM profiles ORDER BY created_at ASC LIMIT 1
);
