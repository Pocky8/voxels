import { useCallback, useEffect, useRef } from 'react'
import { useVoxelStore } from './store'

export default function VoxelGrid({ onAddVoxel, onRemoveVoxel, gridHalf }) {
  const voxels = useVoxelStore((s) => s.voxels)
  const activeTool = useVoxelStore((s) => s.activeTool)
  const isPlaying = useVoxelStore((s) => s.isPlaying)
  const isExporting = useVoxelStore((s) => s.isExporting)
  const continuousDraw = useVoxelStore((s) => s.continuousDraw)
  const isDraggingToDrawRef = useRef(false)

  useEffect(() => {
    const stopDragging = () => {
      isDraggingToDrawRef.current = false
    }
    window.addEventListener('pointerup', stopDragging)
    return () => window.removeEventListener('pointerup', stopDragging)
  }, [])

  const placeAdjacentVoxel = useCallback((e, voxel) => {
    if (!e.face) return
    const [x, y, z] = voxel.position
    const nx = Math.round(e.face.normal.x)
    const ny = Math.round(e.face.normal.y)
    const nz = Math.round(e.face.normal.z)
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
    const newX = clamp(x + nx, -gridHalf + 0.5, gridHalf - 0.5)
    const newZ = clamp(z + nz, -gridHalf + 0.5, gridHalf - 0.5)
    const newY = Math.max(0, y + ny)
    onAddVoxel([newX, newY, newZ])
  }, [gridHalf, onAddVoxel])

  const handleClick = useCallback((e, voxel) => {
    if (isPlaying || isExporting || e.delta > 3) return
    e.stopPropagation()

    if (activeTool === 'erase') {
      onRemoveVoxel(voxel.id)
      return
    }

    placeAdjacentVoxel(e, voxel)
  }, [activeTool, isPlaying, isExporting, onRemoveVoxel, placeAdjacentVoxel])

  const handlePointerDown = useCallback((e, voxel) => {
    if (!continuousDraw || activeTool !== 'draw' || isPlaying || isExporting || e.button !== 0) return
    e.stopPropagation()
    isDraggingToDrawRef.current = true
    placeAdjacentVoxel(e, voxel)
  }, [continuousDraw, activeTool, isPlaying, isExporting, placeAdjacentVoxel])

  const handlePointerMove = useCallback((e, voxel) => {
    if (!continuousDraw || !isDraggingToDrawRef.current || activeTool !== 'draw' || isPlaying || isExporting) return
    if ((e.buttons & 1) !== 1) return
    e.stopPropagation()
    placeAdjacentVoxel(e, voxel)
  }, [continuousDraw, activeTool, isPlaying, isExporting, placeAdjacentVoxel])

  const handlePointerUp = useCallback(() => {
    isDraggingToDrawRef.current = false
  }, [])

  return (
    <>
      {voxels.map((voxel) => (
        <mesh
          key={voxel.id}
          position={voxel.position}
          scale={1}
          onClick={(e) => handleClick(e, voxel)}
          onPointerDown={(e) => handlePointerDown(e, voxel)}
          onPointerMove={(e) => handlePointerMove(e, voxel)}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={voxel.color} roughness={0.62} metalness={0} />
        </mesh>
      ))}
    </>
  )
}
