**Custom MapLibre Themed Tile Layers – TFD Cadastre Theme**

Below is a complete, production-oriented MapLibre GL JS style specification for a cadastral / land-administration map. It includes clear layer ordering (z-index via array order), optimized paint/layout, mobile-friendly defaults, light + dark variants, label collision management, smooth zoom transitions, hover/click hooks, and Attribute Inspector compatibility.

### 1. Suggested Color Palette

| Layer Group          | Light Theme                  | Dark Theme                     | Notes |
|----------------------|------------------------------|--------------------------------|-------|
| Background           | `#f8f5f0`                    | `#1a1d23`                      | Warm paper / deep slate |
| Cadastre Grid        | `#c9b8a8` (fill) / `#8b7355` | `#3d342c` / `#a89070`          | Subtle earth tones |
| Streets              | `#ffffff` → `#e8e4df`        | `#2a2e36` → `#3a404c`          | Road casings darker |
| Parcels              | `#e8f0e0` / `#7a9e6a`        | `#2d3a2a` / `#8fbc7a`          | Soft green ownership |
| Parcel Boundaries    | `#5c4033`                    | `#d4a574`                      | High-contrast survey lines |
| Buildings            | `#d4c4b0` / `#a89070`        | `#4a4038` / `#c4a882`          | Footprint fill + outline |
| Addresses            | `#2c3e50`                    | `#e8e4df`                      | High legibility |
| Admin Units          | `#b8c9d9` → `#6b8cae`        | `#2a3540` → `#5a7a9a`          | Hierarchical blues |
| Cadastral Sheets     | `#f0e6d8` / `#c9a87c`        | `#2e2820` / `#b89a6e`          | Legacy paper feel |
| Titles / Rights      | `#d4e8f0` / `#4a90a4`        | `#1e2e38` / `#6ab0c4`          | Trust / official cyan |
| Encumbrances         | `#f5d0d0` / `#c45c5c`        | `#3a2222` / `#e07070`          | Warning red |

### 2. Recommended Zoom Visibility

| Layer                        | Min Zoom | Max Zoom | Notes |
|------------------------------|----------|----------|-------|
| Administrative Units         | 6        | 14       | Fade out at detailed scales |
| Cadastral Sheets / Sections  | 10       | 16       | Legacy reference |
| TFD Cadastre Grid            | 12       | 22       | Cell codes appear ≥14 |
| Streets (major)              | 8        | 22       | Classification-driven |
| Streets (minor / names)      | 13       | 22       | |
| Parcels                      | 14       | 22       | |
| Parcel Boundaries            | 15       | 22       | High detail |
| Buildings                    | 15       | 22       | Optional 3D ≥16 |
| Addresses                    | 16       | 22       | |
| Owners / Rights Holders      | 15       | 22       | Linked via feature-state |
| Land Titles                  | 15       | 22       | |
| Encumbrances                 | 15       | 22       | |

### 3. Full MapLibre Style JSON (Light Theme)

