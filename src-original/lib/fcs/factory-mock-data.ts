import type { Factory, CapabilityTag, FactoryTier, FactoryType } from './factory-types'
import { indonesiaFactories, generateFactoryCode as genCode } from './indonesia-factories'

// 能力标签数据
export const allCapabilityTags: CapabilityTag[] = [
  { id: 'cap-1', name: '针织', category: 'production' },
  { id: 'cap-2', name: '梭织', category: 'production' },
  { id: 'cap-3', name: '牛仔', category: 'production' },
  { id: 'cap-4', name: '羽绒服', category: 'production' },
  { id: 'cap-5', name: '外套', category: 'production' },
  { id: 'cap-6', name: '印花', category: 'process' },
  { id: 'cap-7', name: '绣花', category: 'process' },
  { id: 'cap-8', name: '水洗', category: 'process' },
  { id: 'cap-9', name: '染色', category: 'process' },
  { id: 'cap-10', name: '棉', category: 'material' },
  { id: 'cap-11', name: '涤纶', category: 'material' },
  { id: 'cap-12', name: '真丝', category: 'material' },
  { id: 'cap-13', name: '车缝', category: 'production' },
  { id: 'cap-14', name: '后整', category: 'process' },
  { id: 'cap-15', name: '大货', category: 'production' },
  { id: 'cap-16', name: '小单快反', category: 'production' },
]

// 标签名称到ID的映射
const tagNameToId: Record<string, string> = {
  '针织': 'cap-1', '梭织': 'cap-2', '牛仔': 'cap-3', '羽绒服': 'cap-4',
  '外套': 'cap-5', '印花': 'cap-6', '绣花': 'cap-7', '水洗': 'cap-8',
  '染色': 'cap-9', '棉': 'cap-10', '涤纶': 'cap-11', '真丝': 'cap-12',
  '车缝': 'cap-13', '后整': 'cap-14', '大货': 'cap-15', '小单快反': 'cap-16',
}

// 将标签名称转换为 CapabilityTag 对象
function tagsToCapabilities(tags: string[]): CapabilityTag[] {
  return tags.map(tagName => {
    const id = tagNameToId[tagName] || tagName
    const tag = allCapabilityTags.find(t => t.id === id || t.name === tagName)
    return tag || { id, name: tagName, category: 'production' as const }
  })
}

// 状态映射
function mapStatus(status: string): Factory['status'] {
  const statusMap: Record<string, Factory['status']> = {
    'ACTIVE': 'active',
    'SUSPENDED': 'paused',
    'BLACKLISTED': 'blacklist',
    'INACTIVE': 'inactive',
  }
  return statusMap[status] || 'active'
}

// tier 映射
function mapTier(tier: string): FactoryTier {
  if (tier === 'SATELLITE') return 'SATELLITE'
  if (tier === 'THIRD_PARTY') return 'THIRD_PARTY'
  return 'CENTRAL'
}

// type 映射：将 indonesia-factories 的旧类型映射到新类型
function mapType(tier: string, type: string, index: number): FactoryType {
  const typeMap: Record<string, FactoryType> = {
    'CENTRAL_FACTORY': 'CENTRAL_MGT',
    'PRINTING':        'CENTRAL_PRINT',
    'DYEING':          'CENTRAL_DYE',
    'CUTTING':         'CENTRAL_CUTTING',
    'AUX_PROCESS':     'CENTRAL_AUX',
    'SPECIAL_PROCESS': 'CENTRAL_SPECIAL',
    'TRIM_SUPPLIER':   'CENTRAL_LACE',
    'KNIT':            'CENTRAL_KNIT',
    'DENIM_WASH':      'CENTRAL_DENIM_WASH',
    'POD':             'CENTRAL_POD',
    'WAREHOUSE':       'CENTRAL_WAREHOUSE',
    'DISPATCH_CENTER': 'CENTRAL_DISPATCH',
    'DEV_DESIGN_CENTER': 'CENTRAL_DEV',
    'SATELLITE_CLUSTER': 'SATELLITE_SEWING',
    'MICRO_SEWING':    'THIRD_SEWING',
  }
  if (tier === 'SATELLITE') return index % 2 === 0 ? 'SATELLITE_SEWING' : 'SATELLITE_FINISHING'
  if (tier === 'THIRD_PARTY') return 'THIRD_SEWING'
  return typeMap[type] || 'CENTRAL_MGT'
}

// parentFactoryId 默认规则：SATELLITE/THIRD_PARTY 工厂默认挂在 ID-F001
function getDefaultParentId(tier: string): string | undefined {
  if (tier === 'SATELLITE' || tier === 'THIRD_PARTY') return 'ID-F001'
  return undefined
}

// 从印尼工厂数据转换为 Factory 格式
export const mockFactories: Factory[] = indonesiaFactories.map((f, index) => ({
  id: f.id,
  code: f.code,
  name: f.name,
  address: `${f.address}, ${f.city}, ${f.province}`,
  contact: f.contactName,
  phone: f.contactPhone,
  status: mapStatus(f.status),
  cooperationMode: index % 3 === 0 ? 'exclusive' : index % 3 === 1 ? 'preferred' : 'general',
  capabilities: tagsToCapabilities(f.tags),
  monthlyCapacity: f.monthlyCapacity,
  qualityScore: f.qualityScore,
  deliveryScore: f.deliveryScore,
  createdAt: f.createdAt,
  updatedAt: f.updatedAt,
  // 新增字段（从 indonesia-factories 映射 + 默认值）
  factoryTier: mapTier(f.tier),
  factoryType: mapType(f.tier, f.type, index),
  parentFactoryId: getDefaultParentId(f.tier),
  pdaEnabled: true,
  pdaTenantId: f.id,
  eligibility: {
    allowDispatch: f.status === 'ACTIVE',
    allowBid: f.status === 'ACTIVE',
    allowExecute: f.status === 'ACTIVE',
    allowSettle: f.status === 'ACTIVE' && (f.hasSettlement ?? false),
  },
}))

// 生成工厂编号（印尼格式）
export { genCode as generateFactoryCode }
