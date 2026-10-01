import { create } from 'zustand'

let nextId = 1
const DEFAULT_FPS = 6

const cloneVoxels = (voxels) =>
  voxels.map((v) => ({
    ...v,
    position: [...v.position],
  }))

const cloneFrames = (frames) => frames.map(cloneVoxels)

const snapshot = (state) => ({
  frames: cloneFrames(state.frames),
  currentFrame: state.currentFrame,
  voxels: cloneVoxels(state.voxels),
})

const withHistory = (state, next) => ({
  ...next,
  past: [...state.past, snapshot(state)],
  future: [],
})

const samePosition = (a, b) => a.join(',') === b.join(',')
const mirroredX = ([x, y, z]) => [-x, y, z]

const updateNextId = (voxels) => {
  const maxId = voxels.reduce((max, v) => Math.max(max, v.id ?? 0), 0)
  nextId = maxId + 1
}

export const useVoxelStore = create((set, get) => ({
  voxels: [], // [{ id, position: [x,y,z], color }]
  frames: [[]],
  currentFrame: 0,
  isPlaying: false,
  fps: DEFAULT_FPS,
  activeTool: 'draw', // 'draw' | 'erase'
  activeColor: '#4f9cf9',
  continuousDraw: false,
  mirrorX: false,
  showGrid: true,
  isExporting: false,
  past: [],
  future: [],

  setActiveTool: (tool) => set({ activeTool: tool }),
  setActiveColor: (color) => set({ activeColor: color }),
  setContinuousDraw: (continuousDraw) => set({ continuousDraw }),
  setMirrorX: (mirrorX) => set({ mirrorX }),
  setFps: (fps) => set({ fps }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setIsExporting: (isExporting) => set({ isExporting }),

  undo: () =>
    set((state) => {
      const previous = state.past[state.past.length - 1]
      if (!previous) return state
      const nextVoxels = cloneVoxels(previous.voxels)
      updateNextId(nextVoxels)
      return {
        frames: cloneFrames(previous.frames),
        currentFrame: previous.currentFrame,
        voxels: nextVoxels,
        past: state.past.slice(0, -1),
        future: [snapshot(state), ...state.future],
      }
    }),

  redo: () =>
    set((state) => {
      const next = state.future[0]
      if (!next) return state
      const nextVoxels = cloneVoxels(next.voxels)
      updateNextId(nextVoxels)
      return {
        frames: cloneFrames(next.frames),
        currentFrame: next.currentFrame,
        voxels: nextVoxels,
        past: [...state.past, snapshot(state)],
        future: state.future.slice(1),
      }
    }),

  setCurrentFrame: (index) =>
    set((state) => {
      if (state.frames.length === 0) {
        return { frames: [[]], currentFrame: 0, voxels: [] }
      }
      const safeIndex = Math.max(0, Math.min(index, state.frames.length - 1))
      const frameVoxels = cloneVoxels(state.frames[safeIndex])
      updateNextId(frameVoxels)
      return {
        currentFrame: safeIndex,
        voxels: frameVoxels,
      }
    }),

  addFrameAfterCurrent: () =>
    set((state) => {
      const insertAt = state.currentFrame + 1
      const newFrame = cloneVoxels(state.voxels)
      const frames = [...state.frames]
      frames.splice(insertAt, 0, newFrame)
      return withHistory(state, {
        frames,
        currentFrame: insertAt,
        voxels: cloneVoxels(newFrame),
      })
    }),

  removeCurrentFrame: () =>
    set((state) => {
      if (state.frames.length <= 1) {
        if (state.voxels.length === 0) return state
        return withHistory(state, {
          frames: [[]],
          currentFrame: 0,
          voxels: [],
          isPlaying: false,
        })
      }
      const frames = state.frames.filter((_, i) => i !== state.currentFrame)
      const currentFrame = Math.min(state.currentFrame, frames.length - 1)
      const voxels = cloneVoxels(frames[currentFrame])
      updateNextId(voxels)
      return withHistory(state, { frames, currentFrame, voxels })
    }),

  togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),
  stopPlayback: () => set({ isPlaying: false }),
  stepPlayback: () =>
    set((state) => {
      if (state.frames.length === 0) return state
      const nextFrame = (state.currentFrame + 1) % state.frames.length
      const voxels = cloneVoxels(state.frames[nextFrame])
      updateNextId(voxels)
      return {
        currentFrame: nextFrame,
        voxels,
      }
    }),

  addVoxel: (position, color) => {
    const c = color ?? get().activeColor
    set((state) => {
      const positions = state.mirrorX && position[0] !== 0
        ? [position, mirroredX(position)]
        : [position]
      const newVoxels = positions
        .filter((p) => !state.voxels.some((v) => samePosition(v.position, p)))
        .map((p) => ({ id: nextId++, position: p, color: c }))
      if (newVoxels.length === 0) return state
      const voxels = [...state.voxels, ...newVoxels]
      return withHistory(state, {
        voxels,
        frames: state.frames.map((frame, i) =>
          i === state.currentFrame ? voxels : frame
        ),
      })
    })
  },

  removeVoxel: (id) =>
    set((state) => {
      const target = state.voxels.find((v) => v.id === id)
      if (!target) return state
      const removePositions = state.mirrorX && target.position[0] !== 0
        ? [target.position, mirroredX(target.position)]
        : [target.position]
      const voxels = state.voxels.filter((v) =>
        !removePositions.some((p) => samePosition(v.position, p))
      )
      return withHistory(state, {
        voxels,
        frames: state.frames.map((frame, i) =>
          i === state.currentFrame ? voxels : frame
        ),
      })
    }),

  setVoxels: (voxels) => {
    const nextVoxels = cloneVoxels(voxels)
    updateNextId(nextVoxels)
    set((state) =>
      withHistory(state, {
        voxels: nextVoxels,
        frames: state.frames.map((frame, i) =>
          i === state.currentFrame ? nextVoxels : frame
        ),
      })
    )
  },

  setAllFrames: (framesData) => {
    const cloned = cloneFrames(framesData)
    // Update nextId by checking all frames
    const maxId = cloned.flat().reduce((max, v) => Math.max(max, v.id ?? 0), 0)
    nextId = maxId + 1
    set((state) =>
      withHistory(state, {
        frames: cloned,
        currentFrame: 0,
        voxels: cloneVoxels(cloned[0] || []),
      })
    )
  },

  loadCreation: (framesData, fps) =>
    set(() => {
      const frames = cloneFrames(framesData?.length ? framesData : [[]])
      const voxels = cloneVoxels(frames[0])
      updateNextId(voxels)
      return { frames, currentFrame: 0, voxels, fps: Number(fps) || DEFAULT_FPS, isPlaying: false, past: [], future: [] }
    }),

  clearCanvas: () =>
    set((state) => {
      if (state.voxels.length === 0) return state
      return withHistory(state, {
        voxels: [],
        frames: state.frames.map((frame, i) => (i === state.currentFrame ? [] : frame)),
      })
    }),
}))