```json
{
  "version": 8,
  "name": "TFD Cadastre Theme – Light",
  "metadata": {
    "maplibre:groups": {
      "cadastre": { "name": "Cadastre", "collapsed": false },
      "parcels": { "name": "Parcels & Rights", "collapsed": false },
      "buildings": { "name": "Buildings & Addresses", "collapsed": false },
      "admin": { "name": "Administrative", "collapsed": true }
    }
  },
  "sources": {
    "tfd-tiles": {
      "type": "vector",
      "tiles": ["https://your-tile-server.com/tfd/{z}/{x}/{y}.pbf"],
      "minzoom": 6,
      "maxzoom": 18,
      "attribution": "© TFD Cadastre"
    },
    "raster-basemap": {
      "type": "raster",
      "tiles": ["https://your-raster/{z}/{x}/{y}.png"],
      "tileSize": 256,
      "maxzoom": 19
    }
  },
  "sprite": "https://your-cdn.com/sprites/tfd",
  "glyphs": "https://your-cdn.com/fonts/{fontstack}/{range}.pbf",
  "layers": [
    {
      "id": "background",
      "type": "background",
      "paint": {
        "background-color": "#f8f5f0"
      }
    },
    {
      "id": "admin-units-fill",
      "type": "fill",
      "source": "tfd-tiles",
      "source-layer": "admin_units",
      "minzoom": 6,
      "maxzoom": 14,
      "paint": {
        "fill-color": [
          "match",
          ["get", "level"],
          "region", "#b8c9d9",
          "prefecture", "#9bb0c8",
          "commune", "#7a96b5",
          "canton", "#6b8cae",
          "#a0b8d0"
        ],
        "fill-opacity": [
          "interpolate", ["linear"], ["zoom"],
          6, 0.35,
          12, 0.18,
          14, 0.05
        ]
      },
      "layout": { "visibility": "visible" }
    },
    {
      "id": "admin-units-outline",
      "type": "line",
      "source": "tfd-tiles",
      "source-layer": "admin_units",
      "minzoom": 6,
      "maxzoom": 15,
      "paint": {
        "line-color": "#5a7a9a",
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          6, 1.5,
          12, 2.5,
          14, 1.2
        ],
        "line-opacity": 0.7
      }
    },
    {
      "id": "cadastral-sheets",
      "type": "fill",
      "source": "tfd-tiles",
      "source-layer": "cadastral_sheets",
      "minzoom": 10,
      "maxzoom": 16,
      "paint": {
        "fill-color": "#f0e6d8",
        "fill-opacity": 0.25,
        "fill-outline-color": "#c9a87c"
      }
    },
    {
      "id": "tfd-cadastre-grid",
      "type": "fill",
      "source": "tfd-tiles",
      "source-layer": "tfd_cadastre",
      "minzoom": 12,
      "paint": {
        "fill-color": "#c9b8a8",
        "fill-opacity": [
          "interpolate", ["linear"], ["zoom"],
          12, 0.15,
          16, 0.08,
          18, 0.04
        ],
        "fill-outline-color": "#8b7355"
      }
    },
    {
      "id": "tfd-cadastre-cells",
      "type": "line",
      "source": "tfd-tiles",
      "source-layer": "tfd_cadastre",
      "minzoom": 13,
      "paint": {
        "line-color": "#8b7355",
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          13, 0.6,
          16, 1.2,
          19, 1.8
        ],
        "line-opacity": 0.85
      }
    },
    {
      "id": "tfd-cadastre-labels",
      "type": "symbol",
      "source": "tfd-tiles",
      "source-layer": "tfd_cadastre",
      "minzoom": 14,
      "layout": {
        "text-field": ["get", "cell_code"],
        "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
        "text-size": [
          "interpolate", ["linear"], ["zoom"],
          14, 10,
          17, 13,
          20, 15
        ],
        "text-anchor": "center",
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        "symbol-placement": "point",
        "text-max-width": 8
      },
      "paint": {
        "text-color": "#5c4033",
        "text-halo-color": "#f8f5f0",
        "text-halo-width": 1.5,
        "text-opacity": [
          "interpolate", ["linear"], ["zoom"],
          14, 0.7,
          16, 1
        ]
      }
    },
    {
      "id": "streets-casing",
      "type": "line",
      "source": "tfd-tiles",
      "source-layer": "streets",
      "minzoom": 8,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#c9b8a8",
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          8, ["match", ["get", "class"], "motorway", 4, "primary", 3, "secondary", 2.5, 1.5],
          14, ["match", ["get", "class"], "motorway", 12, "primary", 9, "secondary", 7, 4],
          18, ["match", ["get", "class"], "motorway", 22, "primary", 16, "secondary", 12, 7]
        ]
      }
    },
    {
      "id": "streets-fill",
      "type": "line",
      "source": "tfd-tiles",
      "source-layer": "streets",
      "minzoom": 8,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": [
          "match",
          ["get", "class"],
          "motorway", "#ffffff",
          "primary", "#f5f2ed",
          "secondary", "#f0ece6",
          "#e8e4df"
        ],
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          8, ["match", ["get", "class"], "motorway", 2.5, "primary", 2, "secondary", 1.5, 0.8],
          14, ["match", ["get", "class"], "motorway", 9, "primary", 6.5, "secondary", 5, 2.5],
          18, ["match", ["get", "class"], "motorway", 18, "primary", 13, "secondary", 9, 4.5]
        ]
      }
    },
    {
      "id": "streets-labels",
      "type": "symbol",
      "source": "tfd-tiles",
      "source-layer": "streets",
      "minzoom": 13,
      "layout": {
        "text-field": ["get", "name"],
        "text-font": ["Open Sans Semibold", "Arial Unicode MS Regular"],
        "text-size": [
          "interpolate", ["linear"], ["zoom"],
          13, 11,
          16, 13,
          19, 15
        ],
        "symbol-placement": "line",
        "text-rotation-alignment": "map",
        "text-pitch-alignment": "viewport",
        "text-max-angle": 30,
        "text-padding": 2,
        "text-allow-overlap": false
      },
      "paint": {
        "text-color": "#3d342c",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.8,
        "text-halo-blur": 0.5
      }
    },
    {
      "id": "parcels-fill",
      "type": "fill",
      "source": "tfd-tiles",
      "source-layer": "parcels",
      "minzoom": 14,
      "paint": {
        "fill-color": [
          "case",
          ["boolean", ["feature-state", "hover"], false], "#a8d08d",
          ["boolean", ["feature-state", "selected"], false], "#7a9e6a",
          "#e8f0e0"
        ],
        "fill-opacity": [
          "interpolate", ["linear"], ["zoom"],
          14, 0.45,
          17, 0.55,
          20, 0.4
        ],
        "fill-outline-color": "#7a9e6a"
      }
    },
    {
      "id": "parcel-boundaries",
      "type": "line",
      "source": "tfd-tiles",
      "source-layer": "parcel_boundaries",
      "minzoom": 15,
      "paint": {
        "line-color": [
          "match",
          ["get", "accuracy_class"],
          "surveyed", "#5c4033",
          "approximate", "#8b7355",
          "#a89070"
        ],
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          15, 0.8,
          18, 1.6,
          20, 2.2
        ],
        "line-dasharray": [
          "match",
          ["get", "accuracy_class"],
          "approximate", ["literal", [2, 1.5]],
          ["literal", [1, 0]]
        ]
      }
    },
    {
      "id": "buildings-fill",
      "type": "fill",
      "source": "tfd-tiles",
      "source-layer": "buildings",
      "minzoom": 15,
      "paint": {
        "fill-color": "#d4c4b0",
        "fill-opacity": 0.85,
        "fill-outline-color": "#a89070"
      }
    },
    {
      "id": "buildings-3d",
      "type": "fill-extrusion",
      "source": "tfd-tiles",
      "source-layer": "buildings",
      "minzoom": 16,
      "paint": {
        "fill-extrusion-color": "#d4c4b0",
        "fill-extrusion-height": ["coalesce", ["get", "height"], ["*", ["get", "floors"], 3.2], 6],
        "fill-extrusion-base": 0,
        "fill-extrusion-opacity": 0.9
      },
      "layout": { "visibility": "none" }
    },
    {
      "id": "addresses",
      "type": "symbol",
      "source": "tfd-tiles",
      "source-layer": "addresses",
      "minzoom": 16,
      "layout": {
        "text-field": ["get", "housenumber"],
        "text-font": ["Open Sans Bold", "Arial Unicode MS Regular"],
        "text-size": [
          "interpolate", ["linear"], ["zoom"],
          16, 11,
          19, 14
        ],
        "text-anchor": "center",
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        "text-padding": 4,
        "symbol-sort-key": ["get", "priority"]
      },
      "paint": {
        "text-color": "#2c3e50",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.8
      }
    },
    {
      "id": "owners-points",
      "type": "circle",
      "source": "tfd-tiles",
      "source-layer": "owners",
      "minzoom": 15,
      "paint": {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          15, 3,
          18, 5
        ],
        "circle-color": [
          "match",
          ["get", "ownership_type"],
          "freehold", "#4a90a4",
          "leasehold", "#6ab0c4",
          "communal", "#8fbc7a",
          "#a0a0a0"
        ],
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#ffffff",
        "circle-opacity": 0.9
      }
    },
    {
      "id": "land-titles",
      "type": "symbol",
      "source": "tfd-tiles",
      "source-layer": "land_titles",
      "minzoom": 15,
      "layout": {
        "text-field": ["get", "title_number"],
        "text-font": ["Open Sans Regular"],
        "text-size": 11,
        "text-offset": [0, 1.2],
        "text-anchor": "top",
        "text-allow-overlap": false
      },
      "paint": {
        "text-color": "#4a90a4",
        "text-halo-color": "#f8f5f0",
        "text-halo-width": 1.2
      }
    },
    {
      "id": "encumbrances",
      "type": "fill",
      "source": "tfd-tiles",
      "source-layer": "encumbrances",
      "minzoom": 15,
      "paint": {
        "fill-color": "#f5d0d0",
        "fill-opacity": 0.45,
        "fill-pattern": "hatch-red"
      }
    },
    {
      "id": "encumbrances-outline",
      "type": "line",
      "source": "tfd-tiles",
      "source-layer": "encumbrances",
      "minzoom": 15,
      "paint": {
        "line-color": "#c45c5c",
        "line-width": 1.8,
        "line-dasharray": [3, 2]
      }
    }
  ]
}
```

