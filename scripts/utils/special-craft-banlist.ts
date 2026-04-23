export function fromCodes(codes: number[]): string {
  return String.fromCharCode(...codes)
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const removedChineseTerms = [
  fromCodes([20116, 37329]),
  fromCodes([30424, 21475]),
  fromCodes([30424, 25187]),
  fromCodes([40481, 30524, 25187]),
  fromCodes([25163, 24037, 30424, 25187]),
  fromCodes([21360, 33457, 24037, 33402]),
  fromCodes([26579, 33394, 24037, 33402]),
] as const

const removedEnglishCodes = [
  fromCodes([72, 65, 82, 68, 87, 65, 82, 69]),
  fromCodes([70, 82, 79, 71, 95, 66, 85, 84, 84, 79, 78]),
  fromCodes([69, 89, 69, 76, 69, 84]),
  fromCodes([72, 65, 78, 68, 95, 70, 82, 79, 71]),
  fromCodes([72, 65, 78, 68, 95, 70, 82, 79, 71, 95, 66, 85, 84, 84, 79, 78]),
  fromCodes([80, 82, 73, 78, 84, 73, 78, 71, 95, 67, 82, 65, 70, 84]),
  fromCodes([68, 89, 69, 73, 78, 71, 95, 67, 82, 65, 70, 84]),
  fromCodes([83, 80, 69, 67, 73, 65, 76, 95, 80, 82, 73, 78, 84]),
  fromCodes([83, 80, 69, 67, 73, 65, 76, 95, 68, 89, 69]),
  fromCodes([83, 80, 69, 67, 73, 65, 76, 95, 80, 82, 73, 78, 84, 73, 78, 71]),
  fromCodes([83, 80, 69, 67, 73, 65, 76, 95, 68, 89, 69, 73, 78, 71]),
] as const

export const removedLegacyTerms = [...removedChineseTerms, ...removedEnglishCodes]
export const removedLegacyCraftNames = removedChineseTerms
export const removedLegacyProcessCodes = removedEnglishCodes
export const removedPseudoCraftNames = removedChineseTerms.slice(-2)
export const removedCraftNameSet = new Set(removedLegacyCraftNames)

export function getRemovedLegacyTermPattern(flags = ''): RegExp {
  return new RegExp(removedLegacyTerms.map((item) => escapeRegExp(item)).join('|'), flags)
}

export function getRemovedPseudoCraftPattern(flags = ''): RegExp {
  return new RegExp(removedPseudoCraftNames.map((item) => escapeRegExp(item)).join('|'), flags)
}

export function includesRemovedLegacyTerm(source: string): string | undefined {
  return removedLegacyTerms.find((item) => source.includes(item))
}

export function includesRemovedPseudoCraft(source: string): string | undefined {
  return removedPseudoCraftNames.find((item) => source.includes(item))
}

export function assertNoRemovedLegacyTerm(
  source: string,
  assertFn: (condition: unknown, message: string) => void,
  message: string,
): void {
  assertFn(!includesRemovedLegacyTerm(source), message)
}
