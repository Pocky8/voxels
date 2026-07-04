import { useState, useRef, useCallback, lazy, Suspense } from 'react'
import { createExportLogger } from './exportLogger'
import { exportOrbitAnimation } from './orbitExport'
import './OrbitExportModal.css'

const OrbitPreview = lazy(() => import('./OrbitPreview'))

export default function OrbitExportModal({ onClose }) {
  const [items, setItems] = useState([])
  // Global settings
  const [duration, setDuration] = useState(8)
  const [fps, setFps] = useState(24)
  const [format, setFormat] = useState('mp4')
  // Default per-image settings
  const [defaultSize, setDefaultSize] = useState(32)
  const [defaultDepth, setDefaultDepth] = useState(3)

  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [showPreview, setShowPreview] = useState(true)
  const fileInputRef = useRef(null)
  const revoxTimers = useRef({}) // debounce timers keyed by item id

  const maxItems = 7
  const alphaThreshold = 128

  const quantizeColor = (value) => Math.max(0, Math.min(255, Math.round(value / 17) * 17))
  const toHex = (r, g, b) =>
    `#${[r, g, b].map((v) => quantizeColor(v).toString(16).padStart(2, '0')).join('')}`

  const loadImage = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve({ img, url })
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image.'))
    }
    img.src = url
  })

  /** Voxelize an image with the given size, depth, bgRemoval, and pixelPerfect. */
  const voxelizeImage = (img, size, depth, bgRemoval = 'none', pixelPerfect = true) => {
    const scale = Math.min(size / img.width, size / img.height)
    const width = Math.max(1, Math.round(img.width * scale))
    const height = Math.max(1, Math.round(img.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.imageSmoothingEnabled = !pixelPerfect
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, width, height)

    const imgData = ctx.getImageData(0, 0, width, height)
    const data = imgData.data
    const voxels = []
    let id = 1
    const originX = Math.floor(width / 2)
    const originY = Math.floor(height / 2)

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const i = (row * width + col) * 4
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]

        // Background removal logic (matches VoxelizerModal)
        const isGrayscale = Math.abs(r - g) < 15 && Math.abs(g - b) < 15
        const isWhiteGrey = isGrayscale && r > 180
        const isSolidBlack = r < 30 && g < 30 && b < 30
        const isSolidWhite = r > 240 && g > 240 && b > 240

        let skip = false
        if (bgRemoval === 'white_grey' && isWhiteGrey) skip = true
        if (bgRemoval === 'black_white_grid' && isGrayscale) skip = true
        if (bgRemoval === 'black' && isSolidBlack) skip = true
        if (bgRemoval === 'white' && isSolidWhite) skip = true

        if (a < alphaThreshold || skip) continue

        for (let z = 0; z < depth; z++) {
          voxels.push({
            id: id++,
            position: [col - originX + 0.5, (height - row) - originY + 0.5, z - (depth / 2) + 0.5],
            color: toHex(r, g, b),
          })
        }
      }
    }
    return voxels
  }

  const handleFilesAdded = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return

    const remainingSlots = maxItems - items.length
    const toProcess = files.slice(0, remainingSlots)

    const newItems = []
    for (const file of toProcess) {
      try {
        const { img, url } = await loadImage(file)
        const voxels = voxelizeImage(img, defaultSize, defaultDepth, 'none', true)

        if (voxels.length > 0) {
          newItems.push({
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            thumb: url,
            img,          // keep for re-voxelization
            voxels,
            height: 0,
            radius: 25,
            size: defaultSize,
            depth: defaultDepth,
            bgRemoval: 'none',
            pixelPerfect: true,
            spinSpeed: 2,
            floatSpeed: 1,
            floatOffset: Math.random() * Math.PI * 2,
          })
        }
      } catch (err) {
        console.error('Failed to process image', file.name, err)
      }
    }

    setItems((prev) => [...prev, ...newItems])
    e.target.value = ''
  }

  const handleRemove = (idToRemove) => {
    setItems((prev) => {
      const idx = prev.findIndex(i => i.id === idToRemove)
      if (idx !== -1) URL.revokeObjectURL(prev[idx].thumb)
      return prev.filter(i => i.id !== idToRemove)
    })
  }

  /** Update a property on an item, debouncing re-voxelization for heavy ops */
  const revoxKeys = ['size', 'depth', 'bgRemoval', 'pixelPerfect']

  const updateItem = useCallback((id, key, value) => {
    // Always update the property immediately (slider feels responsive)
    setItems((prev) => prev.map(item =>
      item.id === id ? { ...item, [key]: value } : item
    ))

    // Debounce re-voxelization for expensive keys
    if (revoxKeys.includes(key)) {
      clearTimeout(revoxTimers.current[id])
      revoxTimers.current[id] = setTimeout(() => {
        setItems((prev) => prev.map(item => {
          if (item.id !== id || !item.img) return item
          return {
            ...item,
            voxels: voxelizeImage(item.img, item.size, item.depth, item.bgRemoval, item.pixelPerfect),
          }
        }))
      }, 300)
    }
  }, [])

  const handleExport = async () => {
    if (items.length === 0) return

    setExporting(true)
    setProgress(0)
    setStatus('Preparing...')

    const logger = createExportLogger(() => {})

    try {
      await exportOrbitAnimation({
        models: items,
        duration,
        fps,
        format,
        logger,
        onProgress: (current, total, message) => {
          setProgress(Math.min(100, Math.round((current / total) * 100)))
          setStatus(message)
        },
      })
      setStatus('Export complete!')
      setProgress(100)
    } catch (err) {
      console.error(err)
      setStatus(err?.message || 'Export failed')
    } finally {
      setExporting(false)
      logger.finish()
    }
  }

  const totalFrames = Math.max(1, Math.round(duration * fps))
  const totalVoxels = items.reduce((sum, i) => sum + i.voxels.length, 0)

  return (
    <div className="orbit-backdrop" onClick={() => !exporting && onClose()}>
      <div className="orbit-modal" onClick={(e) => e.stopPropagation()}>
        {/* ── Header ── */}
        <header className="orbit-modal__header">
          <div>
            <h2>Orbit Animation</h2>
            <p>Upload images → floating voxel objects on greenscreen.</p>
          </div>
          <button className="orbit-modal__close" onClick={onClose} disabled={exporting}>×</button>
        </header>

        <div className="orbit-modal__body">
          {/* ── Upload zone ── */}
          {items.length < maxItems && (
            <label className={`orbit-upload ${exporting ? 'disabled' : ''}`}>
              <span className="orbit-upload__title">
                Upload images ({items.length}/{maxItems})
              </span>
              <span className="orbit-upload__hint">
                PNG, JPG, WEBP · Transparent backgrounds recommended
              </span>
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                onChange={handleFilesAdded}
                ref={fileInputRef}
                disabled={exporting}
              />
            </label>
          )}

          {/* ── Image list ── */}
          {items.length > 0 && (
            <div className="orbit-list">
              {items.map(item => (
                <div key={item.id} className="orbit-item">
                  {/* Top bar: thumb, name, remove */}
                  <div className="orbit-item__top">
                    <img className="orbit-item__thumb" src={item.thumb} alt={item.name} />
                    <span className="orbit-item__name">{item.name}</span>
                    <span className="orbit-item__voxels">{item.voxels.length}v</span>
                    <button
                      className="orbit-item__remove"
                      onClick={() => handleRemove(item.id)}
                      disabled={exporting}
                    >
                      ×
                    </button>
                  </div>

                  {/* Per-image controls */}
                  <div className="orbit-item__controls">
                    {/* Detail (quality/resolution) */}
                    <div className="orbit-ctrl">
                      <label className="orbit-ctrl__label">
                        Detail: <strong>{item.size}px</strong>
                      </label>
                      <input
                        className="orbit-ctrl__slider"
                        type="range" min="12" max="128" step="1"
                        value={item.size}
                        onChange={(e) => updateItem(item.id, 'size', Number(e.target.value))}
                        disabled={exporting}
                      />
                      <span className="orbit-ctrl__hint">Longest side · higher = closer to original</span>
                    </div>

                    {/* Depth (extrusion thickness) */}
                    <div className="orbit-ctrl">
                      <label className="orbit-ctrl__label">
                        Depth: <strong>{item.depth}</strong>
                      </label>
                      <input
                        className="orbit-ctrl__slider"
                        type="range" min="1" max="10" step="1"
                        value={item.depth}
                        onChange={(e) => updateItem(item.id, 'depth', Number(e.target.value))}
                        disabled={exporting}
                      />
                    </div>

                    {/* Height (Y position) */}
                    <div className="orbit-ctrl">
                      <label className="orbit-ctrl__label">
                        Height: <strong>{item.height}</strong>
                      </label>
                      <input
                        className="orbit-ctrl__slider"
                        type="range" min="-30" max="30" step="1"
                        value={item.height}
                        onChange={(e) => updateItem(item.id, 'height', Number(e.target.value))}
                        disabled={exporting}
                      />
                    </div>

                    {/* Distance (orbit radius) */}
                    <div className="orbit-ctrl">
                      <label className="orbit-ctrl__label">
                        Distance: <strong>{item.radius}</strong>
                      </label>
                      <input
                        className="orbit-ctrl__slider"
                        type="range" min="5" max="50" step="1"
                        value={item.radius}
                        onChange={(e) => updateItem(item.id, 'radius', Number(e.target.value))}
                        disabled={exporting}
                      />
                    </div>

                    {/* Spin speed */}
                    <div className="orbit-ctrl">
                      <label className="orbit-ctrl__label">
                        Spin: <strong>{item.spinSpeed}x</strong>
                      </label>
                      <input
                        className="orbit-ctrl__slider"
                        type="range" min="0" max="6" step="0.5"
                        value={item.spinSpeed}
                        onChange={(e) => updateItem(item.id, 'spinSpeed', Number(e.target.value))}
                        disabled={exporting}
                      />
                    </div>

                    {/* Background removal */}
                    <div className="orbit-ctrl orbit-ctrl--full">
                      <label className="orbit-ctrl__label">Background</label>
                      <select
                        className="orbit-ctrl__select"
                        value={item.bgRemoval}
                        onChange={(e) => updateItem(item.id, 'bgRemoval', e.target.value)}
                        disabled={exporting}
                      >
                        <option value="none">PNG / No change (keep alpha)</option>
                        <option value="white_grey">Remove white / grey grid</option>
                        <option value="black_white_grid">Remove all grayscale</option>
                        <option value="white">Remove solid white</option>
                        <option value="black">Remove solid black</option>
                      </select>
                    </div>

                    {/* Pixel perfect */}
                    <label className="orbit-ctrl orbit-ctrl--full orbit-ctrl__checkbox">
                      <input
                        type="checkbox"
                        checked={item.pixelPerfect}
                        onChange={(e) => updateItem(item.id, 'pixelPerfect', e.target.checked)}
                        disabled={exporting}
                      />
                      <span>Pixel perfect (no smoothing)</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── 3D Preview ── */}
          {items.length > 0 && (
            <div className="orbit-field">
              <label className="orbit-ctrl orbit-ctrl__checkbox">
                <input
                  type="checkbox"
                  checked={showPreview}
                  onChange={(e) => setShowPreview(e.target.checked)}
                />
                <span>Show 3D preview</span>
              </label>
              {showPreview && (
                <Suspense fallback={
                  <div className="orbit-preview" style={{ display: 'grid', placeItems: 'center' }}>
                    <span style={{ fontSize: 18, fontWeight: 'bold', textTransform: 'uppercase', color: '#fff' }}>Loading preview…</span>
                  </div>
                }>
                  <OrbitPreview items={items} />
                </Suspense>
              )}
            </div>
          )}

          {/* ── Global animation settings ── */}
          <div className="orbit-field">
            <label className="orbit-field__label">
              Duration: <strong>{duration}s</strong>
            </label>
            <input
              className="orbit-field__slider"
              type="range" min={4} max={16} step={1}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              disabled={exporting}
            />
            <span className="orbit-field__hint">Full 360° orbit in {duration} seconds</span>
          </div>

          <div className="orbit-field">
            <label className="orbit-field__label">Frame rate</label>
            <div className="orbit-btn-row">
              {[10, 24, 30].map(f => (
                <button
                  key={f} type="button"
                  className={`orbit-btn ${fps === f ? 'active' : ''}`}
                  onClick={() => setFps(f)}
                  disabled={exporting}
                >
                  {f} FPS
                </button>
              ))}
            </div>
          </div>

          <div className="orbit-field">
            <label className="orbit-field__label">Format</label>
            <div className="orbit-btn-row">
              <button
                type="button"
                className={`orbit-btn ${format === 'mp4' ? 'active' : ''}`}
                onClick={() => setFormat('mp4')}
                disabled={exporting}
              >
                MP4 Video
              </button>
              <button
                type="button"
                className={`orbit-btn ${format === 'png' ? 'active' : ''}`}
                onClick={() => setFormat('png')}
                disabled={exporting}
              >
                PNG Sequence
              </button>
            </div>
          </div>
        </div>

        {/* ── Meta ── */}
        <div className="orbit-modal__meta">
          <span>{items.length} image{items.length === 1 ? '' : 's'}</span>
          <span>{totalVoxels} voxels</span>
          <span>{totalFrames} frames</span>
          <span>BG #00B140</span>
        </div>

        {/* ── Progress ── */}
        {(exporting || status) && (
          <div className="orbit-progress">
            <div className="orbit-progress__bar">
              <div className="orbit-progress__fill" style={{ width: `${progress}%` }} />
            </div>
            <span>{status}</span>
          </div>
        )}

        {/* ── Footer ── */}
        <footer className="orbit-modal__footer">
          <button className="orbit-action-btn secondary" onClick={onClose} disabled={exporting}>
            Cancel
          </button>
          <button
            className="orbit-action-btn primary"
            onClick={handleExport}
            disabled={exporting || items.length === 0}
          >
            {exporting ? 'Exporting…' : 'Export'}
          </button>
        </footer>
      </div>
    </div>
  )
}