### 4. Layer Manifest (Export-ready)

```json
{
  "theme": "TFD Cadastre",
  "version": "1.0.0",
  "layers": [
    {
      "id": "tfd-cadastre-grid",
      "type": "fill",
      "source": "tfd-tiles",
      "source-layer": "tfd_cadastre",
      "description": "Cadastre grid cells + locality polygons",
      "attributes": ["cell_code", "hierarchy", "locality_id"],
      "interactive": true,
      "inspector": true,
      "z-index": 30
    },
    {
      "id": "streets-fill",
      "type": "line",
      "source": "tfd-tiles",
      "source-layer": "streets",
      "description": "Road centerlines with classification & ROW",
      "attributes": ["name", "class", "right_of_way", "surface"],
      "interactive": true,
      "inspector": true,
      "z-index": 40
    },
    {
      "id": "parcels-fill",
      "type": "fill",
      "source": "tfd-tiles",
      "source-layer": "parcels",
      "description": "Parcel polygons with ownership, area, land use, valuation",
      "attributes": ["parcel_id", "owner_id", "area_m2", "land_use", "valuation", "status"],
      "interactive": true,
      "hover": true,
      "inspector": true,
      "z-index": 50
    },
    {
      "id": "parcel-boundaries",
      "type": "line",
      "source": "tfd-tiles",
      "source-layer": "parcel_boundaries",
      "description": "Surveyed boundary lines + accuracy class + markers",
      "attributes": ["accuracy_class", "survey_date", "marker_type"],
      "interactive": true,
      "inspector": true,
      "z-index": 55
    },
    {
      "id": "buildings-fill",
      "type": "fill",
      "source": "tfd-tiles",
      "source-layer": "buildings",
      "description": "Building footprints, floors, height, use",
      "attributes": ["building_id", "floors", "height", "use", "year_built"],
      "interactive": true,
      "inspector": true,
      "z-index": 60
    },
    {
      "id": "addresses",
      "type": "symbol",
      "source": "tfd-tiles",
      "source-layer": "addresses",
      "description": "House numbers + street names (geocoded)",
      "attributes": ["housenumber", "street", "unit", "postcode"],
      "interactive": true,
      "inspector": true,
      "z-index": 70
    },
    {
      "id": "owners-points",
      "type": "circle",
      "source": "tfd-tiles",
      "source-layer": "owners",
      "description": "Rights holders linked to parcels",
      "attributes": ["owner_id", "ownership_type", "tenure", "name"],
      "interactive": true,
      "inspector": true,
      "z-index": 65
    },
    {
      "id": "admin-units-fill",
      "type": "fill",
      "source": "tfd-tiles",
      "source-layer": "admin_units",
      "description": "Region → Prefecture → Commune → Canton → Quartier",
      "attributes": ["level", "name", "code", "parent_id"],
      "interactive": true,
      "inspector": true,
      "z-index": 10
    },
    {
      "id": "cadastral-sheets",
      "type": "fill",
      "source": "tfd-tiles",
      "source-layer": "cadastral_sheets",
      "description": "Legacy sheet references + section codes",
      "attributes": ["sheet_ref", "section_code", "year"],
      "interactive": true,
      "inspector": true,
      "z-index": 20
    },
    {
      "id": "land-titles",
      "type": "symbol",
      "source": "tfd-tiles",
      "source-layer": "land_titles",
      "description": "Title number, status, issuance date",
      "attributes": ["title_number", "status", "issued", "expires"],
      "interactive": true,
      "inspector": true,
      "z-index": 68
    },
    {
      "id": "encumbrances",
      "type": "fill",
      "source": "tfd-tiles",
      "source-layer": "encumbrances",
      "description": "Easements, servitudes, disputes, mortgages",
      "attributes": ["type", "status", "parties", "registered"],
      "interactive": true,
      "inspector": true,
      "z-index": 58
    }
  ]
}
```

