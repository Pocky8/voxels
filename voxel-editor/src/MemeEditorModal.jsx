import { useEffect, useRef, useState } from 'react'
import { Brain, Download, ImagePlus, MessageCircle, PencilLine, Plus, Trash2, Upload } from 'lucide-react'
import { downloadBlob } from './downloadHelper'
import { MEME_TEMPLATES } from './memeTemplates'
import './MemeEditorModal.css'

const DEFAULT_IMAGE = MEME_TEMPLATES[0]
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const isAcceptedImage = (file) => ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)

function makeBubble(type) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    text: type === 'thought' ? 'I have an idea…' : 'PUT TEXT HERE',
    x: 0.31,
    y: 0.31,
    width: 0.38,
    height: 0.2,
  }
}

function makeCaption() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    text: 'TOP TEXT',
    x: 0.08,
    y: 0.04,
    width: 0.84,
    height: 0.16,
    fontSize: 0.065,
  }
}

function makeTemplateCaptions(template) {
  return (template.captionSlots || []).map((slot) => ({
    ...slot,
    id: `template-${template.id}-${slot.key}`,
  }))
}

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = reject
  image.src = src
})

function wrapText(ctx, text, maxWidth) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  const lines = []
  let line = ''
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line)
      line = word
    } else line = next
  })
  lines.push(line)
  return lines
}

function drawBubble(ctx, bubble, width, height) {
  const x = bubble.x * width
  const y = bubble.y * height
  const w = bubble.width * width
  const h = bubble.height * height
  const lineWidth = Math.max(4, Math.round(width * 0.005))
  const radius = Math.max(14, width * 0.018)
  ctx.save()
  ctx.fillStyle = '#f9f9f6'
  ctx.strokeStyle = '#1a1a24'
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, radius)
  ctx.fill()
  ctx.stroke()
  if (bubble.type === 'speech') {
    ctx.beginPath()
    ctx.moveTo(x + w * 0.25, y + h)
    ctx.lineTo(x + w * 0.18, y + h + h * 0.22)
    ctx.lineTo(x + w * 0.43, y + h)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else {
    const dots = [[x + w * 0.2, y + h + h * 0.09, h * 0.055], [x + w * 0.12, y + h + h * 0.2, h * 0.035]]
    dots.forEach(([cx, cy, r]) => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke() })
  }
  const fontSize = Math.max(18, Math.round(Math.min(w / 8, h / 2.5)))
  ctx.fillStyle = '#1a1a24'
  ctx.font = `bold ${fontSize}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lines = wrapText(ctx, bubble.text, w - width * 0.03).slice(0, 3)
  const lineHeight = fontSize * 1.15
  const start = y + h / 2 - ((lines.length - 1) * lineHeight) / 2
  lines.forEach((line, index) => ctx.fillText(line, x + w / 2, start + index * lineHeight))
  ctx.restore()
}

function drawCaption(ctx, caption, width, height) {
  const x = caption.x * width
  const y = caption.y * height
  const w = caption.width * width
  const h = caption.height * height
  const fontSize = Math.max(18, Math.round(caption.fontSize * width))
  ctx.save()
  ctx.font = `900 ${fontSize}px Impact, Arial Black, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.12))
  const lines = wrapText(ctx, caption.text.toUpperCase(), w).slice(0, 3)
  const lineHeight = fontSize * 1.03
  const start = y + h / 2 - ((lines.length - 1) * lineHeight) / 2
  lines.forEach((line, index) => {
    const lineY = start + index * lineHeight
    ctx.strokeText(line, x + w / 2, lineY)
    ctx.fillStyle = '#fff'
    ctx.fillText(line, x + w / 2, lineY)
  })
  ctx.restore()
}

