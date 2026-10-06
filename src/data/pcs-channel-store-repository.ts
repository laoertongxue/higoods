import { pcsRecordStore, registerPcsRepositoryReset } from './pcs-record-runtime.ts'
import type { ChannelStore, ChannelStoreSnapshot, ChannelCode } from './pcs-channel-catalog-types.ts'
import { getProjectCreateCatalog } from './pcs-project-repository.ts'
import { getChannelPlatformTemplate, validateChannelPlatformTemplate } from './pcs-channel-platform-template.ts'
export const PCS_CHANNEL_STORE_KEY = 'higood-pcs-channel-store-v1'
export const CURRENT_CHANNELS: Array<{ code: ChannelCode; name: string }> = [
  { code: 'shopify', name: 'Shopify' }, { code: 'tiktok', name: 'TikTok' }, { code: 'independent-site', name: '独立站' },
]
export const CURRENT_MARKETS = [{ code: 'ID', name: '印度尼西亚', currency: 'IDR', language: 'id', zone: 'Asia/Jakarta' }, { code: 'MY', name: '马来西亚', currency: 'MYR', language: 'ms', zone: 'Asia/Kuala_Lumpur' }]
const historicLabels: Record<string, string> = { shopee: 'Shopee', lazada: 'Lazada', shopxo: 'shopxo', shopline: '店匠' }
export function channelLabel(code: string): string { return CURRENT_CHANNELS.find(x => x.code === code)?.name || historicLabels[code] || code }
export function isCurrentChannelStore(store: ChannelStore): boolean { return CURRENT_CHANNELS.some(x => x.code === store.channelCode) && CURRENT_MARKETS.some(x => x.code === store.marketCode) }
export function isChannelStorePublishable(store: ChannelStore): boolean { return isCurrentChannelStore(store) && store.operatingStatus === '启用' && store.allowListing }
/** 只引用已有的人员、团队选择目录，不建立商品开发项目关系。 */
export function getChannelResponsibilityOptions(): { owners: Array<{ id: string; name: string }>; teams: Array<{ id: string; name: string }> } {
  const catalog = getProjectCreateCatalog()
  return { owners: catalog.owners.map(value => ({ ...value })), teams: catalog.teams.map(value => ({ ...value })) }
}
export function channelResponsibilityName(kind: 'owners' | 'teams', id: string): string { return getChannelResponsibilityOptions()[kind].find(value => value.id === id)?.name || id }
function seed(): ChannelStoreSnapshot {
  const records: Array<[string, string, ChannelCode, string, string[]]> = [
    ['ST-001', 'TikTok 印尼主店', 'tiktok', 'ID', ['store-tiktok-01']], ['ST-006', 'TikTok 马来西亚店', 'tiktok', 'MY', []],
    ['ST-007', 'Shopify 印尼店', 'shopify', 'ID', []], ['ST-008', 'Shopify 马来西亚店', 'shopify', 'MY', []],
    ['ST-005', '独立站演示店铺 · 印尼', 'independent-site', 'ID', ['store-independent-01']], ['ST-009', '独立站演示店铺 · 马来西亚', 'independent-site', 'MY', []],
    ['ST-002', 'TikTok 越南店（历史）', 'tiktok', 'VN', ['store-tiktok-02']], ['ST-003', 'Shopee 马来西亚店（历史）', 'shopee', 'MY', ['store-shopee-01']],
  ]
  const people = getChannelResponsibilityOptions()
  return { version: 1, stores: records.map(([id, storeName, channelCode, marketCode, legacyAliases], i) => {
    const market = CURRENT_MARKETS.find(m => m.code === marketCode)
    return { id, storeCode: id, storeName, channelCode, marketCode, externalStoreId: `demo-store-${101 + i}`, salesCurrency: market?.currency || 'VND', settlementCurrency: i === 3 ? 'CNY' : market?.currency || 'VND', languageCode: market?.language || 'vi', timeZone: market?.zone || 'Asia/Ho_Chi_Minh', ownerId: people.owners[i % people.owners.length].id, teamId: people.teams[0].id, operatingStatus: i < 6 ? '启用' : '停用', inventorySource: 'WMS_SHARED', connectionDescription: '原型演示店铺；未连接真实平台 API', allowListing: i < 6, defaultCategoryId: 'apparel', handlingDays: 3, legacyAliases, version: 1, createdAt: '2026-10-05T01:00:00Z', updatedAt: '2026-10-05T01:00:00Z', updatedBy: '演示资料' } satisfies ChannelStore
  }), logs: [] }
}
let cache: ChannelStoreSnapshot | null = null
let cachedRaw: string | null = null
export function resetPcsChannelStoreCache(): void { cache = null; cachedRaw = null }
registerPcsRepositoryReset(resetPcsChannelStoreCache)
export function getPcsChannelStoreSnapshot(): ChannelStoreSnapshot {
  const raw = pcsRecordStore.getItem(PCS_CHANNEL_STORE_KEY)
  if (!cache || raw !== cachedRaw) {
    const value = raw ? JSON.parse(raw) : seed()
    if (!Array.isArray(value.stores) || !Array.isArray(value.logs)) throw new Error('店铺资料格式不完整，原记录已保留。请重新读取。')
    cache = value; cachedRaw = raw
  }
  return structuredClone(cache!)
}
export function writePcsChannelStoreSnapshot(snapshot: ChannelStoreSnapshot): void {
  pcsRecordStore.setItem(PCS_CHANNEL_STORE_KEY, JSON.stringify(snapshot)); resetPcsChannelStoreCache()
}
export function listChannelStores(includeHistory = false): ChannelStore[] { return getPcsChannelStoreSnapshot().stores.filter(s => includeHistory || isCurrentChannelStore(s)) }
export function getChannelStore(id: string): ChannelStore | null { return getPcsChannelStoreSnapshot().stores.find(s => s.id === id || s.legacyAliases.includes(id)) || null }
export function saveChannelStore(input: Omit<ChannelStore, 'version' | 'createdAt' | 'updatedAt' | 'updatedBy'>, expectedVersion: number, actor = '当前用户'): ChannelStore {
  const snapshot = getPcsChannelStoreSnapshot(), previous = snapshot.stores.find(s => s.id === input.id)
  if (previous && previous.version !== expectedVersion) throw new Error('店铺已被其他操作修改，请重新读取后保存。')
  if (previous && !isCurrentChannelStore(previous)) throw new Error('历史渠道或市场只支持查询。')
  if (!CURRENT_CHANNELS.some(x => x.code === input.channelCode) || !CURRENT_MARKETS.some(x => x.code === input.marketCode)) throw new Error('新建店铺仅支持 Shopify、TikTok、独立站及 ID、MY 市场。')
  if (typeof input.externalStoreId !== 'string') throw new Error('平台店铺 ID 必须按文本保存原值。')
  if (![input.storeCode, input.storeName, input.ownerId, input.languageCode, input.salesCurrency, input.settlementCurrency, input.timeZone].every(x => x.trim())) throw new Error('请完整填写店铺编码、名称、负责人、语言、时区和两种币种。')
  const people = getChannelResponsibilityOptions()
  if (!people.owners.some(value => value.id === input.ownerId)) throw new Error('请从已有人员资料选择负责人。')
  if (input.teamId && !people.teams.some(value => value.id === input.teamId)) throw new Error('请从已有团队资料选择运营团队。')
  if (snapshot.stores.some(s => s.id !== input.id && (s.storeCode === input.storeCode || (input.externalStoreId && s.channelCode === input.channelCode && s.externalStoreId === input.externalStoreId)))) throw new Error('店铺编码或该渠道的外部店铺 ID 已存在。')
  if (previous && [previous.storeCode !== input.storeCode, previous.channelCode !== input.channelCode, previous.marketCode !== input.marketCode, previous.salesCurrency !== input.salesCurrency].some(Boolean)) throw new Error('店铺编码、渠道、市场和销售币种形成经营身份，已使用的店铺请保留原值并另建新店铺。')
  if (!Number.isInteger(input.handlingDays) || input.handlingDays < 0) throw new Error('备货天数须为非负整数。')
  const at = new Date().toISOString(), next = { ...input, inventorySource: 'WMS_SHARED' as const, version: (previous?.version || 0) + 1, createdAt: previous?.createdAt || at, updatedAt: at, updatedBy: actor }
  if (input.platformTemplate) {
    validateChannelPlatformTemplate(input.platformTemplate)
    const prior = getChannelPlatformTemplate(previous || { ...next, platformTemplate: undefined }), incoming = structuredClone(input.platformTemplate)
    const changed = JSON.stringify({ ...incoming, version: 0 }) !== JSON.stringify({ ...prior, version: 0 })
    incoming.version = changed ? prior.version + 1 : prior.version
    next.platformTemplate = previous?.platformTemplate || changed ? incoming : undefined
  }
  snapshot.stores = [...snapshot.stores.filter(s => s.id !== next.id), next]
  snapshot.logs.push({ id: crypto.randomUUID(), objectId: next.id, action: previous ? '修改店铺' : '新建店铺', actor, at, detail: `${next.storeName}；销售 ${next.salesCurrency} / 结算 ${next.settlementCurrency}`, source: 'PCS' })
  if (JSON.stringify(previous?.platformTemplate) !== JSON.stringify(next.platformTemplate)) snapshot.logs.push({ id: crypto.randomUUID(), objectId: next.id, action: '调整平台字段模板', actor, at, detail: `模板第 ${next.platformTemplate?.version || 1} 版；必填字段与初始化映射在新建、审核及发布时使用，既有刊登内容保留。`, source: 'PCS' })
  if (previous && (previous.ownerId !== next.ownerId || previous.teamId !== next.teamId)) {
    const label = (kind: 'owners' | 'teams', id: string) => `${people[kind].find(value => value.id === id)?.name || id || '未设置'}（${id || '—'}）`
    snapshot.logs.push({ id: crypto.randomUUID(), objectId: next.id, action: '变更店铺负责人与团队', actor, at, detail: `负责人：${label('owners', previous.ownerId)} → ${label('owners', next.ownerId)}；团队：${label('teams', previous.teamId)} → ${label('teams', next.teamId)}`, source: 'PCS' })
  }
  writePcsChannelStoreSnapshot(snapshot); return next
}
export function setChannelStoreOperatingStatus(id: string, status: '启用' | '停用', actor = '当前用户'): ChannelStore {
  const store = getChannelStore(id); if (!store) throw new Error('店铺不存在。')
  return saveChannelStore({ ...store, operatingStatus: status }, store.version, actor)
}
