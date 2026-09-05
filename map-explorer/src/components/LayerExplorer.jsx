import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import CommuneFilter from './CommuneFilter'
import {
  URBANISM_PALETTE,
  LOME_CENTER,
  LOME_ZOOM,
  loadUrbanismCollections,
  pickLocalities,
  normalizeInfrastructure,
  normalizeBuildings,
  deriveAddressesFromBuildings,
  buildLogisticsCollections,
  addUrbanismStackLayers,
  URBANISM_DEMO_LAYER_IDS,
  URBANISM_PARENT_CHILDREN,
  URBANISM_DEFAULT_ACTIVE,
  LOGISTICS_SUBLAYER_IDS,
  ROAD_CLASS_DEFS,
  INFRA_GROUP_DEFS,
  applyUrbanismCommuneFilter,
  setUrbanismBuildings3d,
  loadCommuneUrbanismStack,
  updateUrbanismStackSources,
} from '../lib/urbanismMap'
import { T_ADDR_LEGEND_SWATCHES } from '../lib/tAddrPalette'
import './LayerExplorer.css'

/** UI groups from cadastre theme mapbox:groups */
const GROUPS = [
  { id: 'cadastre', name: 'Cadastre' },
  { id: 'parcels', name: 'Parcels & Rights' },
  { id: 'urbanism', name: 'Urbanism' },
  { id: 'buildings', name: 'Buildings & Addresses' },
  { id: 'admin', name: 'Administrative' },
]

/**
 * Explorer catalog — maps logical datasets → UI group, demo map layers,
 * zoom story, and inspector contract from the theme package.
 */
