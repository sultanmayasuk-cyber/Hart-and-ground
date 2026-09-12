import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { damp, pointer } from './pointer'

// Fixed camera with a little mouse parallax, optionally raised to look down on the scene.
export function CameraRig({ height = 0, lookY = 0 }: { height?: number; lookY?: number }) {
  const { camera } = useThree()
  useFrame((_, dt) => {
    camera.position.x = damp(camera.position.x, pointer.sx * 0.12, 3, dt)
    camera.position.y = damp(camera.position.y, height + pointer.sy * 0.08, 3, dt)
    camera.lookAt(0, lookY, 0)
  })
  return null
}

// Feeds `pointer` from the window. A lifted finger switches the cursor off, so it doesn't
// stay behind as an invisible hand pushing grains around.
export function PointerRig() {
  useEffect(() => {
    const move = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.y = -(e.clientY / window.innerHeight) * 2 + 1
      pointer.on = 1
    }
    const up = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') pointer.on = 0
    }
    const leave = () => (pointer.on = 0)
    const html = document.documentElement
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', move, { passive: true })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('blur', leave)
    html.addEventListener('pointerleave', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('blur', leave)
      html.removeEventListener('pointerleave', leave)
    }
  }, [])
  useFrame((_, dt) => {
    pointer.sx = damp(pointer.sx, pointer.x, 3, dt)
    pointer.sy = damp(pointer.sy, pointer.y, 3, dt)
    pointer.son = damp(pointer.son, pointer.on, 5, dt)
  })
  return null
}
