/**
 * Mesh-to-Voxel Web Worker
 * 
 * Receives: { gltfArrayBuffer, resolution, color }
 * Posts back: { voxels: [{ id, position: [x,y,z], color }] }
 *             or { error: string }
 * 
 * Strategy: AABB subdivision + ray-cast inside/outside test
 * For each candidate cell, shoot 3 rays (+X, +Y, +Z) and count intersections.
 * Odd count on any axis → voxel is inside the mesh.
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

self.onmessage = async (e) => {
  const { gltfArrayBuffer, resolution, color } = e.data

  try {
    const loader = new GLTFLoader()
    const gltf = await new Promise((resolve, reject) => {
      loader.parse(gltfArrayBuffer, '', resolve, reject)
    })

    // Collect all geometry from the scene
    const meshes = []
    gltf.scene.traverse((obj) => {
      if (obj.isMesh) meshes.push(obj)
    })

    if (meshes.length === 0) {
      self.postMessage({ error: 'No meshes found in the GLTF file.' })
      return
    }

    // Compute overall AABB
    const box = new THREE.Box3()
    meshes.forEach((mesh) => {
      mesh.geometry.computeBoundingBox()
      const meshBox = mesh.geometry.boundingBox.clone()
      meshBox.applyMatrix4(mesh.matrixWorld)
      box.union(meshBox)
    })

    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    const cellSize = maxDim / resolution

    // Build a flat triangle list for raycasting
    const raycaster = new THREE.Raycaster()
    const scene = new THREE.Scene()
    meshes.forEach((mesh) => {
      const clone = mesh.clone()
      scene.add(clone)
    })

    const voxels = []
    let id = 1

    const nx = Math.ceil(size.x / cellSize)
    const ny = Math.ceil(size.y / cellSize)
    const nz = Math.ceil(size.z / cellSize)

    for (let ix = 0; ix < nx; ix++) {
      for (let iy = 0; iy < ny; iy++) {
        for (let iz = 0; iz < nz; iz++) {
          const cx = box.min.x + (ix + 0.5) * cellSize
          const cy = box.min.y + (iy + 0.5) * cellSize
          const cz = box.min.z + (iz + 0.5) * cellSize

          if (isInsideMesh(raycaster, scene, cx, cy, cz)) {
            voxels.push({
              id: id++,
              position: [ix, iy, iz],
              color,
            })
          }
        }
      }
      // Report progress
      self.postMessage({ progress: Math.round(((ix + 1) / nx) * 100) })
    }

    self.postMessage({ voxels })
  } catch (err) {
    self.postMessage({ error: err.message ?? String(err) })
  }
}

/**
 * Shoot rays along all 3 axes from the cell center.
 * If intersection count is odd on any axis → inside.
 */
function isInsideMesh(raycaster, scene, cx, cy, cz) {
  const origin = new THREE.Vector3(cx, cy, cz)
  const axes = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
  ]

  for (const dir of axes) {
    raycaster.set(origin, dir)
    const hits = raycaster.intersectObjects(scene.children, true)
    if (hits.length % 2 === 1) return true
  }
  return false
}
