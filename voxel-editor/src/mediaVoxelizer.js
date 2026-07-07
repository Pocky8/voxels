export const quantizeColor = (value) => Math.max(0, Math.min(255, Math.round(value / 17) * 17))
export const toHex = (r, g, b) => `#${[r, g, b].map((v) => quantizeColor(v).toString(16).padStart(2, '0')).join('')}`

const alphaThreshold = 128

export function processImageData(imgData, width, height, depth, bgRemoval = 'none') {
  const data = imgData.data
  const voxels = []
  let id = 1
  const originX = Math.floor(width / 2)
  const originY = Math.floor(height / 2)

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const i = (row * width + col) * 4
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]

      const isGrayscale = Math.abs(r - g) < 15 && Math.abs(g - b) < 15
      const isWhiteGrey = isGrayscale && r > 180
      const isSolidBlack = r < 30 && g < 30 && b < 30
      const isSolidWhite = r > 240 && g > 240 && b > 240

      let skip = false
      if (bgRemoval === 'white_grey' && isWhiteGrey) skip = true
      if (bgRemoval === 'black_white_grid' && isGrayscale) skip = true
      if (bgRemoval === 'black' && isSolidBlack) skip = true
      if (bgRemoval === 'white' && isSolidWhite) skip = true

      if (a < alphaThreshold || skip) continue

      for (let z = 0; z < depth; z++) {
        voxels.push({
          id: id++,
          position: [col - originX + 0.5, (height - row) - originY + 0.5, z - (depth / 2) + 0.5],
          color: toHex(r, g, b),
        })
      }
    }
  }
  return voxels
}

export async function processMediaFile(file, imageSize, depth, bgRemoval, pixelPerfect) {
  const fileType = file.type || ''
  const isVideo = typeof fileType === 'string' && fileType.startsWith('video/')
  const isGif = fileType === 'image/gif'
  
  if (!isVideo && !isGif) {
    // If we're re-voxelizing an already loaded image element
    if (file instanceof HTMLImageElement || file.tagName === 'IMG') {
      const scale = Math.min(imageSize / file.width, imageSize / file.height)
      const width = Math.max(1, Math.round(file.width * scale))
      const height = Math.max(1, Math.round(file.height * scale))

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.imageSmoothingEnabled = !pixelPerfect
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(file, 0, 0, width, height)
      
      const voxels = processImageData(ctx.getImageData(0, 0, width, height), width, height, depth, bgRemoval)
      return { frames: [voxels], thumb: file.src, img: file }
    }

    // Standard image processing (from File)
    // Use FileReader instead of createObjectURL for better Android compatibility
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result
        const img = new Image()
        img.onload = () => {
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
          
          const voxels = processImageData(ctx.getImageData(0, 0, width, height), width, height, depth, bgRemoval)
          resolve({ frames: [voxels], thumb: dataUrl, img })
        }
        img.onerror = () => reject(new Error('Could not read image.'))
        img.src = dataUrl
      }
      reader.onerror = () => reject(new Error('Could not read image file.'))
      reader.readAsDataURL(file)
    })
  }

  const allFramesVoxels = []
  let thumbUrl = ''

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
    const duration = video.duration || 2
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
      allFramesVoxels.push(processImageData(imgData, width, height, depth, bgRemoval))
      
      if (i === 0) {
        thumbUrl = canvas.toDataURL('image/png')
      }
    }
    URL.revokeObjectURL(video.src)
  } else if (isGif) {
    const buffer = await file.arrayBuffer()
    const { parseGIF, decompressFrames } = await import('gifuct-js')
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
      allFramesVoxels.push(processImageData(imgData, outWidth, outHeight, depth, bgRemoval))
      
      if (i === 0) {
        thumbUrl = canvas.toDataURL('image/png')
      }
    }
  }

  return { frames: allFramesVoxels, thumb: thumbUrl, img: file } // We store file as img so we can re-process
}
