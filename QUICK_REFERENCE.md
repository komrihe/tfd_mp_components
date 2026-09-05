# TFD MapLibre Quick Reference Card

**Location:** `/Users/richardhemedzo/development/KMW/tfd_mp_components/`

## 🎯 What You Have

Two **production-ready Map Libre basemap theme packages** for Togo cadastral visualization:

| Package | Light | Dark | Zoom | Use Case |
|---------|-------|------|------|----------|
| **tfd-maplibre-theme** | ✅ | ✅ | 1-22 | General cadastre mapping |
| **tfd-cadastre-theme** | ✅ | ✅ | 10-22 | Property/parcel focused |

Both optimized for **vector map tiles (MVT)** — efficient, scalable, cacheable.

---

## 🚀 5-Minute Setup

### Copy to Your Project

```bash
# Copy theme files to your map component folder
cp ../tfd-maplibre-style-light.json src/themes/
cp ../tfd-maplibre-style-dark.json src/themes/
cp ../tfd-layer-manifest.json src/themes/
```

### Use in React

```javascript
import maplibregl from 'maplibre-gl'
import lightStyle from './themes/tfd-maplibre-style-light.json'

// Togo center: 1.2°E, 7.4°N
const map = new maplibregl.Map({
  container: 'map',
  style: lightStyle,
  center: [1.2, 7.4],
  zoom: 6
})
```

### Replace Tile Host

In both style JSON files, replace `YOUR_TILE_HOST`:

```javascript
lightStyle.sources.cadastre.tiles = [
  'https://your-tile-server.com/cadastre/{z}/{x}/{y}.mvt'
]

// Then use:
const map = new maplibregl.Map({ container: 'map', style: lightStyle })
```

---

## 📍 Togo Geography

- **Center:** 1.2°E, 7.4°N
- **Country Code:** TG
- **Zoom for Regions:** z6-8
- **Zoom for Districts:** z9-12
- **Zoom for Parcels:** z13+

---

## 🎨 Theme Switching

```javascript
const themes = {
  'maplibre-light': lightStyle,
  'maplibre-dark': darkStyle,
  'cadastre-light': cadastreLightStyle,
  'cadastre-dark': cadastreDarkStyle
}

function switchTheme(themeId) {
  const newStyle = JSON.parse(JSON.stringify(themes[themeId]))
  map.setStyle(newStyle)
}
```

---

## 🗺️ Vector Tiles Explained

```
User zooms in/out
         ↓
MapLibre requests: https://tiles.example.com/cadastre/{z}/{x}/{y}.mvt
         ↓
Server returns: Compressed geometries + properties for that tile
         ↓
MapLibre applies style rules (colors, line-width, etc.)
         ↓
Result: Fast rendering of millions of features
```

**Why MVT?**
- ✅ Only downloads visible area
- ✅ Much smaller than GeoJSON
- ✅ Cacheable at CDN
- ✅ Scales to billions of features

---

## 🏗️ Database Schema

To generate tiles, you need **PostGIS**:

```sql
-- From tfd-postgis-vector-tiles.sql
CREATE TABLE cadastre_parcels (
  id UUID PRIMARY KEY,
  geometry GEOMETRY(POLYGON, 4326),
  parcel_number VARCHAR,
  owner_name VARCHAR,
  area_sqm NUMERIC
);

-- Vector tile function
CREATE OR REPLACE FUNCTION get_cadastre_tiles(z INT, x INT, y INT)
  RETURNS BYTEA AS $$ ... $$;
```

Then generate MVT files using **Tippecanoe**:

```bash
# Export data to newline-delimited GeoJSON
psql -d cadastre_db -c "SELECT row_to_json(...) FROM cadastre_parcels" | \
  tippecanoe -o cadastre.mbtiles -n "Cadastre" -Z 10 -z 22
```

---

## 🌐 Data Source: Togo

Located at: `/Users/richardhemedzo/development/KMW/TFD/tefedila_project/core-js/data/`

**Available datasets:**
- 🏢 Buildings (footprints, addresses)
- 🛣️ Roads (primary, secondary, tertiary)
- 🏛️ Admin boundaries (regions, districts, communes)
- 🏥 Health directory
- 💼 Business directory
- 📍 Points of interest
- 🌳 Land use / zoning

**Format:** GeoJSON, SQLite, shapefiles

---

## 💾 Quick Integration Patterns

### React Hook

