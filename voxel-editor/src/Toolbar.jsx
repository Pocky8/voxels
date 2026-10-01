import { useState } from 'react'
import { useVoxelStore } from './store'
import { exportUnityCS, exportGodotGD, exportGLTF } from './exporters'
import { exportTopDownImage } from './snapshotExport'
import { Pencil, Eraser, Repeat, FlipHorizontal, Undo2, Redo2, PenTool, Download, MonitorPlay, MoreHorizontal, Palette, Trash2, Scan, Camera, MessageSquareText, Save, UserRound, Images } from 'lucide-react'
import './Toolbar.css'

const PALETTE = [
  '#000000', '#ffffff', '#888888',
  '#ff003c', '#00e5ff', '#ffea00', '#00ff00',
  '#4f9cf9', '#ff9900', '#ff00ff', '#8a2be2'
]

/* ─── shared palette component ─── */
const PaletteGrid = ({ onPick, activeColor, large }) => (
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

export default function Toolbar({ onVoxelizerOpen, onGreenscreenOpen, onSketchOpen, onMemeEditorOpen, onHologramOpen, onOrbitOpen, user, firebaseReady, onAuthOpen, onSignOut, onSaveOpen, onGalleryOpen }) {
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
    try {
      await exportGLTF(voxels)
    } finally {
      setExporting(false)
    }
  }

  const handleSnapshot = () => {
    exportTopDownImage(voxels)
  }

  const closeSheets = () => { setMoreOpen(false); setColorOpen(false) }

  return (
    <>
      {/* ════════════════════════════════════════
          DESKTOP SIDEBAR
      ════════════════════════════════════════ */}
      <aside className="sidebar">

        {/* Brand */}
        <header className="sb-brand">
          <div className="sb-brand__text">
            <p className="sb-brand__name">UnFlat</p>
          </div>
          {firebaseReady && <div className="sb-brand__actions"><button type="button" className="icon-btn" onClick={user ? onSignOut : onAuthOpen} title={user ? 'Sign out' : 'Sign in'}><UserRound size={17} /></button></div>}
        </header>

        <div className="sb-section">
          <p className="sb-label">Tools</p>

          <div className="tool-grid">
            <button type="button"
              className={`tool-btn ${activeTool === 'draw' ? 'tool-btn--on' : ''}`}
              onClick={() => setActiveTool('draw')} title="Draw">
              <span className="tool-btn__icon"><Pencil size={20} strokeWidth={2.5} /></span>
            </button>
            <button type="button"
              className={`tool-btn ${activeTool === 'erase' ? 'tool-btn--on' : ''}`}
              onClick={() => setActiveTool('erase')} title="Erase">
              <span className="tool-btn__icon"><Eraser size={20} strokeWidth={2.5} /></span>
            </button>
          </div>

          <div className="chip-row" style={{ marginTop: '4px' }}>
            <button type="button"
              className={`chip ${continuousDraw ? 'chip--on' : ''}`}
              onClick={() => setContinuousDraw(!continuousDraw)}>
              <Repeat size={16} strokeWidth={3} /> Continuous
            </button>
            <button type="button"
              className={`chip ${mirrorX ? 'chip--on' : ''}`}
              onClick={() => setMirrorX(!mirrorX)}>
              <FlipHorizontal size={16} strokeWidth={3} /> Mirror X
            </button>
          </div>
        </div>

        <div className="sb-section">
          <p className="sb-label">Cloud</p>
          {!firebaseReady ? <p className="feat-btn__sub">Add Firebase settings to enable saving.</p> : user ? <><button type="button" className="feat-btn feat-btn--primary" onClick={onSaveOpen}><span className="feat-btn__icon"><Save size={20} /></span><span className="feat-btn__body"><span className="feat-btn__title">Save creation</span><span className="feat-btn__sub">{user.email}</span></span></button><button type="button" className="feat-btn" onClick={onGalleryOpen}><span className="feat-btn__icon"><Images size={20} /></span><span className="feat-btn__body"><span className="feat-btn__title">My gallery</span><span className="feat-btn__sub">Load saved voxel art</span></span></button></> : <button type="button" className="feat-btn feat-btn--primary" onClick={onAuthOpen}><span className="feat-btn__icon"><UserRound size={20} /></span><span className="feat-btn__body"><span className="feat-btn__title">Sign in to save</span><span className="feat-btn__sub">Keep creations in your gallery</span></span></button>}
        </div>

        {/* ── Color ── */}
        <div className="sb-section">
          <p className="sb-label">
            <Palette size={16} strokeWidth={3} /> Color
          </p>
          <PaletteGrid onPick={setActiveColor} activeColor={activeColor} />
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
            <span className="feat-btn__icon"><PenTool size={20} strokeWidth={2.5} /></span>
            <span className="feat-btn__body">
              <span className="feat-btn__title">Sketch to Voxel</span>
              <span className="feat-btn__sub">Draw and convert to 3D</span>
            </span>
          </button>
          <button type="button" className="feat-btn" onClick={onMemeEditorOpen}>
            <span className="feat-btn__icon"><MessageSquareText size={20} strokeWidth={2.5} /></span>
            <span className="feat-btn__body">
              <span className="feat-btn__title">Meme Editor</span>
              <span className="feat-btn__sub">Templates and text bubbles</span>
            </span>
          </button>
          <button type="button" className="feat-btn" onClick={onVoxelizerOpen}>
            <span className="feat-btn__icon"><Download size={20} strokeWidth={2.5} /></span>
            <span className="feat-btn__body">
              <span className="feat-btn__title">Import Voxels</span>
              <span className="feat-btn__sub">From image or mesh</span>
            </span>
          </button>
        </div>



        {/* ── Export ── */}
        <div className="sb-section">
          <p className="sb-label">Export</p>
          <button type="button" className="feat-btn" onClick={onHologramOpen}
            disabled={voxels.length === 0 || isExporting}>
            <span className="feat-btn__icon"><Scan size={20} strokeWidth={2.5} /></span>
            <span className="feat-btn__body">
              <span className="feat-btn__title">Hologram Export</span>
              <span className="feat-btn__sub">3D hologram on greenscreen</span>
            </span>
          </button>
          <button type="button" className="feat-btn" onClick={onOrbitOpen} style={{ marginTop: 8 }}>
            <span className="feat-btn__icon"><MonitorPlay size={20} strokeWidth={2.5} /></span>
            <span className="feat-btn__body">
              <span className="feat-btn__title">Orbit Animation</span>
              <span className="feat-btn__sub">Floating objects on greenscreen</span>
            </span>
          </button>
          <button type="button" className="feat-btn" onClick={handleSnapshot} style={{ marginTop: 8 }}>
            <span className="feat-btn__icon"><Camera size={20} strokeWidth={2.5} /></span>
            <span className="feat-btn__body">
              <span className="feat-btn__title">Export Image</span>
              <span className="feat-btn__sub">Save current view as PNG</span>
            </span>
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
          <span className="dock-btn__ico"><Pencil size={20} strokeWidth={2.5} /></span>
        </button>
        <button type="button" className={`dock-btn ${activeTool === 'erase' ? 'dock-btn--on' : ''}`}
          onClick={() => { setActiveTool('erase'); closeSheets() }}>
          <span className="dock-btn__ico"><Eraser size={20} strokeWidth={2.5} /></span>
        </button>
        <button type="button" className={`dock-btn ${colorOpen ? 'dock-btn--on' : ''}`}
          onClick={() => { setColorOpen(v => !v); setMoreOpen(false) }}>
          <span className="dock-btn__swatch" style={{ background: activeColor }} />
          <span className="dock-btn__lbl">Color</span>
        </button>
        <button type="button" className="dock-btn"
          onClick={() => { undo(); closeSheets() }} disabled={past.length === 0 || isExporting}>
          <span className="dock-btn__ico"><Undo2 size={20} strokeWidth={2.5} /></span>
        </button>
        <button type="button" className="dock-btn"
          onClick={() => { redo(); closeSheets() }} disabled={future.length === 0 || isExporting}>
          <span className="dock-btn__ico"><Redo2 size={20} strokeWidth={2.5} /></span>
        </button>
        <button type="button" className="dock-btn"
          onClick={() => { if (window.confirm('Clear all voxels in this frame?')) { clearCanvas(); closeSheets() } }}
          disabled={voxels.length === 0}>
          <span className="dock-btn__ico"><Trash2 size={18} strokeWidth={2.5} /></span>
        </button>
        <button type="button" className={`dock-btn ${moreOpen ? 'dock-btn--on' : ''}`}
          onClick={() => { setMoreOpen(v => !v); setColorOpen(false) }}>
          <span className="dock-btn__ico"><MoreHorizontal size={20} strokeWidth={2.5} /></span>
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
            <PaletteGrid large activeColor={activeColor} onPick={c => { setActiveColor(c); setColorOpen(false) }} />
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
                <Repeat size={16} strokeWidth={3} /> Continuous
              </button>
              <button type="button" className={`chip ${mirrorX ? 'chip--on' : ''}`}
                onClick={() => setMirrorX(!mirrorX)}>
                <FlipHorizontal size={16} strokeWidth={3} /> Mirror X
              </button>
            </div>

            <p className="sheet__sec">Create</p>
            <button type="button" className="feat-btn feat-btn--primary"
              onClick={() => { onSketchOpen(); setMoreOpen(false) }}>
              <span className="feat-btn__icon"><PenTool size={18} strokeWidth={2.5} /></span>
              <span className="feat-btn__body">
                <span className="feat-btn__title">Sketch to Voxel</span>
                <span className="feat-btn__sub">Draw and convert to 3D</span>
              </span>
            </button>
            <button type="button" className="feat-btn"
              onClick={() => { onMemeEditorOpen(); setMoreOpen(false) }}>
              <span className="feat-btn__icon"><MessageSquareText size={18} strokeWidth={2.5} /></span>
              <span className="feat-btn__body">
                <span className="feat-btn__title">Meme Editor</span>
                <span className="feat-btn__sub">Templates and text bubbles</span>
              </span>
            </button>
            <button type="button" className="feat-btn"
              onClick={() => { onVoxelizerOpen(); setMoreOpen(false) }}>
              <span className="feat-btn__icon"><Download size={18} strokeWidth={2.5} /></span>
              <span className="feat-btn__body">
                <span className="feat-btn__title">Import Voxels</span>
                <span className="feat-btn__sub">From image or mesh</span>
              </span>
            </button>

            <p className="sheet__sec">Cloud</p>
            {!firebaseReady ? <p className="feat-btn__sub">Add Firebase settings to enable saving.</p> : user ? <><button type="button" className="act-btn act-btn--accent" onClick={() => { onSaveOpen(); setMoreOpen(false) }}>Save creation</button><button type="button" className="act-btn" onClick={() => { onGalleryOpen(); setMoreOpen(false) }}>My gallery</button></> : <button type="button" className="act-btn act-btn--accent" onClick={() => { onAuthOpen(); setMoreOpen(false) }}>Sign in to save</button>}

            <p className="sheet__sec">Export</p>
            <button className="act-btn act-btn--yellow"
              onClick={() => { onGreenscreenOpen(); setMoreOpen(false) }}
              disabled={frames.every(f => f.length === 0) || isExporting}>
              Greenscreen animation
            </button>
            <button className="act-btn act-btn--cyan" style={{ marginTop: '8px' }}
              onClick={() => { onHologramOpen(); setMoreOpen(false) }}
              disabled={voxels.length === 0 || isExporting}>
              Hologram Export
            </button>
            <button className="act-btn act-btn--accent" style={{ marginTop: '8px' }}
              onClick={() => { onOrbitOpen(); setMoreOpen(false) }}
              disabled={isExporting}>
              Orbit Animation
            </button>
            <button className="act-btn act-btn--green" style={{ marginTop: '8px' }}
              onClick={() => { handleSnapshot(); setMoreOpen(false) }}
              disabled={isExporting}>
              Export Image (PNG)
            </button>
            <div className="act-row" style={{ marginTop: '8px' }}>
              <button className="act-btn" onClick={() => { exportUnityCS(voxels); setMoreOpen(false) }} disabled={voxels.length === 0}>Unity C#</button>
              <button className="act-btn" onClick={() => { exportGodotGD(voxels); setMoreOpen(false) }} disabled={voxels.length === 0}>Godot GD</button>
            </div>
            <button className="act-btn" onClick={() => { handleGLTF(); setMoreOpen(false) }} disabled={voxels.length === 0 || exporting}>
              {exporting ? 'Exporting…' : 'GLTF / GLB'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
