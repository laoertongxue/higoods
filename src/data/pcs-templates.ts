export type TemplateStatusCode = 'active' | 'inactive'
export type TemplateStyleType = '基础款' | '快时尚款' | '改版款' | '设计款'
export type TemplateWorkItemType = '执行类' | '决策类' | '里程碑类' | '事实类'
export type TemplateRequired = '必做' | '可选'

export interface TemplateWorkItem {
  id: string
  name: string
  type: TemplateWorkItemType
  required: TemplateRequired
  roles: string[]
  fieldTemplate: string
  note: string
}

export interface TemplateStage {
  id: string
  name: string
  description: string
  required: boolean
  workItems: TemplateWorkItem[]
}

export interface ProjectTemplate {
  id: string
  name: string
  styleType: TemplateStyleType[]
  creator: string
  createdAt: string
  updatedAt: string
  status: TemplateStatusCode
  description: string
  stages: TemplateStage[]
}

export interface TemplateLibraryItem {
  id: string
  name: string
  type: TemplateWorkItemType
  roles: string[]
  fieldTemplate: string
}

function cloneWorkItem(item: TemplateWorkItem): TemplateWorkItem {
  return {
    ...item,
    roles: [...item.roles],
  }
}

function cloneStage(stage: TemplateStage): TemplateStage {
  return {
    ...stage,
    workItems: stage.workItems.map(cloneWorkItem),
  }
}

function cloneTemplate(template: ProjectTemplate): ProjectTemplate {
  return {
    ...template,
    styleType: [...template.styleType],
    stages: template.stages.map(cloneStage),
  }
}

