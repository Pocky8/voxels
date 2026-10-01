import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { getAuth } from 'firebase/auth'
import { initializeFirestore } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

export const isFirebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId)
const app = isFirebaseConfigured ? initializeApp(config) : null
export const auth = app ? getAuth(app) : null
export const db = app
  ? initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    })
  : null

// Analytics only starts in browsers where the Firebase SDK supports it.
export const analytics = app && typeof window !== 'undefined'
  ? isSupported().then((supported) => supported ? getAnalytics(app) : null)
  : Promise.resolve(null)