export default function MemeEditorModal({ onClose }) {
  const [baseImage, setBaseImage] = useState(DEFAULT_IMAGE)
  const [bubbles, setBubbles] = useState([])
  const [captions, setCaptions] = useState(() => makeTemplateCaptions(DEFAULT_IMAGE))
  const [imageLayers, setImageLayers] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)
  const imageLayerInputRef = useRef(null)
  const compositionRef = useRef(null)
  const dragRef = useRef(null)
  const objectUrlRef = useRef(null)
  const layerObjectUrlsRef = useRef([])
  const textInputRef = useRef(null)
  const selectedBubble = bubbles.find((bubble) => bubble.id === selectedId)
  const selectedCaption = captions.find((caption) => caption.id === selectedId)
  const selectedImage = imageLayers.find((layer) => layer.id === selectedId)
  const selected = selectedBubble || selectedCaption || selectedImage

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    layerObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  useEffect(() => {
    if (selectedId) textInputRef.current?.focus()
  }, [selectedId])

  useEffect(() => {
    const handleKeyDown = (event) => {
      const isTyping = event.target instanceof HTMLElement && (
        event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)
      )
      if (!selectedId || isTyping || !['Backspace', 'Delete'].includes(event.key)) return
      event.preventDefault()
      setBubbles((items) => items.filter((item) => item.id !== selectedId))
      setCaptions((items) => items.filter((item) => item.id !== selectedId))
      setImageLayers((items) => items.filter((item) => item.id !== selectedId))
      setSelectedId(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedId])

  const replaceImage = (image) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = image.objectUrl ? image.src : null
    setBaseImage(image)
    setError('')
  }

  const handleTemplate = (template) => {
    replaceImage(template)
    if (template.captionSlots) setCaptions(makeTemplateCaptions(template))
    else if (baseImage.captionSlots) setCaptions([])
  }

  const handleFile = (file) => {
    if (!file) return
    if (!isAcceptedImage(file)) {
      setError('Please choose a PNG, JPEG, or WebP image.')
      return
    }
    if (baseImage && !window.confirm('Replace the current meme image? Your bubbles will stay in place.')) return
    const src = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => replaceImage({ id: 'upload', name: file.name, license: 'Your local image', src, width: image.naturalWidth, height: image.naturalHeight, objectUrl: true })
    image.onerror = () => { URL.revokeObjectURL(src); setError('That image could not be opened.') }
    image.src = src
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)
    addImageLayer(event.dataTransfer.files?.[0])
  }

  const addBubble = (type) => {
    const bubble = makeBubble(type)
    setBubbles((items) => [...items, bubble])
    setSelectedId(bubble.id)
  }

  const addCaption = () => {
    const caption = makeCaption()
    setCaptions((items) => [...items, caption])
    setSelectedId(caption.id)
  }

  const addImageLayer = (file) => {
    if (!file) return
    if (!isAcceptedImage(file)) {
      setError('Please choose a PNG, JPEG, or WebP image.')
      return
    }
    const src = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const width = 0.45
      const height = clamp(width * (baseImage.width / baseImage.height) / (image.naturalWidth / image.naturalHeight), 0.12, 0.7)
      const layer = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, src, x: (1 - width) / 2, y: (1 - height) / 2, width, height, ratio: image.naturalWidth / image.naturalHeight, name: file.name }
      layerObjectUrlsRef.current.push(src)
      setImageLayers((items) => [...items, layer])
      setSelectedId(layer.id)
      setError('')
    }
    image.onerror = () => { URL.revokeObjectURL(src); setError('That image could not be opened.') }
    image.src = src
  }

  const updateSelected = (patch) => {
    if (selectedBubble) setBubbles((items) => items.map((item) => item.id === selectedId ? { ...item, ...patch } : item))
    if (selectedCaption) setCaptions((items) => items.map((item) => item.id === selectedId ? { ...item, ...patch } : item))
    if (selectedImage) setImageLayers((items) => items.map((item) => item.id === selectedId ? { ...item, ...patch } : item))
  }

  const deleteSelected = () => {
    setBubbles((items) => items.filter((item) => item.id !== selectedId))
    setCaptions((items) => items.filter((item) => item.id !== selectedId))
    setImageLayers((items) => items.filter((item) => item.id !== selectedId))
    setSelectedId(null)
  }

  const beginDrag = (event, bubble) => {
    event.preventDefault()
    event.stopPropagation()
    const rect = compositionRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = { id: bubble.id, offsetX: (event.clientX - rect.left) / rect.width - bubble.x, offsetY: (event.clientY - rect.top) / rect.height - bubble.y }
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedId(bubble.id)
    setIsDragging(true)
  }

  const moveDrag = (event) => {
    const drag = dragRef.current
    const rect = compositionRef.current?.getBoundingClientRect()
    if (!drag || !rect) return
    const item = bubbles.find((entry) => entry.id === drag.id) || captions.find((entry) => entry.id === drag.id) || imageLayers.find((entry) => entry.id === drag.id)
    if (!item) return
    const x = clamp((event.clientX - rect.left) / rect.width - drag.offsetX, 0, 1 - item.width)
    const y = clamp((event.clientY - rect.top) / rect.height - drag.offsetY, 0, 1 - item.height - (item.type ? 0.05 : 0))
    const updatePosition = (items) => items.map((entry) => entry.id === drag.id ? { ...entry, x, y } : entry)
    if (bubbles.some((entry) => entry.id === drag.id)) setBubbles(updatePosition)
    if (captions.some((entry) => entry.id === drag.id)) setCaptions(updatePosition)
    if (imageLayers.some((entry) => entry.id === drag.id)) setImageLayers(updatePosition)
  }

  const endDrag = (event) => {
    if (dragRef.current) event.currentTarget.releasePointerCapture?.(event.pointerId)
    dragRef.current = null
    setIsDragging(false)
  }

  const exportPng = async () => {
    try {
      const image = await loadImage(baseImage.src)
      const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const ctx = canvas.getContext('2d')
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      baseImage.masks?.forEach((mask) => {
        ctx.fillStyle = '#fff'
        ctx.fillRect(mask.x * canvas.width, mask.y * canvas.height, mask.width * canvas.width, mask.height * canvas.height)
      })
      const layerImages = await Promise.all(imageLayers.map(async (layer) => ({ layer, image: await loadImage(layer.src) })))
      layerImages.forEach(({ layer, image: layerImage }) => ctx.drawImage(layerImage, layer.x * canvas.width, layer.y * canvas.height, layer.width * canvas.width, layer.height * canvas.height))
      captions.forEach((caption) => drawCaption(ctx, caption, canvas.width, canvas.height))
      bubbles.forEach((bubble) => drawBubble(ctx, bubble, canvas.width, canvas.height))
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, `unflat-meme-${Date.now()}.png`)
        else setError('Could not create the PNG. Please try again.')
      }, 'image/png')
    } catch {
      setError('Could not export that image. Please choose another file.')
    }
  }

  return (
    <div className="meme-backdrop" onClick={onClose}>
      <section className="meme-modal" role="dialog" aria-modal="true" aria-labelledby="meme-editor-title" onClick={(event) => event.stopPropagation()}>
        <header className="meme-modal__header">
          <div><h2 id="meme-editor-title">Meme Editor</h2><p>Pick a scene, drop in a bubble, make it weird.</p></div>
          <button type="button" className="meme-close" onClick={onClose} aria-label="Close meme editor">×</button>
        </header>
        <div className="meme-modal__body">
          <aside className="meme-tools" aria-label="Meme controls">
            <p className="meme-label">Templates</p>
            <div className="meme-template-grid">
              {MEME_TEMPLATES.map((template) => <button type="button" key={template.id} className={`meme-template ${baseImage.id === template.id ? 'active' : ''}`} onClick={() => handleTemplate(template)} title={template.license}><img src={template.src} alt="" /><span>{template.name}</span></button>)}
            </div>
            <p className="meme-attribution">{baseImage.license}{baseImage.sourceUrl && <> · <a href={baseImage.sourceUrl} target="_blank" rel="noreferrer">source</a></>}</p>
            <input ref={fileInputRef} className="meme-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { handleFile(event.target.files?.[0]); event.target.value = '' }} />
            <input ref={imageLayerInputRef} className="meme-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { addImageLayer(event.target.files?.[0]); event.target.value = '' }} />
            <button type="button" className="meme-action" onClick={() => fileInputRef.current?.click()}><Upload size={17} /> Replace base</button>
            <button type="button" className="meme-action meme-action--primary" onClick={() => imageLayerInputRef.current?.click()}><ImagePlus size={17} /> Add image</button>
            <p className="meme-label">Add text</p>
            <button type="button" className="meme-action meme-action--primary" onClick={addCaption}><PencilLine size={17} /> Meme caption</button>
            <p className="meme-label">Add bubble</p>
            <div className="meme-tool-row"><button type="button" className="meme-action" onClick={() => addBubble('speech')}><MessageCircle size={17} /> Speech</button><button type="button" className="meme-action" onClick={() => addBubble('thought')}><Brain size={17} /> Thought</button></div>
            {selected && <div className="meme-inspector">{!selectedImage && <><p className="meme-label">{selectedCaption ? 'Caption text' : 'Bubble text'}</p><textarea ref={textInputRef} value={selected.text} maxLength={120} onChange={(event) => updateSelected({ text: event.target.value })} aria-label="Selected text" />{selectedCaption && <><p className="meme-label">Text size</p><input className="meme-slider" type="range" min="0.03" max="0.12" step="0.005" value={selected.fontSize} onChange={(event) => updateSelected({ fontSize: Number(event.target.value) })} aria-label="Caption text size" /></>}</>}{selectedImage && <><p className="meme-label">Image size</p><input className="meme-slider" type="range" min="0.15" max="0.9" step="0.01" value={selected.width} onChange={(event) => { const width = Number(event.target.value); updateSelected({ width, height: clamp(width * (baseImage.width / baseImage.height) / selected.ratio, 0.08, 0.9) }) }} aria-label="Image layer size" /></>}<button type="button" className="meme-delete" onClick={deleteSelected}><Trash2 size={17} /> Delete selected</button></div>}
          </aside>
          <div className="meme-stage">
            <div ref={compositionRef} className={`meme-composition ${isDragging ? 'dragging' : ''}`} style={{ aspectRatio: `${baseImage.width} / ${baseImage.height}` }} onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onClick={() => setSelectedId(null)}>
              <img src={baseImage.src} alt="Meme base template" draggable="false" />
              {baseImage.masks?.map((mask, index) => <span key={index} className="meme-template-mask" style={{ left: `${mask.x * 100}%`, top: `${mask.y * 100}%`, width: `${mask.width * 100}%`, height: `${mask.height * 100}%` }} />)}
              {imageLayers.map((layer) => <button type="button" key={layer.id} className={`meme-image-layer ${selectedId === layer.id ? 'selected' : ''}`} style={{ left: `${layer.x * 100}%`, top: `${layer.y * 100}%`, width: `${layer.width * 100}%`, height: `${layer.height * 100}%` }} onPointerDown={(event) => beginDrag(event, layer)} onClick={(event) => { event.stopPropagation(); setSelectedId(layer.id) }} aria-label={`Edit image layer ${layer.name}`}><img src={layer.src} alt="" draggable="false" /></button>)}
              {captions.map((caption) => <button type="button" key={caption.id} className={`meme-caption ${selectedId === caption.id ? 'selected' : ''}`} style={{ left: `${caption.x * 100}%`, top: `${caption.y * 100}%`, width: `${caption.width * 100}%`, height: `${caption.height * 100}%`, fontSize: `${caption.fontSize * 100}cqw` }} onPointerDown={(event) => beginDrag(event, caption)} onClick={(event) => { event.stopPropagation(); setSelectedId(caption.id) }} aria-label="Edit meme caption"><span>{caption.text}</span></button>)}
              {bubbles.map((bubble) => <button type="button" key={bubble.id} className={`meme-bubble meme-bubble--${bubble.type} ${selectedId === bubble.id ? 'selected' : ''}`} style={{ left: `${bubble.x * 100}%`, top: `${bubble.y * 100}%`, width: `${bubble.width * 100}%`, height: `${bubble.height * 100}%` }} onPointerDown={(event) => beginDrag(event, bubble)} onClick={(event) => { event.stopPropagation(); setSelectedId(bubble.id) }} aria-label={`Edit ${bubble.type} bubble`}><span>{bubble.text}</span></button>)}
              <div className="meme-drop-hint"><Plus size={22} /><span>DROP IMAGE TO ADD AS A LAYER</span></div>
            </div>
            <div className="meme-stage__footer">
              <p className="meme-stage__hint">Drag layers to move · Select text to edit</p>
              {selected && <button type="button" className="meme-selected-delete" onClick={deleteSelected}><Trash2 size={16} /> Delete selected</button>}
            </div>
          </div>
        </div>
        {error && <p className="meme-error" role="alert">{error}</p>}
        <footer className="meme-modal__footer"><button type="button" className="meme-action" onClick={onClose}>Cancel</button><button type="button" className="meme-export" onClick={exportPng}><Download size={18} /> Export PNG</button></footer>
      </section>
    </div>
  )
}