const DATASETS = [
  {
    id: 'administrative_units',
    group: 'admin',
    name: 'Admin units',
    colorKey: 'admin_commune',
    minzoom: 5,
    labelsFrom: 6,
    zoomBands: [
      { label: 'Region', from: 5 },
      { label: 'Prefecture', from: 7 },
      { label: 'Commune', from: 9 },
      { label: 'Canton', from: 11 },
      { label: 'Quartier', from: 13 },
    ],
    sourceLayers: ['admin_units'],
    promoteId: 'admin_id',
    purpose: 'Region, prefecture, commune, canton and quartier boundaries',
    styleLayers: ['admin-region-boundary', 'admin-prefecture-boundary', 'admin-commune-boundary', 'admin-canton-boundary', 'admin-quartier-boundary', 'admin-labels'],
    inspector: ['admin_id', 'name', 'level', 'code', 'parent_id', 'official_source'],
    zIndex: 2,
    focusZoom: 6.5,
    demo: 'admin',
  },
  {
    id: 'tfd_cadastre',
    group: 'cadastre',
    name: 'TFD Cadastre',
    colorKey: 'cadastre',
    minzoom: 8,
    labelsFrom: 16,
    zoomBands: [
      { label: 'Localities', from: 8 },
      { label: 'Grid', from: 13 },
      { label: 'Grid labels', from: 16 },
    ],
    sourceLayers: ['tfd_grid', 'tfd_localities'],
    promoteId: 'cell_id / locality_id',
    purpose: 'TFD grid cells, locality polygons, cell codes and hierarchy',
    styleLayers: ['locality-polygons', 'locality-outline', 'tfd-grid-fill', 'tfd-grid-line', 'locality-labels', 'grid-code-labels'],
    inspector: ['cell_id', 'cell_code', 'hierarchy_code', 'locality_id', 'locality_name'],
    zIndex: 3,
    focusZoom: 8.5,
    demo: 'cadastre',
  },
  {
    id: 'cadastral_sheets',
    group: 'cadastre',
    name: 'Cadastral sheets',
    colorKey: 'sheet',
    minzoom: 10,
    labelsFrom: 13,
    zoomBands: [
      { label: 'Sections', from: 10 },
      { label: 'Legacy raster', from: 11, toggle: true },
      { label: 'Section labels', from: 13 },
    ],
    sourceLayers: ['cadastral_sections'],
    promoteId: 'section_id',
    purpose: 'Legacy sheet/section references and optional scanned raster sheets',
    styleLayers: ['legacy-sheets-raster', 'cadastral-sections-fill', 'cadastral-sections-line', 'section-labels'],
    inspector: ['section_id', 'section_code', 'sheet_ref', 'sheet_year', 'legacy_scale'],
    zIndex: 3,
    focusZoom: 10.5,
    demo: 'sheets',
    toggle: 'legacy-raster',
  },
  {
    id: 'tfd_street',
    group: 'cadastre',
    name: 'TFD Streets',
    colorKey: 'street_primary',
    minzoom: 9,
    labelsFrom: 13,
    zoomBands: [
      { label: 'Centerlines', from: 9 },
      { label: 'Street labels', from: 13 },
    ],
    sourceLayers: ['tfd_streets'],
    promoteId: 'street_id',
    purpose: 'Road centerlines, classification, names and right-of-way',
    styleLayers: ['streets-casing', 'streets-line', 'street-labels'],
    inspector: ['street_id', 'name', 'class', 'surface', 'row_m', 'locality_id'],
    zIndex: 7,
    focusZoom: 10,
    demo: 'streets',
  },
  {
    id: 'parcels',
    group: 'parcels',
    name: 'Parcels',
    colorKey: 'parcel_outline',
    minzoom: 12,
    labelsFrom: 16,
    zoomBands: [
      { label: 'Parcels', from: 12 },
      { label: 'Parcel labels', from: 16 },
    ],
    sourceLayers: ['parcels'],
    promoteId: 'parcel_id',
    purpose: 'Parcel polygons, land use, area, valuation and title state',
    styleLayers: ['parcels-fill', 'parcels-outline', 'parcels-hover', 'parcels-selected', 'parcel-labels'],
    inspector: ['parcel_id', 'parcel_no', 'land_use', 'area_m2', 'valuation', 'valuation_currency', 'title_status', 'section_code'],
    sensitive: ['owner_name', 'owner_contact', 'national_id'],
    featureState: ['hover', 'selected'],
    zIndex: 4,
    focusZoom: 12.2,
    demo: 'parcels',
  },
  {
    id: 'encumbrances',
    group: 'parcels',
    name: 'Encumbrances',
    colorKey: 'encumbrance',
    minzoom: 13,
    zoomBands: [{ label: 'Encumbrances', from: 13 }],
    sourceLayers: ['encumbrances'],
    promoteId: 'encumbrance_id',
    purpose: 'Easements, servitudes, disputes and mortgages',
    styleLayers: ['encumbrances-fill', 'encumbrances-line'],
    inspector: ['encumbrance_id', 'parcel_id', 'type', 'status', 'registered_date', 'reference_no'],
    sensitive: ['mortgagee_name', 'dispute_parties'],
    zIndex: 5,
    focusZoom: 12.8,
    demo: 'encumbrances',
  },
  {
    id: 'land_titles',
    group: 'parcels',
    name: 'Land titles',
    colorKey: 'title_active',
    minzoom: 14,
    zoomBands: [{ label: 'Titles', from: 14 }],
    sourceLayers: ['land_titles'],
    promoteId: 'title_id',
    purpose: 'Title/certificate number, status and issuance date',
    styleLayers: ['land-title-status'],
    inspector: ['title_id', 'parcel_id', 'title_no', 'status', 'issuance_date', 'certificate_type'],
    zIndex: 9,
    focusZoom: 13.5,
    demo: 'titles',
  },
  {
    id: 'rights_holders',
    group: 'parcels',
    name: 'Rights holders',
    colorKey: 'rights',
    minzoom: 15,
    zoomBands: [{ label: 'Rights', from: 15 }],
    sourceLayers: ['rights_holders'],
    promoteId: 'right_id',
    purpose: 'Parcel-linked rights and tenure markers; no personal-name labels by default',
    styleLayers: ['rights-holders-marker'],
    inspector: ['right_id', 'parcel_id', 'ownership_type', 'tenure', 'share_pct', 'public_display_name'],
    sensitive: ['holder_name', 'national_id', 'phone', 'email'],
    privacy: 'authorized-inspector-only for PII',
    zIndex: 9,
    focusZoom: 14,
    demo: 'rights',
  },
  {
    id: 'parcel_boundaries',
    group: 'parcels',
    name: 'Surveyed boundaries',
    colorKey: 'boundary',
    minzoom: 14,
    zoomBands: [
      { label: 'Boundaries', from: 14 },
      { label: 'Markers', from: 16 },
    ],
    sourceLayers: ['parcel_boundaries'],
    promoteId: 'boundary_id',
    purpose: 'Surveyed boundary lines, accuracy classes and monuments/markers',
    styleLayers: ['parcel-boundaries', 'boundary-markers'],
    inspector: ['boundary_id', 'parcel_id', 'accuracy_class', 'survey_date', 'marker_type', 'source_ref'],
    zIndex: 8,
    focusZoom: 13.8,
    demo: 'boundaries',
  },
  {
    id: 'buildings',
    group: 'buildings',
    name: 'Buildings',
    colorKey: 'building',
    minzoom: 14,
    zoomBands: [
      { label: 'Footprints', from: 14 },
      { label: '3D extrusion', from: 15, toggle: true },
    ],
    sourceLayers: ['buildings'],
    promoteId: 'building_id',
    purpose: 'Building footprints, floors, height and use',
    styleLayers: ['buildings-footprint', 'buildings-3d'],
    inspector: ['building_id', 'parcel_id', 'building_use', 'floors', 'height_m', 'roof_type'],
    zIndex: 6,
    focusZoom: 13.8,
    demo: 'buildings',
    toggle: '3d-buildings',
  },
  {
    id: 'addresses',
    group: 'buildings',
    name: 'Addresses',
    colorKey: 'address',
    minzoom: 16,
    labelsFrom: 17,
    zoomBands: [
      { label: 'Points', from: 16 },
      { label: 'House labels', from: 17 },
    ],
    sourceLayers: ['addresses'],
    promoteId: 'address_id',
    purpose: 'House numbers, street names and geocoded address points',
    styleLayers: ['addresses-points', 'address-labels'],
    inspector: ['address_id', 'house_no', 'street_name', 'formatted_address', 'parcel_id', 'geocode_quality'],
    zIndex: 9,
    focusZoom: 14.5,
    demo: 'addresses',
  },
  {
    id: 'urbanism_communes',
    group: 'urbanism',
    name: 'Communes (urbanism)',
    colorKey: 'commune_line',
    minzoom: 5,
    zoomBands: [
      { label: 'Communes', from: 5 },
      { label: 'Filter dim', from: 5, toggle: true },
    ],
    sourceLayers: ['admin_units'],
    promoteId: 'official_code',
    purpose: 'Official communes with urbanism color coding; filter dims non-selected',
    styleLayers: ['ux-communes-fill', 'ux-communes-line'],
    inspector: ['official_code', 'display_name', 'canonical_name', 'admin_level'],
    zIndex: 2,
    focusZoom: 6.5,
    demo: 'urbanism_communes',
    realData: true,
  },
  {
    id: 'urbanism_localities',
    group: 'urbanism',
    name: 'Localities',
    colorKey: 'locality_line',
    minzoom: 10,
    zoomBands: [
      { label: 'Locality polygons', from: 10 },
      { label: 'DAGL Lomé enrichment', from: 11 },
    ],
    sourceLayers: ['localities'],
    promoteId: 'locality_id',
    purpose: 'Nationwide locality extents + DAGL Lomé enrichment',
    styleLayers: ['ux-localities-fill', 'ux-localities-line'],
    inspector: ['name', 'record_type', 'geometry_status', 'publication_scope'],
    zIndex: 3,
    focusZoom: 11.2,
    demo: 'urbanism_localities',
    realData: true,
  },
  {
    id: 'urbanism_roads',
    group: 'urbanism',
    name: 'Roads',
    colorKey: 'road_primary',
    minzoom: 9,
    zoomBands: [
      { label: 'Trunk / primary', from: 9 },
      { label: 'Local access', from: 12 },
    ],
    sourceLayers: ['roads'],
    promoteId: 'osm_id',
    purpose: 'National majors (trunk→tertiary); local roads load per selected commune',
    styleLayers: ROAD_CLASS_DEFS.map((c) => `ux-roads-${c.id}`),
    inspector: ['highway', 'name', 'ref', 'surface'],
    zIndex: 7,
    focusZoom: 11.5,
    demo: 'urbanism_roads',
    realData: true,
    nestParent: true,
  },
  ...ROAD_CLASS_DEFS.map((c) => ({
    id: `urbanism_roads_${c.id}`,
    group: 'urbanism',
    name: c.label,
    colorKey: c.colorKey,
    minzoom: 9,
    zoomBands: [{ label: c.label, from: 9 }],
    sourceLayers: ['roads'],
    promoteId: 'osm_id',
    purpose: `${c.label} roads (${c.highways.join(', ')})`,
    styleLayers: [`ux-roads-${c.id}`],
    inspector: ['highway', 'name', 'ref', 'surface'],
    zIndex: 7,
    focusZoom: 12,
    demo: `urbanism_roads_${c.id}`,
    realData: true,
    nestUnder: 'urbanism_roads',
    pill: true,
  })),
  {
    id: 'urbanism_buildings',
    group: 'urbanism',
    name: 'Buildings',
    colorKey: 'building_fill',
    minzoom: 13,
    zoomBands: [
      { label: 'Use color-coding', from: 13 },
      { label: '3D extrusion', from: 14, toggle: true },
    ],
    sourceLayers: ['buildings'],
    promoteId: 'building_id',
    purpose: 'Building footprints color-coded by use (residential, commercial, public…)',
    styleLayers: ['ux-buildings-fill', 'ux-buildings-circle'],
    inspector: ['building', 'building_use', 'name', 'amenity', 'height_m'],
    zIndex: 6,
    focusZoom: 14,
    demo: 'urbanism_buildings',
    realData: true,
    nestParent: true,
    toggle: '3d-buildings',
  },
  {
    id: 'urbanism_buildings_3d',
    group: 'urbanism',
    name: '3D extrusion',
    colorKey: 'building_commercial',
    minzoom: 14,
    zoomBands: [{ label: 'Fill-extrusion', from: 14, toggle: true }],
    sourceLayers: ['buildings'],
    promoteId: 'building_id',
    purpose: 'Extruded building volumes (height from OSM height/levels)',
    styleLayers: ['ux-buildings-3d'],
    inspector: ['building_use', 'height_m', 'name'],
    zIndex: 6,
    focusZoom: 15,
    demo: 'urbanism_buildings_3d',
    realData: true,
    nestUnder: 'urbanism_buildings',
    pill: true,
    toggle: '3d-buildings',
  },
  {
    id: 'urbanism_infrastructure',
    group: 'urbanism',
    name: 'Infrastructure',
    colorKey: 'infra_education',
    minzoom: 11,
    zoomBands: [
      { label: 'Education / health', from: 11 },
      { label: 'Commerce / POI', from: 12 },
    ],
    sourceLayers: ['infrastructure'],
    promoteId: 'infra_id',
    purpose: 'Equipment by type — education, health, commerce, admin, worship, leisure, utility, POI',
    styleLayers: INFRA_GROUP_DEFS.flatMap((g) => [
      `ux-infra-${g.id}-fill`,
      `ux-infra-${g.id}-circle`,
    ]),
    inspector: ['name', 'infra_class', 'infra_group'],
    zIndex: 9,
    focusZoom: 12.5,
    demo: 'urbanism_infrastructure',
    realData: true,
    nestParent: true,
  },
  ...INFRA_GROUP_DEFS.map((g) => ({
    id: `urbanism_infra_${g.id}`,
    group: 'urbanism',
    name: g.label,
    colorKey: g.colorKey,
    minzoom: 11,
    zoomBands: [{ label: g.label, from: 11 }],
    sourceLayers: ['infrastructure'],
    promoteId: 'infra_id',
    purpose: `${g.label} equipment / amenities`,
    styleLayers: [`ux-infra-${g.id}-fill`, `ux-infra-${g.id}-circle`],
    inspector: ['name', 'infra_class', 'infra_group'],
    zIndex: 9,
    focusZoom: 13,
    demo: `urbanism_infra_${g.id}`,
    realData: true,
    nestUnder: 'urbanism_infrastructure',
    pill: true,
  })),
  {
    id: 'urbanism_addresses',
    group: 'urbanism',
    name: 'Addresses',
    colorKey: 'address',
    minzoom: 13,
    zoomBands: [
      { label: 'Named centroids', from: 13 },
      { label: 'Labels', from: 15 },
    ],
    sourceLayers: ['addresses'],
    promoteId: 'address_id',
    purpose: 'Address-like points derived from named building centroids (no dedicated address FC)',
    styleLayers: ['ux-addresses-circle', 'ux-addresses-label'],
    inspector: ['address_id', 'name', 'formatted_address', 'building_use', 'source'],
    zIndex: 9,
    focusZoom: 14.5,
    demo: 'urbanism_addresses',
    realData: true,
  },
  {
    id: 'logistics_driving',
    group: 'urbanism',
    section: 'logistics',
    name: 'Driving network',
    colorKey: 'logistics_drive',
    minzoom: 9,
    zoomBands: [{ label: 'Driveable roads', from: 9 }],
    sourceLayers: ['roads'],
    promoteId: 'osm_id',
    purpose: 'Car-suitable highway classes (motorway → residential); excludes footways/paths',
    styleLayers: ['ux-logistics-driving'],
    inspector: ['highway', 'name', 'ref'],
    zIndex: 7,
    focusZoom: 11.5,
    demo: 'logistics_driving',
    realData: true,
  },
  {
    id: 'logistics_delivery',
    group: 'urbanism',
    section: 'logistics',
    name: 'Delivery / last-mile',
    colorKey: 'logistics_delivery',
    minzoom: 11,
    zoomBands: [{ label: 'Service / access', from: 11 }],
    sourceLayers: ['roads'],
    promoteId: 'osm_id',
    purpose: 'Service, residential and unclassified access for last-mile delivery',
    styleLayers: ['ux-logistics-delivery'],
    inspector: ['highway', 'name'],
    zIndex: 7,
    focusZoom: 13,
    demo: 'logistics_delivery',
    realData: true,
  },
  {
    id: 'logistics_corridors',
    group: 'urbanism',
    section: 'logistics',
    name: 'Route corridors',
    colorKey: 'logistics_corridor',
    minzoom: 9,
    zoomBands: [
      { label: 'Trunk / primary', from: 9 },
      { label: 'Ref / name labels', from: 11 },
    ],
    sourceLayers: ['roads'],
    promoteId: 'osm_id',
    purpose: 'Primary and trunk corridors with ref/name labels',
    styleLayers: ['ux-logistics-corridors', 'ux-logistics-corridors-label'],
    inspector: ['highway', 'name', 'ref'],
    zIndex: 7,
    focusZoom: 11,
    demo: 'logistics_corridors',
    realData: true,
  },
  {
    id: 'logistics_hubs',
    group: 'urbanism',
    section: 'logistics',
    name: 'Logistics hubs',
    colorKey: 'logistics_hub',
    minzoom: 11,
    zoomBands: [{ label: 'Fuel / parking / market', from: 11 }],
    sourceLayers: ['infrastructure'],
    promoteId: 'infra_id',
    purpose: 'Fuel, parking, marketplace, bus station and related logistics POIs',
    styleLayers: ['ux-logistics-hubs-fill', 'ux-logistics-hubs-circle'],
    inspector: ['name', 'infra_class', 'infra_group'],
    zIndex: 9,
    focusZoom: 12.5,
    demo: 'logistics_hubs',
    realData: true,
  },
  {
    id: 'logistics_transit',
    group: 'urbanism',
    section: 'logistics',
    name: 'Ridings / transit',
    colorKey: 'logistics_transit',
    minzoom: 11,
    zoomBands: [{ label: 'Bus / gare', from: 11 }],
    sourceLayers: ['infrastructure'],
    promoteId: 'infra_id',
    purpose: 'Bus stations and transit points when present in infrastructure extract',
    styleLayers: ['ux-logistics-transit-fill', 'ux-logistics-transit-circle'],
    inspector: ['name', 'infra_class'],
    zIndex: 9,
    focusZoom: 12.5,
    demo: 'logistics_transit',
    realData: true,
  },
  {
    id: 'logistics_planned',
    group: 'urbanism',
    section: 'logistics',
    name: 'Planned routes',
    colorKey: 'logistics_planned',
    minzoom: 10,
    zoomBands: [{ label: 'Stub — no data yet', from: 10 }],
    sourceLayers: ['planned_routes'],
    promoteId: 'route_id',
    purpose: 'Planned delivery corridors / zones — catalog stub (empty FeatureCollection)',
    styleLayers: ['ux-logistics-planned'],
    inspector: ['route_id', 'status', 'name'],
    zIndex: 7,
    focusZoom: 11,
    demo: 'logistics_planned',
    stub: true,
  },
  {
    id: 'zoning',
    group: 'urbanism',
    name: 'Zoning (POS/PDU)',
    colorKey: 'zone_outline',
    minzoom: 9,
    labelsFrom: 12,
    zoomBands: [
      { label: 'Zones', from: 9 },
      { label: 'Ortho overlay', from: 11, toggle: true },
      { label: 'Zone labels', from: 12 },
    ],
    sourceLayers: ['zoning'],
    promoteId: 'zone_id',
    purpose: 'POS/PDU zoning polygons — zone class, density and height rules',
    styleLayers: ['planning-ortho-raster', 'zoning-fill', 'zoning-outline', 'zoning-labels'],
    inspector: ['zone_id', 'plan_code', 'plan_type', 'zone_class', 'zone_label', 'density_max', 'height_max_m', 'status'],
    zIndex: 3,
    focusZoom: 10,
    demo: 'zoning',
    toggle: 'planning-ortho',
  },
  {
    id: 'public_spaces',
    group: 'urbanism',
    name: 'Public spaces',
    colorKey: 'public_space',
    minzoom: 11,
    zoomBands: [
      { label: 'Green / public', from: 11 },
      { label: 'Équipements', from: 12 },
    ],
    sourceLayers: ['public_spaces'],
    promoteId: 'space_id',
    purpose: 'Public green space, plazas and collective equipment (équipements)',
    styleLayers: ['public-spaces-fill', 'public-spaces-outline'],
    inspector: ['space_id', 'space_type', 'name', 'equipment_class', 'status', 'plan_code'],
    zIndex: 3,
    focusZoom: 11.5,
    demo: 'public_spaces',
  },
  {
    id: 'planning_rules',
    group: 'urbanism',
    name: 'Alignements & reculs',
    colorKey: 'alignment',
    minzoom: 12,
    zoomBands: [
      { label: 'Alignements', from: 12 },
      { label: 'Reculs / setbacks', from: 13 },
    ],
    sourceLayers: ['planning_rules'],
    promoteId: 'rule_id',
    purpose: 'Street alignments (alignements) and setbacks (reculs / emprises)',
    styleLayers: ['planning-alignments', 'planning-setbacks'],
    inspector: ['rule_id', 'rule_type', 'setback_m', 'alignment_ref', 'plan_code', 'status'],
    zIndex: 8,
    focusZoom: 12.5,
    demo: 'planning_rules',
  },
  {
    id: 'servitudes',
    group: 'urbanism',
    name: 'Urban servitudes',
    colorKey: 'urban_servitude',
    minzoom: 13,
    zoomBands: [{ label: 'Servitudes d’urbanisme', from: 13 }],
    sourceLayers: ['servitudes'],
    promoteId: 'servitude_id',
    purpose: 'Regulatory urbanism constraints — distinct from cadastral encumbrances',
    styleLayers: ['urban-servitudes-fill', 'urban-servitudes-line'],
    inspector: ['servitude_id', 'servitude_type', 'authority', 'plan_code', 'status', 'reference_no'],
    zIndex: 5,
    focusZoom: 13,
    demo: 'servitudes',
  },
  {
    id: 'permits',
    group: 'urbanism',
    name: 'Building permits',
    colorKey: 'permit_approved',
    minzoom: 14,
    zoomBands: [
      { label: 'Emprises', from: 14 },
      { label: 'Permit status', from: 14 },
    ],
    sourceLayers: ['permits'],
    promoteId: 'permit_id',
    purpose: 'Building permits and construction footprints (permis / emprises)',
    styleLayers: ['permits-fill', 'permits-outline'],
    inspector: ['permit_id', 'permit_no', 'permit_type', 'status', 'issued_date', 'footprint_m2', 'parcel_id'],
    sensitive: ['applicant_name', 'attachments'],
    privacy: 'authorized-inspector-only for applicant PII',
    zIndex: 6,
    focusZoom: 13.8,
    demo: 'permits',
  },
]

