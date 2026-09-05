# TFD Cadastre – Offline Tile Caching Strategy

## Goals
- Fast first load on mobile & low-bandwidth networks
- Full offline map support for field surveyors
- Minimal storage footprint while keeping high zoom detail
- Seamless switch between online / offline modes

---

## 1. Recommended Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  MapLibre GL JS │────▶│  Service Worker      │────▶│  Cache Storage  │
│  (browser)      │     │  (Workbox / custom)  │     │  (Cache API)    │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
         │                        │
         │                        ▼
         │               ┌──────────────────────┐
         └──────────────▶│  IndexedDB           │
                         │  (feature attributes │
                         │   + metadata)        │
                         └──────────────────────┘
```

---

## 2. Tile Caching Rules

| Zoom Range | Strategy                          | Max Age     | Notes |
|------------|-----------------------------------|-------------|-------|
| 6 – 11     | Cache-first (pre-cache region)    | 30 days     | Admin + major streets |
| 12 – 15    | Network-first → Cache             | 14 days     | Cadastre grid + parcels |
| 16 – 18    | Cache-first (on-demand)           | 7 days      | Buildings, addresses, boundaries |
| > 18       | Network only                      | —           | Rarely needed offline |

### Pre-cache bounding box (example)
```js
const OFFLINE_BOUNDS = {
  west:  -1.5,   // adjust to your AOI
  south:  6.0,
  east:   2.5,
  north: 12.0
};
```

---

## 3. Implementation with Workbox (recommended)

```js
// sw.js
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Style + sprites + glyphs
precacheAndRoute(self.__WB_MANIFEST);

// Vector tiles – zoom-aware
registerRoute(
  ({ url }) => url.pathname.includes('/tfd/') && url.pathname.endsWith('.pbf'),
  new CacheFirst({
    cacheName: 'tfd-vector-tiles',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 8000,          // adjust per device
        maxAgeSeconds: 14 * 24 * 3600,
        purgeOnQuotaError: true
      })
    ]
  })
);

// Raster basemap (if used)
registerRoute(
  ({ url }) => url.pathname.includes('/raster/'),
  new CacheFirst({
    cacheName: 'tfd-raster',
    plugins: [
      new ExpirationPlugin({ maxEntries: 3000, maxAgeSeconds: 30 * 24 * 3600 })
    ]
  })
);
```

---

## 4. MapLibre Offline Integration

```js
// Enable offline source when navigator.onLine === false
const onlineSource = {
  type: 'vector',
  tiles: ['https://your-server/tfd/{z}/{x}/{y}.pbf'],
  maxzoom: 18
};

const offlineSource = {
  type: 'vector',
  tiles: ['https://your-server/tfd/{z}/{x}/{y}.pbf'], // same URL – SW intercepts
  maxzoom: 18
};

map.on('load', () => {
  // Service Worker will serve from cache automatically
});
```

### Detect & notify user
```js
window.addEventListener('online',  () => map.getSource('tfd-tiles').setTiles([...]));
window.addEventListener('offline', () => showOfflineBanner());
```

---

## 5. Storage Budget Guidelines (mobile)

| Device Class     | Recommended Tile Cache | IndexedDB (attrs) |
|------------------|------------------------|-------------------|
| Low-end Android  | 150–250 MB             | 30–50 MB          |
| Mid-range        | 400–600 MB             | 80–120 MB         |
| High-end / iPad  | 1–1.5 GB               | 200 MB            |

Use `navigator.storage.estimate()` to adapt dynamically.

---

## 6. Field Surveyor Workflow

1. Before going to field → open app while online → “Download Region” button.
2. App calculates required tiles for current viewport + buffer (zoom 12–17).
3. Progress bar + estimated size shown.
4. Once complete → map works fully offline (parcels, boundaries, addresses, titles).
5. On return → background sync of any new survey edits (if you add edit capability).

---

## 7. Print / Export Mode Interaction with Offline

When user activates Print/Export mode:
- Force high-contrast print layers visible
- Disable 3D extrusion
- Increase label sizes
- Optionally freeze the map (no panning) for clean PDF capture via `map.getCanvas().toDataURL()` or html2canvas + jsPDF.

---

## 8. Fallback & Error Handling

- If a tile is missing offline → show subtle “tile unavailable offline” hatch pattern (add a special layer).
- Keep a minimal “skeleton” style (admin + major roads only) always cached for first paint.

---

## Quick Start Checklist

- [ ] Add Workbox service worker
- [ ] Precache style.json + sprites + glyphs
- [ ] Register zoom-aware tile routes
- [ ] Implement “Download Region” UI
- [ ] Test on real devices with airplane mode
- [ ] Monitor `navigator.storage.estimate()`
