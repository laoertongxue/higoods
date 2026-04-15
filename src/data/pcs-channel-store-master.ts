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
    storeName: 'IDN-Store-A',
    channelCode: 'tiktok-shop',
    pricingCurrency: 'IDR',
    settlementCurrency: 'IDR',
    linkedProjectStoreIds: ['store-tiktok-01'],
  },
  {
    masterStoreId: 'ST-002',
    storeName: 'VN-Store-B',
    channelCode: 'tiktok-shop',
    pricingCurrency: 'VND',
    settlementCurrency: 'VND',
    linkedProjectStoreIds: ['store-tiktok-02'],
  },
  {
    masterStoreId: 'ST-003',
    storeName: 'MY-Store-C',
    channelCode: 'shopee',
    pricingCurrency: 'MYR',
    settlementCurrency: 'USD',
    linkedProjectStoreIds: ['store-shopee-01'],
  },
  {
    masterStoreId: 'ST-005',
    storeName: 'Global-Store',
    channelCode: 'wechat-mini-program',
    pricingCurrency: 'USD',
    settlementCurrency: 'USD',
    linkedProjectStoreIds: ['store-mini-program-01'],
  },
  {
    masterStoreId: 'ST-006',
    storeName: 'PH-Lazada-Store',
    channelCode: 'lazada',
    pricingCurrency: 'PHP',
    settlementCurrency: 'PHP',
    linkedProjectStoreIds: ['store-lazada-01'],
  },
]

function cloneRecord(record: PcsChannelStoreMasterRecord): PcsChannelStoreMasterRecord {
  return {
    ...record,
    linkedProjectStoreIds: [...record.linkedProjectStoreIds],
  }
}

function normalizeChannelCode(channelCode: string): string {
  const normalized = channelCode.trim().toLowerCase()
  if (!normalized) return ''
  if (normalized === 'tiktok' || normalized === 'tiktok-shop' || normalized === '抖音商城') return 'tiktok-shop'
  if (normalized === 'shopee' || normalized === '虾皮') return 'shopee'
  if (normalized === 'wechat-mini-program' || normalized === '微信小程序') return 'wechat-mini-program'
  if (normalized === 'lazada' || normalized === '来赞达') return 'lazada'
  return normalized
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
  if (normalized === 'wechat-mini-program') return 'USD'
  if (normalized === 'lazada') return 'PHP'
  return 'IDR'
}
