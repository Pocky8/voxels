import { useState } from 'react'
import './GreenscreenExportModal.css'

const PLANES = [
  { id: 'z', label: 'Front', desc: 'XY plane' },
  { id: 'y', label: 'Top', desc: 'XZ plane' },
  { id: 'x', label: 'Side', desc: 'YZ plane' },
]

export default function GreenscreenExportModal({ onClose, onExport, frameCount }) {
  const [plane, setPlane] = useState('z')
  const [format, setFormat] = useState('webm')
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    setProgress(0)
    setStatus('Preparing export…')
    try {
      await onExport({
        plane,
        format,
        onProgress: (current, total, message) => {
          setProgress(Math.round((current / total) * 100))
          setStatus(message)
        },
      })
      setStatus('Export complete')
    } catch (err) {
      setStatus(err?.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="gs-backdrop" onClick={onClose}>
      <div className="gs-modal" onClick={(e) => e.stopPropagation()}>
        <header className="gs-modal__header">
          <div>
            <h2>Greenscreen Export</h2>
            <p>Export your animation on a chroma-key background with no grid.</p>
          </div>
          <button type="button" className="gs-modal__close" onClick={onClose}>×</button>
        </header>

        <section className="gs-modal__section">
          <p className="gs-modal__label">View plane</p>
          <div className="gs-plane-row">
            {PLANES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`gs-plane-btn ${plane === p.id ? 'active' : ''}`}
                onClick={() => setPlane(p.id)}
                disabled={exporting}
              >
                <span className="gs-plane-btn__axis">{p.id.toUpperCase()}</span>
                <span className="gs-plane-btn__name">{p.label}</span>
                <span className="gs-plane-btn__desc">{p.desc}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="gs-modal__section">
          <p className="gs-modal__label">Format</p>
          <div className="gs-format-row">
            <button
              type="button"
              className={`gs-format-btn ${format === 'webm' ? 'active' : ''}`}
              onClick={() => setFormat('webm')}
              disabled={exporting}
            >
              WebM video
            </button>
            <button
              type="button"
              className={`gs-format-btn ${format === 'png' ? 'active' : ''}`}
              onClick={() => setFormat('png')}
              disabled={exporting}
            >
              PNG sequence
            </button>
          </div>
        </section>

        <div className="gs-modal__meta">
          <span>{frameCount} frame{frameCount === 1 ? '' : 's'}</span>
          <span>Background #00b140</span>
        </div>

        {exporting && (
          <div className="gs-progress">
            <div className="gs-progress__bar" style={{ width: `${progress}%` }} />
            <span>{status}</span>
          </div>
        )}

        <footer className="gs-modal__footer">
          <button type="button" className="gs-btn secondary" onClick={onClose} disabled={exporting}>
            Cancel
          </button>
          <button
            type="button"
            className="gs-btn primary"
            onClick={handleExport}
            disabled={exporting || frameCount === 0}
          >
            {exporting ? 'Exporting…' : 'Export animation'}
          </button>
        </footer>
      </div>
    </div>
  )
}
