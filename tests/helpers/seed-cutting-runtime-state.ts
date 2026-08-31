import { expect, type Page } from '@playwright/test'

export const APF_PDA_SESSION = {
  userId: 'FAC-APF_operator',
  loginId: 'FAC-APF_operator',
  userName: 'APF_-_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'FAC-APF',
  factoryName: 'APF - 辅助工艺',
  loggedAt: '2026-09-01 09:00:00',
}

export const GENERIC_PDA_SESSION = {
  userId: 'ID-F001_operator',
  loginId: 'ID-F001_operator',
  userName: 'PT Sinar Garment Indonesia_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'ID-F001',
  factoryName: 'PT Sinar Garment Indonesia',
  loggedAt: '2026-09-01 09:00:00',
}

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
