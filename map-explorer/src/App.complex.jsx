import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import MapControls from './components/MapControls'
import ThemePanel from './components/ThemePanel'
import LayerInspector from './components/LayerInspector'
import LayerExplorer from './components/LayerExplorer'
import './App.css'

// Build proper vector tile style with OpenFreemap as fallback
// Load commune boundaries from GeoJSON
const loadCommuneData = async () => {
  try {
    const response = await fetch('/data/communes.geojson')
    if (!response.ok) throw new Error('Failed to load communes data')
    return await response.json()
  } catch (e) {
    console.warn('Communes data not loaded:', e.message)
    return { type: 'FeatureCollection', features: [] }
  }
}

// Togo geographic bounds [minLng, minLat, maxLng, maxLat]
const TOGO_BOUNDS = [-0.15, 5.85, 2.75, 11.0]

// Load theme as-is, add basemap fallback and real commune data
const loadAndPrepareTheme = async (theme, communeData) => {
  try {
    const response = await fetch(`/themes/tfd-maplibre-style-${theme}.json`)
    if (!response.ok) throw new Error(`Failed to load theme`)
    
    const style = await response.json()
    
    // Add basemap source
    if (!style.sources) style.sources = {}
    style.sources.basemap = {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet'
    }
    
    // Add commune boundary source with real data
    style.sources['tfd-boundary-commune'] = {
      type: 'geojson',
      data: communeData
    }
    
    // Insert basemap layers at start
    if (!style.layers) style.layers = []
    
    const baseMapLayers = [
      {
        id: 'osm-background',
        type: 'background',
        paint: { 'background-color': theme === 'light' ? '#D5DFD9' : '#0C100E' }
      }
    ]
    
    // Filter and prepend basemap background only
    style.layers = style.layers.filter(l => !l.id?.startsWith('osm-') && l.id !== 'background')
    style.layers = [...baseMapLayers, ...style.layers]
    
    console.log(`Theme loaded: ${theme}, layers: ${style.layers.length}, communes: ${communeData.features?.length || 0}`)
    return style
  } catch (e) {
    console.warn(`Theme load failed for ${theme}:`, e.message)
    
    // Minimal fallback
    return {
      version: 8,
      name: `TFD — ${theme}`,
      center: [1.2, 7.4],
      zoom: 6,
      bearing: 0,
      pitch: 0,
      glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
      sources: {
        basemap: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
        'tfd-boundary-commune': { type: 'geojson', data: communeData }
      },
      layers: [
        {
          id: 'osm-background',
          type: 'background',
          paint: { 'background-color': theme === 'light' ? '#D5DFD9' : '#0C100E' }
        },
        {
          id: 'commune-fill',
          type: 'fill',
          source: 'tfd-boundary-commune',
          paint: { 'fill-color': theme === 'light' ? '#DCE6E0' : '#111713', 'fill-opacity': 0.3 }
        },
        {
          id: 'commune-line',
          type: 'line',
          source: 'tfd-boundary-commune',
          paint: { 'line-color': theme === 'light' ? '#046C54' : '#5BB89A', 'line-width': 1.5 }
        }
      ]
    }
  }
}

