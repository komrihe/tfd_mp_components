# Integrating TFD MapLibre Basemaps into Your Projects

## Quick Start

### 1. Import the Theme Package

```javascript
import maplibregl from 'maplibre-gl'

// Light theme
const style = require('../tfd-maplibre-style-light.json')

// Or dark theme
// const style = require('../tfd-maplibre-style-dark.json')

const map = new maplibregl.Map({
  container: 'map',
  style: style,
  center: [1.2, 7.4],  // Togo center
  zoom: 6
})
```

### 2. Replace Tile Host

Both style files contain `YOUR_TILE_HOST` placeholder. Replace with your actual tile server:

```javascript
const style = require('../tfd-maplibre-style-light.json')

// Replace placeholder
Object.values(style.sources).forEach(source => {
  if (source.tiles) {
    source.tiles = source.tiles.map(tile =>
      tile.replace('YOUR_TILE_HOST', 'https://tiles.tefedila.com')
    )
  }
})

const map = new maplibregl.Map({ container: 'map', style })
```

### 3. Use Layer Manifest for Dynamic UI

```javascript
import manifest from '../tfd-layer-manifest.json'

// Build layer toggle UI
manifest.layers.forEach(layer => {
  const { id, name, zoom } = layer
  console.log(`Layer: ${name} (${id}) — zoom ${zoom.minzoom}-${zoom.maxzoom}`)
})
```

---

## File Inventory

### tfd-maplibre-theme-package.zip

**Contents:**
```
tfd-maplibre-style-light.json      (44 KB) - Light theme with all layers
tfd-maplibre-style-dark.json       (44 KB) - Dark theme variant
tfd-layer-manifest.json            (7.5 KB) - Layer definitions & metadata
tfd-map-interactions.js            (2.7 KB) - Click handlers, layer toggles
tfd-postgis-vector-tiles.sql       (8.8 KB) - Database schema for MVT
README-TFD-MAP-THEME.md            (596 B) - Package documentation
```

**Usage:**
- Drop styles into your React/Vue/Svelte map component
- Use layer manifest to build dynamic UI
- Reference map-interactions.js for click/hover logic

---

### tfd-cadastre-theme/

**Contents:**
```
tfd-cadastre-light.style.json      (12 KB) - Cadastre-optimized light style
tfd-cadastre-dark.style.json       (12 KB) - Cadastre-optimized dark style
layer-manifest.json                (7.8 KB) - Extended layer definitions
postgis-tippecanoe-schema.sql      (12 KB) - Detailed database schema
tippecanoe-build.sh                (2.1 KB) - Automated tile generation
offline-caching-strategy.md        (5.5 KB) - Offline MVT guide
print-export-helper.js             (2.6 KB) - PDF/print utilities
README.md                          (2.7 KB) - Full documentation
```

**Usage:**
- Use cadastre-optimized styles for property/parcel visualization
- Follow offline-caching-strategy for PWA support
- Use tippecanoe-build.sh to generate tiles from PostGIS

---

## Consistent Map Services Pattern

### Setup Once, Use Everywhere

**1. Create a shared hook/service**

**React Hook:**
```javascript
// useMapLibre.js
import { useRef, useEffect, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { getMapStyle } from './themes'

export function useMapLibre(container, options = {}) {
  const mapRef = useRef(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!container) return

    const style = getMapStyle(options.theme || 'light')
    const map = new maplibregl.Map({
      container,
      style,
      center: options.center || [1.2, 7.4],
      zoom: options.zoom || 6,
      ...options
    })

    map.on('load', () => setIsReady(true))
    mapRef.current = map

    return () => map.remove()
  }, [container, options])

  return { map: mapRef.current, isReady }
}
```

**Vue Composable:**
```javascript
// useMapLibre.js
import { ref, onMounted, onUnmounted } from 'vue'
import maplibregl from 'maplibre-gl'
import { getMapStyle } from './themes'

export function useMapLibre(options = {}) {
  const map = ref(null)
  const isReady = ref(false)

  onMounted(() => {
    const style = getMapStyle(options.theme || 'light')
    map.value = new maplibregl.Map({
      container: 'map',
      style,
      center: options.center || [1.2, 7.4],
      zoom: options.zoom || 6,
      ...options
    })
    map.value.on('load', () => (isReady.value = true))
  })

  onUnmounted(() => map.value?.remove())

  return { map, isReady }
}
```

**2. Centralize theme management**

```javascript
// themes.js
import lightStyle from './tfd-maplibre-style-light.json'
import darkStyle from './tfd-maplibre-style-dark.json'
import cadastreLightStyle from './tfd-cadastre-theme/tfd-cadastre-light.style.json'
import cadastreDarkStyle from './tfd-cadastre-theme/tfd-cadastre-dark.style.json'

const TILE_HOST = process.env.REACT_APP_TILE_HOST || 'https://tiles.tefedila.com'

const themes = {
  'maplibre-light': lightStyle,
  'maplibre-dark': darkStyle,
  'cadastre-light': cadastreLightStyle,
  'cadastre-dark': cadastreDarkStyle
}

export function getMapStyle(themeId = 'maplibre-light') {
  const style = JSON.parse(JSON.stringify(themes[themeId]))
  
  // Replace placeholder tiles
  Object.values(style.sources).forEach(source => {
    if (source.tiles) {
      source.tiles = source.tiles.map(tile =>
        tile.replace('YOUR_TILE_HOST', TILE_HOST)
      )
    }
  })

  return style
}

export const THEMES = Object.keys(themes)
```

