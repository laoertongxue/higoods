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

export const sampleWorkItemConfigs: Record<string, WorkItemTemplateConfig> = {
  'WI-004': buildBuiltinConfig({
    workItemTypeCode: 'FEASIBILITY_REVIEW',
    workItemNature: '决策类',
    type: 'decision',
    categoryName: '样衣评估',
    description: '从版型、工艺、面料和供应可行性判断项目是否继续推进。',
    roleCodes: ['product-manager', 'buyer'],
    roleNames: ['商品负责人', '采购'],
    fieldGroups: [
      buildFieldGroup('feasibility', '可行性判断', '沉淀可行性结论和风险项。', [
        { id: 'review-conclusion', label: '判断结论', type: 'single-select', required: true, description: '通过 / 调整 / 暂缓' },
        { id: 'review-risk', label: '风险说明', type: 'textarea', required: false, description: '当前主要风险' },
      ]),
    ],
    businessRules: ['未完成可行性判断前，不允许进入样衣确认。'],
    systemConstraints: ['可行性判断作为样衣与评估阶段的前置决策。'],
  }),
  'WI-005': buildBuiltinConfig({
    workItemTypeCode: 'SAMPLE_SHOOT_FIT',
    workItemNature: '执行类',
    type: 'execute',
    categoryName: '样衣评估',
    description: '完成样衣拍摄、试穿和版型反馈整理。',
    roleCodes: ['content-operator', 'fit-manager'],
    roleNames: ['内容运营', '试穿负责人'],
    fieldGroups: [
      buildFieldGroup('shoot-fit', '拍摄与试穿', '沉淀试穿与拍摄反馈。', [
        { id: 'shoot-plan', label: '拍摄安排', type: 'textarea', required: false, description: '拍摄与试穿安排' },
        { id: 'fit-feedback', label: '试穿反馈', type: 'textarea', required: false, description: '版型与上身反馈' },
      ]),
    ],
    businessRules: ['样衣拍摄与试穿完成后，样衣确认节点才能形成完整结论。'],
    systemConstraints: ['允许与样衣核价并行推进。'],
    capabilities: { canParallel: true },
  }),
  'WI-006': buildBuiltinConfig({
    workItemTypeCode: 'SAMPLE_CONFIRM',
    workItemNature: '决策类',
    type: 'decision',
    categoryName: '样衣评估',
    description: '结合拍摄、试穿和供应反馈确认样衣是否通过。',
    roleCodes: ['project-owner', 'product-manager'],
    roleNames: ['项目负责人', '商品负责人'],
    fieldGroups: [
      buildFieldGroup('sample-confirm', '样衣确认', '输出样衣确认结论。', [
        { id: 'confirm-result', label: '确认结论', type: 'single-select', required: true, description: '通过 / 继续调整 / 淘汰' },
        { id: 'confirm-note', label: '确认说明', type: 'textarea', required: false, description: '补充说明' },
      ]),
    ],
    businessRules: ['样衣确认是样衣与评估阶段的关键决策节点。'],
    systemConstraints: ['样衣确认未通过时，后续测款节点不得启动。'],
  }),
  'WI-007': buildBuiltinConfig({
    workItemTypeCode: 'SAMPLE_COST_REVIEW',
    workItemNature: '执行类',
    type: 'execute',
    categoryName: '样衣评估',
    description: '评估样衣成本构成，为定价和后续开发提供依据。',
    roleCodes: ['cost-controller', 'supply-chain'],
    roleNames: ['成本专员', '供应链'],
    fieldGroups: [
      buildFieldGroup('cost-review', '核价信息', '记录样衣成本测算结果。', [
        { id: 'cost-total', label: '核价结果', type: 'number', required: false, description: '核价金额', unit: '元' },
        { id: 'cost-note', label: '核价说明', type: 'textarea', required: false, description: '成本结构说明' },
      ]),
    ],
    businessRules: ['样衣核价结果将作为样衣定价的输入。'],
    systemConstraints: ['允许与样衣拍摄与试穿并行。'],
    capabilities: { canParallel: true },
  }),
  'WI-008': buildBuiltinConfig({
    workItemTypeCode: 'SAMPLE_PRICING',
    workItemNature: '决策类',
    type: 'decision',
    categoryName: '样衣评估',
    description: '基于核价结果给出样衣阶段定价建议。',
    roleCodes: ['product-manager', 'finance'],
    roleNames: ['商品负责人', '财务'],
    fieldGroups: [
      buildFieldGroup('pricing', '定价结论', '记录定价策略与结论。', [
        { id: 'price-range', label: '价格带', type: 'single-select', required: false, description: '目标价格带' },
        { id: 'pricing-note', label: '定价说明', type: 'textarea', required: false, description: '定价依据' },
      ]),
    ],
    businessRules: ['样衣定价完成后，项目方可进入市场测款。'],
    systemConstraints: ['样衣定价为项目推进的正式决策记录。'],
  }),
}
