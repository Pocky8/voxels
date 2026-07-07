import * as THREE from 'three'
import {
  CHROMA_GREEN,
  canvasToUint8Array,
  encodePngsToMp4,
  recordVideo,
  canvasToBlob,
  yieldToBrowser,
} from './greenscreenExport'
import { downloadBlob } from './downloadHelper'

/**
 * Create a hologram-style material that preserves the original voxel color
 * but adds emissive glow and slight transparency for a holographic feel.
 */
function createHologramMaterial(color, clippingPlanes) {
  const c = new THREE.Color(color)
  return new THREE.MeshStandardMaterial({
    color: c,
    emissive: c,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.82,
    roughness: 0.3,
    metalness: 0.1,
    clippingPlanes: clippingPlanes || [],
  })
}

/**
 * Create a wireframe overlay mesh for a voxel — gives that digital/holographic edge look.
 */
function createWireframeOverlay(voxel, clippingPlanes) {
  const geo = new THREE.BoxGeometry(1.005, 1.005, 1.005)
  const c = new THREE.Color(voxel.color || '#4f9cf9')
  // Brighten the wireframe color
  c.multiplyScalar(1.5)
  c.r = Math.min(c.r, 1)
  c.g = Math.min(c.g, 1)
  c.b = Math.min(c.b, 1)
  const mat = new THREE.MeshBasicMaterial({
    color: c,
    wireframe: true,
    transparent: true,
    opacity: 0.35,
    clippingPlanes: clippingPlanes || [],
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.fromArray(voxel.position)
  return mesh
}

/**
 * Create a holographic voxel (solid + wireframe overlay).
 */
function createHologramVoxel(voxel, clippingPlanes) {
  const group = new THREE.Group()

  // Main voxel body — original color with glow
  const geo = new THREE.BoxGeometry(1, 1, 1)
  const mat = createHologramMaterial(voxel.color || '#4f9cf9', clippingPlanes)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.fromArray(voxel.position)
  group.add(mesh)

  // Wireframe edge glow
  group.add(createWireframeOverlay(voxel, clippingPlanes))

  return group
}

/**
 * Build the scanline overlay — a screen-space quad with horizontal stripes.
 */
function createScanlineOverlay() {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 128
  const ctx = canvas.getContext('2d')

  // Draw alternating transparent/dark horizontal stripes
  for (let y = 0; y < canvas.height; y++) {
    const isScanline = y % 4 < 2
    ctx.fillStyle = isScanline ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0)'
    ctx.fillRect(0, y, canvas.width, 1)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1, 30)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter

  return texture
}

/**
 * Compute bounds of voxels (single frame or current voxels).
 */
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
    const [x, y, z] = v.position
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

/**
 * Export a hologram animation of the given voxels.
 *
 * @param {Object} opts
 * @param {Array} opts.voxels - Current voxel data
 * @param {number} opts.duration - Duration in seconds
 * @param {number} opts.fps - Frames per second
 * @param {number} opts.pixelScale - Pixelation factor (e.g. 4 = render at 1/4 res)
 * @param {string} opts.format - 'mp4' or 'png'
 * @param {Function} opts.onProgress - Progress callback (current, total, message)
 * @param {Object} opts.logger - Export logger
 */
export async function exportHologram({
  voxels,
  frames,
  clipBackHalf,
  duration,
  fps,
  pixelScale,
  cameraAngle,
  format,
  onProgress,
  logger,
}) {
  const totalFrames = Math.max(1, Math.round(duration * fps))
  const outputSize = 1080
  const renderSize = Math.max(8, Math.round(outputSize / pixelScale))

  logger?.info('hologram export started', {
    totalFrames,
    duration,
    fps,
    pixelScale,
    renderSize,
    outputSize,
    format,
    voxelCount: voxels.length,
  })

  // ── Scene setup ──
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(CHROMA_GREEN)

  // Dim ambient + soft holographic lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.4))

  const topLight = new THREE.PointLight(0xffffff, 2.5)
  topLight.position.set(0, 15, 0)
  scene.add(topLight)

  const frontLight = new THREE.DirectionalLight(0xffffff, 1.2)
  frontLight.position.set(5, 8, 10)
  scene.add(frontLight)

  // ── Setup Clipping for compositing ──
  const clippingPlanes = []
  if (clipBackHalf) {
    // Normal points toward +Z (camera). Anything behind Z=0 (Z < 0) is clipped out.
    clippingPlanes.push(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0))
  }

  // ── Model group (will be rebuilt per frame if animated) ──
  const modelGroup = new THREE.Group()
  
  // Use the first frame or base voxels for initial setup and bounds calculation
  const initialVoxels = (frames && frames.length > 0) ? frames[0] : voxels
  
  for (const voxel of initialVoxels) {
    modelGroup.add(createHologramVoxel(voxel, clippingPlanes))
  }
  scene.add(modelGroup)

  // ── Center the model ──
  // Calculate bounds across all frames to ensure stable camera distance and pivot
  const bounds = getVoxelBounds(
    (frames && frames.length > 0) ? frames.flat() : initialVoxels
  )
  modelGroup.position.set(-bounds.center.x, -bounds.center.y, -bounds.center.z)

  // ── Stand up flat floor drawings (Card view) ──
  const tiltGroup = new THREE.Group()
  tiltGroup.add(modelGroup)
  
  // If the model is flat on the floor (Y is small, Z is large), stand it up
  // so it faces the camera when rotating around the Y axis.
  if (cameraAngle === 'slanted' && bounds.size.y <= 2 && bounds.size.z > 2) {
    tiltGroup.rotation.x = Math.PI / 2 - 0.2
  }

  const turntableGroup = new THREE.Group()
  turntableGroup.add(tiltGroup)
  scene.add(turntableGroup)

  // ── Camera — perspective for 3D depth ──
  const maxDim = Math.max(bounds.size.x, bounds.size.y, bounds.size.z)
  const cameraDistance = maxDim * 1.8
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000)

  if (cameraAngle === 'top') {
    // Bird's eye — looking straight down
    camera.position.set(0, cameraDistance, 0.001)
    camera.up.set(0, 0, -1)
  } else if (cameraAngle === 'side') {
    // Straight-on side view — eye level
    camera.position.set(0, 0, cameraDistance)
  } else {
    // Slanted / card view — elevated looking down slightly
    // If it stood up, maxDim is the new height/width
    camera.position.set(0, maxDim * 0.4, cameraDistance * 0.9)
  }
  camera.lookAt(0, 0, 0)

  // ── Scanline overlay (rendered as screen-space post effect on upscale canvas) ──
  const scanlineTexture = createScanlineOverlay()

  // ── Low-res renderer ──
  const renderCanvas = document.createElement('canvas')
  const renderer = new THREE.WebGLRenderer({
    canvas: renderCanvas,
    antialias: false,
    preserveDrawingBuffer: true,
  })
  renderer.setPixelRatio(1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NoToneMapping
  renderer.localClippingEnabled = true // Enable clipping planes
  renderer.setSize(renderSize, renderSize, false)
  renderer.setClearColor(CHROMA_GREEN, 1)

  // ── Upscale canvas (nearest-neighbor pixelation + scanline overlay) ──
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = outputSize
  outputCanvas.height = outputSize
  const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true })
  outputCtx.imageSmoothingEnabled = false // nearest-neighbor

  // Scanline overlay canvas
  const scanCanvas = document.createElement('canvas')
  scanCanvas.width = outputSize
  scanCanvas.height = outputSize
  const scanCtx = scanCanvas.getContext('2d')

  // Pre-draw scanlines
  scanCtx.clearRect(0, 0, outputSize, outputSize)
  for (let y = 0; y < outputSize; y++) {
    const isScanline = y % (pixelScale * 2) < pixelScale
    if (isScanline) {
      scanCtx.fillStyle = 'rgba(0,0,0,0.12)'
      scanCtx.fillRect(0, y, outputSize, 1)
    }
  }

  // ── Render frames ──
  const pngFrames = []
  const anglePerFrame = (Math.PI * 2) / totalFrames

  for (let i = 0; i < totalFrames; i++) {
    // Rebuild voxels if we have an animation timeline
    if (frames && frames.length > 1) {
      const animFrameIndex = i % frames.length
      const frameVoxels = frames[animFrameIndex] || []
      
      // Clear previous voxels
      while(modelGroup.children.length > 0){ 
        const child = modelGroup.children[0]
        modelGroup.remove(child)
      }
      
      // Add new frame voxels
      for (const voxel of frameVoxels) {
        modelGroup.add(createHologramVoxel(voxel, clippingPlanes))
      }
    }

    // Rotate model (turntable)
    turntableGroup.rotation.y = i * anglePerFrame

    // Animate scanline scroll offset (subtle vertical shift per frame)
    scanlineTexture.offset.y = (i / totalFrames) * 2

    // Render low-res
    renderer.render(scene, camera)

    // Upscale to output with nearest-neighbor
    outputCtx.clearRect(0, 0, outputSize, outputSize)
    outputCtx.drawImage(renderCanvas, 0, 0, outputSize, outputSize)

    // Composite scanline overlay
    outputCtx.drawImage(scanCanvas, 0, 0)

    // Add subtle glow sweep — a bright horizontal band that moves down
    const sweepY = ((i / totalFrames) * outputSize * 1.5) % (outputSize * 1.2) - outputSize * 0.1
    const sweepGrad = outputCtx.createLinearGradient(0, sweepY - 30, 0, sweepY + 30)
    sweepGrad.addColorStop(0, 'rgba(255,255,255,0)')
    sweepGrad.addColorStop(0.5, 'rgba(255,255,255,0.06)')
    sweepGrad.addColorStop(1, 'rgba(255,255,255,0)')
    outputCtx.fillStyle = sweepGrad
    outputCtx.fillRect(0, sweepY - 30, outputSize, 60)

    // Capture frame
    const frameData = canvasToUint8Array(outputCanvas)
    pngFrames.push(frameData)

    onProgress?.(i + 1, totalFrames + 2, `Rendering hologram frame ${i + 1}/${totalFrames}...`)
    logger?.info('hologram frame rendered', { frame: i + 1, totalFrames, size: frameData.byteLength })

    await yieldToBrowser()
  }

  // ── Encode ──
  onProgress?.(totalFrames + 1, totalFrames + 2, 'Encoding video...')

  if (format === 'mp4') {
    let mp4Blob
    try {
      mp4Blob = await encodePngsToMp4(pngFrames, fps, logger, (current, total) => {
        onProgress?.(totalFrames + 1, totalFrames + 2, `Encoding MP4 frame ${current}/${total}...`)
      })
    } catch (encodeErr) {
      logger?.error('ffmpeg hologram encode failed, trying mediarecorder fallback', {
        message: encodeErr?.message || 'Unknown encode error',
      })
      onProgress?.(totalFrames + 1, totalFrames + 2, 'Encoding failed — trying browser recorder...')
      await yieldToBrowser()

      // Re-render via MediaRecorder fallback
      mp4Blob = await recordVideo(
        outputCanvas,
        totalFrames,
        fps,
        async (frameIndex) => {
          // Rebuild voxels if we have an animation timeline
          if (frames && frames.length > 1) {
            const animFrameIndex = frameIndex % frames.length
            const frameVoxels = frames[animFrameIndex] || []
            
            // Clear previous voxels
            while(modelGroup.children.length > 0){ 
              const child = modelGroup.children[0]
              modelGroup.remove(child)
            }
            
            // Add new frame voxels
            for (const voxel of frameVoxels) {
              modelGroup.add(createHologramVoxel(voxel, clippingPlanes))
            }
          }

          turntableGroup.rotation.y = frameIndex * anglePerFrame
          renderer.render(scene, camera)
          outputCtx.clearRect(0, 0, outputSize, outputSize)
          outputCtx.drawImage(renderCanvas, 0, 0, outputSize, outputSize)
          outputCtx.drawImage(scanCanvas, 0, 0)
        },
        logger,
      )
    }

    if (mp4Blob.size === 0) {
      throw new Error('Hologram MP4 encoding produced an empty file.')
    }

    const extension = mp4Blob.type.includes('webm') ? 'webm' : 'mp4'
    downloadBlob(mp4Blob, `voxel-hologram.${extension}`)
    logger?.info('hologram mp4 download started', { size: mp4Blob.size, type: mp4Blob.type })
  } else {
    // PNG sequence
    for (let i = 0; i < pngFrames.length; i++) {
      const blob = new Blob([pngFrames[i]], { type: 'image/png' })
      downloadBlob(blob, `hologram-${String(i + 1).padStart(3, '0')}.png`)
      onProgress?.(totalFrames + 1, totalFrames + 2, `Downloading frame ${i + 1}/${pngFrames.length}...`)
      await yieldToBrowser()
    }
  }

  onProgress?.(totalFrames + 2, totalFrames + 2, 'Export complete')

  // ── Cleanup ──
  modelGroup.traverse((child) => {
    child.geometry?.dispose()
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose())
      } else {
        child.material.dispose()
      }
    }
  })
  renderer.dispose()
  scanlineTexture.dispose()

  logger?.info('hologram export complete')
}
