import { useState } from 'react'
import { useVoxelStore } from './store'
import { exportUnityCS, exportGodotGD, exportGLTF } from './exporters'
import './Toolbar.css'

const PALETTE = [
  '#f94144', '#f3722c', '#f9c74f', '#90be6d',
  '#4cc9f0', '#4f9cf9', '#7b5ea7', '#ffffff',
  '#adb5bd', '#343a40',
]

export default function Toolbar({ onVoxelizerOpen, onGreenscreenOpen }) {
  const voxels = useVoxelStore((s) => s.voxels)
  const activeTool = useVoxelStore((s) => s.activeTool)
  const activeColor = useVoxelStore((s) => s.activeColor)
  const continuousDraw = useVoxelStore((s) => s.continuousDraw)
  const setActiveTool = useVoxelStore((s) => s.setActiveTool)
  const setActiveColor = useVoxelStore((s) => s.setActiveColor)
  const setContinuousDraw = useVoxelStore((s) => s.setContinuousDraw)
  const clearCanvas = useVoxelStore((s) => s.clearCanvas)
  const frames = useVoxelStore((s) => s.frames)
  const isExporting = useVoxelStore((s) => s.isExporting)

  const [exporting, setExporting] = useState(false)

  const handleGLTF = async () => {
    setExporting(true)
    await exportGLTF(voxels)
    setExporting(false)
  }

  return (
    <aside className="sidebar">
      <header className="sidebar__brand">
        <div className="sidebar__mark" />
        <div>
          <p className="sidebar__title">SpriteForge</p>
          <p className="sidebar__subtitle">Voxel Studio</p>
        </div>
      </header>

      <section className="sidebar__panel">
        <p className="sidebar__label">Tools</p>
        <div className="segmented">
          <button
            type="button"
            className={`segmented__btn ${activeTool === 'draw' ? 'active' : ''}`}
            onClick={() => setActiveTool('draw')}
          >
            Draw
          </button>
          <button
            type="button"
            className={`segmented__btn ${activeTool === 'erase' ? 'active' : ''}`}
            onClick={() => setActiveTool('erase')}
          >
            Erase
          </button>
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={continuousDraw}
            onChange={(e) => setContinuousDraw(e.target.checked)}
          />
          <span>Continuous brush</span>
        </label>
      </section>

      <section className="sidebar__panel">
        <p className="sidebar__label">Color</p>
        <div className="palette">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              className={`palette__swatch ${activeColor === c ? 'active' : ''}`}
              style={{ background: c }}
              onClick={() => setActiveColor(c)}
              title={c}
            />
          ))}
        </div>
        <div className="color-picker">
          <input
            type="color"
            value={activeColor}
            onChange={(e) => setActiveColor(e.target.value)}
            className="color-picker__input"
          />
          <span className="color-picker__hex">{activeColor}</span>
        </div>
      </section>

      <section className="sidebar__panel sidebar__panel--grow">
        <p className="sidebar__label">Export</p>
        <button
          type="button"
          className="sidebar__action sidebar__action--primary"
          onClick={onGreenscreenOpen}
          disabled={frames.every((f) => f.length === 0) || isExporting}
        >
          Greenscreen animation
        </button>
        <button
          type="button"
          className="sidebar__action"
          onClick={() => exportUnityCS(voxels)}
          disabled={voxels.length === 0}
        >
          Unity C#
        </button>
        <button
          type="button"
          className="sidebar__action"
          onClick={() => exportGodotGD(voxels)}
          disabled={voxels.length === 0}
        >
          Godot GDScript
        </button>
        <button
          type="button"
          className="sidebar__action"
          onClick={handleGLTF}
          disabled={voxels.length === 0 || exporting}
        >
          {exporting ? 'Exporting GLTF…' : 'GLTF / GLB'}
        </button>
      </section>

      <section className="sidebar__panel">
        <p className="sidebar__label">Utilities</p>
        <button type="button" className="sidebar__action" onClick={onVoxelizerOpen}>
          Mesh to voxels
        </button>
        <button
          type="button"
          className="sidebar__action sidebar__action--danger"
          onClick={() => {
            if (window.confirm('Clear all voxels in this frame?')) clearCanvas()
          }}
          disabled={voxels.length === 0}
        >
          Clear frame
        </button>
      </section>
    </aside>
  )
}
