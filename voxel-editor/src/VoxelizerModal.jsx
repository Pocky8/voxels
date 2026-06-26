import { useState, useRef } from 'react'
import { useVoxelStore } from './store'
import { parseGIF, decompressFrames } from 'gifuct-js'
import './VoxelizerModal.css'

export default function VoxelizerModal({ onClose }) {
  const setVoxels = useVoxelStore((s) => s.setVoxels)
  const setAllFrames = useVoxelStore((s) => s.setAllFrames)

  const [mode, setMode] = useState('image')
  const [resolution, setResolution] = useState(20)
  const [imageSize, setImageSize] = useState(32)
  const [skipLightBackground, setSkipLightBackground] = useState(true)
  const [alphaThreshold, setAlphaThreshold] = useState(128)
  const [pixelPerfect, setPixelPerfect] = useState(false)
  const [color, setColor] = useState('#4f9cf9')
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  
  const workerRef = useRef(null)
  const fileRef = useRef(null)
  const imageFileRef = useRef(null)
  const animFileRef = useRef(null)

  const resetResult = () => {
    setStatus('idle')
    setProgress(0)
    setErrorMsg('')
  }

  const quantizeColor = (value) => Math.max(0, Math.min(255, Math.round(value / 17) * 17))

  const toHex = (r, g, b) =>
    `#${[r, g, b].map((v) => quantizeColor(v).toString(16).padStart(2, '0')).join('')}`

  const loadImage = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image.'))
    }
    img.src = url
  })

  const processImageData = (imgData, width, height) => {
    const voxels = []
    let id = 1
    const originX = Math.floor(width / 2)
    const originZ = Math.floor(height / 2)
    const data = imgData.data

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const i = (row * width + col) * 4
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const a = data[i + 3]
        const isLightBackground = skipLightBackground && r > 238 && g > 238 && b > 238

        if (a < alphaThreshold || isLightBackground) continue

        voxels.push({
          id: id++,
          position: [col - originX + 0.5, 0, height - row - originZ - 0.5],
          color: toHex(r, g, b),
        })
      }
    }
    return voxels
  }

  const convertImage = async () => {
    const file = imageFileRef.current?.files?.[0]
    if (!file) return

    setStatus('running')
    setProgress(15)
    setErrorMsg('')

    try {
      const img = await loadImage(file)
      const scale = Math.min(imageSize / img.width, imageSize / img.height)
      const width = Math.max(1, Math.round(img.width * scale))
      const height = Math.max(1, Math.round(img.height * scale))
      
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.imageSmoothingEnabled = !pixelPerfect
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, width, height)
      setProgress(55)

      const imgData = ctx.getImageData(0, 0, width, height)
      const voxels = processImageData(imgData, width, height)

      if (voxels.length === 0) {
        throw new Error('No visible pixels found. Try disabling background cleanup.')
      }

      setProgress(90)
      setVoxels(voxels)
      setStatus('done')
      setProgress(100)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err?.message || 'Image conversion failed.')
    }
  }

  const convertAnimation = async () => {
    const file = animFileRef.current?.files?.[0]
    if (!file) return

    if (!window.confirm('Importing an animation will replace your entire timeline. Continue?')) {
      return
    }

    setStatus('running')
    setProgress(5)
    setErrorMsg('')

    try {
      const isVideo = file.type.startsWith('video/')
      let allFramesVoxels = []

      if (isVideo) {
        const video = document.createElement('video')
        video.src = URL.createObjectURL(file)
        video.muted = true
        video.playsInline = true
        
        await new Promise((resolve, reject) => {
          video.onloadeddata = resolve
          video.onerror = () => reject(new Error('Failed to load video file.'))
        })

        const fps = 10
        const duration = video.duration
        const totalFrames = Math.ceil(duration * fps)

        const scale = Math.min(imageSize / video.videoWidth, imageSize / video.videoHeight)
        const width = Math.max(1, Math.round(video.videoWidth * scale))
        const height = Math.max(1, Math.round(video.videoHeight * scale))
        
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.imageSmoothingEnabled = !pixelPerfect
        ctx.imageSmoothingQuality = 'high'

        for (let i = 0; i < totalFrames; i++) {
          video.currentTime = i / fps
          await new Promise((resolve) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked)
              resolve()
            }
            video.addEventListener('seeked', onSeeked)
          })

          ctx.clearRect(0, 0, width, height)
          ctx.drawImage(video, 0, 0, width, height)
          const imgData = ctx.getImageData(0, 0, width, height)
          allFramesVoxels.push(processImageData(imgData, width, height))
          
          setProgress(5 + Math.round((i / totalFrames) * 90))
        }

        URL.revokeObjectURL(video.src)
      } else {
        const buffer = await file.arrayBuffer()
        const gif = parseGIF(buffer)
        const frames = decompressFrames(gif, true)
        
        const gifWidth = frames[0].dims.width
        const gifHeight = frames[0].dims.height
        const scale = Math.min(imageSize / gifWidth, imageSize / gifHeight)
        const outWidth = Math.max(1, Math.round(gifWidth * scale))
        const outHeight = Math.max(1, Math.round(gifHeight * scale))

        const patchCanvas = document.createElement('canvas')
        patchCanvas.width = gifWidth
        patchCanvas.height = gifHeight
        const patchCtx = patchCanvas.getContext('2d', { willReadFrequently: true })
        let frameImageData = patchCtx.createImageData(gifWidth, gifHeight)

        const canvas = document.createElement('canvas')
        canvas.width = outWidth
        canvas.height = outHeight
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.imageSmoothingEnabled = !pixelPerfect
        ctx.imageSmoothingQuality = 'high'

        for (let i = 0; i < frames.length; i++) {
          const frame = frames[i]
          
          if (i > 0 && frames[i - 1].disposalType === 2) {
            const prev = frames[i - 1]
            patchCtx.clearRect(prev.dims.left, prev.dims.top, prev.dims.width, prev.dims.height)
            frameImageData = patchCtx.getImageData(0, 0, gifWidth, gifHeight)
          } else if (i > 0 && frames[i - 1].disposalType === 3) {
             patchCtx.clearRect(0, 0, gifWidth, gifHeight)
             frameImageData = patchCtx.getImageData(0, 0, gifWidth, gifHeight)
          }
          
          const { width: pW, height: pH, top: pT, left: pL } = frame.dims
          const patchData = frame.patch
          
          for (let y = 0; y < pH; y++) {
            for (let x = 0; x < pW; x++) {
              const patchIdx = (y * pW + x) * 4
              const a = patchData[patchIdx + 3]
              if (a > 0) {
                const imgIdx = ((y + pT) * gifWidth + (x + pL)) * 4
                frameImageData.data[imgIdx] = patchData[patchIdx]
                frameImageData.data[imgIdx + 1] = patchData[patchIdx + 1]
                frameImageData.data[imgIdx + 2] = patchData[patchIdx + 2]
                frameImageData.data[imgIdx + 3] = a
              }
            }
          }
          patchCtx.putImageData(frameImageData, 0, 0)
          
          ctx.clearRect(0, 0, outWidth, outHeight)
          ctx.drawImage(patchCanvas, 0, 0, outWidth, outHeight)
          const imgData = ctx.getImageData(0, 0, outWidth, outHeight)

          allFramesVoxels.push(processImageData(imgData, outWidth, outHeight))

          setProgress(5 + Math.round((i / frames.length) * 90))
          await new Promise(r => setTimeout(r, 0))
        }
      }

      if (allFramesVoxels.length === 0) {
        throw new Error('No valid frames extracted.')
      }

      setAllFrames(allFramesVoxels)
      setProgress(100)
      setStatus('done')

    } catch (err) {
      setStatus('error')
      setErrorMsg(err?.message || 'Animation conversion failed.')
    }
  }

  const convertMesh = () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return

    setStatus('running')
    setProgress(0)
    setErrorMsg('')

    const reader = new FileReader()
    reader.onload = (e) => {
      const buffer = e.target.result
      workerRef.current?.terminate()

      const worker = new Worker(
        new URL('./voxelizer.worker.js', import.meta.url),
        { type: 'module' },
      )
      workerRef.current = worker

      worker.onmessage = (msg) => {
        const { voxels, progress: p, error } = msg.data
        if (error) {
          setStatus('error')
          setErrorMsg(error)
          worker.terminate()
          return
        }
        if (p != null) {
          setProgress(p)
          return
        }
        if (voxels) {
          setVoxels(voxels)
          setStatus('done')
          setProgress(100)
          worker.terminate()
        }
      }

      worker.onerror = (err) => {
        setStatus('error')
        setErrorMsg(err.message)
        worker.terminate()
      }

      worker.postMessage({ gltfArrayBuffer: buffer, resolution, color }, [buffer])
    }

    reader.readAsArrayBuffer(file)
  }

  const handleConvert = () => {
    if (mode === 'image') {
      convertImage()
    } else if (mode === 'animation') {
      convertAnimation()
    } else {
      convertMesh()
    }
  }

  const handleCancel = () => {
    workerRef.current?.terminate()
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={handleCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Import Voxels</h2>
          <button className="modal__close" onClick={handleCancel}>x</button>
        </div>

        <div className="modal__body">
          <div className="modal__tabs" role="tablist" aria-label="Import type">
            <button
              type="button"
              className={`modal__tab ${mode === 'image' ? 'active' : ''}`}
              onClick={() => {
                setMode('image')
                resetResult()
              }}
              disabled={status === 'running'}
            >
              Image
            </button>
            <button
              type="button"
              className={`modal__tab ${mode === 'animation' ? 'active' : ''}`}
              onClick={() => {
                setMode('animation')
                resetResult()
              }}
              disabled={status === 'running'}
            >
              Animation
            </button>
            <button
              type="button"
              className={`modal__tab ${mode === 'mesh' ? 'active' : ''}`}
              onClick={() => {
                setMode('mesh')
                resetResult()
              }}
              disabled={status === 'running'}
            >
              Mesh
            </button>
          </div>

          <p className="modal__description">
            {mode === 'image' && 'Upload a static image to create a voxel sprite.'}
            {mode === 'animation' && 'Upload a GIF, MP4 or MOV to create an animated voxel timeline (sampled at 10 FPS).'}
            {mode === 'mesh' && 'Upload a .gltf file. A Web Worker will voxelize it using AABB subdivision.'}
          </p>

          {(mode === 'image' || mode === 'animation') ? (
            <>
              {mode === 'image' && (
                <div className="modal__field">
                  <label htmlFor="image-file" className="modal__field-label">Image File</label>
                  <input
                    id="image-file"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    ref={imageFileRef}
                    className="modal__file-input"
                    disabled={status === 'running'}
                  />
                </div>
              )}

              {mode === 'animation' && (
                <div className="modal__field">
                  <label htmlFor="anim-file" className="modal__field-label">Animation File</label>
                  <input
                    id="anim-file"
                    type="file"
                    accept="image/gif,video/mp4,video/quicktime"
                    ref={animFileRef}
                    className="modal__file-input"
                    disabled={status === 'running'}
                  />
                </div>
              )}

              <div className="modal__field">
                <label htmlFor="image-size" className="modal__field-label">
                  Detail: <strong>{imageSize}px</strong>
                  <span className="modal__field-hint">&nbsp;(longest side)</span>
                </label>
                <input
                  id="image-size"
                  type="range"
                  min={12}
                  max={64}
                  value={imageSize}
                  onChange={(e) => setImageSize(Number(e.target.value))}
                  disabled={status === 'running'}
                  className="modal__slider"
                />
              </div>

              <div className="modal__field">
                <label htmlFor="alpha-threshold" className="modal__field-label">
                  Opacity Threshold: <strong>{alphaThreshold}</strong>
                  <span className="modal__field-hint">&nbsp;(0-255)</span>
                </label>
                <input
                  id="alpha-threshold"
                  type="range"
                  min={1}
                  max={255}
                  value={alphaThreshold}
                  onChange={(e) => setAlphaThreshold(Number(e.target.value))}
                  disabled={status === 'running'}
                  className="modal__slider"
                />
              </div>

              <div className="modal__checkbox-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label className="modal__checkbox">
                  <input
                    type="checkbox"
                    checked={skipLightBackground}
                    onChange={(e) => setSkipLightBackground(e.target.checked)}
                    disabled={status === 'running'}
                  />
                  <span>Clean white background</span>
                </label>
                <label className="modal__checkbox">
                  <input
                    type="checkbox"
                    checked={pixelPerfect}
                    onChange={(e) => setPixelPerfect(e.target.checked)}
                    disabled={status === 'running'}
                  />
                  <span>Pixel perfect (Disable smoothing)</span>
                </label>
              </div>
            </>
          ) : (
            <>
              <div className="modal__field">
                <label htmlFor="gltf-file" className="modal__field-label">GLTF File</label>
                <input
                  id="gltf-file"
                  type="file"
                  accept=".gltf,.glb"
                  ref={fileRef}
                  className="modal__file-input"
                  disabled={status === 'running'}
                />
              </div>

              <div className="modal__field">
                <label htmlFor="resolution" className="modal__field-label">
                  Resolution: <strong>{resolution}</strong>
                  <span className="modal__field-hint">
                    &nbsp;({resolution ** 3} max cells)
                  </span>
                </label>
                <input
                  id="resolution"
                  type="range"
                  min={5}
                  max={64}
                  value={resolution}
                  onChange={(e) => setResolution(Number(e.target.value))}
                  disabled={status === 'running'}
                  className="modal__slider"
                />
              </div>

              <div className="modal__field">
                <label htmlFor="vox-color" className="modal__field-label">Voxel Color</label>
                <div className="modal__color-row">
                  <input
                    id="vox-color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    disabled={status === 'running'}
                    className="modal__color-input"
                  />
                  <span className="modal__color-hex">{color}</span>
                </div>
              </div>
            </>
          )}

          {status === 'running' && (
            <div className="modal__progress">
              <div className="modal__progress-bar">
                <div
                  className="modal__progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="modal__progress-label">{progress}%</span>
            </div>
          )}

          {status === 'done' && (
            <p className="modal__success">Voxelization complete. Canvas updated.</p>
          )}

          {status === 'error' && (
            <p className="modal__error">{errorMsg}</p>
          )}
        </div>

        <div className="modal__footer">
          <button className="modal__btn secondary" onClick={handleCancel}>
            {status === 'done' ? 'Close' : 'Cancel'}
          </button>
          <button
            id="voxelize-start"
            className="modal__btn primary"
            onClick={handleConvert}
            disabled={status === 'running'}
          >
            {status === 'running' ? 'Converting...' : 'Convert'}
          </button>
        </div>
      </div>
    </div>
  )
}
