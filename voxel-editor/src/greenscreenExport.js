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
  const longestSide = 1080
  const widthIsLonger = aspectWidth >= aspectHeight
  let width = widthIsLonger
    ? longestSide
    : Math.max(2, Math.round(longestSide * (aspectWidth / aspectHeight)))
  let height = widthIsLonger
    ? Math.max(2, Math.round(longestSide * (aspectHeight / aspectWidth)))
    : longestSide

  // H264 requires even dimensions
  if (width % 2 !== 0) width += 1
  if (height % 2 !== 0) height += 1

  return { width, height, aspectWidth, aspectHeight }
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

/**
 * Convert a canvas to a PNG Uint8Array using toDataURL (base64).
 * This avoids Blob which can lose data in cross-origin-isolated contexts.
 */
export function canvasToUint8Array(canvas) {
  const dataUrl = canvas.toDataURL('image/png')
  const base64 = dataUrl.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

let cachedFfmpeg = null
let ffmpegLoadPromise = null

async function getFfmpeg(logger) {
  if (cachedFfmpeg?.loaded) {
    logger?.info('ffmpeg reused from cache')
    return cachedFfmpeg
  }

  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg')
      const { toBlobURL } = await import('@ffmpeg/util')
      const ffmpeg = new FFmpeg()
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
      logger?.info('loading ffmpeg.wasm...')
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      logger?.info('ffmpeg loaded')
      cachedFfmpeg = ffmpeg
      return ffmpeg
    })().finally(() => {
      ffmpegLoadPromise = null
    })
  }

  return ffmpegLoadPromise
}

async function cleanupFfmpegFilesystem(ffmpeg, frameCount) {
  for (let i = 0; i < frameCount; i++) {
    const filename = `frame${String(i).padStart(4, '0')}.png`
    try {
      await ffmpeg.deleteFile(filename)
    } catch {
      // ignore missing files
    }
  }
  try {
    await ffmpeg.deleteFile('output.mp4')
  } catch {
    // ignore missing output
  }
}

function pickVideoMimeType() {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm',
  ]
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

/**
 * Record canvas frames via MediaRecorder (fallback when ffmpeg encode fails).
 */
export async function recordVideo(canvas, frameCount, fps, renderFrame, logger) {
  const mimeType = pickVideoMimeType()
  if (!mimeType) {
    throw new Error('MediaRecorder is not supported in this browser.')
  }

  const stream = canvas.captureStream(0)
  const track = stream.getVideoTracks()[0]
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  })
  const chunks = []

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }

  const recordingDone = new Promise((resolve, reject) => {
    recorder.onerror = () => reject(new Error('MediaRecorder failed during export.'))
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
  })

  logger?.info('mediarecorder fallback started', { mimeType, frameCount, fps })
  recorder.start()

  const frameDelayMs = Math.max(1, Math.round(1000 / fps))
  for (let i = 0; i < frameCount; i++) {
    await renderFrame(i)
    track.requestFrame?.()
    await new Promise((resolve) => setTimeout(resolve, frameDelayMs))
  }

  recorder.stop()
  const blob = await recordingDone
  logger?.info('mediarecorder fallback complete', { type: blob.type, size: blob.size })
  track.stop()
  return blob
}

async function runFfmpegMp4Encode(ffmpeg, fps, logger) {
  const codecAttempts = [
    {
      codec: 'libx264',
      args: [
        '-framerate', String(fps),
        '-start_number', '0',
        '-i', 'frame%04d.png',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        'output.mp4',
      ],
    },
    {
      codec: 'mpeg4',
      args: [
        '-framerate', String(fps),
        '-start_number', '0',
        '-i', 'frame%04d.png',
        '-c:v', 'mpeg4',
        '-q:v', '2',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        'output.mp4',
      ],
    },
  ]

  for (const attempt of codecAttempts) {
    try {
      await ffmpeg.deleteFile('output.mp4')
    } catch {
      // ignore missing output from prior attempt
    }

    logger?.info('ffmpeg encode attempt', { codec: attempt.codec })
    try {
      await ffmpeg.exec(attempt.args)
      logger?.info('ffmpeg encode succeeded', { codec: attempt.codec })
      return attempt.codec
    } catch (err) {
      logger?.error('ffmpeg encode failed', {
        codec: attempt.codec,
        message: err?.message || 'Unknown ffmpeg error',
      })
    }
  }

  throw new Error('ffmpeg could not encode MP4 with any supported codec.')
}

/**
 * Encode PNG frames directly into MP4 using ffmpeg.wasm.
 *
 * @param {Uint8Array[]} pngFrames - Array of PNG file data as Uint8Array
 * @param {number} fps - Frames per second
 * @param {object} [logger] - Optional logger
 * @returns {Promise<Blob>} - MP4 blob
 */
export async function encodePngsToMp4(pngFrames, fps, logger) {
  const ffmpeg = await getFfmpeg(logger)
  await cleanupFfmpegFilesystem(ffmpeg, pngFrames.length)

  for (let i = 0; i < pngFrames.length; i++) {
    const filename = `frame${String(i).padStart(4, '0')}.png`
    const frameBytes = pngFrames[i].slice()
    logger?.info('writing frame to ffmpeg', { filename, size: frameBytes.byteLength })

    if (frameBytes.byteLength < 1000) {
      throw new Error(`Frame ${i + 1} PNG data is too small (${frameBytes.byteLength} bytes).`)
    }

    await ffmpeg.writeFile(filename, frameBytes)

    const verified = await ffmpeg.readFile(filename)
    logger?.info('verified frame in ffmpeg fs', {
      filename,
      size: verified.byteLength,
    })

    if (verified.byteLength < 1000) {
      throw new Error(`Frame ${i + 1} was not written correctly to ffmpeg (${verified.byteLength} bytes).`)
    }
  }

  await runFfmpegMp4Encode(ffmpeg, fps, logger)

  const data = await ffmpeg.readFile('output.mp4')
  const mp4Blob = new Blob([data], { type: 'video/mp4' })
  logger?.info('mp4 encode complete', { mp4Size: mp4Blob.size })

  if (mp4Blob.size === 0) {
    throw new Error('MP4 encoding produced an empty file.')
  }

  await cleanupFfmpegFilesystem(ffmpeg, pngFrames.length)
  return mp4Blob
}
