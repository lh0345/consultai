-- One professor-wide schedule. Adjacent slots are allowed; overlapping ranges are not.
ALTER TABLE "Slot"
  ADD CONSTRAINT "Slot_valid_duration" CHECK (
    "endsAt" > "startsAt" AND "endsAt" - "startsAt" BETWEEN INTERVAL '15 minutes' AND INTERVAL '180 minutes'
  ),
  ADD CONSTRAINT "Slot_no_overlap" EXCLUDE USING gist (tstzrange("startsAt", "endsAt", '[)') WITH &&);

ALTER TABLE "Subject"
  ADD CONSTRAINT "Subject_name_valid" CHECK (length(btrim(name)) >= 2),
  ADD CONSTRAINT "Subject_icon_valid" CHECK (icon IN ('database', 'network', 'code', 'book'));
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_name_valid" CHECK (length(btrim(name)) >= 2),
  ADD CONSTRAINT "Booking_email_valid" CHECK (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  ADD CONSTRAINT "Booking_calendar_status_valid" CHECK ("calendarStatus" IN ('not_connected', 'pending', 'synced', 'failed'));
ALTER TABLE "Material"
  ADD CONSTRAINT "Material_content_bounded" CHECK (length(content) <= 60000),
  ADD CONSTRAINT "Material_approval_requires_content" CHECK (NOT approved OR length(btrim(content)) >= 20);

-- The row lock also protects callers that bypass the API and write directly.
CREATE FUNCTION protect_booking() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE slot_start timestamptz;
BEGIN
  SELECT "startsAt" INTO slot_start FROM "Slot" WHERE id = NEW."slotId" FOR UPDATE;
  IF slot_start IS NULL OR slot_start <= CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'Bookings require a future slot' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Booking_future_slot" BEFORE INSERT OR UPDATE OF "slotId" ON "Booking"
  FOR EACH ROW EXECUTE FUNCTION protect_booking();

CREATE FUNCTION protect_booked_slot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Booking" WHERE "slotId" = OLD.id) THEN
    RAISE EXCEPTION 'Booked slots cannot be changed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Slot_booked_immutable" BEFORE UPDATE OF "startsAt", "endsAt" ON "Slot"
  FOR EACH ROW EXECUTE FUNCTION protect_booked_slot();
