import { DEFAULT_PCS_CHANNEL_CODE, normalizePcsChannelCode } from './pcs-channel-options.ts'

export interface PcsChannelStoreMasterRecord {
  masterStoreId: string
  storeName: string
  channelCode: string
  pricingCurrency: string
  settlementCurrency: string
  linkedProjectStoreIds: string[]
}

const STORE_MASTER_RECORDS: PcsChannelStoreMasterRecord[] = [
  {
    masterStoreId: 'ST-001',
    storeName: 'TikTok 印尼主店',
    channelCode: 'tiktok',
    pricingCurrency: 'IDR',
    settlementCurrency: 'IDR',
    linkedProjectStoreIds: ['store-tiktok-01'],
  },
  {
    masterStoreId: 'ST-002',
    storeName: 'TikTok 越南店',
    channelCode: 'tiktok',
    pricingCurrency: 'VND',
    settlementCurrency: 'VND',
    linkedProjectStoreIds: ['store-tiktok-02'],
  },
  {
    masterStoreId: 'ST-003',
    storeName: '虾皮马来西亚店',
    channelCode: 'shopee',
    pricingCurrency: 'MYR',
    settlementCurrency: 'USD',
    linkedProjectStoreIds: ['store-shopee-01'],
  },
  {
    masterStoreId: 'ST-005',
    storeName: '独立站主站',
    channelCode: 'independent-site',
    pricingCurrency: 'USD',
    settlementCurrency: 'USD',
    linkedProjectStoreIds: ['store-independent-01'],
  },
]

function cloneRecord(record: PcsChannelStoreMasterRecord): PcsChannelStoreMasterRecord {
  return {
    ...record,
    linkedProjectStoreIds: [...record.linkedProjectStoreIds],
  }
}

function normalizeChannelCode(channelCode: string): string {
  return normalizePcsChannelCode(channelCode)
}

function findFallbackRecordByChannel(channelCode: string): PcsChannelStoreMasterRecord | null {
  const normalized = normalizeChannelCode(channelCode)
  if (!normalized) return null
  return STORE_MASTER_RECORDS.find((record) => record.channelCode === normalized) || null
}

export function listPcsChannelStoreMasterRecords(): PcsChannelStoreMasterRecord[] {
  return STORE_MASTER_RECORDS.map(cloneRecord)
}

export function findPcsChannelStoreMasterRecord(
  storeIdOrAlias: string | null | undefined,
): PcsChannelStoreMasterRecord | null {
  const normalized = (storeIdOrAlias || '').trim()
  if (!normalized) return null
  return (
    STORE_MASTER_RECORDS.find(
      (record) =>
        record.masterStoreId === normalized ||
        record.linkedProjectStoreIds.includes(normalized),
    ) || null
  )
}

export function listPcsProjectStoreIds(storeIdOrAlias: string | null | undefined): string[] {
  const record = findPcsChannelStoreMasterRecord(storeIdOrAlias)
  return record ? [...record.linkedProjectStoreIds] : []
}

export function getDefaultPcsStoreIdByChannel(channelCode: string): string {
  const record = findFallbackRecordByChannel(channelCode)
  return record?.linkedProjectStoreIds[0] || record?.masterStoreId || ''
}

export function resolvePcsStoreDisplayName(
  storeIdOrAlias: string | null | undefined,
  channelCode = '',
): string {
  const record = findPcsChannelStoreMasterRecord(storeIdOrAlias) || findFallbackRecordByChannel(channelCode)
  if (record) return record.storeName
  return (storeIdOrAlias || '').trim() || '-'
}

export function resolvePcsStoreCurrency(
  storeIdOrAlias: string | null | undefined,
  channelCode = '',
): string {
  const record = findPcsChannelStoreMasterRecord(storeIdOrAlias) || findFallbackRecordByChannel(channelCode)
  if (record) return record.settlementCurrency
  const normalized = normalizeChannelCode(channelCode)
  if (normalized === 'shopee') return 'USD'
  if (normalized === 'independent-site') return 'USD'
  if (normalized === DEFAULT_PCS_CHANNEL_CODE) return 'IDR'
  return 'IDR'
}
