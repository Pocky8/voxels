import * as THREE from 'three'

export const CHROMA_GREEN = '#00b140'

export function getAllFramesBounds(frames) {
  const bounds = {
    minX: Infinity, maxX: -Infinity,
    minY: Infinity, maxY: -Infinity,
    minZ: Infinity, maxZ: -Infinity,
  }

  let hasVoxels = false
  for (const frame of frames) {
    for (const voxel of frame) {
      hasVoxels = true
      const [x, y, z] = voxel.position
      bounds.minX = Math.min(bounds.minX, x)
      bounds.maxX = Math.max(bounds.maxX, x)
      bounds.minY = Math.min(bounds.minY, y)
      bounds.maxY = Math.max(bounds.maxY, y)
      bounds.minZ = Math.min(bounds.minZ, z)
      bounds.maxZ = Math.max(bounds.maxZ, z)
    }
  }

  if (!hasVoxels) {
    return {
      center: new THREE.Vector3(0, 0, 0),
      size: new THREE.Vector3(2, 2, 2),
      width: 2,
      height: 2,
    }
  }

  const center = new THREE.Vector3(
    (bounds.minX + bounds.maxX) / 2,
    (bounds.minY + bounds.maxY) / 2,
    (bounds.minZ + bounds.maxZ) / 2,
  )

  const size = new THREE.Vector3(
    bounds.maxX - bounds.minX + 1,
    bounds.maxY - bounds.minY + 1,
    bounds.maxZ - bounds.minZ + 1,
  )

  return { center, size, bounds }
}

export function getViewDimensions(plane, { center, size, bounds }) {
  if (plane === 'x') {
    return {
      center,
      width: size.z,
      height: size.y,
      position: new THREE.Vector3(bounds.maxX + Math.max(size.y, size.z) + 4, center.y, center.z),
      up: new THREE.Vector3(0, 1, 0),
    }
  }
  if (plane === 'y') {
    return {
      center,
      width: size.x,
      height: size.z,
      position: new THREE.Vector3(center.x, bounds.maxY + Math.max(size.x, size.z) + 4, center.z),
      up: new THREE.Vector3(0, 0, -1),
    }
  }
  return {
    center,
    width: size.x,
    height: size.y,
    position: new THREE.Vector3(center.x, center.y, bounds.maxZ + Math.max(size.x, size.y) + 4),
    up: new THREE.Vector3(0, 1, 0),
  }
}

export function configureOrthoCamera(camera, plane, frameBounds, padding = 2) {
  const view = getViewDimensions(plane, frameBounds)
  const halfW = view.width / 2 + padding
  const halfH = view.height / 2 + padding

  camera.left = -halfW
  camera.right = halfW
  camera.top = halfH
  camera.bottom = -halfH
  camera.near = 0.1
  camera.far = 2000
  camera.position.copy(view.position)
  camera.up.copy(view.up)
  camera.lookAt(view.center)
  camera.updateProjectionMatrix()
  return camera
}

export function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function recordWebM(canvas, frameCount, fps, onFrame) {
  const stream = canvas.captureStream(fps)
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm'

  const recorder = new MediaRecorder(stream, { mimeType })
  const chunks = []

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const done = new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
  })

  recorder.start()
  const frameDelay = 1000 / fps

  for (let i = 0; i < frameCount; i++) {
    await onFrame(i)
    await new Promise((r) => setTimeout(r, frameDelay))
  }

  recorder.stop()
  return done
}
