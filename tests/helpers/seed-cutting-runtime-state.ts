import { expect, type Page } from '@playwright/test'

export const CUTTING_MERGE_BATCH_LEDGER_STORAGE_KEY = 'cuttingMergeBatchLedger'
export const CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY = 'cuttingMarkerSpreadingLedger'

function serializeStorageValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

export async function seedLocalStorage(page: Page, entries: Record<string, unknown>): Promise<void> {
  const serializedEntries = Object.entries(entries).map(([key, value]) => [key, serializeStorageValue(value)] as const)
  await page.addInitScript((pairs) => {
    pairs.forEach(([key, value]) => {
      window.localStorage.setItem(key, value)
    })
  }, serializedEntries)
}

export async function seedMergeBatchLedger(page: Page, ledger: unknown): Promise<void> {
  await seedLocalStorage(page, {
    [CUTTING_MERGE_BATCH_LEDGER_STORAGE_KEY]: ledger,
  })
}

export async function seedMarkerSpreadingLedger(page: Page, ledger: unknown): Promise<void> {
  await seedLocalStorage(page, {
    [CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY]: ledger,
  })
}

export function collectPageErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })
  return errors
}

export async function expectNoPageErrors(errors: string[]): Promise<void> {
  expect(errors).toEqual([])
}
