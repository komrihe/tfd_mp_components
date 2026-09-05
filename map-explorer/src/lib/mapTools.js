/**
 * Urbanisme / cadastre map tool helpers — measure, overlay, export, fit.
 */

import { communeCode } from './communeFilter'

const EARTH_RADIUS_M = 6371008.8
const TOOLS_SOURCE = 'tfd-map-tools'
const TOOLS_FILL = 'tfd-map-tools-fill'
const TOOLS_LINE = 'tfd-map-tools-line'
const TOOLS_POINTS = 'tfd-map-tools-points'

function toRad(deg) {
  return (deg * Math.PI) / 180
}

/** Haversine distance between two [lng, lat] points (metres). */
export function haversineMeters(a, b) {
  const [lng1, lat1] = a
  const [lng2, lat2] = b
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)
  const h =
    s1 * s1 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Polyline length in metres. */
export function pathLengthMeters(coords) {
  if (!coords || coords.length < 2) return 0
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    total += haversineMeters(coords[i - 1], coords[i])
  }
  return total
}

/**
 * Spherical excess / ring area on a sphere (m²).
 * Ring may be open or closed; winding sign preserved.
 */
export function ringAreaMeters2(ring) {
  if (!ring || ring.length < 3) return 0
  const coords =
    ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
      ? ring
      : [...ring, ring[0]]

  let total = 0
  for (let i = 0; i < coords.length - 1; i++) {
    const [lng1, lat1] = coords[i]
    const [lng2, lat2] = coords[i + 1]
    total += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)))
  }
  return (total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2
}

export function polygonAreaMeters2(coords) {
  if (!coords?.length) return 0
  const outer = Math.abs(ringAreaMeters2(coords[0]))
  let holes = 0
  for (let i = 1; i < coords.length; i++) {
    holes += Math.abs(ringAreaMeters2(coords[i]))
  }
  return Math.max(0, outer - holes)
}

/** Approximate geodesic circle as GeoJSON polygon (visual buffer). */
export function bufferCirclePolygon(center, radiusM, steps = 64) {
  const [lng, lat] = center
  const latRad = toRad(lat)
  const meta = radiusM / EARTH_RADIUS_M
  const ring = []
  for (let i = 0; i <= steps; i++) {
    const brng = (2 * Math.PI * i) / steps
    const lat2 = Math.asin(
      Math.sin(latRad) * Math.cos(meta) +
        Math.cos(latRad) * Math.sin(meta) * Math.cos(brng)
    )
    const lng2 =
      toRad(lng) +
      Math.atan2(
        Math.sin(brng) * Math.sin(meta) * Math.cos(latRad),
        Math.cos(meta) - Math.sin(latRad) * Math.sin(lat2)
      )
    ring.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI])
  }
  return {
    type: 'Feature',
    properties: { kind: 'buffer', radius_m: radiusM },
    geometry: { type: 'Polygon', coordinates: [ring] },
  }
}

export function formatDistance(meters) {
  if (!Number.isFinite(meters) || meters < 0) return '—'
  if (meters < 1000) return `${meters.toFixed(meters < 10 ? 1 : 0)} m`
  return `${(meters / 1000).toFixed(meters < 10000 ? 2 : 1)} km`
}

export function formatArea(m2) {
  if (!Number.isFinite(m2) || m2 < 0) return '—'
  if (m2 < 10000) return `${m2.toFixed(m2 < 100 ? 1 : 0)} m²`
  const ha = m2 / 10000
  if (ha < 100) return `${ha.toFixed(ha < 10 ? 2 : 1)} ha`
  return `${(ha / 100).toFixed(2)} km²`
}

export function formatLngLat(lng, lat, digits = 6) {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return '—'
  return `${lng.toFixed(digits)}, ${lat.toFixed(digits)}`
}

export function emptyToolsCollection() {
  return { type: 'FeatureCollection', features: [] }
}

export function ensureToolsOverlay(map) {
  if (!map) return
  if (!map.getSource(TOOLS_SOURCE)) {
    map.addSource(TOOLS_SOURCE, {
      type: 'geojson',
      data: emptyToolsCollection(),
    })
  }
  if (!map.getLayer(TOOLS_FILL)) {
    map.addLayer({
      id: TOOLS_FILL,
      type: 'fill',
      source: TOOLS_SOURCE,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'fill-color': '#5BB89A',
        'fill-opacity': 0.18,
      },
    })
  }
  if (!map.getLayer(TOOLS_LINE)) {
    map.addLayer({
      id: TOOLS_LINE,
      type: 'line',
      source: TOOLS_SOURCE,
      filter: [
        'any',
        ['==', ['geometry-type'], 'LineString'],
        ['==', ['geometry-type'], 'Polygon'],
      ],
      paint: {
        'line-color': '#00e5b0',
        'line-width': 2.2,
        'line-opacity': 0.95,
      },
    })
  }
  if (!map.getLayer(TOOLS_POINTS)) {
    map.addLayer({
      id: TOOLS_POINTS,
      type: 'circle',
      source: TOOLS_SOURCE,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': 5,
        'circle-color': '#0d1014',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#00e5b0',
      },
    })
  }
}

