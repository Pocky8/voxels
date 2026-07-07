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
 * Creates a THREE.Group from an array of voxels, centering them around (0,0,0)
 * and normalizing to a fixed physical size.
 */
const TARGET_MODEL_SIZE = 16

function createCenteredVoxelModel(voxels) {
  const group = new THREE.Group()
  const geometry = new THREE.BoxGeometry(1, 1, 1)

  const bounds = getVoxelBounds(voxels)
  
  for (const voxel of voxels) {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(voxel.color || '#ffffff'),
      roughness: 0.6,
      metalness: 0.1,
    })
    const mesh = new THREE.Mesh(geometry, mat)
    // Shift position by -center so the group naturally pivots around its own center
    mesh.position.set(
      voxel.position[0] - bounds.center.x,
      voxel.position[1] - bounds.center.y,
      voxel.position[2] - bounds.center.z
    )
    group.add(mesh)
  }

  // Normalize to fixed size so detail level only changes fidelity, not footprint
  const maxDim = Math.max(bounds.size.x, bounds.size.y, bounds.size.z)
  if (maxDim > 0) {
    group.scale.setScalar(TARGET_MODEL_SIZE / maxDim)
  }

  return group
}

/**
 * Export an animation where multiple voxel models orbit a center point
 * and rotate on their own axes.
 */