export default function App() {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const [communeData, setCommuneData] = useState({ type: 'FeatureCollection', features: [] })
  const [currentTheme, setCurrentTheme] = useState('light')
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [selectedFeature, setSelectedFeature] = useState(null)
  const [visibleLayers, setVisibleLayers] = useState({})

  // Load commune data on mount
  useEffect(() => {
    loadCommuneData().then((data) => {
      console.log('✅ Communes loaded:', data?.features?.length || 0, 'features')
      setCommuneData(data)
    }).catch(e => {
      console.error('❌ Failed to load communes:', e)
      setCommuneData({ type: 'FeatureCollection', features: [] })
    })
  }, [])

  useEffect(() => {
    if (!mapContainer.current || map.current || !communeData) {
      console.log('⏸️ Map init waiting - container:', !!mapContainer.current, 'map exists:', !!map.current, 'communes:', !!communeData)
      return
    }

    const initMap = async () => {
      try {
        console.log('🚀 Starting map initialization...')
        const style = await loadAndPrepareTheme(currentTheme, communeData)
        console.log('📋 Theme loaded, sources:', Object.keys(style.sources || {}).length)
        
        map.current = new maplibregl.Map({
          container: mapContainer.current,
          style: style,
          center: [1.2, 7.4],
          zoom: 6,
          maxBounds: TOGO_BOUNDS,
          minZoom: 5,
          maxZoom: 18
        })
        console.log('🗺️ Map created')

        map.current.on('load', () => {
          console.log('✨ Map loaded event fired')
          map.current.fitBounds(TOGO_BOUNDS, { padding: 40, duration: 800 })
          initializeLayerVisibility()
          addMapInteractions()
        })

        map.current.on('error', (e) => {
          console.error('❌ Map error:', e)
        })
      } catch (e) {
        console.error('❌ Map init error:', e)
      }
    }

    initMap()

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [communeData])

  // Update style when theme changes
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded() || !communeData) return
    
    const switchTheme = async () => {
      try {
        const newStyle = await loadAndPrepareTheme(currentTheme, communeData)
        map.current.setStyle(newStyle)
      } catch (e) {
        console.error('Theme switch error:', e)
      }
    }

    switchTheme()
  }, [currentTheme, communeData])

  const initializeLayerVisibility = () => {
    if (!map.current) return
    const style = map.current.getStyle()
    const layers = style && style.layers ? style.layers : []
    
    const visibility = {}
    layers.forEach(layer => {
      if (layer && layer.id) {
        try {
          const vis = map.current.getLayoutProperty(layer.id, 'visibility')
          visibility[layer.id] = vis !== 'none'
        } catch (e) {
          // Layer might not exist yet
          visibility[layer.id] = true
        }
      }
    })
    setVisibleLayers(visibility)
    console.log('Layers initialized:', Object.keys(visibility).length)
  }

  const addMapInteractions = () => {
    map.current.on('click', (e) => {
      const features = map.current.queryRenderedFeatures({ point: e.point })
      if (features.length > 0) {
        setSelectedFeature(features[0])
      }
    })

    map.current.on('mousemove', (e) => {
      const features = map.current.queryRenderedFeatures({ point: e.point })
      map.current.getCanvas().style.cursor = features.length > 0 ? 'pointer' : ''
    })
  }

  const toggleLayer = (layerId) => {
    const visibility = map.current.getLayoutProperty(layerId, 'visibility')
    map.current.setLayoutProperty(
      layerId,
      'visibility',
      visibility === 'none' ? 'visible' : 'none'
    )
    setVisibleLayers(prev => ({
      ...prev,
      [layerId]: visibility === 'none'
    }))
  }

  const toggleTheme = () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light'
    console.log('Switching theme to:', newTheme)
    setCurrentTheme(newTheme)
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0d1014' }}>
      {/* Debug Info Bar */}
      <div style={{
        padding: '12px 16px',
        background: '#111318',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        gap: '8px',
        zIndex: 1000,
        alignItems: 'center',
        fontSize: '11px',
        color: '#8891a4'
      }}>
        <div>🗺️ Map View</div>
        <div style={{ marginLeft: 'auto' }}>
          Communes: {communeData?.features?.length || '⏳'} | Theme: {currentTheme} | Panel: {isPanelOpen ? 'YES' : 'NO'}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div className="app">
          <div ref={mapContainer} className="map-container" />
          
          <div className="controls-top-left">
            <MapControls 
              onThemeToggle={toggleTheme} 
              currentTheme={currentTheme}
              onTogglePanel={() => setIsPanelOpen(true)}
            />
          </div>

          {isPanelOpen && (
            <div className="sidebar">
              <ThemePanel 
                currentTheme={currentTheme}
                onThemeChange={setCurrentTheme}
              />
              
              {selectedFeature && (
                <LayerInspector 
                  feature={selectedFeature}
                  onClose={() => setSelectedFeature(null)}
                />
              )}

              <div className="panel">
                <h2>📍 Togo Cadastre Map</h2>
                <p>Explore the TFD MapLibre basemaps with custom styling for cadastral data.</p>
                
                <h3>🎨 Available Layers</h3>
                <div className="layers-list">
                  {Object.entries(visibleLayers).map(([layerId, isVisible]) => (
                    <div 
                      key={layerId} 
                      className={`layer-item ${isVisible ? 'visible' : ''}`}
                      onClick={() => toggleLayer(layerId)}
                    >
                      <span className="toggle-switch" style={{marginRight: '8px'}}></span>
                      {layerId}
                    </div>
                  ))}
                </div>

                <h3>📊 Map Info</h3>
                <div className="stats">
                  <div className="stat-box">
                    <div className="value">{currentTheme === 'light' ? '☀️' : '🌙'}</div>
                    <div className="label">Theme</div>
                  </div>
                  <div className="stat-box">
                    <div className="value">🇹🇬</div>
                    <div className="label">Togo</div>
                  </div>
                  <div className="stat-box">
                    <div className="value">z6</div>
                    <div className="label">Zoom</div>
                  </div>
                  <div className="stat-box">
                    <div className="value">MVT</div>
                    <div className="label">Tiles</div>
                  </div>
                </div>

                <h3>ℹ️ Quick Reference</h3>
                <p><strong>Cadastre Theme:</strong> Optimized for land parcel visualization</p>
                <p><strong>Light/Dark:</strong> Toggle between themes for different lighting</p>
                <p><strong>Zoom Levels:</strong> 1-22 with detail layers at z10+</p>
                <p><strong>MVT Protocol:</strong> Vector tiles for fast rendering</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
