export default function ThemePanel({ currentTheme, onThemeChange }) {
  const themes = [
    { id: 'light', name: 'Cadastre Light', desc: 'Paper registry palette (#F7F5EF)' },
    { id: 'dark', name: 'Cadastre Dark', desc: 'Low-glare cadastral night mode' },
  ]

  return (
    <div className="panel theme-panel">
      <h2>TFD Theme</h2>
      <div className="theme-grid">
        {themes.map((theme) => (
          <button
            key={theme.id}
            type="button"
            className={`theme-button ${currentTheme === theme.id ? 'active' : ''}`}
            onClick={() => onThemeChange(theme.id)}
          >
            <div className="theme-name">{theme.name}</div>
            <div className="theme-desc">{theme.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
