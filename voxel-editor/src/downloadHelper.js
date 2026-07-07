export function triggerDownload(url, filename) {
  const a = document.createElement('a')
  a.style.display = 'none'
  document.body.appendChild(a)
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
  }, 500)
}

export function dataURLToBlob(dataURL) {
  if (!dataURL || !dataURL.includes(',')) {
    console.error('Invalid data URL string')
    return null
  }
  const parts = dataURL.split(',')
  const match = parts[0].match(/:(.*?);/)
  if (!match) {
    console.error('Invalid data URL MIME type format')
    return null
  }
  const mime = match[1]
  const bstr = atob(parts[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  triggerDownload(url, filename)
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1000)
}
