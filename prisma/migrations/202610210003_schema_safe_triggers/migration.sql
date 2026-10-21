-- Trigger lookups must stay in the table's own schema, regardless of connection search_path.
CREATE OR REPLACE FUNCTION protect_booking() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE slot_start timestamptz;
BEGIN
  EXECUTE format('SELECT "startsAt" FROM %I."Slot" WHERE id = $1 FOR UPDATE', TG_TABLE_SCHEMA)
    INTO slot_start USING NEW."slotId";
  IF slot_start IS NULL OR slot_start <= CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'Bookings require a future slot' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION protect_booked_slot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE booked boolean;
BEGIN
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I."Booking" WHERE "slotId" = $1)', TG_TABLE_SCHEMA)
    INTO booked USING OLD.id;
  IF booked THEN
    RAISE EXCEPTION 'Booked slots cannot be changed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