const TEMPLATE_SEEDS: ProjectTemplate[] = [
  {
    id: 'TPL-001',
    name: '基础款 - 完整流程模板',
    styleType: ['基础款'],
    creator: '系统管理员',
    createdAt: '2025-01-01 09:00',
    updatedAt: '2025-01-15 14:30',
    status: 'active',
    description:
      '适用于基础款的标准化全流程模板，强调短视频+直播双测款，测款结论通过后再进入转档与制版准备。',
    stages: [
      {
        id: 'TPL-001-S1',
        name: '01 立项获取',
        description: '项目立项与样衣获取（含深圳前置打版），确保版型/工艺稳定。',
        required: true,
        workItems: [
          {
            id: 'TPL-001-S1-W1',
            name: '商品项目立项',
            type: '执行类',
            required: '必做',
            roles: ['商品运营', '项目负责人'],
            fieldTemplate: '商品项目基础信息',
            note: '—',
          },
          {
            id: 'TPL-001-S1-W2',
            name: '样衣获取（深圳前置打版）',
            type: '执行类',
            required: '必做',
            roles: ['版师', '打样', '采购'],
            fieldTemplate: '纸样/标准工艺（可选）',
            note: '—',
          },
          {
            id: 'TPL-001-S1-W3',
            name: '到样入库与核对',
            type: '执行类',
            required: '必做',
            roles: ['样衣管理员', '仓储'],
            fieldTemplate: '样衣编号/入库记录',
            note: '—',
          },
        ],
      },
      {
        id: 'TPL-001-S2',
        name: '02 评估定价',
        description: '进入市场前闭合可行性、成本与定价。',
        required: true,
        workItems: [
          {
            id: 'TPL-001-S2-W1',
            name: '初步可行性判断',
            type: '决策类',
            required: '必做',
            roles: ['商品负责人', '运营'],
            fieldTemplate: '结论与风险项',
            note: '—',
          },
          {
            id: 'TPL-001-S2-W2',
            name: '样衣拍摄与试穿',
            type: '执行类',
            required: '必做',
            roles: ['内容运营', '摄影', '试穿'],
            fieldTemplate: '素材/试穿反馈',
            note: '—',
          },
          {
            id: 'TPL-001-S2-W3',
            name: '样衣核价',
            type: '执行类',
            required: '必做',
            roles: ['成本', '采购', '供应链'],
            fieldTemplate: '成本明细（可选）',
            note: '—',
          },
          {
            id: 'TPL-001-S2-W4',
            name: '样衣定价',
            type: '决策类',
            required: '必做',
            roles: ['商品负责人', '财务', '运营'],
            fieldTemplate: '定价规则（可选）',
            note: '—',
          },
        ],
      },
      {
        id: 'TPL-001-S3',
        name: '03 市场测款',
        description: '双重验证（短视频验证兴趣，直播验证转化）。',
        required: true,
        workItems: [
          {
            id: 'TPL-001-S3-W1',
            name: '短视频测款',
            type: '事实类',
            required: '必做',
            roles: ['内容运营'],
            fieldTemplate: '测款记录（短视频）',
            note: '支持多条/多轮',
          },
          {
            id: 'TPL-001-S3-W2',
            name: '商品上架',
            type: '里程碑类',
            required: '必做',
            roles: ['电商运营', '商品运营'],
            fieldTemplate: '上架信息',
            note: '—',
          },
          {
            id: 'TPL-001-S3-W3',
            name: '直播测款',
            type: '事实类',
            required: '必做',
            roles: ['直播运营', '主播团队'],
            fieldTemplate: '测款记录（直播）',
            note: '支持多场/多轮',
          },
        ],
      },
      {
        id: 'TPL-001-S4',
        name: '04 结论与推进',
        description: '测款结论判定为唯一推进闸口。',
        required: true,
        workItems: [
          {
            id: 'TPL-001-S4-W1',
            name: '测款结论判定',
            type: '决策类',
            required: '必做',
            roles: ['商品负责人', '项目负责人'],
            fieldTemplate: '引用测款事实集合',
            note: '输出：通过/改版/淘汰/暂缓',
          },
          {
            id: 'TPL-001-S4-W2',
            name: '商品项目转档',
            type: '里程碑类',
            required: '可选',
            roles: ['商品档案', '项目负责人'],
            fieldTemplate: 'SPU/档案信息',
            note: '判定=通过时执行',
          },
          {
            id: 'TPL-001-S4-W3',
            name: '制版准备·打版任务',
            type: '执行类',
            required: '可选',
            roles: ['版师', '打样'],
            fieldTemplate: '纸样/版型',
            note: '判定=通过时执行',
          },
        ],
      },
      {
        id: 'TPL-001-S5',
        name: '05 资产处置',
        description: '样衣资产留存与退货处理按项目结论执行。',
        required: true,
        workItems: [
          {
            id: 'TPL-001-S5-W1',
            name: '样衣留存与库存',
            type: '执行类',
            required: '可选',
            roles: ['样衣管理员', '仓储'],
            fieldTemplate: '库存台账',
            note: '—',
          },
          {
            id: 'TPL-001-S5-W2',
            name: '样衣退货与处理',
            type: '执行类',
            required: '可选',
            roles: ['采购', '仓储'],
            fieldTemplate: '退货记录',
            note: '—',
          },
        ],
      },
    ],
  },
  {
    id: 'TPL-002',
    name: '快时尚款 - 快速上架模板',
    styleType: ['快时尚款'],
    creator: '系统管理员',
    createdAt: '2025-01-01 09:00',
    updatedAt: '2025-01-14 10:20',
    status: 'active',
    description:
      '适用于快时尚款的高时效流程模板，采用先上后测（直播测款为主），并保留测款结论判定。',
    stages: [
      {
        id: 'TPL-002-S1',
        name: '01 立项获取',
        description: '快速立项与到样闭环，优先保障上新速度。',
        required: true,
        workItems: [
          {
            id: 'TPL-002-S1-W1',
            name: '商品项目立项',
            type: '执行类',
            required: '必做',
            roles: ['商品运营', '项目负责人'],
            fieldTemplate: '商品项目基础信息',
            note: '—',
          },
          {
            id: 'TPL-002-S1-W2',
            name: '样衣获取',
            type: '执行类',
            required: '必做',
            roles: ['采购', '供应链'],
            fieldTemplate: '供应商/样衣信息',
            note: '—',
          },
        ],
      },
      {
        id: 'TPL-002-S2',
        name: '02 评估定价',
        description: '压缩评估周期，保留成本与定价闭合。',
        required: true,
        workItems: [
          {
            id: 'TPL-002-S2-W1',
            name: '初步可行性判断',
            type: '决策类',
            required: '必做',
            roles: ['商品负责人', '运营'],
            fieldTemplate: '结论与风险项',
            note: '—',
          },
          {
            id: 'TPL-002-S2-W2',
            name: '样衣核价',
            type: '执行类',
            required: '必做',
            roles: ['成本', '采购', '供应链'],
            fieldTemplate: '成本明细（可选）',
            note: '—',
          },
          {
            id: 'TPL-002-S2-W3',
            name: '样衣定价',
            type: '决策类',
            required: '必做',
            roles: ['商品负责人', '运营'],
            fieldTemplate: '定价结论',
            note: '—',
          },
        ],
      },
      {
        id: 'TPL-002-S3',
        name: '03 快速测款',
        description: '直播测款为主，短平快验证成交。',
        required: true,
        workItems: [
          {
            id: 'TPL-002-S3-W1',
            name: '商品上架',
            type: '里程碑类',
            required: '必做',
            roles: ['电商运营', '商品运营'],
            fieldTemplate: '上架信息',
            note: '—',
          },
          {
            id: 'TPL-002-S3-W2',
            name: '直播测款',
            type: '事实类',
            required: '必做',
            roles: ['直播运营', '主播团队'],
            fieldTemplate: '测款记录（直播）',
            note: '支持多场/多轮',
          },
        ],
      },
      {
        id: 'TPL-002-S4',
        name: '04 结论推进',
        description: '通过后快速进入制版与打样准备。',
        required: true,
        workItems: [
          {
            id: 'TPL-002-S4-W1',
            name: '测款结论判定',
            type: '决策类',
            required: '必做',
            roles: ['商品负责人'],
            fieldTemplate: '测款结论',
            note: '—',
          },
          {
            id: 'TPL-002-S4-W2',
            name: '制版准备·打版任务',
            type: '执行类',
            required: '可选',
            roles: ['版师', '打样'],
            fieldTemplate: '纸样/版型',
            note: '判定=通过时执行',
          },
        ],
      },
      {
        id: 'TPL-002-S5',
        name: '05 资产处置',
        description: '样衣资产留存与退货处理。',
        required: true,
        workItems: [
          {
            id: 'TPL-002-S5-W1',
            name: '样衣留存与库存',
            type: '执行类',
            required: '可选',
            roles: ['样衣管理员', '仓储'],
            fieldTemplate: '库存台账',
            note: '—',
          },
        ],
      },
    ],
  },
  {
    id: 'TPL-003',
    name: '改版款 - 旧SPU升级模板',
    styleType: ['改版款'],
    creator: '系统管理员',
    createdAt: '2025-01-01 09:00',
    updatedAt: '2025-01-10 16:45',
    status: 'active',
    description:
      '适用于旧款（SPU）升级的改版款模板，先做前置改版定义，再进行直播测款，不允许跳过测款结论直接推进。',
    stages: [
      {
        id: 'TPL-003-S1',
        name: '01 改版定义',
        description: '明确改版目标、问题点与交付边界。',
        required: true,
        workItems: [
          {
            id: 'TPL-003-S1-W1',
            name: '改版任务',
            type: '执行类',
            required: '必做',
            roles: ['版师', '工艺', '商品负责人'],
            fieldTemplate: '改版点/交付物',
            note: '改版类型=反馈改版',
          },
        ],
      },
      {
        id: 'TPL-003-S2',
        name: '02 评估定价',
        description: '改版可行性评估与定价。',
        required: true,
        workItems: [
          {
            id: 'TPL-003-S2-W1',
            name: '初步可行性判断',
            type: '决策类',
            required: '必做',
            roles: ['商品负责人', '运营'],
            fieldTemplate: '结论与风险项',
            note: '—',
          },
          {
            id: 'TPL-003-S2-W2',
            name: '样衣核价',
            type: '执行类',
            required: '必做',
            roles: ['成本', '采购', '供应链'],
            fieldTemplate: '成本明细',
            note: '—',
          },
        ],
      },
      {
        id: 'TPL-003-S3',
        name: '03 测款与判定',
        description: '直播测款后进行结论判定。',
        required: true,
        workItems: [
          {
            id: 'TPL-003-S3-W1',
            name: '直播测款',
            type: '事实类',
            required: '必做',
            roles: ['直播运营'],
            fieldTemplate: '测款记录',
            note: '支持多轮',
          },
          {
            id: 'TPL-003-S3-W2',
            name: '测款结论判定',
            type: '决策类',
            required: '必做',
            roles: ['商品负责人', '项目负责人'],
            fieldTemplate: '测款结论',
            note: '输出：通过/继续改版/淘汰',
          },
        ],
      },
    ],
  },
  {
    id: 'TPL-004',
    name: '设计款 - 原创迭代模板',
    styleType: ['设计款'],
    creator: '系统管理员',
    createdAt: '2025-01-01 09:00',
    updatedAt: '2025-01-08 09:15',
    status: 'active',
    description:
      '适用于原创设计款流程，强调拍摄与细节呈现质量、原创溢价核价定价，以及直播反馈驱动迭代。',
    stages: [
      {
        id: 'TPL-004-S1',
        name: '01 创意定义',
        description: '明确主题、版型方向与图案策略。',
        required: true,
        workItems: [
          {
            id: 'TPL-004-S1-W1',
            name: '创意方向确认',
            type: '决策类',
            required: '必做',
            roles: ['设计师', '商品负责人'],
            fieldTemplate: '创意方向卡',
            note: '—',
          },
          {
            id: 'TPL-004-S1-W2',
            name: '花型任务',
            type: '执行类',
            required: '可选',
            roles: ['花型设计', '版师'],
            fieldTemplate: '花型文件',
            note: '涉及花型时执行',
          },
        ],
      },
      {
        id: 'TPL-004-S2',
        name: '02 样衣开发',
        description: '样衣制作、试穿与评审。',
        required: true,
        workItems: [
          {
            id: 'TPL-004-S2-W1',
            name: '样衣制作',
            type: '执行类',
            required: '必做',
            roles: ['打样', '版师'],
            fieldTemplate: '标准工艺',
            note: '—',
          },
          {
            id: 'TPL-004-S2-W2',
            name: '样衣评审',
            type: '决策类',
            required: '必做',
            roles: ['商品负责人', '设计师'],
            fieldTemplate: '评审结论',
            note: '—',
          },
        ],
      },
      {
        id: 'TPL-004-S3',
        name: '03 测款与结论',
        description: '直播与短视频测款后输出结论。',
        required: true,
        workItems: [
          {
            id: 'TPL-004-S3-W1',
            name: '短视频测款',
            type: '事实类',
            required: '必做',
            roles: ['内容运营'],
            fieldTemplate: '测款记录（短视频）',
            note: '支持多条',
          },
          {
            id: 'TPL-004-S3-W2',
            name: '直播测款',
            type: '事实类',
            required: '必做',
            roles: ['直播运营'],
            fieldTemplate: '测款记录（直播）',
            note: '支持多场',
          },
        ],
      },
    ],
  },
]

