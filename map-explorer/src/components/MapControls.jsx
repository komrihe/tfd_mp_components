export default function MapControls({
  onThemeToggle,
  currentTheme,
  onTogglePanel,
  buildings3d,
  onToggle3d,
}) {
  return (
    <div className="controls">
      <button
        type="button"
        onClick={onThemeToggle}
        title={`Switch to ${currentTheme === 'light' ? 'dark' : 'light'} theme`}
      >
        {currentTheme === 'light' ? 'Dark' : 'Light'} theme
      </button>
      {typeof onToggle3d === 'function' && (
        <button
          type="button"
          onClick={onToggle3d}
          title="Toggle 3D buildings"
          className={buildings3d ? 'active' : ''}
        >
          3D {buildings3d ? 'on' : 'off'}
        </button>
      )}
      <button type="button" onClick={onTogglePanel} title="Toggle info panel">
        Info
      </button>
    </div>
  )
}
