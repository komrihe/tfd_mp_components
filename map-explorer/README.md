# TFD MapLibre Basemaps Explorer

A Vite + React application showcasing **custom Map Libre basemaps for Togo cadastral data** with light/dark themes and interactive layer inspection.

## 📍 Overview

This project explores two custom Map Libre theme packages:

1. **tfd-maplibre-theme-package** — General-purpose cadastre styling
2. **tfd-cadastre-theme** — Specialized cadastre theme with enhanced layers

Both are configured for Togo (centered at 1.2°E, 7.4°N) and support vector map tiles (MVT) for efficient rendering.

## 🎯 Features

- ✅ **Dual Themes** — Light/dark mode toggle
- ✅ **Layer Inspector** — Click features to view properties
- ✅ **Layer Visibility** — Toggle layers on/off
- ✅ **Responsive Design** — Mobile-friendly sidebar
- ✅ **Togo-Centered** — Pre-configured for Togo geography
- ✅ **Production Ready** — Vite + React + MapLibre GL

## 🚀 Quick Start

### Development

```bash
cd map-explorer
npm install
npm run dev
```

Server starts at `http://localhost:5173/`

### Build for Production

```bash
npm run build
npm run preview
```

## 📁 Project Structure

```
map-explorer/
├── src/
│   ├── App.jsx                 # Main map component
│   ├── App.css                 # Map styling
│   ├── main.jsx                # React entry point
│   ├── index.css               # Global styles
│   └── components/
│       ├── MapControls.jsx     # Theme & panel toggles
│       ├── ThemePanel.jsx      # Theme selector
│       └── LayerInspector.jsx  # Feature inspector
├── BASEMAPS_GUIDE.md           # Architecture & data reference
├── INTEGRATION_GUIDE.md        # How to use in other projects
├── index.html
├── vite.config.js
└── package.json
```

## 📖 Documentation

### For Map Architecture & Togo Data
Read **[BASEMAPS_GUIDE.md](./BASEMAPS_GUIDE.md)**

Topics covered:
- How vector map tiles (MVT) work
- Database schema for cadastral data
- Layer definitions & zoom levels
- Hosting options (local, cloud, self-hosted)
- Privacy & export strategies

### For Integration into Projects
Read **[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)**

Topics covered:
- Quick start code examples
- React Hook & Vue Composable patterns
- Theme management system
- Using Togo hierarchy data
- Offline support strategies
- Production deployment

## 🎨 Theme Files

### Extracted from tfd-maplibre-theme-package.zip

- `../tfd-maplibre-style-light.json` — Light theme (44 KB)
- `../tfd-maplibre-style-dark.json` — Dark theme (44 KB)
- `../tfd-layer-manifest.json` — Layer definitions (7.5 KB)

### Extracted from tfd-cadastre-theme/

- `../tfd-cadastre-theme/tfd-cadastre-light.style.json` — Cadastre light (12 KB)
- `../tfd-cadastre-theme/tfd-cadastre-dark.style.json` — Cadastre dark (12 KB)
- `../tfd-cadastre-theme/layer-manifest.json` — Extended definitions (7.8 KB)

## 🗺️ Map Tiles Explained

Togo is divided into a pyramid of square tiles at different zoom levels:

```
Zoom 5: Few large tiles covering all of Togo
Zoom 10: Medium tiles showing districts
Zoom 16: Tiny tiles showing individual parcels
```

Each tile is identified as: `zoom / x / y`, e.g., `16/32989/31642`

MapLibre requests: `https://tiles.tefedila.com/cadastre/16/32989/31642.mvt`

**Benefits:**
- Only downloads visible area (not entire database)
- Fast rendering of millions of features
- Efficient caching and bandwidth usage

## 🏗️ Database Setup

To generate tiles locally, use **PostGIS + Tippecanoe**:

```bash
# 1. Create database
createdb cadastre_togo
psql -d cadastre_togo -c "CREATE EXTENSION postgis;"

# 2. Load schema (from extracted package)
psql -d cadastre_togo -f ../tfd-maplibre-theme-package/tfd-postgis-vector-tiles.sql

# 3. Import data
psql -d cadastre_togo -f ../tfd-cadastre-theme/postgis-tippecanoe-schema.sql

# 4. Generate tiles
psql -d cadastre_togo -c "SELECT ..." | tippecanoe -o cadastre.mbtiles
```

