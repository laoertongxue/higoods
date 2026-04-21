// 工艺路线模板 - RoutingTemplate

import type { AssignmentMode, OwnerTier } from './process-types.ts'

export type TemplateStatus = 'ACTIVE' | 'INACTIVE'
export type MatchMode = 'MANUAL' | 'AUTO'

export interface OwnerSuggestion {
  kind: 'MAIN_FACTORY' | 'RECOMMENDED_FACTORY_POOL'
  recommendedTier?: OwnerTier
  recommendedTypes?: string[]
  requiredTags?: string[]
}

export interface TemplateStep {
  seq: number
  processCode: string
  craftName?: string
  assignmentMode: AssignmentMode
  ownerSuggestion: OwnerSuggestion
  qcPoints?: string[]
  dependsOnSeq?: number[]
}

export interface MatchRule {
  mode: MatchMode
  requiredProcessCodes: string[]
  optionalProcessCodes: string[]
  keywords: string[]
}

export interface RoutingTemplate {
  templateId: string
  name: string
  status: TemplateStatus
  version: string
  description?: string
  tags: string[]
  applicableCategory?: string
  matchRule: MatchRule
  steps: TemplateStep[]
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

export interface TemplateAuditLog {
  id: string
  templateId: string
  action: string
  detail: string
  at: string
  by: string
}

// 预置工艺路线模板（8+）
export const routingTemplates: RoutingTemplate[] = [
  // 1. 基础款
  {
    templateId: 'RT-202603-0001',
    name: '基础款（裁剪-车缝-后道）',
    status: 'ACTIVE',
    version: 'v1.0',
    description: '适用于无特殊工艺的常规款式，全程派单',
    tags: ['基础款', '常规', '快速'],
    applicableCategory: '针织',
    matchRule: {
      mode: 'AUTO',
      requiredProcessCodes: ['PROC_CUT', 'PROC_SEW'],
      optionalProcessCodes: ['PROC_FINISHING'],
      keywords: ['T恤', '基础', '常规', '简单'],
    },
    steps: [
      { seq: 1, processCode: 'PROC_CUT', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' } },
      { seq: 2, processCode: 'PROC_SEW', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' }, dependsOnSeq: [1] },
      { seq: 3, processCode: 'PROC_FINISHING', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' }, dependsOnSeq: [2] },
    ],
    createdAt: '2024-01-15 10:00:00',
    createdBy: '系统',
    updatedAt: '2024-03-01 14:30:00',
    updatedBy: 'Admin',
  },
  // 2. 含打条
  {
    templateId: 'RT-202603-0002',
    name: '含打条工艺',
    status: 'ACTIVE',
    version: 'v1.0',
    description: '适用于需要打条（如领口、袖口装饰条）的款式',
    tags: ['打条', '装饰', '领口'],
    applicableCategory: '针织',
    matchRule: {
      mode: 'AUTO',
      requiredProcessCodes: ['PROC_CUT', 'PROC_DATIAO', 'PROC_SEW'],
      optionalProcessCodes: ['PROC_FINISHING'],
      keywords: ['打条', '装饰条', '领条', '袖条'],
    },
    steps: [
      { seq: 1, processCode: 'PROC_CUT', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' } },
      { seq: 2, processCode: 'PROC_DATIAO', assignmentMode: 'BIDDING', ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL', recommendedTier: 'ANY', recommendedTypes: ['SEWING', 'SPECIAL_PROCESS'] }, dependsOnSeq: [1] },
      { seq: 3, processCode: 'PROC_SEW', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' }, dependsOnSeq: [2] },
      { seq: 4, processCode: 'PROC_FINISHING', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' }, dependsOnSeq: [3] },
    ],
    createdAt: '2024-01-20 09:00:00',
    createdBy: '系统',
    updatedAt: '2024-02-15 16:00:00',
    updatedBy: 'Admin',
  },
  // 3. 含捆条
  {
    templateId: 'RT-202603-0003',
    name: '含捆条工艺',
    status: 'ACTIVE',
    version: 'v1.0',
    description: '适用于需要捆条（绑条）包边的款式',
    tags: ['捆条', '绑条', '包边'],
    applicableCategory: '针织',
    matchRule: {
      mode: 'AUTO',
      requiredProcessCodes: ['PROC_CUT', 'PROC_KUNTIAO', 'PROC_SEW'],
      optionalProcessCodes: ['PROC_FINISHING'],
      keywords: ['捆条', '绑条', '包边', '滚边'],
    },
    steps: [
      { seq: 1, processCode: 'PROC_CUT', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' } },
      { seq: 2, processCode: 'PROC_KUNTIAO', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' }, dependsOnSeq: [1] },
      { seq: 3, processCode: 'PROC_SEW', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' }, dependsOnSeq: [2] },
      { seq: 4, processCode: 'PROC_FINISHING', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' }, dependsOnSeq: [3] },
    ],
    createdAt: '2024-01-22 11:00:00',
    createdBy: '系统',
    updatedAt: '2024-02-20 10:00:00',
    updatedBy: 'Admin',
  },
  // 4. 含搪条
  {
    templateId: 'RT-202603-0004',
    name: '含搪条工艺',
    status: 'ACTIVE',
    version: 'v1.0',
    description: '适用于需要搪条（包边）的款式',
    tags: ['搪条', '包边'],
    applicableCategory: '梭织',
    matchRule: {
      mode: 'AUTO',
      requiredProcessCodes: ['PROC_CUT', 'PROC_TANGTIAO', 'PROC_SEW'],
      optionalProcessCodes: ['PROC_FINISHING'],
      keywords: ['搪条', '包边', '滚边'],
    },
    steps: [
      { seq: 1, processCode: 'PROC_CUT', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' } },
      { seq: 2, processCode: 'PROC_TANGTIAO', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' }, dependsOnSeq: [1] },
      { seq: 3, processCode: 'PROC_SEW', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' }, dependsOnSeq: [2] },
      { seq: 4, processCode: 'PROC_FINISHING', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' }, dependsOnSeq: [3] },
    ],
    createdAt: '2024-01-25 14:00:00',
    createdBy: '系统',
    updatedAt: '2024-02-25 09:00:00',
    updatedBy: 'Admin',
  },
  // 5. 含后道
  {
    templateId: 'RT-202603-0005',
    name: '含后道工艺',
    status: 'ACTIVE',
    version: 'v1.0',
    description: '适用于需要开扣眼、装扣子等后道处理的衬衫类款式',
    tags: ['后道', '衬衫', '纽扣'],
    applicableCategory: '梭织',
    matchRule: {
      mode: 'AUTO',
      requiredProcessCodes: ['PROC_CUT', 'PROC_SEW', 'PROC_FINISHING'],
      optionalProcessCodes: [],
      keywords: ['扣眼', '开扣眼', '装扣子', '衬衫', '纽扣'],
    },
    steps: [
      { seq: 1, processCode: 'PROC_CUT', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' } },
      { seq: 2, processCode: 'PROC_SEW', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' }, dependsOnSeq: [1] },
      { seq: 3, processCode: 'PROC_FINISHING', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' }, dependsOnSeq: [2] },
    ],
    createdAt: '2024-02-01 10:00:00',
    createdBy: '系统',
    updatedAt: '2024-03-05 11:00:00',
    updatedBy: 'Admin',
  },
  // 6. 含激光切/绣花
  {
    templateId: 'RT-202603-0006',
    name: '特种工艺（激光切+绣花）',
    status: 'ACTIVE',
    version: 'v1.0',
    description: '适用于需要激光切割和绣花的复杂款式，建议竞价',
    tags: ['激光切', '绣花', '特种工艺', '复杂'],
    applicableCategory: '针织',
    matchRule: {
      mode: 'AUTO',
      requiredProcessCodes: ['PROC_CUT', 'PROC_LASER_CUT', 'PROC_EMBROIDER', 'PROC_SEW'],
      optionalProcessCodes: ['PROC_FINISHING'],
      keywords: ['激光', '绣花', '刺绣', '镂空', '特种'],
    },
    steps: [
      { seq: 1, processCode: 'PROC_CUT', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' } },
      { seq: 2, processCode: 'PROC_LASER_CUT', assignmentMode: 'BIDDING', ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL', recommendedTier: 'CENTRAL', recommendedTypes: ['SPECIAL_PROCESS', 'LASER'] }, dependsOnSeq: [1] },
      { seq: 3, processCode: 'PROC_EMBROIDER', assignmentMode: 'BIDDING', ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL', recommendedTier: 'CENTRAL', recommendedTypes: ['EMBROIDERY'] }, dependsOnSeq: [1] },
      { seq: 4, processCode: 'PROC_SEW', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' }, dependsOnSeq: [2, 3] },
      { seq: 5, processCode: 'PROC_FINISHING', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' }, dependsOnSeq: [4] },
    ],
    createdAt: '2024-02-10 09:00:00',
    createdBy: '系统',
    updatedAt: '2024-03-10 15:00:00',
    updatedBy: 'Admin',
  },
  // 7. 牛仔含洗水
  {
    templateId: 'RT-202603-0007',
    name: '牛仔款（含洗水）',
    status: 'ACTIVE',
    version: 'v1.0',
    description: '适用于需要洗水的牛仔款式，洗水环节建议竞价',
    tags: ['牛仔', '洗水', 'DENIM'],
    applicableCategory: '牛仔',
    matchRule: {
      mode: 'AUTO',
      requiredProcessCodes: ['PROC_CUT', 'PROC_SEW', 'PROC_SPECIAL_CRAFT', 'PROC_FINISHING'],
      optionalProcessCodes: [],
      keywords: ['牛仔', '洗水', 'denim', '水洗', '做旧'],
    },
    steps: [
      { seq: 1, processCode: 'PROC_CUT', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' } },
      { seq: 2, processCode: 'PROC_SEW', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' }, dependsOnSeq: [1] },
      { seq: 3, processCode: 'PROC_SPECIAL_CRAFT', craftName: '洗水', assignmentMode: 'BIDDING', ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL', recommendedTier: 'THIRD_PARTY', recommendedTypes: ['SPECIAL_PROCESS', 'DENIM'] }, dependsOnSeq: [2] },
      { seq: 4, processCode: 'PROC_FINISHING', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' }, dependsOnSeq: [3] },
    ],
    createdAt: '2024-02-15 11:00:00',
    createdBy: '系统',
    updatedAt: '2024-03-15 10:00:00',
    updatedBy: 'Admin',
  },
  // 8. 复杂特种（多SPECIAL，混合）
  {
    templateId: 'RT-202603-0008',
    name: '复杂特种工艺（混合模式）',
    status: 'ACTIVE',
    version: 'v1.0',
    description: '适用于多种特种工艺组合的复杂款式，混合派单与竞价',
    tags: ['复杂', '特种工艺', '混合', '印花', '绣花', '压褶'],
    applicableCategory: '针织',
    matchRule: {
      mode: 'AUTO',
      requiredProcessCodes: ['PROC_CUT', 'PROC_SEW'],
      optionalProcessCodes: ['PROC_PRINT', 'PROC_EMBROIDER', 'PROC_PLEAT', 'PROC_TANHUA', 'PROC_FINISHING'],
      keywords: ['复杂', '特种', '印花', '绣花', '压褶', '烫画'],
    },
    steps: [
      { seq: 1, processCode: 'PROC_CUT', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' } },
      { seq: 2, processCode: 'PROC_PRINT', assignmentMode: 'BIDDING', ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL', recommendedTier: 'THIRD_PARTY', recommendedTypes: ['PRINTING'] }, dependsOnSeq: [1], qcPoints: ['印花对位', '色牢度'] },
      { seq: 3, processCode: 'PROC_EMBROIDER', assignmentMode: 'BIDDING', ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL', recommendedTier: 'CENTRAL', recommendedTypes: ['EMBROIDERY'] }, dependsOnSeq: [1], qcPoints: ['绣花完整', '线迹密度'] },
      { seq: 4, processCode: 'PROC_PLEAT', assignmentMode: 'BIDDING', ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL', recommendedTier: 'CENTRAL', recommendedTypes: ['SPECIAL_PROCESS'] }, dependsOnSeq: [1], qcPoints: ['褶皱均匀', '定型牢固'] },
      { seq: 5, processCode: 'PROC_SEW', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' }, dependsOnSeq: [2, 3, 4] },
      { seq: 6, processCode: 'PROC_FINISHING', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' }, dependsOnSeq: [5] },
    ],
    createdAt: '2024-02-20 14:00:00',
    createdBy: '系统',
    updatedAt: '2024-03-20 09:00:00',
    updatedBy: 'Admin',
  },
  // 9. 中式装饰扣（历史模板）
  {
    templateId: 'RT-202603-0009',
    name: '中式盘扣款',
    status: 'ACTIVE',
    version: 'v1.0',
    description: '适用于需要手工盘扣的中式服装，盘扣建议竞价',
    tags: ['盘扣', '中式', '手工'],
    applicableCategory: '梭织',
    matchRule: {
      mode: 'AUTO',
      requiredProcessCodes: ['PROC_CUT', 'PROC_SEW', 'PROC_FINISHING'],
      optionalProcessCodes: [],
      keywords: ['盘扣', '中式', '旗袍', '唐装', '手工扣'],
    },
    steps: [
      { seq: 1, processCode: 'PROC_CUT', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' } },
      { seq: 2, processCode: 'PROC_SEW', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' }, dependsOnSeq: [1] },
      { seq: 3, processCode: 'PROC_FINISHING', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' }, dependsOnSeq: [2], qcPoints: ['盘扣造型', '缝合牢固'] },
    ],
    createdAt: '2024-03-01 10:00:00',
    createdBy: '系统',
    updatedAt: '2024-03-25 11:00:00',
    updatedBy: 'Admin',
  },
  // 10. 停用的模板示例
  {
    templateId: 'RT-202603-0010',
    name: '旧版基础款（已停用）',
    status: 'INACTIVE',
    version: 'v0.9',
    description: '旧版基础款模板，已被新版本替代',
    tags: ['基础款', '旧版'],
    applicableCategory: '针织',
    matchRule: {
      mode: 'MANUAL',
      requiredProcessCodes: ['PROC_CUT', 'PROC_SEW'],
      optionalProcessCodes: [],
      keywords: [],
    },
    steps: [
      { seq: 1, processCode: 'PROC_CUT', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' } },
      { seq: 2, processCode: 'PROC_SEW', assignmentMode: 'DIRECT', ownerSuggestion: { kind: 'MAIN_FACTORY' }, dependsOnSeq: [1] },
    ],
    createdAt: '2023-12-01 10:00:00',
    createdBy: '系统',
    updatedAt: '2024-01-10 09:00:00',
    updatedBy: 'Admin',
  },
]

// 模板审计日志
export const templateAuditLogs: TemplateAuditLog[] = [
  { id: 'TAL-001', templateId: 'RT-202603-0001', action: 'CREATE', detail: '创建基础款模板', at: '2024-01-15 10:00:00', by: '系统' },
  { id: 'TAL-002', templateId: 'RT-202603-0001', action: 'UPDATE', detail: '添加后道工序', at: '2024-03-01 14:30:00', by: 'Admin' },
  { id: 'TAL-003', templateId: 'RT-202603-0010', action: 'STATUS_CHANGE', detail: '状态从ACTIVE变更为INACTIVE', at: '2024-01-10 09:00:00', by: 'Admin' },
]

// 根据ID获取模板
export function getTemplateById(templateId: string): RoutingTemplate | undefined {
  return routingTemplates.find(t => t.templateId === templateId)
}

// 获取所有激活的模板
export function getActiveTemplates(): RoutingTemplate[] {
  return routingTemplates.filter(t => t.status === 'ACTIVE')
}

// 获取所有标签
export function getAllTemplateTags(): string[] {
  const tags = new Set<string>()
  routingTemplates.forEach(t => t.tags.forEach(tag => tags.add(tag)))
  return Array.from(tags)
}

// 生成新模板ID
export function generateTemplateId(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const seq = String(routingTemplates.length + 1).padStart(4, '0')
  return `RT-${year}${month}-${seq}`
}

// 复制模板生成新版本
export function copyTemplate(templateId: string): RoutingTemplate | null {
  const source = getTemplateById(templateId)
  if (!source) return null
  
  const versionParts = source.version.match(/v(\d+)\.(\d+)/)
  const newVersion = versionParts 
    ? `v${versionParts[1]}.${parseInt(versionParts[2]) + 1}` 
    : 'v1.1'
  
  return {
    ...source,
    templateId: generateTemplateId(),
    version: newVersion,
    status: 'INACTIVE',
    createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    createdBy: 'Admin',
    updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    updatedBy: 'Admin',
  }
}

// 模板匹配算法
export function matchTemplates(processCodes: string[], keywords: string[]): { template: RoutingTemplate; score: number }[] {
  const activeTemplates = getActiveTemplates()
  const results: { template: RoutingTemplate; score: number }[] = []
  
  for (const template of activeTemplates) {
    if (template.matchRule.mode !== 'AUTO') continue
    
    let score = 0
    const { requiredProcessCodes, optionalProcessCodes, keywords: templateKeywords } = template.matchRule
    
    // 必须包含的工艺全部匹配得基础分
    const requiredMatched = requiredProcessCodes.filter(c => processCodes.includes(c))
    if (requiredMatched.length === requiredProcessCodes.length) {
      score += 50
    } else {
      // 必须工艺不完全匹配，跳过
      continue
    }
    
    // 可选工艺匹配加分
    const optionalMatched = optionalProcessCodes.filter(c => processCodes.includes(c))
    score += optionalMatched.length * 5
    
    // 关键词匹配加分
    const keywordsLower = keywords.map(k => k.toLowerCase())
    const templateKeywordsLower = templateKeywords.map(k => k.toLowerCase())
    const keywordMatched = templateKeywordsLower.filter(k => 
      keywordsLower.some(kw => kw.includes(k) || k.includes(kw))
    )
    score += keywordMatched.length * 10
    
    results.push({ template, score })
  }
  
  return results.sort((a, b) => b.score - a.score)
}
