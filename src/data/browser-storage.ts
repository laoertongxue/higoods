export interface BrowserStorageLike {
  getItem(key: string): string | null
  setItem?(key: string, value: string): void
}

export function getBrowserLocalStorage(): BrowserStorageLike | null {
  return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage
}

export function getBrowserSessionStorage(): BrowserStorageLike | null {
  return typeof globalThis.sessionStorage === 'undefined' ? null : globalThis.sessionStorage
}

export function readBrowserStorageItem(
  storage: BrowserStorageLike | null | undefined,
  key: string,
): string | null {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}
