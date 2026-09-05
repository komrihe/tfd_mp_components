/**
 * Load and prepare TFD MapLibre cadastre themes for Map View.
 *
 * Production: set VITE_TILE_HOST (e.g. tiles.tefedila.com) — styles keep vector MVT.
 * Demo (no host): rewrite tfd-vector layers onto local GeoJSON with theme paint preserved.
 */

import { URBANISM_DATA_URLS, pickLocalities } from './urbanismMap'

const OPENFREEMAP_GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'
const PLACEHOLDER = 'YOUR_TILE_HOST'

const HIGHWAY_TO_CLASS = {
  motorway: 'motorway',
  trunk: 'trunk',
  primary: 'primary',
  secondary: 'secondary',
  tertiary: 'tertiary',
  unclassified: 'local',
  residential: 'local',
  living_street: 'local',
  service: 'local',
  track: 'local',
  path: 'local',
  footway: 'local',
  cycleway: 'local',
  pedestrian: 'local',
}

function deepReplace(value, from, to) {
  if (typeof value === 'string') return value.split(from).join(to)
  if (Array.isArray(value)) return value.map((v) => deepReplace(v, from, to))
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = deepReplace(v, from, to)
    return out
  }
  return value
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return res.json()
}

function emptyFc() {
  return { type: 'FeatureCollection', features: [] }
}

function withIds(fc, idProp) {
  return {
    type: 'FeatureCollection',
    features: (fc?.features || []).map((f, i) => {
      const props = { ...(f.properties || {}) }
      const id = props[idProp] || props.official_code || props.canonical_id || `${idProp}-${i}`
      props[idProp] = id
      return { ...f, id: typeof id === 'number' ? id : i + 1, properties: props }
    }),
  }
}

function normalizeCommunes(fc) {
  return {
    type: 'FeatureCollection',
    features: (fc?.features || []).map((f, i) => {
      const p = f.properties || {}
      const admin_id = p.official_code || p.canonical_id || `admin-${i}`
      return {
        ...f,
        id: i + 1,
        properties: {
          ...p,
          admin_id,
          level: p.admin_level || p.level || 'commune',
          name: p.display_name || p.canonical_name || p.official_code || admin_id,
          official_code: p.official_code || admin_id,
        },
      }
    }),
  }
}

function normalizeRoads(fc) {
  return {
    type: 'FeatureCollection',
    features: (fc?.features || []).map((f, i) => {
      const p = f.properties || {}
      const street_id = p.street_id || p.osm_id || `street-${i}`
      return {
        ...f,
        id: i + 1,
        properties: {
          ...p,
          street_id,
          class: p.class || HIGHWAY_TO_CLASS[p.highway] || 'local',
          name: p.name || p.ref || '',
        },
      }
    }),
  }
}

function normalizeBuildings(fc) {
  return {
    type: 'FeatureCollection',
    features: (fc?.features || []).map((f, i) => {
      const p = f.properties || {}
      const building_id = p.building_id || `bldg-${i}`
      return {
        ...f,
        id: i + 1,
        properties: {
          ...p,
          building_id,
          height: p.height || (p.building === 'yes' ? 6 : 8),
          floors: p.floors || 2,
        },
      }
    }),
  }
}

function normalizeLocalities(fc) {
  return {
    type: 'FeatureCollection',
    features: (fc?.features || []).map((f, i) => {
      const p = f.properties || {}
      const locality_id = p.locality_id || p.canonical_id || `loc-${i}`
      return {
        ...f,
        id: i + 1,
        properties: {
          ...p,
          locality_id,
          name: p.name || p.record_name || p.autonomous_parent_context_name || locality_id,
        },
      }
    }),
  }
}

