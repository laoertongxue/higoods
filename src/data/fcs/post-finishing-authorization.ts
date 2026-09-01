export type PostFinishingAuthorizationStage = '回货确认' | '质检' | '后道' | '复检' | '仓库收货'

export interface PostFinishingAuthorizedPerson {
  authorizerId: string
  authorizerName: string
  roleName: string
  secret: string
}

export interface PostFinishingAuthorizationDisplay {
  authorizerId: string
  authorizerName: string
  roleName: string
  code: string
  scanPayload: string
  timeSlot: number
  validFromMs: number
  validUntilMs: number
  remainingSeconds: number
}

export interface PostFinishingAuthorizationConsumption {
  authorizationId: string
  tokenFingerprint: string
  authorizerId: string
  authorizerName: string
  stage: PostFinishingAuthorizationStage
  businessObjectId: string
  businessObjectNo: string
  differenceFingerprint: string
  differenceReason: string
  operatorId: string
  operatorName: string
  consumedAt: string
}

export type PostFinishingAuthorizationErrorCode =
  | 'INVALID_FORMAT'
  | 'NOT_AUTHORIZED_PERSON'
  | 'INVALID_CODE'
  | 'EXPIRED'
  | 'ALREADY_USED'
  | 'MISSING_REASON'

export class PostFinishingAuthorizationError extends Error {
  constructor(public readonly code: PostFinishingAuthorizationErrorCode, message: string) {
    super(message)
    this.name = 'PostFinishingAuthorizationError'
  }
}

export interface ConsumePostFinishingAuthorizationInput {
  scanValue: string
  authorizerId?: string
  stage: PostFinishingAuthorizationStage
  businessObjectId: string
  businessObjectNo: string
  differenceFingerprint: string
  differenceReason: string
  operatorId: string
  operatorName: string
  nowMs?: number
}

const STORAGE_KEY = 'higood-fcs-post-finishing-authorization-consumptions-v1'
const TIME_WINDOW_MS = 30_000
export const POST_FINISHING_AUTHORIZED_IDENTITY_STORAGE_KEY = 'higood-fcs-post-finishing-current-authorizer-v1'
const NO_AUTHORIZED_IDENTITY = 'NONE'

const AUTHORIZED_PEOPLE: PostFinishingAuthorizedPerson[] = [
  { authorizerId: 'AUTH-QC-001', authorizerName: '林质检主管', roleName: 'QC主管', secret: 'PF-QC-31' },
  { authorizerId: 'AUTH-POST-001', authorizerName: '周后道经理', roleName: '后道经理', secret: 'PF-POST-57' },
  { authorizerId: 'AUTH-WH-001', authorizerName: '陈仓库主管', roleName: '仓库主管', secret: 'PF-WH-83' },
]

function readPersistedConsumptions(): PostFinishingAuthorizationConsumption[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as PostFinishingAuthorizationConsumption[] : []
  } catch {
    return []
  }
}

let consumptions = readPersistedConsumptions()

function persist(): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(consumptions))
  } catch {
    // 原型无 localStorage 时保留运行期授权消费事实。
  }
}

function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function codeFor(person: PostFinishingAuthorizedPerson, timeSlot: number): string {
  return String(stableHash(`${person.secret}:${timeSlot}`) % 1_000_000).padStart(6, '0')
}

function tokenFingerprint(authorizerId: string, timeSlot: number, code: string): string {
  return stableHash(`${authorizerId}:${timeSlot}:${code}`).toString(16).padStart(8, '0')
}

export function buildPostFinishingDifferenceFingerprint(input: {
  stage: PostFinishingAuthorizationStage
  businessObjectId: string
  quantities: Array<{ skuId: string; expectedQty: number; actualQty: number }>
  reason: string
}): string {
  const lines = [...input.quantities]
    .sort((a, b) => a.skuId.localeCompare(b.skuId))
    .map((line) => `${line.skuId}:${line.expectedQty}:${line.actualQty}`)
    .join('|')
  return stableHash(`${input.stage}:${input.businessObjectId}:${lines}:${input.reason.trim()}`).toString(16).padStart(8, '0')
}

export function listPostFinishingAuthorizedPeople(): Array<Omit<PostFinishingAuthorizedPerson, 'secret'>> {
  return AUTHORIZED_PEOPLE.map(({ secret: _secret, ...person }) => ({ ...person }))
}

export function getCurrentPostFinishingAuthorizedPerson(): Omit<PostFinishingAuthorizedPerson, 'secret'> | undefined {
  let storedId = ''
  try {
    storedId = globalThis.localStorage?.getItem(POST_FINISHING_AUTHORIZED_IDENTITY_STORAGE_KEY) || ''
  } catch {
    // 原型存储不可用时不展示授权码，避免把授权身份兜底给普通人员。
  }
  if (!storedId || storedId === NO_AUTHORIZED_IDENTITY) return undefined
  const person = AUTHORIZED_PEOPLE.find((item) => item.authorizerId === storedId)
  if (!person) return undefined
  const { secret: _secret, ...publicPerson } = person
  return { ...publicPerson }
}

