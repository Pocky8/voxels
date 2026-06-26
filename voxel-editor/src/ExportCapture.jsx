import { forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import {
  CHROMA_GREEN,
  configureOrthoCamera,
  getAllFramesBounds,
  getExportCanvasSize,
  canvasToBlob,
  canvasToUint8Array,
  downloadBlob,
  encodePngsToMp4,
  recordVideo,
  yieldToBrowser,
} from './greenscreenExport'

function createVoxelMesh(voxel) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      color: voxel.color,
      roughness: 0.62,
      metalness: 0,
    }),
  )
  mesh.position.fromArray(voxel.position)
  return mesh
}

function replaceVoxelGroup(scene, previousGroup, voxels) {
  if (previousGroup) {
    scene.remove(previousGroup)
    previousGroup.traverse((child) => {
      child.geometry?.dispose()
      child.material?.dispose()
    })
  }

  const group = new THREE.Group()
  for (const voxel of voxels) {
    group.add(createVoxelMesh(voxel))
  }
  scene.add(group)
  return group
}

function createExportRenderer(width, height) {
  const canvas = document.createElement('canvas')
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
  })
  renderer.setPixelRatio(1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NoToneMapping
  renderer.setSize(width, height, false)
  renderer.setClearColor(CHROMA_GREEN, 1)
  return renderer
}

function createExportScene() {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(CHROMA_GREEN)
  scene.add(new THREE.AmbientLight(0xffffff, 1.2))

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.4)
  keyLight.position.set(10, 14, 8)
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight('#c0d8ff', 1.0)
  fillLight.position.set(-6, 4, -8)
  scene.add(fillLight)

  const pointLight = new THREE.PointLight(0xffffff, 3.0)
  pointLight.position.set(0, 8, 0)
  scene.add(pointLight)

  return scene
}

const ExportCapture = forwardRef(function ExportCapture(_, ref) {
  useImperativeHandle(ref, () => ({
    async exportGreenscreen({ frames, plane, fps, format, onProgress, logger }) {
      const bounds = getAllFramesBounds(frames)
      const { width, height, aspectWidth, aspectHeight } = getExportCanvasSize(plane, bounds)
      const renderer = createExportRenderer(width, height)
      const scene = createExportScene()
      const exportCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000)
      let voxelGroup = null

      configureOrthoCamera(exportCamera, plane, bounds)
      logger?.info('export camera configured', {
        plane,
        bounds: {
          center: bounds.center.toArray(),
          size: bounds.size.toArray(),
        },
        camera: {
          position: exportCamera.position.toArray(),
          up: exportCamera.up.toArray(),
          left: exportCamera.left,
          right: exportCamera.right,
          top: exportCamera.top,
          bottom: exportCamera.bottom,
        },
      })

      logger?.info('export renderer prepared', {
        background: CHROMA_GREEN,
        canvasWidth: renderer.domElement.width,
        canvasHeight: renderer.domElement.height,
        pixelRatio: renderer.getPixelRatio(),
        aspectWidth,
        aspectHeight,
      })

      const renderFrame = async (index) => {
        const frame = frames[index] ?? []
        voxelGroup = replaceVoxelGroup(scene, voxelGroup, frame)
        renderer.render(scene, exportCamera)
        logger?.info('export frame rendered', {
          frame: index + 1,
          frameCount: frames.length,
          voxelCount: frame.length,
        })
      }

      try {
        logger?.info('export started', {
          format,
          plane,
          fps,
          frameCount: frames.length,
          userAgent: navigator.userAgent,
        })

        if (format === 'mp4') {
          // Render every frame, convert to PNG via base64 (avoids broken Blob path)
          const pngFrames = []
          const writeTotal = frames.length
          const exportTotal = frames.length + writeTotal + 2
          for (let i = 0; i < frames.length; i++) {
            onProgress?.(i + 1, exportTotal, `Rendering frame ${i + 1}/${frames.length}...`)
            await yieldToBrowser()
            await renderFrame(i)
            const frameData = canvasToUint8Array(renderer.domElement)
            pngFrames.push(frameData)
            logger?.info('png frame captured for mp4', {
              frame: i + 1,
              frameCount: frames.length,
              size: frameData.byteLength,
            })
            await yieldToBrowser()
          }

          onProgress?.(frames.length + 1, exportTotal, 'Preparing MP4 frames...')
          await yieldToBrowser()
          let mp4Blob
          try {
            mp4Blob = await encodePngsToMp4(pngFrames, fps, logger, (current, total) => {
              const writingDone = current >= total
              onProgress?.(
                frames.length + current + 1,
                frames.length + total + 2,
                writingDone ? 'Encoding MP4...' : `Preparing MP4 frame ${current}/${total}...`,
              )
            })
          } catch (encodeErr) {
            logger?.error('ffmpeg mp4 encode failed, trying mediarecorder fallback', {
              message: encodeErr?.message || 'Unknown encode error',
            })
            onProgress?.(frames.length, frames.length + 1, 'Encoding failed — trying browser recorder...')
            await yieldToBrowser()
            mp4Blob = await recordVideo(
              renderer.domElement,
              frames.length,
              fps,
              async (i) => {
                await renderFrame(i)
              },
              logger,
            )
          }

          if (mp4Blob.size === 0) {
            throw new Error('MP4 encoding produced an empty file.')
          }
          const extension = mp4Blob.type.includes('webm') ? 'webm' : 'mp4'
          downloadBlob(mp4Blob, `voxel-animation.${extension}`)
          logger?.info('mp4 download started', { size: mp4Blob.size, type: mp4Blob.type })
          return
        }

        // PNG sequence
        for (let i = 0; i < frames.length; i++) {
          onProgress?.(i + 1, frames.length, `Capturing frame ${i + 1}/${frames.length}...`)
          await yieldToBrowser()
          await renderFrame(i)
          const blob = await canvasToBlob(renderer.domElement)
          logger?.info('png frame captured', {
            frame: i + 1,
            frameCount: frames.length,
            type: blob?.type || '',
            size: blob?.size ?? 0,
          })
          downloadBlob(blob, `frame-${String(i + 1).padStart(3, '0')}.png`)
          await yieldToBrowser()
        }
      } finally {
        if (voxelGroup) {
          scene.remove(voxelGroup)
          voxelGroup.traverse((child) => {
            child.geometry?.dispose()
            child.material?.dispose()
          })
        }
        renderer.dispose()
        logger?.info('export cleanup complete')
      }
    },
  }), [])

  return null
})

export default ExportCapture