export const TEMPLATE_WORK_ITEM_LIBRARY: TemplateLibraryItem[] = [
  {
    id: 'WI-001',
    name: '制版准备',
    type: '执行类',
    roles: ['版师', '商品'],
    fieldTemplate: '制版/BOM',
  },
  {
    id: 'WI-002',
    name: '样衣制作',
    type: '执行类',
    roles: ['打样'],
    fieldTemplate: '标准工艺',
  },
  {
    id: 'WI-003',
    name: '测款结果判断',
    type: '决策类',
    roles: ['商品'],
    fieldTemplate: '测款结论',
  },
  {
    id: 'WI-004',
    name: '花型调色',
    type: '执行类',
    roles: ['设计'],
    fieldTemplate: '花型/调色',
  },
  {
    id: 'WI-005',
    name: '首单备货',
    type: '执行类',
    roles: ['采购'],
    fieldTemplate: '制版/BOM',
  },
]

let templateStore: ProjectTemplate[] = TEMPLATE_SEEDS.map(cloneTemplate)

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function nextTemplateId(): string {
  const max = templateStore.reduce((acc, item) => {
    const index = Number(item.id.replace('TPL-', ''))
    if (Number.isNaN(index)) return acc
    return Math.max(acc, index)
  }, 0)
  return `TPL-${String(max + 1).padStart(3, '0')}`
}

