import { useState } from 'react'
import { createExportLogger } from './exportLogger'
import './GreenscreenExportModal.css'

const PLANES = [
  { id: 'z', label: 'Front', desc: 'XY plane' },
  { id: 'y', label: 'Top', desc: 'XZ plane' },
  { id: 'x', label: 'Side', desc: 'YZ plane' },
]

export default function GreenscreenExportModal({ onClose, onExport, frameCount }) {
  const [plane, setPlane] = useState('z')
  const [format, setFormat] = useState('mp4')
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportLog, setExportLog] = useState('')
  const [copyStatus, setCopyStatus] = useState('')

  const handleExport = async () => {
    setExporting(true)
    setProgress(0)
    setExportLog('')
    setCopyStatus('')
    setStatus('Preparing export…')
    const logger = createExportLogger(setExportLog)
    try {
      await onExport({
        plane,
        format,
        logger,
        onProgress: (current, total, message) => {
          setProgress(Math.min(100, Math.round((current / total) * 100)))
          setStatus(message)
        },
      })
      logger.info('export completed')
      setProgress(100)
      setStatus('Export complete')
    } catch (err) {
      logger.error('export failed', {
        message: err?.message || 'Export failed',
      })
      setStatus(err?.message || 'Export failed')
    } finally {
      logger.finish()
      setExporting(false)
    }
  }

  const handleCopyLog = async () => {
    if (!exportLog) return
    try {
      await navigator.clipboard.writeText(exportLog)
      setCopyStatus('Copied')
    } catch {
      setCopyStatus('Copy failed')
    }
  }

  const handleDownloadLog = () => {
    if (!exportLog) return
    const blob = new Blob([exportLog], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'greenscreen-export-log.txt'
    a.click()
    URL.revokeObjectURL(url)
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
              className={`gs-format-btn ${format === 'mp4' ? 'active' : ''}`}
              onClick={() => setFormat('mp4')}
              disabled={exporting}
            >
              MP4 video
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

        {(exporting || status) && (
          <div className="gs-progress">
            <div className="gs-progress__bar" style={{ width: `${progress}%` }} />
            <span>{status}</span>
          </div>
        )}

        {exportLog && (
          <section className="gs-log">
            <div className="gs-log__header">
              <div>
                <p className="gs-modal__label">Export log</p>
                <span>{copyStatus || 'Copy this if export fails'}</span>
              </div>
              <div className="gs-log__actions">
                <button type="button" className="gs-btn secondary" onClick={handleCopyLog}>
                  Copy log
                </button>
                <button type="button" className="gs-btn secondary" onClick={handleDownloadLog}>
                  Download log
                </button>
              </div>
            </div>
            <pre className="gs-log__body">{exportLog}</pre>
          </section>
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
