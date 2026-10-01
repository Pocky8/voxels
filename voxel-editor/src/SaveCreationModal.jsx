import { useState } from 'react'
import { saveCreation } from './creationRepository'
import './FirebaseModal.css'
function formatFirestoreError(err) {
  if (!err) return ''
  const msg = err.message || String(err)
  if (
    msg.includes('Cloud Firestore is not enabled') ||
    msg.includes('Cloud save timed out') ||
    msg.includes('backed up locally') ||
    msg.includes('Create database')
  ) {
    return msg
  }
  if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
    return 'Permission denied by Firestore. Make sure your Firestore rules allow authenticated users to save (check firestore.rules).'
  }
  if (msg.includes('ERR_BLOCKED_BY_CLIENT') || msg.includes('Could not reach Cloud Firestore backend') || msg.includes('client is offline')) {
    return 'Request blocked by your browser. Please disable ad blockers (uBlock Origin, AdBlock, Brave Shields) for localhost and try again.'
  }
  return msg.replace('FirebaseError: ', '')
}

export default function SaveCreationModal({ user, frames, fps, onClose }) {
  const [name, setName] = useState('Untitled creation')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await saveCreation(user, { name, frames, fps })
      onClose()
    } catch (err) {
      setError(formatFirestoreError(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="fb-backdrop" onClick={onClose}>
      <form className="fb-modal" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Save creation</h2>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <label>
          Name
          <input value={name} maxLength="80" onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        {error && <div className="fb-error">{error}</div>}
        <button className="fb-primary" disabled={busy}>{busy ? 'Saving…' : 'Save to gallery'}</button>
      </form>
    </div>
  )
}
