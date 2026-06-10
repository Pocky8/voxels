import { create } from 'zustand'

let nextId = 1
const DEFAULT_FPS = 6

const cloneVoxels = (voxels) =>
  voxels.map((v) => ({
    ...v,
    position: [...v.position],
  }))

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
  showGrid: true,
  isExporting: false,

  setActiveTool: (tool) => set({ activeTool: tool }),
  setActiveColor: (color) => set({ activeColor: color }),
  setContinuousDraw: (continuousDraw) => set({ continuousDraw }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setIsExporting: (isExporting) => set({ isExporting }),

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
      return {
        frames,
        currentFrame: insertAt,
        voxels: cloneVoxels(newFrame),
      }
    }),

  removeCurrentFrame: () =>
    set((state) => {
      if (state.frames.length <= 1) {
        return {
          frames: [[]],
          currentFrame: 0,
          voxels: [],
          isPlaying: false,
        }
      }
      const frames = state.frames.filter((_, i) => i !== state.currentFrame)
      const currentFrame = Math.min(state.currentFrame, frames.length - 1)
      const voxels = cloneVoxels(frames[currentFrame])
      updateNextId(voxels)
      return { frames, currentFrame, voxels }
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
    // Deduplicate: don't add if a voxel already exists at this position
    const key = position.join(',')
    const exists = get().voxels.some(v => v.position.join(',') === key)
    if (exists) return
    const newVoxel = { id: nextId++, position, color: c }
    set((state) => ({
      voxels: [...state.voxels, newVoxel],
      frames: state.frames.map((frame, i) =>
        i === state.currentFrame
          ? [...state.voxels, newVoxel]
          : frame
      ),
    }))
  },

  removeVoxel: (id) =>
    set((state) => {
      const voxels = state.voxels.filter((v) => v.id !== id)
      return {
        voxels,
        frames: state.frames.map((frame, i) =>
          i === state.currentFrame ? voxels : frame
        ),
      }
    }),

  setVoxels: (voxels) => {
    const nextVoxels = cloneVoxels(voxels)
    updateNextId(nextVoxels)
    set((state) => ({
      voxels: nextVoxels,
      frames: state.frames.map((frame, i) =>
        i === state.currentFrame ? nextVoxels : frame
      ),
    }))
  },

  clearCanvas: () =>
    set((state) => ({
      voxels: [],
      frames: state.frames.map((frame, i) => (i === state.currentFrame ? [] : frame)),
    })),
}))
