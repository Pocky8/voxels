import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useVoxelStore } from './store'

const matrixObject = new THREE.Object3D()

function VoxelInstances({
  color,
  voxels,
  onClickVoxel,
  onPointerDownVoxel,
  onPointerMoveVoxel,
  onPointerUp,
}) {
  const meshRef = useRef(null)
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.62,
    metalness: 0,
  }), [color])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    voxels.forEach((voxel, index) => {
      matrixObject.position.fromArray(voxel.position)
      matrixObject.rotation.set(0, 0, 0)
      matrixObject.scale.set(1, 1, 1)
      matrixObject.updateMatrix()
      mesh.setMatrixAt(index, matrixObject.matrix)
    })
    mesh.count = voxels.length
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [voxels])

  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  const getVoxel = useCallback((e) => {
    if (e.instanceId == null) return null
    return voxels[e.instanceId] ?? null
  }, [voxels])

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, voxels.length]}
      onClick={(e) => {
        const voxel = getVoxel(e)
        if (voxel) onClickVoxel(e, voxel)
      }}
      onPointerDown={(e) => {
        const voxel = getVoxel(e)
        if (voxel) onPointerDownVoxel(e, voxel)
      }}
      onPointerMove={(e) => {
        const voxel = getVoxel(e)
        if (voxel) onPointerMoveVoxel(e, voxel)
      }}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    />
  )
}

export default function VoxelGrid({ onAddVoxel, onRemoveVoxel, gridHalf }) {
  const voxels = useVoxelStore((s) => s.voxels)
  const activeTool = useVoxelStore((s) => s.activeTool)
  const isPlaying = useVoxelStore((s) => s.isPlaying)
  const isExporting = useVoxelStore((s) => s.isExporting)
  const continuousDraw = useVoxelStore((s) => s.continuousDraw)
  const isDraggingToDrawRef = useRef(false)

  const voxelGroups = useMemo(() => {
    const groups = new Map()
    for (const voxel of voxels) {
      const color = voxel.color || '#4f9cf9'
      const group = groups.get(color)
      if (group) {
        group.push(voxel)
      } else {
        groups.set(color, [voxel])
      }
    }
    return Array.from(groups, ([color, groupVoxels]) => ({ color, voxels: groupVoxels }))
  }, [voxels])

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
    const deltaThreshold = e.nativeEvent?.pointerType === 'touch' ? 10 : 3
    if (isPlaying || isExporting || e.delta > deltaThreshold) return
    e.stopPropagation()

    if (activeTool === 'erase') {
      onRemoveVoxel(voxel.id)
      return
    }

    placeAdjacentVoxel(e, voxel)
  }, [activeTool, isPlaying, isExporting, onRemoveVoxel, placeAdjacentVoxel])

  const handlePointerDown = useCallback((e, voxel) => {
    if (!continuousDraw || isPlaying || isExporting || e.button !== 0) return
    e.stopPropagation()
    isDraggingToDrawRef.current = true
    if (activeTool === 'erase') {
      onRemoveVoxel(voxel.id)
    } else {
      placeAdjacentVoxel(e, voxel)
    }
  }, [continuousDraw, activeTool, isPlaying, isExporting, onRemoveVoxel, placeAdjacentVoxel])

  const handlePointerMove = useCallback((e, voxel) => {
    if (!continuousDraw || !isDraggingToDrawRef.current || isPlaying || isExporting) return
    if ((e.buttons & 1) !== 1) return
    e.stopPropagation()
    if (activeTool === 'erase') {
      onRemoveVoxel(voxel.id)
    } else {
      placeAdjacentVoxel(e, voxel)
    }
  }, [continuousDraw, activeTool, isPlaying, isExporting, onRemoveVoxel, placeAdjacentVoxel])

  const handlePointerUp = useCallback(() => {
    isDraggingToDrawRef.current = false
  }, [])

  return (
    <>
      {voxelGroups.map((group) => (
        <VoxelInstances
          key={`${group.color}-${group.voxels.length}`}
          color={group.color}
          voxels={group.voxels}
          onClickVoxel={handleClick}
          onPointerDownVoxel={handlePointerDown}
          onPointerMoveVoxel={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      ))}
    </>
  )
}
