import { useState } from 'react'
import { useVoxelStore } from './store'
import { exportUnityCS, exportGodotGD, exportGLTF } from './exporters'
import './Toolbar.css'

const PALETTE = [
  '#f94144', '#f3722c', '#f9c74f', '#90be6d', '#4ade80',
  '#4cc9f0', '#4f9cf9', '#818cf8', '#e879f9', '#ffffff',
  '#94a3b8', '#1e293b',
]

export default function Toolbar({ onVoxelizerOpen, onGreenscreenOpen, onSketchOpen }) {
  const voxels      = useVoxelStore(s => s.voxels)
  const activeTool  = useVoxelStore(s => s.activeTool)
  const activeColor = useVoxelStore(s => s.activeColor)
  const continuousDraw = useVoxelStore(s => s.continuousDraw)
  const mirrorX     = useVoxelStore(s => s.mirrorX)
  const past        = useVoxelStore(s => s.past)
  const future      = useVoxelStore(s => s.future)
  const frames      = useVoxelStore(s => s.frames)
  const isExporting = useVoxelStore(s => s.isExporting)
  const setActiveTool    = useVoxelStore(s => s.setActiveTool)
  const setActiveColor   = useVoxelStore(s => s.setActiveColor)
  const setContinuousDraw = useVoxelStore(s => s.setContinuousDraw)
  const setMirrorX       = useVoxelStore(s => s.setMirrorX)
  const undo        = useVoxelStore(s => s.undo)
  const redo        = useVoxelStore(s => s.redo)
  const clearCanvas = useVoxelStore(s => s.clearCanvas)

  const [exporting, setExporting] = useState(false)
  const [moreOpen, setMoreOpen]   = useState(false)
  const [colorOpen, setColorOpen] = useState(false)

  const handleGLTF = async () => {
    setExporting(true)
    await exportGLTF(voxels)
    setExporting(false)
  }

  const closeSheets = () => { setMoreOpen(false); setColorOpen(false) }

  /* ─── shared palette component ─── */
  const PaletteGrid = ({ onPick, large }) => (
    <div className={`palette ${large ? 'palette--lg' : ''}`}>
      {PALETTE.map(c => (
        <button
          key={c} type="button"
          className={`palette__swatch ${activeColor === c ? 'active' : ''}`}
          style={{ background: c }}
          onClick={() => onPick(c)}
          title={c}
        />
      ))}
    </div>
  )

  return (
    <>
      {/* ════════════════════════════════════════
          DESKTOP SIDEBAR
      ════════════════════════════════════════ */}
      <aside className="sidebar">

        {/* Brand + undo/redo */}
        <header className="sb-brand">
          <div className="sb-brand__mark" />
          <div className="sb-brand__text">
            <p className="sb-brand__name">SpriteForge</p>
            <p className="sb-brand__sub">Voxel Studio</p>
          </div>
          <div className="sb-brand__actions">
            <button className="icon-btn" onClick={undo} disabled={past.length === 0 || isExporting} title="Undo (Ctrl+Z)">↩</button>
            <button className="icon-btn" onClick={redo} disabled={future.length === 0 || isExporting} title="Redo (Ctrl+Y)">↪</button>
          </div>
        </header>

        {/* ── Tools ── */}
        <div className="sb-section">
          <p className="sb-label">Tools</p>

          <div className="tool-grid">
            <button type="button"
              className={`tool-btn ${activeTool === 'draw' ? 'tool-btn--on' : ''}`}
              onClick={() => setActiveTool('draw')}>
              <span className="tool-btn__icon">✎</span>
              <span className="tool-btn__name">Draw</span>
            </button>
            <button type="button"
              className={`tool-btn ${activeTool === 'erase' ? 'tool-btn--on' : ''}`}
              onClick={() => setActiveTool('erase')}>
              <span className="tool-btn__icon">⌫</span>
              <span className="tool-btn__name">Erase</span>
            </button>
          </div>

          {/* Modifier chips — highlighted when active */}
          <div className="chip-row">
            <button type="button"
              className={`chip ${continuousDraw ? 'chip--on' : ''}`}
              onClick={() => setContinuousDraw(!continuousDraw)}
              title="Hold and drag to paint continuously">
              <span className="chip__pip" />
              Continuous
            </button>
            <button type="button"
              className={`chip ${mirrorX ? 'chip--on' : ''}`}
              onClick={() => setMirrorX(!mirrorX)}
              title="Mirror voxels across the X axis">
              <span className="chip__pip" />
              Mirror X
            </button>
          </div>
        </div>

        {/* ── Color ── */}
        <div className="sb-section">
          <p className="sb-label">Color</p>
          <PaletteGrid onPick={setActiveColor} />
          <div className="color-row">
            <input type="color" value={activeColor}
              onChange={e => setActiveColor(e.target.value)}
              className="color-row__picker" title="Custom color" />
            <span className="color-row__swatch" style={{ background: activeColor }} />
            <span className="color-row__hex">{activeColor.toUpperCase()}</span>
          </div>
        </div>

        {/* ── Create (featured) ── */}
        <div className="sb-section">
          <p className="sb-label">Create</p>
          <button type="button" className="feat-btn feat-btn--primary" onClick={onSketchOpen}>
            <span className="feat-btn__icon">✍</span>
            <span className="feat-btn__body">
              <span className="feat-btn__title">Sketch to Voxel</span>
              <span className="feat-btn__sub">Draw and convert to 3D</span>
            </span>
          </button>
          <button type="button" className="feat-btn" onClick={onVoxelizerOpen}>
            <span className="feat-btn__icon">⬆</span>
            <span className="feat-btn__body">
              <span className="feat-btn__title">Import Voxels</span>
              <span className="feat-btn__sub">From image or mesh</span>
            </span>
          </button>
        </div>

        {/* ── Export ── */}
        <div className="sb-section sb-section--grow">
          <p className="sb-label">Export</p>
          <button type="button" className="act-btn act-btn--accent"
            onClick={onGreenscreenOpen}
            disabled={frames.every(f => f.length === 0) || isExporting}>
            Greenscreen animation
          </button>
          <div className="act-row">
            <button className="act-btn" onClick={() => exportUnityCS(voxels)} disabled={voxels.length === 0}>Unity C#</button>
            <button className="act-btn" onClick={() => exportGodotGD(voxels)} disabled={voxels.length === 0}>Godot GD</button>
          </div>
          <button className="act-btn" onClick={handleGLTF} disabled={voxels.length === 0 || exporting}>
            {exporting ? 'Exporting…' : 'GLTF / GLB'}
          </button>
        </div>

        {/* ── Frame ── */}
        <div className="sb-section">
          <button type="button" className="act-btn act-btn--danger"
            disabled={voxels.length === 0}
            onClick={() => window.confirm('Clear all voxels in this frame?') && clearCanvas()}>
            Clear frame
          </button>
        </div>

      </aside>

      {/* ════════════════════════════════════════
          MOBILE BOTTOM DOCK  (≤760 px)
      ════════════════════════════════════════ */}
      <nav className="mobile-dock" aria-label="Primary tools">
        <button type="button" className={`dock-btn ${activeTool === 'draw' ? 'dock-btn--on' : ''}`}
          onClick={() => { setActiveTool('draw'); closeSheets() }}>
          <span className="dock-btn__ico">✎</span>
          <span className="dock-btn__lbl">Draw</span>
        </button>
        <button type="button" className={`dock-btn ${activeTool === 'erase' ? 'dock-btn--on' : ''}`}
          onClick={() => { setActiveTool('erase'); closeSheets() }}>
          <span className="dock-btn__ico">⌫</span>
          <span className="dock-btn__lbl">Erase</span>
        </button>
        <button type="button" className={`dock-btn ${colorOpen ? 'dock-btn--on' : ''}`}
          onClick={() => { setColorOpen(v => !v); setMoreOpen(false) }}>
          <span className="dock-btn__swatch" style={{ background: activeColor }} />
          <span className="dock-btn__lbl">Color</span>
        </button>
        <button type="button" className="dock-btn"
          onClick={() => { onSketchOpen(); closeSheets() }}>
          <span className="dock-btn__ico">✍</span>
          <span className="dock-btn__lbl">Sketch</span>
        </button>
        <button type="button" className={`dock-btn ${moreOpen ? 'dock-btn--on' : ''}`}
          onClick={() => { setMoreOpen(v => !v); setColorOpen(false) }}>
          <span className="dock-btn__dots">•••</span>
          <span className="dock-btn__lbl">More</span>
        </button>
      </nav>

      {/* ════════════════════════════════════════
          MOBILE SHEETS
      ════════════════════════════════════════ */}

      {colorOpen && (
        <div className="sheet-bd" onClick={() => setColorOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet__grip" />
            <p className="sheet__title">Color</p>
            <PaletteGrid large onPick={c => { setActiveColor(c); setColorOpen(false) }} />
            <div className="color-row" style={{ marginTop: 10 }}>
              <input type="color" value={activeColor}
                onChange={e => setActiveColor(e.target.value)}
                className="color-row__picker" />
              <span className="color-row__swatch" style={{ background: activeColor }} />
              <span className="color-row__hex">{activeColor.toUpperCase()}</span>
            </div>
          </div>
        </div>
      )}

      {moreOpen && (
        <div className="sheet-bd" onClick={() => setMoreOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet__grip" />
            <p className="sheet__title">More</p>

            <p className="sheet__sec">Draw options</p>
            <div className="chip-row">
              <button type="button" className={`chip ${continuousDraw ? 'chip--on' : ''}`}
                onClick={() => setContinuousDraw(!continuousDraw)}>
                <span className="chip__pip" />Continuous
              </button>
              <button type="button" className={`chip ${mirrorX ? 'chip--on' : ''}`}
                onClick={() => setMirrorX(!mirrorX)}>
                <span className="chip__pip" />Mirror X
              </button>
            </div>

            <p className="sheet__sec">History</p>
            <div className="act-row">
              <button className="act-btn" onClick={() => { undo(); setMoreOpen(false) }} disabled={past.length === 0}>Undo</button>
              <button className="act-btn" onClick={() => { redo(); setMoreOpen(false) }} disabled={future.length === 0}>Redo</button>
            </div>

            <p className="sheet__sec">Create</p>
            <button type="button" className="feat-btn feat-btn--primary"
              onClick={() => { onSketchOpen(); setMoreOpen(false) }}>
              <span className="feat-btn__icon">✍</span>
              <span className="feat-btn__body">
                <span className="feat-btn__title">Sketch to Voxel</span>
                <span className="feat-btn__sub">Draw and convert to 3D</span>
              </span>
            </button>
            <button type="button" className="feat-btn"
              onClick={() => { onVoxelizerOpen(); setMoreOpen(false) }}>
              <span className="feat-btn__icon">⬆</span>
              <span className="feat-btn__body">
                <span className="feat-btn__title">Import Voxels</span>
                <span className="feat-btn__sub">From image or mesh</span>
              </span>
            </button>

            <p className="sheet__sec">Export</p>
            <button className="act-btn act-btn--accent"
              onClick={() => { onGreenscreenOpen(); setMoreOpen(false) }}
              disabled={frames.every(f => f.length === 0) || isExporting}>
              Greenscreen animation
            </button>
            <div className="act-row">
              <button className="act-btn" onClick={() => { exportUnityCS(voxels); setMoreOpen(false) }} disabled={voxels.length === 0}>Unity C#</button>
              <button className="act-btn" onClick={() => { exportGodotGD(voxels); setMoreOpen(false) }} disabled={voxels.length === 0}>Godot GD</button>
            </div>
            <button className="act-btn" onClick={() => { handleGLTF(); setMoreOpen(false) }} disabled={voxels.length === 0 || exporting}>
              {exporting ? 'Exporting…' : 'GLTF / GLB'}
            </button>

            <p className="sheet__sec">Frame</p>
            <button className="act-btn act-btn--danger" disabled={voxels.length === 0}
              onClick={() => { if (window.confirm('Clear all voxels?')) { clearCanvas(); setMoreOpen(false) } }}>
              Clear frame
            </button>
          </div>
        </div>
      )}
    </>
  )
}
