import { Vector3 } from 'three'

// Live world positions of the two 3D cups (base centre) and their size, written by Cups3D each frame
// and read by the grain simulation so particles can spiral around them.
export type CupWorld = { center: Vector3; scale: number }
export const cupsWorld: { matcha: CupWorld; coffee: CupWorld } = {
  matcha: { center: new Vector3(1.0, -4, 0), scale: 1.35 },
  coffee: { center: new Vector3(2.1, -4, -0.3), scale: 1.35 },
}
export const HERO_FOV = 35
export const CAM_Z = 5.2
