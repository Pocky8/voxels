import { useEffect, useRef, useState } from 'react'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

const DEFAULT_MOUSE_BUTTONS = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN,
}

const PAINT_MOUSE_BUTTONS = {
  LEFT: null,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN,
}

// On coarse-pointer (touch) devices one finger is reserved for voxel
// editing; two fingers pinch-zoom and rotate the camera.
const COARSE_TOUCHES = {
  ONE: null,
  TWO: THREE.TOUCH.DOLLY_ROTATE,
}

// Default three.js touch mapping used on desktop trackpads etc.
const DEFAULT_TOUCHES = {
  ONE: THREE.TOUCH.ROTATE,
  TWO: THREE.TOUCH.DOLLY_PAN,
}

export default function SceneControls({ paintMode }) {
  const controlsRef = useRef(null)
  const [isCoarse, setIsCoarse] = useState(
    () => window.matchMedia('(pointer: coarse)').matches
  )

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    const handler = (e) => setIsCoarse(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    controls.mouseButtons = paintMode ? PAINT_MOUSE_BUTTONS : DEFAULT_MOUSE_BUTTONS
    controls.touches = isCoarse ? COARSE_TOUCHES : DEFAULT_TOUCHES

    // Clear any stuck drag state when switching modes
    controls.enabled = false
    controls.enabled = true
  }, [paintMode, isCoarse])

  return <OrbitControls ref={controlsRef} makeDefault enableDamping />
}
