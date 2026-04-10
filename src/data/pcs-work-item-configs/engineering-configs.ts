import type { FieldGroup, WorkItemNature, WorkItemRuntimeType, WorkItemTemplateConfig } from './types.ts'
import { getProjectPhaseNameByCode } from '../pcs-project-phase-definitions.ts'
import { getStandardProjectWorkItemIdentityByCode } from './mappings.ts'

const BUILTIN_CREATED_AT = '2026-04-10 09:00'

function buildFieldGroup(id: string, title: string, description: string, fields: FieldGroup['fields']): FieldGroup {
  return { id, title, description, fields }
}

function buildBuiltinConfig(input: {
  workItemTypeCode: string
  workItemNature: WorkItemNature
  type: WorkItemRuntimeType
  categoryName: string
  description: string
  roleCodes: string[]
  roleNames: string[]
  fieldGroups: FieldGroup[]
  businessRules: string[]
  systemConstraints: string[]
  capabilities?: Partial<WorkItemTemplateConfig['capabilities']>
}): WorkItemTemplateConfig {
  const identity = getStandardProjectWorkItemIdentityByCode(input.workItemTypeCode)
  if (!identity) {
    throw new Error(`未找到标准工作项定义：${input.workItemTypeCode}`)
  }

  const capabilities = {
    canReuse: true,
    canMultiInstance: false,
    canRollback: false,
    canParallel: false,
    ...input.capabilities,
  }

  return {
    id: identity.workItemId,
    workItemId: identity.workItemId,
    code: identity.workItemTypeCode,
    workItemTypeCode: identity.workItemTypeCode,
    name: identity.workItemTypeName,
    workItemTypeName: identity.workItemTypeName,
    phaseCode: identity.phaseCode,
    defaultPhaseName: getProjectPhaseNameByCode(identity.phaseCode),
    type: input.type,
    workItemNature: input.workItemNature,
    stage: getProjectPhaseNameByCode(identity.phaseCode),
    category: input.categoryName,
    categoryName: input.categoryName,
    role: input.roleNames.join(' / '),
    roleCodes: [...input.roleCodes],
    roleNames: [...input.roleNames],
    description: input.description,
    isBuiltin: true,
    isSelectable: true,
    isSelectableForTemplate: true,
    enabledFlag: true,
    capabilities,
    fieldGroups: input.fieldGroups.map((group) => ({ ...group, fields: group.fields.map((field) => ({ ...field })) })),
    businessRules: [...input.businessRules],
    systemConstraints: [...input.systemConstraints],
    attachments: [],
    interactionNotes: [],
    createdAt: BUILTIN_CREATED_AT,
    updatedAt: BUILTIN_CREATED_AT,
  }
}