function normalizeInfraAsAddresses(fc) {
  // Theme expects point addresses; convert polygon centroids-ish via MapLibre
  // by keeping polygons — circle layers need points. Convert to points.
  return {
    type: 'FeatureCollection',
    features: (fc?.features || []).map((f, i) => {
      const p = f.properties || {}
      const address_id = p.address_id || `addr-${i}`
      let geometry = f.geometry
      if (geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon') {
        // rough centroid from first ring
        const ring =
          geometry.type === 'Polygon'
            ? geometry.coordinates[0]
            : geometry.coordinates[0]?.[0] || []
        if (ring.length) {
          let sx = 0
          let sy = 0
          const n = ring.length - 1 || ring.length
          for (let j = 0; j < n; j++) {
            sx += ring[j][0]
            sy += ring[j][1]
          }
          geometry = { type: 'Point', coordinates: [sx / n, sy / n] }
        }
      }
      return {
        type: 'Feature',
        id: i + 1,
        geometry,
        properties: {
          ...p,
          address_id,
          housenumber: p.housenumber || '',
          name: p.name || p.infra_class || '',
        },
      }
    }),
  }
}

function geoSourceId(sourceLayer) {
  return `tfd-geo:${sourceLayer}`
}

/**
 * Rewrite vector style layers to GeoJSON sources (demo / offline).
 */
