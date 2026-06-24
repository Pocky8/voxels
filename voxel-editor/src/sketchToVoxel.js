const quantize = (value) => Math.max(0, Math.min(255, Math.round(value / 17) * 17))

export function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((v) => quantize(v).toString(16).padStart(2, '0')).join('')}`
}

/**
 * Convert a 2D canvas (top-left origin) into voxels on the XZ plane at y=0.
 * Canvas row 0 maps to +Z in the scene.
 */
export function canvasToVoxels(canvas, options = {}) {
  const { skipLightBackground = true } = options
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return []

  const { width, height } = canvas
  const { data } = ctx.getImageData(0, 0, width, height)
  const voxels = []
  let id = 1

  const originX = Math.floor(width / 2)
  const originZ = Math.floor(height / 2)

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const i = (row * width + col) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]
      const isLightBackground = skipLightBackground && r > 238 && g > 238 && b > 238

      if (a < 64 || isLightBackground) continue

      voxels.push({
        id: id++,
        position: [col - originX + 0.5, 0, height - row - originZ - 0.5],
        color: rgbToHex(r, g, b),
      })
    }
  }

  return voxels
}