const Z_ORDER = [
  { id: 'background', label: 'Background' },
  { id: 'legacy', label: 'Legacy / planning ortho' },
  { id: 'admin', label: 'Administration' },
  { id: 'zoning', label: 'POS/PDU / public space' },
  { id: 'cadastre', label: 'Cadastre / grid' },
  { id: 'parcels', label: 'Parcels' },
  { id: 'encumbrances', label: 'Encumbrances' },
  { id: 'urban_servitudes', label: 'Urbanism servitudes' },
  { id: 'buildings', label: 'Buildings' },
  { id: 'permits', label: 'Building permits' },
  { id: 'streets', label: 'Roads' },
  { id: 'planning', label: 'Alignements / reculs' },
  { id: 'boundaries', label: 'Surveyed boundaries' },
  { id: 'markers', label: 'Property / address markers' },
  { id: 'labels', label: 'Labels' },
]

const DATASET_Z = {
  administrative_units: 'admin',
  tfd_cadastre: 'cadastre',
  cadastral_sheets: 'legacy',
  urbanism_communes: 'admin',
  urbanism_localities: 'zoning',
  urbanism_roads: 'streets',
  urbanism_roads_trunk: 'streets',
  urbanism_roads_primary: 'streets',
  urbanism_roads_secondary: 'streets',
  urbanism_roads_tertiary: 'streets',
  urbanism_roads_local: 'streets',
  urbanism_buildings: 'buildings',
  urbanism_buildings_3d: 'buildings',
  urbanism_infrastructure: 'markers',
  urbanism_infra_education: 'markers',
  urbanism_infra_health: 'markers',
  urbanism_infra_commerce: 'markers',
  urbanism_infra_admin: 'markers',
  urbanism_infra_worship: 'markers',
  urbanism_infra_leisure: 'markers',
  urbanism_infra_utility: 'markers',
  urbanism_infra_poi: 'markers',
  urbanism_addresses: 'markers',
  logistics_driving: 'streets',
  logistics_delivery: 'streets',
  logistics_corridors: 'streets',
  logistics_hubs: 'markers',
  logistics_transit: 'markers',
  logistics_planned: 'streets',
  zoning: 'zoning',
  public_spaces: 'zoning',
  planning_rules: 'planning',
  servitudes: 'urban_servitudes',
  permits: 'permits',
  parcels: 'parcels',
  encumbrances: 'encumbrances',
  buildings: 'buildings',
  tfd_street: 'streets',
  parcel_boundaries: 'boundaries',
  land_titles: 'markers',
  rights_holders: 'markers',
  addresses: 'markers',
}