function nextStageId(templateId: string, index: number): string {
  return `${templateId}-S${index + 1}`
}

function nextWorkItemId(stageId: string, index: number): string {
  return `${stageId}-W${index + 1}`
}

export function listProjectTemplates(): ProjectTemplate[] {
  return templateStore.map(cloneTemplate)
}

export function getProjectTemplateById(templateId: string): ProjectTemplate | null {
  const found = templateStore.find((item) => item.id === templateId)
  return found ? cloneTemplate(found) : null
}

export function countTemplateStages(template: ProjectTemplate): number {
  return template.stages.length
}

export function countTemplateWorkItems(template: ProjectTemplate): number {
  return template.stages.reduce((sum, stage) => sum + stage.workItems.length, 0)
}

export function createProjectTemplate(input: {
  name: string
  styleType: TemplateStyleType[]
  description: string
  status?: TemplateStatusCode
  stages: TemplateStage[]
  creator?: string
}): ProjectTemplate {
  const id = nextTemplateId()
  const now = nowText()
  const stages = input.stages.map((stage, stageIndex) => {
    const stageId = nextStageId(id, stageIndex)
    return {
      ...stage,
      id: stageId,
      workItems: stage.workItems.map((item, itemIndex) => ({
        ...item,
        id: nextWorkItemId(stageId, itemIndex),
      })),
    }
  })

  const created: ProjectTemplate = {
    id,
    name: input.name.trim(),
    styleType: input.styleType,
    creator: input.creator?.trim() || '当前用户',
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'active',
    description: input.description.trim() || '迁移演示态模板说明待补充。',
    stages,
  }

  templateStore = [created, ...templateStore]
  return cloneTemplate(created)
}

