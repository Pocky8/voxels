import { useState, useCallback, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { GizmoHelper, GizmoViewport } from '@react-three/drei'
import { useVoxelStore } from './store'
import VoxelGrid from './VoxelGrid'
import SceneControls from './SceneControls'
import ExportCapture from './ExportCapture'
import Toolbar from './Toolbar'
import TimelinePanel from './TimelinePanel'
import VoxelizerModal from './VoxelizerModal'
import GreenscreenExportModal from './GreenscreenExportModal'
import SketchModal from './SketchModal'

export default function App() {
  const voxels = useVoxelStore((s) => s.voxels)
  const addVoxel = useVoxelStore((s) => s.addVoxel)
  const removeVoxel = useVoxelStore((s) => s.removeVoxel)
  const activeTool = useVoxelStore((s) => s.activeTool)
  const frames = useVoxelStore((s) => s.frames)
  const isPlaying = useVoxelStore((s) => s.isPlaying)
  const fps = useVoxelStore((s) => s.fps)
  const stepPlayback = useVoxelStore((s) => s.stepPlayback)
  const continuousDraw = useVoxelStore((s) => s.continuousDraw)
  const showGrid = useVoxelStore((s) => s.showGrid)
  const isExporting = useVoxelStore((s) => s.isExporting)
  const setShowGrid = useVoxelStore((s) => s.setShowGrid)
  const setIsExporting = useVoxelStore((s) => s.setIsExporting)
  const stopPlayback = useVoxelStore((s) => s.stopPlayback)
  const undo = useVoxelStore((s) => s.undo)
  const redo = useVoxelStore((s) => s.redo)

  const [showVoxelizer, setShowVoxelizer] = useState(false)
  const [showGreenscreen, setShowGreenscreen] = useState(false)
  const [showSketch, setShowSketch] = useState(false)
  const floorDragPaintRef = useRef(false)
  const exportCaptureRef = useRef(null)

  const gridExtent = Math.max(
    40,
    Math.ceil(
      voxels.reduce((max, voxel) => {
        const [x, , z] = voxel.position
        return Math.max(max, Math.abs(x), Math.abs(z))
      }, 0) * 2 + 4
    )
  )
  const gridSize = gridExtent % 2 === 0 ? gridExtent : gridExtent + 1
  const gridHalf = gridSize / 2

  useEffect(() => {
    if (!isPlaying) return undefined
    const intervalMs = Math.max(1, Math.round(1000 / fps))
    const timer = window.setInterval(() => {
      stepPlayback()
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [isPlaying, fps, stepPlayback])

  useEffect(() => {
    const stopDragPaint = () => {
      floorDragPaintRef.current = false
    }
    window.addEventListener('pointerup', stopDragPaint)
    return () => window.removeEventListener('pointerup', stopDragPaint)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target
      const isTyping = target instanceof HTMLElement && (
        target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      )
      if (isTyping || (!e.ctrlKey && !e.metaKey)) return

      const key = e.key.toLowerCase()
      if (key === 'z' && e.shiftKey) {
        e.preventDefault()
        redo()
        return
      }
      if (key === 'z') {
        e.preventDefault()
        undo()
        return
      }
      if (key === 'y') {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [redo, undo])

  const handleFloorClick = useCallback((e) => {
    if (activeTool !== 'draw' || isPlaying || isExporting || e.delta > 3) return
    e.stopPropagation()
    const { point } = e
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
    const x = clamp(Math.floor(point.x) + 0.5, -gridHalf + 0.5, gridHalf - 0.5)
    const z = clamp(Math.floor(point.z) + 0.5, -gridHalf + 0.5, gridHalf - 0.5)
    addVoxel([x, 0, z])
  }, [activeTool, addVoxel, isPlaying, isExporting, gridHalf])

  const paintFloorAtPoint = useCallback((point) => {
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
    const x = clamp(Math.floor(point.x) + 0.5, -gridHalf + 0.5, gridHalf - 0.5)
    const z = clamp(Math.floor(point.z) + 0.5, -gridHalf + 0.5, gridHalf - 0.5)
    addVoxel([x, 0, z])
  }, [addVoxel, gridHalf])

  const handleFloorPointerDown = useCallback((e) => {
    if (!continuousDraw || activeTool !== 'draw' || isPlaying || isExporting || e.button !== 0) return
    e.stopPropagation()
    floorDragPaintRef.current = true
    paintFloorAtPoint(e.point)
  }, [continuousDraw, activeTool, isPlaying, isExporting, paintFloorAtPoint])

  const handleFloorPointerMove = useCallback((e) => {
    if (!continuousDraw || !floorDragPaintRef.current || isPlaying || isExporting) return
    if ((e.buttons & 1) !== 1) return
    e.stopPropagation()
    paintFloorAtPoint(e.point)
  }, [continuousDraw, isPlaying, isExporting, paintFloorAtPoint])

  const handleFloorPointerUp = useCallback(() => {
    floorDragPaintRef.current = false
  }, [])

  const handleGreenscreenExport = useCallback(async ({ plane, format, onProgress, logger }) => {
    stopPlayback()
    setIsExporting(true)
    setShowGrid(false)
    try {
      await exportCaptureRef.current?.exportGreenscreen({
        frames,
        plane,
        fps,
        format,
        onProgress,
        logger,
      })
    } finally {
      setShowGrid(true)
      setIsExporting(false)
    }
  }, [frames, fps, setIsExporting, setShowGrid, stopPlayback])

  const paintMode = continuousDraw && activeTool === 'draw' && !isPlaying && !isExporting

  return (
    <>
      <Toolbar
        onVoxelizerOpen={() => setShowVoxelizer(true)}
        onGreenscreenOpen={() => setShowGreenscreen(true)}
        onSketchOpen={() => setShowSketch(true)}
      />
      <TimelinePanel />

      <div className="canvas-wrapper">
        <Canvas
          camera={{ position: [8, 8, 8], fov: 50 }}
          gl={{ antialias: true, toneMapping: 0, preserveDrawingBuffer: true }}
        >
          <color attach="background" args={['#f4f6f8']} />

          <ambientLight intensity={1.2} />
          <directionalLight position={[10, 14, 8]} intensity={2.4} />
          <directionalLight position={[-6, 4, -8]} intensity={1.0} color="#c0d8ff" />
          <pointLight position={[0, 8, 0]} intensity={3.0} />

          <VoxelGrid
            onAddVoxel={addVoxel}
            onRemoveVoxel={removeVoxel}
            gridHalf={gridHalf}
          />

          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.5, 0]}
            onClick={handleFloorClick}
            onPointerDown={handleFloorPointerDown}
            onPointerMove={handleFloorPointerMove}
            onPointerUp={handleFloorPointerUp}
            onPointerLeave={handleFloorPointerUp}
          >
            <planeGeometry args={[gridSize, gridSize]} />
            <meshBasicMaterial visible={false} />
          </mesh>

          {showGrid && (
            <gridHelper args={[gridSize, gridSize, '#7b8797', '#b2bcc8']} position={[0, -0.5, 0]} />
          )}

          {!isExporting && <SceneControls paintMode={paintMode} />}
          {!isExporting && (
            <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
              <GizmoViewport axisColors={['#f94144', '#4cc9f0', '#4f9cf9']} labelColor="white" />
            </GizmoHelper>
          )}

          <ExportCapture ref={exportCaptureRef} />
        </Canvas>

        <div className="canvas-hint">
          {isExporting
            ? 'Exporting animation…'
            : isPlaying
              ? 'Playback running'
              : activeTool === 'draw'
                ? (continuousDraw
                  ? 'Drag to paint · Right-click to orbit'
                  : 'Click to place voxels')
                : 'Click a voxel to erase'}
        </div>
      </div>

      {showVoxelizer && (
        <VoxelizerModal onClose={() => setShowVoxelizer(false)} />
      )}

      {showSketch && (
        <SketchModal onClose={() => setShowSketch(false)} />
      )}

      {showGreenscreen && (
        <GreenscreenExportModal
          frameCount={frames.length}
          onClose={() => setShowGreenscreen(false)}
          onExport={async (opts) => {
            await handleGreenscreenExport(opts)
          }}
        />
      )}
    </>
  )
}
