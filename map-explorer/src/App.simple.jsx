import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import './App.css'

export default function App() {
  const mapContainer = useRef(null)
  const map = useRef(null)

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    console.log('Creating map...')
    
    const style = {
      version: 8,
      name: 'TFD Simple',
      center: [1.2, 7.4],
      zoom: 6,
      sources: {
        basemap: {
          type: 'vector',
          url: 'https://tiles.openfreemap.org/planet'
        }
      },
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: { 'background-color': '#e8e0d5' }
        }
      ]
    }

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: style,
      center: [1.2, 7.4],
      zoom: 6,
      maxBounds: [-0.15, 5.85, 2.75, 11.0]
    })

    map.current.on('load', () => {
      console.log('✅ Map loaded!')
    })

    map.current.on('error', (e) => {
      console.error('Map error:', e)
    })

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        background: 'white',
        padding: '8px 16px',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        fontSize: '12px'
      }}>
        Togo Map
      </div>
    </div>
  )
}
