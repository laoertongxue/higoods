export const PDA_PAGE_HANDLED_LOCALLY = 'handled-locally' as const

export type PdaPageEventResult = boolean | typeof PDA_PAGE_HANDLED_LOCALLY

export function isPdaPageHandledLocally(result: PdaPageEventResult): boolean {
  return result === PDA_PAGE_HANDLED_LOCALLY
}

export function normalizePdaPageEventResult(result: PdaPageEventResult): boolean {
  return Boolean(result)
}
