/**
 * Classic Tefedila / t_addr map theme swatches.
 * Extracted from t_addr/src/product/lib/mapStyles.ts (LIGHT) and
 * t_addr/src/styles/theme.css brand tokens — for Layer Explorer legend reuse.
 */

/** Full light MapLibre palette from t_addr mapStyles. */
export const T_ADDR_MAP_PALETTE_LIGHT = {
  background: '#D5DFD9',
  land: '#DCE6E0',
  residential: '#D3DED7',
  commercial: '#E0D7CF',
  industrial: '#D5D6D0',
  school: '#E4DCC0',
  hospital: '#E5CFCF',
  cemetery: '#C9D9CE',
  wood: '#AFC9B8',
  grass: '#C2D8C4',
  farmland: '#CDD6B8',
  sand: '#DFD0A8',
  park: '#B8D4BC',
  water: '#9CC9D6',
  waterLine: '#6FAEBF',
  building: '#C5CBC5',
  buildingOutline: '#A8B1AB',
  building3d: '#BDC4BE',
  roadPath: '#B4AFA3',
  roadLocal: '#F3F6F4',
  roadLocalCasing: '#A7B3AC',
  roadSecondary: '#F7F9F7',
  roadSecondaryCasing: '#95A39B',
  roadPrimary: '#E8B06E',
  roadPrimaryCasing: '#C4843F',
  roadMotorway: '#E09245',
  roadMotorwayCasing: '#B06824',
  rail: '#87928C',
  boundary: '#84918A',
  label: '#2F3D38',
  labelStrong: '#12201B',
  labelMuted: '#52615B',
  labelHalo: '#DCE6E0',
  poi: '#046C54',
  grid: '#D47732',
  commune: '#046C54',
  canton: '#D47732',
  locality: '#246BCE',
  sublocality: '#7A5AF8',
  quartier: '#C45C26',
  sous_quartier: '#9A3412',
}

/** Brand MD3 seed tones from t_addr/src/styles/theme.css */
export const T_ADDR_BRAND = {
  primary: '#046C54',
  primaryContainer: '#B7F0D6',
  primaryPressed: '#024336',
  secondary: '#C06A1A',
  secondaryContainer: '#FFDDB8',
  tertiary: '#3F5C7A',
  inversePrimary: '#7FD4BC',
  surface: '#F4F7F5',
}

/**
 * Legend strip entries — curated classic / t_addr swatches for Layer Explorer.
 * Labels match how Explorer focus chips and mapStyles name them.
 */
export const T_ADDR_LEGEND_SWATCHES = [
  { id: 'taddr_commune', label: 'Commune', color: T_ADDR_MAP_PALETTE_LIGHT.commune },
  { id: 'taddr_canton', label: 'Canton / grid', color: T_ADDR_MAP_PALETTE_LIGHT.canton },
  { id: 'taddr_locality', label: 'Locality', color: T_ADDR_MAP_PALETTE_LIGHT.locality },
  { id: 'taddr_sublocality', label: 'Sublocality', color: T_ADDR_MAP_PALETTE_LIGHT.sublocality },
  { id: 'taddr_quartier', label: 'Quartier', color: T_ADDR_MAP_PALETTE_LIGHT.quartier },
  { id: 'taddr_motorway', label: 'Motorway', color: T_ADDR_MAP_PALETTE_LIGHT.roadMotorway },
  { id: 'taddr_primary', label: 'Primary rd', color: T_ADDR_MAP_PALETTE_LIGHT.roadPrimary },
  { id: 'taddr_poi', label: 'POI / brand', color: T_ADDR_MAP_PALETTE_LIGHT.poi },
  { id: 'taddr_water', label: 'Water', color: T_ADDR_MAP_PALETTE_LIGHT.water },
  { id: 'taddr_park', label: 'Park', color: T_ADDR_MAP_PALETTE_LIGHT.park },
  { id: 'taddr_building', label: 'Building', color: T_ADDR_MAP_PALETTE_LIGHT.building },
  { id: 'taddr_secondary', label: 'Secondary brand', color: T_ADDR_BRAND.secondary },
]

/**
 * Logistics accents aligned to classic t_addr road / grid ochres
 * (distinct from cool urbanism slate/cyan).
 */
export const T_ADDR_LOGISTICS_ACCENTS = {
  logistics_drive: T_ADDR_MAP_PALETTE_LIGHT.roadMotorway,
  logistics_delivery: T_ADDR_MAP_PALETTE_LIGHT.roadPrimary,
  logistics_corridor: T_ADDR_MAP_PALETTE_LIGHT.roadMotorwayCasing,
  logistics_hub: T_ADDR_MAP_PALETTE_LIGHT.grid,
  logistics_transit: T_ADDR_BRAND.secondary,
  logistics_planned: '#C4B08A',
}
