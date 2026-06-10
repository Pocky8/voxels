import { forwardRef, useImperativeHandle } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  CHROMA_GREEN,
  configureOrthoCamera,
  getAllFramesBounds,
  canvasToBlob,
  downloadBlob,
  recordWebM,
} from './greenscreenExport'

const ExportCapture = forwardRef(function ExportCapture({ setCurrentFrame }, ref) {
  const { gl, scene, camera } = useThree()

  useImperativeHandle(ref, () => ({
    async exportGreenscreen({ frames, plane, fps, format, onProgress }) {
      const exportCamera = new THREE.OrthographicCamera()
      const bounds = getAllFramesBounds(frames)
      configureOrthoCamera(exportCamera, plane, bounds)

      const savedBackground = scene.background
      scene.background = new THREE.Color(CHROMA_GREEN)

      const waitRender = () => new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      })

      const renderFrame = async (index) => {
        setCurrentFrame(index)
        await waitRender()
        gl.render(scene, exportCamera)
      }

      try {
        if (format === 'webm') {
          onProgress?.(0, frames.length, 'Recording video…')
          const blob = await recordWebM(gl.domElement, frames.length, fps, async (i) => {
            await renderFrame(i)
            onProgress?.(i + 1, frames.length, 'Recording video…')
          })
          downloadBlob(blob, 'voxel-animation.webm')
          return
        }

        for (let i = 0; i < frames.length; i++) {
          onProgress?.(i + 1, frames.length, 'Capturing frames…')
          await renderFrame(i)
          const blob = await canvasToBlob(gl.domElement)
          downloadBlob(blob, `frame-${String(i + 1).padStart(3, '0')}.png`)
        }
      } finally {
        scene.background = savedBackground
        gl.render(scene, camera)
      }
    },
  }), [gl, scene, camera, setCurrentFrame])

  return null
})

export default ExportCapture