export const engineeringWorkItemConfigs: Record<string, WorkItemTemplateConfig> = {
  'WI-013': buildBuiltinConfig({
    workItemTypeCode: 'STYLE_ARCHIVE_CREATE',
    workItemNature: '里程碑类',
    type: 'milestone',
    categoryName: '开发推进',
    description: '将测款通过项目沉淀为款式档案主记录。',
    roleCodes: ['archive-admin', 'product-manager'],
    roleNames: ['档案管理员', '商品负责人'],
    fieldGroups: [
      buildFieldGroup('style-archive', '款式档案生成', '记录生成款式档案的输出。', [
        { id: 'style-code', label: '款式编码', type: 'text', required: false, description: '档案生成后的款式编码' },
      ]),
    ],
    businessRules: ['仅测款结论通过项目允许生成款式档案。'],
    systemConstraints: ['生成款式档案后，项目可继续进入工程任务。'],
  }),
  'WI-014': buildBuiltinConfig({
    workItemTypeCode: 'PROJECT_TRANSFER_PREP',
    workItemNature: '里程碑类',
    type: 'milestone',
    categoryName: '开发推进',
    description: '在项目转入商品档案与工程前完成转档准备。',
    roleCodes: ['archive-admin', 'project-owner'],
    roleNames: ['档案管理员', '项目负责人'],
    fieldGroups: [
      buildFieldGroup('transfer-prep', '转档准备', '记录转档准备说明。', [
        { id: 'transfer-note', label: '转档说明', type: 'textarea', required: false, description: '转档准备情况' },
      ]),
    ],
    businessRules: ['转档准备完成后，工程类任务方可正式流转。'],
    systemConstraints: ['项目转档准备为开发推进阶段的里程碑节点。'],
  }),
  'WI-015': buildBuiltinConfig({
    workItemTypeCode: 'PATTERN_TASK',
    workItemNature: '执行类',
    type: 'execute',
    categoryName: '工程任务',
    description: '发起并承接制版任务。',
    roleCodes: ['pattern-maker'],
    roleNames: ['版师'],
    fieldGroups: [
      buildFieldGroup('pattern-task', '制版任务', '记录制版任务发起信息。', [
        { id: 'pattern-brief', label: '制版说明', type: 'textarea', required: false, description: '制版需求说明' },
      ]),
    ],
    businessRules: ['模板选择该节点时，会在项目创建后生成制版任务节点。'],
    systemConstraints: ['制版任务节点来源必须是模板节点。'],
  }),
  'WI-016': buildBuiltinConfig({
    workItemTypeCode: 'PATTERN_ARTWORK_TASK',
    workItemNature: '执行类',
    type: 'execute',
    categoryName: '工程任务',
    description: '发起并承接花型任务。',
    roleCodes: ['artwork-designer'],
    roleNames: ['花型设计师'],
    fieldGroups: [
      buildFieldGroup('artwork-task', '花型任务', '记录花型任务发起信息。', [
        { id: 'artwork-brief', label: '花型说明', type: 'textarea', required: false, description: '花型任务说明' },
      ]),
    ],
    businessRules: ['花型任务仅在涉及花型时由模板显式配置。'],
    systemConstraints: ['花型任务节点来源必须是模板节点。'],
  }),
  'WI-017': buildBuiltinConfig({
    workItemTypeCode: 'FIRST_SAMPLE',
    workItemNature: '执行类',
    type: 'execute',
    categoryName: '工程任务',
    description: '发起首版样衣打样任务。',
    roleCodes: ['sample-room'],
    roleNames: ['打样团队'],
    fieldGroups: [
      buildFieldGroup('first-sample', '首版样衣打样', '记录首版样衣打样要求。', [
        { id: 'first-sample-note', label: '打样说明', type: 'textarea', required: false, description: '首版样衣打样要求' },
      ]),
    ],
    businessRules: ['首版样衣打样节点用于沉淀首版样衣交付。'],
    systemConstraints: ['若模板选择该节点，则项目节点必须保留来源模板信息。'],
  }),
  'WI-018': buildBuiltinConfig({
    workItemTypeCode: 'PRE_PRODUCTION_SAMPLE',
    workItemNature: '执行类',
    type: 'execute',
    categoryName: '工程任务',
    description: '发起产前版样衣任务。',
    roleCodes: ['sample-room'],
    roleNames: ['打样团队'],
    fieldGroups: [
      buildFieldGroup('pre-production', '产前版样衣', '记录产前版样衣要求。', [
        { id: 'pre-production-note', label: '产前样说明', type: 'textarea', required: false, description: '产前版样衣要求' },
      ]),
    ],
    businessRules: ['产前版样衣节点通常位于首版样衣打样之后。'],
    systemConstraints: ['产前版样衣是开发推进阶段的正式工程节点。'],
  }),
  'WI-019': buildBuiltinConfig({
    workItemTypeCode: 'CHANNEL_PRODUCT_PREP',
    workItemNature: '执行类',
    type: 'execute',
    categoryName: '渠道准备',
    description: '准备渠道商品资料与上架前置资料。',
    roleCodes: ['channel-operator'],
    roleNames: ['渠道运营'],
    fieldGroups: [
      buildFieldGroup('channel-prep', '渠道商品准备', '记录渠道商品准备信息。', [
        { id: 'channel-prep-note', label: '准备说明', type: 'textarea', required: false, description: '渠道商品准备说明' },
      ]),
    ],
    businessRules: ['渠道商品准备用于衔接后续渠道商品模块。'],
    systemConstraints: ['该节点只承载项目级准备，不直接生成渠道商品主档。'],
  }),
  'WI-020': buildBuiltinConfig({
    workItemTypeCode: 'SAMPLE_RETAIN_REVIEW',
    workItemNature: '决策类',
    type: 'decision',
    categoryName: '项目收尾',
    description: '评估样衣是否留存以及留存方式。',
    roleCodes: ['sample-admin', 'project-owner'],
    roleNames: ['样衣管理员', '项目负责人'],
    fieldGroups: [
      buildFieldGroup('retain-review', '样衣留存评估', '记录留存评估结论。', [
        { id: 'retain-result', label: '留存结论', type: 'single-select', required: false, description: '留存 / 不留存' },
        { id: 'retain-note', label: '评估说明', type: 'textarea', required: false, description: '留存评估说明' },
      ]),
    ],
    businessRules: ['项目收尾时需明确样衣是否留存。'],
    systemConstraints: ['样衣留存评估不能覆盖项目状态。'],
  }),
  'WI-021': buildBuiltinConfig({
    workItemTypeCode: 'SAMPLE_RETURN_HANDLE',
    workItemNature: '执行类',
    type: 'execute',
    categoryName: '项目收尾',
    description: '执行样衣退回、报废或其他处理动作。',
    roleCodes: ['sample-admin', 'warehouse'],
    roleNames: ['样衣管理员', '仓储'],
    fieldGroups: [
      buildFieldGroup('return-handle', '样衣退回处理', '记录样衣退回处理结果。', [
        { id: 'return-result', label: '处理结果', type: 'textarea', required: false, description: '退回、报废或其他处理说明' },
      ]),
    ],
    businessRules: ['项目收尾时需明确样衣最终处理动作。'],
    systemConstraints: ['样衣退回处理只表示收尾动作，不改变项目阶段目录。'],
  }),
}
