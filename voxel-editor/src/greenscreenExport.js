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

export function getViewDimensions(plane, { center, size }, padding = 2) {
  if (plane === 'x') {
    const distance = Math.max(size.y, size.z) / 2 + padding + 1
    return {
      center,
      width: size.z,
      height: size.y,
      position: new THREE.Vector3(center.x + distance, center.y, center.z),
      up: new THREE.Vector3(0, 1, 0),
    }
  }
  if (plane === 'y') {
    const distance = Math.max(size.x, size.z) / 2 + padding + 1
    return {
      center,
      width: size.x,
      height: size.z,
      position: new THREE.Vector3(center.x, center.y + distance, center.z),
      up: new THREE.Vector3(0, 0, -1),
    }
  }
  const distance = Math.max(size.x, size.y) / 2 + padding + 1
  return {
    center,
    width: size.x,
    height: size.y,
    position: new THREE.Vector3(center.x, center.y, center.z + distance),
    up: new THREE.Vector3(0, 1, 0),
  }
}

export function getExportCanvasSize(plane, frameBounds, padding = 2) {
  const view = getViewDimensions(plane, frameBounds, padding)
  const aspectWidth = view.width + padding * 2
  const aspectHeight = view.height + padding * 2
  const longestSide = Math.min(1536, 2048)
  const widthIsLonger = aspectWidth >= aspectHeight
  const width = widthIsLonger
    ? longestSide
    : Math.max(1, Math.round(longestSide * (aspectWidth / aspectHeight)))
  const height = widthIsLonger
    ? Math.max(1, Math.round(longestSide * (aspectHeight / aspectWidth)))
    : longestSide

  return {
    width,
    height,
    aspectWidth,
    aspectHeight,
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

export function getVideoMimeType(format, logger) {
  if (format === 'mp4') {
    const mp4Types = [
      'video/mp4;codecs="avc1.42E01E"',
      'video/mp4;codecs=h264',
      'video/mp4',
    ]
    const tested = mp4Types.map((type) => ({
      type,
      supported: MediaRecorder.isTypeSupported(type),
    }))
    const selected = tested.find((item) => item.supported)?.type
    logger?.info('mime type detection', { format, tested, selected })
    return selected
  }

  const selected = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm'
  logger?.info('mime type detection', { format, selected })
  return selected
}

export async function recordVideo(canvas, frameCount, fps, format, onFrame, logger) {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Video export is not supported by this browser.')
  }

  let stream = canvas.captureStream(0)
  let tracks = stream.getTracks()
  let videoTrack = tracks.find((track) => track.kind === 'video')
  const canRequestFrame = typeof videoTrack?.requestFrame === 'function'
  if (!canRequestFrame) {
    for (const track of tracks) track.stop()
    stream = canvas.captureStream(fps)
    tracks = stream.getTracks()
    videoTrack = tracks.find((track) => track.kind === 'video')
  }
  logger?.info('capture stream created', {
    fps,
    manualFrameCapture: canRequestFrame,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    trackCount: tracks.length,
    trackStates: tracks.map((track) => ({
      kind: track.kind,
      muted: track.muted,
      readyState: track.readyState,
    })),
  })

  const mimeType = getVideoMimeType(format, logger)

  if (!mimeType) {
    throw new Error('MP4 export is not supported by this browser. Try PNG sequence instead.')
  }

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  })
  const chunks = []
  const chunkSizes = []

  recorder.ondataavailable = (e) => {
    const size = e.data?.size ?? 0
    chunkSizes.push(size)
    logger?.info('recorder data available', {
      size,
      type: e.data?.type || '',
      recorderState: recorder.state,
    })
    if (size > 0) chunks.push(e.data)
  }

  const done = new Promise((resolve, reject) => {
    recorder.onerror = (e) => {
      const message = e.error?.message || e.message || 'MediaRecorder failed'
      logger?.error('recorder error', { message, recorderState: recorder.state })
      reject(new Error(message))
    }
    recorder.onpause = () => {
      logger?.info('recorder paused', { recorderState: recorder.state })
    }
    recorder.onresume = () => {
      logger?.info('recorder resumed', { recorderState: recorder.state })
    }
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType })
      logger?.info('recorder stopped', {
        recorderState: recorder.state,
        chunkCount: chunks.length,
        chunkSizes,
        blobType: blob.type,
        blobSize: blob.size,
      })
      if (chunks.length === 0 || blob.size === 0) {
        reject(new Error('Video export produced a 0B file. Copy the export log and share it.'))
        return
      }
      resolve(blob)
    }
  })

  recorder.onstart = () => {
    logger?.info('recorder started', { recorderState: recorder.state })
  }

  const frameDelay = 1000 / fps
  recorder.start(Math.max(100, Math.round(frameDelay)))
  logger?.info('recorder start requested', {
    mimeType,
    frameCount,
    frameDelay,
  })

  for (let i = 0; i < frameCount; i++) {
    await onFrame(i)
    if (canRequestFrame) {
      videoTrack.requestFrame()
      logger?.info('manual stream frame requested', { frame: i + 1, frameCount })
    }
    logger?.info('video frame rendered', { frame: i + 1, frameCount })
    await new Promise((r) => setTimeout(r, frameDelay))
  }

  if (recorder.state === 'recording') {
    recorder.requestData()
    logger?.info('recorder data requested before stop')
  }
  recorder.stop()
  return done
}
