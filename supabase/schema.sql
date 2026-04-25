-- geographic.community - Tier 1 schema
-- Run this in the Supabase SQL editor

CREATE TABLE communities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  description text,
  category    text NOT NULL DEFAULT 'other',
  website     text,
  email       text,
  geojson     jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- At least one contact method is required
  CONSTRAINT has_contact CHECK (website IS NOT NULL OR email IS NOT NULL)
);

-- Useful index for slug lookups
CREATE INDEX communities_slug_idx ON communities (slug);

-- ── Tier 2 additions ──────────────────────────────────────

-- Ownership: tiered trust model
ALTER TABLE communities ADD COLUMN claimed_by uuid REFERENCES auth.users(id);
ALTER TABLE communities ADD COLUMN claimed_at timestamptz;
CREATE INDEX communities_claimed_by_idx ON communities (claimed_by);

-- Reports table
CREATE TABLE reports (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id   uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  reason         text NOT NULL,
  reporter_email text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reports_community_id_idx ON reports (community_id);

-- Row Level Security
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON communities FOR SELECT USING (true);
CREATE POLICY "public_insert" ON communities FOR INSERT WITH CHECK (true);
CREATE POLICY "update_policy" ON communities FOR UPDATE
  USING (claimed_by IS NULL OR claimed_by = auth.uid());
CREATE POLICY "delete_policy" ON communities FOR DELETE
  USING (claimed_by IS NULL OR claimed_by = auth.uid());

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_insert_reports" ON reports FOR INSERT WITH CHECK (true);
CREATE POLICY "public_read_reports" ON reports FOR SELECT USING (true);

-- ── Audit additions ───────────────────────────────────────

ALTER TABLE communities ADD COLUMN updated_at timestamptz;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER communities_set_updated_at
BEFORE UPDATE ON communities
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Migration path to Tier 3 (run when ready for PostGIS):
-- ALTER TABLE communities ADD COLUMN geom geometry(MultiPolygon, 4326);
-- UPDATE communities SET geom = ST_GeomFromGeoJSON(geojson->>'geometry');
-- CREATE INDEX ON communities USING GIST(geom);
