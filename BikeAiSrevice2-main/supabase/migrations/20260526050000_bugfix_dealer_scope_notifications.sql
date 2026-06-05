-- Bugfix: dealer-scoped operational visibility for CRM, riders, and notifications.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
      AND policyname = 'Dealers can view booking scoped customer profiles'
  ) THEN
    CREATE POLICY "Dealers can view booking scoped customer profiles"
      ON profiles FOR SELECT TO authenticated
      USING (
        role = 'customer'
        AND (
          EXISTS (
            SELECT 1
            FROM customer_bookings cb
            JOIN service_centers sc ON sc.id = cb.service_center_id
            WHERE cb.customer_id = profiles.id
              AND sc.owner_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM service_job_cards jc
            JOIN service_centers sc ON sc.id = jc.service_center_id
            WHERE jc.customer_id = profiles.id
              AND sc.owner_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM crm_followups cf
            JOIN service_centers sc ON sc.id = cf.service_center_id
            WHERE cf.customer_id = profiles.id
              AND sc.owner_id = auth.uid()
          )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
      AND policyname = 'Dealers can update booking scoped customer profiles'
  ) THEN
    CREATE POLICY "Dealers can update booking scoped customer profiles"
      ON profiles FOR UPDATE TO authenticated
      USING (
        role = 'customer'
        AND (
          EXISTS (
            SELECT 1
            FROM service_centers sc
            WHERE sc.id = preferred_center_id
              AND sc.owner_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM customer_bookings cb
            JOIN service_centers sc ON sc.id = cb.service_center_id
            WHERE cb.customer_id = profiles.id
              AND sc.owner_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM service_job_cards jc
            JOIN service_centers sc ON sc.id = jc.service_center_id
            WHERE jc.customer_id = profiles.id
              AND sc.owner_id = auth.uid()
          )
        )
      )
      WITH CHECK (
        role = 'customer'
        AND (
          preferred_center_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM service_centers sc
            WHERE sc.id = preferred_center_id
              AND sc.owner_id = auth.uid()
          )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'customer_vehicles'
      AND policyname = 'Dealers can view booking scoped customer vehicles'
  ) THEN
    CREATE POLICY "Dealers can view booking scoped customer vehicles"
      ON customer_vehicles FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM service_centers sc
          WHERE sc.id = preferred_center_id
            AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
        )
        OR EXISTS (
          SELECT 1
          FROM customer_bookings cb
          JOIN service_centers sc ON sc.id = cb.service_center_id
          WHERE cb.vehicle_id = customer_vehicles.id
            AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
        )
        OR EXISTS (
          SELECT 1
          FROM service_job_cards jc
          JOIN service_centers sc ON sc.id = jc.service_center_id
          WHERE jc.vehicle_id = customer_vehicles.id
            AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'customer_vehicles'
      AND policyname = 'Dealers can update booking scoped customer vehicles'
  ) THEN
    CREATE POLICY "Dealers can update booking scoped customer vehicles"
      ON customer_vehicles FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM service_centers sc
          WHERE sc.id = preferred_center_id
            AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
        )
        OR EXISTS (
          SELECT 1
          FROM customer_bookings cb
          JOIN service_centers sc ON sc.id = cb.service_center_id
          WHERE cb.vehicle_id = customer_vehicles.id
            AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
        )
        OR EXISTS (
          SELECT 1
          FROM service_job_cards jc
          JOIN service_centers sc ON sc.id = jc.service_center_id
          WHERE jc.vehicle_id = customer_vehicles.id
            AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
        )
      )
      WITH CHECK (
        preferred_center_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM service_centers sc
          WHERE sc.id = preferred_center_id
            AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'riders'
      AND policyname = 'Dealers manage own riders'
  ) THEN
    CREATE POLICY "Dealers manage own riders"
      ON riders FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM service_centers sc
          WHERE sc.id = service_center_id
            AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM service_centers sc
          WHERE sc.id = service_center_id
            AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pickup_deliveries'
      AND policyname = 'Dealers manage own pickup deliveries'
  ) THEN
    CREATE POLICY "Dealers manage own pickup deliveries"
      ON pickup_deliveries FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM service_centers sc
          WHERE sc.id = service_center_id
            AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM service_centers sc
          WHERE sc.id = service_center_id
            AND (sc.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
        )
      );
  END IF;
END $$;