export function setToolsOverlayData(map, collection) {
  if (!map) return
  ensureToolsOverlay(map)
  const src = map.getSource(TOOLS_SOURCE)
  if (src) src.setData(collection || emptyToolsCollection())
}

export function clearToolsOverlay(map) {
  setToolsOverlayData(map, emptyToolsCollection())
}

export function removeToolsOverlay(map) {
  if (!map) return
  for (const id of [TOOLS_POINTS, TOOLS_LINE, TOOLS_FILL]) {
    if (map.getLayer(id)) map.removeLayer(id)
  }
  if (map.getSource(TOOLS_SOURCE)) map.removeSource(TOOLS_SOURCE)
}

/** Build sketch GeoJSON from vertex list for distance / area tools. */
export function sketchCollection(points, mode, { closed = false } = {}) {
  const features = points.map((c, i) => ({
    type: 'Feature',
    properties: { kind: 'vertex', index: i },
    geometry: { type: 'Point', coordinates: c },
  }))

  if (mode === 'distance' && points.length >= 2) {
    features.push({
      type: 'Feature',
      properties: {
        kind: 'path',
        length_m: pathLengthMeters(points),
      },
      geometry: { type: 'LineString', coordinates: points },
    })
  }

  if (mode === 'area' && points.length >= 2) {
    const ring = closed || points.length >= 3 ? [...points, points[0]] : points
    if (points.length >= 3 && (closed || points.length >= 3)) {
      features.push({
        type: 'Feature',
        properties: {
          kind: 'polygon',
          area_m2: polygonAreaMeters2([points]),
        },
        geometry: { type: 'Polygon', coordinates: [[...points, points[0]]] },
      })
    } else {
      features.push({
        type: 'Feature',
        properties: { kind: 'path' },
        geometry: { type: 'LineString', coordinates: ring },
      })
    }
  }

  return { type: 'FeatureCollection', features }
}

function extendBoundsFromCoords(bounds, coords) {
  if (!coords) return
  if (typeof coords[0] === 'number') {
    bounds.extend(coords)
    return
  }
  for (const c of coords) extendBoundsFromCoords(bounds, c)
}

/**
 * Fit map to selected communes (or all if none selected).
 * @returns {{ ok: boolean, count: number, message?: string }}
 */
export function fitCommunes(map, communeData, selectedCodes, maplibregl) {
  if (!map || !communeData?.features?.length) {
    return { ok: false, count: 0, message: 'No commune data' }
  }
  const codes = (selectedCodes || []).filter(Boolean)
  const features = codes.length
    ? communeData.features.filter((f) => codes.includes(communeCode(f)))
    : communeData.features

  if (!features.length) {
    return { ok: false, count: 0, message: 'No matching communes' }
  }

  const bounds = new maplibregl.LngLatBounds()
  for (const f of features) {
    if (f.geometry?.coordinates) {
      extendBoundsFromCoords(bounds, f.geometry.coordinates)
    }
  }
  if (bounds.isEmpty()) {
    return { ok: false, count: 0, message: 'Empty bounds' }
  }

  map.fitBounds(bounds, {
    padding: { top: 72, bottom: 48, left: 48, right: 48 },
    duration: 800,
    maxZoom: codes.length ? 13.5 : 7.5,
  })
  return { ok: true, count: features.length }
}

/** Download map canvas as PNG. */
export function exportMapPng(map, filename = 'tfd-map-view.png') {
  if (!map) return false
  map.triggerRepaint()
  const canvas = map.getCanvas()
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  return true
}

/** Download selected communes (or sketch) as GeoJSON. */
export function exportSelectionGeoJson(communeData, selectedCodes, filename = 'tfd-selection.geojson') {
  const codes = (selectedCodes || []).filter(Boolean)
  const features = codes.length
    ? (communeData?.features || []).filter((f) => codes.includes(communeCode(f)))
    : []
  if (!features.length) return false
  const blob = new Blob(
    [JSON.stringify({ type: 'FeatureCollection', features }, null, 2)],
    { type: 'application/geo+json' }
  )
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return true
}

export function setLayerVisibility(map, layerId, visible) {
  if (!map?.getLayer?.(layerId)) return false
  map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
  return true
}

export function setPlanningOrtho(map, enabled) {
  return setLayerVisibility(map, 'planning-ortho-raster', enabled)
}
