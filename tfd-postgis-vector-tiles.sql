-- TFD / Supabase PostGIS vector tile schema (starter)
-- Canonical storage: EPSG:4326; tile generation: transform to EPSG:3857.
create extension if not exists postgis;
create schema if not exists cadastre;

create table if not exists cadastre.admin_units (
  admin_id text primary key, name text not null, level text not null check (level in ('region','prefecture','commune','canton','quartier')),
  code text, parent_id text, official_source text, geom geometry(MultiPolygon,4326) not null
);
create index if not exists admin_units_geom_gix on cadastre.admin_units using gist (geom);

create table if not exists cadastre.tfd_localities (
  locality_id text primary key, name text not null, locality_type text, parent_id text, hierarchy_path text,
  geom geometry(MultiPolygon,4326) not null
);
create index if not exists tfd_localities_geom_gix on cadastre.tfd_localities using gist (geom);

create table if not exists cadastre.tfd_grid (
  cell_id text primary key, cell_code text unique not null, hierarchy_code text, locality_id text,
  locality_name text, geom geometry(Polygon,4326) not null
);
create index if not exists tfd_grid_geom_gix on cadastre.tfd_grid using gist (geom);

create table if not exists cadastre.tfd_streets (
  street_id text primary key, name text, class text, surface text, row_m numeric, locality_id text,
  geom geometry(MultiLineString,4326) not null
);
create index if not exists tfd_streets_geom_gix on cadastre.tfd_streets using gist (geom);

create table if not exists cadastre.parcels (
  parcel_id text primary key, parcel_no text, land_use text, area_m2 numeric, valuation numeric,
  valuation_currency text default 'XOF', title_status text, section_code text,
  geom geometry(MultiPolygon,4326) not null
);
create index if not exists parcels_geom_gix on cadastre.parcels using gist (geom);
create index if not exists parcels_parcel_no_idx on cadastre.parcels (parcel_no);

create table if not exists cadastre.parcel_boundaries (
  boundary_id text primary key, parcel_id text references cadastre.parcels(parcel_id), accuracy_class text,
  survey_date date, marker_type text, source_ref text, geom geometry(Geometry,4326) not null
);
create index if not exists parcel_boundaries_geom_gix on cadastre.parcel_boundaries using gist (geom);

create table if not exists cadastre.buildings (
  building_id text primary key, parcel_id text references cadastre.parcels(parcel_id), building_use text,
  floors int, height_m numeric, min_height_m numeric default 0, roof_type text, geom geometry(MultiPolygon,4326) not null
);
create index if not exists buildings_geom_gix on cadastre.buildings using gist (geom);

create table if not exists cadastre.addresses (
  address_id text primary key, house_no text, street_name text, formatted_address text, parcel_id text,
  geocode_quality text, geom geometry(Point,4326) not null
);
create index if not exists addresses_geom_gix on cadastre.addresses using gist (geom);

-- Keep personally identifying holder fields in a secured table/view; publish only authorized/minimal fields to tiles.
create table if not exists cadastre.rights_holders (
  right_id text primary key, parcel_id text references cadastre.parcels(parcel_id), ownership_type text,
  tenure text, share_pct numeric, public_display_name text, holder_name text, national_id text, phone text, email text,
  geom geometry(Point,4326)
);
create index if not exists rights_holders_geom_gix on cadastre.rights_holders using gist (geom);

create table if not exists cadastre.cadastral_sections (
  section_id text primary key, section_code text, sheet_ref text, sheet_year int, legacy_scale text,
  geom geometry(MultiPolygon,4326) not null
);
create index if not exists cadastral_sections_geom_gix on cadastre.cadastral_sections using gist (geom);

create table if not exists cadastre.land_titles (
  title_id text primary key, parcel_id text references cadastre.parcels(parcel_id), title_no text, status text,
  issuance_date date, certificate_type text, geom geometry(Point,4326)
);
create index if not exists land_titles_geom_gix on cadastre.land_titles using gist (geom);

create table if not exists cadastre.encumbrances (
  encumbrance_id text primary key, parcel_id text references cadastre.parcels(parcel_id), type text, status text,
  registered_date date, reference_no text, mortgagee_name text, dispute_parties text,
  geom geometry(Geometry,4326) not null
);
create index if not exists encumbrances_geom_gix on cadastre.encumbrances using gist (geom);

