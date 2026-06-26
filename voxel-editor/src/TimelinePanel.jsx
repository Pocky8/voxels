import { useVoxelStore } from './store'
import { Play, Square, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import './TimelinePanel.css'

export default function TimelinePanel() {
  const frames = useVoxelStore((s) => s.frames)
  const currentFrame = useVoxelStore((s) => s.currentFrame)
  const isPlaying = useVoxelStore((s) => s.isPlaying)
  const voxels = useVoxelStore((s) => s.voxels)
  const fps = useVoxelStore((s) => s.fps)
  const setCurrentFrame = useVoxelStore((s) => s.setCurrentFrame)
  const setFps = useVoxelStore((s) => s.setFps)
  const addFrameAfterCurrent = useVoxelStore((s) => s.addFrameAfterCurrent)
  const removeCurrentFrame = useVoxelStore((s) => s.removeCurrentFrame)
  const togglePlayback = useVoxelStore((s) => s.togglePlayback)

  return (
    <footer className="timeline">
      <div className="timeline__transport">
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
        <span className="timeline__counter">
          {currentFrame + 1} / {frames.length}
        </span>
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
        <span className="timeline__stat">{voxels.length} voxels</span>
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
          className="timeline__action"
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