export function updateProjectTemplate(
  templateId: string,
  input: {
    name: string
    styleType: TemplateStyleType[]
    description: string
    status?: TemplateStatusCode
    stages: TemplateStage[]
  },
): ProjectTemplate | null {
  const index = templateStore.findIndex((item) => item.id === templateId)
  if (index < 0) return null

  const existing = templateStore[index]
  const stages = input.stages.map((stage, stageIndex) => {
    const stageId = stage.id || nextStageId(templateId, stageIndex)
    return {
      ...stage,
      id: stageId,
      workItems: stage.workItems.map((item, itemIndex) => ({
        ...item,
        id: item.id || nextWorkItemId(stageId, itemIndex),
      })),
    }
  })

  const updated: ProjectTemplate = {
    ...existing,
    name: input.name.trim(),
    styleType: input.styleType,
    description: input.description.trim(),
    status: input.status ?? existing.status,
    stages,
    updatedAt: nowText(),
  }

  templateStore = templateStore.map((item) => (item.id === templateId ? updated : item))
  return cloneTemplate(updated)
}

export function toggleProjectTemplateStatus(templateId: string): ProjectTemplate | null {
  const current = templateStore.find((item) => item.id === templateId)
  if (!current) return null

  const nextStatus: TemplateStatusCode = current.status === 'active' ? 'inactive' : 'active'
  const updated = {
    ...current,
    status: nextStatus,
    updatedAt: nowText(),
  }
  templateStore = templateStore.map((item) => (item.id === templateId ? updated : item))
  return cloneTemplate(updated)
}

export function copyProjectTemplate(templateId: string): ProjectTemplate | null {
  const source = templateStore.find((item) => item.id === templateId)
  if (!source) return null

  const copied = createProjectTemplate({
    name: `${source.name}-副本`,
    styleType: [...source.styleType],
    description: source.description,
    stages: source.stages.map((stage) => ({
      ...stage,
      workItems: stage.workItems.map((item) => ({ ...item })),
    })),
    creator: '当前用户',
  })

  const demoted = toggleProjectTemplateStatus(copied.id)
  return demoted ?? copied
}

export function createEmptyStage(index: number): TemplateStage {
  return {
    id: '',
    name: `${String(index + 1).padStart(2, '0')} 新阶段`,
    description: '',
    required: true,
    workItems: [],
  }
}

export function createEmptyWorkItem(stageIndex: number, itemIndex: number): TemplateWorkItem {
  return {
    id: '',
    name: `阶段${stageIndex + 1}工作项${itemIndex + 1}`,
    type: '执行类',
    required: '必做',
    roles: [],
    fieldTemplate: '',
    note: '',
  }
}

export function getStatusLabel(status: TemplateStatusCode): string {
  return status === 'active' ? '启用' : '停用'
}
