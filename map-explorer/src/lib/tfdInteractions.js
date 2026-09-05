/**
 * TFD MapLibre interactivity — adapted for both MVT (`tfd-vector`) and
 * GeoJSON demo sources (`tfd-geo:*`).
 */

function parcelSourceSpec(map) {
  if (map.getSource('tfd-vector')) {
    return { source: 'tfd-vector', sourceLayer: 'parcels' }
  }
  if (map.getSource('tfd-geo:parcels')) {
    return { source: 'tfd-geo:parcels' }
  }
  return null
}

function featureStateId(spec, id) {
  return spec.sourceLayer
    ? { source: spec.source, sourceLayer: spec.sourceLayer, id }
    : { source: spec.source, id }
}

export function installTFDInteractions(
  map,
  { onInspect = () => {}, isInspectEnabled = () => true } = {}
) {
  let hoveredParcelId = null
  let selectedParcelId = null

  const clearHover = () => {
    const spec = parcelSourceSpec(map)
    if (hoveredParcelId !== null && spec && map.getSource(spec.source)) {
      try {
        map.setFeatureState(featureStateId(spec, hoveredParcelId), { hover: false })
      } catch {
        /* style swap mid-hover */
      }
      hoveredParcelId = null
    }
  }

  const onParcelMove = (e) => {
    if (!isInspectEnabled()) return
    if (!map.getLayer('parcels-fill')) return
    const features = map.queryRenderedFeatures(e.point, { layers: ['parcels-fill'] })
    const feature = features[0]
    const spec = parcelSourceSpec(map)
    if (!feature || feature.id == null || !spec) {
      clearHover()
      map.getCanvas().style.cursor = ''
      return
    }
    if (hoveredParcelId !== feature.id) {
      clearHover()
      hoveredParcelId = feature.id
      map.setFeatureState(featureStateId(spec, hoveredParcelId), { hover: true })
    }
    map.getCanvas().style.cursor = 'pointer'
  }

  if (map.getLayer('parcels-fill')) {
    map.on('mousemove', 'parcels-fill', onParcelMove)
    map.on('mouseleave', 'parcels-fill', () => {
      clearHover()
      if (isInspectEnabled()) map.getCanvas().style.cursor = ''
    })
    map.on('click', 'parcels-fill', (e) => {
      if (!isInspectEnabled()) return
      const feature = e.features?.[0]
      const spec = parcelSourceSpec(map)
      if (!feature || feature.id == null || !spec) return
      if (selectedParcelId !== null) {
        try {
          map.setFeatureState(featureStateId(spec, selectedParcelId), { selected: false })
        } catch {
          /* ignore */
        }
      }
      selectedParcelId = feature.id
      map.setFeatureState(featureStateId(spec, selectedParcelId), { selected: true })
      onInspect({ group: 'parcels', feature, lngLat: e.lngLat })
    })
  }

  const inspectLayers = [
    'commune-fill',
    'admin-commune-boundary',
    'parcel-boundaries',
    'buildings-footprint',
    'addresses-points',
    'rights-holders-marker',
    'land-title-status',
    'encumbrances-fill',
    'locality-polygons',
    'streets-line',
    'zoning-fill',
  ].filter((id) => map.getLayer(id))

  const onLayerClick = (e) => {
    if (!isInspectEnabled()) return
    const feature = e.features?.[0]
    if (feature) onInspect({ layerId: e.features[0].layer?.id, feature, lngLat: e.lngLat })
  }

  for (const id of inspectLayers) {
    map.on('click', id, onLayerClick)
  }

  return () => {
    clearHover()
    const spec = parcelSourceSpec(map)
    if (selectedParcelId !== null && spec) {
      try {
        map.setFeatureState(featureStateId(spec, selectedParcelId), { selected: false })
      } catch {
        /* ignore */
      }
    }
  }
}

export function setTFD3DBuildings(map, enabled) {
  if (map.getLayer('buildings-3d')) {
    map.setLayoutProperty('buildings-3d', 'visibility', enabled ? 'visible' : 'none')
  }
}

export function setLegacySheets(map, enabled) {
  if (map.getLayer('legacy-sheets-raster')) {
    map.setLayoutProperty('legacy-sheets-raster', 'visibility', enabled ? 'visible' : 'none')
    return true
  }
  return false
}
