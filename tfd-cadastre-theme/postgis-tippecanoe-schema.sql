-- =============================================================================
-- TFD Cadastre – Complete PostGIS Schema + Tippecanoe-ready views
-- Compatible with: PostGIS 3.x, pg_tileserv, Martin, Tippecanoe, Supabase
-- =============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. ADMINISTRATIVE UNITS (Region → Prefecture → Commune → Canton → Quartier)
-- =============================================================================
CREATE TABLE admin_units (
    id              BIGSERIAL PRIMARY KEY,
    geom            GEOMETRY(MultiPolygon, 4326) NOT NULL,
    level           TEXT NOT NULL CHECK (level IN ('region','prefecture','commune','canton','quartier')),
    name            TEXT NOT NULL,
    code            TEXT,
    parent_id       BIGINT REFERENCES admin_units(id),
    population      INTEGER,
    area_km2        NUMERIC(12,4),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX admin_units_geom_idx ON admin_units USING GIST (geom);
CREATE INDEX admin_units_level_idx ON admin_units (level);
CREATE INDEX admin_units_parent_idx ON admin_units (parent_id);

-- =============================================================================
-- 2. TFD CADASTRE GRID (cells, locality polygons, hierarchy)
-- =============================================================================
CREATE TABLE tfd_cadastre (
    id              BIGSERIAL PRIMARY KEY,
    geom            GEOMETRY(Polygon, 4326) NOT NULL,
    cell_code       TEXT NOT NULL UNIQUE,
    hierarchy       TEXT,                     -- e.g. "R01-P03-C12-Q05"
    locality_id     TEXT,
    locality_name   TEXT,
    sheet_ref       TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX tfd_cadastre_geom_idx ON tfd_cadastre USING GIST (geom);
CREATE INDEX tfd_cadastre_cell_code_idx ON tfd_cadastre (cell_code);

-- =============================================================================
-- 3. CADASTRAL SHEETS / SECTIONS (legacy references)
-- =============================================================================
CREATE TABLE cadastral_sheets (
    id              BIGSERIAL PRIMARY KEY,
    geom            GEOMETRY(Polygon, 4326) NOT NULL,
    sheet_ref       TEXT NOT NULL,
    section_code    TEXT,
    year            INTEGER,
    scale           TEXT,
    source          TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX cadastral_sheets_geom_idx ON cadastral_sheets USING GIST (geom);

-- =============================================================================
-- 4. STREETS (centerlines, classification, right-of-way)
-- =============================================================================
CREATE TABLE streets (
    id              BIGSERIAL PRIMARY KEY,
    geom            GEOMETRY(LineString, 4326) NOT NULL,
    name            TEXT,
    name_alt        TEXT,
    class           TEXT CHECK (class IN ('motorway','primary','secondary','tertiary','residential','service','path','track')),
    right_of_way    NUMERIC(6,2),             -- meters
    surface         TEXT,
    oneway          BOOLEAN DEFAULT false,
    maxspeed        INTEGER,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX streets_geom_idx ON streets USING GIST (geom);
CREATE INDEX streets_class_idx ON streets (class);

-- =============================================================================
-- 5. PARCELS (core ownership polygons)
-- =============================================================================
CREATE TABLE parcels (
    id              BIGSERIAL PRIMARY KEY,
    geom            GEOMETRY(Polygon, 4326) NOT NULL,
    parcel_id       TEXT NOT NULL UNIQUE,
    owner_id        BIGINT,                   -- FK to owners
    area_m2         NUMERIC(14,2),
    land_use        TEXT,
    valuation       NUMERIC(14,2),
    status          TEXT DEFAULT 'active',    -- active | disputed | pending | cancelled
    cadastre_cell   TEXT REFERENCES tfd_cadastre(cell_code),
    admin_unit_id   BIGINT REFERENCES admin_units(id),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX parcels_geom_idx ON parcels USING GIST (geom);
CREATE INDEX parcels_parcel_id_idx ON parcels (parcel_id);
CREATE INDEX parcels_owner_idx ON parcels (owner_id);
CREATE INDEX parcels_status_idx ON parcels (status);

-- =============================================================================
-- 6. PARCEL BOUNDARIES (surveyed lines + accuracy)
-- =============================================================================
CREATE TABLE parcel_boundaries (
    id              BIGSERIAL PRIMARY KEY,
    geom            GEOMETRY(LineString, 4326) NOT NULL,
    parcel_id       TEXT REFERENCES parcels(parcel_id),
    accuracy_class  TEXT CHECK (accuracy_class IN ('surveyed','approximate','inferred')),
    survey_date     DATE,
    marker_type     TEXT,                     -- monument | pin | natural | virtual
    surveyor        TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX parcel_boundaries_geom_idx ON parcel_boundaries USING GIST (geom);
CREATE INDEX parcel_boundaries_parcel_idx ON parcel_boundaries (parcel_id);

-- =============================================================================
-- 7. BUILDINGS
-- =============================================================================
CREATE TABLE buildings (
    id              BIGSERIAL PRIMARY KEY,
    geom            GEOMETRY(Polygon, 4326) NOT NULL,
    building_id     TEXT UNIQUE,
    parcel_id       TEXT REFERENCES parcels(parcel_id),
    floors          INTEGER,
    height          NUMERIC(6,2),             -- meters
    use             TEXT,                     -- residential | commercial | industrial | mixed | public
    year_built      INTEGER,
    material        TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX buildings_geom_idx ON buildings USING GIST (geom);
CREATE INDEX buildings_parcel_idx ON buildings (parcel_id);

-- =============================================================================
-- 8. ADDRESSES (geocoded points)
-- =============================================================================
CREATE TABLE addresses (
    id              BIGSERIAL PRIMARY KEY,
    geom            GEOMETRY(Point, 4326) NOT NULL,
    housenumber     TEXT,
    street          TEXT,
    unit            TEXT,
    postcode        TEXT,
    parcel_id       TEXT REFERENCES parcels(parcel_id),
    building_id     TEXT,
    priority        INTEGER DEFAULT 0,        -- for label sorting
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX addresses_geom_idx ON addresses USING GIST (geom);
CREATE INDEX addresses_parcel_idx ON addresses (parcel_id);

-- =============================================================================
-- 9. OWNERS / RIGHTS HOLDERS
-- =============================================================================
CREATE TABLE owners (
    id              BIGSERIAL PRIMARY KEY,
    geom            GEOMETRY(Point, 4326),    -- representative point (optional)
    owner_id        TEXT UNIQUE,
    name            TEXT NOT NULL,
    ownership_type  TEXT CHECK (ownership_type IN ('freehold','leasehold','communal','state','other')),
    tenure          TEXT,
    id_document     TEXT,
    contact         TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX owners_geom_idx ON owners USING GIST (geom);
CREATE INDEX owners_owner_id_idx ON owners (owner_id);

-- Link table (many-to-many if needed)
CREATE TABLE parcel_owners (
    parcel_id       TEXT REFERENCES parcels(parcel_id),
    owner_id        TEXT REFERENCES owners(owner_id),
    share           NUMERIC(5,2) DEFAULT 100.00,
    role            TEXT DEFAULT 'owner',     -- owner | usufruct | mortgagee
    PRIMARY KEY (parcel_id, owner_id, role)
);

-- =============================================================================
-- 10. LAND TITLES / CERTIFICATES
-- =============================================================================
CREATE TABLE land_titles (
    id              BIGSERIAL PRIMARY KEY,
    geom            GEOMETRY(Point, 4326),    -- optional label point
    title_number    TEXT NOT NULL UNIQUE,
    parcel_id       TEXT REFERENCES parcels(parcel_id),
    status          TEXT DEFAULT 'active',    -- active | pending | cancelled | transferred
    issued          DATE,
    expires         DATE,
    issuing_authority TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX land_titles_geom_idx ON land_titles USING GIST (geom);
CREATE INDEX land_titles_parcel_idx ON land_titles (parcel_id);

-- =============================================================================
-- 11. ENCUMBRANCES (easements, servitudes, disputes, mortgages)
-- =============================================================================
CREATE TABLE encumbrances (
    id              BIGSERIAL PRIMARY KEY,
    geom            GEOMETRY(Geometry, 4326) NOT NULL,  -- can be poly or line
    type            TEXT CHECK (type IN ('easement','servitude','dispute','mortgage','lien','restriction')),
    status          TEXT DEFAULT 'active',
    parcel_id       TEXT REFERENCES parcels(parcel_id),
    parties         TEXT,
    registered      DATE,
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX encumbrances_geom_idx ON encumbrances USING GIST (geom);
CREATE INDEX encumbrances_type_idx ON encumbrances (type);
CREATE INDEX encumbrances_parcel_idx ON encumbrances (parcel_id);

-- =============================================================================
-- TIPPECANOE / VECTOR TILE READY VIEWS
-- (simplified geometries + only attributes needed for rendering)
-- =============================================================================

CREATE OR REPLACE VIEW tiles_admin_units AS
SELECT id, geom, level, name, code, parent_id
FROM admin_units;

CREATE OR REPLACE VIEW tiles_tfd_cadastre AS
SELECT id, geom, cell_code, hierarchy, locality_name
FROM tfd_cadastre;

CREATE OR REPLACE VIEW tiles_cadastral_sheets AS
SELECT id, geom, sheet_ref, section_code, year
FROM cadastral_sheets;

CREATE OR REPLACE VIEW tiles_streets AS
SELECT id, geom, name, class, right_of_way, surface
FROM streets;

CREATE OR REPLACE VIEW tiles_parcels AS
SELECT id, geom, parcel_id, owner_id, area_m2, land_use, valuation, status
FROM parcels;

CREATE OR REPLACE VIEW tiles_parcel_boundaries AS
SELECT id, geom, parcel_id, accuracy_class, survey_date, marker_type
FROM parcel_boundaries;

CREATE OR REPLACE VIEW tiles_buildings AS
SELECT id, geom, building_id, floors, height, use, year_built
FROM buildings;

CREATE OR REPLACE VIEW tiles_addresses AS
SELECT id, geom, housenumber, street, unit, postcode, priority
FROM addresses;

CREATE OR REPLACE VIEW tiles_owners AS
SELECT id, geom, owner_id, name, ownership_type, tenure
FROM owners;

CREATE OR REPLACE VIEW tiles_land_titles AS
SELECT id, geom, title_number, status, issued, expires
FROM land_titles;

CREATE OR REPLACE VIEW tiles_encumbrances AS
SELECT id, geom, type, status, parties, registered
FROM encumbrances;

-- =============================================================================
-- HELPER: Update area automatically
-- =============================================================================
CREATE OR REPLACE FUNCTION update_parcel_area()
RETURNS TRIGGER AS $$
BEGIN
    NEW.area_m2 := ST_Area(NEW.geom::geography);
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_parcels_area
    BEFORE INSERT OR UPDATE OF geom ON parcels
    FOR EACH ROW EXECUTE FUNCTION update_parcel_area();

-- =============================================================================
-- URBANISM (POS/PDU zoning, public spaces, planning rules, servitudes, permits)
-- Matches TFD canonical domain: urbanism/{zoning,planning_rules,permits,servitudes}
-- =============================================================================
CREATE TABLE IF NOT EXISTS zoning (
    id              BIGSERIAL PRIMARY KEY,
    geom            GEOMETRY(MultiPolygon, 4326) NOT NULL,
    zone_id         TEXT NOT NULL UNIQUE,
    plan_code       TEXT,
    plan_type       TEXT CHECK (plan_type IN ('POS','PDU','other')),
    zone_class      TEXT CHECK (zone_class IN ('residential','commercial','industrial','mixed','green','equipment')),
    zone_label      TEXT,
    density_max     NUMERIC(6,3),
    height_max_m    NUMERIC(6,2),
    status          TEXT DEFAULT 'in_force',
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zoning_geom_idx ON zoning USING GIST (geom);

CREATE TABLE IF NOT EXISTS public_spaces (
    id              BIGSERIAL PRIMARY KEY,
    geom            GEOMETRY(MultiPolygon, 4326) NOT NULL,
    space_id        TEXT NOT NULL UNIQUE,
    space_type      TEXT CHECK (space_type IN ('green','plaza','equipment')),
    name            TEXT,
    equipment_class TEXT,
    status          TEXT,
    plan_code       TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS public_spaces_geom_idx ON public_spaces USING GIST (geom);

CREATE TABLE IF NOT EXISTS planning_rules (
    id              BIGSERIAL PRIMARY KEY,
    geom            GEOMETRY(LineString, 4326) NOT NULL,
    rule_id         TEXT NOT NULL UNIQUE,
    rule_type       TEXT CHECK (rule_type IN ('alignment','setback','row')),
    setback_m       NUMERIC(6,2),
    alignment_ref   TEXT,
    plan_code       TEXT,
    status          TEXT DEFAULT 'in_force',
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS planning_rules_geom_idx ON planning_rules USING GIST (geom);

CREATE TABLE IF NOT EXISTS servitudes (
    id              BIGSERIAL PRIMARY KEY,
    geom            GEOMETRY(Geometry, 4326) NOT NULL,
    servitude_id    TEXT NOT NULL UNIQUE,
    servitude_type  TEXT,
    authority       TEXT,
    plan_code       TEXT,
    status          TEXT,
    reference_no    TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS servitudes_geom_idx ON servitudes USING GIST (geom);

CREATE TABLE IF NOT EXISTS permits (
    id              BIGSERIAL PRIMARY KEY,
    geom            GEOMETRY(Polygon, 4326) NOT NULL,
    permit_id       TEXT NOT NULL UNIQUE,
    permit_no       TEXT,
    permit_type     TEXT,
    status          TEXT CHECK (status IN ('approved','pending','refused','expired')),
    issued_date     DATE,
    footprint_m2    NUMERIC(12,2),
    parcel_id       BIGINT,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS permits_geom_idx ON permits USING GIST (geom);

-- =============================================================================
-- GRANTS (example for tileserv / authenticated role)
-- =============================================================================
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO tileserv_role;
-- GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO tileserv_role;
