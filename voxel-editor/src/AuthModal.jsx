import { useState } from 'react'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from './firebase'
import './FirebaseModal.css'

function formatAuthError(err) {
  if (!err) return ''
  const code = err.code || ''
  const msg = err.message || ''

  if (code.includes('configuration-not-found') || msg.includes('CONFIGURATION_NOT_FOUND')) {
    return 'Authentication is not activated in Firebase yet. Please go to Firebase Console > Authentication, click "Get started", and enable "Email/Password".'
  }
  if (code.includes('operation-not-allowed') || msg.includes('OPERATION_NOT_ALLOWED')) {
    return 'Email/Password sign-in is disabled. Enable "Email/Password" under Firebase Console > Authentication > Sign-in method.'
  }
  if (code.includes('user-not-found')) {
    return 'No account found with this email. Switch to "Create account" below.'
  }
  if (code.includes('wrong-password') || code.includes('invalid-credential')) {
    return 'Incorrect email or password. If you have not created an account yet, click "Need an account? Create one" below.'
  }
  if (code.includes('email-already-in-use')) {
    return 'An account already exists with this email. Switch to "Sign in" below.'
  }
  if (code.includes('weak-password')) {
    return 'Password must be at least 6 characters long.'
  }
  if (code.includes('invalid-email')) {
    return 'Please enter a valid email address.'
  }
  if (code.includes('too-many-requests')) {
    return 'Access temporarily disabled due to too many failed attempts. Try again in a few minutes.'
  }
  if (code.includes('network-request-failed')) {
    return 'Network request failed. Please check your internet connection.'
  }
  return msg.replace('Firebase: ', '').trim() || 'Authentication failed. Please check your credentials.'
}

export default function AuthModal({ onClose }) {
  const [mode, setMode] = useState('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      if (mode === 'sign-in') {
        await signInWithEmailAndPassword(auth, email, password)
      } else {
        await createUserWithEmailAndPassword(auth, email, password)
      }
      onClose()
    } catch (err) {
      setError(formatAuthError(err))
    } finally {
      setBusy(false)
    }
  }
  return <div className="fb-backdrop" onClick={onClose}><form className="fb-modal" onSubmit={submit} onClick={(e) => e.stopPropagation()}><header><h2>{mode === 'sign-in' ? 'Sign in' : 'Create account'}</h2><button type="button" onClick={onClose}>×</button></header><p>Save your voxel creations and open them from any device.</p><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength="6" required /></label>{error && <div className="fb-error">{error}</div>}<button className="fb-primary" disabled={busy}>{busy ? 'Working…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}</button><button type="button" className="fb-link" onClick={() => setMode(mode === 'sign-in' ? 'create' : 'sign-in')}>{mode === 'sign-in' ? 'Need an account? Create one' : 'Already have an account? Sign in'}</button></form></div>
}
