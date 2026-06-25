import { useCallback, useEffect, useRef, useState } from 'react'
import { useVoxelStore } from './store'
import { canvasToVoxels } from './sketchToVoxel'
import './SketchModal.css'

const PALETTE = [
  '#f94144', '#f3722c', '#f9c74f', '#90be6d',
  '#4cc9f0', '#4f9cf9', '#7b5ea7', '#ffffff',
  '#adb5bd', '#343a40',
]

const GRID_SIZES = [24, 32, 48]

export default function SketchModal({ onClose }) {
  const setVoxels = useVoxelStore((s) => s.setVoxels)

  const canvasRef = useRef(null)
  const isDrawingRef = useRef(false)
  const lastCellRef = useRef(null)

  const [gridSize, setGridSize] = useState(32)
  const [penColor, setPenColor] = useState('#4f9cf9')
  const [tool, setTool] = useState('pen')
  const [brushSize, setBrushSize] = useState(1)
  const [status, setStatus] = useState('')

  const initCanvas = useCallback((size) => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, size, size)
  }, [])

  useEffect(() => {
    initCanvas(gridSize)
  }, [gridSize, initCanvas])

  const paintAt = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const c = Math.floor(((clientX - rect.left) / rect.width) * gridSize)
    const r = Math.floor(((clientY - rect.top) / rect.height) * gridSize)

    const ctx = canvas.getContext('2d')
    const radius = Math.max(0, brushSize - 1)

    const paintCell = (col, row) => {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const x = col + dx
          const y = row + dy
          if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) continue
          if (tool === 'eraser') {
            ctx.clearRect(x, y, 1, 1)
          } else {
            ctx.fillStyle = penColor
            ctx.fillRect(x, y, 1, 1)
          }
        }
      }
    }

    const last = lastCellRef.current
    if (last && (last.c !== c || last.r !== r)) {
      let x0 = last.c, y0 = last.r
      const dx = Math.abs(c - x0), sx = x0 < c ? 1 : -1
      const dy = Math.abs(r - y0), sy = y0 < r ? 1 : -1
      let err = dx - dy
      while (true) {
        const e2 = 2 * err
        if (e2 > -dy) { err -= dy; x0 += sx }
        if (e2 < dx)  { err += dx; y0 += sy }
        paintCell(x0, y0)
        if (x0 === c && y0 === r) break
      }
    } else {
      paintCell(c, r)
    }

    lastCellRef.current = { c, r }
  }, [brushSize, gridSize, penColor, tool])

  const handlePointerDown = (e) => {
    e.preventDefault()
    isDrawingRef.current = true
    lastCellRef.current = null
    canvasRef.current?.setPointerCapture(e.pointerId)
    paintAt(e.clientX, e.clientY)
  }

  const handlePointerMove = (e) => {
    if (!isDrawingRef.current) return
    paintAt(e.clientX, e.clientY)
  }

  const handlePointerUp = (e) => {
    isDrawingRef.current = false
    lastCellRef.current = null
    canvasRef.current?.releasePointerCapture(e.pointerId)
  }

  const handleClear = () => {
    initCanvas(gridSize)
    setStatus('')
  }

  const handleConvert = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const voxels = canvasToVoxels(canvas)
    if (voxels.length === 0) {
      setStatus('Draw something first — empty sketches cannot convert.')
      return
    }

    setVoxels(voxels)
    setStatus(`Placed ${voxels.length} voxels in the scene.`)
    window.setTimeout(onClose, 600)
  }

  return (
    <div className="sketch-backdrop" onClick={onClose}>
      <div className="sketch-modal" onClick={(e) => e.stopPropagation()}>
        <header className="sketch-modal__header">
          <div>
            <h2>Sketch to Voxel</h2>
            <p>Draw on the grid, then convert your sketch into voxel art.</p>
          </div>
          <button type="button" className="sketch-modal__close" onClick={onClose}>×</button>
        </header>

        <div className="sketch-modal__body">
          <aside className="sketch-tools">
            <p className="sketch-tools__label">Tool</p>
            <div className="sketch-tools__segmented">
              <button
                type="button"
                className={tool === 'pen' ? 'active' : ''}
                onClick={() => setTool('pen')}
              >
                Pen
              </button>
              <button
                type="button"
                className={tool === 'eraser' ? 'active' : ''}
                onClick={() => setTool('eraser')}
              >
                Eraser
              </button>
            </div>

            <p className="sketch-tools__label">Pen color</p>
            <div className="sketch-tools__palette">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`sketch-tools__swatch ${penColor === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => {
                    setPenColor(c)
                    setTool('pen')
                  }}
                  title={c}
                />
              ))}
            </div>
            <div className="sketch-tools__custom">
              <input
                type="color"
                value={penColor}
                onChange={(e) => {
                  setPenColor(e.target.value)
                  setTool('pen')
                }}
              />
              <span>{penColor}</span>
            </div>

            <p className="sketch-tools__label">Brush size</p>
            <input
              type="range"
              min={1}
              max={4}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="sketch-tools__slider"
            />

            <p className="sketch-tools__label">Grid size</p>
            <div className="sketch-tools__sizes">
              {GRID_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={gridSize === size ? 'active' : ''}
                  onClick={() => setGridSize(size)}
                >
                  {size}×{size}
                </button>
              ))}
            </div>
          </aside>

          <div className="sketch-canvas-wrap">
            <div className="sketch-canvas-frame">
              <canvas
                ref={canvasRef}
                className="sketch-canvas"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              />
            </div>
            <p className="sketch-canvas__hint">Drag to draw · Center of grid becomes scene origin</p>
          </div>
        </div>

        {status && <p className="sketch-modal__status">{status}</p>}

        <footer className="sketch-modal__footer">
          <button type="button" className="sketch-btn secondary" onClick={handleClear}>
            Clear sketch
          </button>
          <button type="button" className="sketch-btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="sketch-btn primary" onClick={handleConvert}>
            Convert to voxels
          </button>
        </footer>
      </div>
    </div>
  )
}
