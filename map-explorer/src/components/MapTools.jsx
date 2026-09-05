import { useCallback, useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import {
  bufferCirclePolygon,
  clearToolsOverlay,
  ensureToolsOverlay,
  exportMapPng,
  exportSelectionGeoJson,
  fitCommunes,
  formatArea,
  formatDistance,
  formatLngLat,
  pathLengthMeters,
  polygonAreaMeters2,
  setPlanningOrtho,
  setToolsOverlayData,
  sketchCollection,
} from '../lib/mapTools'
import { setLegacySheets } from '../lib/tfdInteractions'
import './MapTools.css'

const MODE_TOOLS = [
  { id: 'inspect', label: 'Inspect', title: 'Identify / inspect feature (click)' },
  { id: 'distance', label: 'Distance', title: 'Measure distance — click path, dbl-click finish' },
  { id: 'area', label: 'Area', title: 'Measure area — click polygon, dbl-click close' },
  { id: 'coords', label: 'Coords', title: 'Click map for lon/lat' },
  { id: 'buffer', label: 'Buffer', title: 'Buffer preview around a point (100 m)' },
]

const ACTION_TOOLS = [
  { id: 'fit', label: 'Fit', title: 'Zoom to selected commune(s)' },
  { id: 'export', label: 'Export', title: 'Export PNG (and GeoJSON if communes selected)' },
]

const BUFFER_RADIUS_M = 100

/**
 * Compact urbanisme / cadastre tools rail for Map View.
 */
export default function MapTools({
  map,
  mapReady,
  communeData,
  selectedCommunes,
  activeTool,
  onActiveToolChange,
  onInspectEnableChange,
  onStatus,
}) {
  const [readout, setReadout] = useState(null)
  const [cursorStatus, setCursorStatus] = useState({ lng: null, lat: null, zoom: 0, bearing: 0 })
  const [legacyOn, setLegacyOn] = useState(false)
  const [orthoOn, setOrthoOn] = useState(false)
  const [copied, setCopied] = useState(false)

  const pointsRef = useRef([])
  const activeToolRef = useRef(activeTool)
  const finishedRef = useRef(false)

  activeToolRef.current = activeTool

  const announce = useCallback(
    (msg) => {
      onStatus?.(msg)
    },
    [onStatus]
  )

  const resetSketch = useCallback(() => {
    pointsRef.current = []
    finishedRef.current = false
    if (map) clearToolsOverlay(map)
    setReadout(null)
  }, [map])

  const selectTool = useCallback(
    (id) => {
      if (id === activeTool) {
        onActiveToolChange('inspect')
        resetSketch()
        announce('Inspect')
        return
      }
      resetSketch()
      onActiveToolChange(id)
      const labels = {
        inspect: 'Inspect — click a feature',
        distance: 'Distance — click vertices, double-click to finish',
        area: 'Area — click vertices, double-click to close',
        coords: 'Coords — click the map',
        buffer: `Buffer — click a centre (${BUFFER_RADIUS_M} m)`,
      }
      announce(labels[id] || id)
    },
    [activeTool, announce, onActiveToolChange, resetSketch]
  )

  const runFit = useCallback(() => {
    if (!map) return
    const result = fitCommunes(map, communeData, selectedCommunes, maplibregl)
    if (result.ok) {
      announce(
        selectedCommunes?.length
          ? `Fitted ${result.count} commune(s)`
          : `Fitted all communes (${result.count})`
      )
    } else {
      announce(result.message || 'Fit failed')
    }
  }, [announce, communeData, map, selectedCommunes])

  const runExport = useCallback(() => {
    if (!map) return
    const pngOk = exportMapPng(map)
    const geoOk = exportSelectionGeoJson(communeData, selectedCommunes)
    if (pngOk && geoOk) announce('Exported PNG + commune GeoJSON')
    else if (pngOk) announce('Exported map PNG (select communes for GeoJSON)')
    else announce('Export failed')
  }, [announce, communeData, map, selectedCommunes])

  const copyCoords = useCallback(async () => {
    if (!readout?.lngLat) return
    const text = formatLngLat(readout.lngLat.lng, readout.lngLat.lat)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
      announce(`Copied ${text}`)
    } catch {
      announce('Copy failed')
    }
  }, [announce, readout])

  // Keep inspect interactions in sync with tool mode
  useEffect(() => {
    onInspectEnableChange?.(activeTool === 'inspect')
  }, [activeTool, onInspectEnableChange])

  const finishCurrentSketch = useCallback(() => {
    if (!map) return
    const toolNow = activeToolRef.current
    const pts = pointsRef.current
    if (toolNow === 'distance' && pts.length >= 2) {
      finishedRef.current = true
      const len = pathLengthMeters(pts)
      setToolsOverlayData(map, sketchCollection(pts, 'distance'))
      setReadout({
        kind: 'distance',
        text: formatDistance(len),
        detail: `${pts.length} vertices · ${len.toFixed(1)} m`,
      })
      announce(`Distance: ${formatDistance(len)}`)
      return
    }
    if (toolNow === 'area' && pts.length >= 3) {
      finishedRef.current = true
      const area = polygonAreaMeters2([pts])
      setToolsOverlayData(map, sketchCollection(pts, 'area', { closed: true }))
      setReadout({
        kind: 'area',
        text: formatArea(area),
        detail: `${pts.length} vertices · ${area.toFixed(1)} m²`,
      })
      announce(`Area: ${formatArea(area)}`)
    }
  }, [announce, map])

  // Esc cancels; Enter finishes measure sketch
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter') {
        if (activeToolRef.current === 'distance' || activeToolRef.current === 'area') {
          e.preventDefault()
          finishCurrentSketch()
        }
        return
      }
      if (e.key !== 'Escape') return
      if (activeToolRef.current !== 'inspect') {
        onActiveToolChange('inspect')
        resetSketch()
        announce('Cancelled — Inspect')
      } else if (pointsRef.current.length) {
        resetSketch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [announce, finishCurrentSketch, onActiveToolChange, resetSketch])

  // Cursor / zoom / bearing status strip
  useEffect(() => {
    if (!map || !mapReady) return

    const updateCamera = () => {
      setCursorStatus((s) => ({
        ...s,
        zoom: map.getZoom(),
        bearing: map.getBearing(),
      }))
    }

    const onMove = (e) => {
      const { lng, lat } = e.lngLat
      setCursorStatus({
        lng,
        lat,
        zoom: map.getZoom(),
        bearing: map.getBearing(),
      })
    }

    updateCamera()
    map.on('mousemove', onMove)
    map.on('move', updateCamera)
    map.on('zoom', updateCamera)
    map.on('rotate', updateCamera)

    return () => {
      map.off('mousemove', onMove)
      map.off('move', updateCamera)
      map.off('zoom', updateCamera)
      map.off('rotate', updateCamera)
    }
  }, [map, mapReady])

  // Re-ensure overlay after style swaps
  useEffect(() => {
    if (!map || !mapReady) return
    const onStyle = () => {
      ensureToolsOverlay(map)
      if (pointsRef.current.length && activeToolRef.current) {
        setToolsOverlayData(
          map,
          sketchCollection(pointsRef.current, activeToolRef.current)
        )
      }
    }
    map.on('style.load', onStyle)
    ensureToolsOverlay(map)
    return () => map.off('style.load', onStyle)
  }, [map, mapReady])

  // Tool click / draw handlers
  useEffect(() => {
    if (!map || !mapReady) return

    const tool = activeTool
    const canvas = map.getCanvas()

    const setCursor = (c) => {
      canvas.style.cursor = c
    }

    if (tool === 'inspect') {
      setCursor('')
      return () => {}
    }

    if (tool === 'distance' || tool === 'area' || tool === 'coords' || tool === 'buffer') {
      setCursor('crosshair')
    }

    const onClick = (e) => {
      const toolNow = activeToolRef.current
      const { lng, lat } = e.lngLat
      const pt = [lng, lat]

      if (toolNow === 'coords') {
        setReadout({
          kind: 'coords',
          text: formatLngLat(lng, lat),
          lngLat: { lng, lat },
          detail: 'Click Copy or select another tool',
        })
        setToolsOverlayData(map, {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { kind: 'coords' },
              geometry: { type: 'Point', coordinates: pt },
            },
          ],
        })
        announce(`Coords: ${formatLngLat(lng, lat)}`)
        return
      }

      if (toolNow === 'buffer') {
        const feature = bufferCirclePolygon(pt, BUFFER_RADIUS_M)
        setToolsOverlayData(map, {
          type: 'FeatureCollection',
          features: [
            feature,
            {
              type: 'Feature',
              properties: { kind: 'center' },
              geometry: { type: 'Point', coordinates: pt },
            },
          ],
        })
        setReadout({
          kind: 'buffer',
          text: `${BUFFER_RADIUS_M} m buffer`,
          detail: formatLngLat(lng, lat),
          lngLat: { lng, lat },
        })
        announce(`Buffer ${BUFFER_RADIUS_M} m @ ${formatLngLat(lng, lat)}`)
        return
      }

      if (toolNow === 'distance' || toolNow === 'area') {
        if (finishedRef.current) {
          pointsRef.current = []
          finishedRef.current = false
        }
        pointsRef.current = [...pointsRef.current, pt]
        const pts = pointsRef.current
        setToolsOverlayData(map, sketchCollection(pts, toolNow))

        if (toolNow === 'distance') {
          const len = pathLengthMeters(pts)
          setReadout({
            kind: 'distance',
            text: pts.length < 2 ? 'Click next point…' : formatDistance(len),
            detail: `${pts.length} pt · dbl-click to finish`,
          })
        } else {
          const area = pts.length >= 3 ? polygonAreaMeters2([pts]) : 0
          setReadout({
            kind: 'area',
            text: pts.length < 3 ? 'Need ≥3 points…' : formatArea(area),
            detail: `${pts.length} pt · dbl-click to close`,
          })
        }
      }
    }

    const onDblClick = (e) => {
      const toolNow = activeToolRef.current
      if (toolNow !== 'distance' && toolNow !== 'area') return
      e.preventDefault()
      // MapLibre fires click before dblclick — drop the last vertex added by that click
      if (pointsRef.current.length > (toolNow === 'area' ? 3 : 2)) {
        pointsRef.current = pointsRef.current.slice(0, -1)
      }
      finishCurrentSketch()
    }

    const onMove = (e) => {
      const toolNow = activeToolRef.current
      if (finishedRef.current) return
      if (toolNow !== 'distance' && toolNow !== 'area') return
      const pts = pointsRef.current
      if (!pts.length) return
      const preview = [...pts, [e.lngLat.lng, e.lngLat.lat]]
      setToolsOverlayData(map, sketchCollection(preview, toolNow))
      if (toolNow === 'distance' && preview.length >= 2) {
        setReadout({
          kind: 'distance',
          text: formatDistance(pathLengthMeters(preview)),
          detail: `${pts.length} pt · dbl-click to finish`,
        })
      } else if (toolNow === 'area' && preview.length >= 3) {
        setReadout({
          kind: 'area',
          text: formatArea(polygonAreaMeters2([preview])),
          detail: `${pts.length} pt · dbl-click to close`,
        })
      }
    }

    map.on('click', onClick)
    map.on('dblclick', onDblClick)
    map.on('mousemove', onMove)
    // Prevent zoom on double-click while measuring
    const prevDbl = map.doubleClickZoom?.isEnabled?.()
    if (tool === 'distance' || tool === 'area') {
      map.doubleClickZoom?.disable()
    }

    return () => {
      map.off('click', onClick)
      map.off('dblclick', onDblClick)
      map.off('mousemove', onMove)
      setCursor('')
      if (prevDbl) map.doubleClickZoom?.enable()
    }
  }, [activeTool, announce, finishCurrentSketch, map, mapReady])

  // Cleanup overlay on unmount
  useEffect(() => {
    return () => {
      if (map) clearToolsOverlay(map)
    }
  }, [map])

  const toggleLegacy = () => {
    if (!map) return
    const next = !legacyOn
    const ok = setLegacySheets(map, next)
    setLegacyOn(next && ok)
    announce(ok ? `Legacy sheets ${next ? 'on' : 'off'}` : 'Legacy sheets layer unavailable')
  }

  const toggleOrtho = () => {
    if (!map) return
    const next = !orthoOn
    const ok = setPlanningOrtho(map, next)
    setOrthoOn(next && ok)
    announce(ok ? `Planning ortho ${next ? 'on' : 'off'}` : 'Ortho layer unavailable')
  }

  return (
    <>
      <div className="map-tools" role="toolbar" aria-label="Map tools">
        <div className="map-tools-group">
          {MODE_TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`map-tools-btn ${activeTool === t.id ? 'is-active' : ''}`}
              title={t.title}
              aria-pressed={activeTool === t.id}
              onClick={() => selectTool(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="map-tools-sep" aria-hidden />
        <div className="map-tools-group">
          {ACTION_TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="map-tools-btn map-tools-btn--action"
              title={t.title}
              onClick={() => (t.id === 'fit' ? runFit() : runExport())}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="map-tools-sep" aria-hidden />
        <div className="map-tools-group">
          <button
            type="button"
            className={`map-tools-btn ${legacyOn ? 'is-active' : ''}`}
            title="Toggle legacy cadastral sheets"
            aria-pressed={legacyOn}
            onClick={toggleLegacy}
          >
            Sheets
          </button>
          <button
            type="button"
            className={`map-tools-btn ${orthoOn ? 'is-active' : ''}`}
            title="Toggle planning ortho"
            aria-pressed={orthoOn}
            onClick={toggleOrtho}
          >
            Ortho
          </button>
        </div>
      </div>

      {readout && (
        <div className="map-tools-readout">
          <div className="map-tools-readout-main">{readout.text}</div>
          {readout.detail && (
            <div className="map-tools-readout-detail">{readout.detail}</div>
          )}
          {readout.kind === 'coords' && (
            <button type="button" className="map-tools-copy" onClick={copyCoords}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
          {(activeTool === 'distance' || activeTool === 'area') && (
            <>
              <button
                type="button"
                className="map-tools-copy"
                onClick={finishCurrentSketch}
                title="Finish measurement (Enter)"
              >
                Done
              </button>
              <button
                type="button"
                className="map-tools-copy"
                onClick={() => {
                  resetSketch()
                  announce('Sketch cleared')
                }}
              >
                Clear
              </button>
            </>
          )}
        </div>
      )}

      <div className="map-tools-status" aria-live="polite">
        <span>
          {cursorStatus.lng != null
            ? formatLngLat(cursorStatus.lng, cursorStatus.lat, 5)
            : '—'}
        </span>
        <span>z {cursorStatus.zoom.toFixed(2)}</span>
        <span>brg {((cursorStatus.bearing % 360) + 360) % 360 | 0}°</span>
        <span className="map-tools-status-tool">{activeTool}</span>
      </div>
    </>
  )
}
