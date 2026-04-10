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

export const projectWorkItemConfigs: Record<string, WorkItemTemplateConfig> = {
  'WI-001': buildBuiltinConfig({
    workItemTypeCode: 'PROJECT_INIT',
    workItemNature: '执行类',
    type: 'execute',
    categoryName: '项目启动',
    description: '沉淀商品项目立项主数据，作为项目主记录的创建来源。',
    roleCodes: ['project-owner', 'product-manager'],
    roleNames: ['项目负责人', '商品负责人'],
    fieldGroups: [
      buildFieldGroup('project-basic', '项目立项信息', '沉淀立项基础信息。', [
        { id: 'project-name', label: '项目名称', type: 'text', required: true, description: '商品项目正式名称' },
        { id: 'template-id', label: '项目模板', type: 'reference', required: true, description: '所选模板' },
        { id: 'owner', label: '负责人', type: 'user-select', required: true, description: '项目负责人' },
      ]),
    ],
    businessRules: ['一个商品项目只能存在一个有效的商品项目立项节点。'],
    systemConstraints: ['完成后生成项目主记录。'],
    capabilities: { canReuse: false },
  }),
  'WI-002': buildBuiltinConfig({
    workItemTypeCode: 'SAMPLE_ACQUIRE',
    workItemNature: '执行类',
    type: 'execute',
    categoryName: '样衣来源',
    description: '登记样衣来源方式、来源方和成本信息。',
    roleCodes: ['buyer', 'sample-coordinator'],
    roleNames: ['采购', '样衣专员'],
    fieldGroups: [
      buildFieldGroup('sample-source', '样衣获取信息', '记录样衣获取来源。', [
        { id: 'sample-source-type', label: '样衣来源方式', type: 'single-select', required: true, description: '外采 / 自打样 / 委托打样' },
        { id: 'supplier', label: '样衣来源方', type: 'reference', required: false, description: '来源供应方' },
        { id: 'sample-link', label: '外采链接', type: 'url', required: false, description: '外采时填写' },
      ]),
    ],
    businessRules: ['外采场景至少填写外采链接或样衣单价。'],
    systemConstraints: ['允许在不同项目中重复复用样衣获取记录。'],
    capabilities: { canMultiInstance: true, canRollback: true, canParallel: true },
  }),
  'WI-003': buildBuiltinConfig({
    workItemTypeCode: 'SAMPLE_INBOUND_CHECK',
    workItemNature: '执行类',
    type: 'execute',
    categoryName: '样衣核对',
    description: '确认到样信息、样衣编号和实物状态。',
    roleCodes: ['sample-admin', 'warehouse'],
    roleNames: ['样衣管理员', '仓储'],
    fieldGroups: [
      buildFieldGroup('sample-check', '到样核对', '记录样衣入库与核对结果。', [
        { id: 'sample-code', label: '样衣编号', type: 'text', required: false, readonly: true, description: '系统编号' },
        { id: 'arrival-time', label: '到样时间', type: 'datetime', required: false, description: '实际到样时间' },
        { id: 'check-result', label: '核对结果', type: 'textarea', required: false, description: '核对说明' },
      ]),
    ],
    businessRules: ['样衣入库后方可进入样衣评估阶段。'],
    systemConstraints: ['未完成到样核对前，后续样衣评估节点保持未开始。'],
  }),
}
