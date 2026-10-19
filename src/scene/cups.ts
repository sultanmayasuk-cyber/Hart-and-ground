// The fixed camera every cup scene shares.
import { PHONE } from '../env'

export const HERO_FOV = 35
export const CAM_Z = 5.2
// The cup models are Draco-compressed (3 MB → 0.7 MB each); the decoder ships with the site in public/draco.
export const DRACO = '/draco/'
// the models: phones get the same meshes with 1024² textures in place of 2048² (`-phone`, made with
// `npx @gltf-transform/cli resize --width 1024 --height 1024` then `draco`; a third of the GPU memory and half the
// download, and a phone never shows the cup at more than ~600 px across, 2026-10-19)
export const model = (name: 'coffee' | 'matcha') => `/models/${name}${PHONE ? '-phone' : ''}.glb`
