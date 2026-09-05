/** Commune multi-select helpers for MapLibre paint expressions. */

export function communeLabel(featureOrProps) {
  const p = featureOrProps?.properties || featureOrProps || {}
  return p.display_name || p.canonical_name || p.official_code || 'Commune'
}

export function communeCode(featureOrProps) {
  const p = featureOrProps?.properties || featureOrProps || {}
  return p.official_code || p.canonical_id || p.official_fid || null
}

/**
 * Build paint case expressions that emphasize selected communes and dim others.
 * Empty selection → all communes use the "all" (normal) values.
 */
export function communeEmphasisPaint(selectedCodes, {
  activeColor,
  dimColor = '#9AA3AD',
  activeOpacity = 0.42,
  dimOpacity = 0.07,
  allOpacity = 0.35,
  activeLineWidth = 2.2,
  dimLineWidth = 0.6,
  allLineWidth = 1.5,
} = {}) {
  const codes = Array.isArray(selectedCodes) ? selectedCodes.filter(Boolean) : []
  const hasFilter = codes.length > 0

  if (!hasFilter) {
    return {
      fillColor: activeColor,
      fillOpacity: allOpacity,
      lineColor: activeColor,
      lineWidth: allLineWidth,
      labelOpacity: 1,
    }
  }

  const selected = ['in', ['get', 'official_code'], ['literal', codes]]

  return {
    fillColor: ['case', selected, activeColor, dimColor],
    fillOpacity: ['case', selected, activeOpacity, dimOpacity],
    lineColor: ['case', selected, activeColor, dimColor],
    lineWidth: ['case', selected, activeLineWidth, dimLineWidth],
    labelOpacity: ['case', selected, 1, 0.25],
  }
}

export function applyCommuneFilterToMap(map, selectedCodes, themeColors) {
  if (!map?.getLayer?.('commune-fill')) return
  const codes = (selectedCodes || []).filter(Boolean)
  const activeFill = themeColors.fill || '#DCE6E0'
  const activeLine = themeColors.line || '#046C54'
  const dim = themeColors.dimFill || '#9AA3AD'
  const allOpacity = themeColors.fillOpacity ?? 0.35
  const allWidth = themeColors.lineWidth || 1.5

  if (!codes.length) {
    map.setPaintProperty('commune-fill', 'fill-color', activeFill)
    map.setPaintProperty('commune-fill', 'fill-opacity', allOpacity)
    if (map.getLayer('commune-line')) {
      map.setPaintProperty('commune-line', 'line-color', activeLine)
      map.setPaintProperty('commune-line', 'line-width', allWidth)
    }
    if (map.getLayer('commune-labels')) {
      map.setPaintProperty('commune-labels', 'text-opacity', 1)
    }
    return
  }

  const selected = ['in', ['get', 'official_code'], ['literal', codes]]
  map.setPaintProperty('commune-fill', 'fill-color', ['case', selected, activeFill, dim])
  map.setPaintProperty('commune-fill', 'fill-opacity', ['case', selected, Math.max(allOpacity, 0.42), 0.06])
  if (map.getLayer('commune-line')) {
    map.setPaintProperty('commune-line', 'line-color', ['case', selected, activeLine, dim])
    map.setPaintProperty('commune-line', 'line-width', ['case', selected, allWidth + 0.9, 0.55])
  }
  if (map.getLayer('commune-labels')) {
    map.setPaintProperty('commune-labels', 'text-opacity', ['case', selected, 1, 0.22])
  }
}