function rewriteToGeoJsonDemo(style, collections, themeName = 'light') {
  const isDark = themeName === 'dark'
  const promoteId = style.sources?.['tfd-vector']?.promoteId || {}

  const byLayer = {
    admin_units: normalizeCommunes(collections.communes),
    tfd_localities: normalizeLocalities(collections.localities),
    tfd_streets: normalizeRoads(collections.roads),
    buildings: normalizeBuildings(collections.buildings),
    addresses: normalizeInfraAsAddresses(collections.infrastructure),
    // Cadastre-only layers stay empty until tile host is set
    tfd_grid: emptyFc(),
    parcels: emptyFc(),
    parcel_boundaries: emptyFc(),
    rights_holders: emptyFc(),
    cadastral_sections: emptyFc(),
    land_titles: emptyFc(),
    encumbrances: emptyFc(),
    zoning: emptyFc(),
    public_spaces: emptyFc(),
    planning_rules: emptyFc(),
    permits: emptyFc(),
    servitudes: emptyFc(),
  }

  const sources = {
    ...Object.fromEntries(
      Object.entries(byLayer).map(([sourceLayer, data]) => [
        geoSourceId(sourceLayer),
        {
          type: 'geojson',
          data: withIds(data, promoteId[sourceLayer] || 'id'),
          promoteId: promoteId[sourceLayer] || undefined,
          attribution: 'TFD demo GeoJSON — replace with MVT via VITE_TILE_HOST',
        },
      ])
    ),
  }

  // Keep theme background; disable broken raster hosts in demo
  const layers = []
  for (const layer of style.layers || []) {
    if (layer.type === 'background') {
      layers.push(layer)
      continue
    }

    if (layer.source === 'cadastral-sheets-raster' || layer.source === 'planning-ortho-raster') {
      layers.push({
        ...layer,
        layout: { ...(layer.layout || {}), visibility: 'none' },
      })
      continue
    }

    if (layer.source === 'tfd-vector' && layer['source-layer']) {
      const sl = layer['source-layer']
      const next = {
        ...layer,
        source: geoSourceId(sl),
      }
      delete next['source-layer']
      layers.push(next)
      continue
    }

    layers.push(layer)
  }

  // Commune fill + labels for filter UX (theme only has boundary lines)
  const communeSource = geoSourceId('admin_units')
  layers.splice(
    layers.findIndex((l) => l.id === 'admin-commune-boundary') + 1 || 1,
    0,
    {
      id: 'commune-fill',
      type: 'fill',
      source: communeSource,
      filter: ['==', ['get', 'level'], 'commune'],
      paint: {
        'fill-color': isDark ? '#1A2420' : '#E4EBE4',
        'fill-opacity': 0.35,
      },
      metadata: { 'tfd:group': 'admin', 'tfd:demo': true },
    },
    {
      id: 'commune-line',
      type: 'line',
      source: communeSource,
      filter: ['==', ['get', 'level'], 'commune'],
      paint: {
        'line-color': isDark ? '#5BB89A' : '#046C54',
        'line-width': 1.5,
      },
      metadata: { 'tfd:group': 'admin', 'tfd:demo': true },
    },
    {
      id: 'commune-labels',
      type: 'symbol',
      source: communeSource,
      minzoom: 7,
      filter: ['==', ['get', 'level'], 'commune'],
      layout: {
        'text-field': ['coalesce', ['get', 'name'], ['get', 'official_code']],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'text-max-width': 10,
      },
      paint: {
        'text-color': isDark ? '#a8e6d4' : '#0a3d32',
        'text-halo-color': isDark ? '#0a0c0f' : '#ffffff',
        'text-halo-width': 1.4,
      },
      metadata: { 'tfd:group': 'admin', 'tfd:demo': true },
    }
  )

  return {
    ...style,
    glyphs: OPENFREEMAP_GLYPHS,
    sources: {
      ...sources,
      // Keep raster source keys so style validation doesn't break if a layer remains
      'cadastral-sheets-raster': {
        type: 'raster',
        tiles: ['https://tiles.openfreemap.org/naturalearth/ne2sr/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 0,
      },
      'planning-ortho-raster': {
        type: 'raster',
        tiles: ['https://tiles.openfreemap.org/naturalearth/ne2sr/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 0,
      },
    },
    layers,
    metadata: {
      ...(style.metadata || {}),
      'tfd:runtime': 'geojson-demo',
      'tfd:tileHost': null,
    },
  }
}

function applyTileHost(style, host) {
  const cleaned = host.replace(/^https?:\/\//, '').replace(/\/$/, '')
  let next = deepReplace(style, PLACEHOLDER, cleaned)
  // Ensure glyphs work even if fonts aren't on the tile host yet
  if (!next.glyphs || String(next.glyphs).includes(PLACEHOLDER)) {
    next = { ...next, glyphs: OPENFREEMAP_GLYPHS }
  }
  return {
    ...next,
    metadata: {
      ...(next.metadata || {}),
      'tfd:runtime': 'mvt',
      'tfd:tileHost': cleaned,
    },
  }
}

export function getTileHost() {
  const env = import.meta.env?.VITE_TILE_HOST
  if (!env || env.includes(PLACEHOLDER)) return null
  return String(env).trim() || null
}

/**
 * @param {'light'|'dark'} theme
 * @param {{ communes?: object }} [opts]
 */
export async function prepareTfdStyle(theme, opts = {}) {
  const styleUrl = `/themes/tfd-maplibre-style-${theme}.json`
  const style = await fetchJson(styleUrl)
  const host = getTileHost()

  if (host) {
    return applyTileHost(style, host)
  }

  // Demo: bind local TFD extracts into the real theme paints
  let roads = emptyFc()
  let buildings = emptyFc()
  let infrastructure = emptyFc()
  let localitiesRaw = emptyFc()
  let localitiesLome = emptyFc()

  try {
    ;[roads, buildings, infrastructure, localitiesRaw, localitiesLome] = await Promise.all([
      fetchJson(URBANISM_DATA_URLS.roads).catch(() => emptyFc()),
      fetchJson(URBANISM_DATA_URLS.buildings).catch(() => emptyFc()),
      fetchJson(URBANISM_DATA_URLS.infrastructure).catch(() => emptyFc()),
      fetchJson(URBANISM_DATA_URLS.localities).catch(() => emptyFc()),
      fetchJson(URBANISM_DATA_URLS.localitiesLome).catch(() => emptyFc()),
    ])
  } catch {
    // keep empties
  }

  const localities = pickLocalities({
    localities: localitiesRaw,
    localitiesLome,
  })

  const communes =
    opts.communes?.features?.length
      ? opts.communes
      : await fetchJson('/data/communes.geojson').catch(() => emptyFc())

  return rewriteToGeoJsonDemo(
    style,
    {
      communes,
      localities,
      roads,
      buildings,
      infrastructure,
    },
    theme
  )
}

export function themeIsDemo(style) {
  return style?.metadata?.['tfd:runtime'] === 'geojson-demo'
}