export function setCurrentPostFinishingAuthorizedPersonForPrototype(authorizerId?: string): void {
  if (authorizerId && !AUTHORIZED_PEOPLE.some((item) => item.authorizerId === authorizerId)) {
    throw new PostFinishingAuthorizationError('NOT_AUTHORIZED_PERSON', '当前人员不在授权名单中。')
  }
  try {
    globalThis.localStorage?.setItem(
      POST_FINISHING_AUTHORIZED_IDENTITY_STORAGE_KEY,
      authorizerId || NO_AUTHORIZED_IDENTITY,
    )
  } catch {
    // 原型存储不可用时不模拟身份切换。
  }
}

export function getPostFinishingAuthorizationDisplay(
  authorizerId: string,
  nowMs = Date.now(),
): PostFinishingAuthorizationDisplay {
  const person = AUTHORIZED_PEOPLE.find((item) => item.authorizerId === authorizerId)
  if (!person) throw new PostFinishingAuthorizationError('NOT_AUTHORIZED_PERSON', '当前人员不在授权名单中。')
  const timeSlot = Math.floor(nowMs / TIME_WINDOW_MS)
  const validFromMs = timeSlot * TIME_WINDOW_MS
  const validUntilMs = validFromMs + TIME_WINDOW_MS
  const code = codeFor(person, timeSlot)
  return {
    authorizerId: person.authorizerId,
    authorizerName: person.authorizerName,
    roleName: person.roleName,
    code,
    scanPayload: `PFAUTH:${person.authorizerId}:${timeSlot}:${code}`,
    timeSlot,
    validFromMs,
    validUntilMs,
    remainingSeconds: Math.max(0, Math.ceil((validUntilMs - nowMs) / 1000)),
  }
}

function parseScanValue(scanValue: string, fallbackAuthorizerId: string | undefined, nowMs: number): {
  authorizerId: string
  timeSlot: number
  code: string
} {
  const normalized = scanValue.trim()
  const payloadMatch = normalized.match(/^PFAUTH:([^:]+):(\d+):(\d{6})$/)
  if (payloadMatch) {
    return {
      authorizerId: payloadMatch[1],
      timeSlot: Number(payloadMatch[2]),
      code: payloadMatch[3],
    }
  }
  if (/^\d{6}$/.test(normalized) && fallbackAuthorizerId) {
    return {
      authorizerId: fallbackAuthorizerId,
      timeSlot: Math.floor(nowMs / TIME_WINDOW_MS),
      code: normalized,
    }
  }
  throw new PostFinishingAuthorizationError('INVALID_FORMAT', '授权码格式错误，请重新扫描完整授权码。')
}

export function consumePostFinishingAuthorization(
  input: ConsumePostFinishingAuthorizationInput,
): PostFinishingAuthorizationConsumption {
  if (!input.differenceReason.trim()) {
    throw new PostFinishingAuthorizationError('MISSING_REASON', '存在数量差异时必须填写差异原因。')
  }
  const nowMs = input.nowMs ?? Date.now()
  const parsed = parseScanValue(input.scanValue, input.authorizerId, nowMs)
  const person = AUTHORIZED_PEOPLE.find((item) => item.authorizerId === parsed.authorizerId)
  if (!person) throw new PostFinishingAuthorizationError('NOT_AUTHORIZED_PERSON', '该人员没有差异授权权限。')

  const currentSlot = Math.floor(nowMs / TIME_WINDOW_MS)
  if (parsed.timeSlot !== currentSlot) {
    throw new PostFinishingAuthorizationError('EXPIRED', '授权码已过期，请联系授权人获取最新授权码。')
  }
  if (codeFor(person, parsed.timeSlot) !== parsed.code) {
    throw new PostFinishingAuthorizationError('INVALID_CODE', '授权码无效，请重新扫描。')
  }
  const fingerprint = tokenFingerprint(person.authorizerId, parsed.timeSlot, parsed.code)
  if (consumptions.some((record) => record.tokenFingerprint === fingerprint)) {
    throw new PostFinishingAuthorizationError('ALREADY_USED', '授权码已使用，请联系授权人获取新授权码。')
  }
  const consumption: PostFinishingAuthorizationConsumption = {
    authorizationId: `PF-AUTH-${String(consumptions.length + 1).padStart(6, '0')}`,
    tokenFingerprint: fingerprint,
    authorizerId: person.authorizerId,
    authorizerName: person.authorizerName,
    stage: input.stage,
    businessObjectId: input.businessObjectId,
    businessObjectNo: input.businessObjectNo,
    differenceFingerprint: input.differenceFingerprint,
    differenceReason: input.differenceReason.trim(),
    operatorId: input.operatorId,
    operatorName: input.operatorName,
    consumedAt: new Date(nowMs).toISOString(),
  }
  consumptions.push(consumption)
  persist()
  return { ...consumption }
}

export function listPostFinishingAuthorizationConsumptions(): PostFinishingAuthorizationConsumption[] {
  return consumptions.map((record) => ({ ...record }))
}

export function resetPostFinishingAuthorizationConsumptions(): void {
  consumptions = []
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY)
  } catch {
    // 忽略原型存储不可用。
  }
}

export const POST_FINISHING_AUTHORIZATION_WINDOW_MS = TIME_WINDOW_MS
