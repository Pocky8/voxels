import { useEffect, useState } from 'react'
import { listCreations, removeCreation } from './creationRepository'
import './FirebaseModal.css'
function formatFirestoreError(err) {
  if (!err) return ''
  const msg = err.message || String(err)
  if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
    return 'Permission denied by Firestore. Make sure your Firestore rules allow authenticated users to read creations (check firestore.rules).'
  }
  if (msg.includes('ERR_BLOCKED_BY_CLIENT') || msg.includes('Could not reach Cloud Firestore backend') || msg.includes('client is offline')) {
    return 'Request blocked by your browser. Please disable ad blockers (uBlock Origin, AdBlock, Brave Shields) for localhost and try again.'
  }
  return msg.replace('FirebaseError: ', '')
}

export default function GalleryModal({ user, onClose, onLoad }) {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)

  const refresh = async () => {
    setBusy(true)
    try {
      setItems(await listCreations(user))
    } catch (err) {
      setError(formatFirestoreError(err))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    let active = true
    listCreations(user)
      .then((next) => {
        if (active) setItems(next)
      })
      .catch((err) => {
        if (active) setError(formatFirestoreError(err))
      })
      .finally(() => {
        if (active) setBusy(false)
      })
    return () => {
      active = false
    }
  }, [user])

  const remove = async (item) => {
    if (!window.confirm(`Delete “${item.name}”?`)) return
    try {
      await removeCreation(user, item.id)
      refresh()
    } catch (err) {
      setError(formatFirestoreError(err))
    }
  }

  return (
    <div className="fb-backdrop" onClick={onClose}>
      <section className="fb-modal fb-gallery" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Your gallery</h2>
          <button type="button" onClick={onClose}>×</button>
        </header>
        {busy ? (
          <p>Loading creations…</p>
        ) : error ? (
          <div className="fb-error">{error}</div>
        ) : items.length === 0 ? (
          <p>Your saved voxel creations will appear here.</p>
        ) : (
          <div className="fb-gallery__list">
            {items.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.voxelCount || 0} voxels · {item.frameCount || item.frames?.length || 0} frames{item.isLocal ? ' · (Local backup)' : ''}</span>
                </div>
                <button onClick={() => onLoad(item)}>Load</button>
                <button className="fb-danger" onClick={() => remove(item)}>Delete</button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
