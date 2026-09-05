import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import MapControls from './components/MapControls'
import MapTools from './components/MapTools'
import ThemePanel from './components/ThemePanel'
import LayerInspector from './components/LayerInspector'
import LayerExplorer from './components/LayerExplorer'
import CommuneFilter from './components/CommuneFilter'
import { applyCommuneFilterToMap } from './lib/communeFilter'
import { prepareTfdStyle, getTileHost, themeIsDemo } from './lib/prepareTheme'
import { installTFDInteractions, setTFD3DBuildings } from './lib/tfdInteractions'
import { ensureToolsOverlay } from './lib/mapTools'
import './App.css'

const TOGO_BOUNDS = [
  [-0.15, 5.85],
  [2.75, 11.0],
]

const THEME_COLORS = {
  light: {
    fill: '#E4EBE4',
    fillOpacity: 0.35,
    line: '#046C54',
    lineWidth: 1.5,
    label: '#0a3d32',
    dimFill: '#B5B9BD',
  },
  dark: {
    fill: '#1A2420',
    fillOpacity: 0.4,
    line: '#5BB89A',
    lineWidth: 1.5,
    label: '#a8e6d4',
    dimFill: '#3A4046',
  },
}

async function loadCommuneData() {
  const response = await fetch('/data/communes.geojson')
  if (!response.ok) throw new Error(`Communes HTTP ${response.status}`)
  return response.json()
}

