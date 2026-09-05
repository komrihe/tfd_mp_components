/**
 * Urbanism live-map sources: nationwide localities + major roads;
 * local roads / infra load per selected commune when packs exist.
 * Color coding is cool planning slate/cyan — distinct from cadastre earth tones.
 * Logistics accents reuse classic t_addr motorway/grid ochres.
 */

import { T_ADDR_LOGISTICS_ACCENTS } from './tAddrPalette.js'

export const URBANISM_PALETTE = {
  commune_fill: '#C5D4E0',
  commune_line: '#5A7A8F',
  commune_dim: '#B0B6BC',
  locality_fill: '#A8BCC8',
  locality_line: '#4A6B82',
  road_trunk: '#3D6B8A',
  road_primary: '#4F7F9C',
  road_secondary: '#6A91A8',
  road_tertiary: '#7FA0B2',
  road_local: '#9BB0BE',
  road_residential: '#9BB0BE',
  road_service: '#B0BFC8',
  building_fill: '#C4B4A4',
  building_outline: '#8A7464',
  building_residential: '#C4B4A4',
  building_commercial: '#B89A7A',
  building_public: '#8FA3B0',
  building_religious: '#9A8A9E',
  building_education: '#6B9A9E',
  building_health: '#7A9A8E',
  building_industrial: '#A09088',
  building_other: '#B8B0A8',
  infra_education: '#4A7C8C',
  infra_health: '#6B8F9E',
  infra_commerce: '#5A8A7A',
  infra_admin: '#6A7E9A',
  infra_worship: '#8A7A9A',
  infra_leisure: '#7A9A8E',
  infra_utility: '#6E8494',
  infra_poi: '#7A6F8C',
  address: '#3A5A6E',
  // Logistics — classic t_addr road/grid ochres
  ...T_ADDR_LOGISTICS_ACCENTS,
}

export const LOME_CENTER = [1.22, 6.17]
export const LOME_ZOOM = 11.2

export const URBANISM_DATA_URLS = {
  roads: '/data/urbanism-roads.geojson',
  localities: '/data/urbanism-localities.geojson',
  localitiesLome: '/data/urbanism-localities-lome.geojson',
  buildings: '/data/urbanism-buildings.geojson',
  infrastructure: '/data/urbanism-infrastructure.geojson',
}

export function communeUrbanismUrls(officialCode) {
  const code = encodeURIComponent(officialCode)
  return {
    roads: `/data/commune-roads/${code}.json`,
    pois: `/data/pois/${code}.json`,
  }
}

const EMPTY_FC = { type: 'FeatureCollection', features: [] }

const POI_VERTICAL_TO_INFRA = {
  education: { group: 'education', cls: 'school' },
  health: { group: 'health', cls: 'hospital' },
  food_drink: { group: 'commerce', cls: 'restaurant' },
  retail: { group: 'commerce', cls: 'shop' },
  commerce: { group: 'commerce', cls: 'shop' },
  government: { group: 'admin', cls: 'townhall' },
  admin: { group: 'admin', cls: 'government' },
  worship: { group: 'worship', cls: 'place_of_worship' },
  religion: { group: 'worship', cls: 'place_of_worship' },
  leisure: { group: 'leisure', cls: 'park' },
  sports: { group: 'leisure', cls: 'sports_centre' },
  utility: { group: 'utility', cls: 'power' },
  transport: { group: 'poi', cls: 'bus_station' },
}

/** Road class → OSM highway values */
export const ROAD_CLASS_DEFS = [
  {
    id: 'trunk',
    label: 'Trunk',
    colorKey: 'road_trunk',
    highways: ['motorway', 'trunk'],
    width: 2.6,
  },
  {
    id: 'primary',
    label: 'Primary',
    colorKey: 'road_primary',
    highways: ['primary'],
    width: 2.2,
  },
  {
    id: 'secondary',
    label: 'Secondary',
    colorKey: 'road_secondary',
    highways: ['secondary'],
    width: 1.7,
  },
  {
    id: 'tertiary',
    label: 'Tertiary',
    colorKey: 'road_tertiary',
    highways: ['tertiary'],
    width: 1.4,
  },
  {
    id: 'local',
    label: 'Local',
    colorKey: 'road_local',
    highways: ['residential', 'living_street', 'service', 'unclassified', 'track'],
    width: 1.0,
  },
]

