/** YRN-001..009: fixed unit tare is rounded once, before multiplying by pcs. */
export const YARN_TUBE_GRAMS = { PAPER: 62, CONICAL: 80, PAGODA: 121 } as const
export const YARN_TUBE_LABELS = { PAPER: '纸管', CONICAL: '锥形管', PAGODA: '宝塔管' } as const
export type YarnTubeType = keyof typeof YARN_TUBE_GRAMS
export type YarnTubeCounts = Record<YarnTubeType, number>
export interface YarnWeight {
  pcs: number; grossGrams: number; tareGrams: number; netGrams: number
  tubes: YarnTubeCounts; tubeStandards: Record<YarnTubeType, number>
}
export function weightGrams(kg: number): number {
  if (!Number.isFinite(kg) || kg < 0) throw new Error('重量必须是大于或等于 0 的数字。')
  const grams = Math.round(kg * 1000)
  if (!Number.isSafeInteger(grams) || Math.abs(kg * 1000 - grams) > .000001) throw new Error('重量最多保留三位 kg 小数（一克）。')
  return grams
}
export function calculateYarnWeight(grossKg: number, tubes: YarnTubeCounts, pcs?: number): YarnWeight {
  const grossGrams = weightGrams(grossKg)
  const keys = Object.keys(YARN_TUBE_GRAMS) as YarnTubeType[]
  for (const key of keys) if (!Number.isSafeInteger(tubes[key]) || tubes[key] < 0) throw new Error(`${YARN_TUBE_LABELS[key]}数量必须是非负整数。`)
  const count = keys.reduce((sum, key) => sum + tubes[key], 0)
  if (pcs !== undefined && (!Number.isSafeInteger(pcs) || pcs !== count)) throw new Error('pcs 必须等于三个管型数量之和。')
  if (grossGrams > 0 && count === 0) throw new Error('请填写纱线筒数和管型。')
  if (grossGrams === 0 && count !== 0) throw new Error('本次未收到时，毛重和筒数都应为 0。')
  const tareGrams = keys.reduce((sum, key) => sum + tubes[key] * YARN_TUBE_GRAMS[key], 0)
  if (tareGrams > grossGrams) throw new Error('管重超过毛重，请核对称重和管型数量。')
  return {pcs:count,grossGrams,tareGrams,netGrams:grossGrams-tareGrams,tubes:{...tubes},tubeStandards:{...YARN_TUBE_GRAMS}}
}
export function yarnGrossLimit(orderedKg: number) {
  const orderedGrams = weightGrams(orderedKg)
  if (orderedGrams <= 0) throw new Error('染色单缺少有效下单重量，不能交出。')
  const multiplier = orderedGrams <= 10000 ? 3 : 2
  return {orderedGrams,multiplier,limitGrams:orderedGrams * multiplier}
}
export function assertYarnShipment(orderedKg: number, priorGrossGrams: number, current: YarnWeight, availableNetKg: number): void {
  const {limitGrams} = yarnGrossLimit(orderedKg)
  if (!Number.isSafeInteger(priorGrossGrams) || priorGrossGrams < 0) throw new Error('历史交出毛重不完整，请核对原记录。')
  if (current.netGrams <= 0 || current.pcs <= 0) throw new Error('出货筒数和净重必须大于 0。')
  if (priorGrossGrams + current.grossGrams > limitGrams) throw new Error(`累计出货毛重不能超过 ${limitGrams/1000} kg；剩余额度 ${(limitGrams-priorGrossGrams)/1000} kg。`)
  if (current.netGrams > weightGrams(availableNetKg)) throw new Error(`可交出净重不足，当前可用 ${availableNetKg} kg。`)
}
export const yarnWeightText = (w: YarnWeight) => `${w.pcs} pcs · 毛重 ${(w.grossGrams/1000).toFixed(3)} kg · 净重 ${(w.netGrams/1000).toFixed(3)} kg`
