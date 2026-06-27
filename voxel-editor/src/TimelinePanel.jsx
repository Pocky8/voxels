import { useState } from 'react'
import { useVoxelStore } from './store'
import { Play, Square, ChevronLeft, ChevronRight, Plus, Trash2, Video, Box, Layers, Code, Undo2, Redo2 } from 'lucide-react'
import { exportUnityCS, exportGodotGD, exportGLTF } from './exporters'
import './TimelinePanel.css'

export default function TimelinePanel({ onGreenscreenOpen }) {
  const frames = useVoxelStore((s) => s.frames)
  const currentFrame = useVoxelStore((s) => s.currentFrame)
  const isPlaying = useVoxelStore((s) => s.isPlaying)
  const fps = useVoxelStore((s) => s.fps)
  const voxels = useVoxelStore((s) => s.voxels)
  const isExportingStore = useVoxelStore((s) => s.isExporting)
  const past = useVoxelStore((s) => s.past)
  const future = useVoxelStore((s) => s.future)
  const undo = useVoxelStore((s) => s.undo)
  const redo = useVoxelStore((s) => s.redo)
  const setCurrentFrame = useVoxelStore((s) => s.setCurrentFrame)
  const setFps = useVoxelStore((s) => s.setFps)
  const addFrameAfterCurrent = useVoxelStore((s) => s.addFrameAfterCurrent)
  const removeCurrentFrame = useVoxelStore((s) => s.removeCurrentFrame)
  const togglePlayback = useVoxelStore((s) => s.togglePlayback)

  const [exportingGltf, setExportingGltf] = useState(false)

  const handleGLTF = async () => {
    setExportingGltf(true)
    await exportGLTF(voxels)
    setExportingGltf(false)
  }

  return (
    <footer className="timeline">
      <div className="timeline__transport">
        <button
          type="button"
          className="timeline__btn"
          onClick={undo}
          disabled={past.length === 0 || isPlaying}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={20} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          className="timeline__btn"
          onClick={redo}
          disabled={future.length === 0 || isPlaying}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={20} strokeWidth={2.5} />
        </button>
        
        <div className="timeline__divider" />

        <button
          type="button"
          className="timeline__btn"
          onClick={() => setCurrentFrame(Math.max(0, currentFrame - 1))}
          disabled={isPlaying}
          title="Previous frame"
        >
          <ChevronLeft size={20} strokeWidth={3} />
        </button>
        <button
          type="button"
          className={`timeline__btn timeline__btn--play ${isPlaying ? 'active' : ''}`}
          onClick={togglePlayback}
          title={isPlaying ? 'Stop' : 'Play'}
        >
          {isPlaying ? <Square size={16} fill="currentColor" strokeWidth={2.5} /> : <Play size={20} fill="currentColor" strokeWidth={2.5} />}
        </button>
        <button
          type="button"
          className="timeline__btn"
          onClick={() => setCurrentFrame(Math.min(frames.length - 1, currentFrame + 1))}
          disabled={isPlaying}
          title="Next frame"
        >
          <ChevronRight size={20} strokeWidth={3} />
        </button>
      </div>

      <div className="timeline__frames">
        {frames.map((frame, i) => (
          <button
            key={i}
            type="button"
            className={`timeline__frame ${i === currentFrame ? 'active' : ''}`}
            onClick={() => !isPlaying && setCurrentFrame(i)}
            disabled={isPlaying}
            title={`Frame ${i + 1} · ${frame.length} voxels`}
          >
            <span className="timeline__frame-num">{i + 1}</span>
          </button>
        ))}
        <button
          type="button"
          className="timeline__frame timeline__frame--add"
          onClick={addFrameAfterCurrent}
          disabled={isPlaying}
          title="Add frame"
        >
          <Plus size={24} strokeWidth={3} />
        </button>
      </div>

      <div className="timeline__actions">
        <div className="timeline__exports">
          <button className="timeline__action" title="Export MP4/Greenscreen" 
            onClick={onGreenscreenOpen} disabled={frames.every(f => f.length === 0) || isExportingStore}>
            <Video size={16} strokeWidth={2.5} />
            <span>MP4</span>
          </button>
          <button className="timeline__action" title="Export GLTF/GLB" 
            onClick={handleGLTF} disabled={voxels.length === 0 || exportingGltf}>
            <Box size={16} strokeWidth={2.5} />
            <span>GLTF</span>
          </button>
          <button className="timeline__action" title="Export Unity C#" 
            onClick={() => exportUnityCS(voxels)} disabled={voxels.length === 0}>
            <Layers size={16} strokeWidth={2.5} />
            <span>Unity</span>
          </button>
          <button className="timeline__action" title="Export Godot GD" 
            onClick={() => exportGodotGD(voxels)} disabled={voxels.length === 0}>
            <Code size={16} strokeWidth={2.5} />
            <span>Godot</span>
          </button>
          <div className="timeline__divider" />
        </div>

        <label className="timeline__fps" title="Playback and export FPS">
          <span>FPS</span>
          <select
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            disabled={isPlaying}
          >
            <option value={6}>6</option>
            <option value={12}>12</option>
            <option value={24}>24</option>
          </select>
        </label>
        <button
          type="button"
          className="timeline__action timeline__action--danger"
          onClick={removeCurrentFrame}
          disabled={frames.length <= 1 || isPlaying}
          title="Remove frame"
        >
          <Trash2 size={16} strokeWidth={2.5} />
        </button>
      </div>
    </footer>
  )
}
