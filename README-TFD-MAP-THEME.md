# TFD MapLibre Cadastre Theme

Files:
- `tfd-maplibre-style-light.json` — light theme.
- `tfd-maplibre-style-dark.json` — dark theme.
- `tfd-layer-manifest.json` — logical layer catalog, zooms, palette, z-order, privacy and export profiles.
- `tfd-map-interactions.js` — parcel hover/select plus inspector hooks and layer toggles.
- `tfd-postgis-vector-tiles.sql` — optional PostGIS/Supabase starter schema and multi-layer MVT function.

Replace `YOUR_TILE_HOST` in both style files. Keep private rights-holder, mortgagee, dispute-party and identity fields out of public MVT responses.
