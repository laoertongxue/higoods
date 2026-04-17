import { appStore } from '../state/store.ts'
import { listPcsProjectStoreIds } from '../data/pcs-channel-store-master.ts'
import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'

type StoreStatus = 'ACTIVE' | 'INACTIVE'
type AuthStatus = 'CONNECTED' | 'EXPIRED' | 'ERROR'
type OwnerType = 'PERSONAL' | 'LEGAL'
type SyncTabKey = 'product' | 'order'
type StoreDetailTabKey = 'overview' | 'auth' | 'policies' | 'payout' | 'sync' | 'logs'
type PayoutDetailTabKey = 'overview' | 'stores' | 'attachments'
type PayoutStatus = 'ACTIVE' | 'INACTIVE'

interface LegalEntity {
  id: string
  name: string
  country: string
}

interface StoreLog {
  time: string
  action: string
  operator: string
  detail: string
}

interface PayoutBinding {
  id: string
  payoutAccountId: string
  payoutAccountName: string
  payoutIdentifier: string
  ownerType: OwnerType
  ownerName: string
  effectiveFrom: string
  effectiveTo: string | null
  changeReason: string
  changedBy: string
  changedAt: string
}

interface StorePolicyConfig {
  allowListing: boolean
  inventorySyncMode: string
  safetyStock: number
  handlingTime: number
  defaultCategoryId: string
}

interface ChannelStoreRecord {
  id: string
  channel: string
  storeName: string
  storeCode: string
  platformStoreId: string | null
  country: string
  region: string
  pricingCurrency: string
  settlementCurrency: string
  timezone: string
  status: StoreStatus
  authStatus: AuthStatus
  tokenExpireAt: string | null
  lastRefreshAt: string | null
  storeOwner: string
  team: string
  reviewer: string
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  projectStoreIds: string[]
  policies: StorePolicyConfig
  bindings: PayoutBinding[]
  logs: StoreLog[]
}

interface PayoutAccountRecord {
  id: string
  name: string
  payoutChannel: string
  identifierMasked: string
  ownerType: OwnerType
  ownerRefId: string
  ownerName: string
  country: string
  currency: string
  status: PayoutStatus
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  logs: StoreLog[]
}

interface SyncErrorRecord {
  id: string
  type: SyncTabKey
  storeId: string
  storeName: string
  objectId: string
  objectName: string
  errorType: string
  errorMsg: string
  time: string
  status: string
}

interface StoreCreateDraft {
  channel: string
  storeName: string
  storeCode: string
  platformStoreId: string
  country: string
  settlementCurrency: string
  timezone: string
  team: string
  storeOwner: string
}

interface StoreEditDraft {
  storeName: string
  storeOwner: string
  team: string
  reviewer: string
}

interface StorePolicyDraft {
  routeKey: string
  storeId: string | null
  allowListing: boolean
  inventorySyncMode: string
  safetyStock: string
  handlingTime: string
  defaultCategoryId: string
}

interface PayoutCreateDraft {
  name: string
  payoutChannel: string
  identifier: string
  ownerType: OwnerType | ''
  ownerRefId: string
  country: string
  currency: string
}

interface ChannelStoresPageState {
  notice: string | null
  storeList: {
    search: string
    channel: string
    country: string
    status: string
    linkedOnly: boolean
    authStatus: string
    ownerType: string
    legalEntity: string
  }
  storeCreateDrawerOpen: boolean
  storeCreateDraft: StoreCreateDraft
  storeDetail: {
    routeKey: string
    storeId: string | null
    activeTab: StoreDetailTabKey
  }
  storeEditDrawer: {
    open: boolean
    storeId: string
    draft: StoreEditDraft
  }
  storePolicyDraft: StorePolicyDraft
  storeAuthDialog: {
    open: boolean
    storeId: string
    step: 1 | 2 | 3
    method: 'oauth' | 'token'
    tokenInput: string
    tokenExpireAt: string
  }
  storePayoutDialog: {
    open: boolean
    storeId: string
    payoutAccountId: string
    effectiveFrom: string
    changeReason: string
  }
  storeBindingHistoryDialog: {
    open: boolean
    storeId: string
  }
  syncPage: {
    routeKey: string
    activeTab: SyncTabKey
    search: string
    storeFilter: string
    statusFilter: string
  }
  payoutList: {
    search: string
    ownerType: string
    legalEntity: string
    country: string
    status: string
  }
  payoutCreateDrawerOpen: boolean
  payoutCreateDraft: PayoutCreateDraft
  payoutDetail: {
    routeKey: string
    accountId: string | null
    activeTab: PayoutDetailTabKey
  }
}

const STORE_STATUS_META: Record<StoreStatus, { label: string; className: string }> = {
  ACTIVE: { label: '启用', className: 'bg-green-100 text-green-700' },
  INACTIVE: { label: '停用', className: 'bg-slate-100 text-slate-500' },
}

const AUTH_STATUS_META: Record<AuthStatus, { label: string; className: string }> = {
  CONNECTED: { label: '已连接', className: 'bg-green-100 text-green-700' },
  EXPIRED: { label: '已过期', className: 'bg-yellow-100 text-yellow-700' },
  ERROR: { label: '连接错误', className: 'bg-red-100 text-red-700' },
}

const OWNER_TYPE_META: Record<OwnerType, { label: string; className: string; icon: string }> = {
  PERSONAL: { label: '个人', className: 'bg-blue-100 text-blue-700', icon: 'user' },
  LEGAL: { label: '法人', className: 'bg-violet-100 text-violet-700', icon: 'building-2' },
}

const PAYOUT_STATUS_META: Record<PayoutStatus, { label: string; className: string }> = {
  ACTIVE: { label: '启用', className: 'bg-green-100 text-green-700' },
  INACTIVE: { label: '停用', className: 'bg-slate-100 text-slate-500' },
}

const LEGAL_ENTITIES: LegalEntity[] = [
  { id: 'LE-001', name: 'HiGOOD LIVE Limited', country: '香港' },
  { id: 'LE-002', name: 'PT HIGOOD LIVE JAKARTA', country: '印尼' },
]

const CHANNEL_OPTIONS = ['TikTok', 'Shopee', 'Lazada', '独立站']
const STORE_COUNTRY_OPTIONS = ['印尼', '越南', '马来西亚', '菲律宾', '全球']
const ACCOUNT_COUNTRY_OPTIONS = [
  { code: 'HK', label: '香港' },
  { code: 'ID', label: '印尼' },
  { code: 'VN', label: '越南' },
  { code: 'MY', label: '马来西亚' },
]
const CURRENCY_OPTIONS = ['USD', 'IDR', 'VND', 'MYR', 'PHP']
const STORE_TEAM_OPTIONS = [
  {
    team: '东南亚运营组',
    owners: ['李运营', '王运营', '苏运营', '赵运营', '何运营'],
  },
  {
    team: '独立站运营组',
    owners: ['周运营'],
  },
  {
    team: '渠道运营组',
    owners: ['陈运营', '张运营'],
  },
]
const PAYOUT_CHANNEL_OPTIONS = ['平台内提现', '银行转账', 'PSP']
const INVENTORY_SYNC_OPTIONS = [
  { value: 'AVAILABLE_TO_SELL', label: '可售库存 (ATS)' },
  { value: 'ON_HAND', label: '在库库存' },
  { value: 'MANUAL', label: '手动管理' },
]

const STORE_DETAIL_TABS: Array<{ key: StoreDetailTabKey; label: string }> = [
  { key: 'overview', label: '基本信息' },
  { key: 'auth', label: '授权与连接' },
  { key: 'policies', label: '上架策略' },
  { key: 'payout', label: '提现账号绑定' },
  { key: 'sync', label: '同步与数据' },
  { key: 'logs', label: '日志与附件' },
]

const PAYOUT_DETAIL_TABS: Array<{ key: PayoutDetailTabKey; label: string }> = [
  { key: 'overview', label: '基本信息' },
  { key: 'stores', label: '关联店铺' },
  { key: 'attachments', label: '附件与日志' },
]

const initialStoreCreateDraft: StoreCreateDraft = {
  channel: '',
  storeName: '',
  storeCode: '',
  platformStoreId: '',
  country: '',
  settlementCurrency: '',
  timezone: '',
  team: '',
  storeOwner: '',
}

const initialPayoutCreateDraft: PayoutCreateDraft = {
  name: '',
  payoutChannel: '',
  identifier: '',
  ownerType: '',
  ownerRefId: '',
  country: '',
  currency: '',
}

const state: ChannelStoresPageState = {
  notice: null,
  storeList: {
    search: '',
    channel: 'all',
    country: 'all',
    status: 'all',
    linkedOnly: false,
    authStatus: 'all',
    ownerType: 'all',
    legalEntity: 'all',
  },
  storeCreateDrawerOpen: false,
  storeCreateDraft: { ...initialStoreCreateDraft },
  storeDetail: {
    routeKey: '',
    storeId: null,
    activeTab: 'overview',
  },
  storeEditDrawer: {
    open: false,
    storeId: '',
    draft: {
      storeName: '',
      storeOwner: '',
      team: '',
      reviewer: '',
    },
  },
  storePolicyDraft: {
    routeKey: '',
    storeId: null,
    allowListing: true,
    inventorySyncMode: 'AVAILABLE_TO_SELL',
    safetyStock: '0',
    handlingTime: '0',
    defaultCategoryId: '',
  },
  storeAuthDialog: {
    open: false,
    storeId: '',
    step: 1,
    method: 'oauth',
    tokenInput: '',
    tokenExpireAt: '',
  },
  storePayoutDialog: {
    open: false,
    storeId: '',
    payoutAccountId: '',
    effectiveFrom: '',
    changeReason: '',
  },
  storeBindingHistoryDialog: {
    open: false,
    storeId: '',
  },
  syncPage: {
    routeKey: '',
    activeTab: 'product',
    search: '',
    storeFilter: 'all',
    statusFilter: 'all',
  },
  payoutList: {
    search: '',
    ownerType: 'all',
    legalEntity: 'all',
    country: 'all',
    status: 'all',
  },
  payoutCreateDrawerOpen: false,
  payoutCreateDraft: { ...initialPayoutCreateDraft },
  payoutDetail: {
    routeKey: '',
    accountId: null,
    activeTab: 'overview',
  },
}

const storeRecords = new Map<string, ChannelStoreRecord>()
const payoutAccountRecords = new Map<string, PayoutAccountRecord>()

const syncErrors: SyncErrorRecord[] = [
  {
    id: 'E-001',
    type: 'product',
    storeId: 'ST-001',
    storeName: 'IDN-Store-A',
    objectId: 'CP-001',
    objectName: '印尼风格碎花连衣裙',
    errorType: '类目不匹配',
    errorMsg: '平台类目 Women>Dresses 已下架',
    time: '2026-01-13 10:30',
    status: '待处理',
  },
  {
    id: 'E-002',
    type: 'product',
    storeId: 'ST-002',
    storeName: 'VN-Store-B',
    objectId: 'CP-005',
    objectName: '波西米亚长裙',
    errorType: '库存同步失败',
    errorMsg: '仓库接口超时',
    time: '2026-01-13 09:15',
    status: '已重试',
  },
  {
    id: 'E-003',
    type: 'product',
    storeId: 'ST-001',
    storeName: 'IDN-Store-A',
    objectId: 'CP-008',
    objectName: '休闲 T 恤',
    errorType: '图片上传失败',
    errorMsg: '图片尺寸不符合要求（最小 500x500）',
    time: '2026-01-12 16:00',
    status: '待处理',
  },
  {
    id: 'OE-001',
    type: 'order',
    storeId: 'ST-001',
    storeName: 'IDN-Store-A',
    objectId: 'TT7890123456',
    objectName: '订单 TT7890123456',
    errorType: '订单拉取失败',
    errorMsg: 'API 限流，稍后重试',
    time: '2026-01-13 11:00',
    status: '已恢复',
  },
  {
    id: 'OE-002',
    type: 'order',
    storeId: 'ST-004',
    storeName: 'TH-Store-D',
    objectId: 'LZ1234567890',
    objectName: '订单 LZ1234567890',
    errorType: '发货同步失败',
    errorMsg: '运单号格式错误',
    time: '2026-01-12 14:30',
    status: '待处理',
  },
]

