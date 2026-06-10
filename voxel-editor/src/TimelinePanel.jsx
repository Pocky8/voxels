import { useVoxelStore } from './store'
import './TimelinePanel.css'

export default function TimelinePanel() {
  const frames = useVoxelStore((s) => s.frames)
  const currentFrame = useVoxelStore((s) => s.currentFrame)
  const isPlaying = useVoxelStore((s) => s.isPlaying)
  const voxels = useVoxelStore((s) => s.voxels)
  const setCurrentFrame = useVoxelStore((s) => s.setCurrentFrame)
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
          ‹
        </button>
        <button
          type="button"
          className={`timeline__btn timeline__btn--play ${isPlaying ? 'active' : ''}`}
          onClick={togglePlayback}
          title={isPlaying ? 'Stop' : 'Play'}
        >
          {isPlaying ? '■' : '▶'}
        </button>
        <button
          type="button"
          className="timeline__btn"
          onClick={() => setCurrentFrame(Math.min(frames.length - 1, currentFrame + 1))}
          disabled={isPlaying}
          title="Next frame"
        >
          ›
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
            <span className="timeline__frame-count">{frame.length}</span>
          </button>
        ))}
        <button
          type="button"
          className="timeline__frame timeline__frame--add"
          onClick={addFrameAfterCurrent}
          disabled={isPlaying}
          title="Add frame"
        >
          +
        </button>
      </div>

      <div className="timeline__actions">
        <span className="timeline__stat">{voxels.length} voxels</span>
        <button
          type="button"
          className="timeline__action"
          onClick={removeCurrentFrame}
          disabled={frames.length <= 1 || isPlaying}
        >
          Remove frame
        </button>
      </div>
    </footer>
  )
}