const FALLBACK_PALETTE = {
  background: '#F7F5EF',
  water: '#DDECF2',
  cadastre: '#8A6D3B',
  cadastre_fill: '#E8DFC8',
  street_motorway: '#D1644D',
  street_primary: '#DFA653',
  street_secondary: '#CDBB8A',
  street_local: '#B9B7B1',
  parcel_default: '#DCE8C8',
  parcel_residential: '#DDE7D0',
  parcel_commercial: '#F1D8B5',
  parcel_agriculture: '#D0E3B4',
  parcel_public: '#D6E1EE',
  parcel_industrial: '#E2D3D0',
  parcel_outline: '#7A6E5A',
  boundary: '#5E5142',
  building: '#CFC7BC',
  building_outline: '#A49B8D',
  address: '#24435A',
  admin_region: '#6E4F8A',
  admin_prefecture: '#866BA0',
  admin_commune: '#6C7B9B',
  admin_canton: '#8794A7',
  admin_quartier: '#9DA6AE',
  encumbrance: '#B24C63',
  title_active: '#2F7D59',
  title_pending: '#B8842E',
  title_inactive: '#8A8A8A',
  rights: '#4B6EAF',
  sheet: '#8A7B6A',
  zone_residential: '#C8D5E3',
  zone_commercial: '#B7C9D6',
  zone_industrial: '#A7B6C6',
  zone_mixed: '#BFC8D8',
  zone_green: '#B5C9C2',
  zone_equipment: '#9EB4C0',
  zone_outline: '#5A7A8F',
  public_space: '#7FA8A0',
  public_equipment: '#6B8F9E',
  alignment: '#4A6B82',
  setback: '#6E8494',
  urban_servitude: '#7A6F8C',
  permit_approved: '#3D7A6E',
  permit_pending: '#8A7A5C',
  permit_refused: '#8B6B6B',
  permit_fill: '#A8C4BC',
  planning_sheet: '#6A7E8A',
  commune_fill: '#C5D4E0',
  commune_line: '#5A7A8F',
  locality_fill: '#A8BCC8',
  locality_line: '#4A6B82',
  road_trunk: '#3D6B8A',
  road_primary: '#4F7F9C',
  road_secondary: '#6A91A8',
  road_tertiary: '#7FA0B2',
  road_local: '#9BB0BE',
  road_residential: '#9BB0BE',
  building_fill: '#C4B4A4',
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
  logistics_drive: '#E09245',
  logistics_delivery: '#E8B06E',
  logistics_corridor: '#B06824',
  logistics_hub: '#D47732',
  logistics_transit: '#C06A1A',
  logistics_planned: '#C4B08A',
  hover: '#1A73E8',
  selected: '#0B57D0',
  label: '#2B2926',
  label_halo: '#FFFDF8',
}

const LAND_USES = ['residential', 'commercial', 'agriculture', 'public', 'industrial']
const ZONE_CLASSES = ['residential', 'commercial', 'industrial', 'mixed', 'green', 'equipment']
const TOGO_CENTER = [1.2, 7.4]
const FOCUS_SOUTH = [1.22, 6.28]

function collectCoords(coords, out = []) {
  if (!coords) return out
  if (typeof coords[0] === 'number') {
    out.push(coords)
    return out
  }
  for (const c of coords) collectCoords(c, out)
  return out
}

function featureCentroid(feature) {
  const pts = collectCoords(feature.geometry?.coordinates)
  if (!pts.length) return TOGO_CENTER
  let sx = 0
  let sy = 0
  for (const [x, y] of pts) {
    sx += x
    sy += y
  }
  return [sx / pts.length, sy / pts.length]
}

function buildDemoCollections(communes, palette) {
  const features = communes?.features || []
  const centered = features.map((f, i) => ({ f, i, c: featureCentroid(f) }))

  const admin = {
    type: 'FeatureCollection',
    features: features.map((f) => ({
      type: 'Feature',
      properties: {
        name: f.properties?.display_name || f.properties?.canonical_name || f.properties?.official_code,
        level: 'commune',
        code: f.properties?.official_code,
        admin_id: f.properties?.canonical_id || f.properties?.official_code,
      },
      geometry: f.geometry,
    })),
  }

  const cadastre = {
    type: 'FeatureCollection',
    features: features.filter((_, i) => i % 2 === 0).map((f, n) => ({
      type: 'Feature',
      properties: {
        cell_code: `G-${f.properties?.official_code || n}`,
        locality_name: f.properties?.display_name,
      },
      geometry: f.geometry,
    })),
  }

  const sheets = {
    type: 'FeatureCollection',
    features: features.filter((_, i) => i % 5 === 0).map((f, n) => ({
      type: 'Feature',
      properties: { section_code: `S${n + 1}`, sheet_ref: `LEG-${n + 1}` },
      geometry: f.geometry,
    })),
  }

  const parcels = {
    type: 'FeatureCollection',
    features: features.map((f, i) => {
      const land_use = LAND_USES[i % LAND_USES.length]
      return {
        type: 'Feature',
        id: i + 1,
        properties: {
          parcel_id: i + 1,
          parcel_no: `P-${f.properties?.official_code || i}`,
          land_use,
          area_m2: 800 + (i % 40) * 37,
          valuation: 120000 + i * 850,
          valuation_currency: 'XOF',
          title_status: i % 5 === 0 ? 'pending' : 'active',
          section_code: `SEC-${(i % 12) + 1}`,
        },
        geometry: f.geometry,
      }
    }),
  }

  const sorted = [...centered].sort((a, b) => a.c[1] - b.c[1])
  const streets = {
    type: 'FeatureCollection',
    features: sorted.flatMap((a, i) => {
      if (i % 2 !== 0 || !sorted[i + 1]) return []
      const b = sorted[i + 1]
      const cls = i % 6 === 0 ? 'motorway' : i % 3 === 0 ? 'primary' : 'secondary'
      return [{
        type: 'Feature',
        properties: { class: cls, name: `Route ${i + 1}` },
        geometry: { type: 'LineString', coordinates: [a.c, b.c] },
      }]
    }),
  }

  const encumbrances = {
    type: 'FeatureCollection',
    features: centered.filter(({ i }) => i % 6 === 0).slice(0, 24).map(({ c, i }, n) => {
      const b = centered[(i + 4) % centered.length]
      return {
        type: 'Feature',
        properties: { type: 'easement', status: 'registered', encumbrance_id: `E-${n}` },
        geometry: { type: 'LineString', coordinates: [c, b.c] },
      }
    }),
  }

  const buildings = {
    type: 'FeatureCollection',
    features: centered.filter(({ i }) => i % 2 === 0).flatMap(({ c, i }) =>
      [0, 1].map((n) => ({
        type: 'Feature',
        properties: { floors: 1 + ((i + n) % 3), building_use: 'residential' },
        geometry: {
          type: 'Point',
          coordinates: [c[0] + (n - 0.5) * 0.01, c[1] + ((i % 2) - 0.5) * 0.008],
        },
      }))
    ),
  }

  const titles = {
    type: 'FeatureCollection',
    features: centered.filter(({ i }) => i % 4 === 0).map(({ c, i, f }) => ({
      type: 'Feature',
      properties: {
        status: i % 8 === 0 ? 'pending' : 'active',
        title_no: `T-${f.properties?.official_code || i}`,
      },
      geometry: { type: 'Point', coordinates: [c[0] + 0.006, c[1] - 0.004] },
    })),
  }

  const rights = {
    type: 'FeatureCollection',
    features: centered.filter(({ i }) => i % 5 === 0).map(({ c, i }) => ({
      type: 'Feature',
      properties: { ownership_type: 'freehold', tenure: 'registered', right_id: `R-${i}` },
      geometry: { type: 'Point', coordinates: [c[0] - 0.007, c[1] + 0.003] },
    })),
  }

  const boundaries = {
    type: 'FeatureCollection',
    features: centered.filter(({ i }) => i % 3 === 0).map(({ c, i }) => {
      const d = 0.015
      return {
        type: 'Feature',
        properties: { accuracy_class: 'A', marker_type: 'monument' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [c[0] - d, c[1] - d * 0.4],
            [c[0] + d, c[1] + d * 0.3],
          ],
        },
      }
    }),
  }

  const addresses = {
    type: 'FeatureCollection',
    features: centered.filter(({ i }) => i % 2 === 1).map(({ c, i }) => ({
      type: 'Feature',
      properties: { house_no: String(10 + (i % 80)), street_name: 'Rue locale' },
      geometry: { type: 'Point', coordinates: [c[0] - 0.005, c[1] + 0.006] },
    })),
  }

  const zoning = {
    type: 'FeatureCollection',
    features: features.filter((_, i) => i % 3 === 0).map((f, n) => {
      const zone_class = ZONE_CLASSES[n % ZONE_CLASSES.length]
      return {
        type: 'Feature',
        properties: {
          zone_id: `Z-${n + 1}`,
          plan_code: n % 2 === 0 ? 'POS-LME' : 'PDU-LME',
          plan_type: n % 2 === 0 ? 'POS' : 'PDU',
          zone_class,
          zone_label: zone_class === 'green' ? 'Espace vert' : zone_class === 'equipment' ? 'Équipement' : `Zone ${zone_class.slice(0, 3).toUpperCase()}`,
          density_max: 0.4 + (n % 5) * 0.15,
          height_max_m: 6 + (n % 4) * 3,
          status: 'in_force',
        },
        geometry: f.geometry,
      }
    }),
  }

  const public_spaces = {
    type: 'FeatureCollection',
    features: centered.filter(({ i }) => i % 7 === 0).slice(0, 18).map(({ c, i }, n) => {
      const d = 0.012
      const space_type = n % 3 === 0 ? 'equipment' : 'green'
      return {
        type: 'Feature',
        properties: {
          space_id: `PS-${n}`,
          space_type,
          name: space_type === 'equipment' ? `Équipement ${n + 1}` : `Parc ${n + 1}`,
          equipment_class: space_type === 'equipment' ? 'school' : 'park',
          status: 'planned',
          plan_code: 'POS-LME',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [c[0] - d, c[1] - d * 0.6],
            [c[0] + d, c[1] - d * 0.4],
            [c[0] + d * 0.7, c[1] + d],
            [c[0] - d * 0.8, c[1] + d * 0.5],
            [c[0] - d, c[1] - d * 0.6],
          ]],
        },
      }
    }),
  }

  const planning_rules = {
    type: 'FeatureCollection',
    features: centered.filter(({ i }) => i % 4 === 0).flatMap(({ c, i }, n) => {
      const b = centered[(i + 3) % centered.length]
      return [
        {
          type: 'Feature',
          properties: {
            rule_id: `AL-${n}`,
            rule_type: 'alignment',
            setback_m: 0,
            alignment_ref: `ALN-${n + 1}`,
            plan_code: 'PDU-LME',
            status: 'in_force',
          },
          geometry: { type: 'LineString', coordinates: [c, b.c] },
        },
        {
          type: 'Feature',
          properties: {
            rule_id: `SB-${n}`,
            rule_type: 'setback',
            setback_m: 3 + (n % 4),
            alignment_ref: `ALN-${n + 1}`,
            plan_code: 'POS-LME',
            status: 'in_force',
          },
          geometry: {
            type: 'LineString',
            coordinates: [
              [c[0] + 0.004, c[1] - 0.003],
              [c[0] + 0.018, c[1] + 0.008],
            ],
          },
        },
      ]
    }),
  }

  const servitudes = {
    type: 'FeatureCollection',
    features: centered.filter(({ i }) => i % 8 === 0).slice(0, 16).map(({ c, i }, n) => {
      const b = centered[(i + 5) % centered.length]
      return {
        type: 'Feature',
        properties: {
          servitude_id: `US-${n}`,
          servitude_type: n % 2 === 0 ? 'non_aedificandi' : 'passage',
          authority: 'Direction de l’Urbanisme',
          plan_code: 'POS-LME',
          status: 'active',
          reference_no: `SU-${100 + n}`,
        },
        geometry: { type: 'LineString', coordinates: [c, b.c] },
      }
    }),
  }

  const permits = {
    type: 'FeatureCollection',
    features: centered.filter(({ i }) => i % 5 === 0).slice(0, 20).map(({ c, i }, n) => {
      const d = 0.004
      const status = n % 5 === 0 ? 'pending' : n % 7 === 0 ? 'refused' : 'approved'
      return {
        type: 'Feature',
        properties: {
          permit_id: `PC-${n}`,
          permit_no: `PC/2026/${200 + n}`,
          permit_type: 'construction',
          status,
          issued_date: '2026-03-12',
          footprint_m2: 80 + n * 12,
          parcel_id: n + 1,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [c[0] - d, c[1] - d],
            [c[0] + d, c[1] - d],
            [c[0] + d, c[1] + d],
            [c[0] - d, c[1] + d],
            [c[0] - d, c[1] - d],
          ]],
        },
      }
    }),
  }

  return {
    admin,
    cadastre,
    sheets,
    parcels,
    streets,
    encumbrances,
    buildings,
    titles,
    rights,
    boundaries,
    addresses,
    zoning,
    public_spaces,
    planning_rules,
    servitudes,
    permits,
    palette,
  }
}

