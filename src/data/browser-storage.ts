export interface BrowserStorageLike {
  getItem(key: string): string | null
  setItem?(key: string, value: string): void
  removeItem?(key: string): void
}

export function getBrowserLocalStorage(): BrowserStorageLike | null {
  const storage = typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage
  return typeof storage?.getItem === 'function' ? storage : null
}

export function getBrowserSessionStorage(): BrowserStorageLike | null {
  const storage = typeof globalThis.sessionStorage === 'undefined' ? null : globalThis.sessionStorage
  return typeof storage?.getItem === 'function' ? storage : null
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

export function writeBrowserStorageItem(
  storage: BrowserStorageLike | null | undefined,
  key: string,
  value: string,
): boolean {
  try {
    if (typeof storage?.setItem !== 'function') return false
    storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeBrowserStorageItem(
  storage: BrowserStorageLike | null | undefined,
  key: string,
): boolean {
  try {
    if (typeof storage?.removeItem !== 'function') return false
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}
