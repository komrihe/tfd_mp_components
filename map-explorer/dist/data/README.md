# Urbanism demo GeoJSON (map-explorer/public/data)

Sourced from `/Users/richardhemedzo/development/KMW/TFD/tefedila_project/core-js/data`.

| File | Source | Notes |
|---|---|---|
| `communes.geojson` | official-admin-boundaries/layers/communes.geojson | Full 117 communes |
| `urbanism-roads.geojson` | tfd-hierarchy-data-togo-gis/roads/roads.geojson | Lomé bbox spat filter; LineString highways; capped ~8k features |
| `urbanism-buildings.geojson` | canonical/infrastructure/roads/roads.geojson (OSM overpass) | `building IS NOT NULL`, Lomé core spat |
| `urbanism-infrastructure.geojson` | same overpass | amenities/shop/leisure/tourism/power in Lomé core |
| `urbanism-localities.geojson` | overpass/localities/localities.geojson | Lomé bbox clip |
| `urbanism-localities-lome.geojson` | dagl-lome-sublocality-reference.geojson | Preferred for Localities layer (DAGL context) |

Heavy national extracts were not copied whole (roads ~49–208MB). Browser preview uses Lomé metro subsample.