function addDemoLayers(map, demos) {
  const p = demos.palette

  const sources = {
    'lx-admin': demos.admin,
    'lx-cadastre': demos.cadastre,
    'lx-sheets': demos.sheets,
    'lx-parcels': demos.parcels,
    'lx-streets': demos.streets,
    'lx-encumbrances': demos.encumbrances,
    'lx-buildings': demos.buildings,
    'lx-titles': demos.titles,
    'lx-rights': demos.rights,
    'lx-boundaries': demos.boundaries,
    'lx-addresses': demos.addresses,
    'lx-zoning': demos.zoning,
    'lx-public-spaces': demos.public_spaces,
    'lx-planning-rules': demos.planning_rules,
    'lx-servitudes': demos.servitudes,
    'lx-permits': demos.permits,
  }

  for (const [id, data] of Object.entries(sources)) {
    if (map.getSource(id)) map.getSource(id).setData(data)
    else map.addSource(id, { type: 'geojson', data, promoteId: id === 'lx-parcels' ? 'parcel_id' : undefined })
  }

  const layers = [
    {
      id: 'lx-sheets-fill',
      type: 'fill',
      source: 'lx-sheets',
      paint: { 'fill-color': p.sheet, 'fill-opacity': 0.12 },
    },
    {
      id: 'lx-sheets-line',
      type: 'line',
      source: 'lx-sheets',
      paint: { 'line-color': p.sheet, 'line-width': 1, 'line-dasharray': [2, 2] },
    },
    {
      id: 'lx-admin-fill',
      type: 'fill',
      source: 'lx-admin',
      paint: { 'fill-color': p.admin_commune, 'fill-opacity': 0.05 },
    },
    {
      id: 'lx-admin-line',
      type: 'line',
      source: 'lx-admin',
      paint: {
        'line-color': p.admin_commune,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 11, 1.8],
      },
    },
    {
      id: 'lx-zoning-fill',
      type: 'fill',
      source: 'lx-zoning',
      paint: {
        'fill-color': [
          'match',
          ['get', 'zone_class'],
          'residential', p.zone_residential,
          'commercial', p.zone_commercial,
          'industrial', p.zone_industrial,
          'mixed', p.zone_mixed,
          'green', p.zone_green,
          'equipment', p.zone_equipment,
          p.zone_residential,
        ],
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.18, 12, 0.34],
      },
    },
    {
      id: 'lx-zoning-line',
      type: 'line',
      source: 'lx-zoning',
      paint: { 'line-color': p.zone_outline, 'line-width': 1.1 },
    },
    {
      id: 'lx-public-spaces-fill',
      type: 'fill',
      source: 'lx-public-spaces',
      paint: {
        'fill-color': [
          'match',
          ['get', 'space_type'],
          'equipment', p.public_equipment,
          p.public_space,
        ],
        'fill-opacity': 0.38,
      },
    },
    {
      id: 'lx-public-spaces-line',
      type: 'line',
      source: 'lx-public-spaces',
      paint: {
        'line-color': p.public_equipment,
        'line-width': 1,
        'line-dasharray': [1.5, 1.2],
      },
    },
    {
      id: 'lx-cadastre-fill',
      type: 'fill',
      source: 'lx-cadastre',
      paint: { 'fill-color': p.cadastre_fill, 'fill-opacity': 0.45 },
    },
    {
      id: 'lx-cadastre-line',
      type: 'line',
      source: 'lx-cadastre',
      paint: { 'line-color': p.cadastre, 'line-width': 1.1 },
    },
    {
      id: 'lx-parcels-fill',
      type: 'fill',
      source: 'lx-parcels',
      paint: {
        'fill-color': [
          'match',
          ['get', 'land_use'],
          'residential', p.parcel_residential,
          'commercial', p.parcel_commercial,
          'agriculture', p.parcel_agriculture,
          'public', p.parcel_public,
          'industrial', p.parcel_industrial,
          p.parcel_default,
        ],
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.2, 14, 0.42],
      },
    },
    {
      id: 'lx-parcels-outline',
      type: 'line',
      source: 'lx-parcels',
      paint: { 'line-color': p.parcel_outline, 'line-width': 0.9 },
    },
    {
      id: 'lx-parcels-hover',
      type: 'line',
      source: 'lx-parcels',
      paint: {
        'line-color': p.hover,
        'line-width': 2.4,
        'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0],
      },
    },
    {
      id: 'lx-parcels-selected',
      type: 'line',
      source: 'lx-parcels',
      paint: {
        'line-color': p.selected,
        'line-width': 3,
        'line-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 1, 0],
      },
    },
    {
      id: 'lx-encumbrances-line',
      type: 'line',
      source: 'lx-encumbrances',
      paint: {
        'line-color': p.encumbrance,
        'line-width': 1.8,
        'line-dasharray': [3, 2],
      },
    },
    {
      id: 'lx-servitudes-line',
      type: 'line',
      source: 'lx-servitudes',
      paint: {
        'line-color': p.urban_servitude,
        'line-width': 1.6,
        'line-dasharray': [4, 2],
      },
    },
    {
      id: 'lx-buildings-circle',
      type: 'circle',
      source: 'lx-buildings',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 2, 13, 5],
        'circle-color': p.building,
        'circle-stroke-color': p.building_outline,
        'circle-stroke-width': 1,
      },
    },
    {
      id: 'lx-permits-fill',
      type: 'fill',
      source: 'lx-permits',
      paint: {
        'fill-color': [
          'match',
          ['get', 'status'],
          'approved', p.permit_approved,
          'pending', p.permit_pending,
          'refused', p.permit_refused,
          p.permit_fill,
        ],
        'fill-opacity': 0.55,
      },
    },
    {
      id: 'lx-permits-line',
      type: 'line',
      source: 'lx-permits',
      paint: { 'line-color': p.permit_approved, 'line-width': 1.2 },
    },
    {
      id: 'lx-streets-line',
      type: 'line',
      source: 'lx-streets',
      paint: {
        'line-color': [
          'match',
          ['get', 'class'],
          'motorway', p.street_motorway,
          'primary', p.street_primary,
          p.street_secondary,
        ],
        'line-width': [
          'match',
          ['get', 'class'],
          'motorway', 2.4,
          'primary', 1.8,
          1.2,
        ],
        'line-opacity': 0.9,
      },
    },
    {
      id: 'lx-planning-alignments',
      type: 'line',
      source: 'lx-planning-rules',
      filter: ['==', ['get', 'rule_type'], 'alignment'],
      paint: {
        'line-color': p.alignment,
        'line-width': 2,
        'line-dasharray': [6, 2],
      },
    },
    {
      id: 'lx-planning-setbacks',
      type: 'line',
      source: 'lx-planning-rules',
      filter: ['==', ['get', 'rule_type'], 'setback'],
      paint: {
        'line-color': p.setback,
        'line-width': 1.2,
        'line-dasharray': [2, 2],
      },
    },
    {
      id: 'lx-boundaries-line',
      type: 'line',
      source: 'lx-boundaries',
      paint: { 'line-color': p.boundary, 'line-width': 1.4 },
    },
    {
      id: 'lx-titles-circle',
      type: 'circle',
      source: 'lx-titles',
      paint: {
        'circle-radius': 5,
        'circle-color': [
          'match',
          ['get', 'status'],
          'pending', p.title_pending,
          'inactive', p.title_inactive,
          p.title_active,
        ],
        'circle-stroke-width': 1,
        'circle-stroke-color': '#fffdf8',
      },
    },
    {
      id: 'lx-rights-circle',
      type: 'circle',
      source: 'lx-rights',
      paint: {
        'circle-radius': 4.5,
        'circle-color': p.rights,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#fffdf8',
      },
    },
    {
      id: 'lx-addresses-circle',
      type: 'circle',
      source: 'lx-addresses',
      paint: {
        'circle-radius': 3.2,
        'circle-color': p.address,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#fffdf8',
      },
    },
  ]

  for (const layer of layers) {
    if (map.getLayer(layer.id)) map.removeLayer(layer.id)
    map.addLayer({ ...layer, layout: { visibility: 'none' } })
  }
}

