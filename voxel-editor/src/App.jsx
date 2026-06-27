import { useState, useCallback, useEffect, useMemo, useRef, lazy, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { GizmoHelper, GizmoViewport } from '@react-three/drei'
import { useVoxelStore } from './store'
import VoxelGrid from './VoxelGrid'
import SceneControls from './SceneControls'
import ExportCapture from './ExportCapture'
import Toolbar from './Toolbar'
import TimelinePanel from './TimelinePanel'

const VoxelizerModal = lazy(() => import('./VoxelizerModal'))
const GreenscreenExportModal = lazy(() => import('./GreenscreenExportModal'))
const SketchModal = lazy(() => import('./SketchModal'))

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
  const [isCoarsePointer, setIsCoarsePointer] = useState(
    () => window.matchMedia('(pointer: coarse)').matches
  )
  const floorDragPaintRef = useRef(false)
  const lastFloorCellRef = useRef(null)   // { x, z } integer cell coords
  const exportCaptureRef = useRef(null)

  const gridSize = useMemo(() => {
    const gridExtent = Math.max(
      40,
      Math.ceil(
        voxels.reduce((max, voxel) => {
          const [x, , z] = voxel.position
          return Math.max(max, Math.abs(x), Math.abs(z))
        }, 0) * 2 + 4
      )
    )
    return gridExtent % 2 === 0 ? gridExtent : gridExtent + 1
  }, [voxels])
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
    const mq = window.matchMedia('(pointer: coarse)')
    const handler = (e) => setIsCoarsePointer(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
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
    const isTouch = e.nativeEvent?.pointerType === 'touch'
    if (activeTool !== 'draw' || isPlaying || isExporting || e.delta > (isTouch ? 10 : 3)) return
    e.stopPropagation()
    const { point } = e
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
    const x = clamp(Math.floor(point.x) + 0.5, -gridHalf + 0.5, gridHalf - 0.5)
    const z = clamp(Math.floor(point.z) + 0.5, -gridHalf + 0.5, gridHalf - 0.5)
    addVoxel([x, 0, z])
  }, [activeTool, addVoxel, isPlaying, isExporting, gridHalf])

  const paintFloorAtPoint = useCallback((point) => {
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
    const cx = Math.floor(point.x)
    const cz = Math.floor(point.z)

    const paintCell = (cellX, cellZ) => {
      addVoxel([
        clamp(cellX + 0.5, -gridHalf + 0.5, gridHalf - 0.5),
        0,
        clamp(cellZ + 0.5, -gridHalf + 0.5, gridHalf - 0.5),
      ])
    }

    const last = lastFloorCellRef.current
    if (last && (last.x !== cx || last.z !== cz)) {
      // Bresenham line from last (exclusive) to current (inclusive)
      // ensures no gaps when the pointer moves faster than event rate
      let x0 = last.x, z0 = last.z
      const dx = Math.abs(cx - x0), sx = x0 < cx ? 1 : -1
      const dz = Math.abs(cz - z0), sz = z0 < cz ? 1 : -1
      let err = dx - dz
      while (true) {
        const e2 = 2 * err
        if (e2 > -dz) { err -= dz; x0 += sx }
        if (e2 < dx)  { err += dx; z0 += sz }
        paintCell(x0, z0)
        if (x0 === cx && z0 === cz) break
      }
    } else {
      paintCell(cx, cz)
    }

    lastFloorCellRef.current = { x: cx, z: cz }
  }, [addVoxel, gridHalf])

  const handleFloorPointerDown = useCallback((e) => {
    if (!continuousDraw || activeTool !== 'draw' || isPlaying || isExporting || e.button !== 0) return
    e.stopPropagation()
    floorDragPaintRef.current = true
    lastFloorCellRef.current = null   // reset stroke start
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
    lastFloorCellRef.current = null
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

  const paintMode = continuousDraw && !isPlaying && !isExporting

  return (
    <>
      <Toolbar
        onVoxelizerOpen={() => setShowVoxelizer(true)}
        onGreenscreenOpen={() => setShowGreenscreen(true)}
        onSketchOpen={() => setShowSketch(true)}
      />
      <TimelinePanel 
        onGreenscreenOpen={() => setShowGreenscreen(true)}
      />

      <div className="canvas-wrapper">
        <Canvas
          camera={{ position: [8, 8, 8], fov: 50 }}
          dpr={[1, 2]}
          gl={{ antialias: true, toneMapping: 0 }}
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
          {!isExporting && !isCoarsePointer && (
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
                ? (isCoarsePointer
                  ? (continuousDraw
                    ? 'Drag to paint · Two fingers to move'
                    : 'One finger to edit · Two fingers to move')
                  : (continuousDraw
                    ? 'Drag to paint · Right-click to orbit'
                    : 'Click to place voxels'))
                : (isCoarsePointer
                  ? (continuousDraw
                    ? 'Drag to erase · Two fingers to move'
                    : 'One finger to erase · Two fingers to move')
                  : (continuousDraw
                    ? 'Drag to erase · Right-click to orbit'
                    : 'Click a voxel to erase'))}
        </div>
      </div>

      {showVoxelizer && (
        <Suspense fallback={null}>
          <VoxelizerModal onClose={() => setShowVoxelizer(false)} />
        </Suspense>
      )}

      {showSketch && (
        <Suspense fallback={null}>
          <SketchModal onClose={() => setShowSketch(false)} />
        </Suspense>
      )}

      {showGreenscreen && (
        <Suspense fallback={null}>
          <GreenscreenExportModal
            frameCount={frames.length}
            onClose={() => setShowGreenscreen(false)}
            onExport={async (opts) => {
              await handleGreenscreenExport(opts)
            }}
          />
        </Suspense>
      )}
    </>
  )
}