export default function App() {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const cleanupInteractions = useRef(() => {})
  const themeInitialized = useRef(false)
  const selectedCommunesRef = useRef([])
  const [view, setView] = useState('map')
  const [communeData, setCommuneData] = useState(null)
  const [currentTheme, setCurrentTheme] = useState('light')
  const [isPanelOpen, setIsPanelOpen] = useState(true)
  const [selectedFeature, setSelectedFeature] = useState(null)
  const [mapReady, setMapReady] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('Loading…')
  const [selectedCommunes, setSelectedCommunes] = useState([])
  const [buildings3d, setBuildings3d] = useState(false)
  const [runtimeMode, setRuntimeMode] = useState('…')
  const [isDemo, setIsDemo] = useState(true)
  const [activeTool, setActiveTool] = useState('inspect')
  const [toolHint, setToolHint] = useState('')
  const skipThemeEffect = useRef(true)
  const inspectEnabledRef = useRef(true)

  selectedCommunesRef.current = selectedCommunes

  useEffect(() => {
    loadCommuneData()
      .then((data) => {
        setCommuneData(data)
        setStatus(`${data.features?.length || 0} communes`)
      })
      .catch((e) => {
        console.error('Communes load failed:', e)
        setCommuneData({ type: 'FeatureCollection', features: [] })
        setStatus('Communes unavailable')
      })
  }, [])

  const wireMapChrome = useCallback((mapInstance, style) => {
    cleanupInteractions.current?.()
    cleanupInteractions.current = installTFDInteractions(mapInstance, {
      isInspectEnabled: () => inspectEnabledRef.current,
      onInspect: ({ feature, layerId, group }) => {
        if (!feature) return
        setSelectedFeature({
          ...feature,
          sourceLayer: feature.sourceLayer || group || layerId || 'tfd',
        })
        setIsPanelOpen(true)
        setActiveTool('inspect')
      },
    })
    applyCommuneFilterToMap(
      mapInstance,
      selectedCommunesRef.current,
      THEME_COLORS[currentTheme] || THEME_COLORS.light
    )
    ensureToolsOverlay(mapInstance)
    const demo = themeIsDemo(style)
    setIsDemo(demo)
    setRuntimeMode(demo ? 'theme · demo GeoJSON' : `theme · ${getTileHost()}`)
  }, [currentTheme])

  // Initialize map with prepared TFD theme
  useEffect(() => {
    if (view !== 'map' || !mapContainer.current || map.current) return

    let cancelled = false

    const boot = async () => {
      try {
        setStatus((s) => (s.includes('communes') ? s : 'Preparing TFD theme…'))
        const style = await prepareTfdStyle(currentTheme, { communes: communeData })
        if (cancelled || !mapContainer.current) return

        map.current = new maplibregl.Map({
          container: mapContainer.current,
          style,
          center: style.center || [1.2, 8.6],
          zoom: style.zoom || 6.2,
          maxBounds: [
            [TOGO_BOUNDS[0][0] - 0.5, TOGO_BOUNDS[0][1] - 0.5],
            [TOGO_BOUNDS[1][0] + 0.5, TOGO_BOUNDS[1][1] + 0.5],
          ],
          minZoom: 5,
          maxZoom: 18,
        })

        map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
        map.current.addControl(new maplibregl.ScaleControl({ maxWidth: 120 }), 'bottom-left')

        map.current.on('load', () => {
          if (cancelled) return
          setMapReady(true)
          setError(null)
          map.current.fitBounds(TOGO_BOUNDS, { padding: 48, duration: 600 })
          wireMapChrome(map.current, style)
          themeInitialized.current = true
        })

        map.current.on('error', (e) => {
          const raw = e?.error?.message || e?.message || e?.error || 'Map error'
          const msg = typeof raw === 'string' ? raw : JSON.stringify(raw)
          // Tile misses / missing demo layers / headless WebGL noise
          if (/404|Failed to fetch|WebGL|webglcontextcreationerror/i.test(msg)) return
          console.error('MapLibre error:', e)
          setError(msg.slice(0, 160))
        })
      } catch (e) {
        console.error(e)
        if (!cancelled) setError(e.message || 'Theme load failed')
      }
    }

    boot()

    return () => {
      cancelled = true
      cleanupInteractions.current?.()
      cleanupInteractions.current = () => {}
      map.current?.remove()
      map.current = null
      setMapReady(false)
      themeInitialized.current = false
      skipThemeEffect.current = true
    }
    // Remount when returning to map view; theme swaps handled separately
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  // When communes arrive after first paint in demo mode, refresh admin source
  useEffect(() => {
    if (!map.current || !mapReady || !communeData?.features?.length || !isDemo) return
    prepareTfdStyle(currentTheme, { communes: communeData }).then((style) => {
      const admin = style.sources?.['tfd-geo:admin_units']?.data
      if (admin && map.current?.getSource('tfd-geo:admin_units')) {
        map.current.getSource('tfd-geo:admin_units').setData(admin)
        applyCommuneFilterToMap(
          map.current,
          selectedCommunesRef.current,
          THEME_COLORS[currentTheme] || THEME_COLORS.light
        )
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communeData, mapReady, isDemo])

  // Dim non-selected communes
  useEffect(() => {
    if (!map.current || !mapReady || !map.current.getLayer('commune-fill')) return
    applyCommuneFilterToMap(
      map.current,
      selectedCommunes,
      THEME_COLORS[currentTheme] || THEME_COLORS.light
    )
  }, [selectedCommunes, mapReady, currentTheme])

  // Theme switch: load opposite TFD style (skip initial mount)
  useEffect(() => {
    if (!map.current || !mapReady) return
    if (skipThemeEffect.current) {
      skipThemeEffect.current = false
      return
    }

    let cancelled = false
    const mapInstance = map.current

    const switchTheme = async () => {
      try {
        const style = await prepareTfdStyle(currentTheme, { communes: communeData })
        if (cancelled || !map.current) return
        mapInstance.once('style.load', () => {
          if (cancelled) return
          wireMapChrome(mapInstance, style)
          setTFD3DBuildings(mapInstance, buildings3d)
        })
        mapInstance.setStyle(style)
      } catch (e) {
        console.error('Theme switch failed:', e)
        setError(e.message)
      }
    }

    switchTheme()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTheme])

  useEffect(() => {
    if (!map.current || !mapReady) return
    setTFD3DBuildings(map.current, buildings3d)
  }, [buildings3d, mapReady])

  const toggleTheme = () => {
    setCurrentTheme((t) => (t === 'light' ? 'dark' : 'light'))
  }

  if (view === 'layers') {
    return (
      <div className="app-shell app-shell--explorer">
        <header className="app-header">
          <div className="app-brand">TFD MapLibre Explorer</div>
          <nav className="app-nav">
            <button type="button" className="nav-btn" onClick={() => setView('map')}>
              Map View
            </button>
            <button type="button" className="nav-btn active" onClick={() => setView('layers')}>
              Layer Explorer
            </button>
          </nav>
          <div className="app-status">{status}</div>
        </header>
        <LayerExplorer
          communeData={communeData}
          selectedCommunes={selectedCommunes}
          onSelectedCommunesChange={setSelectedCommunes}
        />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">TFD MapLibre Explorer</div>
        <nav className="app-nav">
          <button type="button" className="nav-btn active" onClick={() => setView('map')}>
            Map View
          </button>
          <button type="button" className="nav-btn" onClick={() => setView('layers')}>
            Layer Explorer
          </button>
        </nav>
        <div className="app-status">
          {status} · {currentTheme} · {runtimeMode}
          {toolHint ? ` · ${toolHint}` : ''}
          {error ? ` · ⚠ ${error}` : ''}
        </div>
      </header>

      <div className="app">
        <div ref={mapContainer} className="map-container" />

        <div className="controls-top-left">
          <MapControls
            onThemeToggle={toggleTheme}
            currentTheme={currentTheme}
            onTogglePanel={() => setIsPanelOpen((open) => !open)}
            buildings3d={buildings3d}
            onToggle3d={() => setBuildings3d((v) => !v)}
          />
        </div>

        {mapReady && (
          <MapTools
            map={map.current}
            mapReady={mapReady}
            communeData={communeData}
            selectedCommunes={selectedCommunes}
            activeTool={activeTool}
            onActiveToolChange={setActiveTool}
            onInspectEnableChange={(enabled) => {
              inspectEnabledRef.current = enabled
            }}
            onStatus={setToolHint}
          />
        )}

        {communeData && (
          <CommuneFilter
            communes={communeData}
            selectedCodes={selectedCommunes}
            onChange={setSelectedCommunes}
            compact
          />
        )}

        {!mapReady && (
          <div className="map-loading">Loading TFD theme…</div>
        )}

        {isPanelOpen && (
          <div className="sidebar">
            <ThemePanel currentTheme={currentTheme} onThemeChange={setCurrentTheme} />

            {selectedFeature && (
              <LayerInspector
                feature={selectedFeature}
                onClose={() => setSelectedFeature(null)}
              />
            )}

            <div className="panel">
              <h2>TFD Cadastre Theme</h2>
              <p>
                Map View loads the real <code>tfd-maplibre-style-{currentTheme}.json</code>
                {getTileHost()
                  ? <> against <code>{getTileHost()}</code> MVT tiles.</>
                  : <> in demo mode (local GeoJSON + theme paints). Set <code>VITE_TILE_HOST</code> for production tiles.</>}
              </p>

              <h3>Map Info</h3>
              <div className="stats">
                <div className="stat-box">
                  <div className="value">{communeData?.features?.length ?? '—'}</div>
                  <div className="label">Communes</div>
                </div>
                <div className="stat-box">
                  <div className="value">{currentTheme === 'light' ? 'Light' : 'Dark'}</div>
                  <div className="label">Theme</div>
                </div>
                <div className="stat-box">
                  <div className="value">{isDemo ? 'Demo' : 'MVT'}</div>
                  <div className="label">Runtime</div>
                </div>
                <div className="stat-box">
                  <div className="value">{buildings3d ? 'On' : 'Off'}</div>
                  <div className="label">3D bldg</div>
                </div>
              </div>

              <h3>Tools</h3>
              <p><strong>Inspect</strong> click features → inspector. <strong>Distance / Area</strong> sketch measure. <strong>Coords</strong> lon/lat. <strong>Fit</strong> zooms to communes. <strong>Export</strong> PNG (+ GeoJSON if selected).</p>
              <p><kbd>Esc</kbd> cancels the active tool.</p>

              <h3>Quick Reference</h3>
              <p><strong>Theme toggle</strong> swaps light/dark cadastre styles.</p>
              <p><strong>Communes</strong> filter dims non-selected units.</p>
              <p><strong>Layer Explorer</strong> documents the full 47-layer stack.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