### 5. Dark Mode Variant (key differences)

Replace the light style’s paint values with:

```json
{
  "id": "background",
  "paint": { "background-color": "#1a1d23" }
},
{
  "id": "parcels-fill",
  "paint": {
    "fill-color": [
      "case",
      ["boolean", ["feature-state", "hover"], false], "#8fbc7a",
      ["boolean", ["feature-state", "selected"], false], "#6a9e5a",
      "#2d3a2a"
    ]
  }
},
{
  "id": "streets-fill",
  "paint": {
    "line-color": [
      "match", ["get", "class"],
      "motorway", "#3a404c",
      "primary", "#343a45",
      "#2a2e36"
    ]
  }
},
{
  "id": "addresses",
  "paint": {
    "text-color": "#e8e4df",
    "text-halo-color": "#1a1d23"
  }
}
```

(Apply the full dark palette from the table above consistently.)

### 6. Optional Vector Tile Schema (PostGIS → Tippecanoe / pg_tileserv / Martin)

```sql
-- Example simplified schema
CREATE TABLE parcels (
  id bigserial PRIMARY KEY,
  geom geometry(Polygon, 4326),
  parcel_id text UNIQUE,
  owner_id bigint,
  area_m2 numeric,
  land_use text,
  valuation numeric,
  status text
);

CREATE TABLE parcel_boundaries (
  id bigserial PRIMARY KEY,
  geom geometry(LineString, 4326),
  parcel_id text,
  accuracy_class text, -- surveyed | approximate
  survey_date date
);

-- Tippecanoe example
-- tippecanoe -o tfd.mbtiles \
--   -l parcels -l parcel_boundaries -l buildings \
--   -l streets -l addresses -l tfd_cadastre \
--   -l admin_units -l cadastral_sheets \
--   -l land_titles -l encumbrances -l owners \
--   --minimum-zoom=6 --maximum-zoom=18 \
--   --drop-densest-as-needed \
--   --extend-zooms-if-still-dropping \
--   parcels.geojson ...
```

