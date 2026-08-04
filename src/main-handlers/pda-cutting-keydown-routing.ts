interface ClosestLookupTarget {
  closest: (selector: string) => unknown
}

const PDA_CUTTING_SCAN_KEYDOWN_SELECTOR = [
  '[data-pda-cut-inbound-field="scanCode"]',
  '[data-pda-cut-inbound-field="locationScan"]',
  '[data-pda-cut-handover-field="bagCode"]',
  '[data-pda-recovery-field="bagCode"]',
  '[data-pda-scrap-field="bagCode"]',
  '[data-pda-repack-field="sourceBag"]',
  '[data-pda-repack-field="sewingTaskNo"]',
  '[data-pda-repack-field="receiverPpicId"]',
  '[data-pda-repack-field="ticket"]',
  '[data-pda-repack-field="resultBag"]',
  '[data-pda-repack-field="returnLocation"]',
  '[data-pda-cut-handover-field="specialCraftReturnLocationScan"]',
].join(', ')

export function resolvePdaCuttingScanKeydownTarget<T = unknown>(
  target: ClosestLookupTarget | null,
  key: string,
): T | null {
  if (key !== 'Enter' || !target) return null
  return target.closest(PDA_CUTTING_SCAN_KEYDOWN_SELECTOR) as T | null
}
