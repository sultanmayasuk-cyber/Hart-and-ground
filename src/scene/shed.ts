// Tap-to-shed: the page queues a shed, the stag simulation picks it up on its next frame.
// Kept out of Stag.tsx so the DOM can trigger it without pulling three.js into its chunk.
export const shedState = { queued: false }
export const shed = () => {
  shedState.queued = true
}
