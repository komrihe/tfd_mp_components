export default function LayerInspector({ feature, onClose }) {
  if (!feature) return null

  const properties = feature.properties || {}
  const sourceLayer = feature.sourceLayer || feature['source-layer'] || feature.source || 'geojson'
  const geometry = feature.geometry

  return (
    <div className="panel inspector-panel">
      <div className="inspector-header">
        <h2>Feature Inspector</h2>
        <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="inspector-content">
        <div className="inspector-section">
          <h3>Layer Info</h3>
          <div className="property-item">
            <span className="property-label">Source:</span>
            <code>{sourceLayer}</code>
          </div>
          <div className="property-item">
            <span className="property-label">Geometry:</span>
            <code>{geometry?.type || 'unknown'}</code>
          </div>
        </div>

        <div className="inspector-section">
          <h3>Properties ({Object.keys(properties).length})</h3>
          {Object.keys(properties).length > 0 ? (
            <div className="properties-list">
              {Object.entries(properties).map(([key, value]) => (
                <div key={key} className="property-item">
                  <span className="property-label">{key}:</span>
                  <span className="property-value">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#999', fontSize: '12px' }}>No properties</p>
          )}
        </div>
      </div>
    </div>
  )
}
