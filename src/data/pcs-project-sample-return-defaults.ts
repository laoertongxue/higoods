import type { SampleSourceType } from './pcs-project-types.ts'

export function resolveSampleReturnDestination(
  returnDestination: string,
  sampleSourceType: SampleSourceType | '',
): string {
  const explicitDestination = returnDestination.trim()
  if (explicitDestination) return explicitDestination
  if (sampleSourceType === '外采') return '退回供应商'
  if (sampleSourceType === '委托打样') return '退回版房'
  return '样衣库存留样'
}
