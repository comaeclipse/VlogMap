-- Location ID Migration Script for Neon Console
-- Run this directly in your Neon SQL Editor

-- Step 1: Ensure schema exists (should already be there from app startup)
CREATE TABLE IF NOT EXISTS locations (
  id VARCHAR(8) PRIMARY KEY,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  city TEXT,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_coords ON locations (latitude, longitude);

ALTER TABLE explorer_markers
  ADD COLUMN IF NOT EXISTS location_id VARCHAR(8);

-- Add foreign key constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_location_id'
  ) THEN
    ALTER TABLE explorer_markers
      ADD CONSTRAINT fk_location_id
      FOREIGN KEY (location_id)
      REFERENCES locations(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_markers_location_id ON explorer_markers (location_id);

-- Step 2: Create function to generate random alphanumeric IDs
CREATE OR REPLACE FUNCTION generate_location_id() RETURNS VARCHAR(8) AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result VARCHAR(8) := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create function to calculate distance between two points (Haversine formula)
CREATE OR REPLACE FUNCTION haversine_distance(
  lat1 DOUBLE PRECISION,
  lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
DECLARE
  R DOUBLE PRECISION := 6371; -- Earth radius in kilometers
  dLat DOUBLE PRECISION;
  dLon DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  dLat := radians(lat2 - lat1);
  dLon := radians(lon2 - lon1);

  a := sin(dLat/2) * sin(dLat/2) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(dLon/2) * sin(dLon/2);

  c := 2 * atan2(sqrt(a), sqrt(1-a));

  RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 4: Perform the migration
DO $$
DECLARE
  marker_record RECORD;
  nearby_location_id VARCHAR(8);
  new_location_id VARCHAR(8);
  distance_km DOUBLE PRECISION;
  assigned_count INTEGER := 0;
  created_locations INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting location ID migration...';

  -- Loop through all markers without location_id
  FOR marker_record IN
    SELECT id, latitude, longitude, city
    FROM explorer_markers
    WHERE location_id IS NULL
    ORDER BY created_at ASC
  LOOP
    nearby_location_id := NULL;

    -- Try to find a nearby location (within 200m = 0.2km)
    SELECT l.id INTO nearby_location_id
    FROM locations l
    WHERE haversine_distance(
      marker_record.latitude,
      marker_record.longitude,
      l.latitude,
      l.longitude
    ) <= 0.2
    LIMIT 1;

    -- If no nearby location found, create a new one
    IF nearby_location_id IS NULL THEN
      LOOP
        new_location_id := generate_location_id();

        -- Check if ID already exists
        IF NOT EXISTS (SELECT 1 FROM locations WHERE id = new_location_id) THEN
          -- Create new location
          INSERT INTO locations (id, latitude, longitude, city)
          VALUES (new_location_id, marker_record.latitude, marker_record.longitude, marker_record.city);

          nearby_location_id := new_location_id;
          created_locations := created_locations + 1;
          EXIT;
        END IF;
      END LOOP;
    END IF;

    -- Assign location to marker
    UPDATE explorer_markers
    SET location_id = nearby_location_id
    WHERE id = marker_record.id;

    assigned_count := assigned_count + 1;

    -- Log progress every 10 markers
    IF assigned_count % 10 = 0 THEN
      RAISE NOTICE 'Processed % markers...', assigned_count;
    END IF;
  END LOOP;

  RAISE NOTICE 'Migration complete!';
  RAISE NOTICE 'Assigned location IDs to % markers', assigned_count;
  RAISE NOTICE 'Created % new locations', created_locations;

  -- Update centroids for all locations
  RAISE NOTICE 'Updating location centroids...';

  UPDATE locations l
  SET
    latitude = centroid.avg_lat,
    longitude = centroid.avg_lon,
    updated_at = NOW()
  FROM (
    SELECT
      location_id,
      AVG(latitude) as avg_lat,
      AVG(longitude) as avg_lon
    FROM explorer_markers
    WHERE location_id IS NOT NULL
    GROUP BY location_id
  ) centroid
  WHERE l.id = centroid.location_id;

  RAISE NOTICE 'Centroids updated!';
END $$;

-- Step 5: Show migration statistics
SELECT
  COUNT(DISTINCT location_id) as total_locations,
  COUNT(*) as total_markers,
  ROUND(AVG(marker_count), 2) as avg_markers_per_location
FROM (
  SELECT location_id, COUNT(*) as marker_count
  FROM explorer_markers
  WHERE location_id IS NOT NULL
  GROUP BY location_id
) stats;

-- Show top 10 locations by marker count
SELECT
  l.id as location_id,
  l.city,
  l.latitude,
  l.longitude,
  COUNT(m.id) as marker_count,
  COUNT(DISTINCT m.video_url) FILTER (WHERE m.video_url IS NOT NULL) as video_count
FROM locations l
LEFT JOIN explorer_markers m ON l.id = m.location_id
GROUP BY l.id, l.city, l.latitude, l.longitude
ORDER BY marker_count DESC
LIMIT 10;