function nowText(): string {
  const now = new Date()
  const yyyy = String(now.getFullYear())
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

function todayText(): string {
  return nowText().slice(0, 10)
}

function plusDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function minusOneDay(dateText: string): string {
  const date = new Date(`${dateText}T00:00:00`)
  date.setDate(date.getDate() - 1)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function cloneLog(log: StoreLog): StoreLog {
  return { ...log }
}

function cloneBinding(binding: PayoutBinding): PayoutBinding {
  return { ...binding }
}

function cloneStore(record: ChannelStoreRecord): ChannelStoreRecord {
  return {
    ...record,
    projectStoreIds: [...record.projectStoreIds],
    policies: { ...record.policies },
    bindings: record.bindings.map(cloneBinding),
    logs: record.logs.map(cloneLog),
  }
}

function cloneAccount(record: PayoutAccountRecord): PayoutAccountRecord {
  return {
    ...record,
    logs: record.logs.map(cloneLog),
  }
}

function getCountryLabel(code: string): string {
  return ACCOUNT_COUNTRY_OPTIONS.find((item) => item.code === code)?.label ?? code
}

function getStoreOwnerOptions(team: string): string[] {
  return STORE_TEAM_OPTIONS.find((item) => item.team === team)?.owners ?? []
}

function getDefaultCurrencyByCountry(country: string): string {
  if (country === '印尼') return 'IDR'
  if (country === '越南') return 'VND'
  if (country === '马来西亚') return 'MYR'
  if (country === '菲律宾') return 'PHP'
  return 'USD'
}

function getDefaultTimezoneByCountry(country: string): string {
  if (country === '印尼') return 'Asia/Jakarta'
  if (country === '越南') return 'Asia/Ho_Chi_Minh'
  if (country === '马来西亚') return 'Asia/Kuala_Lumpur'
  if (country === '菲律宾') return 'Asia/Manila'
  return 'Asia/Shanghai'
}

function ensureSeeded(): void {
  if (storeRecords.size > 0 && payoutAccountRecords.size > 0) return

  const accounts: PayoutAccountRecord[] = [
    {
      id: 'PA-001',
      name: 'HiGOOD LIVE Limited - TikTok Payout',
      payoutChannel: '平台内提现',
      identifierMasked: '****6789',
      ownerType: 'LEGAL',
      ownerRefId: 'LE-001',
      ownerName: 'HiGOOD LIVE Limited',
      country: 'HK',
      currency: 'USD',
      status: 'ACTIVE',
      createdAt: '2025-08-01 09:00',
      createdBy: '系统管理员',
      updatedAt: '2026-01-10 10:00',
      updatedBy: '陈主管',
      logs: [
        { time: '2026-01-10 10:00', action: '更新账号', operator: '陈主管', detail: '同步平台提现主体信息。' },
        { time: '2025-08-01 09:00', action: '创建账号', operator: '系统管理员', detail: '新建平台提现账号。' },
      ],
    },
    {
      id: 'PA-002',
      name: 'PT HIGOOD LIVE - IDN Payout',
      payoutChannel: '平台内提现',
      identifierMasked: '****1234',
      ownerType: 'LEGAL',
      ownerRefId: 'LE-002',
      ownerName: 'PT HIGOOD LIVE JAKARTA',
      country: 'ID',
      currency: 'IDR',
      status: 'ACTIVE',
      createdAt: '2025-08-01 10:00',
      createdBy: '系统管理员',
      updatedAt: '2026-01-08 14:30',
      updatedBy: '李运营',
      logs: [
        { time: '2026-01-08 14:30', action: '更新信息', operator: '李运营', detail: '更新账号名称。' },
        { time: '2025-10-01 09:00', action: '绑定店铺', operator: '李运营', detail: '绑定至 IDN-Store-A。' },
        { time: '2025-08-01 10:00', action: '创建账号', operator: '系统管理员', detail: '新建提现账号。' },
      ],
    },
    {
      id: 'PA-003',
      name: '张三-个人卡',
      payoutChannel: '银行转账',
      identifierMasked: '****5678',
      ownerType: 'PERSONAL',
      ownerRefId: 'P-001',
      ownerName: '张三',
      country: 'ID',
      currency: 'IDR',
      status: 'ACTIVE',
      createdAt: '2025-07-15 11:00',
      createdBy: '系统管理员',
      updatedAt: '2026-01-05 09:00',
      updatedBy: '李运营',
      logs: [
        { time: '2026-01-05 09:00', action: '更新账号', operator: '李运营', detail: '更新归属主体展示。' },
        { time: '2025-08-15 10:00', action: '绑定店铺', operator: '系统管理员', detail: '测试阶段绑定 IDN-Store-A。' },
      ],
    },
    {
      id: 'PA-004',
      name: '李四-个人卡',
      payoutChannel: '银行转账',
      identifierMasked: '****9012',
      ownerType: 'PERSONAL',
      ownerRefId: 'P-002',
      ownerName: '李四',
      country: 'VN',
      currency: 'VND',
      status: 'ACTIVE',
      createdAt: '2025-09-05 13:00',
      createdBy: '系统管理员',
      updatedAt: '2026-01-03 16:00',
      updatedBy: '陈主管',
      logs: [
        { time: '2026-01-03 16:00', action: '更新账号', operator: '陈主管', detail: '补录越南店铺绑定资料。' },
        { time: '2025-09-05 13:00', action: '创建账号', operator: '系统管理员', detail: '新建个人收款账号。' },
      ],
    },
    {
      id: 'PA-005',
      name: '旧账号-已停用',
      payoutChannel: 'PSP',
      identifierMasked: '****0000',
      ownerType: 'LEGAL',
      ownerRefId: 'LE-001',
      ownerName: 'HiGOOD LIVE Limited',
      country: 'HK',
      currency: 'USD',
      status: 'INACTIVE',
      createdAt: '2025-05-20 10:00',
      createdBy: '系统管理员',
      updatedAt: '2025-12-01 10:00',
      updatedBy: '系统管理员',
      logs: [
        { time: '2025-12-01 10:00', action: '停用账号', operator: '系统管理员', detail: '旧账号停用并转移店铺绑定。' },
      ],
    },
  ]

  const stores: ChannelStoreRecord[] = [
    {
      id: 'ST-001',
      channel: 'TikTok',
      storeName: 'IDN-Store-A',
      storeCode: 'TT_IDN_A',
      platformStoreId: '7239012',
      country: '印尼',
      region: 'ID',
      pricingCurrency: 'IDR',
      settlementCurrency: 'IDR',
      timezone: 'Asia/Jakarta',
      status: 'ACTIVE',
      authStatus: 'CONNECTED',
      tokenExpireAt: '2026-02-15',
      lastRefreshAt: '2026-01-10 14:30',
      storeOwner: '李运营',
      team: '东南亚运营组',
      reviewer: '陈主管',
      createdAt: '2025-10-15 09:00',
      createdBy: '系统管理员',
      updatedAt: '2026-01-10 14:30',
      updatedBy: '李运营',
      projectStoreIds: listPcsProjectStoreIds('ST-001'),
      policies: {
        allowListing: true,
        inventorySyncMode: 'AVAILABLE_TO_SELL',
        safetyStock: 10,
        handlingTime: 3,
        defaultCategoryId: 'Women>Dresses',
      },
      bindings: [
        {
          id: 'BND-002',
          payoutAccountId: 'PA-002',
          payoutAccountName: 'PT HIGOOD LIVE - IDN Payout',
          payoutIdentifier: '****1234',
          ownerType: 'LEGAL',
          ownerName: 'PT HIGOOD LIVE JAKARTA',
          effectiveFrom: '2025-10-01',
          effectiveTo: null,
          changeReason: '店铺正式上线，绑定公司提现账号',
          changedBy: '李运营',
          changedAt: '2025-10-01 09:00',
        },
        {
          id: 'BND-001',
          payoutAccountId: 'PA-003',
          payoutAccountName: '张三-个人卡',
          payoutIdentifier: '****5678',
          ownerType: 'PERSONAL',
          ownerName: '张三',
          effectiveFrom: '2025-08-15',
          effectiveTo: '2025-09-30',
          changeReason: '测试阶段临时绑定个人账号',
          changedBy: '系统管理员',
          changedAt: '2025-08-15 10:00',
        },
      ],
      logs: [
        { time: '2026-01-10 14:30', action: '刷新授权', operator: '李运营', detail: '授权 token 刷新成功，有效期至 2026-02-15。' },
        { time: '2026-01-05 11:00', action: '修改策略', operator: '李运营', detail: '修改安全库存从 5 改为 10。' },
        { time: '2025-10-01 09:00', action: '变更提现账号', operator: '李运营', detail: '从张三-个人卡变更为 PT HIGOOD LIVE - IDN Payout。' },
        { time: '2025-10-15 09:00', action: '创建店铺', operator: '系统管理员', detail: '新建店铺 IDN-Store-A。' },
      ],
    },
    {
      id: 'ST-002',
      channel: 'TikTok',
      storeName: 'VN-Store-B',
      storeCode: 'TT_VN_B',
      platformStoreId: '7239013',
      country: '越南',
      region: 'VN',
      pricingCurrency: 'VND',
      settlementCurrency: 'VND',
      timezone: 'Asia/Ho_Chi_Minh',
      status: 'ACTIVE',
      authStatus: 'EXPIRED',
      tokenExpireAt: '2026-01-16',
      lastRefreshAt: '2026-01-08 10:00',
      storeOwner: '王运营',
      team: '东南亚运营组',
      reviewer: '陈主管',
      createdAt: '2025-11-08 08:00',
      createdBy: '系统管理员',
      updatedAt: '2026-01-08 10:00',
      updatedBy: '王运营',
      projectStoreIds: [],
      policies: {
        allowListing: true,
        inventorySyncMode: 'AVAILABLE_TO_SELL',
        safetyStock: 8,
        handlingTime: 2,
        defaultCategoryId: 'Women>Dresses',
      },
      bindings: [
        {
          id: 'BND-003',
          payoutAccountId: 'PA-004',
          payoutAccountName: '李四-个人卡',
          payoutIdentifier: '****9012',
          ownerType: 'PERSONAL',
          ownerName: '李四',
          effectiveFrom: '2025-11-10',
          effectiveTo: null,
          changeReason: '越南账号按个人主体结算',
          changedBy: '王运营',
          changedAt: '2025-11-10 09:00',
        },
      ],
      logs: [
        { time: '2026-01-08 10:00', action: '授权过期', operator: '系统提醒', detail: '平台授权即将过期，需重新授权。' },
        { time: '2025-11-10 09:00', action: '绑定提现账号', operator: '王运营', detail: '绑定至 李四-个人卡。' },
      ],
    },
    {
      id: 'ST-003',
      channel: 'Shopee',
      storeName: 'MY-Store-C',
      storeCode: 'SP_MY_C',
      platformStoreId: '88901234',
      country: '马来西亚',
      region: 'MY',
      pricingCurrency: 'MYR',
      settlementCurrency: 'USD',
      timezone: 'Asia/Kuala_Lumpur',
      status: 'ACTIVE',
      authStatus: 'CONNECTED',
      tokenExpireAt: '2026-02-10',
      lastRefreshAt: '2026-01-05 16:20',
      storeOwner: '苏运营',
      team: '东南亚运营组',
      reviewer: '陈主管',
      createdAt: '2025-09-26 09:30',
      createdBy: '系统管理员',
      updatedAt: '2026-01-05 16:20',
      updatedBy: '苏运营',
      projectStoreIds: listPcsProjectStoreIds('ST-003'),
      policies: {
        allowListing: true,
        inventorySyncMode: 'ON_HAND',
        safetyStock: 12,
        handlingTime: 4,
        defaultCategoryId: 'Women>Dresses',
      },
      bindings: [
        {
          id: 'BND-004',
          payoutAccountId: 'PA-001',
          payoutAccountName: 'HiGOOD LIVE Limited - TikTok Payout',
          payoutIdentifier: '****6789',
          ownerType: 'LEGAL',
          ownerName: 'HiGOOD LIVE Limited',
          effectiveFrom: '2025-09-26',
          effectiveTo: null,
          changeReason: '马来店铺由香港主体统一收款',
          changedBy: '系统管理员',
          changedAt: '2025-09-26 09:30',
        },
      ],
      logs: [
        { time: '2026-01-05 16:20', action: '刷新授权', operator: '苏运营', detail: '同步 Shopee 授权信息。' },
        { time: '2025-09-26 09:30', action: '创建店铺', operator: '系统管理员', detail: '新建店铺 MY-Store-C。' },
      ],
    },
    {
      id: 'ST-004',
      channel: 'TikTok',
      storeName: 'TH-Store-D',
      storeCode: 'TT_TH_D',
      platformStoreId: '7239014',
      country: '印尼',
      region: 'ID',
      pricingCurrency: 'IDR',
      settlementCurrency: 'IDR',
      timezone: 'Asia/Jakarta',
      status: 'INACTIVE',
      authStatus: 'ERROR',
      tokenExpireAt: null,
      lastRefreshAt: '2025-12-20 09:00',
      storeOwner: '赵运营',
      team: '东南亚运营组',
      reviewer: '陈主管',
      createdAt: '2025-10-20 10:00',
      createdBy: '系统管理员',
      updatedAt: '2025-12-20 09:00',
      updatedBy: '赵运营',
      projectStoreIds: [],
      policies: {
        allowListing: false,
        inventorySyncMode: 'MANUAL',
        safetyStock: 0,
        handlingTime: 5,
        defaultCategoryId: 'Women>Dresses',
      },
      bindings: [],
      logs: [
        { time: '2025-12-20 09:00', action: '连接错误', operator: '系统提醒', detail: '平台连接校验失败，已暂停店铺。' },
        { time: '2025-11-30 18:00', action: '停用店铺', operator: '赵运营', detail: '阶段性关闭该店铺。' },
      ],
    },
    {
      id: 'ST-005',
      channel: '独立站',
      storeName: 'Global-Store',
      storeCode: 'IND_GLOBAL',
      platformStoreId: null,
      country: '全球',
      region: 'GLOBAL',
      pricingCurrency: 'USD',
      settlementCurrency: 'USD',
      timezone: 'Asia/Shanghai',
      status: 'ACTIVE',
      authStatus: 'CONNECTED',
      tokenExpireAt: '2026-03-01',
      lastRefreshAt: '2026-01-12 11:30',
      storeOwner: '周运营',
      team: '独立站运营组',
      reviewer: '陈主管',
      createdAt: '2025-08-28 09:20',
      createdBy: '系统管理员',
      updatedAt: '2026-01-12 11:30',
      updatedBy: '周运营',
      projectStoreIds: listPcsProjectStoreIds('ST-005'),
      policies: {
        allowListing: true,
        inventorySyncMode: 'MANUAL',
        safetyStock: 5,
        handlingTime: 2,
        defaultCategoryId: 'Women>Dresses',
      },
      bindings: [
        {
          id: 'BND-005',
          payoutAccountId: 'PA-003',
          payoutAccountName: '张三-个人卡',
          payoutIdentifier: '****5678',
          ownerType: 'PERSONAL',
          ownerName: '张三',
          effectiveFrom: '2025-08-28',
          effectiveTo: null,
          changeReason: '独立站初期沿用个人账号收款',
          changedBy: '系统管理员',
          changedAt: '2025-08-28 09:20',
        },
      ],
      logs: [
        { time: '2026-01-12 11:30', action: '刷新授权', operator: '周运营', detail: '独立站连接状态检测正常。' },
        { time: '2025-08-28 09:20', action: '创建店铺', operator: '系统管理员', detail: '新建店铺 Global-Store。' },
      ],
    },
    {
      id: 'ST-006',
      channel: 'Lazada',
      storeName: 'PH-Lazada-Store',
      storeCode: 'LZ_PH_A',
      platformStoreId: 'LZD-900128',
      country: '菲律宾',
      region: 'PH',
      pricingCurrency: 'PHP',
      settlementCurrency: 'PHP',
      timezone: 'Asia/Manila',
      status: 'ACTIVE',
      authStatus: 'CONNECTED',
      tokenExpireAt: '2026-02-28',
      lastRefreshAt: '2026-01-09 15:10',
      storeOwner: '何运营',
      team: '东南亚运营组',
      reviewer: '陈主管',
      createdAt: '2025-10-28 10:20',
      createdBy: '系统管理员',
      updatedAt: '2026-01-09 15:10',
      updatedBy: '何运营',
      projectStoreIds: listPcsProjectStoreIds('ST-006'),
      policies: {
        allowListing: true,
        inventorySyncMode: 'AVAILABLE_TO_SELL',
        safetyStock: 6,
        handlingTime: 3,
        defaultCategoryId: 'Women>Dresses',
      },
      bindings: [],
      logs: [
        { time: '2026-01-09 15:10', action: '刷新授权', operator: '何运营', detail: 'Lazada 店铺授权状态正常。' },
        { time: '2025-10-28 10:20', action: '创建店铺', operator: '系统管理员', detail: '新建店铺 PH-Lazada-Store。' },
      ],
    },
  ]

  accounts.forEach((record) => payoutAccountRecords.set(record.id, cloneAccount(record)))
  stores.forEach((record) => storeRecords.set(record.id, cloneStore(record)))
}

function closeAllDialogs(): void {
  state.storeCreateDrawerOpen = false
  state.storeEditDrawer = {
    open: false,
    storeId: '',
    draft: {
      storeName: '',
      storeOwner: '',
      team: '',
      reviewer: '',
    },
  }
  state.storeAuthDialog = {
    open: false,
    storeId: '',
    step: 1,
    method: 'oauth',
    tokenInput: '',
    tokenExpireAt: '',
  }
  state.storePayoutDialog = {
    open: false,
    storeId: '',
    payoutAccountId: '',
    effectiveFrom: '',
    changeReason: '',
  }
  state.storeBindingHistoryDialog = {
    open: false,
    storeId: '',
  }
  state.payoutCreateDrawerOpen = false
}

function resetStoreCreateDraft(): void {
  state.storeCreateDraft = { ...initialStoreCreateDraft }
}

function resetPayoutCreateDraft(): void {
  state.payoutCreateDraft = { ...initialPayoutCreateDraft }
}

function listStores(): ChannelStoreRecord[] {
  ensureSeeded()
  return Array.from(storeRecords.values())
    .map(cloneStore)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function listPayoutAccounts(): PayoutAccountRecord[] {
  ensureSeeded()
  return Array.from(payoutAccountRecords.values())
    .map(cloneAccount)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function getStoreById(storeId: string): ChannelStoreRecord | null {
  ensureSeeded()
  const record = storeRecords.get(storeId)
  return record ? cloneStore(record) : null
}

function getPayoutAccountById(accountId: string): PayoutAccountRecord | null {
  ensureSeeded()
  const record = payoutAccountRecords.get(accountId)
  return record ? cloneAccount(record) : null
}

function getCurrentBinding(store: ChannelStoreRecord): PayoutBinding | null {
  return store.bindings.find((binding) => binding.effectiveTo == null) ?? store.bindings[0] ?? null
}

function getOwnerType(store: ChannelStoreRecord): OwnerType | null {
  return getCurrentBinding(store)?.ownerType ?? null
}

function getOwnerName(store: ChannelStoreRecord): string | null {
  return getCurrentBinding(store)?.ownerName ?? null
}

function getRelatedStoresForAccount(accountId: string): Array<{
  storeId: string
  storeName: string
  channel: string
  country: string
  bindingStatus: string
  effectiveFrom: string
  effectiveTo: string | null
}> {
  return listStores()
    .flatMap((store) =>
      store.bindings
        .filter((binding) => binding.payoutAccountId === accountId)
        .map((binding) => ({
          storeId: store.id,
          storeName: store.storeName,
          channel: store.channel,
          country: store.country,
          bindingStatus: binding.effectiveTo ? '历史' : '当前',
          effectiveFrom: binding.effectiveFrom,
          effectiveTo: binding.effectiveTo,
        })),
    )
    .sort((a, b) => (b.effectiveTo ?? '9999-12-31').localeCompare(a.effectiveTo ?? '9999-12-31'))
}

function getRelatedStoreCount(accountId: string): number {
  return getRelatedStoresForAccount(accountId).length
}

function updateStore(storeId: string, updater: (record: ChannelStoreRecord) => ChannelStoreRecord): void {
  ensureSeeded()
  const current = storeRecords.get(storeId)
  if (!current) return
  storeRecords.set(storeId, cloneStore(updater(cloneStore(current))))
}

function updateAccount(accountId: string, updater: (record: PayoutAccountRecord) => PayoutAccountRecord): void {
  ensureSeeded()
  const current = payoutAccountRecords.get(accountId)
  if (!current) return
  payoutAccountRecords.set(accountId, cloneAccount(updater(cloneAccount(current))))
}

function appendStoreLog(record: ChannelStoreRecord, log: StoreLog): ChannelStoreRecord {
  return {
    ...record,
    updatedAt: log.time,
    updatedBy: log.operator,
    logs: [log, ...record.logs],
  }
}

function appendAccountLog(record: PayoutAccountRecord, log: StoreLog): PayoutAccountRecord {
  return {
    ...record,
    updatedAt: log.time,
    updatedBy: log.operator,
    logs: [log, ...record.logs],
  }
}

function syncStoreDetailState(storeId: string): void {
  const routeKey = appStore.getState().pathname
  if (state.storeDetail.routeKey === routeKey && state.storeDetail.storeId === storeId) return
  const store = getStoreById(storeId)
  state.storeDetail = {
    routeKey,
    storeId,
    activeTab: 'overview',
  }
  if (store) {
    state.storePolicyDraft = {
      routeKey,
      storeId,
      allowListing: store.policies.allowListing,
      inventorySyncMode: store.policies.inventorySyncMode,
      safetyStock: String(store.policies.safetyStock),
      handlingTime: String(store.policies.handlingTime),
      defaultCategoryId: store.policies.defaultCategoryId,
    }
  }
}

function syncPayoutDetailState(accountId: string): void {
  const routeKey = appStore.getState().pathname
  if (state.payoutDetail.routeKey === routeKey && state.payoutDetail.accountId === accountId) return
  state.payoutDetail = {
    routeKey,
    accountId,
    activeTab: 'overview',
  }
}

function syncSyncPageState(): void {
  const routeKey = appStore.getState().pathname
  if (state.syncPage.routeKey === routeKey) return
  state.syncPage.routeKey = routeKey
  state.syncPage.activeTab = 'product'
}

function renderBadge(text: string, className: string): string {
  return `<span class="${escapeHtml(toClassName('inline-flex items-center rounded-full px-2 py-1 text-xs font-medium', className))}">${escapeHtml(text)}</span>`
}

function renderOwnerBadge(ownerType: OwnerType): string {
  const meta = OWNER_TYPE_META[ownerType]
  return `
    <span class="${escapeHtml(toClassName('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium', meta.className))}">
      <i data-lucide="${escapeHtml(meta.icon)}" class="h-3 w-3"></i>${escapeHtml(meta.label)}
    </span>
  `
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
      <div class="flex items-start justify-between gap-3">
        <p>${escapeHtml(state.notice)}</p>
        <button type="button" class="inline-flex h-7 items-center rounded-md px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-channel-store-action="close-notice">关闭</button>
      </div>
    </section>
  `
}

function renderPageHeader(title: string, description: string, actions: string): string {
  return `
    <section class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900">${escapeHtml(title)}</h1>
        <p class="mt-1 text-sm text-slate-500">${escapeHtml(description)}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">${actions}</div>
    </section>
  `
}

function renderMetricButton(title: string, value: string | number, tone: string, action: string, extraData = ''): string {
  return `
    <button type="button" class="${escapeHtml(toClassName('rounded-lg border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md', tone))}" data-pcs-channel-store-action="${escapeHtml(action)}" ${extraData}>
      <div class="text-sm ${tone.includes('red') ? 'text-red-700' : tone.includes('orange') ? 'text-orange-700' : tone.includes('yellow') ? 'text-yellow-700' : 'text-slate-500'}">${escapeHtml(title)}</div>
      <div class="mt-2 text-2xl font-semibold text-slate-900">${escapeHtml(value)}</div>
    </button>
  `
}

function renderCard(title: string, body: string, actions = ''): string {
  return `
    <section class="rounded-lg border bg-white shadow-sm">
      <div class="flex items-center justify-between gap-3 border-b px-5 py-4">
        <h2 class="text-base font-semibold text-slate-900">${escapeHtml(title)}</h2>
        <div class="flex items-center gap-2">${actions}</div>
      </div>
      <div class="p-5">${body}</div>
    </section>
  `
}

function renderDrawerShell(title: string, description: string, body: string, footer: string): string {
  return `
    <div class="fixed inset-0 z-50">
      <button type="button" class="absolute inset-0 bg-slate-900/35" data-pcs-channel-store-action="close-dialogs"></button>
      <aside class="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l bg-white shadow-2xl">
        <div class="border-b px-6 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-slate-900">${escapeHtml(title)}</h3>
              <p class="mt-1 text-sm text-slate-500">${escapeHtml(description)}</p>
            </div>
            <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-channel-store-action="close-dialogs">关闭</button>
          </div>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">${body}</div>
        <div class="flex items-center justify-end gap-2 border-t px-6 py-4">${footer}</div>
      </aside>
    </div>
  `
}

function renderModalShell(title: string, description: string, body: string, footer: string, widthClass = 'max-w-2xl'): string {
  return `
    <div class="fixed inset-0 z-50">
      <button type="button" class="absolute inset-0 bg-slate-900/45" data-pcs-channel-store-action="close-dialogs" aria-label="关闭侧栏"></button>
      <aside class="absolute inset-y-0 right-0 flex h-full w-full ${escapeHtml(widthClass)} flex-col border-l bg-white shadow-2xl">
        <div class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold text-slate-900">${escapeHtml(title)}</h3>
          <p class="mt-1 text-sm text-slate-500">${escapeHtml(description)}</p>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">${body}</div>
        <div class="flex items-center justify-end gap-2 border-t px-6 py-4">${footer}</div>
      </aside>
    </div>
  `
}

function renderFormField(label: string, control: string, required = false): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-slate-700">${escapeHtml(label)}${required ? '<span class="text-red-500"> *</span>' : ''}</span>
      ${control}
    </label>
  `
}

function renderTextInput(field: string, value: string, placeholder: string, type = 'text'): string {
  return `<input type="${escapeHtml(type)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-400" data-pcs-channel-store-field="${escapeHtml(field)}" />`
}

function renderTextArea(field: string, value: string, placeholder: string, rows = 4): string {
  return `<textarea rows="${escapeHtml(rows)}" placeholder="${escapeHtml(placeholder)}" class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-400" data-pcs-channel-store-field="${escapeHtml(field)}">${escapeHtml(value)}</textarea>`
}

function renderSelect(field: string, value: string, options: Array<{ value: string; label: string }>, placeholder: string): string {
  const placeholderOption = value ? '' : `<option value="">${escapeHtml(placeholder)}</option>`
  return `
    <select class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400" data-pcs-channel-store-field="${escapeHtml(field)}">
      ${placeholderOption}
      ${options
        .map(
          (option) =>
            `<option value="${escapeHtml(option.value)}"${option.value === value ? ' selected' : ''}>${escapeHtml(option.label)}</option>`,
        )
        .join('')}
    </select>
  `
}

function renderCheckbox(field: string, checked: boolean, label: string): string {
  return `
    <label class="inline-flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" class="h-4 w-4 rounded border-slate-300 text-blue-600" data-pcs-channel-store-field="${escapeHtml(field)}"${checked ? ' checked' : ''} />
      <span>${escapeHtml(label)}</span>
    </label>
  `
}

function getFilteredStores(): ChannelStoreRecord[] {
  const keyword = state.storeList.search.trim().toLowerCase()
  return listStores().filter((store) => {
    const matchesKeyword =
      keyword.length === 0 ||
      [store.storeName, store.storeCode, store.platformStoreId ?? '', ...store.projectStoreIds].join(' ').toLowerCase().includes(keyword)
    if (!matchesKeyword) return false
    if (state.storeList.channel !== 'all' && store.channel !== state.storeList.channel) return false
    if (state.storeList.country !== 'all' && store.country !== state.storeList.country) return false
    if (state.storeList.status !== 'all' && store.status !== state.storeList.status) return false
    if (state.storeList.linkedOnly && store.projectStoreIds.length === 0) return false
    return true
  })
}

function getStoreStats() {
  const stores = listStores()
  return {
    total: stores.length,
    active: stores.filter((store) => store.status === 'ACTIVE').length,
    inactive: stores.filter((store) => store.status === 'INACTIVE').length,
    linkedProject: stores.filter((store) => store.projectStoreIds.length > 0).length,
  }
}

function getFilteredSyncErrors(): SyncErrorRecord[] {
  syncSyncPageState()
  const keyword = state.syncPage.search.trim().toLowerCase()
  return syncErrors.filter((record) => {
    if (record.type !== state.syncPage.activeTab) return false
    const matchesKeyword =
      keyword.length === 0 ||
      [record.objectId, record.objectName, record.errorType, record.errorMsg].join(' ').toLowerCase().includes(keyword)
    if (!matchesKeyword) return false
    if (state.syncPage.storeFilter !== 'all' && record.storeId !== state.syncPage.storeFilter) return false
    if (state.syncPage.statusFilter !== 'all' && record.status !== state.syncPage.statusFilter) return false
    return true
  })
}

function getSyncStats(type: SyncTabKey) {
  const records = syncErrors.filter((record) => record.type === type)
  return {
    total: records.length,
    pending: records.filter((record) => record.status === '待处理').length,
    retried: records.filter((record) => record.status === '已重试').length,
    recovered: records.filter((record) => record.status === '已恢复').length,
  }
}

function getFilteredPayoutAccounts(): PayoutAccountRecord[] {
  const keyword = state.payoutList.search.trim().toLowerCase()
  return listPayoutAccounts().filter((account) => {
    const matchesKeyword =
      keyword.length === 0 ||
      [account.name, account.identifierMasked, account.ownerName].join(' ').toLowerCase().includes(keyword)
    if (!matchesKeyword) return false
    if (state.payoutList.ownerType !== 'all' && account.ownerType !== state.payoutList.ownerType) return false
    if (state.payoutList.legalEntity !== 'all' && account.ownerRefId !== state.payoutList.legalEntity) return false
    if (state.payoutList.country !== 'all' && account.country !== state.payoutList.country) return false
    if (state.payoutList.status !== 'all' && account.status !== state.payoutList.status) return false
    return true
  })
}

function getPayoutStats() {
  const accounts = listPayoutAccounts()
  return {
    total: accounts.length,
    active: accounts.filter((account) => account.status === 'ACTIVE').length,
    legal: accounts.filter((account) => account.ownerType === 'LEGAL').length,
    personal: accounts.filter((account) => account.ownerType === 'PERSONAL').length,
  }
}

function openStoreEditDrawer(storeId: string): void {
  const store = getStoreById(storeId)
  if (!store) return
  state.storeEditDrawer = {
    open: true,
    storeId,
    draft: {
      storeName: store.storeName,
      storeOwner: store.storeOwner,
      team: store.team,
      reviewer: store.reviewer,
    },
  }
}

function createStore(): void {
  const draft = state.storeCreateDraft
  if (!draft.channel || !draft.storeName || !draft.storeCode || !draft.country || !draft.team || !draft.storeOwner) {
    state.notice = '请补齐渠道、店铺名称、内部编码、国家/区域、所属团队和店铺负责人。'
    return
  }
  const id = `ST-${String(storeRecords.size + 1).padStart(3, '0')}`
  const timestamp = nowText()
  const settlementCurrency = draft.settlementCurrency || getDefaultCurrencyByCountry(draft.country)
  const record: ChannelStoreRecord = {
    id,
    channel: draft.channel,
    storeName: draft.storeName.trim(),
    storeCode: draft.storeCode.trim(),
    platformStoreId: draft.platformStoreId.trim() || null,
    country: draft.country,
    region: draft.country === '全球' ? 'GLOBAL' : ACCOUNT_COUNTRY_OPTIONS.find((item) => item.label === draft.country)?.code ?? draft.country,
    pricingCurrency: settlementCurrency,
    settlementCurrency,
    timezone: draft.timezone || getDefaultTimezoneByCountry(draft.country),
    status: 'ACTIVE',
    authStatus: 'ERROR',
    tokenExpireAt: null,
    lastRefreshAt: null,
    storeOwner: draft.storeOwner,
    team: draft.team,
    reviewer: '待指定',
    createdAt: timestamp,
    createdBy: '当前用户',
    updatedAt: timestamp,
    updatedBy: '当前用户',
    projectStoreIds: [],
    policies: {
      allowListing: true,
      inventorySyncMode: 'AVAILABLE_TO_SELL',
      safetyStock: 5,
      handlingTime: 3,
      defaultCategoryId: 'Women>Dresses',
    },
    bindings: [],
    logs: [
      { time: timestamp, action: '创建店铺', operator: '当前用户', detail: `已创建渠道店铺 ${draft.storeName.trim()}。` },
    ],
  }
  storeRecords.set(id, cloneStore(record))
  state.notice = `渠道店铺 ${record.storeName} 已创建。`
  resetStoreCreateDraft()
  closeAllDialogs()
}

function createPayoutAccount(): void {
  const draft = state.payoutCreateDraft
  if (!draft.name || !draft.payoutChannel || !draft.ownerType || !draft.ownerRefId || !draft.country || !draft.currency) {
    state.notice = '请补齐账号名称、提现渠道、归属类型、归属主体、国家/区域和币种。'
    return
  }
  const timestamp = nowText()
  const id = `PA-${String(payoutAccountRecords.size + 1).padStart(3, '0')}`
  const ownerName =
    draft.ownerType === 'LEGAL'
      ? LEGAL_ENTITIES.find((entity) => entity.id === draft.ownerRefId)?.name ?? draft.ownerRefId
      : draft.ownerRefId.trim()
  const record: PayoutAccountRecord = {
    id,
    name: draft.name.trim(),
    payoutChannel: draft.payoutChannel,
    identifierMasked: draft.identifier.trim() || '****待补录',
    ownerType: draft.ownerType,
    ownerRefId: draft.ownerRefId.trim(),
    ownerName,
    country: draft.country,
    currency: draft.currency,
    status: 'ACTIVE',
    createdAt: timestamp,
    createdBy: '当前用户',
    updatedAt: timestamp,
    updatedBy: '当前用户',
    logs: [
      { time: timestamp, action: '创建账号', operator: '当前用户', detail: `新建提现账号 ${draft.name.trim()}。` },
    ],
  }
  payoutAccountRecords.set(id, cloneAccount(record))
  state.notice = `提现账号 ${record.name} 已创建。`
  resetPayoutCreateDraft()
  closeAllDialogs()
}

function saveStoreEdit(): void {
  const { storeId, draft } = state.storeEditDrawer
  if (!storeId) return
  updateStore(storeId, (store) =>
    appendStoreLog(
      {
        ...store,
        storeName: draft.storeName.trim() || store.storeName,
        storeOwner: draft.storeOwner.trim() || store.storeOwner,
        team: draft.team.trim() || store.team,
        reviewer: draft.reviewer.trim() || store.reviewer,
      },
      {
        time: nowText(),
        action: '编辑店铺',
        operator: '当前用户',
        detail: '更新了店铺名称、负责人和审核信息。',
      },
    ),
  )
  state.notice = '店铺信息已保存。'
  closeAllDialogs()
}

function saveStorePolicies(): void {
  const { storeId } = state.storePolicyDraft
  if (!storeId) return
  updateStore(storeId, (store) =>
    appendStoreLog(
      {
        ...store,
        policies: {
          allowListing: state.storePolicyDraft.allowListing,
          inventorySyncMode: state.storePolicyDraft.inventorySyncMode,
          safetyStock: Number.parseInt(state.storePolicyDraft.safetyStock || '0', 10) || 0,
          handlingTime: Number.parseInt(state.storePolicyDraft.handlingTime || '0', 10) || 0,
          defaultCategoryId: state.storePolicyDraft.defaultCategoryId.trim() || store.policies.defaultCategoryId,
        },
      },
      {
        time: nowText(),
        action: '修改策略',
        operator: '当前用户',
        detail: '已更新上架策略和库存同步配置。',
      },
    ),
  )
  state.notice = '上架策略已保存。'
}

function refreshStoreAuth(storeId: string, mode: 'refresh' | 'complete'): void {
  const expireAt = mode === 'complete' ? state.storeAuthDialog.tokenExpireAt || plusDays(30) : plusDays(30)
  updateStore(storeId, (store) =>
    appendStoreLog(
      {
        ...store,
        authStatus: 'CONNECTED',
        tokenExpireAt: expireAt,
        lastRefreshAt: nowText(),
      },
      {
        time: nowText(),
        action: mode === 'complete' ? '重新授权' : '刷新授权',
        operator: '当前用户',
        detail: `授权连接成功，有效期至 ${expireAt}。`,
      },
    ),
  )
}

function changeStorePayoutBinding(): void {
  const { storeId, payoutAccountId, effectiveFrom, changeReason } = state.storePayoutDialog
  if (!storeId || !payoutAccountId || !effectiveFrom || !changeReason.trim()) {
    state.notice = '请补齐新的提现账号、生效日期和变更原因。'
    return
  }
  const account = getPayoutAccountById(payoutAccountId)
  if (!account) {
    state.notice = '未找到选中的提现账号。'
    return
  }
  const timestamp = nowText()
  let previousAccountId = ''
  updateStore(storeId, (store) => {
    const bindings = store.bindings.map((binding) => {
      if (binding.effectiveTo == null) {
        previousAccountId = binding.payoutAccountId
        return {
          ...binding,
          effectiveTo: minusOneDay(effectiveFrom),
        }
      }
      return binding
    })
    const nextBinding: PayoutBinding = {
      id: `BND-${String(bindings.length + 1).padStart(3, '0')}`,
      payoutAccountId: account.id,
      payoutAccountName: account.name,
      payoutIdentifier: account.identifierMasked,
      ownerType: account.ownerType,
      ownerName: account.ownerName,
      effectiveFrom,
      effectiveTo: null,
      changeReason: changeReason.trim(),
      changedBy: '当前用户',
      changedAt: timestamp,
    }
    return appendStoreLog(
      {
        ...store,
        bindings: [nextBinding, ...bindings],
      },
      {
        time: timestamp,
        action: '变更提现账号',
        operator: '当前用户',
        detail: `店铺已切换绑定至 ${account.name}。`,
      },
    )
  })
  updateAccount(account.id, (record) =>
    appendAccountLog(record, {
      time: timestamp,
      action: '绑定店铺',
      operator: '当前用户',
      detail: `绑定至 ${getStoreById(storeId)?.storeName ?? storeId}。`,
    }),
  )
  if (previousAccountId && previousAccountId !== account.id) {
    updateAccount(previousAccountId, (record) =>
      appendAccountLog(record, {
        time: timestamp,
        action: '解绑店铺',
        operator: '当前用户',
        detail: `店铺 ${getStoreById(storeId)?.storeName ?? storeId} 已切换至其他提现账号。`,
      }),
    )
  }
  state.notice = '店铺提现账号已完成变更。'
  closeAllDialogs()
}

function renderStoreListPageContent(): string {
  const stats = getStoreStats()
  const filteredStores = getFilteredStores()
  const actions = `
    <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md bg-slate-900 px-3 text-sm text-white hover:bg-slate-800" data-pcs-channel-store-action="open-store-create">
      <i data-lucide="plus" class="h-4 w-4"></i>新建店铺
    </button>
  `
  const metricGrid = `
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      ${renderMetricButton('全部店铺', stats.total, '', 'store-quick-filter', 'data-filter=\"reset\"')}
      ${renderMetricButton('启用中', stats.active, '', 'store-quick-filter', 'data-filter=\"status\" data-value=\"ACTIVE\"')}
      ${renderMetricButton('停用中', stats.inactive, 'border-slate-200 bg-slate-50', 'store-quick-filter', 'data-filter=\"status\" data-value=\"INACTIVE\"')}
      ${renderMetricButton('已关联项目', stats.linkedProject, 'border-blue-200 bg-blue-50', 'store-quick-filter', 'data-filter=\"linked\"')}
    </div>
  `
  const filters = renderCard(
    '筛选条件',
    `
      <div class="grid gap-4 lg:grid-cols-5">
        ${renderFormField('关键词', renderTextInput('store-list-search', state.storeList.search, '搜索店铺名/内部编码/平台店铺ID'))}
        ${renderFormField(
          '渠道',
          renderSelect(
            'store-list-channel',
            state.storeList.channel === 'all' ? '' : state.storeList.channel,
            CHANNEL_OPTIONS.map((item) => ({ value: item, label: item })),
            '全部渠道',
          ),
        )}
        ${renderFormField(
          '国家/区域',
          renderSelect(
            'store-list-country',
            state.storeList.country === 'all' ? '' : state.storeList.country,
            STORE_COUNTRY_OPTIONS.map((item) => ({ value: item, label: item })),
            '全部区域',
          ),
        )}
        ${renderFormField(
          '店铺状态',
          renderSelect(
            'store-list-status',
            state.storeList.status === 'all' ? '' : state.storeList.status,
            [
              { value: 'ACTIVE', label: '启用' },
              { value: 'INACTIVE', label: '停用' },
            ],
            '全部状态',
          ),
        )}
        <div class="flex items-end"><button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-channel-store-action="reset-store-list">重置</button></div>
      </div>
    `,
  )
  const rows = filteredStores
    .map((store) => {
      return `
        <tr class="border-t border-slate-100 align-top">
          <td class="px-4 py-3">${renderBadge(store.channel, 'border border-slate-200 bg-white text-slate-700')}</td>
          <td class="px-4 py-3">
            <div class="font-medium text-slate-900">${escapeHtml(store.storeName)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(store.storeCode)}</div>
          </td>
          <td class="px-4 py-3 text-sm text-slate-700">
            <div>${escapeHtml(store.country)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(store.region)}</div>
          </td>
          <td class="px-4 py-3 text-sm text-slate-700">
            <div>${escapeHtml(store.team)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(store.reviewer)}</div>
          </td>
          <td class="px-4 py-3 text-sm text-slate-700">
            <div>${escapeHtml(store.storeOwner)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(STORE_STATUS_META[store.status].label)}</div>
          </td>
          <td class="px-4 py-3 text-sm text-slate-500">${escapeHtml(formatDateTime(store.updatedAt))}</td>
          <td class="px-4 py-3">
            <button type="button" class="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/channels/stores/${escapeHtml(store.id)}">
              <i data-lucide="eye" class="h-3.5 w-3.5"></i>查看
            </button>
          </td>
        </tr>
      `
    })
    .join('')
  const table = renderCard(
    '店铺清单',
    `
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="px-4 py-3 font-medium">渠道</th>
              <th class="px-4 py-3 font-medium">店铺名称</th>
              <th class="px-4 py-3 font-medium">国家/区域</th>
              <th class="px-4 py-3 font-medium">所属团队</th>
              <th class="px-4 py-3 font-medium">店铺负责人</th>
              <th class="px-4 py-3 font-medium">最近更新</th>
              <th class="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows ||
              '<tr><td colspan="7" class="px-4 py-10 text-center text-sm text-slate-500">暂无符合条件的店铺记录。</td></tr>'
            }
          </tbody>
        </table>
      </div>
    `,
  )

  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      ${renderPageHeader('渠道店铺管理', '管理渠道店铺的基础资料、团队归属和负责人信息。', actions)}
      ${metricGrid}
      ${filters}
      ${table}
      ${renderStoreCreateDrawer()}
    </div>
  `
}

function renderStoreCreateDrawer(): string {
  if (!state.storeCreateDrawerOpen) return ''
  const draft = state.storeCreateDraft
  const ownerOptions = getStoreOwnerOptions(draft.team)
  const body = `
    <div class="space-y-6">
      <section class="space-y-4">
        <h4 class="text-sm font-semibold text-slate-900">基础信息</h4>
        <div class="grid gap-4 md:grid-cols-2">
          ${renderFormField(
            '渠道',
            renderSelect('store-create-channel', draft.channel, CHANNEL_OPTIONS.map((item) => ({ value: item, label: item })), '选择渠道'),
            true,
          )}
          ${renderFormField('店铺名称', renderTextInput('store-create-store-name', draft.storeName, '输入店铺名称'), true)}
          ${renderFormField('内部编码', renderTextInput('store-create-store-code', draft.storeCode, '如：TT_IDN_A'), true)}
          ${renderFormField('平台店铺 ID', renderTextInput('store-create-platform-store-id', draft.platformStoreId, '输入平台店铺 ID'))}
        </div>
      </section>
      <section class="space-y-4">
        <h4 class="text-sm font-semibold text-slate-900">区域与结算</h4>
        <div class="grid gap-4 md:grid-cols-2">
          ${renderFormField(
            '国家/区域',
            renderSelect('store-create-country', draft.country, STORE_COUNTRY_OPTIONS.map((item) => ({ value: item, label: item })), '选择国家/区域'),
            true,
          )}
          ${renderFormField(
            '结算币种',
            renderSelect('store-create-settlement-currency', draft.settlementCurrency, CURRENCY_OPTIONS.map((item) => ({ value: item, label: item })), '选择结算币种'),
          )}
          ${renderFormField('时区', renderTextInput('store-create-timezone', draft.timezone, '如：Asia/Jakarta'))}
        </div>
      </section>
      <section class="space-y-4">
        <h4 class="text-sm font-semibold text-slate-900">所属团队与负责人</h4>
        <div class="grid gap-4 md:grid-cols-2">
          ${renderFormField(
            '所属团队',
            renderSelect('store-create-team', draft.team, STORE_TEAM_OPTIONS.map((item) => ({ value: item.team, label: item.team })), '选择所属团队'),
            true,
          )}
          ${renderFormField(
            '店铺负责人',
            renderSelect(
              'store-create-store-owner',
              draft.storeOwner,
              ownerOptions.map((item) => ({ value: item, label: item })),
              draft.team ? '选择店铺负责人' : '请先选择所属团队',
            ),
            true,
          )}
        </div>
      </section>
    </div>
  `
  const footer = `
    <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-channel-store-action="close-dialogs">取消</button>
    <button type="button" class="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-sm text-white hover:bg-slate-800" data-pcs-channel-store-action="submit-store-create">创建店铺</button>
  `
  return renderDrawerShell('新建渠道店铺', '建立渠道店铺主数据，并明确所属团队和店铺负责人。', body, footer)
}

function renderStoreOverviewTab(store: ChannelStoreRecord): string {
  const binding = getCurrentBinding(store)
  const summary = binding
    ? `
      <div class="grid gap-4 md:grid-cols-4">
        <div>
          <div class="text-sm text-slate-500">提现账号</div>
          <div class="mt-1 font-medium text-slate-900">${escapeHtml(binding.payoutAccountName)}</div>
          <div class="mt-1 text-xs text-slate-500">${escapeHtml(binding.payoutIdentifier)}</div>
        </div>
        <div>
          <div class="text-sm text-slate-500">归属类型</div>
          <div class="mt-1">${renderOwnerBadge(binding.ownerType)}</div>
        </div>
        <div>
          <div class="text-sm text-slate-500">归属主体</div>
          <div class="mt-1 font-medium text-slate-900">${escapeHtml(binding.ownerName)}</div>
        </div>
        <div>
          <div class="text-sm text-slate-500">生效起始</div>
          <div class="mt-1 font-medium text-slate-900">${escapeHtml(binding.effectiveFrom)}</div>
        </div>
      </div>
    `
    : '<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">当前未绑定提现账号，请尽快补齐，以免影响收入归属。</div>'
  return `
    <div class="grid gap-4 xl:grid-cols-2">
      ${renderCard(
        '店铺基础信息',
        `
          <div class="grid gap-4 text-sm md:grid-cols-2">
            <div><div class="text-slate-500">渠道</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.channel)}</div></div>
            <div><div class="text-slate-500">店铺名称</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.storeName)}</div></div>
            <div><div class="text-slate-500">内部编码</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.storeCode)}</div></div>
            <div><div class="text-slate-500">平台店铺 ID</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.platformStoreId || '-')}</div></div>
            <div><div class="text-slate-500">国家/区域</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.country)}</div></div>
            <div><div class="text-slate-500">时区</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.timezone)}</div></div>
            <div><div class="text-slate-500">报价币种</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.pricingCurrency)}</div></div>
            <div><div class="text-slate-500">结算币种</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.settlementCurrency)}</div></div>
            <div><div class="text-slate-500">商品项目引用 ID</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.projectStoreIds.join('、') || '-')}</div></div>
            <div><div class="text-slate-500">商品项目回填字段</div><div class="mt-1 font-medium text-slate-900">店铺、币种</div></div>
          </div>
        `,
      )}
      ${renderCard(
        '组织与责任',
        `
          <div class="grid gap-4 text-sm md:grid-cols-2">
            <div><div class="text-slate-500">店铺负责人</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.storeOwner)}</div></div>
            <div><div class="text-slate-500">所属团队</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.team)}</div></div>
            <div><div class="text-slate-500">审核人</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.reviewer)}</div></div>
            <div><div class="text-slate-500">创建时间</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(formatDateTime(store.createdAt))}</div></div>
          </div>
        `,
      )}
    </div>
    ${renderCard(
      '当前提现账号绑定',
      summary,
      `
        <button type="button" class="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50" data-pcs-channel-store-action="open-store-binding-history" data-store-id="${escapeHtml(store.id)}">
          <i data-lucide="history" class="h-3.5 w-3.5"></i>查看绑定历史
        </button>
      `,
    )}
  `
}

function renderStoreAuthTab(store: ChannelStoreRecord): string {
  const statusMeta = AUTH_STATUS_META[store.authStatus]
  const summaryClass =
    store.authStatus === 'CONNECTED'
      ? 'border-green-200 bg-green-50 text-green-700'
      : store.authStatus === 'EXPIRED'
        ? 'border-yellow-200 bg-yellow-50 text-yellow-700'
        : 'border-red-200 bg-red-50 text-red-700'
  const summaryText =
    store.authStatus === 'CONNECTED'
      ? `授权有效期至 ${store.tokenExpireAt || '-'}`
      : store.authStatus === 'EXPIRED'
        ? '授权已过期，请尽快重新授权。'
        : '平台连接校验失败，请重新授权或人工校验。'
  return renderCard(
    '授权状态',
    `
      <div class="rounded-lg border p-4 ${escapeHtml(summaryClass)}">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <i data-lucide="${store.authStatus === 'CONNECTED' ? 'check-circle' : 'alert-triangle'}" class="h-6 w-6"></i>
            <div>
              <div class="font-medium">${escapeHtml(statusMeta.label)}</div>
              <div class="mt-1 text-sm">${escapeHtml(summaryText)}</div>
            </div>
          </div>
          <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-current bg-white/80 px-3 text-sm hover:bg-white" data-pcs-channel-store-action="refresh-store-auth" data-store-id="${escapeHtml(store.id)}">
            <i data-lucide="refresh-cw" class="h-4 w-4"></i>刷新授权
          </button>
        </div>
      </div>
      <div class="mt-5 grid gap-4 text-sm md:grid-cols-2">
        <div>
          <div class="text-slate-500">最近刷新时间</div>
          <div class="mt-1 font-medium text-slate-900">${escapeHtml(store.lastRefreshAt ? formatDateTime(store.lastRefreshAt) : '-')}</div>
        </div>
        <div>
          <div class="text-slate-500">平台店铺 ID</div>
          <div class="mt-1 flex items-center gap-2 font-medium text-slate-900">
            <span>${escapeHtml(store.platformStoreId || '-')}</span>
            ${
              store.platformStoreId
                ? `<button type="button" class="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" data-pcs-channel-store-action="copy-platform-store-id" data-value="${escapeHtml(store.platformStoreId)}"><i data-lucide="copy" class="h-3.5 w-3.5"></i></button>`
                : ''
            }
          </div>
        </div>
      </div>
    `,
  )
}

function renderStorePoliciesTab(): string {
  return renderCard(
    '上架策略配置',
    `
      <div class="space-y-5">
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
          ${renderCheckbox('store-policy-allow-listing', state.storePolicyDraft.allowListing, '允许该店铺发起商品上架')}
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          ${renderFormField(
            '库存同步模式',
            renderSelect('store-policy-inventory-sync-mode', state.storePolicyDraft.inventorySyncMode, INVENTORY_SYNC_OPTIONS, '选择库存模式'),
          )}
          ${renderFormField('安全库存', renderTextInput('store-policy-safety-stock', state.storePolicyDraft.safetyStock, '输入安全库存', 'number'))}
          ${renderFormField('默认类目', renderTextInput('store-policy-default-category', state.storePolicyDraft.defaultCategoryId, '如：Women>Dresses'))}
          ${renderFormField('处理时效（天）', renderTextInput('store-policy-handling-time', state.storePolicyDraft.handlingTime, '输入处理天数', 'number'))}
        </div>
        <div>
          <button type="button" class="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-sm text-white hover:bg-slate-800" data-pcs-channel-store-action="save-store-policies">保存策略</button>
        </div>
      </div>
    `,
  )
}

function renderStorePayoutTab(store: ChannelStoreRecord): string {
  const binding = getCurrentBinding(store)
  const currentCard = binding
    ? `
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-5">
        <div class="grid gap-4 md:grid-cols-4">
          <div>
            <div class="text-sm text-slate-500">提现账号名称</div>
            <div class="mt-1 text-lg font-medium text-slate-900">${escapeHtml(binding.payoutAccountName)}</div>
          </div>
          <div>
            <div class="text-sm text-slate-500">账号标识（脱敏）</div>
            <div class="mt-1 font-medium text-slate-900">${escapeHtml(binding.payoutIdentifier)}</div>
          </div>
          <div>
            <div class="text-sm text-slate-500">归属类型</div>
            <div class="mt-1">${renderOwnerBadge(binding.ownerType)}</div>
          </div>
          <div>
            <div class="text-sm text-slate-500">归属主体</div>
            <div class="mt-1 font-medium text-slate-900">${escapeHtml(binding.ownerName)}</div>
          </div>
        </div>
        <div class="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-600">
          生效起始：<span class="font-medium text-slate-900">${escapeHtml(binding.effectiveFrom)}</span>
          <span class="ml-6">生效结束：<span class="font-medium text-slate-900">${escapeHtml(binding.effectiveTo || '当前生效')}</span></span>
        </div>
      </div>
    `
    : '<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">当前未绑定有效提现账号。</div>'
  const rows = store.bindings
    .map(
      (binding) => `
        <tr class="border-t border-slate-100 align-top">
          <td class="px-4 py-3 font-medium text-slate-900">${escapeHtml(binding.payoutAccountName)}</td>
          <td class="px-4 py-3">${renderOwnerBadge(binding.ownerType)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(binding.ownerName)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(binding.effectiveFrom)} ~ ${escapeHtml(binding.effectiveTo || '当前')}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(binding.changeReason)}</td>
          <td class="px-4 py-3 text-sm text-slate-500">${escapeHtml(binding.changedBy)}<br />${escapeHtml(formatDateTime(binding.changedAt))}</td>
        </tr>
      `,
    )
    .join('')
  return `
    ${renderCard(
      '当前有效提现账号',
      currentCard,
      `
        <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md bg-slate-900 px-3 text-sm text-white hover:bg-slate-800" data-pcs-channel-store-action="open-store-payout-dialog" data-store-id="${escapeHtml(store.id)}">
          <i data-lucide="wallet" class="h-4 w-4"></i>变更提现账号
        </button>
      `,
    )}
    ${renderCard(
      '绑定历史',
      `
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-slate-500">
              <tr>
                <th class="px-4 py-3 font-medium">提现账号</th>
                <th class="px-4 py-3 font-medium">归属类型</th>
                <th class="px-4 py-3 font-medium">归属主体</th>
                <th class="px-4 py-3 font-medium">生效区间</th>
                <th class="px-4 py-3 font-medium">变更原因</th>
                <th class="px-4 py-3 font-medium">操作人/时间</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `,
      `
        <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50" data-pcs-channel-store-action="open-store-binding-history" data-store-id="${escapeHtml(store.id)}">查看完整历史</button>
      `,
    )}
  `
}

function renderStoreSyncTab(): string {
  return renderCard(
    '数据同步状态',
    `
      <div class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
        <i data-lucide="database" class="mx-auto mb-3 h-10 w-10 text-slate-300"></i>
        <p>同步监控统一沉淀在渠道店铺同步页。</p>
        <button type="button" class="mt-3 inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/channels/stores/sync">前往同步状态页</button>
      </div>
    `,
  )
}

function renderStoreLogsTab(store: ChannelStoreRecord): string {
  const rows = store.logs
    .map(
      (log) => `
        <tr class="border-t border-slate-100 align-top">
          <td class="px-4 py-3 text-sm text-slate-500">${escapeHtml(formatDateTime(log.time))}</td>
          <td class="px-4 py-3">${renderBadge(log.action, 'border border-slate-200 bg-white text-slate-700')}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(log.operator)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(log.detail)}</td>
        </tr>
      `,
    )
    .join('')
  return `
    ${renderCard(
      '附件',
      `
        <div class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
          <i data-lucide="file-text" class="mx-auto mb-3 h-10 w-10 text-slate-300"></i>
          <p>暂无附件</p>
          <p class="mt-1">可上传授权截图、平台协议、开店证明等。</p>
        </div>
      `,
    )}
    ${renderCard(
      '操作日志',
      `
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-slate-500">
              <tr>
                <th class="px-4 py-3 font-medium">时间</th>
                <th class="px-4 py-3 font-medium">操作</th>
                <th class="px-4 py-3 font-medium">操作人</th>
                <th class="px-4 py-3 font-medium">详情</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `,
    )}
  `
}

function renderStoreDetailDialogs(): string {
  return renderStoreEditDrawer()
}

function renderStoreEditDrawer(): string {
  if (!state.storeEditDrawer.open) return ''
  const draft = state.storeEditDrawer.draft
  const body = `
    <div class="space-y-4">
      ${renderFormField('店铺名称', renderTextInput('store-edit-store-name', draft.storeName, '输入店铺名称'))}
      ${renderFormField('负责人', renderTextInput('store-edit-store-owner', draft.storeOwner, '输入负责人'))}
      ${renderFormField('所属团队', renderTextInput('store-edit-team', draft.team, '输入所属团队'))}
      ${renderFormField('审核人', renderTextInput('store-edit-reviewer', draft.reviewer, '输入审核人'))}
    </div>
  `
  const footer = `
    <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-channel-store-action="close-dialogs">取消</button>
    <button type="button" class="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-sm text-white hover:bg-slate-800" data-pcs-channel-store-action="save-store-edit">保存</button>
  `
  return renderDrawerShell('编辑店铺信息', '修改店铺名称、负责人和组织信息。', body, footer)
}

function renderStoreAuthDialog(store: ChannelStoreRecord): string {
  if (!state.storeAuthDialog.open) return ''
  const dialog = state.storeAuthDialog
  const stepIndicator = [1, 2, 3]
    .map(
      (step, index) => `
        <div class="flex items-center gap-2">
          <div class="${escapeHtml(toClassName('flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium', dialog.step >= step ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'))}">${step}</div>
          ${index < 2 ? `<div class="${escapeHtml(toClassName('h-0.5 w-10', dialog.step > step ? 'bg-slate-900' : 'bg-slate-200'))}"></div>` : ''}
        </div>
      `,
    )
    .join('')
  let body = `<div class="mb-5 flex items-center justify-center">${stepIndicator}</div>`
  if (dialog.step === 1) {
    body += `
      <div class="grid gap-4 md:grid-cols-2">
        <button type="button" class="${escapeHtml(toClassName('rounded-lg border p-4 text-left', dialog.method === 'oauth' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:bg-slate-50'))}" data-pcs-channel-store-action="set-auth-method" data-value="oauth">
          <div class="font-medium text-slate-900">OAuth 授权</div>
          <div class="mt-1 text-sm text-slate-500">跳转平台登录授权。</div>
        </button>
        <button type="button" class="${escapeHtml(toClassName('rounded-lg border p-4 text-left', dialog.method === 'token' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:bg-slate-50'))}" data-pcs-channel-store-action="set-auth-method" data-value="token">
          <div class="font-medium text-slate-900">手动填写 Token</div>
          <div class="mt-1 text-sm text-slate-500">手动输入授权凭证。</div>
        </button>
      </div>
    `
  } else if (dialog.step === 2) {
    body +=
      dialog.method === 'oauth'
        ? `
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
            <i data-lucide="external-link" class="mx-auto mb-3 h-10 w-10 text-slate-400"></i>
            <p class="font-medium text-slate-900">点击下方按钮跳转至 ${escapeHtml(store.channel)} 授权</p>
            <p class="mt-1 text-sm text-slate-500">授权完成后将自动返回本页。</p>
          </div>
        `
        : `
          <div class="space-y-4">
            ${renderFormField('Access Token', renderTextArea('store-auth-token-input', dialog.tokenInput, '粘贴授权 Token', 4), true)}
            ${renderFormField('Token 有效期', renderTextInput('store-auth-token-expire-at', dialog.tokenExpireAt, '选择到期日期', 'date'), true)}
          </div>
        `
  } else {
    body += `
      <div class="rounded-lg border border-green-200 bg-green-50 p-8 text-center text-green-700">
        <i data-lucide="check-circle" class="mx-auto mb-3 h-12 w-12"></i>
        <p class="text-base font-medium">连接测试成功</p>
        <p class="mt-1 text-sm">授权凭证有效，可以保存生效。</p>
      </div>
    `
  }
  const footer = `
    ${dialog.step > 1 ? `<button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-channel-store-action="prev-store-auth-step">上一步</button>` : ''}
    <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-channel-store-action="close-dialogs">取消</button>
    <button type="button" class="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-sm text-white hover:bg-slate-800" data-pcs-channel-store-action="${dialog.step === 3 ? 'complete-store-auth' : 'next-store-auth-step'}">${dialog.step === 3 ? '保存生效' : dialog.step === 2 && dialog.method === 'oauth' ? '前往授权' : '下一步'}</button>
  `
  return renderModalShell('店铺授权连接', '完成渠道店铺授权连接，确保平台数据可正常同步。', body, footer, 'max-w-lg')
}

function renderStorePayoutDialog(): string {
  if (!state.storePayoutDialog.open) return ''
  const availableAccounts = listPayoutAccounts().filter((account) => account.status === 'ACTIVE')
  const body = `
    <div class="space-y-4">
      ${renderFormField(
        '新的提现账号',
        renderSelect(
          'store-payout-account-id',
          state.storePayoutDialog.payoutAccountId,
          availableAccounts.map((account) => ({ value: account.id, label: `${account.name} / ${account.identifierMasked}` })),
          '选择提现账号',
        ),
        true,
      )}
      ${renderFormField('生效日期', renderTextInput('store-payout-effective-from', state.storePayoutDialog.effectiveFrom, '选择生效日期', 'date'), true)}
      ${renderFormField('变更原因', renderTextArea('store-payout-change-reason', state.storePayoutDialog.changeReason, '输入变更原因'), true)}
    </div>
  `
  const footer = `
    <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-channel-store-action="close-dialogs">取消</button>
    <button type="button" class="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-sm text-white hover:bg-slate-800" data-pcs-channel-store-action="save-store-payout-change">确认变更</button>
  `
  return renderModalShell('变更提现账号', '新绑定将在指定日期生效，并自动沉淀绑定历史。', body, footer, 'max-w-lg')
}

function renderStoreBindingHistoryDialog(store: ChannelStoreRecord): string {
  if (!state.storeBindingHistoryDialog.open) return ''
  const rows = store.bindings
    .map(
      (binding) => `
        <tr class="border-t border-slate-100 align-top">
          <td class="px-4 py-3 font-medium text-slate-900">${escapeHtml(binding.payoutAccountName)}</td>
          <td class="px-4 py-3">${renderOwnerBadge(binding.ownerType)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(binding.ownerName)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(binding.effectiveFrom)} ~ ${escapeHtml(binding.effectiveTo || '当前')}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(binding.changeReason)}</td>
          <td class="px-4 py-3 text-sm text-slate-500">${escapeHtml(binding.changedBy)}<br />${escapeHtml(formatDateTime(binding.changedAt))}</td>
        </tr>
      `,
    )
    .join('')
  const body = `
    <div class="overflow-x-auto">
      <table class="min-w-full text-left text-sm">
        <thead class="bg-slate-50 text-slate-500">
          <tr>
            <th class="px-4 py-3 font-medium">提现账号</th>
            <th class="px-4 py-3 font-medium">归属类型</th>
            <th class="px-4 py-3 font-medium">归属主体</th>
            <th class="px-4 py-3 font-medium">生效区间</th>
            <th class="px-4 py-3 font-medium">变更原因</th>
            <th class="px-4 py-3 font-medium">操作人/时间</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `
  const footer = `<button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-channel-store-action="close-dialogs">关闭</button>`
  return renderModalShell('绑定历史', '查看店铺所有提现账号变更记录。', body, footer, 'max-w-4xl')
}

function renderPayoutCreateDrawer(): string {
  if (!state.payoutCreateDrawerOpen) return ''
  const draft = state.payoutCreateDraft
  const body = `
    <div class="space-y-6">
      ${renderFormField('账号名称', renderTextInput('payout-create-name', draft.name, '如：HiGOOD LIVE Limited - TikTok Payout'), true)}
      ${renderFormField(
        '提现渠道',
        renderSelect('payout-create-channel', draft.payoutChannel, PAYOUT_CHANNEL_OPTIONS.map((item) => ({ value: item, label: item })), '选择提现渠道'),
        true,
      )}
      ${renderFormField('账号标识（脱敏展示）', renderTextInput('payout-create-identifier', draft.identifier, '如：卡号尾号 / 钱包 ID'))}
      ${renderFormField(
        '归属类型',
        renderSelect(
          'payout-create-owner-type',
          draft.ownerType,
          [
            { value: 'LEGAL', label: '法人 (公司)' },
            { value: 'PERSONAL', label: '个人' },
          ],
          '选择归属类型',
        ),
        true,
      )}
      ${
        draft.ownerType === 'LEGAL'
          ? renderFormField(
              '法人主体',
              renderSelect('payout-create-owner-ref-id', draft.ownerRefId, LEGAL_ENTITIES.map((item) => ({ value: item.id, label: `${item.name} (${item.country})` })), '选择法人主体'),
              true,
            )
          : renderFormField('个人姓名', renderTextInput('payout-create-owner-ref-id', draft.ownerRefId, '输入个人姓名'), true)
      }
      <div class="grid gap-4 md:grid-cols-2">
        ${renderFormField(
          '国家/区域',
          renderSelect('payout-create-country', draft.country, ACCOUNT_COUNTRY_OPTIONS.map((item) => ({ value: item.code, label: item.label })), '选择国家/区域'),
          true,
        )}
        ${renderFormField(
          '币种',
          renderSelect('payout-create-currency', draft.currency, CURRENCY_OPTIONS.map((item) => ({ value: item, label: item })), '选择币种'),
          true,
        )}
      </div>
    </div>
  `
  const footer = `
    <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-channel-store-action="close-dialogs">取消</button>
    <button type="button" class="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-sm text-white hover:bg-slate-800" data-pcs-channel-store-action="submit-payout-create">创建账号</button>
  `
  return renderDrawerShell('新建提现账号', '管理提现账号主数据，决定店铺收入归属主体。', body, footer)
}

function renderStoreDetailSummary(store: ChannelStoreRecord): string {
  const projectStoreText =
    store.projectStoreIds.length > 0
      ? store.projectStoreIds.map((item) => `<span class="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">${escapeHtml(item)}</span>`).join('')
      : '<span class="text-sm text-slate-400">暂无关联项目</span>'

  return `
    ${renderCard(
      '店铺基础信息',
      `
        <div class="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div><div class="text-slate-500">渠道</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.channel)}</div></div>
          <div><div class="text-slate-500">店铺名称</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.storeName)}</div></div>
          <div><div class="text-slate-500">内部编码</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.storeCode)}</div></div>
          <div><div class="text-slate-500">平台店铺 ID</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.platformStoreId || '-')}</div></div>
          <div><div class="text-slate-500">国家/区域</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.country)}</div></div>
          <div><div class="text-slate-500">区域编码</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.region)}</div></div>
          <div><div class="text-slate-500">结算币种</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.settlementCurrency)}</div></div>
          <div><div class="text-slate-500">时区</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.timezone)}</div></div>
          <div><div class="text-slate-500">店铺状态</div><div class="mt-1">${renderBadge(STORE_STATUS_META[store.status].label, STORE_STATUS_META[store.status].className)}</div></div>
          <div><div class="text-slate-500">创建时间</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(formatDateTime(store.createdAt))}</div></div>
          <div><div class="text-slate-500">创建人</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.createdBy)}</div></div>
          <div><div class="text-slate-500">最近更新</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(formatDateTime(store.updatedAt))}</div></div>
        </div>
      `,
    )}
    ${renderCard(
      '团队与责任',
      `
        <div class="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div><div class="text-slate-500">所属团队</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.team)}</div></div>
          <div><div class="text-slate-500">店铺负责人</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.storeOwner)}</div></div>
          <div><div class="text-slate-500">审核人</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.reviewer)}</div></div>
          <div><div class="text-slate-500">更新人</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(store.updatedBy)}</div></div>
        </div>
      `,
    )}
    ${renderCard(
      '项目引用信息',
      `
        <div class="space-y-4">
          <div class="text-sm text-slate-500">当前项目引用</div>
          <div class="flex flex-wrap gap-2">${projectStoreText}</div>
        </div>
      `,
    )}
  `
}

function renderStoreDetailContent(store: ChannelStoreRecord): string {
  const actions = `
    <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-channel-store-action="open-store-edit" data-store-id="${escapeHtml(store.id)}">
      <i data-lucide="edit" class="h-4 w-4"></i>编辑店铺
    </button>
  `
  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      <section class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-start gap-4">
          <button type="button" class="inline-flex h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/channels/stores">
            <i data-lucide="arrow-left" class="h-4 w-4"></i>返回列表
          </button>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-2xl font-semibold text-slate-900">${escapeHtml(store.storeName)}</h1>
              ${renderBadge(store.channel, 'border border-slate-200 bg-white text-slate-700')}
              ${renderBadge(STORE_STATUS_META[store.status].label, STORE_STATUS_META[store.status].className)}
            </div>
            <p class="mt-1 text-sm text-slate-500">${escapeHtml(store.storeCode)} | ${escapeHtml(store.country)} | ${escapeHtml(store.team)} | ${escapeHtml(store.storeOwner)}</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">${actions}</div>
      </section>
      ${renderStoreDetailSummary(store)}
      ${renderStoreDetailDialogs()}
    </div>
  `
}

function renderSyncPageContent(): string {
  syncSyncPageState()
  const stats = getSyncStats(state.syncPage.activeTab)
  const errors = getFilteredSyncErrors()
  const statusCards =
    state.syncPage.activeTab === 'product'
      ? `
        <div class="grid gap-4 md:grid-cols-3">
          ${renderMetricButton('全部错误', stats.total, '', 'noop')}
          ${renderMetricButton('待处理', stats.pending, 'border-red-200 bg-red-50', 'sync-set-status-filter', 'data-value=\"待处理\"')}
          ${renderMetricButton('已重试', stats.retried, 'border-yellow-200 bg-yellow-50', 'sync-set-status-filter', 'data-value=\"已重试\"')}
        </div>
      `
      : `
        <div class="grid gap-4 md:grid-cols-3">
          ${renderMetricButton('全部错误', stats.total, '', 'noop')}
          ${renderMetricButton('待处理', stats.pending, 'border-red-200 bg-red-50', 'sync-set-status-filter', 'data-value=\"待处理\"')}
          ${renderMetricButton('已恢复', stats.recovered, 'border-green-200 bg-green-50', 'sync-set-status-filter', 'data-value=\"已恢复\"')}
        </div>
      `
  const tabButtons = `
    <button type="button" class="${escapeHtml(toClassName('inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm', state.syncPage.activeTab === 'product' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'))}" data-pcs-channel-store-action="set-sync-tab" data-value="product"><i data-lucide="package" class="h-4 w-4"></i>商品同步 (${getSyncStats('product').total})</button>
    <button type="button" class="${escapeHtml(toClassName('inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm', state.syncPage.activeTab === 'order' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'))}" data-pcs-channel-store-action="set-sync-tab" data-value="order"><i data-lucide="shopping-cart" class="h-4 w-4"></i>订单同步 (${getSyncStats('order').total})</button>
  `
  const rows = errors
    .map((record) => {
      const objectLabel = state.syncPage.activeTab === 'product' ? record.objectName : record.objectId
      return `
        <tr class="border-t border-slate-100 align-top">
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(record.storeName)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">
            <div class="font-medium text-slate-900">${escapeHtml(objectLabel)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(record.objectId)}</div>
          </td>
          <td class="px-4 py-3">${renderBadge(record.errorType, 'border border-slate-200 bg-white text-slate-700')}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(record.errorMsg)}</td>
          <td class="px-4 py-3 text-sm text-slate-500">${escapeHtml(formatDateTime(record.time))}</td>
          <td class="px-4 py-3">${renderBadge(record.status, record.status === '待处理' ? 'bg-red-100 text-red-700' : record.status === '已恢复' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700')}</td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-1">
              <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" data-pcs-channel-store-action="sync-view-error" data-id="${escapeHtml(record.id)}"><i data-lucide="eye" class="h-3.5 w-3.5"></i></button>
              <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" data-pcs-channel-store-action="sync-retry-error" data-id="${escapeHtml(record.id)}"><i data-lucide="refresh-cw" class="h-3.5 w-3.5"></i></button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')
  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      ${renderPageHeader(
        '同步状态与错误回执',
        '查看商品同步和订单同步的错误信息与处理状态。',
        `
          <button type="button" class="inline-flex h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/channels/stores"><i data-lucide="arrow-left" class="h-4 w-4"></i>返回店铺列表</button>
          <button type="button" class="inline-flex h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-channel-store-action="refresh-sync-page"><i data-lucide="refresh-cw" class="h-4 w-4"></i>刷新</button>
        `,
      )}
      <section class="rounded-lg border bg-white p-2 shadow-sm">
        <div class="flex flex-wrap gap-2">${tabButtons}</div>
      </section>
      ${statusCards}
      ${renderCard(
        '筛选条件',
        `
          <div class="grid gap-4 md:grid-cols-4">
            ${renderFormField('关键词', renderTextInput('sync-search', state.syncPage.search, state.syncPage.activeTab === 'product' ? '搜索商品 ID / 名称' : '搜索订单 ID / 错误信息'))}
            ${renderFormField(
              '店铺',
              renderSelect(
                'sync-store-filter',
                state.syncPage.storeFilter === 'all' ? '' : state.syncPage.storeFilter,
                listStores().map((store) => ({ value: store.id, label: store.storeName })),
                '全部店铺',
              ),
            )}
            ${renderFormField(
              '状态',
              renderSelect(
                'sync-status-filter',
                state.syncPage.statusFilter === 'all' ? '' : state.syncPage.statusFilter,
                [
                  { value: '待处理', label: '待处理' },
                  { value: '已重试', label: '已重试' },
                  { value: '已恢复', label: '已恢复' },
                ],
                '全部状态',
              ),
            )}
            <div class="flex items-end">
              <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-channel-store-action="reset-sync-filters">重置</button>
            </div>
          </div>
        `,
      )}
      ${renderCard(
        state.syncPage.activeTab === 'product' ? '商品同步错误' : '订单同步错误',
        `
          <div class="overflow-x-auto">
            <table class="min-w-full text-left text-sm">
              <thead class="bg-slate-50 text-slate-500">
                <tr>
                  <th class="px-4 py-3 font-medium">店铺</th>
                  <th class="px-4 py-3 font-medium">${state.syncPage.activeTab === 'product' ? '商品' : '订单 ID'}</th>
                  <th class="px-4 py-3 font-medium">错误类型</th>
                  <th class="px-4 py-3 font-medium">错误信息</th>
                  <th class="px-4 py-3 font-medium">时间</th>
                  <th class="px-4 py-3 font-medium">状态</th>
                  <th class="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                ${
                  rows ||
                  '<tr><td colspan="7" class="px-4 py-10 text-center text-sm text-slate-500">暂无符合条件的同步错误。</td></tr>'
                }
              </tbody>
            </table>
          </div>
          ${state.syncPage.activeTab === 'order' ? '<div class="pt-4 text-center text-sm text-slate-500">订单同步完整功能将在后续原型中继续补齐。</div>' : ''}
        `,
      )}
    </div>
  `
}

function renderPayoutAccountListContent(): string {
  const stats = getPayoutStats()
  const accounts = getFilteredPayoutAccounts()
  const actions = `
    <button type="button" class="inline-flex h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/channels/stores">
      <i data-lucide="arrow-left" class="h-4 w-4"></i>返回店铺列表
    </button>
    <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md bg-slate-900 px-3 text-sm text-white hover:bg-slate-800" data-pcs-channel-store-action="open-payout-create">
      <i data-lucide="plus" class="h-4 w-4"></i>新建提现账号
    </button>
  `
  const rows = accounts
    .map(
      (account) => `
        <tr class="border-t border-slate-100 align-top">
          <td class="px-4 py-3">
            <div class="flex items-center gap-2">
              <i data-lucide="wallet" class="h-4 w-4 text-slate-400"></i>
              <div>
                <div class="font-medium text-slate-900">${escapeHtml(account.name)}</div>
                <div class="mt-1 text-xs text-slate-500">${escapeHtml(account.identifierMasked)}</div>
              </div>
            </div>
          </td>
          <td class="px-4 py-3">${renderOwnerBadge(account.ownerType)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(account.ownerName)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(getCountryLabel(account.country))}<div class="mt-1 text-xs text-slate-500">${escapeHtml(account.currency)}</div></td>
          <td class="px-4 py-3">${renderBadge(PAYOUT_STATUS_META[account.status].label, PAYOUT_STATUS_META[account.status].className)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(getRelatedStoreCount(account.id))} 个店铺</td>
          <td class="px-4 py-3 text-sm text-slate-500">${escapeHtml(formatDateTime(account.updatedAt))}</td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-1">
              <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" data-nav="/pcs/channels/stores/payout-accounts/${escapeHtml(account.id)}"><i data-lucide="eye" class="h-3.5 w-3.5"></i></button>
              <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" data-pcs-channel-store-action="payout-edit-placeholder" data-account-id="${escapeHtml(account.id)}"><i data-lucide="edit" class="h-3.5 w-3.5"></i></button>
            </div>
          </td>
        </tr>
      `,
    )
    .join('')
  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      ${renderPageHeader('提现账号管理', '管理提现账号主数据，决定店铺收入归属主体。', actions)}
      <div class="grid gap-4 md:grid-cols-4">
        ${renderMetricButton('全部账号', stats.total, '', 'noop')}
        ${renderMetricButton('启用中', stats.active, '', 'payout-quick-filter', 'data-filter=\"status\" data-value=\"ACTIVE\"')}
        ${renderMetricButton('法人账号', stats.legal, '', 'payout-quick-filter', 'data-filter=\"owner\" data-value=\"LEGAL\"')}
        ${renderMetricButton('个人账号', stats.personal, '', 'payout-quick-filter', 'data-filter=\"owner\" data-value=\"PERSONAL\"')}
      </div>
      ${renderCard(
        '筛选条件',
        `
          <div class="grid gap-4 lg:grid-cols-5">
            ${renderFormField('关键词', renderTextInput('payout-list-search', state.payoutList.search, '搜索账号名称/尾号/PSP 标识'))}
            ${renderFormField(
              '归属类型',
              renderSelect(
                'payout-list-owner-type',
                state.payoutList.ownerType === 'all' ? '' : state.payoutList.ownerType,
                [
                  { value: 'LEGAL', label: '法人' },
                  { value: 'PERSONAL', label: '个人' },
                ],
                '全部类型',
              ),
            )}
            ${
              state.payoutList.ownerType === 'LEGAL'
                ? renderFormField(
                    '法人主体',
                    renderSelect(
                      'payout-list-legal-entity',
                      state.payoutList.legalEntity === 'all' ? '' : state.payoutList.legalEntity,
                      LEGAL_ENTITIES.map((item) => ({ value: item.id, label: item.name })),
                      '全部法人',
                    ),
                  )
                : ''
            }
            ${renderFormField(
              '国家/区域',
              renderSelect(
                'payout-list-country',
                state.payoutList.country === 'all' ? '' : state.payoutList.country,
                ACCOUNT_COUNTRY_OPTIONS.map((item) => ({ value: item.code, label: item.label })),
                '全部区域',
              ),
            )}
            ${renderFormField(
              '状态',
              renderSelect(
                'payout-list-status',
                state.payoutList.status === 'all' ? '' : state.payoutList.status,
                [
                  { value: 'ACTIVE', label: '启用' },
                  { value: 'INACTIVE', label: '停用' },
                ],
                '全部状态',
              ),
            )}
          </div>
          <div class="mt-4">
            <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-channel-store-action="reset-payout-list">重置</button>
          </div>
        `,
      )}
      ${renderCard(
        '提现账号列表',
        `
          <div class="overflow-x-auto">
            <table class="min-w-full text-left text-sm">
              <thead class="bg-slate-50 text-slate-500">
                <tr>
                  <th class="px-4 py-3 font-medium">提现账号名称</th>
                  <th class="px-4 py-3 font-medium">归属类型</th>
                  <th class="px-4 py-3 font-medium">归属主体</th>
                  <th class="px-4 py-3 font-medium">国家/币种</th>
                  <th class="px-4 py-3 font-medium">状态</th>
                  <th class="px-4 py-3 font-medium">关联店铺</th>
                  <th class="px-4 py-3 font-medium">最近更新</th>
                  <th class="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                ${
                  rows ||
                  '<tr><td colspan="8" class="px-4 py-10 text-center text-sm text-slate-500">暂无符合条件的提现账号。</td></tr>'
                }
              </tbody>
            </table>
          </div>
        `,
      )}
      ${renderPayoutCreateDrawer()}
    </div>
  `
}

function renderPayoutAccountDetailContent(account: PayoutAccountRecord): string {
  const relatedStores = getRelatedStoresForAccount(account.id)
  const tabs = PAYOUT_DETAIL_TABS.map(
    (tab) => `
      <button type="button" class="${escapeHtml(toClassName('inline-flex h-9 items-center rounded-md px-3 text-sm', state.payoutDetail.activeTab === tab.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'))}" data-pcs-channel-store-action="set-payout-detail-tab" data-value="${escapeHtml(tab.key)}">${escapeHtml(tab.label)}</button>
    `,
  ).join('')
  const overview = `
    <div class="grid gap-4 xl:grid-cols-2">
      ${renderCard(
        '账号信息',
        `
          <div class="grid gap-4 text-sm md:grid-cols-2">
            <div><div class="text-slate-500">账号名称</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(account.name)}</div></div>
            <div><div class="text-slate-500">账号标识（脱敏）</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(account.identifierMasked)}</div></div>
            <div><div class="text-slate-500">提现渠道</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(account.payoutChannel)}</div></div>
            <div><div class="text-slate-500">国家/区域</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(getCountryLabel(account.country))}</div></div>
            <div><div class="text-slate-500">币种</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(account.currency)}</div></div>
            <div><div class="text-slate-500">状态</div><div class="mt-1">${renderBadge(PAYOUT_STATUS_META[account.status].label, PAYOUT_STATUS_META[account.status].className)}</div></div>
          </div>
        `,
      )}
      ${renderCard(
        '归属信息',
        `
          <div class="grid gap-4 text-sm md:grid-cols-2">
            <div><div class="text-slate-500">归属类型</div><div class="mt-1">${renderOwnerBadge(account.ownerType)}</div></div>
            <div><div class="text-slate-500">归属主体</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(account.ownerName)}</div></div>
            <div><div class="text-slate-500">创建时间</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(formatDateTime(account.createdAt))}</div></div>
            <div><div class="text-slate-500">创建人</div><div class="mt-1 font-medium text-slate-900">${escapeHtml(account.createdBy)}</div></div>
          </div>
        `,
      )}
    </div>
  `
  const stores = renderCard(
    '关联店铺（当前/历史绑定）',
    `
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="px-4 py-3 font-medium">店铺名称</th>
              <th class="px-4 py-3 font-medium">渠道</th>
              <th class="px-4 py-3 font-medium">国家</th>
              <th class="px-4 py-3 font-medium">绑定状态</th>
              <th class="px-4 py-3 font-medium">生效区间</th>
              <th class="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              relatedStores
                .map(
                  (store) => `
                    <tr class="border-t border-slate-100 align-top">
                      <td class="px-4 py-3 font-medium text-slate-900">${escapeHtml(store.storeName)}</td>
                      <td class="px-4 py-3">${renderBadge(store.channel, 'border border-slate-200 bg-white text-slate-700')}</td>
                      <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(store.country)}</td>
                      <td class="px-4 py-3">${renderBadge(store.bindingStatus, store.bindingStatus === '当前' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500')}</td>
                      <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(store.effectiveFrom)} ~ ${escapeHtml(store.effectiveTo || '当前')}</td>
                      <td class="px-4 py-3"><button type="button" class="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/channels/stores/${escapeHtml(store.storeId)}"><i data-lucide="external-link" class="h-3.5 w-3.5"></i>查看店铺</button></td>
                    </tr>
                  `,
                )
                .join('') || '<tr><td colspan="6" class="px-4 py-10 text-center text-sm text-slate-500">暂无关联店铺。</td></tr>'
            }
          </tbody>
        </table>
      </div>
    `,
  )
  const attachments = `
    ${renderCard(
      '附件',
      `
        <div class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
          <i data-lucide="file-text" class="mx-auto mb-3 h-10 w-10 text-slate-300"></i>
          <p>暂无附件</p>
          <p class="mt-1">可上传开户证明、收款证明、平台截图等。</p>
        </div>
      `,
    )}
    ${renderCard(
      '操作日志',
      `
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-slate-500">
              <tr>
                <th class="px-4 py-3 font-medium">时间</th>
                <th class="px-4 py-3 font-medium">操作</th>
                <th class="px-4 py-3 font-medium">操作人</th>
                <th class="px-4 py-3 font-medium">详情</th>
              </tr>
            </thead>
            <tbody>
              ${account.logs
                .map(
                  (log) => `
                    <tr class="border-t border-slate-100 align-top">
                      <td class="px-4 py-3 text-sm text-slate-500">${escapeHtml(formatDateTime(log.time))}</td>
                      <td class="px-4 py-3">${renderBadge(log.action, 'border border-slate-200 bg-white text-slate-700')}</td>
                      <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(log.operator)}</td>
                      <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(log.detail)}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `,
    )}
  `
  const content =
    state.payoutDetail.activeTab === 'overview'
      ? overview
      : state.payoutDetail.activeTab === 'stores'
        ? stores
        : attachments
  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      <section class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-start gap-4">
          <button type="button" class="inline-flex h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/channels/stores/payout-accounts">
            <i data-lucide="arrow-left" class="h-4 w-4"></i>返回列表
          </button>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <i data-lucide="wallet" class="h-5 w-5 text-slate-400"></i>
              <h1 class="text-2xl font-semibold text-slate-900">${escapeHtml(account.name)}</h1>
              ${renderOwnerBadge(account.ownerType)}
              ${renderBadge(PAYOUT_STATUS_META[account.status].label, PAYOUT_STATUS_META[account.status].className)}
            </div>
            <p class="mt-1 text-sm text-slate-500">${escapeHtml(account.identifierMasked)} | ${escapeHtml(getCountryLabel(account.country))} | ${escapeHtml(account.currency)}</p>
          </div>
        </div>
        <div>
          <button type="button" class="inline-flex h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-channel-store-action="payout-edit-placeholder" data-account-id="${escapeHtml(account.id)}"><i data-lucide="edit" class="h-4 w-4"></i>编辑账号</button>
        </div>
      </section>
      <section class="rounded-lg border bg-white p-2 shadow-sm">
        <div class="flex flex-wrap gap-2">${tabs}</div>
      </section>
      ${content}
    </div>
  `
}

export function renderPcsChannelStoreListPage(): string {
  ensureSeeded()
  return renderStoreListPageContent()
}

export function renderPcsChannelStoreDetailPage(storeId: string): string {
  ensureSeeded()
  syncStoreDetailState(storeId)
  const store = getStoreById(storeId)
  if (!store) {
    return `
      <div class="space-y-5 p-4">
        <section class="rounded-lg border bg-white p-4">
          <h1 class="text-xl font-semibold text-slate-900">渠道店铺不存在</h1>
          <p class="mt-1 text-sm text-slate-500">未找到对应的渠道店铺记录，请返回列表重新选择。</p>
        </section>
      </div>
    `
  }
  return renderStoreDetailContent(store)
}

export function renderPcsChannelStoreSyncPage(): string {
  ensureSeeded()
  return renderSyncPageContent()
}

export function renderPcsPayoutAccountListPage(): string {
  ensureSeeded()
  return renderPayoutAccountListContent()
}

export function renderPcsPayoutAccountDetailPage(accountId: string): string {
  ensureSeeded()
  syncPayoutDetailState(accountId)
  const account = getPayoutAccountById(accountId)
  if (!account) {
    return `
      <div class="space-y-5 p-4">
        <section class="rounded-lg border bg-white p-4">
          <h1 class="text-xl font-semibold text-slate-900">提现账号不存在</h1>
          <p class="mt-1 text-sm text-slate-500">未找到对应的提现账号记录，请返回列表重新选择。</p>
        </section>
      </div>
    `
  }
  return renderPayoutAccountDetailContent(account)
}

export function handlePcsChannelStoresInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-channel-store-field]')
  if (!fieldNode) return false
  const field = fieldNode.dataset.pcsChannelStoreField
  if (!field) return false

  if (field === 'store-list-search' && fieldNode instanceof HTMLInputElement) {
    state.storeList.search = fieldNode.value
    state.storeList.linkedOnly = false
    return true
  }
  if (field === 'store-list-channel' && fieldNode instanceof HTMLSelectElement) {
    state.storeList.channel = fieldNode.value || 'all'
    state.storeList.linkedOnly = false
    return true
  }
  if (field === 'store-list-country' && fieldNode instanceof HTMLSelectElement) {
    state.storeList.country = fieldNode.value || 'all'
    state.storeList.linkedOnly = false
    return true
  }
  if (field === 'store-list-status' && fieldNode instanceof HTMLSelectElement) {
    state.storeList.status = fieldNode.value || 'all'
    state.storeList.linkedOnly = false
    return true
  }
  if (field === 'store-list-auth-status' && fieldNode instanceof HTMLSelectElement) {
    state.storeList.authStatus = fieldNode.value || 'all'
    return true
  }
  if (field === 'store-list-owner-type' && fieldNode instanceof HTMLSelectElement) {
    state.storeList.ownerType = fieldNode.value || 'all'
    state.storeList.legalEntity = 'all'
    return true
  }
  if (field === 'store-list-legal-entity' && fieldNode instanceof HTMLSelectElement) {
    state.storeList.legalEntity = fieldNode.value || 'all'
    return true
  }

  const storeCreateFields: Record<string, keyof StoreCreateDraft> = {
    'store-create-channel': 'channel',
    'store-create-store-name': 'storeName',
    'store-create-store-code': 'storeCode',
    'store-create-platform-store-id': 'platformStoreId',
    'store-create-country': 'country',
    'store-create-settlement-currency': 'settlementCurrency',
    'store-create-timezone': 'timezone',
    'store-create-team': 'team',
    'store-create-store-owner': 'storeOwner',
  }
  if (field in storeCreateFields && (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement)) {
    ;(state.storeCreateDraft as Record<string, string>)[storeCreateFields[field]] = fieldNode.value
    if (field === 'store-create-country') {
      if (!state.storeCreateDraft.settlementCurrency) {
        state.storeCreateDraft.settlementCurrency = getDefaultCurrencyByCountry(fieldNode.value)
      }
      if (!state.storeCreateDraft.timezone) {
        state.storeCreateDraft.timezone = getDefaultTimezoneByCountry(fieldNode.value)
      }
    }
    if (field === 'store-create-team') {
      const nextOwners = getStoreOwnerOptions(fieldNode.value)
      if (!nextOwners.includes(state.storeCreateDraft.storeOwner)) {
        state.storeCreateDraft.storeOwner = ''
      }
    }
    return true
  }

  const storeEditFields: Record<string, keyof StoreEditDraft> = {
    'store-edit-store-name': 'storeName',
    'store-edit-store-owner': 'storeOwner',
    'store-edit-team': 'team',
    'store-edit-reviewer': 'reviewer',
  }
  if (field in storeEditFields && fieldNode instanceof HTMLInputElement) {
    ;(state.storeEditDrawer.draft as Record<string, string>)[storeEditFields[field]] = fieldNode.value
    return true
  }

  if (field === 'store-policy-allow-listing' && fieldNode instanceof HTMLInputElement) {
    state.storePolicyDraft.allowListing = fieldNode.checked
    return true
  }
  const policyStringFields: Record<string, keyof StorePolicyDraft> = {
    'store-policy-inventory-sync-mode': 'inventorySyncMode',
    'store-policy-safety-stock': 'safetyStock',
    'store-policy-handling-time': 'handlingTime',
    'store-policy-default-category': 'defaultCategoryId',
  }
  if (field in policyStringFields && (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement)) {
    ;(state.storePolicyDraft as Record<string, string>)[policyStringFields[field]] = fieldNode.value
    return true
  }

  if (field === 'store-auth-token-input' && fieldNode instanceof HTMLTextAreaElement) {
    state.storeAuthDialog.tokenInput = fieldNode.value
    return true
  }
  if (field === 'store-auth-token-expire-at' && fieldNode instanceof HTMLInputElement) {
    state.storeAuthDialog.tokenExpireAt = fieldNode.value
    return true
  }
  if (field === 'store-payout-account-id' && fieldNode instanceof HTMLSelectElement) {
    state.storePayoutDialog.payoutAccountId = fieldNode.value
    return true
  }
  if (field === 'store-payout-effective-from' && fieldNode instanceof HTMLInputElement) {
    state.storePayoutDialog.effectiveFrom = fieldNode.value
    return true
  }
  if (field === 'store-payout-change-reason' && fieldNode instanceof HTMLTextAreaElement) {
    state.storePayoutDialog.changeReason = fieldNode.value
    return true
  }

  if (field === 'sync-search' && fieldNode instanceof HTMLInputElement) {
    state.syncPage.search = fieldNode.value
    return true
  }
  if (field === 'sync-store-filter' && fieldNode instanceof HTMLSelectElement) {
    state.syncPage.storeFilter = fieldNode.value || 'all'
    return true
  }
  if (field === 'sync-status-filter' && fieldNode instanceof HTMLSelectElement) {
    state.syncPage.statusFilter = fieldNode.value || 'all'
    return true
  }

  if (field === 'payout-list-search' && fieldNode instanceof HTMLInputElement) {
    state.payoutList.search = fieldNode.value
    return true
  }
  if (field === 'payout-list-owner-type' && fieldNode instanceof HTMLSelectElement) {
    state.payoutList.ownerType = fieldNode.value || 'all'
    state.payoutList.legalEntity = 'all'
    return true
  }
  if (field === 'payout-list-legal-entity' && fieldNode instanceof HTMLSelectElement) {
    state.payoutList.legalEntity = fieldNode.value || 'all'
    return true
  }
  if (field === 'payout-list-country' && fieldNode instanceof HTMLSelectElement) {
    state.payoutList.country = fieldNode.value || 'all'
    return true
  }
  if (field === 'payout-list-status' && fieldNode instanceof HTMLSelectElement) {
    state.payoutList.status = fieldNode.value || 'all'
    return true
  }

  const payoutCreateFields: Record<string, keyof PayoutCreateDraft> = {
    'payout-create-name': 'name',
    'payout-create-channel': 'payoutChannel',
    'payout-create-identifier': 'identifier',
    'payout-create-owner-type': 'ownerType',
    'payout-create-owner-ref-id': 'ownerRefId',
    'payout-create-country': 'country',
    'payout-create-currency': 'currency',
  }
  if (field in payoutCreateFields && (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement)) {
    ;(state.payoutCreateDraft as Record<string, string>)[payoutCreateFields[field]] = fieldNode.value
    if (field === 'payout-create-owner-type') {
      state.payoutCreateDraft.ownerRefId = ''
    }
    return true
  }

  return false
}

export function handlePcsChannelStoresEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pcs-channel-store-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsChannelStoreAction
  if (!action) return false

  if (action === 'close-notice') {
    state.notice = null
    return true
  }
  if (action === 'noop') return true
  if (action === 'open-store-create') {
    state.storeCreateDrawerOpen = true
    return true
  }
  if (action === 'submit-store-create') {
    createStore()
    return true
  }
  if (action === 'reset-store-list') {
    state.storeList = {
      search: '',
      channel: 'all',
      country: 'all',
      status: 'all',
      linkedOnly: false,
      authStatus: 'all',
      ownerType: 'all',
      legalEntity: 'all',
    }
    return true
  }
  if (action === 'store-quick-filter') {
    const filter = actionNode.dataset.filter
    const value = actionNode.dataset.value ?? ''
    if (filter === 'reset') {
      state.storeList = {
        search: '',
        channel: 'all',
        country: 'all',
        status: 'all',
        linkedOnly: false,
        authStatus: 'all',
        ownerType: 'all',
        legalEntity: 'all',
      }
      return true
    }
    if (filter === 'status') {
      state.storeList.status = value
      state.storeList.linkedOnly = false
    }
    if (filter === 'linked') {
      state.storeList.search = ''
      state.storeList.channel = 'all'
      state.storeList.country = 'all'
      state.storeList.status = 'all'
      state.storeList.linkedOnly = true
      state.notice = '当前已筛选已关联项目的渠道店铺。'
    }
    return true
  }
  if (action === 'open-store-edit') {
    const storeId = actionNode.dataset.storeId
    if (storeId) openStoreEditDrawer(storeId)
    return true
  }
  if (action === 'save-store-edit') {
    saveStoreEdit()
    return true
  }
  if (action === 'save-store-policies') {
    saveStorePolicies()
    return true
  }
  if (action === 'open-store-auth') {
    const storeId = actionNode.dataset.storeId
    if (!storeId) return true
    state.storeAuthDialog = {
      open: true,
      storeId,
      step: 1,
      method: 'oauth',
      tokenInput: '',
      tokenExpireAt: plusDays(30),
    }
    return true
  }
  if (action === 'set-auth-method') {
    state.storeAuthDialog.method = (actionNode.dataset.value as 'oauth' | 'token') || 'oauth'
    return true
  }
  if (action === 'next-store-auth-step') {
    if (state.storeAuthDialog.step === 1) {
      state.storeAuthDialog.step = 2
      return true
    }
    if (state.storeAuthDialog.step === 2) {
      if (state.storeAuthDialog.method === 'token' && (!state.storeAuthDialog.tokenInput.trim() || !state.storeAuthDialog.tokenExpireAt)) {
        state.notice = '请填写完整的 Token 和有效期。'
        return true
      }
      state.storeAuthDialog.step = 3
      return true
    }
    return true
  }
  if (action === 'prev-store-auth-step') {
    if (state.storeAuthDialog.step > 1) {
      state.storeAuthDialog.step = ((state.storeAuthDialog.step - 1) as 1 | 2 | 3)
    }
    return true
  }
  if (action === 'complete-store-auth') {
    if (!state.storeAuthDialog.storeId) return true
    refreshStoreAuth(state.storeAuthDialog.storeId, 'complete')
    state.notice = '店铺授权连接成功。'
    closeAllDialogs()
    return true
  }
  if (action === 'refresh-store-auth') {
    const storeId = actionNode.dataset.storeId
    if (!storeId) return true
    refreshStoreAuth(storeId, 'refresh')
    state.notice = '授权已刷新。'
    return true
  }
  if (action === 'copy-platform-store-id') {
    const value = actionNode.dataset.value
    state.notice = value ? `平台店铺 ID ${value} 已复制。` : '已复制。'
    return true
  }
  if (action === 'open-store-payout-dialog') {
    const storeId = actionNode.dataset.storeId
    if (!storeId) return true
    const store = getStoreById(storeId)
    const current = store ? getCurrentBinding(store) : null
    state.storePayoutDialog = {
      open: true,
      storeId,
      payoutAccountId: current?.payoutAccountId ?? '',
      effectiveFrom: todayText(),
      changeReason: '',
    }
    return true
  }
  if (action === 'save-store-payout-change') {
    changeStorePayoutBinding()
    return true
  }
  if (action === 'open-store-binding-history') {
    const storeId = actionNode.dataset.storeId
    if (!storeId) return true
    state.storeBindingHistoryDialog = { open: true, storeId }
    return true
  }
  if (action === 'set-store-detail-tab') {
    state.storeDetail.activeTab = (actionNode.dataset.value as StoreDetailTabKey) || 'overview'
    return true
  }

  if (action === 'set-sync-tab') {
    state.syncPage.activeTab = (actionNode.dataset.value as SyncTabKey) || 'product'
    state.syncPage.search = ''
    state.syncPage.storeFilter = 'all'
    state.syncPage.statusFilter = 'all'
    return true
  }
  if (action === 'set-sync-status-filter') {
    state.syncPage.statusFilter = actionNode.dataset.value || 'all'
    return true
  }
  if (action === 'refresh-sync-page') {
    state.notice = '同步状态已刷新。'
    return true
  }
  if (action === 'reset-sync-filters') {
    state.syncPage.search = ''
    state.syncPage.storeFilter = 'all'
    state.syncPage.statusFilter = 'all'
    return true
  }
  if (action === 'sync-view-error') {
    const id = actionNode.dataset.id
    state.notice = id ? `同步错误 ${id} 的详情面板已预留，当前原型仅展示主流程。` : '同步错误详情已预留。'
    return true
  }
  if (action === 'sync-retry-error') {
    const id = actionNode.dataset.id
    state.notice = id ? `已提交错误 ${id} 的重试。` : '已提交重试。'
    return true
  }

  if (action === 'open-payout-create') {
    state.payoutCreateDrawerOpen = true
    return true
  }
  if (action === 'submit-payout-create') {
    createPayoutAccount()
    return true
  }
  if (action === 'reset-payout-list') {
    state.payoutList = {
      search: '',
      ownerType: 'all',
      legalEntity: 'all',
      country: 'all',
      status: 'all',
    }
    return true
  }
  if (action === 'payout-quick-filter') {
    const filter = actionNode.dataset.filter
    const value = actionNode.dataset.value ?? ''
    if (filter === 'status') state.payoutList.status = value
    if (filter === 'owner') state.payoutList.ownerType = value
    return true
  }
  if (action === 'payout-edit-placeholder') {
    const accountId = actionNode.dataset.accountId
    state.notice = accountId ? `提现账号 ${accountId} 的编辑入口已预留。` : '编辑入口已预留。'
    return true
  }
  if (action === 'set-payout-detail-tab') {
    state.payoutDetail.activeTab = (actionNode.dataset.value as PayoutDetailTabKey) || 'overview'
    return true
  }

  if (action === 'close-dialogs') {
    closeAllDialogs()
    return true
  }

  return false
}

export function isPcsChannelStoresDialogOpen(): boolean {
  return Boolean(
    state.storeCreateDrawerOpen ||
      state.storeEditDrawer.open ||
      state.storeAuthDialog.open ||
      state.storePayoutDialog.open ||
      state.storeBindingHistoryDialog.open ||
      state.payoutCreateDrawerOpen,
  )
}
