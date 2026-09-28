import { HEAP, heapRotation, inCup, useIce } from './ice'

// The heap standing still (the menu's matcha: its ice is simply there). grow: the cubes a little bigger. under: the
// drink they sit in.
export default function IceHeap({ grow = 1, under }: { grow?: number; under: string }) {
  const { geos, mat } = useIce({ refract: false, under })
  return (
    <group>
      {HEAP.map(([hx, y, hz, s, tilt], i) => {
        const [x, z] = inCup(hx, hz, s * grow)
        return <mesh key={i} geometry={geos[i % 3]} material={mat} position={[x, y, z]} rotation={heapRotation(tilt)} scale={s * grow} />
      })}
    </group>
  )
}
