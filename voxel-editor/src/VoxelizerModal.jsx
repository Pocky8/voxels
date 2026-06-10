import { useState, useRef } from 'react'
import { useVoxelStore } from './store'
import './VoxelizerModal.css'

export default function VoxelizerModal({ onClose }) {
  const setVoxels = useVoxelStore((s) => s.setVoxels)

  const [resolution, setResolution] = useState(20)
  const [color, setColor] = useState('#4f9cf9')
  const [status, setStatus] = useState('idle') // idle | running | done | error
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const workerRef = useRef(null)
  const fileRef = useRef(null)

  const handleConvert = () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return

    setStatus('running')
    setProgress(0)
    setErrorMsg('')

    const reader = new FileReader()
    reader.onload = (e) => {
      const buffer = e.target.result

      // Terminate any existing worker
      workerRef.current?.terminate()

      const worker = new Worker(
        new URL('./voxelizer.worker.js', import.meta.url),
        { type: 'module' }
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

  const handleCancel = () => {
    workerRef.current?.terminate()
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={handleCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">🔁 Mesh → Voxels</h2>
          <button className="modal__close" onClick={handleCancel}>✕</button>
        </div>

        <div className="modal__body">
          <p className="modal__description">
            Upload a <code>.gltf</code> file. A Web Worker will voxelize it using
            AABB subdivision and ray-cast inside/outside tests.
          </p>

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
            <p className="modal__success">✅ Voxelization complete! Canvas updated.</p>
          )}

          {status === 'error' && (
            <p className="modal__error">❌ {errorMsg}</p>
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
            {status === 'running' ? '⏳ Converting…' : '▶ Convert'}
          </button>
        </div>
      </div>
    </div>
  )
}
