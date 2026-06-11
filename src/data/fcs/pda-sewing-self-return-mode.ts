export const PDA_SEWING_SELF_RETURN_MODE_ROUTE = '/fcs/pda/handover/sewing-self-return'

interface PdaSewingSelfReturnModeLock {
  active: boolean
  factoryId: string
  factoryName: string
  openedBy: string
  openedAt: string
}

const PDA_SEWING_SELF_RETURN_MODE_KEY = 'higoods-pda-sewing-self-return-mode'
let fallbackLock: PdaSewingSelfReturnModeLock | null = null

function nowText(): string {
  return new Date().toISOString().slice(0, 16).replace('T', ' ')
}

function cloneLock(lock: PdaSewingSelfReturnModeLock | null): PdaSewingSelfReturnModeLock | null {
  return lock ? { ...lock } : null
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export function getPdaSewingSelfReturnModeLock(): PdaSewingSelfReturnModeLock | null {
  const storage = getStorage()
  if (!storage) return cloneLock(fallbackLock)
  try {
    const raw = storage.getItem(PDA_SEWING_SELF_RETURN_MODE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PdaSewingSelfReturnModeLock>
    if (!parsed.active || !parsed.factoryId) return null
    return {
      active: true,
      factoryId: String(parsed.factoryId),
      factoryName: String(parsed.factoryName || ''),
      openedBy: String(parsed.openedBy || ''),
      openedAt: String(parsed.openedAt || ''),
    }
  } catch {
    return null
  }
}

export function isPdaSewingSelfReturnModeLocked(): boolean {
  return Boolean(getPdaSewingSelfReturnModeLock()?.active)
}

export function activatePdaSewingSelfReturnMode(input: {
  factoryId: string
  factoryName: string
  openedBy: string
}): PdaSewingSelfReturnModeLock {
  const next: PdaSewingSelfReturnModeLock = {
    active: true,
    factoryId: input.factoryId,
    factoryName: input.factoryName,
    openedBy: input.openedBy,
    openedAt: nowText(),
  }
  const storage = getStorage()
  if (storage) storage.setItem(PDA_SEWING_SELF_RETURN_MODE_KEY, JSON.stringify(next))
  else fallbackLock = next
  return cloneLock(next)!
}

export function clearPdaSewingSelfReturnMode(): void {
  const storage = getStorage()
  if (storage) storage.removeItem(PDA_SEWING_SELF_RETURN_MODE_KEY)
  fallbackLock = null
}

export function shouldBlockPdaRouteBySewingSelfReturnMode(pathname: string): boolean {
  if (!isPdaSewingSelfReturnModeLocked()) return false
  const normalized = pathname.split('#')[0].split('?')[0] || '/'
  if (!normalized.startsWith('/fcs/pda')) return false
  if (normalized === PDA_SEWING_SELF_RETURN_MODE_ROUTE) return false
  if (normalized === '/fcs/pda/auth/login' || normalized === '/fcs/pda/auth/onboarding') return false
  return true
}
