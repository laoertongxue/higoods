import { readFactoryPdaExecutionUsers, type FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import type { CentralPdaLanguage } from './frame.ts'

const preferenceKey = 'higood.central-pda.preferences.v1'
type Preference = { language?: CentralPdaLanguage; factoryId?: string; operationId?: string; accountId?: string; signedOut?: boolean }
function readPreference(): Preference {
  try {
    const raw = localStorage.getItem(preferenceKey)
    if (!raw || raw.length > 4096) return {}
    const value = JSON.parse(raw)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch { return {} }
}
const preference = readPreference()
/** One device account and language across the independent process pages.
 * Quantities, form fields and drafts never enter this bounded preference. */
export const centralSession = {
  preference, language: (preference.language === 'id' ? 'id' : 'zh') as CentralPdaLanguage,
  currentFactory: '', currentOperation: '', account: undefined as FactoryPdaUser | undefined,
  signedOut: preference.signedOut === true,
}
export function saveCentralSessionPreference() {
  const { language, currentFactory, currentOperation, account, signedOut } = centralSession
  centralSession.preference = { language, factoryId: currentFactory, operationId: currentOperation, accountId: account?.userId, signedOut }
  try { localStorage.setItem(preferenceKey, JSON.stringify(centralSession.preference)) } catch { /* Display preferences use defaults on failure. */ }
}
export function ensureCentralSessionAccount(factoryId: string) {
  if (centralSession.currentFactory !== factoryId) centralSession.account = undefined
  centralSession.currentFactory = factoryId
  if (!centralSession.signedOut && (!centralSession.account || centralSession.account.factoryId !== factoryId)) {
    const users = readFactoryPdaExecutionUsers(factoryId).filter(user => user.status === 'ACTIVE')
    centralSession.account = users.find(user => user.userId === centralSession.preference.accountId) || users.find(user => user.roleId === 'ROLE_ADMIN')
  }
  return centralSession.account
}
const discarders = new Set<() => void>()
const draftReaders = new Set<() => boolean>()
export function registerCentralDraftDiscard(discard: () => void, hasDraft?: () => boolean) { discarders.add(discard); if (hasDraft) draftReaders.add(hasDraft) }
export function discardCentralDrafts() { discarders.forEach(discard => discard()) }
export function hasCentralDrafts() { return [...draftReaders].some(read => read()) }