export const INFRA_GROUP_DEFS = [
  { id: 'education', label: 'Education', colorKey: 'infra_education' },
  { id: 'health', label: 'Health', colorKey: 'infra_health' },
  { id: 'commerce', label: 'Commerce', colorKey: 'infra_commerce' },
  { id: 'admin', label: 'Admin', colorKey: 'infra_admin' },
  { id: 'worship', label: 'Worship', colorKey: 'infra_worship' },
  { id: 'leisure', label: 'Leisure', colorKey: 'infra_leisure' },
  { id: 'utility', label: 'Utility', colorKey: 'infra_utility' },
  { id: 'poi', label: 'POI', colorKey: 'infra_poi' },
]

const ADMIN_CLASSES = new Set([
  'townhall',
  'community_centre',
  'government',
  'courthouse',
  'police',
  'fire_station',
  'post_office',
])
const WORSHIP_CLASSES = new Set(['place_of_worship'])

const LOGISTICS_HUB_CLASSES = new Set([
  'fuel',
  'parking',
  'motorcycle_parking',
  'warehouse',
  'depot',
  'marketplace',
  'bus_station',
])
const TRANSIT_CLASSES = new Set([
  'bus_station',
  'taxi',
  'bus_stop',
  'ferry_terminal',
  'railway_station',
])

const DRIVEABLE = [
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'residential',
  'living_street',
  'unclassified',
]
const DELIVERY = ['service', 'residential', 'living_street', 'unclassified']
const CORRIDOR = ['motorway', 'trunk', 'primary']

export async function loadUrbanismCollections() {
  const entries = Object.entries(URBANISM_DATA_URLS)
  const results = await Promise.all(
    entries.map(async ([key, url]) => {
      try {
        const res = await fetch(url)
        if (!res.ok) return [key, { type: 'FeatureCollection', features: [] }]
        return [key, await res.json()]
      } catch {
        return [key, { type: 'FeatureCollection', features: [] }]
      }
    })
  )
  return Object.fromEntries(results)
}

function localityName(props, fallbackIndex) {
  return (
    props?.name ||
    props?.locality_name ||
    props?.record_name ||
    props?.autonomous_parent_context_name ||
    props?.osm_name ||
    `Locality ${fallbackIndex + 1}`
  )
}

/** Nationwide localities first; merge DAGL Lomé enrichment when present. */
export function pickLocalities(collections) {
  const national = collections.localities || EMPTY_FC
  const dagl = collections.localitiesLome
  const nationalFeatures = (national.features || []).map((f, i) => ({
    ...f,
    properties: {
      ...f.properties,
      name: localityName(f.properties, i),
      coverage: f.properties?.coverage || 'national',
    },
  }))

  if (!dagl?.features?.length) {
    return { type: 'FeatureCollection', features: nationalFeatures }
  }

  const seen = new Set(
    nationalFeatures.map(
      (f) =>
        f.properties?.civic_code ||
        f.properties?.name ||
        JSON.stringify(f.geometry?.coordinates?.[0]?.[0]),
    ),
  )
  const daglFeatures = dagl.features
    .map((f, i) => {
      const name = localityName(f.properties, i)
      const key = f.properties?.civic_code || f.properties?.record_name || name
      if (seen.has(key)) return null
      seen.add(key)
      return {
        ...f,
        properties: {
          ...f.properties,
          name,
          coverage: 'dagl_lome',
          source: f.properties?.source || 'dagl_lome',
        },
      }
    })
    .filter(Boolean)

  return {
    type: 'FeatureCollection',
    features: [...nationalFeatures, ...daglFeatures],
  }
}

export function roadsFromCommuneBundle(bundle) {
  if (bundle?.roads?.type === 'FeatureCollection') return bundle.roads
  if (Array.isArray(bundle?.roads?.features)) {
    return { type: 'FeatureCollection', features: bundle.roads.features }
  }
  if (bundle?.type === 'FeatureCollection') return bundle
  return EMPTY_FC
}