-- Multi-layer MVT. Restrict sensitive attributes in production through RLS/security-definer API or a sanitized tile view.
create or replace function public.tfd_tile(z integer, x integer, y integer)
returns bytea
language sql
stable
as $$
with b as (
  select ST_TileEnvelope(z,x,y) as env3857,
         ST_Transform(ST_TileEnvelope(z,x,y, margin => 128.0/4096),4326) as env4326
),
admin_q as (
  select admin_id,name,level,code,parent_id,official_source,
         ST_AsMVTGeom(ST_Transform(a.geom,3857), b.env3857,4096,128,true) geom
  from cadastre.admin_units a,b where a.geom && b.env4326
),
locality_q as (
  select locality_id,name,locality_type,parent_id,hierarchy_path,
         ST_AsMVTGeom(ST_Transform(a.geom,3857), b.env3857,4096,128,true) geom
  from cadastre.tfd_localities a,b where a.geom && b.env4326
),
grid_q as (
  select cell_id,cell_code,hierarchy_code,locality_id,locality_name,
         ST_AsMVTGeom(ST_Transform(a.geom,3857), b.env3857,4096,128,true) geom
  from cadastre.tfd_grid a,b where z >= 13 and a.geom && b.env4326
),
street_q as (
  select street_id,name,class,surface,row_m,locality_id,
         ST_AsMVTGeom(ST_Transform(a.geom,3857), b.env3857,4096,128,true) geom
  from cadastre.tfd_streets a,b where z >= 9 and a.geom && b.env4326
),
parcel_q as (
  select parcel_id,parcel_no,land_use,area_m2,valuation,valuation_currency,title_status,section_code,
         ST_AsMVTGeom(ST_Transform(a.geom,3857), b.env3857,4096,128,true) geom
  from cadastre.parcels a,b where z >= 12 and a.geom && b.env4326
),
boundary_q as (
  select boundary_id,parcel_id,accuracy_class,survey_date,marker_type,source_ref,
         ST_AsMVTGeom(ST_Transform(a.geom,3857), b.env3857,4096,128,true) geom
  from cadastre.parcel_boundaries a,b where z >= 14 and a.geom && b.env4326
),
building_q as (
  select building_id,parcel_id,building_use,floors,height_m,min_height_m,roof_type,
         ST_AsMVTGeom(ST_Transform(a.geom,3857), b.env3857,4096,128,true) geom
  from cadastre.buildings a,b where z >= 14 and a.geom && b.env4326
),
address_q as (
  select address_id,house_no,street_name,formatted_address,parcel_id,geocode_quality,
         ST_AsMVTGeom(ST_Transform(a.geom,3857), b.env3857,4096,128,true) geom
  from cadastre.addresses a,b where z >= 16 and a.geom && b.env4326
),
rights_q as (
  select right_id,parcel_id,ownership_type,tenure,share_pct,public_display_name,
         ST_AsMVTGeom(ST_Transform(a.geom,3857), b.env3857,4096,128,true) geom
  from cadastre.rights_holders a,b where z >= 15 and a.geom is not null and a.geom && b.env4326
),
section_q as (
  select section_id,section_code,sheet_ref,sheet_year,legacy_scale,
         ST_AsMVTGeom(ST_Transform(a.geom,3857), b.env3857,4096,128,true) geom
  from cadastre.cadastral_sections a,b where z >= 10 and a.geom && b.env4326
),
title_q as (
  select title_id,parcel_id,title_no,status,issuance_date,certificate_type,
         ST_AsMVTGeom(ST_Transform(a.geom,3857), b.env3857,4096,128,true) geom
  from cadastre.land_titles a,b where z >= 14 and a.geom is not null and a.geom && b.env4326
),
enc_q as (
  select encumbrance_id,parcel_id,type,status,registered_date,reference_no,
         ST_AsMVTGeom(ST_Transform(a.geom,3857), b.env3857,4096,128,true) geom
  from cadastre.encumbrances a,b where z >= 13 and a.geom && b.env4326
)
select
  coalesce(ST_AsMVT(admin_q,'admin_units',4096,'geom','admin_id'),'\x'::bytea) ||
  coalesce(ST_AsMVT(locality_q,'tfd_localities',4096,'geom','locality_id'),'\x'::bytea) ||
  coalesce(ST_AsMVT(grid_q,'tfd_grid',4096,'geom','cell_id'),'\x'::bytea) ||
  coalesce(ST_AsMVT(street_q,'tfd_streets',4096,'geom','street_id'),'\x'::bytea) ||
  coalesce(ST_AsMVT(parcel_q,'parcels',4096,'geom','parcel_id'),'\x'::bytea) ||
  coalesce(ST_AsMVT(boundary_q,'parcel_boundaries',4096,'geom','boundary_id'),'\x'::bytea) ||
  coalesce(ST_AsMVT(building_q,'buildings',4096,'geom','building_id'),'\x'::bytea) ||
  coalesce(ST_AsMVT(address_q,'addresses',4096,'geom','address_id'),'\x'::bytea) ||
  coalesce(ST_AsMVT(rights_q,'rights_holders',4096,'geom','right_id'),'\x'::bytea) ||
  coalesce(ST_AsMVT(section_q,'cadastral_sections',4096,'geom','section_id'),'\x'::bytea) ||
  coalesce(ST_AsMVT(title_q,'land_titles',4096,'geom','title_id'),'\x'::bytea) ||
  coalesce(ST_AsMVT(enc_q,'encumbrances',4096,'geom','encumbrance_id'),'\x'::bytea);
$$;
