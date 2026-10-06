/** 旧调用者只读投影；店铺事实仅由 pcs-channel-store-repository 维护。 */
import { getChannelStore, listChannelStores, isChannelStorePublishable } from './pcs-channel-store-repository.ts'
import { normalizePcsChannelCode } from './pcs-channel-options.ts'
export interface PcsChannelStoreMasterRecord { masterStoreId: string; storeName: string; channelCode: string; pricingCurrency: string; settlementCurrency: string; linkedProjectStoreIds: string[] }
function project(record: NonNullable<ReturnType<typeof getChannelStore>>): PcsChannelStoreMasterRecord { return { masterStoreId: record.id, storeName: record.storeName, channelCode: record.channelCode, pricingCurrency: record.salesCurrency, settlementCurrency: record.settlementCurrency, linkedProjectStoreIds: [...record.legacyAliases] } }
export function listPcsChannelStoreMasterRecords(): PcsChannelStoreMasterRecord[] { return listChannelStores(true).map(project) }
export function findPcsChannelStoreMasterRecord(id: string | null | undefined): PcsChannelStoreMasterRecord | null { const record = getChannelStore(id || ''); return record ? project(record) : null }
export function listPcsProjectStoreIds(id: string | null | undefined): string[] { const record = getChannelStore(id || ''); return record ? [record.id, ...record.legacyAliases] : [] }
export function getDefaultPcsStoreIdByChannel(channelCode: string): string { return listChannelStores().find(s => s.channelCode === normalizePcsChannelCode(channelCode) && isChannelStorePublishable(s))?.id || '' }
export function resolvePcsStoreDisplayName(id: string | null | undefined, channelCode = ''): string { return getChannelStore(id || getDefaultPcsStoreIdByChannel(channelCode))?.storeName || id || '-' }
export function resolvePcsStoreCurrency(id: string | null | undefined, channelCode = ''): string { return getChannelStore(id || getDefaultPcsStoreIdByChannel(channelCode))?.salesCurrency || '' }
