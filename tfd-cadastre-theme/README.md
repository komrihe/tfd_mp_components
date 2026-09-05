# TFD Cadastre Theme – MapLibre Complete Package

Production-ready MapLibre GL JS theme for cadastral / land-administration mapping.

## Contents

| File | Description |
|------|-------------|
| `tfd-cadastre-light.style.json` | Full light theme (ready to drop) |
| `tfd-cadastre-dark.style.json`  | Full dark theme (ready to drop) |
| `layer-manifest.json`           | Complete layer documentation + color palette |
| `postgis-tippecanoe-schema.sql` | Full PostGIS schema + tile-ready views |
| `tippecanoe-build.sh`           | Tippecanoe build script |
| `offline-caching-strategy.md`   | Service Worker + offline strategy |
| `print-export-helper.js`        | Toggle print/export high-contrast layers |

## Quick Start

```js
import maplibregl from 'maplibre-gl';

const map = new maplibregl.Map({
  container: 'map',
  style: './tfd-cadastre-light.style.json',   // or dark
  center: [1.0, 8.0],                         // adjust to your AOI
  zoom: 12
});
```

### Switch theme at runtime
```js
map.setStyle('./tfd-cadastre-dark.style.json');
```

### Enable Print / Export mode
```js
import { enablePrintMode, disablePrintMode } from './print-export-helper.js';

enablePrintMode(map);   // high-contrast black outlines + labels
// ... capture PDF or print
disablePrintMode(map);
```

### Enable 3D buildings
```js
map.setLayoutProperty('buildings-3d', 'visibility', 'visible');
map.setLayoutProperty('buildings-fill', 'visibility', 'none');
```

## Interactivity (hover + click)

```js
// Hover highlight
map.on('mousemove', 'parcels-fill', (e) => {
  if (e.features.length) {
    map.getCanvas().style.cursor = 'pointer';
    map.setFeatureState(
      { source: 'tfd-tiles', sourceLayer: 'parcels', id: e.features[0].id },
      { hover: true }
    );
  }
});

map.on('mouseleave', 'parcels-fill', () => {
  map.getCanvas().style.cursor = '';
});

// Click → Attribute Inspector
map.on('click', 'parcels-fill', (e) => {
  const props = e.features[0].properties;
  console.log('Parcel:', props);
  // open your inspector UI
});
```

## PostGIS → Tiles

1. Run `postgis-tippecanoe-schema.sql`
2. Export views to GeoJSON (or use Martin / pg_tileserv directly)
3. Run `./tippecanoe-build.sh`
4. Serve the resulting `.mbtiles` or `.pmtiles`

## Offline Support

See `offline-caching-strategy.md` for full Service Worker + Workbox setup and field-surveyor download workflow.

## Color Palette Summary

**Light**: warm paper background, soft greens for parcels, earth tones for cadastre.  
**Dark**: deep slate background, luminous greens & ambers for high contrast at night.

## License

Provided as-is for TFD Cadastre / land administration projects.
