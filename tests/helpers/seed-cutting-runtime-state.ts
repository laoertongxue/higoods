import { expect, type Page } from '@playwright/test'

function serializeStorageValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

export async function seedLocalStorage(page: Page, entries: Record<string, unknown>): Promise<void> {
  const pairs = Object.entries(entries).map(
    ([key, value]) => [key, serializeStorageValue(value)] as const,
  )
  await page.addInitScript((serializedEntries) => {
    serializedEntries.forEach(([key, value]) => {
      window.localStorage.setItem(key, value)
    })
  }, pairs)
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
