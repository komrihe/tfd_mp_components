# Urbanisme GeoJSON (map-explorer/public/data)

Sourced from `TFD/tefedila_project/core-js/data` and Cadastre Studio commune packs.
Preferred regenerate path: Cadastre Studio `npm run data:sync:urbanism-geojson` (mirrors here when sibling path exists).

## Coverage strategy

| Asset | Scope | Notes |
|---|---|---|
| `urbanism-localities.geojson` | **National** | ~1011 locality polygons from commune-addressing. |
| `urbanism-localities-lome.geojson` | DAGL Lomé | Merged into the localities layer. |
| `urbanism-roads.geojson` | **National majors** | Trunk→tertiary (~4 MB). |
| `commune-roads/{CODE}.json` | **Commune-scoped** | Full local roads when a commune is selected (symlink/copy from Studio). |
| `pois/{CODE}.json` | **Commune-scoped** | Infrastructure points for the selected commune. |
| `urbanism-buildings.geojson` | Lomé bootstrap | Theme demo footprints. |
| `urbanism-infrastructure.geojson` | Lomé bootstrap | Replaced by commune POIs on selection. |
| `communes.geojson` | **National** (117) | Official boundaries. |

Do **not** ship the full national driveable roads (~36–209 MB) as a single browser payload.

## How to see non-Lomé localities

1. Open Urbanism group — localities paint nationwide.
2. Use the commune filter (e.g. **E07113 Tône 1**): local roads + infra load from packs; majors remain as fallback if a pack is missing.
3. Clear selection to restore national majors + bootstrap buildings/infra.