## 🌐 Using Togo Data

Togo cadastral and administrative data is located at:
```
/Users/richardhemedzo/development/KMW/TFD/tefedila_project/core-js/data/
```

**Data includes:**
- Buildings (footprints, addresses)
- Roads (primary, secondary, tertiary)
- Administrative boundaries (regions, districts, communes)
- Points of interest (health, education, commerce)
- Business directory
- Health facilities

## 🔧 Configuration

### Tile Host

Replace `YOUR_TILE_HOST` in style files:

```javascript
// In your map setup
const style = getMapStyle('light')
Object.values(style.sources).forEach(source => {
  if (source.tiles) {
    source.tiles = source.tiles.map(tile =>
      tile.replace('YOUR_TILE_HOST', 'https://tiles.tefedila.com')
    )
  }
})
```

Or use environment variables:

```bash
REACT_APP_TILE_HOST=https://tiles.tefedila.com npm run dev
```

### Map Center & Zoom

```javascript
const map = new maplibregl.Map({
  center: [1.2, 7.4],  // Togo (lon, lat)
  zoom: 6              // Regional view
})
```

## 📊 Layers & Zoom Levels

| Layer | Source | Min Zoom | Max Zoom | Type |
|-------|--------|----------|----------|------|
| Cadastral Parcels | Vector | 10 | 22 | Polygons |
| Buildings | Vector | 13 | 22 | Polygons |
| Addresses | Vector | 14 | 22 | Points |
| Roads | Vector | 5 | 22 | Lines |
| Water | Vector | 1 | 22 | Polygons |
| Admin Boundaries | Vector | 5 | 22 | Lines |
| Points of Interest | Vector | 12 | 22 | Points |

## 💾 Offline Support

Cache tiles for offline usage:

```javascript
// IndexedDB caching
async function cacheMapTiles(bounds, zoom) {
  const tiles = getTileCoordinates(bounds, zoom)
  // Download and store tiles...
}
```

See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for full examples.

## 🚢 Deployment

### Docker

```bash
docker build -t tfd-map-explorer .
docker run -p 3000:3000 tfd-map-explorer
```

### Vercel / Netlify

```bash
npm run build
# Deploy `dist/` folder
```

### Self-Hosted

```bash
npm run build
npm install -g serve
serve -s dist -l 3000
```

## 🔗 Integrating into Your Projects

Use this explorer as a reference implementation:

1. **Copy theme files** to your project
2. **Use the hook pattern** from INTEGRATION_GUIDE.md
3. **Connect to your tile server**
4. **Customize layers** for your use case

Example:

```javascript
import { useMapLibre } from '@/hooks/useMapLibre'

export default function MyMap() {
  const { map, isReady } = useMapLibre({
    theme: 'cadastre-light',
    center: [1.2, 7.4],
    zoom: 10
  })

  return <div id="map" style={{ width: '100%', height: '100vh' }} />
}
```

## 📚 Resources

- [MapLibre GL Documentation](https://maplibre.org/maplibre-gl-js/)
- [Vector Tile Specification](https://github.com/mapbox/vector-tile-spec)
- [Tippecanoe](https://github.com/mapbox/tippecanoe) — MVT generator
- [PostGIS Documentation](https://postgis.net/documentation/)
- [Togo Data](../../TFD/tefedila_project/core-js/data/) — Source data

## 📝 License

TBD — Check original theme package licenses

## 🤝 Contributing

To add features:

1. Create a new component in `src/components/`
2. Update App.jsx to use it
3. Test with `npm run dev`
4. Document in INTEGRATION_GUIDE.md

## 📞 Support

For questions about:
- **Map setup** → See BASEMAPS_GUIDE.md
- **Integration** → See INTEGRATION_GUIDE.md
- **Togo data** → Check `/data/README.md`
- **MapLibre** → Visit [maplibre.org](https://maplibre.org/)

---

**Status:** ✅ Ready for development  
**Node Version:** 18+  
**Package Manager:** npm/yarn  
**Last Updated:** 2026-09-04
