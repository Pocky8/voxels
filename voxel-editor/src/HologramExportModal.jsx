import { useState } from 'react'
import { useVoxelStore } from './store'
import { createExportLogger } from './exportLogger'
import { exportHologram } from './hologramExport'
import './HologramExportModal.css'

export default function HologramExportModal({ onClose }) {
  const voxels = useVoxelStore((s) => s.voxels)

  const [duration, setDuration] = useState(4)
  const [fps, setFps] = useState(10)
  const [pixelScale, setPixelScale] = useState(4)
  const [cameraAngle, setCameraAngle] = useState('slanted')
  const [format, setFormat] = useState('mp4')
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportLog, setExportLog] = useState('')
  const [copyStatus, setCopyStatus] = useState('')

  const totalFrames = Math.max(1, Math.round(duration * fps))

  const handleExport = async () => {
    setExporting(true)
    setProgress(0)
    setExportLog('')
    setCopyStatus('')
    setStatus('Preparing hologram…')
    const logger = createExportLogger(setExportLog)
    try {
      await exportHologram({
        voxels,
        duration,
        fps,
        pixelScale,
        cameraAngle,
        format,
        logger,
        onProgress: (current, total, message) => {
          setProgress(Math.min(100, Math.round((current / total) * 100)))
          setStatus(message)
        },
      })
      logger.info('hologram export completed')
      setProgress(100)
      setStatus('Export complete')
    } catch (err) {
      logger.error('hologram export failed', {
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
    a.download = 'hologram-export-log.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="holo-backdrop" onClick={onClose}>
      <div className="holo-modal" onClick={(e) => e.stopPropagation()}>
        <header className="holo-modal__header">
          <div>
            <h2>Hologram Export</h2>
            <p>Transform your voxels into a pixelated 3D hologram on greenscreen.</p>
          </div>
          <button type="button" className="holo-modal__close" onClick={onClose}>×</button>
        </header>

        <div className="holo-modal__body">
          {/* Camera angle */}
          <div className="holo-field">
            <label className="holo-field__label">View angle</label>
            <div className="holo-angle-row">
              {[
                { id: 'slanted', label: 'Slanted', desc: 'Card view' },
                { id: 'top', label: 'Top', desc: 'Bird\'s eye' },
                { id: 'side', label: 'Side', desc: 'Eye level' },
              ].map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`holo-angle-btn ${cameraAngle === a.id ? 'active' : ''}`}
                  onClick={() => setCameraAngle(a.id)}
                  disabled={exporting}
                >
                  <span className="holo-angle-btn__name">{a.label}</span>
                  <span className="holo-angle-btn__desc">{a.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="holo-field">
            <label className="holo-field__label">
              Duration: <strong>{duration}s</strong>
            </label>
            <input
              type="range"
              min={2}
              max={10}
              step={1}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              disabled={exporting}
              className="holo-field__slider"
            />
            <span className="holo-field__hint">Full 360° rotation in {duration} seconds</span>
          </div>

          {/* FPS */}
          <div className="holo-field">
            <label className="holo-field__label">Frame rate</label>
            <div className="holo-fps-row">
              {[10, 24].map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`holo-fps-btn ${fps === f ? 'active' : ''}`}
                  onClick={() => setFps(f)}
                  disabled={exporting}
                >
                  {f} FPS
                </button>
              ))}
            </div>
          </div>

          {/* Pixelation */}
          <div className="holo-field">
            <label className="holo-field__label">
              Pixelation: <strong>{pixelScale}x</strong>
            </label>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={pixelScale}
              onChange={(e) => setPixelScale(Number(e.target.value))}
              disabled={exporting}
              className="holo-field__slider"
            />
            <span className="holo-field__hint">
              {pixelScale === 1 ? 'No pixelation (crisp)' : `Render at ${Math.round(1080 / pixelScale)}px then upscale`}
            </span>
          </div>

          {/* Format */}
          <div className="holo-field">
            <label className="holo-field__label">Format</label>
            <div className="holo-format-row">
              <button
                type="button"
                className={`holo-format-btn ${format === 'mp4' ? 'active' : ''}`}
                onClick={() => setFormat('mp4')}
                disabled={exporting}
              >
                MP4 video
              </button>
              <button
                type="button"
                className={`holo-format-btn ${format === 'png' ? 'active' : ''}`}
                onClick={() => setFormat('png')}
                disabled={exporting}
              >
                PNG sequence
              </button>
            </div>
          </div>
        </div>

        <div className="holo-modal__meta">
          <span>{totalFrames} frame{totalFrames === 1 ? '' : 's'}</span>
          <span>{voxels.length} voxel{voxels.length === 1 ? '' : 's'}</span>
          <span>Background #00b140</span>
        </div>

        {(exporting || status) && (
          <div className="holo-progress">
            <div className="holo-progress__bar">
              <div className="holo-progress__fill" style={{ width: `${progress}%` }} />
            </div>
            <span>{status}</span>
          </div>
        )}

        {exportLog && (
          <section className="holo-log">
            <div className="holo-log__header">
              <div>
                <p className="holo-modal__label">Export log</p>
                <span>{copyStatus || 'Copy this if export fails'}</span>
              </div>
              <div className="holo-log__actions">
                <button type="button" className="holo-btn secondary" onClick={handleCopyLog}>
                  Copy log
                </button>
                <button type="button" className="holo-btn secondary" onClick={handleDownloadLog}>
                  Download log
                </button>
              </div>
            </div>
            <pre className="holo-log__body">{exportLog}</pre>
          </section>
        )}

        <footer className="holo-modal__footer">
          <button type="button" className="holo-btn secondary" onClick={onClose} disabled={exporting}>
            Cancel
          </button>
          <button
            type="button"
            className="holo-btn primary"
            onClick={handleExport}
            disabled={exporting || voxels.length === 0}
          >
            {exporting ? 'Exporting…' : 'Export hologram'}
          </button>
        </footer>
      </div>
    </div>
  )
}