const DEMO_LAYER_IDS = {
  ...URBANISM_DEMO_LAYER_IDS,
  admin: ['lx-admin-fill', 'lx-admin-line'],
  cadastre: ['lx-cadastre-fill', 'lx-cadastre-line'],
  sheets: ['lx-sheets-fill', 'lx-sheets-line'],
  zoning: ['lx-zoning-fill', 'lx-zoning-line'],
  public_spaces: ['lx-public-spaces-fill', 'lx-public-spaces-line'],
  planning_rules: ['lx-planning-alignments', 'lx-planning-setbacks'],
  servitudes: ['lx-servitudes-line'],
  permits: ['lx-permits-fill', 'lx-permits-line'],
  parcels: ['lx-parcels-fill', 'lx-parcels-outline', 'lx-parcels-hover', 'lx-parcels-selected'],
  streets: ['lx-streets-line'],
  encumbrances: ['lx-encumbrances-line'],
  buildings: ['lx-buildings-circle'],
  titles: ['lx-titles-circle'],
  rights: ['lx-rights-circle'],
  boundaries: ['lx-boundaries-line'],
  addresses: ['lx-addresses-circle'],
}

const DEFAULT_ACTIVE = ['administrative_units', 'parcels']

export default function LayerExplorer({
  communeData: communeDataProp = null,
  selectedCommunes: selectedCommunesProp,
  onSelectedCommunesChange,
} = {}) {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const selectedParcel = useRef(null)
  const hoveredParcel = useRef(null)
  const urbanismNationalRef = useRef(null)

  const [palette, setPalette] = useState(FALLBACK_PALETTE)
  const [styleMeta, setStyleMeta] = useState(null)
  const [layerCount, setLayerCount] = useState(47)
  const [group, setGroup] = useState('parcels')
  const [active, setActive] = useState(DEFAULT_ACTIVE)
  const [selected, setSelected] = useState('parcels')
  const [mapReady, setMapReady] = useState(false)
  const [status, setStatus] = useState('Loading theme…')
  const [inspectSample, setInspectSample] = useState(null)
  const [inspectorKey, setInspectorKey] = useState(0)
  const [zoom, setZoom] = useState(6.4)
  const [selectedCommunesLocal, setSelectedCommunesLocal] = useState([])
  const [communeDataLocal, setCommuneDataLocal] = useState(null)
  const selectedCommunes = selectedCommunesProp ?? selectedCommunesLocal
  const setSelectedCommunes = onSelectedCommunesChange || setSelectedCommunesLocal
  const communeData = communeDataProp || communeDataLocal

  const selectedDataset = useMemo(
    () => DATASETS.find((d) => d.id === selected) || DATASETS[0],
    [selected]
  )

  const groupDatasets = useMemo(
    () => DATASETS.filter((d) => d.group === group && !d.pill),
    [group]
  )

  const urbanismSections = useMemo(() => {
    if (group !== 'urbanism') return null
    const core = DATASETS.filter(
      (d) => d.group === 'urbanism' && !d.section && !d.pill && !d.nestUnder
    )
    const logistics = DATASETS.filter((d) => d.section === 'logistics')
    return { core, logistics }
  }, [group])

  const childrenOf = useCallback(
    (parentId) => DATASETS.filter((d) => d.nestUnder === parentId),
    []
  )

  const syncVisibility = useCallback((activeIds) => {
    if (!map.current) return
    // Layer visible if any dataset that lists it is active
    const layerOn = new Map()
    for (const ds of DATASETS) {
      const on = activeIds.includes(ds.id)
      for (const layerId of DEMO_LAYER_IDS[ds.demo] || []) {
        if (on) layerOn.set(layerId, true)
        else if (!layerOn.has(layerId)) layerOn.set(layerId, false)
      }
    }
    for (const [layerId, on] of layerOn) {
      if (map.current.getLayer(layerId)) {
        map.current.setLayoutProperty(layerId, 'visibility', on ? 'visible' : 'none')
      }
    }
    // 3D exclusive: when 3d on, hide flat fill for buildings
    const threeD = activeIds.includes('urbanism_buildings_3d')
    if (map.current.getLayer('ux-buildings-3d')) {
      map.current.setLayoutProperty(
        'ux-buildings-3d',
        'visibility',
        threeD ? 'visible' : 'none'
      )
    }
    if (threeD && map.current.getLayer('ux-buildings-fill')) {
      map.current.setLayoutProperty('ux-buildings-fill', 'visibility', 'none')
    }
  }, [])

  // Load real theme + manifest
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [styleRes, manifestRes] = await Promise.all([
          fetch('/themes/tfd-maplibre-style-light.json'),
          fetch('/themes/tfd-layer-manifest.json'),
        ])
        const style = styleRes.ok ? await styleRes.json() : null
        const manifest = manifestRes.ok ? await manifestRes.json() : null
        if (cancelled) return
        if (manifest?.palette?.light) {
          setPalette({ ...FALLBACK_PALETTE, ...URBANISM_PALETTE, ...manifest.palette.light })
        }
        if (style?.layers) setLayerCount(style.layers.length)
        if (style?.metadata) setStyleMeta(style.metadata)
        setStatus(
          `${style?.layers?.length || 47} style layers · ${manifest?.logicalLayers?.length || 16} datasets`
        )
      } catch {
        setStatus('47 style layers · offline palette')
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Live map
  useEffect(() => {
    if (!mapContainer.current || map.current) return
    let cancelled = false

    const paperStyle = {
      version: 8,
      name: 'TFD Cadastre Preview',
      glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
      sources: {
        basemap: {
          type: 'vector',
          url: 'https://tiles.openfreemap.org/planet',
        },
      },
      layers: [
        {
          id: 'paper',
          type: 'background',
          paint: { 'background-color': palette.background || '#F7F5EF' },
        },
      ],
    }

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: paperStyle,
      center: TOGO_CENTER,
      zoom: 6.4,
      minZoom: 5,
      maxZoom: 15,
      attributionControl: false,
    })

    map.current.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

    const onZoom = () => setZoom(Number(map.current.getZoom().toFixed(1)))
    map.current.on('zoom', onZoom)

    map.current.on('load', async () => {
      if (cancelled) return
      map.current.resize()
      try {
        // Light basemap roads/water under cadastre demos
        if (!map.current.getLayer('water')) {
          map.current.addLayer({
            id: 'water',
            type: 'fill',
            source: 'basemap',
            'source-layer': 'water',
            paint: { 'fill-color': palette.water || '#DDECF2', 'fill-opacity': 0.85 },
          })
        }
      } catch {
        // OpenFreeMap source-layer names may differ; paper bg is enough
      }

      try {
        const res = await fetch('/data/communes.geojson')
        const communes = res.ok ? await res.json() : { features: [] }
        if (!communeDataProp) setCommuneDataLocal(communes)
        const urban = await loadUrbanismCollections()
        if (cancelled || !map.current) return
        const demos = buildDemoCollections(communes, { ...palette, ...URBANISM_PALETTE })
        addDemoLayers(map.current, demos)
        const infra = normalizeInfrastructure(urban.infrastructure)
        const buildings = normalizeBuildings(urban.buildings)
        const addresses = deriveAddressesFromBuildings(buildings)
        const logistics = buildLogisticsCollections(urban.roads, infra)
        addUrbanismStackLayers(map.current, {
          communes,
          localities: pickLocalities(urban),
          roads: urban.roads,
          buildings,
          infrastructure: infra,
          addresses,
          logistics,
          palette: URBANISM_PALETTE,
        })
        urbanismNationalRef.current = {
          roads: urban.roads,
          buildings,
          infrastructure: infra,
        }
        setMapReady(true)
        const uCounts = [
          `${urban.roads?.features?.length || 0} roads`,
          `${pickLocalities(urban).features?.length || 0} localities`,
          `${buildings.features?.length || 0} buildings`,
          `${infra.features?.length || 0} infra`,
          `${addresses.features?.length || 0} addr`,
          `${logistics.hubs?.features?.length || 0} hubs`,
        ].join(' · ')
        setStatus((s) => `${communes.features?.length || 0} communes · ${uCounts} · ${s}`)
        syncVisibility(DEFAULT_ACTIVE)
        requestAnimationFrame(() => map.current?.resize())
      } catch (e) {
        console.error(e)
        setMapReady(true)
        setStatus('Basemap ready · commune overlay unavailable')
      }
    })

    const onResize = () => map.current?.resize()
    window.addEventListener('resize', onResize)

    return () => {
      cancelled = true
      window.removeEventListener('resize', onResize)
      map.current?.off('zoom', onZoom)
      map.current?.remove()
      map.current = null
      setMapReady(false)
    }
    // palette captured at first mount — OK for explorer session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (mapReady) syncVisibility(active)
  }, [active, mapReady, syncVisibility])

  useEffect(() => {
    if (!mapReady || !map.current) return
    applyUrbanismCommuneFilter(map.current, selectedCommunes)
  }, [selectedCommunes, mapReady])

  useEffect(() => {
    if (!mapReady || !map.current) return
    let cancelled = false
    const code = selectedCommunes?.[0]
    const national = urbanismNationalRef.current
    if (!code) {
      if (national) {
        updateUrbanismStackSources(map.current, {
          roads: national.roads,
          buildings: national.buildings,
          infrastructure: national.infrastructure,
        })
      }
      return undefined
    }
    void loadCommuneUrbanismStack(code).then((stack) => {
      if (cancelled || !map.current) return
      const roads = stack.roads?.features?.length
        ? stack.roads
        : national?.roads
      const infrastructure = stack.infrastructure?.features?.length
        ? stack.infrastructure
        : national?.infrastructure
      updateUrbanismStackSources(map.current, {
        roads,
        infrastructure,
        buildings: { type: 'FeatureCollection', features: [] },
      })
      setStatus(
        `${code} · ${(roads?.features?.length || 0).toLocaleString()} roads · ${(infrastructure?.features?.length || 0).toLocaleString()} infra · nationwide localities`,
      )
    })
    return () => {
      cancelled = true
    }
  }, [selectedCommunes, mapReady])

  // Parcel hover / select using feature-state (real interaction contract)
  useEffect(() => {
    if (!mapReady || !map.current) return
    const m = map.current

    const clearHover = () => {
      if (hoveredParcel.current != null) {
        m.setFeatureState(
          { source: 'lx-parcels', id: hoveredParcel.current },
          { hover: false }
        )
        hoveredParcel.current = null
      }
    }

    const onMove = (e) => {
      const f = e.features?.[0]
      if (!f || f.id == null) {
        clearHover()
        m.getCanvas().style.cursor = ''
        return
      }
      if (hoveredParcel.current !== f.id) {
        clearHover()
        hoveredParcel.current = f.id
        m.setFeatureState({ source: 'lx-parcels', id: f.id }, { hover: true })
      }
      m.getCanvas().style.cursor = 'pointer'
    }

    const onClick = (e) => {
      const f = e.features?.[0]
      if (!f || f.id == null) return
      if (selectedParcel.current != null) {
        m.setFeatureState(
          { source: 'lx-parcels', id: selectedParcel.current },
          { selected: false }
        )
      }
      selectedParcel.current = f.id
      m.setFeatureState({ source: 'lx-parcels', id: f.id }, { selected: true })
      setSelected('parcels')
      setGroup('parcels')
      setInspectSample(f.properties)
      setInspectorKey((k) => k + 1)
      if (!active.includes('parcels')) {
        setActive((prev) => [...prev, 'parcels'])
      }
    }

    m.on('mousemove', 'lx-parcels-fill', onMove)
    m.on('mouseleave', 'lx-parcels-fill', () => {
      clearHover()
      m.getCanvas().style.cursor = ''
    })
    m.on('click', 'lx-parcels-fill', onClick)

    return () => {
      m.off('mousemove', 'lx-parcels-fill', onMove)
      m.off('click', 'lx-parcels-fill', onClick)
      clearHover()
    }
  }, [mapReady, active])

  const selectDataset = (id) => {
    const ds = DATASETS.find((d) => d.id === id)
    if (!ds) return
    setSelected(id)
    setGroup(ds.group)
    setInspectorKey((k) => k + 1)
    setInspectSample(null)
    if (!active.includes(id)) setActive((prev) => [...prev, id])
    if (map.current) {
      const center = ds.focusZoom >= 11 ? FOCUS_SOUTH : TOGO_CENTER
      map.current.easeTo({ center, zoom: ds.focusZoom, duration: 750 })
    }
  }

  const toggleDataset = (id) => {
    const ds = DATASETS.find((d) => d.id === id)
    setActive((prev) => {
      const on = prev.includes(id)
      let next = new Set(prev)
      if (on) {
        next.delete(id)
        // Parent off → children off
        const kids = URBANISM_PARENT_CHILDREN[id]
        if (kids) kids.forEach((c) => next.delete(c))
        // Child off → if parent has no remaining children, leave parent on/off as-is
        if (ds?.nestUnder) {
          const siblings = URBANISM_PARENT_CHILDREN[ds.nestUnder] || []
          const anyOn = siblings.some((c) => c !== id && next.has(c))
          if (!anyOn) next.delete(ds.nestUnder)
        }
        // Logistics parent section: no single parent id
        if (id === 'urbanism_buildings_3d' && map.current) {
          setUrbanismBuildings3d(map.current, false)
        }
      } else {
        next.add(id)
        // Parent on → all children on
        const kids = URBANISM_PARENT_CHILDREN[id]
        if (kids) kids.forEach((c) => next.add(c))
        // Child on → ensure parent on
        if (ds?.nestUnder) next.add(ds.nestUnder)
        if (id === 'urbanism_buildings_3d' && map.current) {
          setUrbanismBuildings3d(map.current, true)
          next.add('urbanism_buildings')
        }
      }
      return [...next]
    })
    setSelected(id)
    setInspectorKey((k) => k + 1)
  }

  const toggleLogisticsAll = () => {
    setActive((prev) => {
      const allOn = LOGISTICS_SUBLAYER_IDS.every((id) => prev.includes(id))
      const next = new Set(prev)
      if (allOn) LOGISTICS_SUBLAYER_IDS.forEach((id) => next.delete(id))
      else LOGISTICS_SUBLAYER_IDS.forEach((id) => next.add(id))
      return [...next]
    })
    setSelected('logistics_driving')
  }

  const color = (key) =>
    palette[key] || URBANISM_PALETTE[key] || FALLBACK_PALETTE[key] || '#8A6D3B'
  const zHighlight = DATASET_Z[selectedDataset.id]

  const renderDatasetRow = (ds, { nested = false } = {}) => {
    const on = active.includes(ds.id)
    const sel = selected === ds.id
    const kids = nested ? [] : childrenOf(ds.id)
    return (
      <li key={ds.id}>
        <div
          className={`lx-row ${sel ? 'is-selected' : ''} ${on ? 'is-on' : ''} ${nested ? 'is-nested' : ''}`}
          style={{ '--layer-color': color(ds.colorKey) }}
        >
          <button
            type="button"
            className={`lx-switch ${on ? 'is-on' : ''}`}
            role="switch"
            aria-checked={on}
            aria-label={`Toggle ${ds.name}`}
            onClick={() => toggleDataset(ds.id)}
          >
            <span className="lx-switch-knob" />
          </button>
          <button
            type="button"
            className="lx-row-select"
            onClick={() => selectDataset(ds.id)}
          >
            <span className="lx-row-body">
              <span className="lx-row-name">
                {ds.name}
                {ds.stub ? <em className="lx-stub"> stub</em> : null}
              </span>
              <span className="lx-row-zoom">from z{ds.minzoom}</span>
            </span>
            <span className="lx-row-dot" />
          </button>
        </div>
        {kids.length > 0 && (
          <div className="lx-pills" role="group" aria-label={`${ds.name} sub-layers`}>
            {kids.map((child) => {
              const childOn = active.includes(child.id)
              return (
                <button
                  key={child.id}
                  type="button"
                  className={`lx-pill ${childOn ? 'is-on' : ''} ${selected === child.id ? 'is-selected' : ''}`}
                  style={{ '--layer-color': color(child.colorKey) }}
                  onClick={() => toggleDataset(child.id)}
                  onDoubleClick={() => selectDataset(child.id)}
                  title={child.purpose}
                >
                  <span className="lx-pill-swatch" />
                  {child.name}
                </button>
              )
            })}
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="lx">
      <header className="lx-hero">
        <div className="lx-hero-copy">
          <p className="lx-eyebrow">TFD Cadastre · MapLibre theme</p>
          <h1 className="lx-title">
            See every layer
            <span className="lx-title-accent">in action.</span>
          </h1>
          <p className="lx-lede">
            Urbanism is the full stack with planning color coding — communes, localities, road
            classes, building use, infrastructure equipment, logistics corridors, plus POS/PDU
            overlays. Classic <code>t_addr</code> swatches appear in the legend. Cadastre groups keep
            earth-tone styling. Localities are nationwide; majors roads are national;
            local voirie / équipements load when you select a commune.
          </p>
        </div>
        <div className="lx-hero-meta">
          <div className="lx-meta-block">
            <span className="lx-meta-label">Visible</span>
            <span className="lx-meta-value">
              {active.length}
              <span className="lx-meta-dim">/{DATASETS.length}</span>
            </span>
          </div>
          <div className="lx-meta-block">
            <span className="lx-meta-label">Map zoom</span>
            <span className="lx-meta-value">z{zoom}</span>
          </div>
          <p className="lx-meta-status">{status}</p>
        </div>
      </header>

      <div className="lx-groups" role="tablist" aria-label="Layer groups">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={group === g.id}
            className={`lx-group ${group === g.id ? 'is-active' : ''}`}
            onClick={() => {
              setGroup(g.id)
              if (g.id === 'urbanism') {
                setActive((prev) => {
                  const next = new Set(prev)
                  URBANISM_DEFAULT_ACTIVE.forEach((id) => next.add(id))
                  return [...next]
                })
                setSelected('urbanism_roads')
                if (map.current) {
                  map.current.easeTo({ center: LOME_CENTER, zoom: LOME_ZOOM, duration: 800 })
                }
                return
              }
              const first = DATASETS.find((d) => d.group === g.id)
              if (first) selectDataset(first.id)
            }}
          >
            {g.name}
          </button>
        ))}
      </div>

      <div className="lx-stage">
        <aside className="lx-rail" aria-label="Datasets">
          <div className="lx-rail-head">
            <span>{GROUPS.find((g) => g.id === group)?.name}</span>
            <span className="lx-rail-count">
              {group === 'urbanism'
                ? (urbanismSections?.core.length || 0) + (urbanismSections?.logistics.length || 0)
                : groupDatasets.length}
            </span>
          </div>
          <ul className="lx-list">
            {group === 'urbanism' && urbanismSections ? (
              <>
                {urbanismSections.core.map((ds) => renderDatasetRow(ds))}
                <li className="lx-section-head">
                  <button
                    type="button"
                    className={`lx-section-toggle ${LOGISTICS_SUBLAYER_IDS.every((id) => active.includes(id)) ? 'is-on' : ''}`}
                    onClick={toggleLogisticsAll}
                  >
                    <span className="lx-section-label">Logistics</span>
                    <span className="lx-section-hint">routes · hubs · last-mile</span>
                  </button>
                </li>
                {urbanismSections.logistics.map((ds) => renderDatasetRow(ds, { nested: true }))}
              </>
            ) : (
              groupDatasets.map((ds) => renderDatasetRow(ds))
            )}
          </ul>

          {group === 'urbanism' && communeData && (
            <div className="lx-commune-filter">
              <CommuneFilter
                communes={communeData}
                selectedCodes={selectedCommunes}
                onChange={setSelectedCommunes}
              />
            </div>
          )}

          <div className="lx-zstack" aria-label="Z-order">
            <div className="lx-zstack-label">Z-order</div>
            <ol className="lx-zstack-list">
              {Z_ORDER.map((step, i) => (
                <li
                  key={step.id}
                  className={`lx-zstack-item ${zHighlight === step.id ? 'is-hot' : ''}`}
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <span className="lx-zstack-idx">{String(i + 1).padStart(2, '0')}</span>
                  {step.label}
                </li>
              ))}
            </ol>
          </div>
        </aside>

        <section className="lx-map-wrap" aria-label="Live cadastre preview">
          <div ref={mapContainer} className="lx-map" />
          {!mapReady && <div className="lx-map-loading">Preparing cadastre preview…</div>}
          <div className="lx-map-chrome">
            <div className="lx-map-badge">
              <span className="lx-map-badge-dot" style={{ background: color(selectedDataset.colorKey) }} />
              {selectedDataset.name}
              <span className="lx-map-badge-dim">· demo · feature-state hover</span>
            </div>
            <div className="lx-zoom-bands">
              {(selectedDataset.zoomBands || []).map((band) => (
                <span
                  key={band.label}
                  className={`lx-zoom-chip ${zoom >= band.from ? 'is-live' : ''} ${band.toggle ? 'is-toggle' : ''}`}
                >
                  {band.label}
                  <em>z{band.from}+</em>
                  {band.toggle ? ' toggle' : ''}
                </span>
              ))}
            </div>
          </div>
        </section>

        <aside className="lx-inspector" aria-label="Inspector">
          <div className="lx-inspector-head">
            <span>Inspector</span>
            <span className="lx-chip" style={{ color: color(selectedDataset.colorKey), background: `${color(selectedDataset.colorKey)}22` }}>
              {selectedDataset.promoteId}
            </span>
          </div>

          <div key={inspectorKey} className="lx-inspector-body">
            <div className="lx-inspector-title">
              <span className="lx-swatch" style={{ background: color(selectedDataset.colorKey) }} />
              <div>
                <h2>{selectedDataset.name}</h2>
                <p>{selectedDataset.purpose}</p>
              </div>
            </div>

            <dl className="lx-attrs">
              <div>
                <dt>Group</dt>
                <dd>{GROUPS.find((g) => g.id === selectedDataset.group)?.name}</dd>
              </div>
              <div>
                <dt>Source layer</dt>
                <dd>{selectedDataset.sourceLayers.join(', ')}</dd>
              </div>
              <div>
                <dt>promoteId</dt>
                <dd>{selectedDataset.promoteId}</dd>
              </div>
              <div>
                <dt>Style layers</dt>
                <dd>{selectedDataset.styleLayers.length}</dd>
              </div>
              {selectedDataset.featureState && (
                <div>
                  <dt>feature-state</dt>
                  <dd>{selectedDataset.featureState.join(', ')}</dd>
                </div>
              )}
            </dl>

            <div className="lx-fields">
              <div className="lx-fields-label">metadata.tfd:inspector</div>
              <ul>
                {selectedDataset.inspector.map((field) => (
                  <li key={field}>
                    <code>{field}</code>
                    {inspectSample?.[field] != null && (
                      <span className="lx-field-val">{String(inspectSample[field])}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {selectedDataset.sensitive && (
              <p className="lx-privacy">
                Sensitive fields excluded from public tiles:{' '}
                {selectedDataset.sensitive.join(', ')}.
                {selectedDataset.privacy ? ` ${selectedDataset.privacy}.` : ''}
              </p>
            )}

            {styleMeta?.['tfd:privacy'] && selectedDataset.id === 'parcels' && (
              <p className="lx-privacy">
                Style privacy: publicOwnerLabels=
                {String(styleMeta['tfd:privacy'].publicOwnerLabels)}
              </p>
            )}

            <div className="lx-style-layers">
              <div className="lx-fields-label">Style layer IDs</div>
              <div className="lx-layer-ids">
                {selectedDataset.styleLayers.map((id) => (
                  <code key={id}>{id}</code>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <footer className="lx-legend" aria-label="Cadastre and urbanism palette">
        <span className="lx-legend-title">Land use</span>
        {[
          ['Residential', 'parcel_residential'],
          ['Commercial', 'parcel_commercial'],
          ['Agriculture', 'parcel_agriculture'],
          ['Public', 'parcel_public'],
          ['Industrial', 'parcel_industrial'],
        ].map(([label, key]) => (
          <button
            key={key}
            type="button"
            className={`lx-legend-item ${active.includes('parcels') ? 'is-on' : ''}`}
            style={{ '--layer-color': color(key) }}
            onClick={() => selectDataset('parcels')}
          >
            <span className="lx-legend-mark" />
            {label}
          </button>
        ))}
        <span className="lx-legend-sep" />
        <span className="lx-legend-title">Roads</span>
        {ROAD_CLASS_DEFS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`lx-legend-item ${active.includes(`urbanism_roads_${c.id}`) ? 'is-on' : ''}`}
            style={{ '--layer-color': color(c.colorKey) }}
            onClick={() => selectDataset(`urbanism_roads_${c.id}`)}
          >
            <span className="lx-legend-mark" />
            {c.label}
          </button>
        ))}
        <span className="lx-legend-sep" />
        <span className="lx-legend-title">Infra</span>
        {INFRA_GROUP_DEFS.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`lx-legend-item ${active.includes(`urbanism_infra_${g.id}`) ? 'is-on' : ''}`}
            style={{ '--layer-color': color(g.colorKey) }}
            onClick={() => selectDataset(`urbanism_infra_${g.id}`)}
          >
            <span className="lx-legend-mark" />
            {g.label}
          </button>
        ))}
        <span className="lx-legend-sep" />
        <span className="lx-legend-title">Logistics</span>
        {[
          ['Drive', 'logistics_drive', 'logistics_driving'],
          ['Delivery', 'logistics_delivery', 'logistics_delivery'],
          ['Corridor', 'logistics_corridor', 'logistics_corridors'],
          ['Hubs', 'logistics_hub', 'logistics_hubs'],
          ['Transit', 'logistics_transit', 'logistics_transit'],
        ].map(([label, key, id]) => (
          <button
            key={key}
            type="button"
            className={`lx-legend-item ${active.includes(id) ? 'is-on' : ''}`}
            style={{ '--layer-color': color(key) }}
            onClick={() => selectDataset(id)}
          >
            <span className="lx-legend-mark" />
            {label}
          </button>
        ))}
        <span className="lx-legend-sep" />
        <span className="lx-legend-title">Classic / t_addr</span>
        {T_ADDR_LEGEND_SWATCHES.map((sw) => (
          <span
            key={sw.id}
            className="lx-legend-item is-on lx-legend-classic"
            style={{ '--layer-color': sw.color }}
            title={`${sw.label} · ${sw.color}`}
          >
            <span className="lx-legend-mark" />
            {sw.label}
          </span>
        ))}
        <span className="lx-legend-sep" />
        {[
          ['Cadastre', 'cadastre'],
          ['Parcel outline', 'parcel_outline'],
          ['Buildings', 'building'],
          ['Encumbrance', 'encumbrance'],
          ['Active title', 'title_active'],
        ].map(([label, key]) => (
          <span key={key} className="lx-legend-item is-on" style={{ '--layer-color': color(key) }}>
            <span className="lx-legend-mark" />
            {label}
          </span>
        ))}
      </footer>
    </div>
  )
}