export async function exportOrbitAnimation({
  models, // array of { voxels, frames?, height, radius, spinSpeed, floatOffset }
  clipBackHalf,
  duration,
  fps,
  format,
  onProgress,
  logger,
}) {
  const totalFrames = Math.max(1, Math.round(duration * fps))
  const outputSize = 1080
  
  logger?.info('orbit export started', {
    totalFrames, duration, fps, format, modelCount: models.length
  })

  // ── Scene setup ──
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(CHROMA_GREEN)

  // Soft ambient light
  scene.add(new THREE.AmbientLight(0xffffff, 0.6))

  // Key light
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.5)
  keyLight.position.set(10, 20, 15)
  scene.add(keyLight)

  // Fill light
  const fillLight = new THREE.DirectionalLight(0xc0d8ff, 0.8)
  fillLight.position.set(-10, 5, -15)
  scene.add(fillLight)

  // ── Setup Head Mask for compositing ──
  if (clipBackHalf) {
    // Create an invisible cylinder that acts as a depth mask.
    // It writes to the depth buffer but not the color buffer,
    // so objects orbiting behind it are occluded, but the center
    // remains transparent (green) for compositing over a real head.
    const maskGeo = new THREE.CylinderGeometry(10, 10, 60, 32)
    const maskMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true })
    const headMask = new THREE.Mesh(maskGeo, maskMat)
    scene.add(headMask)
  }

  // ── Build models & orbital rig ──
  const masterOrbitGroup = new THREE.Group()
  scene.add(masterOrbitGroup)

  const animatedItems = []

  models.forEach((model, index) => {
    // For initial setup, use the first frame if animated, otherwise static voxels
    const initialVoxels = (model.frames && model.frames.length > 0) ? model.frames[0] : model.voxels
    const meshGroup = createCenteredVoxelModel(initialVoxels)
    
    // Store bounds to maintain consistent scale across animation frames
    const bounds = getVoxelBounds((model.frames && model.frames.length > 0) ? model.frames.flat() : initialVoxels)
    const maxDim = Math.max(bounds.size.x, bounds.size.y, bounds.size.z)
    const scaleFactor = maxDim > 0 ? (TARGET_MODEL_SIZE / maxDim) : 1
    
    const spinGroup = new THREE.Group()
    spinGroup.add(meshGroup)

    const pivot = new THREE.Group()
    
    // Calculate initial position in the circle
    const angle = (index / models.length) * Math.PI * 2
    const radius = model.radius || 25
    const height = model.height || 0
    
    pivot.position.set(
      Math.cos(angle) * radius,
      height,
      Math.sin(angle) * radius
    )
    
    pivot.add(spinGroup)
    masterOrbitGroup.add(pivot)
    
    animatedItems.push({
      spinGroup,
      meshGroup,
      pivot,
      spinSpeed: model.spinSpeed || 2, // rotations per export duration
      floatSpeed: model.floatSpeed || 1, // bobbing cycles per duration
      floatOffset: model.floatOffset || 0,
      initialHeight: height,
      frames: model.frames || null,
      bounds,
      scaleFactor,
    })
  })

  // ── Camera setup ──
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000)
  // Position camera to look at the center of the orbit, mimicking a webcam view
  camera.position.set(0, 5, 80) 
  camera.lookAt(0, 0, 0)

  // ── Renderer setup ──
  const renderCanvas = document.createElement('canvas')
  const renderer = new THREE.WebGLRenderer({
    canvas: renderCanvas,
    antialias: true, // Higher quality for orbit export
    preserveDrawingBuffer: true,
  })
  renderer.setPixelRatio(1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NoToneMapping
  renderer.setSize(outputSize, outputSize, false)
  renderer.setClearColor(CHROMA_GREEN, 1)

  // ── Render frames ──
  const pngFrames = []

  for (let i = 0; i < totalFrames; i++) {
    const progressFactor = i / totalFrames

    // Master orbit rotates 1 full circle
    masterOrbitGroup.rotation.y = progressFactor * Math.PI * 2

    animatedItems.forEach(item => {
      // Rebuild voxels for animation frames
      if (item.frames && item.frames.length > 1) {
        const animFrameIndex = i % item.frames.length
        const frameVoxels = item.frames[animFrameIndex] || []
        
        while(item.meshGroup.children.length > 0) {
          item.meshGroup.remove(item.meshGroup.children[0])
        }
        
        const geometry = new THREE.BoxGeometry(1, 1, 1)
        for (const voxel of frameVoxels) {
          const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(voxel.color || '#ffffff'),
            roughness: 0.6,
            metalness: 0.1,
          })
          const mesh = new THREE.Mesh(geometry, mat)
          mesh.position.set(
            voxel.position[0] - item.bounds.center.x,
            voxel.position[1] - item.bounds.center.y,
            voxel.position[2] - item.bounds.center.z
          )
          item.meshGroup.add(mesh)
        }
        item.meshGroup.scale.setScalar(item.scaleFactor)
      }

      // Individual spin on its own Y axis
      item.spinGroup.rotation.y = progressFactor * Math.PI * 2 * item.spinSpeed
      
      // Bobbing (sine wave offset on Y axis)
      const bobbing = Math.sin((progressFactor * Math.PI * 2 * item.floatSpeed) + item.floatOffset) * 2
      item.pivot.position.y = item.initialHeight + bobbing
    })

    renderer.render(scene, camera)

    const frameData = canvasToUint8Array(renderCanvas)
    pngFrames.push(frameData)

    onProgress?.(i + 1, totalFrames + 2, `Rendering frame ${i + 1}/${totalFrames}...`)
    logger?.info('orbit frame rendered', { frame: i + 1, size: frameData.byteLength })
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
      logger?.error('ffmpeg encode failed, trying fallback', { message: encodeErr?.message })
      onProgress?.(totalFrames + 1, totalFrames + 2, 'Encoding failed — trying browser recorder...')
      await yieldToBrowser()

      mp4Blob = await recordVideo(
        renderCanvas,
        totalFrames,
        fps,
        async (frameIndex) => {
          const progressFactor = frameIndex / totalFrames

          // Master orbit rotates 1 full circle
          masterOrbitGroup.rotation.y = progressFactor * Math.PI * 2

          animatedItems.forEach(item => {
            // Rebuild voxels for animation frames
            if (item.frames && item.frames.length > 1) {
              const animFrameIndex = frameIndex % item.frames.length
              const frameVoxels = item.frames[animFrameIndex] || []
              
              while(item.meshGroup.children.length > 0) {
                item.meshGroup.remove(item.meshGroup.children[0])
              }
              
              const geometry = new THREE.BoxGeometry(1, 1, 1)
              for (const voxel of frameVoxels) {
                const mat = new THREE.MeshStandardMaterial({
                  color: new THREE.Color(voxel.color || '#ffffff'),
                  roughness: 0.6,
                  metalness: 0.1,
                })
                const mesh = new THREE.Mesh(geometry, mat)
                mesh.position.set(
                  voxel.position[0] - item.bounds.center.x,
                  voxel.position[1] - item.bounds.center.y,
                  voxel.position[2] - item.bounds.center.z
                )
                item.meshGroup.add(mesh)
              }
              item.meshGroup.scale.setScalar(item.scaleFactor)
            }

            // Individual spin on its own Y axis
            item.spinGroup.rotation.y = progressFactor * Math.PI * 2 * item.spinSpeed
            
            // Bobbing (sine wave offset on Y axis)
            const bobbing = Math.sin((progressFactor * Math.PI * 2 * item.floatSpeed) + item.floatOffset) * 2
            item.pivot.position.y = item.initialHeight + bobbing
          })

          renderer.render(scene, camera)
        },
        logger,
      )
    }

    if (mp4Blob.size === 0) throw new Error('MP4 encoding produced an empty file.')
    const extension = mp4Blob.type.includes('webm') ? 'webm' : 'mp4'
    downloadBlob(mp4Blob, `orbit-animation.${extension}`)
  } else {
    for (let i = 0; i < pngFrames.length; i++) {
      const blob = new Blob([pngFrames[i]], { type: 'image/png' })
      downloadBlob(blob, `orbit-${String(i + 1).padStart(3, '0')}.png`)
      onProgress?.(totalFrames + 1, totalFrames + 2, `Downloading frame ${i + 1}/${pngFrames.length}...`)
      await yieldToBrowser()
    }
  }

  onProgress?.(totalFrames + 2, totalFrames + 2, 'Export complete')

  // Cleanup
  masterOrbitGroup.traverse((child) => {
    child.geometry?.dispose()
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose())
      } else {
        child.material.dispose()
      }
    }
  })
  renderer.dispose()
}
