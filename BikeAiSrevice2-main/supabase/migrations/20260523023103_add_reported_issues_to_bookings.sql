/*
  # Add reported_issues column to customer_bookings

  ## Changes
  - Adds `reported_issues` (text) column to `customer_bookings`
    Stores comma-separated issue IDs selected in the booking flow
    (e.g. "low_pickup,low_mileage,engine_noise")
  - Used by the dealer dashboard and AI diagnosis workflow

  ## Notes
  - Nullable — existing rows unaffected
  - No RLS changes needed (inherits existing policies)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_bookings' AND column_name = 'reported_issues'
  ) THEN
    ALTER TABLE customer_bookings ADD COLUMN reported_issues text;
  END IF;
END $$;
