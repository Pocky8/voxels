import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

const LOCAL_STORAGE_KEY = 'unflat_local_creations'

function getLocalCreations() {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalCreation(creation) {
  if (typeof window === 'undefined') return
  try {
    const list = getLocalCreations().filter((item) => item.id !== creation.id)
    list.unshift(creation)
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list.slice(0, 40)))
  } catch (err) {
    console.warn('Could not save to localStorage:', err)
  }
}

function removeLocalCreation(id) {
  if (typeof window === 'undefined') return
  try {
    const list = getLocalCreations().filter((item) => item.id !== id)
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list))
  } catch (err) {
    console.warn('Could not remove from localStorage:', err)
  }
}

const creations = (uid) => collection(db, 'users', uid, 'creations')

const FIRESTORE_TIMEOUT_MS = 6000

export async function saveCreation(user, { name, frames, fps }) {
  const safeName = name?.trim() || 'Untitled creation'
  const safeFps = Number(fps) || 6
  const safeFrames = Array.isArray(frames) ? frames : [[]]
  const voxelCount = safeFrames.flat().length
  const frameCount = safeFrames.length
  const framesJson = JSON.stringify(safeFrames)

  if (framesJson.length > 800000) {
    throw new Error('This creation is too large to save. Reduce the number of voxels or frames.')
  }

  // Back up locally in the browser immediately so work is never lost
  const localId = 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
  const localRecord = {
    id: localId,
    name: safeName,
    fps: safeFps,
    voxelCount,
    frameCount,
    frames: safeFrames,
    framesJson,
    updatedAt: { seconds: Math.floor(Date.now() / 1000) },
    createdAt: { seconds: Math.floor(Date.now() / 1000) },
    isLocal: true,
  }
  saveLocalCreation(localRecord)

  if (!db || !user?.uid) {
    return localId
  }

  const docData = {
    name: safeName,
    fps: safeFps,
    voxelCount,
    frameCount,
    framesJson,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  try {
    const savePromise = addDoc(creations(user.uid), docData)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('FIRESTORE_TIMEOUT')), FIRESTORE_TIMEOUT_MS)
    )

    const reference = await Promise.race([savePromise, timeoutPromise])
    // Cloud save succeeded; clean up temporary local backup
    removeLocalCreation(localId)
    return reference.id
  } catch (err) {
    if (err.message === 'FIRESTORE_TIMEOUT') {
      throw new Error(
        'Cloud save timed out. Your creation has been backed up locally in your browser. To enable cloud saving, open Firebase Console > Firestore Database and click "Create database".'
      )
    }
    const msg = err.message || String(err)
    if (
      msg.includes('permission-denied') ||
      msg.includes('PERMISSION_DENIED') ||
      msg.includes('has not been used in project') ||
      msg.includes('disabled')
    ) {
      throw new Error(
        'Cloud Firestore is not enabled yet in your Firebase project. Your creation is saved locally in your browser. Go to Firebase Console > Firestore Database and click "Create database".'
      )
    }
    throw err
  }
}

export async function listCreations(user) {
  const localItems = getLocalCreations()
  let cloudItems = []

  if (db && user?.uid) {
    try {
      const fetchPromise = getDocs(query(creations(user.uid), orderBy('updatedAt', 'desc')))
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 4000)
      )
      const snapshot = await Promise.race([fetchPromise, timeoutPromise])
      cloudItems = snapshot.docs.map((entry) => {
        const data = entry.data()
        let parsedFrames = [[]]
        if (typeof data.framesJson === 'string') {
          try {
            parsedFrames = JSON.parse(data.framesJson)
          } catch (err) {
            console.error('Failed to parse framesJson for creation:', entry.id, err)
          }
        } else if (Array.isArray(data.frames)) {
          parsedFrames = data.frames
        }

        return {
          id: entry.id,
          ...data,
          frames: parsedFrames,
          frameCount: data.frameCount ?? parsedFrames.length,
          voxelCount: data.voxelCount ?? parsedFrames.flat().length,
          isLocal: false,
        }
      })
    } catch (err) {
      console.warn('Could not load from Firestore, falling back to local creations:', err.message)
    }
  }

  // Combine cloud and local creations without duplicating IDs
  const cloudIds = new Set(cloudItems.map((item) => item.id))
  const filteredLocal = localItems.filter((item) => !cloudIds.has(item.id))
  const allItems = [...cloudItems, ...filteredLocal]

  allItems.sort((a, b) => {
    const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : 0)
    const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : 0)
    return timeB - timeA
  })

  return allItems
}

export async function removeCreation(user, id) {
  removeLocalCreation(id)
  if (db && user?.uid && !String(id).startsWith('local_')) {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'creations', id))
    } catch (err) {
      console.warn('Could not delete from Firestore:', err)
    }
  }
}
