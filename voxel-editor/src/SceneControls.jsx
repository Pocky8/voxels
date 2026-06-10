import { useEffect, useRef } from 'react'
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

export default function SceneControls({ paintMode }) {
  const controlsRef = useRef(null)

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    controls.mouseButtons = paintMode ? PAINT_MOUSE_BUTTONS : DEFAULT_MOUSE_BUTTONS

    // Clear any stuck drag state when switching modes
    controls.enabled = false
    controls.enabled = true
  }, [paintMode])

  return <OrbitControls ref={controlsRef} makeDefault enableDamping />
}
