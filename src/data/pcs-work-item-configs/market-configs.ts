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

export const marketWorkItemConfigs: Record<string, WorkItemTemplateConfig> = {
  'WI-009': buildBuiltinConfig({
    workItemTypeCode: 'VIDEO_TEST',
    workItemNature: '事实类',
    type: 'fact',
    categoryName: '测款验证',
    description: '记录短视频测款结果，为市场验证提供事实数据。',
    roleCodes: ['content-operator'],
    roleNames: ['内容运营'],
    fieldGroups: [
      buildFieldGroup('video-test', '短视频测款记录', '沉淀短视频测款反馈。', [
        { id: 'video-channel', label: '投放渠道', type: 'text', required: false, description: '测款渠道' },
        { id: 'video-result', label: '测款结果', type: 'textarea', required: false, description: '兴趣与互动反馈' },
      ]),
    ],
    businessRules: ['短视频测款可重复执行并沉淀多轮记录。'],
    systemConstraints: ['作为事实节点，不直接改变项目状态。'],
    capabilities: { canMultiInstance: true, canParallel: true },
  }),
  'WI-010': buildBuiltinConfig({
    workItemTypeCode: 'LIVE_TEST',
    workItemNature: '事实类',
    type: 'fact',
    categoryName: '测款验证',
    description: '记录直播测款结果，为项目结论提供成交反馈。',
    roleCodes: ['live-operator', 'anchor-team'],
    roleNames: ['直播运营', '主播团队'],
    fieldGroups: [
      buildFieldGroup('live-test', '直播测款记录', '沉淀直播测款反馈。', [
        { id: 'live-session', label: '直播场次', type: 'text', required: false, description: '直播场次标识' },
        { id: 'live-result', label: '直播结果', type: 'textarea', required: false, description: '成交与互动反馈' },
      ]),
    ],
    businessRules: ['直播测款可多场执行，最终由测款数据汇总节点统一沉淀。'],
    systemConstraints: ['作为事实节点，不直接改变项目状态。'],
    capabilities: { canMultiInstance: true, canParallel: true },
  }),
  'WI-011': buildBuiltinConfig({
    workItemTypeCode: 'TEST_DATA_SUMMARY',
    workItemNature: '执行类',
    type: 'execute',
    categoryName: '测款验证',
    description: '汇总短视频与直播的测款数据，形成统一分析底稿。',
    roleCodes: ['data-analyst', 'product-manager'],
    roleNames: ['数据分析', '商品负责人'],
    fieldGroups: [
      buildFieldGroup('test-summary', '测款数据汇总', '汇总测款数据并输出摘要。', [
        { id: 'summary-text', label: '汇总结论', type: 'textarea', required: false, description: '测款数据摘要' },
      ]),
    ],
    businessRules: ['需在至少一项事实测款节点有数据后再汇总。'],
    systemConstraints: ['测款数据汇总作为测款结论判定的直接输入。'],
  }),
  'WI-012': buildBuiltinConfig({
    workItemTypeCode: 'TEST_CONCLUSION',
    workItemNature: '决策类',
    type: 'decision',
    categoryName: '测款验证',
    description: '根据测款数据输出项目继续推进、调整或收尾结论。',
    roleCodes: ['project-owner', 'product-manager'],
    roleNames: ['项目负责人', '商品负责人'],
    fieldGroups: [
      buildFieldGroup('test-conclusion', '测款结论', '输出正式测款结论。', [
        { id: 'conclusion', label: '结论判定', type: 'single-select', required: true, description: '通过 / 调整 / 暂缓 / 淘汰' },
        { id: 'conclusion-note', label: '结论说明', type: 'textarea', required: false, description: '补充说明' },
      ]),
    ],
    businessRules: ['测款结论判定是进入开发推进的唯一正式决策入口。'],
    systemConstraints: ['测款结论未通过时，开发推进阶段节点保持未开始。'],
  }),
}
