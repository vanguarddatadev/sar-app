-- Organization Settings Migration
-- Created: 2025-10-17
-- Adds tables for organization configuration and locations

-- ============================================
-- ORGANIZATION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS organization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_name VARCHAR(200) NOT NULL,
  fiscal_year_ending DATE NOT NULL,

  -- Contact/Address (optional)
  address_line1 VARCHAR(200),
  address_line2 VARCHAR(200),
  city VARCHAR(100),
  state VARCHAR(2),
  zip VARCHAR(10),
  phone VARCHAR(20),
  email VARCHAR(100),
  website VARCHAR(200),

  -- Tax/Legal
  ein VARCHAR(20),
  tax_exempt_number VARCHAR(50),
  incorporation_date DATE,

  -- Metadata
  initialized_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Only allow one organization record
  CONSTRAINT single_org CHECK (id = gen_random_uuid())
);

-- Ensure only one organization record can exist
CREATE UNIQUE INDEX idx_single_organization ON organization ((true));


-- ============================================
-- LOCATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  location_code VARCHAR(10) NOT NULL UNIQUE, -- SC, RWC, etc.
  location_name VARCHAR(200) NOT NULL,

  state VARCHAR(2) NOT NULL,
  county VARCHAR(100), -- Required for CA

  -- Full address (optional)
  address_line1 VARCHAR(200),
  address_line2 VARCHAR(200),
  city VARCHAR(100),
  zip VARCHAR(10),

  -- Capacity
  max_capacity INT,

  -- License info
  license_number VARCHAR(50),
  license_expiry DATE,

  -- Status
  is_active BOOLEAN DEFAULT true,
  opened_date DATE,
  closed_date DATE,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_locations_code ON locations(location_code);
CREATE INDEX idx_locations_state ON locations(state);
CREATE INDEX idx_locations_active ON locations(is_active);


-- ============================================
-- CALIFORNIA COUNTIES REFERENCE
-- ============================================
CREATE TABLE IF NOT EXISTS ca_counties (
  id SERIAL PRIMARY KEY,
  county_name VARCHAR(100) NOT NULL UNIQUE,
  county_seat VARCHAR(100),
  population INT,
  sort_order INT
);

-- Insert all 58 California counties
INSERT INTO ca_counties (county_name, sort_order) VALUES
  ('Alameda', 1),
  ('Alpine', 2),
  ('Amador', 3),
  ('Butte', 4),
  ('Calaveras', 5),
  ('Colusa', 6),
  ('Contra Costa', 7),
  ('Del Norte', 8),
  ('El Dorado', 9),
  ('Fresno', 10),
  ('Glenn', 11),
  ('Humboldt', 12),
  ('Imperial', 13),
  ('Inyo', 14),
  ('Kern', 15),
  ('Kings', 16),
  ('Lake', 17),
  ('Lassen', 18),
  ('Los Angeles', 19),
  ('Madera', 20),
  ('Marin', 21),
  ('Mariposa', 22),
  ('Mendocino', 23),
  ('Merced', 24),
  ('Modoc', 25),
  ('Mono', 26),
  ('Monterey', 27),
  ('Napa', 28),
  ('Nevada', 29),
  ('Orange', 30),
  ('Placer', 31),
  ('Plumas', 32),
  ('Riverside', 33),
  ('Sacramento', 34),
  ('San Benito', 35),
  ('San Bernardino', 36),
  ('San Diego', 37),
  ('San Francisco', 38),
  ('San Joaquin', 39),
  ('San Luis Obispo', 40),
  ('San Mateo', 41),
  ('Santa Barbara', 42),
  ('Santa Clara', 43),
  ('Santa Cruz', 44),
  ('Shasta', 45),
  ('Sierra', 46),
  ('Siskiyou', 47),
  ('Solano', 48),
  ('Sonoma', 49),
  ('Stanislaus', 50),
  ('Sutter', 51),
  ('Tehama', 52),
  ('Trinity', 53),
  ('Tulare', 54),
  ('Tuolumne', 55),
  ('Ventura', 56),
  ('Yolo', 57),
  ('Yuba', 58)
ON CONFLICT (county_name) DO NOTHING;


-- ============================================
-- TRIGGERS
-- ============================================

-- Update organization updated_at timestamp
CREATE OR REPLACE FUNCTION update_organization_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_organization_timestamp
BEFORE UPDATE ON organization
FOR EACH ROW
EXECUTE FUNCTION update_organization_timestamp();

-- Update locations updated_at timestamp
CREATE OR REPLACE FUNCTION update_locations_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_locations_timestamp
BEFORE UPDATE ON locations
FOR EACH ROW
EXECUTE FUNCTION update_locations_timestamp();