```javascript
// useMapLibre.js
import { useRef, useEffect } from 'react'
import maplibregl from 'maplibre-gl'

export function useMapLibre(style, options = {}) {
  const mapRef = useRef(null)

  useEffect(() => {
    mapRef.current = new maplibregl.Map({
      container: 'map',
      style,
      center: [1.2, 7.4],
      zoom: 6,
      ...options
    })
    return () => mapRef.current?.remove()
  }, [])

  return mapRef
}
```

**Usage:**
```javascript
const mapRef = useMapLibre(lightStyle)

map.on('load', () => {
  mapRef.current.addLayer({ ... })
})
```

### Vue Composable

```javascript
// useMapLibre.js
import { ref, onMounted } from 'vue'
import maplibregl from 'maplibre-gl'

export function useMapLibre(style) {
  const map = ref(null)

  onMounted(() => {
    map.value = new maplibregl.Map({
      container: 'map',
      style,
      center: [1.2, 7.4],
      zoom: 6
    })
  })

  return map
}
```

---

## 🎯 Common Tasks

### Toggle Layer Visibility

```javascript
map.setLayoutProperty(
  'cadastral_parcels',
  'visibility',
  visibility === 'none' ? 'visible' : 'none'
)
```

### Query Features by Click

```javascript
map.on('click', (e) => {
  const features = map.queryRenderedFeatures({ point: e.point })
  console.log(features[0].properties)  // Feature data
})
```

### Add GeoJSON on Top

```javascript
map.addSource('my-parcels', {
  type: 'geojson',
  data: { type: 'FeatureCollection', features: [...] }
})

map.addLayer({
  id: 'my-parcels-fill',
  type: 'fill',
  source: 'my-parcels',
  paint: { 'fill-color': '#088', 'fill-opacity': 0.6 }
})
```

### Change Colors by Zoom

```javascript
{
  'id': 'parcels',
  'type': 'fill',
  'paint': {
    'fill-color': [
      'interpolate',
      ['linear'],
      ['zoom'],
      10, '#fbb4ae',  // z10
      16, '#e34a33'   // z16+
    ]
  }
}
```

---

## 📦 File Locations

**Theme packages (extracted):**
```
/Users/richardhemedzo/development/KMW/tfd_mp_components/
├── tfd-maplibre-style-light.json
├── tfd-maplibre-style-dark.json
├── tfd-layer-manifest.json
├── tfd-map-interactions.js
├── tfd-postgis-vector-tiles.sql
└── tfd-cadastre-theme/
    ├── tfd-cadastre-light.style.json
    ├── tfd-cadastre-dark.style.json
    ├── postgis-tippecanoe-schema.sql
    └── tippecanoe-build.sh
```

**Togo data:**
```
/Users/richardhemedzo/development/KMW/TFD/tefedila_project/core-js/data/
├── buildings/
├── roads/
├── business-directory/
├── health-directory/
└── ... (more domains)
```

---

## ✅ Hosting Options

| Option | Complexity | Cost | Control | Offline |
|--------|-----------|------|---------|---------|
| **Local mbtiles** | Low | Free | Full | ✅ Yes |
| **Self-hosted tileserver-gl** | Medium | Hosting cost | Full | ✅ Yes |
| **Supabase PostGIS + pg_tileserve** | Medium | $25/mo | Medium | ⚠️ Hybrid |
| **Mapbox Cloud** | Low | $500+/mo | Limited | ✅ SDK |
| **AWS Lambda + S3** | High | Pay-per-use | Full | ⚠️ Hybrid |

---

## 🚀 Start Building

**Option A: Use the explorer app** (to understand the themes)
```bash
cd /Users/richardhemedzo/development/KMW/tfd_mp_components/map-explorer
npm install && npm run dev
# Open http://localhost:5173
```

**Option B: Copy themes to your project** (to integrate immediately)
```bash
cp tfd-maplibre-style-*.json YOUR_PROJECT/src/themes/
cp tfd-layer-manifest.json YOUR_PROJECT/src/themes/
# Then follow "5-Minute Setup" above
```

---

## 📚 Full Documentation

- **BASEMAPS_GUIDE.md** — Deep dive into architecture, database, tile serving
- **INTEGRATION_GUIDE.md** — Code examples for React, Vue, Svelte, offline
- **Explorer README.md** — How to run the interactive app

---

## 🔗 Key Links

- 📖 [MapLibre GL Docs](https://maplibre.org/maplibre-gl-js/)
- 🗺️ [Vector Tile Spec](https://github.com/mapbox/vector-tile-spec)
- 🛠️ [Tippecanoe](https://github.com/mapbox/tippecanoe)
- 🗄️ [PostGIS](https://postgis.net/documentation/)

---

**Ready to build? Copy the styles and follow the 5-Minute Setup!** ✨
