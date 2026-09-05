# TFD MapLibre Basemaps Explorer

## Overview

This Vite + React app explores **two custom Map Libre basemaps** for Togo cadastral data:

1. **tfd-maplibre-theme-package** — General-purpose cadastre styling (light/dark)
2. **tfd-cadastre-theme** — Specialized cadastre theme with enhanced layer manifest

## Files Extracted

### Main Theme Package
- `tfd-maplibre-style-light.json` — Light theme with full layer definitions
- `tfd-maplibre-style-dark.json` — Dark theme variant
- `tfd-layer-manifest.json` — Layer catalog with zoom levels, z-order, privacy profiles
- `tfd-map-interactions.js` — Parcel inspector hooks and layer toggles
- `tfd-postgis-vector-tiles.sql` — PostGIS schema for MVT generation

### Cadastre Theme
- `tfd-cadastre-light.style.json` & `tfd-cadastre-dark.style.json` — Cadastre-specific styles
- `layer-manifest.json` — Detailed layer definitions
- `postgis-tippecanoe-schema.sql` — Database schema
- `tippecanoe-build.sh` — Tile generation script
- `offline-caching-strategy.md` — Offline MVT caching guide

## Features

✅ **Theme Toggling** — Switch between light/dark styles  
✅ **Layer Inspector** — Click features to view properties  
✅ **Layer Visibility** — Toggle layers on/off  
✅ **Togo-Centered Map** — Centered on Togo (1.2°E, 7.4°N)  
✅ **Responsive Design** — Mobile-friendly sidebar  

## Architecture

### Map Tiles Explained

The map uses **Vector Map Tiles (MVT)** — Togo is divided into a pyramid of squares:

```
Low Zoom (z5)         Medium Zoom (z10)      High Zoom (z16)
┌─────────────┐       ┌──┬──┐              many small tiles
│    TOGO     │       │  │  │
│  few tiles  │       └──┴──┘
└─────────────┘
```

Each tile is identified as: `zoom / x / y`, e.g., `16/32989/31642`

MapLibre requests: `https://tiles.tefedila.com/cadastre/16/32989/31642.mvt`

**Benefits:**
- Only downloads visible area (not entire database)
- Fast rendering of millions of features
- Efficient caching and bandwidth

### Database Setup

To generate tiles locally, use **PostGIS + Tippecanoe**:

```sql
-- PostGIS schema (from postgis-tippecanoe-schema.sql)
CREATE TABLE cadastre_parcels (
  id UUID PRIMARY KEY,
  geometry GEOMETRY(POLYGON, 4326),
  parcel_number VARCHAR,
  owner_name VARCHAR,
  area_sqm NUMERIC
);

-- Create index for spatial queries
CREATE INDEX idx_parcels_geom ON cadastre_parcels USING GIST(geometry);
```

Generate tiles:

```bash
# Export to newline-delimited GeoJSON
psql -d cadastre_db -c "
  SELECT jsonb_build_object(
    'type', 'Feature',
    'geometry', ST_AsGeoJSON(geometry)::jsonb,
    'properties', jsonb_build_object(
      'id', id,
      'parcel_number', parcel_number,
      'owner', owner_name,
      'area_sqm', area_sqm
    )
  ) FROM cadastre_parcels;
" | tippecanoe -o cadastre.mbtiles -n "Cadastre Parcels" -Z 10 -z 22

# Serve from local mbtiles or S3
```

## Data Source: Togo Hierarchy

Located at: `/Users/richardhemedzo/development/KMW/TFD/tefedila_project/core-js/data/`

### Canonical Data Structure

```
data/
├── raw/                    # Immutable raw provider data
├── canonical/              # Reviewed, normalized source-of-truth
│   ├── buildings/
│   ├── business-directory/
│   ├── health-directory/
│   ├── points-of-interest/
│   ├── roads/
│   └── ...
├── generated/              # SQLite, tiles, search indexes
├── manifests/              # Dataset identity, versions, lineage
└── tfd-hierarchy-data-togo-gis/  # Legacy compatibility (deprecated)
```

### Domain Ownership

- **Infrastructure** — roads, drainage assets
- **Cadastre Rights** — parcel ownership, encumbrances
- **Addressing** — official/proposed street names
- **Risk** — exposure models, hazards
- **Health** — health facility enrichment
- **Business** — business organization data
- **Public Facilities** — public service assets
- **Urbanism** — regulatory servitudes

### Privacy & Export

Sensitive data excluded from public MVT:
- Mortgagee information
- Dispute party details
- Internal notes & permits
- Private ownership records

## Layers & Zoom Levels

### All Zoom Levels (1-22)

| Zoom | Name | Detail |
|------|------|--------|
| 1-5 | World overview | Country/region boundaries |
| 5-10 | Regional | Administrative divisions, major roads |
| 10-16 | Local | Neighborhoods, POI, building footprints |
| 16-22 | Detail | Parcel boundaries, addresses, property details |

### Key Layers

