import * as THREE from 'three'
import { downloadBlob, dataURLToBlob } from './downloadHelper'

function getVoxelBounds(voxels) {
  if (voxels.length === 0) {
    return {
      center: new THREE.Vector3(0, 0, 0),
      size: new THREE.Vector3(2, 2, 2),
    }
  }

  const min = new THREE.Vector3(Infinity, Infinity, Infinity)
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity)

  for (const v of voxels) {
    const pos = v.position
    const x = pos[0], y = pos[1], z = pos[2]
    min.x = Math.min(min.x, x)
    min.y = Math.min(min.y, y)
    min.z = Math.min(min.z, z)
    max.x = Math.max(max.x, x)
    max.y = Math.max(max.y, y)
    max.z = Math.max(max.z, z)
  }

  return {
    center: new THREE.Vector3(
      (min.x + max.x) / 2,
      (min.y + max.y) / 2,
      (min.z + max.z) / 2,
    ),
    size: new THREE.Vector3(
      max.x - min.x + 1,
      max.y - min.y + 1,
      max.z - min.z + 1,
    ),
  }
}

export function exportTopDownImage(voxels) {
  console.log('[SNAPSHOT] === Export Top Down Image START ===')
  console.log('[SNAPSHOT] voxels type:', typeof voxels, Array.isArray(voxels))
  console.log('[SNAPSHOT] voxels count:', voxels ? voxels.length : 'null/undefined')

  if (!voxels || voxels.length === 0) {
    console.log('[SNAPSHOT] No voxels, aborting')
    return
  }

  // Log first 3 voxels to understand data shape
  for (let i = 0; i < Math.min(3, voxels.length); i++) {
    const v = voxels[i]
    console.log(`[SNAPSHOT] voxel[${i}] keys:`, Object.keys(v))
    console.log(`[SNAPSHOT] voxel[${i}]:`, JSON.stringify(v))
  }

  const bounds = getVoxelBounds(voxels)
  console.log('[SNAPSHOT] bounds.center:', bounds.center.x, bounds.center.y, bounds.center.z)
  console.log('[SNAPSHOT] bounds.size:', bounds.size.x, bounds.size.y, bounds.size.z)

  // Create an offscreen renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  })
  renderer.setPixelRatio(2)

  const margin = 2
  const frustumWidth = bounds.size.x + margin
  const frustumHeight = bounds.size.z + margin

  const minPixels = 512
  let scale = Math.max(minPixels / frustumWidth, 32)
  const maxPixels = 2048
  if (frustumWidth * scale > maxPixels) scale = maxPixels / frustumWidth
  if (frustumHeight * scale > maxPixels) scale = maxPixels / frustumHeight

  const outputWidth = Math.max(1, Math.round(frustumWidth * scale))
  const outputHeight = Math.max(1, Math.round(frustumHeight * scale))

  console.log('[SNAPSHOT] frustum:', frustumWidth, 'x', frustumHeight)
  console.log('[SNAPSHOT] scale:', scale)
  console.log('[SNAPSHOT] output px:', outputWidth, 'x', outputHeight)

  renderer.setSize(outputWidth, outputHeight, false)
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()

  scene.add(new THREE.AmbientLight(0xffffff, 0.8))
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2)
  keyLight.position.set(10, 20, 15)
  scene.add(keyLight)

  const group = new THREE.Group()
  const geometry = new THREE.BoxGeometry(1, 1, 1)

  let meshCount = 0
  for (const voxel of voxels) {
    const pos = voxel.position
    if (!pos) {
      console.log('[SNAPSHOT] WARNING: voxel has no .position, keys:', Object.keys(voxel))
      continue
    }
    const vx = pos[0], vy = pos[1], vz = pos[2]
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(voxel.color || '#ffffff'),
      roughness: 0.6,
      metalness: 0.1,
    })
    const mesh = new THREE.Mesh(geometry, mat)
    mesh.position.set(
      vx - bounds.center.x,
      vy - bounds.center.y,
      vz - bounds.center.z
    )
    group.add(mesh)
    meshCount++
  }

  console.log('[SNAPSHOT] meshes created:', meshCount)
  scene.add(group)

  const camera = new THREE.OrthographicCamera(
    -frustumWidth / 2, frustumWidth / 2,
    frustumHeight / 2, -frustumHeight / 2,
    0.1, 1000
  )

  camera.position.set(0, 50, 0)
  camera.up.set(0, 0, -1)
  camera.lookAt(0, 0, 0)

  console.log('[SNAPSHOT] camera pos:', camera.position.x, camera.position.y, camera.position.z)
  console.log('[SNAPSHOT] camera frustum L/R/T/B:', -frustumWidth / 2, frustumWidth / 2, frustumHeight / 2, -frustumHeight / 2)

  renderer.render(scene, camera)
  console.log('[SNAPSHOT] render() called')

  const dataUrl = renderer.domElement.toDataURL('image/png')
  console.log('[SNAPSHOT] dataUrl length:', dataUrl.length)
  console.log('[SNAPSHOT] dataUrl prefix:', dataUrl.substring(0, 80))

  const blob = dataURLToBlob(dataUrl)
  console.log('[SNAPSHOT] blob:', blob ? `${blob.size} bytes, type=${blob.type}` : 'NULL')

  if (blob) {
    downloadBlob(blob, `voxel-topdown-${Date.now()}.png`)
    console.log('[SNAPSHOT] download triggered')
  } else {
    console.error('[SNAPSHOT] blob is null, download skipped')
  }

  // Cleanup
  renderer.dispose()
  geometry.dispose()
  for (const child of group.children) {
    child.material.dispose()
  }
  console.log('[SNAPSHOT] === Export Top Down Image END ===')
}