export function infrastructureFromPoisBundle(bundle) {
  const records = bundle?.records || bundle?.features || []
  const features = []
  for (const rec of records) {
    const props = rec.properties || rec
    const lng = Number(props.longitude ?? props.lon ?? rec.geometry?.coordinates?.[0])
    const lat = Number(props.latitude ?? props.lat ?? rec.geometry?.coordinates?.[1])
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
    const vertical = String(props.vertical || props.primary_type || 'poi').toLowerCase()
    const mapped =
      POI_VERTICAL_TO_INFRA[vertical] ||
      POI_VERTICAL_TO_INFRA[String(props.primary_type || '').toLowerCase()] || {
        group: 'poi',
        cls: props.primary_type || 'poi',
      }
    features.push({
      type: 'Feature',
      properties: {
        name: props.name || mapped.cls,
        infra_class: mapped.cls,
        infra_group: mapped.group,
        infra_id: props.id || undefined,
        commune_official_code:
          props.official_assignment?.official_code ||
          bundle?.commune?.official_code ||
          null,
      },
      geometry: { type: 'Point', coordinates: [lng, lat] },
    })
  }
  return { type: 'FeatureCollection', features }
}

export async function loadCommuneUrbanismStack(officialCode, opts = {}) {
  if (!officialCode) {
    return { roads: EMPTY_FC, infrastructure: EMPTY_FC, buildings: EMPTY_FC }
  }
  const urls = communeUrbanismUrls(officialCode)
  const [roadsRes, poisRes] = await Promise.all([
    fetch(urls.roads).catch(() => null),
    opts.includePois === false ? Promise.resolve(null) : fetch(urls.pois).catch(() => null),
  ])
  let roads = EMPTY_FC
  let infrastructure = EMPTY_FC
  if (roadsRes?.ok) roads = roadsFromCommuneBundle(await roadsRes.json())
  if (poisRes?.ok) infrastructure = infrastructureFromPoisBundle(await poisRes.json())
  return { roads, infrastructure, buildings: EMPTY_FC, officialCode }
}

export function updateUrbanismStackSources(map, {
  roads,
  buildings,
  infrastructure,
  addresses,
  logistics,
} = {}) {
  if (!map) return
  const set = (id, data) => {
    const src = map.getSource?.(id)
    if (src && data) src.setData(data)
  }
  if (roads) {
    set('ux-roads', roads)
    const infraForLogi = infrastructure
      ? normalizeInfrastructure(infrastructure)
      : null
    const logi =
      logistics ||
      (infraForLogi
        ? buildLogisticsCollections(roads, infraForLogi)
        : buildLogisticsCollections(roads, EMPTY_FC))
    set('ux-logistics-driving', logi.driving)
    set('ux-logistics-delivery', logi.delivery)
    set('ux-logistics-corridors', logi.corridors)
    set('ux-logistics-hubs', logi.hubs)
    set('ux-logistics-transit', logi.transit)
    set('ux-logistics-planned', logi.planned)
  }
  if (buildings) {
    const bld = normalizeBuildings(buildings)
    set('ux-buildings', bld)
    set('ux-addresses', addresses || deriveAddressesFromBuildings(bld))
  }
  if (infrastructure) {
    const infra = normalizeInfrastructure(infrastructure)
    set('ux-infrastructure', infra)
    if (!roads) {
      const logi = buildLogisticsCollections(EMPTY_FC, infra)
      set('ux-logistics-hubs', logi.hubs)
      set('ux-logistics-transit', logi.transit)
    }
  }
}

/** Remap infra_group for worship / admin from infra_class. */
export function normalizeInfrastructure(fc) {
  const features = (fc?.features || []).map((f, i) => {
    const props = { ...(f.properties || {}) }
    const cls = props.infra_class
    let group = props.infra_group || 'poi'
    if (WORSHIP_CLASSES.has(cls)) group = 'worship'
    else if (ADMIN_CLASSES.has(cls)) group = 'admin'
    return {
      ...f,
      id: props.infra_id || i,
      properties: {
        ...props,
        infra_group: group,
        name: props.name || props.infra_class || `Infra ${i + 1}`,
      },
    }
  })
  return { type: 'FeatureCollection', features }
}