### 7. Interactivity Hooks (MapLibre JS)

```js
// Hover highlight for parcels
map.on('mousemove', 'parcels-fill', (e) => {
  if (e.features.length > 0) {
    map.getCanvas().style.cursor = 'pointer';
    const id = e.features[0].id;
    map.setFeatureState({ source: 'tfd-tiles', sourceLayer: 'parcels', id }, { hover: true });
  }
});
map.on('mouseleave', 'parcels-fill', () => {
  map.getCanvas().style.cursor = '';
  // clear previous feature-state
});

// Click → Attribute Inspector
map.on('click', 'parcels-fill', (e) => {
  const props = e.features[0].properties;
  // open your inspector panel with props
});
```

### 8. Optional Add-ons Ready

- **Highlight-on-hover**: already implemented via `feature-state` on `parcels-fill`.
- **3D Buildings**: toggle `buildings-3d` visibility; uses `height` or `floors × 3.2`.
- **Label decluttering**: `text-allow-overlap: false` + `text-padding` + `symbol-sort-key` already set.
- **Print/Export mode**: add a high-contrast layer group and increase line widths / text sizes when `map.getPitch() === 0 && map.getBearing() === 0`.

---

**Next steps you can request**

- “Generate the full dark mode style.json”
- “Generate the complete PostGIS + Tippecanoe schema”
- “Add print/export mode layers”
- “Add offline tile caching strategy”
- “Produce a ready-to-drop `style.json` file”

Just say the word and I’ll output the exact artifact.