- `cadastral_parcels` — Land parcels (z10+)
- `buildings` — Building footprints (z13+)
- `addresses` — Address points (z14+)
- `roads_primary` — Primary roads (all)
- `roads_secondary` — Secondary roads (z8+)
- `water` — Water features (all)
- `admin_boundaries` — Administrative boundaries (z5+)
- `poi` — Points of interest (z12+)

## Layer Manifest Format

From `tfd-layer-manifest.json`:

```json
{
  "layers": [
    {
      "id": "cadastral_parcels",
      "name": "Land Parcels",
      "source": "cadastre_mvt",
      "source-layer": "parcels",
      "zoom": {
        "minzoom": 10,
        "maxzoom": 22
      },
      "privacy": "public",
      "export": {
        "pdf": true,
        "geojson": true,
        "shapefile": true
      },
      "z-order": 50,
      "paint": {
        "fill-color": "#fee5d9",
        "fill-opacity": 0.7,
        "line-color": "#e34a33",
        "line-width": 1.5
      }
    }
  ]
}
```

## Hosting & Deployment

### Option 1: Local Development

```bash
# Use mbtiles locally
npm run dev
# MapLibre accesses tiles from local mbtiles via protocol handler
```

### Option 2: Cloud Hosting (Recommended)

**Supabase (PostgreSQL + PostGIS)**
- Store tables with GEOMETRY columns
- Use `pg_tileserve` for MVT endpoint
- Endpoint: `https://<project>.supabase.co/rest/v1/rpc/tiles`

**Cloudflare Workers + R2**
- Store mbtiles in R2 (S3-compatible)
- Worker routes requests to tiles
- Endpoint: `https://tiles.tefedila.com/cadastre/{z}/{x}/{y}.mvt`

**Mapbox Tiling Service (Commercial)**
- Upload tilesets to Mapbox
- Use their hosting infrastructure
- Endpoint: `https://api.mapbox.com/data/v1/...`

### Option 3: Self-Hosted (Recommended for Control)

**Stack:**
- PostgreSQL 14+ with PostGIS 3.3+
- `tileserver-gl` for MVT serving
- Docker for containerization

```dockerfile
FROM osm2pgsql/osm2pgsql:latest

RUN apt-get update && apt-get install -y \
  postgresql-client \
  gdal-bin

# Import data
COPY ./data /data
RUN psql -h postgres -U postgres -d cadastre -f /data/schema.sql

# Start tile server
CMD ["tileserver-gl", "-c", "/config/config.json"]
```

## Usage Examples

### Using the Explorer App

```javascript
// App.jsx demonstrates:
1. Loading MapLibre with custom style
2. Theme switching (light/dark)
3. Layer toggling
4. Feature inspection (click to inspect)
5. Zoom level awareness
```

### Creating a Custom Style

```json
{
  "version": 8,
  "name": "Custom Cadastre",
  "sources": {
    "cadastre": {
      "type": "vector",
      "tiles": ["https://tiles.tefedila.com/cadastre/{z}/{x}/{y}.mvt"],
      "minzoom": 0,
      "maxzoom": 22
    }
  },
  "layers": [
    {
      "id": "parcels",
      "type": "fill",
      "source": "cadastre",
      "source-layer": "parcels",
      "paint": {
        "fill-color": "#fbb4ae",
        "fill-opacity": 0.7
      }
    }
  ]
}
```

### Querying Features

```javascript
// Click to inspect
map.on('click', (e) => {
  const features = map.queryRenderedFeatures({ point: e.point })
  console.log(features[0]) // Feature properties
})

// Hover for pointer
map.on('mousemove', (e) => {
  const features = map.queryRenderedFeatures({ point: e.point })
  map.getCanvas().style.cursor = features.length ? 'pointer' : ''
})
```

## Performance Tips

### Caching Strategy

**Browser Cache**
- MVT tiles cached 30 days
- Style definitions cached 7 days

**Offline Support**
- Download visible area when online
- Use IndexedDB for offline access
- Re-sync when connectivity restored

**Server-Side Caching**
- Cache frequent tile requests in Redis
- CDN layer (Cloudflare, CloudFront)
- Precompute popular zoom levels

### Optimization

- Simplify geometry at low zooms
- Use feature clustering for density visualization
- Lazy-load layers by zoom level
- Minify style JSONs

## Next Steps

1. **Connect Real Data**
   - Point styles to live tile server: `YOUR_TILE_HOST`
   - Import Togo hierarchy data from `/data`

2. **Add Interactions**
   - Parcel selection (toggle visible/highlight)
   - Property inspector (detailed view)
   - Search by parcel number or owner

3. **Offline Support**
   - Cache tiles to localStorage
   - Add sync manager

4. **Export Features**
   - GeoJSON export
   - PDF map printing
   - Shapefile download

## Resources

- [MapLibre GL Documentation](https://maplibre.org/maplibre-gl-js/)
- [Vector Tile Specification](https://github.com/mapbox/vector-tile-spec)
- [Tippecanoe Documentation](https://github.com/mapbox/tippecanoe)
- [PostGIS Manual](https://postgis.net/documentation/)
- [Togo Cadastre Data](../../../TFD/tefedila_project/core-js/data/)
