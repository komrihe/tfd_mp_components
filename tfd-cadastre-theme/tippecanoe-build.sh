#!/usr/bin/env bash
# =============================================================================
# TFD Cadastre – Tippecanoe build script
# Produces a single MBTiles or directory of PMTiles / PBF tiles
# =============================================================================

set -euo pipefail

# ---------- Configuration ----------
OUTPUT_DIR="./tiles"
MBTILES="tfd-cadastre.mbtiles"
PMTILES="tfd-cadastre.pmtiles"
MIN_ZOOM=6
MAX_ZOOM=18
LAYER_PREFIX=""          # optional prefix for layer names

# GeoJSON exports (or use ogr2ogr / pg_dump views)
GEOJSON_DIR="./geojson"

mkdir -p "$OUTPUT_DIR" "$GEOJSON_DIR"

echo ">>> Exporting PostGIS views to GeoJSON (example using ogr2ogr)..."
# Uncomment and adjust connection string:
# ogr2ogr -f GeoJSON "$GEOJSON_DIR/admin_units.geojson" \
#   "PG:host=localhost dbname=tfd user=postgres" tiles_admin_units
# ... repeat for every tiles_* view

echo ">>> Building Tippecanoe MBTiles..."

tippecanoe \
  -o "$OUTPUT_DIR/$MBTILES" \
  --force \
  --minimum-zoom=$MIN_ZOOM \
  --maximum-zoom=$MAX_ZOOM \
  --drop-densest-as-needed \
  --extend-zooms-if-still-dropping \
  --coalesce-densest-as-needed \
  --hilbert \
  --detect-shared-borders \
  --no-tile-compression \
  \
  -L admin_units:"$GEOJSON_DIR/admin_units.geojson" \
  -L tfd_cadastre:"$GEOJSON_DIR/tfd_cadastre.geojson" \
  -L cadastral_sheets:"$GEOJSON_DIR/cadastral_sheets.geojson" \
  -L streets:"$GEOJSON_DIR/streets.geojson" \
  -L parcels:"$GEOJSON_DIR/parcels.geojson" \
  -L parcel_boundaries:"$GEOJSON_DIR/parcel_boundaries.geojson" \
  -L buildings:"$GEOJSON_DIR/buildings.geojson" \
  -L addresses:"$GEOJSON_DIR/addresses.geojson" \
  -L owners:"$GEOJSON_DIR/owners.geojson" \
  -L land_titles:"$GEOJSON_DIR/land_titles.geojson" \
  -L encumbrances:"$GEOJSON_DIR/encumbrances.geojson"

echo ">>> Optional: convert to PMTiles"
# tippecanoe-decode or pmtiles convert
# pmtiles convert "$OUTPUT_DIR/$MBTILES" "$OUTPUT_DIR/$PMTILES"

echo ">>> Done. Tiles ready at $OUTPUT_DIR/$MBTILES"
echo "Serve with: tileserver-gl, martin, pg_tileserv, or any PMTiles-compatible host."
