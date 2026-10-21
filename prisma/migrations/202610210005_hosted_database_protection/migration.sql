-- Only the owning server role accesses app tables. Browser roles have no direct policies.
ALTER TABLE "Subject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Slot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Booking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Material" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Integration" ENABLE ROW LEVEL SECURITY;

-- Trigger table lookups are schema-qualified; built-ins resolve only in pg_catalog.
ALTER FUNCTION protect_booking() SET search_path = pg_catalog;
ALTER FUNCTION protect_booked_slot() SET search_path = pg_catalog;