/** Derive building_use from OSM building / amenity tags. */
export function normalizeBuildings(fc) {
  const features = (fc?.features || []).map((f, i) => {
    const props = { ...(f.properties || {}) }
    const b = String(props.building || '').toLowerCase()
    const amenity = String(props.amenity || '').toLowerCase()
    let use = 'other'
    if (
      ['house', 'residential', 'apartments', 'detached', 'semidetached_house', 'yes'].includes(b) &&
      !amenity
    ) {
      use = b === 'yes' ? 'other' : 'residential'
    }
    if (['house', 'residential', 'apartments', 'detached'].includes(b)) use = 'residential'
    if (['commercial', 'retail', 'hotel', 'office'].includes(b) || ['restaurant', 'bar', 'bank', 'marketplace'].includes(amenity)) {
      use = 'commercial'
    }
    if (['school', 'university', 'college', 'kindergarten'].includes(b) || ['school', 'university', 'college', 'library'].includes(amenity)) {
      use = 'education'
    }
    if (['hospital', 'clinic'].includes(b) || ['hospital', 'doctors', 'clinic', 'pharmacy'].includes(amenity)) {
      use = 'health'
    }
    if (['church', 'mosque', 'temple', 'cathedral', 'chapel', 'synagogue', 'couvent', 'convent'].includes(b) || amenity === 'place_of_worship') {
      use = 'religious'
    }
    if (['public', 'government', 'civic'].includes(b) || amenity === 'public_building' || amenity === 'townhall') {
      use = 'public'
    }
    if (['industrial', 'warehouse', 'factory', 'construction', 'roof'].includes(b)) {
      use = 'industrial'
    }
    const height = Number(props.height) || (Number(props.levels) || 1) * 3.2
    return {
      ...f,
      id: props.building_id || i,
      properties: {
        ...props,
        building_use: use,
        height_m: height,
        name: props.name || null,
      },
    }
  })
  return { type: 'FeatureCollection', features }
}

/** Light address points from named building centroids (no dedicated address FC). */
export function deriveAddressesFromBuildings(buildingsFc) {
  const features = []
  for (const f of buildingsFc?.features || []) {
    const name = f.properties?.name
    if (!name || !f.geometry) continue
    const centroid = polygonCentroid(f.geometry)
    if (!centroid) continue
    features.push({
      type: 'Feature',
      properties: {
        address_id: `addr-${features.length}`,
        name,
        building_use: f.properties?.building_use,
        formatted_address: name,
        source: 'building_centroid',
      },
      geometry: { type: 'Point', coordinates: centroid },
    })
  }
  return { type: 'FeatureCollection', features }
}

function polygonCentroid(geom) {
  if (!geom) return null
  if (geom.type === 'Point') return geom.coordinates
  let ring = null
  if (geom.type === 'Polygon') ring = geom.coordinates?.[0]
  else if (geom.type === 'MultiPolygon') ring = geom.coordinates?.[0]?.[0]
  if (!ring?.length) return null
  let sx = 0
  let sy = 0
  const n = ring.length - (ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? 1 : 0)
  const count = Math.max(n, 1)
  for (let i = 0; i < count; i++) {
    sx += ring[i][0]
    sy += ring[i][1]
  }
  return [sx / count, sy / count]
}

function filterRoadsByHighway(roadsFc, highways) {
  const set = new Set(highways)
  return {
    type: 'FeatureCollection',
    features: (roadsFc?.features || []).filter((f) => set.has(f.properties?.highway)),
  }
}

function filterInfraByClass(infraFc, classes) {
  const set = classes instanceof Set ? classes : new Set(classes)
  return {
    type: 'FeatureCollection',
    features: (infraFc?.features || []).filter((f) => set.has(f.properties?.infra_class)),
  }
}

/** Build logistics-derived collections from roads + infrastructure. */
export function buildLogisticsCollections(roads, infrastructure) {
  return {
    driving: filterRoadsByHighway(roads, DRIVEABLE),
    delivery: filterRoadsByHighway(roads, DELIVERY),
    corridors: filterRoadsByHighway(roads, CORRIDOR),
    hubs: filterInfraByClass(infrastructure, LOGISTICS_HUB_CLASSES),
    transit: filterInfraByClass(infrastructure, TRANSIT_CLASSES),
    planned: { type: 'FeatureCollection', features: [] },
  }
}

function buildingUseColorExpr(p) {
  return [
    'match',
    ['get', 'building_use'],
    'residential', p.building_residential,
    'commercial', p.building_commercial,
    'public', p.building_public,
    'religious', p.building_religious,
    'education', p.building_education,
    'health', p.building_health,
    'industrial', p.building_industrial,
    p.building_other,
  ]
}

function highwayFilter(highways) {
  return ['in', ['get', 'highway'], ['literal', highways]]
}

function infraGroupFilter(group) {
  return ['==', ['get', 'infra_group'], group]
}

function polyFilter() {
  return ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]]
}

function pointFilter() {
  return ['==', ['geometry-type'], 'Point']
}

