/**
 * TFD Cadastre – Print / Export Mode Helper
 * Toggles high-contrast black outlines + labels for clean PDF / print output.
 */

const PRINT_LAYERS = [
  'print-admin-outline',
  'print-parcels-outline',
  'print-buildings-outline',
  'print-labels-high-contrast'
];

const LAYERS_TO_HIDE_IN_PRINT = [
  'buildings-3d',
  'owners-points',
  'encumbrances',
  'encumbrances-outline',
  'streets-casing'
];

/**
 * Enable print/export mode
 * @param {maplibregl.Map} map
 */
export function enablePrintMode(map) {
  // Show high-contrast print layers
  PRINT_LAYERS.forEach(id => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', 'visible');
    }
  });

  // Hide decorative / 3D layers
  LAYERS_TO_HIDE_IN_PRINT.forEach(id => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', 'none');
    }
  });

  // Optional: force flat view
  map.easeTo({ pitch: 0, bearing: 0, duration: 400 });

  // Optional: increase label sizes slightly for print
  if (map.getLayer('addresses')) {
    map.setLayoutProperty('addresses', 'text-size', 14);
  }
  if (map.getLayer('streets-labels')) {
    map.setLayoutProperty('streets-labels', 'text-size', 13);
  }

  console.info('[TFD] Print / Export mode enabled');
}

/**
 * Disable print/export mode – restore normal theme
 * @param {maplibregl.Map} map
 */
export function disablePrintMode(map) {
  PRINT_LAYERS.forEach(id => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', 'none');
    }
  });

  // Restore default visibility (you may want to store previous state)
  if (map.getLayer('buildings-fill')) {
    map.setLayoutProperty('buildings-fill', 'visibility', 'visible');
  }
  if (map.getLayer('owners-points')) {
    map.setLayoutProperty('owners-points', 'visibility', 'visible');
  }
  if (map.getLayer('encumbrances')) {
    map.setLayoutProperty('encumbrances', 'visibility', 'visible');
  }
  if (map.getLayer('encumbrances-outline')) {
    map.setLayoutProperty('encumbrances-outline', 'visibility', 'visible');
  }
  if (map.getLayer('streets-casing')) {
    map.setLayoutProperty('streets-casing', 'visibility', 'visible');
  }

  // Reset label sizes
  if (map.getLayer('addresses')) {
    map.setLayoutProperty('addresses', 'text-size', [
      'interpolate', ['linear'], ['zoom'],
      16, 11,
      19, 14
    ]);
  }

  console.info('[TFD] Print / Export mode disabled');
}

/**
 * Capture current map view as PNG data URL (for PDF export)
 * @param {maplibregl.Map} map
 * @returns {string} data URL
 */
export function captureMapImage(map) {
  return map.getCanvas().toDataURL('image/png');
}
