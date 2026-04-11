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

-- Migration path to Tier 2 (run when ready for PostGIS):
-- ALTER TABLE communities ADD COLUMN geom geometry(MultiPolygon, 4326);
-- UPDATE communities SET geom = ST_GeomFromGeoJSON(geojson->>'geometry');
-- CREATE INDEX ON communities USING GIST(geom);