function ensureSource(map, id, data, promoteId) {
  if (!data) return
  if (map.getSource(id)) map.getSource(id).setData(data)
  else {
    map.addSource(id, {
      type: 'geojson',
      data,
      ...(promoteId ? { promoteId } : {}),
    })
  }
}

function addOrReplaceLayer(map, layer) {
  if (map.getLayer(layer.id)) map.removeLayer(layer.id)
  map.addLayer({
    ...layer,
    layout: { ...(layer.layout || {}), visibility: layer.layout?.visibility || 'none' },
  })
}

export function addUrbanismStackLayers(map, {
  communes,
  localities,
  roads,
  buildings,
  infrastructure,
  addresses,
  logistics,
  palette = URBANISM_PALETTE,
}) {
  const p = palette
  const infra = normalizeInfrastructure(infrastructure)
  const bld = normalizeBuildings(buildings)
  const addr = addresses || deriveAddressesFromBuildings(bld)
  const logi = logistics || buildLogisticsCollections(roads, infra)

  ensureSource(map, 'ux-communes', communes, 'official_code')
  ensureSource(map, 'ux-localities', localities)
  ensureSource(map, 'ux-roads', roads)
  ensureSource(map, 'ux-buildings', bld)
  ensureSource(map, 'ux-infrastructure', infra)
  ensureSource(map, 'ux-addresses', addr)
  ensureSource(map, 'ux-logistics-driving', logi.driving)
  ensureSource(map, 'ux-logistics-delivery', logi.delivery)
  ensureSource(map, 'ux-logistics-corridors', logi.corridors)
  ensureSource(map, 'ux-logistics-hubs', logi.hubs)
  ensureSource(map, 'ux-logistics-transit', logi.transit)
  ensureSource(map, 'ux-logistics-planned', logi.planned)

  const layers = [
    {
      id: 'ux-communes-fill',
      type: 'fill',
      source: 'ux-communes',
      paint: { 'fill-color': p.commune_fill, 'fill-opacity': 0.28 },
    },
    {
      id: 'ux-communes-line',
      type: 'line',
      source: 'ux-communes',
      paint: { 'line-color': p.commune_line, 'line-width': 1.2 },
    },
    {
      id: 'ux-localities-fill',
      type: 'fill',
      source: 'ux-localities',
      paint: { 'fill-color': p.locality_fill, 'fill-opacity': 0.22 },
    },
    {
      id: 'ux-localities-line',
      type: 'line',
      source: 'ux-localities',
      paint: {
        'line-color': p.locality_line,
        'line-width': 1.1,
        'line-dasharray': [2, 1.5],
      },
    },
    {
      id: 'ux-buildings-fill',
      type: 'fill',
      source: 'ux-buildings',
      filter: polyFilter(),
      paint: {
        'fill-color': buildingUseColorExpr(p),
        'fill-opacity': 0.55,
        'fill-outline-color': p.building_outline,
      },
    },
    {
      id: 'ux-buildings-circle',
      type: 'circle',
      source: 'ux-buildings',
      filter: pointFilter(),
      paint: {
        'circle-radius': 3.5,
        'circle-color': buildingUseColorExpr(p),
        'circle-stroke-color': p.building_outline,
        'circle-stroke-width': 1,
      },
    },
    {
      id: 'ux-buildings-3d',
      type: 'fill-extrusion',
      source: 'ux-buildings',
      filter: polyFilter(),
      minzoom: 14,
      paint: {
        'fill-extrusion-color': buildingUseColorExpr(p),
        'fill-extrusion-height': [
          'coalesce',
          ['to-number', ['get', 'height_m']],
          8,
        ],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.78,
      },
    },
  ]

  // Road class sub-layers
  for (const cls of ROAD_CLASS_DEFS) {
    layers.push({
      id: `ux-roads-${cls.id}`,
      type: 'line',
      source: 'ux-roads',
      filter: highwayFilter(cls.highways),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': p[cls.colorKey],
        'line-width': cls.width,
        'line-opacity': 0.92,
      },
    })
  }

  // Infrastructure equipment-type sub-layers (polygons + optional points)
  for (const g of INFRA_GROUP_DEFS) {
    layers.push(
      {
        id: `ux-infra-${g.id}-fill`,
        type: 'fill',
        source: 'ux-infrastructure',
        filter: ['all', polyFilter(), infraGroupFilter(g.id)],
        paint: {
          'fill-color': p[g.colorKey],
          'fill-opacity': 0.45,
          'fill-outline-color': '#fffdf8',
        },
      },
      {
        id: `ux-infra-${g.id}-circle`,
        type: 'circle',
        source: 'ux-infrastructure',
        filter: ['all', pointFilter(), infraGroupFilter(g.id)],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 14, 5],
          'circle-color': p[g.colorKey],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fffdf8',
          'circle-opacity': 0.9,
        },
      }
    )
  }

  // Addresses (named building centroids)
  layers.push({
    id: 'ux-addresses-circle',
    type: 'circle',
    source: 'ux-addresses',
    minzoom: 13,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2.5, 16, 4.5],
      'circle-color': p.address,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#fffdf8',
      'circle-opacity': 0.9,
    },
  })
  layers.push({
    id: 'ux-addresses-label',
    type: 'symbol',
    source: 'ux-addresses',
    minzoom: 15,
    layout: {
      'text-field': ['coalesce', ['get', 'name'], ''],
      'text-size': 10,
      'text-offset': [0, 1.1],
      'text-anchor': 'top',
      'text-max-width': 10,
    },
    paint: {
      'text-color': p.address,
      'text-halo-color': '#fffdf8',
      'text-halo-width': 1.2,
    },
  })

  // Logistics layers
  layers.push(
    {
      id: 'ux-logistics-driving',
      type: 'line',
      source: 'ux-logistics-driving',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': p.logistics_drive,
        'line-width': [
          'match',
          ['get', 'highway'],
          'motorway', 2.4,
          'trunk', 2.2,
          'primary', 1.9,
          'secondary', 1.5,
          1.1,
        ],
        'line-opacity': 0.88,
      },
    },
    {
      id: 'ux-logistics-delivery',
      type: 'line',
      source: 'ux-logistics-delivery',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': p.logistics_delivery,
        'line-width': 1.15,
        'line-opacity': 0.85,
        'line-dasharray': [1.5, 1.2],
      },
    },
    {
      id: 'ux-logistics-corridors',
      type: 'line',
      source: 'ux-logistics-corridors',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': p.logistics_corridor,
        'line-width': 3.2,
        'line-opacity': 0.9,
      },
    },
    {
      id: 'ux-logistics-corridors-label',
      type: 'symbol',
      source: 'ux-logistics-corridors',
      minzoom: 11,
      layout: {
        'symbol-placement': 'line',
        'text-field': [
          'coalesce',
          ['get', 'ref'],
          ['get', 'name'],
          '',
        ],
        'text-size': 11,
        'text-max-angle': 30,
      },
      paint: {
        'text-color': p.logistics_corridor,
        'text-halo-color': '#fffdf8',
        'text-halo-width': 1.4,
      },
    },
    {
      id: 'ux-logistics-hubs-fill',
      type: 'fill',
      source: 'ux-logistics-hubs',
      filter: polyFilter(),
      paint: {
        'fill-color': p.logistics_hub,
        'fill-opacity': 0.5,
        'fill-outline-color': '#fff8ec',
      },
    },
    {
      id: 'ux-logistics-hubs-circle',
      type: 'circle',
      source: 'ux-logistics-hubs',
      filter: pointFilter(),
      paint: {
        'circle-radius': 5,
        'circle-color': p.logistics_hub,
        'circle-stroke-width': 1.2,
        'circle-stroke-color': '#fff8ec',
      },
    },
    {
      id: 'ux-logistics-transit-fill',
      type: 'fill',
      source: 'ux-logistics-transit',
      filter: polyFilter(),
      paint: {
        'fill-color': p.logistics_transit,
        'fill-opacity': 0.55,
        'fill-outline-color': '#fff8ec',
      },
    },
    {
      id: 'ux-logistics-transit-circle',
      type: 'circle',
      source: 'ux-logistics-transit',
      filter: pointFilter(),
      paint: {
        'circle-radius': 5.5,
        'circle-color': p.logistics_transit,
        'circle-stroke-width': 1.2,
        'circle-stroke-color': '#fff8ec',
      },
    },
    {
      id: 'ux-logistics-planned',
      type: 'line',
      source: 'ux-logistics-planned',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': p.logistics_planned,
        'line-width': 2,
        'line-dasharray': [2, 2],
        'line-opacity': 0.7,
      },
    }
  )

  for (const layer of layers) addOrReplaceLayer(map, layer)
}

