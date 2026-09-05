import { useMemo, useState } from 'react'
import { communeCode, communeLabel } from '../lib/communeFilter'
import './CommuneFilter.css'

/**
 * Searchable multi-select for Togo communes (117).
 * Empty selection = show all communes at full styling.
 */
export default function CommuneFilter({
  communes,
  selectedCodes,
  onChange,
  compact = false,
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(!compact)

  const options = useMemo(() => {
    const features = communes?.features || []
    return features
      .map((f) => ({
        code: communeCode(f),
        label: communeLabel(f),
        prefecture: f.properties?.geographic_prefecture || f.properties?.prefecture || '',
      }))
      .filter((o) => o.code)
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  }, [communes])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.code.toLowerCase().includes(q) ||
        String(o.prefecture).toLowerCase().includes(q)
    )
  }, [options, query])

  const selected = selectedCodes || []
  const selectedSet = useMemo(() => new Set(selected), [selected])

  const toggle = (code) => {
    if (selectedSet.has(code)) {
      onChange(selected.filter((c) => c !== code))
    } else {
      onChange([...selected, code])
    }
  }

  const clear = () => onChange([])

  const selectVisible = () => {
    const codes = filtered.map((o) => o.code)
    onChange([...new Set([...selected, ...codes])])
  }

  return (
    <div className={`cf ${compact ? 'cf--compact' : ''} ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="cf-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="cf-toggle-label">Communes</span>
        <span className="cf-toggle-meta">
          {selected.length === 0 ? 'All' : `${selected.length} selected`}
        </span>
      </button>

      {open && (
        <div className="cf-panel">
          <div className="cf-toolbar">
            <input
              className="cf-search"
              type="search"
              placeholder="Search commune, code…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filter communes"
            />
            <div className="cf-actions">
              <button type="button" className="cf-btn" onClick={clear} disabled={!selected.length}>
                Clear
              </button>
              <button type="button" className="cf-btn" onClick={selectVisible} disabled={!filtered.length}>
                Add visible
              </button>
            </div>
          </div>
          <p className="cf-hint">
            {selected.length === 0
              ? 'No filter — all communes full style. Select to dim the rest.'
              : 'Selected communes emphasized; others faded.'}
          </p>
          <ul className="cf-list" role="listbox" aria-multiselectable="true" aria-label="Communes">
            {filtered.map((o) => {
              const on = selectedSet.has(o.code)
              return (
                <li key={o.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    className={`cf-item ${on ? 'is-on' : ''}`}
                    onClick={() => toggle(o.code)}
                  >
                    <span className={`cf-check ${on ? 'is-on' : ''}`} aria-hidden />
                    <span className="cf-item-body">
                      <span className="cf-item-name">{o.label}</span>
                      <span className="cf-item-code">{o.code}</span>
                    </span>
                  </button>
                </li>
              )
            })}
            {!filtered.length && <li className="cf-empty">No communes match “{query}”</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
