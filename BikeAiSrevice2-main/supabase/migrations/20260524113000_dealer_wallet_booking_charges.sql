/*
  # Dealer Wallet and BikeAI Booking Charges

  Adds dealer credit balances and an idempotent ledger for charging BikeAI
  generated bookings once when confirmed or converted into a job card.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_bookings' AND column_name='booking_source') THEN
    ALTER TABLE customer_bookings ADD COLUMN booking_source text DEFAULT 'bikeai' CHECK (booking_source IN ('bikeai', 'dealer_manual', 'demo', 'test', 'external'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_bookings' AND column_name='is_chargeable') THEN
    ALTER TABLE customer_bookings ADD COLUMN is_chargeable boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_job_cards' AND column_name='is_chargeable') THEN
    ALTER TABLE service_job_cards ADD COLUMN is_chargeable boolean DEFAULT true;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS dealer_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_center_id uuid NOT NULL UNIQUE REFERENCES service_centers(id) ON DELETE CASCADE,
  credit_balance numeric(10,2) NOT NULL DEFAULT 0,
  low_balance_threshold numeric(10,2) NOT NULL DEFAULT 600,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'low_balance', 'suspended')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bikeai_booking_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_center_id uuid NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES customer_bookings(id) ON DELETE SET NULL,
  job_card_id uuid REFERENCES service_job_cards(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  charge_amount numeric(10,2) NOT NULL DEFAULT 60,
  charge_status text NOT NULL DEFAULT 'charged' CHECK (charge_status IN ('pending', 'charged', 'waived', 'reversed')),
  charge_reason text NOT NULL DEFAULT 'bikeai_successful_booking',
  booking_source text NOT NULL DEFAULT 'bikeai',
  charged_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(booking_id)
);

CREATE TABLE IF NOT EXISTS dealer_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_center_id uuid NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('credit_topup', 'booking_charge', 'charge_reversal', 'manual_adjustment')),
  amount numeric(10,2) NOT NULL,
  balance_after numeric(10,2) NOT NULL,
  reference_type text DEFAULT '',
  reference_id uuid,
  notes text DEFAULT '',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dealer_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bikeai_booking_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealer_wallet_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dealer_wallets' AND policyname='Dealers manage own wallet') THEN
    CREATE POLICY "Dealers manage own wallet"
      ON dealer_wallets FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))))
      WITH CHECK (EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bikeai_booking_charges' AND policyname='Dealers view own booking charges') THEN
    CREATE POLICY "Dealers view own booking charges"
      ON bikeai_booking_charges FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))))
      WITH CHECK (EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dealer_wallet_transactions' AND policyname='Dealers view own wallet transactions') THEN
    CREATE POLICY "Dealers view own wallet transactions"
      ON dealer_wallet_transactions FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))))
      WITH CHECK (EXISTS (SELECT 1 FROM service_centers sc WHERE sc.id = service_center_id AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION charge_bikeai_booking_once(p_booking_id uuid, p_job_card_id uuid DEFAULT NULL, p_actor_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  booking customer_bookings%rowtype;
  wallet dealer_wallets%rowtype;
  new_balance numeric(10,2);
  charge_id uuid;
BEGIN
  SELECT * INTO booking FROM customer_bookings WHERE id = p_booking_id LIMIT 1;
  IF booking.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'booking_not_found');
  END IF;

  IF booking.status = 'cancelled'
     OR COALESCE(booking.booking_source, 'bikeai') IN ('demo', 'test', 'dealer_manual', 'external')
     OR COALESCE(booking.is_chargeable, true) = false THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_chargeable');
  END IF;

  IF NOT (booking.status IN ('confirmed', 'in_progress', 'completed') OR p_job_card_id IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_successful_yet');
  END IF;

  INSERT INTO dealer_wallets(service_center_id)
  VALUES (booking.service_center_id)
  ON CONFLICT (service_center_id) DO NOTHING;

  SELECT * INTO wallet FROM dealer_wallets WHERE service_center_id = booking.service_center_id FOR UPDATE;

  INSERT INTO bikeai_booking_charges(service_center_id, booking_id, job_card_id, customer_id, charge_amount, booking_source)
  VALUES (booking.service_center_id, booking.id, p_job_card_id, booking.customer_id, 60, COALESCE(booking.booking_source, 'bikeai'))
  ON CONFLICT (booking_id) DO NOTHING
  RETURNING id INTO charge_id;

  IF charge_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_charged');
  END IF;

  new_balance := wallet.credit_balance - 60;

  UPDATE dealer_wallets
  SET credit_balance = new_balance,
      status = CASE WHEN new_balance <= low_balance_threshold THEN 'low_balance' ELSE 'active' END,
      updated_at = now()
  WHERE id = wallet.id;

  INSERT INTO dealer_wallet_transactions(service_center_id, transaction_type, amount, balance_after, reference_type, reference_id, notes, created_by)
  VALUES (booking.service_center_id, 'booking_charge', -60, new_balance, 'bikeai_booking_charge', charge_id, 'BikeAI successful booking charge', p_actor_id);

  RETURN jsonb_build_object('ok', true, 'charge_id', charge_id, 'balance_after', new_balance);
END;
$$;

CREATE INDEX IF NOT EXISTS idx_booking_charges_center_time ON bikeai_booking_charges(service_center_id, charged_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_center_time ON dealer_wallet_transactions(service_center_id, created_at DESC);