/** Map dataset id → MapLibre layer ids */
export const URBANISM_DEMO_LAYER_IDS = {
  urbanism_communes: ['ux-communes-fill', 'ux-communes-line'],
  urbanism_localities: ['ux-localities-fill', 'ux-localities-line'],
  // Parents are UI toggles — visibility is driven by subclass ids
  urbanism_roads: [],
  ...Object.fromEntries(
    ROAD_CLASS_DEFS.map((c) => [`urbanism_roads_${c.id}`, [`ux-roads-${c.id}`]])
  ),
  urbanism_buildings: ['ux-buildings-fill', 'ux-buildings-circle'],
  urbanism_buildings_3d: ['ux-buildings-3d'],
  urbanism_infrastructure: [],
  ...Object.fromEntries(
    INFRA_GROUP_DEFS.map((g) => [
      `urbanism_infra_${g.id}`,
      [`ux-infra-${g.id}-fill`, `ux-infra-${g.id}-circle`],
    ])
  ),
  urbanism_addresses: ['ux-addresses-circle', 'ux-addresses-label'],
  logistics_driving: ['ux-logistics-driving'],
  logistics_delivery: ['ux-logistics-delivery'],
  logistics_corridors: ['ux-logistics-corridors', 'ux-logistics-corridors-label'],
  logistics_hubs: ['ux-logistics-hubs-fill', 'ux-logistics-hubs-circle'],
  logistics_transit: ['ux-logistics-transit-fill', 'ux-logistics-transit-circle'],
  logistics_planned: ['ux-logistics-planned'],
}

