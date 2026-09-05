// TFD MapLibre interactivity hooks
// Requires vector features to expose promoted IDs as configured in style.json.
export function installTFDInteractions(map, { onInspect = console.log } = {}) {
  let hoveredParcelId = null;
  let selectedParcelId = null;
  const source = 'tfd-vector';
  const sourceLayer = 'parcels';

  const clearHover = () => {
    if (hoveredParcelId !== null) {
      map.setFeatureState({ source, sourceLayer, id: hoveredParcelId }, { hover: false });
      hoveredParcelId = null;
    }
  };

  const onMove = (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['parcels-fill'] });
    const feature = features[0];
    if (!feature || feature.id == null) {
      clearHover();
      map.getCanvas().style.cursor = '';
      return;
    }
    if (hoveredParcelId !== feature.id) {
      clearHover();
      hoveredParcelId = feature.id;
      map.setFeatureState({ source, sourceLayer, id: hoveredParcelId }, { hover: true });
    }
    map.getCanvas().style.cursor = 'pointer';
  };

  map.on('mousemove', 'parcels-fill', onMove);
  map.on('mouseleave', 'parcels-fill', () => { clearHover(); map.getCanvas().style.cursor = ''; });

  map.on('click', 'parcels-fill', (e) => {
    const feature = e.features?.[0];
    if (!feature || feature.id == null) return;
    if (selectedParcelId !== null) {
      map.setFeatureState({ source, sourceLayer, id: selectedParcelId }, { selected: false });
    }
    selectedParcelId = feature.id;
    map.setFeatureState({ source, sourceLayer, id: selectedParcelId }, { selected: true });
    onInspect({ group: 'parcels', feature, lngLat: e.lngLat });
  });

  // Generic inspector hooks. Add/remove layer IDs here as your app permissions allow.
  const inspectLayers = [
    'parcel-boundaries','buildings-footprint','addresses-points','rights-holders-marker',
    'land-title-status','encumbrances-fill','locality-polygons','streets-line'
  ];
  for (const id of inspectLayers) {
    map.on('click', id, (e) => {
      const feature = e.features?.[0];
      if (feature) onInspect({ layerId: id, feature, lngLat: e.lngLat });
    });
  }

  return () => {
    clearHover();
    if (selectedParcelId !== null) {
      map.setFeatureState({ source, sourceLayer, id: selectedParcelId }, { selected: false });
    }
  };
}

export function setTFDTheme(map, styleUrl) {
  map.setStyle(styleUrl, { diff: true });
}

export function setTFD3DBuildings(map, enabled) {
  if (map.getLayer('buildings-3d')) map.setLayoutProperty('buildings-3d', 'visibility', enabled ? 'visible' : 'none');
}

export function setLegacySheets(map, enabled) {
  if (map.getLayer('legacy-sheets-raster')) map.setLayoutProperty('legacy-sheets-raster', 'visibility', enabled ? 'visible' : 'none');
}
