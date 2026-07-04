import { useRef, useEffect, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

const CHROMA_GREEN = '#00b140'

/**
 * Renders a single voxel model as an InstancedMesh (performant).
 * Normalizes to a fixed physical size so detail level doesn't change the model's footprint.
 */
const TARGET_SIZE = 16

function VoxelModel({ voxels, position }) {
  const groupRef = useRef()
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])

  useEffect(() => {
    const group = groupRef.current
    if (!group) return

    // Clear previous meshes
    while (group.children.length) {
      const child = group.children[0]
      group.remove(child)
      child.geometry?.dispose()
      child.material?.dispose()
    }
    group.scale.setScalar(1)

    if (voxels.length === 0) return

    const mat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1 })
    const mesh = new THREE.InstancedMesh(geo, mat, voxels.length)

    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    let minZ = Infinity, maxZ = -Infinity

    for (let i = 0; i < voxels.length; i++) {
      const v = voxels[i]
      const px = v.position[0], py = v.position[1], pz = v.position[2]
      dummy.position.set(px, py, pz)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      color.set(v.color)
      mesh.setColorAt(i, color)
      minX = Math.min(minX, px); maxX = Math.max(maxX, px)
      minY = Math.min(minY, py); maxY = Math.max(maxY, py)
      minZ = Math.min(minZ, pz); maxZ = Math.max(maxZ, pz)
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    group.add(mesh)

    // Normalize to fixed size
    const maxDim = Math.max(maxX - minX + 1, maxY - minY + 1, maxZ - minZ + 1)
    if (maxDim > 0) {
      group.scale.setScalar(TARGET_SIZE / maxDim)
    }

    return () => {
      mat.dispose()
    }
  }, [voxels, geo])

  return <group ref={groupRef} position={position} />
}

/**
 * The orbital rig — places models in a circle and auto-rotates.
 */
function OrbitRig({ items }) {
  const masterRef = useRef()

  useFrame((_, delta) => {
    if (masterRef.current) {
      masterRef.current.rotation.y += delta * 0.3
    }
  })

  // Each item's bob effect
  const itemRefs = useRef([])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    items.forEach((item, i) => {
      const ref = itemRefs.current[i]
      if (!ref) return
      const angle = (i / items.length) * Math.PI * 2
      ref.position.x = Math.cos(angle) * item.radius
      ref.position.z = Math.sin(angle) * item.radius
      // Bobbing
      const bobOffset = item.floatOffset || (i * Math.PI / 2)
      ref.position.y = item.height + Math.sin(t * 1.2 + bobOffset) * 2
      // Local spin
      ref.rotation.y = t * (item.spinSpeed || 2) * 0.5
    })
  })

  return (
    <group ref={masterRef}>
      {items.map((item, index) => (
        <group
          key={item.id}
          ref={(el) => { itemRefs.current[index] = el }}
        >
          <VoxelModel voxels={item.voxels} position={[0, 0, 0]} />
        </group>
      ))}
    </group>
  )
}

/**
 * Live 3D preview of the orbit animation.
 */
export default function OrbitPreview({ items }) {
  if (items.length === 0) return null

  // Camera distance based on largest radius
  const maxRadius = items.reduce((max, i) => Math.max(max, i.radius || 25), 25)
  const camDist = maxRadius * 2.5

  return (
    <div className="orbit-preview">
      <Canvas
        camera={{ position: [0, 8, camDist], fov: 45 }}
        gl={{ antialias: true, toneMapping: 0 }}
      >
        <color attach="background" args={[CHROMA_GREEN]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 15]} intensity={1.5} />
        <directionalLight position={[-10, 5, -15]} intensity={0.8} color="#c0d8ff" />

        <OrbitRig items={items} />
        <OrbitControls enablePan={false} />
      </Canvas>
      <span className="orbit-preview__label">Preview · drag to rotate</span>
    </div>
  )
}