/** Parent → child dataset ids for nested toggles */
export const URBANISM_PARENT_CHILDREN = {
  urbanism_roads: ROAD_CLASS_DEFS.map((c) => `urbanism_roads_${c.id}`),
  urbanism_infrastructure: INFRA_GROUP_DEFS.map((g) => `urbanism_infra_${g.id}`),
  urbanism_buildings: ['urbanism_buildings_3d'],
}

export const LOGISTICS_SUBLAYER_IDS = [
  'logistics_driving',
  'logistics_delivery',
  'logistics_corridors',
  'logistics_hubs',
  'logistics_transit',
  'logistics_planned',
]

export const URBANISM_DEFAULT_ACTIVE = [
  'urbanism_communes',
  'urbanism_localities',
  'urbanism_roads',
  ...ROAD_CLASS_DEFS.map((c) => `urbanism_roads_${c.id}`),
  'urbanism_buildings',
  'urbanism_infrastructure',
  ...INFRA_GROUP_DEFS.map((g) => `urbanism_infra_${g.id}`),
]

export function applyUrbanismCommuneFilter(map, selectedCodes) {
  if (!map?.getLayer?.('ux-communes-fill')) return
  const codes = (selectedCodes || []).filter(Boolean)
  if (!codes.length) {
    map.setPaintProperty('ux-communes-fill', 'fill-color', URBANISM_PALETTE.commune_fill)
    map.setPaintProperty('ux-communes-fill', 'fill-opacity', 0.28)
    map.setPaintProperty('ux-communes-line', 'line-color', URBANISM_PALETTE.commune_line)
    map.setPaintProperty('ux-communes-line', 'line-width', 1.2)
    return
  }
  const selected = ['in', ['get', 'official_code'], ['literal', codes]]
  map.setPaintProperty('ux-communes-fill', 'fill-color', [
    'case', selected, URBANISM_PALETTE.commune_fill, URBANISM_PALETTE.commune_dim,
  ])
  map.setPaintProperty('ux-communes-fill', 'fill-opacity', ['case', selected, 0.42, 0.05])
  map.setPaintProperty('ux-communes-line', 'line-color', [
    'case', selected, URBANISM_PALETTE.commune_line, URBANISM_PALETTE.commune_dim,
  ])
  map.setPaintProperty('ux-communes-line', 'line-width', ['case', selected, 2.4, 0.5])
}

/** Pitch map for 3D buildings preview. */
export function setUrbanismBuildings3d(map, enabled) {
  if (!map) return
  if (map.getLayer('ux-buildings-3d')) {
    map.setLayoutProperty('ux-buildings-3d', 'visibility', enabled ? 'visible' : 'none')
  }
  if (enabled) {
    if (map.getLayer('ux-buildings-fill')) {
      map.setLayoutProperty('ux-buildings-fill', 'visibility', 'none')
    }
    map.easeTo({ pitch: 55, duration: 600 })
  } else {
    map.easeTo({ pitch: 0, duration: 500 })
  }
}
