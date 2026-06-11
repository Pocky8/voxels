import { forwardRef, useImperativeHandle } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  CHROMA_GREEN,
  configureOrthoCamera,
  getAllFramesBounds,
  canvasToBlob,
  downloadBlob,
  recordVideo,
} from './greenscreenExport'

const ExportCapture = forwardRef(function ExportCapture({ setCurrentFrame }, ref) {
  const { gl, scene, camera } = useThree()

  useImperativeHandle(ref, () => ({
    async exportGreenscreen({ frames, plane, fps, format, onProgress, logger }) {
      const exportCamera = new THREE.OrthographicCamera()
      const bounds = getAllFramesBounds(frames)
      configureOrthoCamera(exportCamera, plane, bounds)
      logger?.info('export camera configured', {
        plane,
        bounds: {
          center: bounds.center.toArray(),
          size: bounds.size.toArray(),
        },
      })

      const savedBackground = scene.background
      scene.background = new THREE.Color(CHROMA_GREEN)
      logger?.info('scene prepared', {
        background: CHROMA_GREEN,
        canvasWidth: gl.domElement.width,
        canvasHeight: gl.domElement.height,
        clientWidth: gl.domElement.clientWidth,
        clientHeight: gl.domElement.clientHeight,
      })

      const waitRender = () => new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      })

      const renderFrame = async (index) => {
        setCurrentFrame(index)
        await waitRender()
        gl.render(scene, exportCamera)
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
          onProgress?.(0, frames.length, 'Recording video…')
          const blob = await recordVideo(gl.domElement, frames.length, fps, format, async (i) => {
            await renderFrame(i)
            onProgress?.(i + 1, frames.length, 'Recording video…')
          }, logger)
          logger?.info('video blob ready', {
            type: blob.type,
            size: blob.size,
          })
          if (blob.size === 0) {
            throw new Error('Video export produced a 0B file. Copy the export log and share it.')
          }
          downloadBlob(blob, 'voxel-animation.mp4')
          logger?.info('video download started', {
            filename: 'voxel-animation.mp4',
            size: blob.size,
          })
          return
        }

        for (let i = 0; i < frames.length; i++) {
          onProgress?.(i + 1, frames.length, 'Capturing frames…')
          await renderFrame(i)
          const blob = await canvasToBlob(gl.domElement)
          logger?.info('png frame captured', {
            frame: i + 1,
            frameCount: frames.length,
            type: blob?.type || '',
            size: blob?.size ?? 0,
          })
          downloadBlob(blob, `frame-${String(i + 1).padStart(3, '0')}.png`)
        }
      } finally {
        scene.background = savedBackground
        gl.render(scene, camera)
        logger?.info('export cleanup complete')
      }
    },
  }), [gl, scene, camera, setCurrentFrame])

  return null
})

export default ExportCapture