**3. Use in components**

```javascript
// MapComponent.jsx
import { useMapLibre } from './hooks/useMapLibre'
import { getMapStyle } from './themes'

export default function MapComponent({ themeId = 'maplibre-light' }) {
  const { map, isReady } = useMapLibre({ theme: themeId })

  return (
    <div className="map-container">
      <div id="map" style={{ width: '100%', height: '100%' }} />
      {!isReady && <p>Loading map...</p>}
    </div>
  )
}
```

---

## Using Togo Data

### Load from Core-JS Data

```javascript
// Assume data is in /public/data/ or fetched from API
const togoData = {
  localities: fetch('/data/tfd-hierarchy-data-togo-gis/hierarchy-schema-export.json'),
  buildings: fetch('/data/tfd-hierarchy-data-togo-gis/buildings/'),
  roads: fetch('/data/tfd-hierarchy-data-togo-gis/roads/'),
  poi: fetch('/data/tfd-hierarchy-data-togo-gis/points-of-interest/'),
  health: fetch('/data/tfd-hierarchy-data-togo-gis/health-directory/'),
  business: fetch('/data/tfd-hierarchy-data-togo-gis/business-directory/')
}
```

### Add as GeoJSON Source

```javascript
map.on('load', async () => {
  // Fetch Togo hierarchy data
  const response = await fetch('/data/buildings.geojson')
  const data = await response.json()

  // Add source
  map.addSource('buildings', {
    type: 'geojson',
    data: data,
    buffer: 128,
    maxzoom: 14
  })

  // Add layer
  map.addLayer({
    id: 'building-fill',
    type: 'fill',
    source: 'buildings',
    paint: {
      'fill-color': '#fbb4ae',
      'fill-opacity': 0.7
    }
  })

  map.addLayer({
    id: 'building-outline',
    type: 'line',
    source: 'buildings',
    paint: {
      'line-color': '#e34a33',
      'line-width': 1
    }
  })
})
```

### Query & Inspect Features

```javascript
// Click to get parcel details
map.on('click', 'building-fill', (e) => {
  const feature = e.features[0]
  showPropertyPanel({
    id: feature.properties.id,
    owner: feature.properties.owner,
    area: feature.properties.area_sqm,
    address: feature.properties.address
  })
})

// Hover for visual feedback
map.on('mousemove', 'building-fill', () => {
  map.getCanvas().style.cursor = 'pointer'
})

map.on('mouseleave', 'building-fill', () => {
  map.getCanvas().style.cursor = ''
})
```

---

## Offline Support

### 1. Cache Tiles Locally

```javascript
// Using IndexedDB
async function cacheMapTiles(bounds, zoom) {
  const tiles = getTileCoordinates(bounds, zoom)
  
  for (const [z, x, y] of tiles) {
    const url = `https://tiles.tefedila.com/cadastre/${z}/${x}/${y}.mvt`
    const response = await fetch(url)
    const blob = await response.blob()
    
    // Store in IndexedDB
    const db = await openDB('map-tiles')
    await db.put('tiles', { key: `${z}/${x}/${y}`, data: blob })
  }
}

// Use cached tiles when offline
map.addSource('cadastre', {
  type: 'vector',
  tiles: ['indexeddb://cadastre/{z}/{x}/{y}.mvt'],
  minzoom: 0,
  maxzoom: 22
})
```

### 2. Service Worker Caching

```javascript
// service-worker.js
self.addEventListener('fetch', event => {
  if (event.request.url.includes('/tiles/')) {
    event.respondWith(
      caches.open('map-tiles-v1').then(cache => {
        return cache.match(event.request).then(response => {
          const fetchPromise = fetch(event.request).then(response => {
            cache.put(event.request, response.clone())
            return response
          })
          return response || fetchPromise
        })
      })
    )
  }
})
```

---

## Production Deployment

### Environment Variables

```bash
# .env
REACT_APP_TILE_HOST=https://tiles.tefedila.com
REACT_APP_MAP_CENTER=1.2,7.4
REACT_APP_MAP_ZOOM=6
REACT_APP_THEME=cadastre-light
```

### Docker Setup

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist /app/public
RUN npm i -g serve
CMD ["serve", "-s", "public", "-l", "3000"]
```

### CDN Configuration (Cloudflare)

```javascript
// Cache map tiles aggressively
"POST /tiles/*": {
  "Cache-Control": "public, max-age=2592000",  // 30 days
  "cf-cache-ttl": 2592000
}
```

---

## Troubleshooting

### Map Not Rendering
✅ Check tile host URL is correct  
✅ Verify CORS headers on tile server  
✅ Ensure style JSON is valid (`npm install -g jsonlint`)  

### Features Not Showing
✅ Verify min/max zoom levels  
✅ Check layer visibility (`map.setLayoutProperty()`)  
✅ Inspect network requests (DevTools > Network)  

### Performance Issues
✅ Simplify geometries at low zooms  
✅ Use feature clustering  
✅ Enable tile caching (browser + server)  
✅ Lazy-load layers by zoom level  

---

## Next: Deploy Your Own Tile Server

See `../tfd-maplibre-theme-package/tfd-postgis-vector-tiles.sql` for:
- PostgreSQL + PostGIS schema
- Vector tile query function
- Privacy-aware field filtering

And `../tfd-cadastre-theme/postgis-tippecanoe-schema.sql` for:
- Detailed cadastre schema
- Multi-layer tile generation
- Offline caching strategies
