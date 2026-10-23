/** Shared Web/PDA roll measurement formula. Pure so record validation never imports page initialization. */
export function computeUsableLength(actualLength: number, headLength: number, tailLength: number, layerCount = 1): number {
  const normalizedLayerCount = Math.max(Number(layerCount || 0), 0)
  return Number(((Number(actualLength || 0) * normalizedLayerCount) + Number(headLength || 0) + Number(tailLength || 0)).toFixed(2))
}
