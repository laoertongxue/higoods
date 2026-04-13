import {
  getPcsWorkItemById,
  getPcsWorkItemLibraryMeta,
  listPcsWorkItems,
  type PcsWorkItemListItem,
} from './pcs-work-items.ts'
import {
  getProjectWorkItemContractById,
  listProjectWorkItemFieldGroups,
  type PcsProjectNodeFieldDefinition,
  type PcsProjectNodeFieldGroupDefinition,
  type PcsProjectNodeOperationDefinition,
  type PcsProjectNodeStatusDefinition,
  type PcsProjectWorkItemContract,
} from './pcs-project-domain-contract.ts'
import {
  getPcsWorkItemLegacyReference,
  type PcsWorkItemLegacyReference,
  type PcsWorkItemLegacyReferenceUseMode,
} from './pcs-work-item-legacy-reference.ts'
import {
  getPcsWorkItemRuntimeCarrierDefinition,
  type PcsWorkItemLibraryDisplayKind,
  type PcsWorkItemProjectDisplayRequirementCode,
} from './pcs-work-item-runtime-carrier.ts'

export interface PcsWorkItemLibraryOverview {
  totalCount: number
  phaseCount: number
  standaloneCount: number
  projectExecutionCount: number
}

export interface PcsWorkItemLibraryListRow extends PcsWorkItemListItem {
  fieldCount: number
  statusCount: number
  operationCount: number
  libraryDisplayKind: PcsWorkItemLibraryDisplayKind
  runtimeCarrierLabel: string
  hasStandaloneInstanceList: boolean
  standaloneInstanceText: string
  primaryModuleOrDisplay: string
  primaryModuleHint: string
  legacyReferenceUseMode: PcsWorkItemLegacyReferenceUseMode | null
}

export interface PcsWorkItemFieldRow {
  groupTitle: string
  groupDescription: string
  label: string
  fieldKey: string
  type: string
  required: boolean
  readonly: boolean
  meaning: string
  sourceText: string
  sourceKind: string
  sourceRef: string
  fromLegacyReference: boolean
}

export interface PcsWorkItemDetailViewModel {
  item: PcsWorkItemListItem
  contract: PcsProjectWorkItemContract
  meta: NonNullable<ReturnType<typeof getPcsWorkItemLibraryMeta>>
  runtimeCarrier: ReturnType<typeof getPcsWorkItemRuntimeCarrierDefinition>
  legacyReference: PcsWorkItemLegacyReference | null
  fieldGroups: Array<PcsProjectNodeFieldGroupDefinition & { rows: PcsWorkItemFieldRow[] }>
  fieldRows: PcsWorkItemFieldRow[]
  statusDefinitions: PcsProjectNodeStatusDefinition[]
  operationDefinitions: PcsProjectNodeOperationDefinition[]
  projectDisplayRequirementText: string
  projectDisplayReasonText: string
}

const PROJECT_DISPLAY_REQUIREMENT_TEXT: Record<PcsWorkItemProjectDisplayRequirementCode, string> = {
  STANDALONE_INSTANCE_LIST: '项目节点里展示当前关联实例摘要和跳转入口。',
  PROJECT_INLINE_RECORDS: '项目节点里默认展示记录列表、字段定义、状态和操作。',
  PROJECT_INLINE_SINGLE: '项目节点里默认展示完整字段定义、当前值、状态和操作。',
  PROJECT_AGGREGATE: '项目节点里默认展示聚合对象摘要与当前操作。',
}

function getPrimaryModuleOrDisplay(
  meta: NonNullable<ReturnType<typeof getPcsWorkItemLibraryMeta>>,
): { primaryModuleOrDisplay: string; primaryModuleHint: string } {
  if (meta.runtimeCarrierMode === 'PROJECT_RECORD') {
    return {
      primaryModuleOrDisplay: meta.moduleName,
      primaryModuleHint: meta.listRoute ? `主入口：${meta.listRoute}` : '通过商品项目列表与项目详情查看。',
    }
  }

  if (meta.hasStandaloneInstanceList) {
    return {
      primaryModuleOrDisplay: meta.moduleName,
      primaryModuleHint: meta.listRoute ? `列表入口：${meta.listRoute}` : '在对应正式模块中查看实例列表。',
    }
  }

  if (meta.projectDisplayRequirementCode === 'PROJECT_INLINE_RECORDS') {
    return {
      primaryModuleOrDisplay: '项目内记录列表',
      primaryModuleHint: '项目节点内按记录列表展示当前实例、状态和操作。',
    }
  }

  if (meta.projectDisplayRequirementCode === 'PROJECT_AGGREGATE') {
    return {
      primaryModuleOrDisplay: '聚合节点',
      primaryModuleHint: '项目节点内按聚合摘要展示当前链路、聚合结果和当前动作。',
    }
  }

  return {
    primaryModuleOrDisplay: '项目内单节点完整详情',
    primaryModuleHint: '项目节点内直接展示当前字段定义、状态和操作。',
  }
}

export function buildPcsWorkItemLibraryOverview(): PcsWorkItemLibraryOverview {
  const rows = listPcsWorkItemLibraryRows()
  return {
    totalCount: rows.length,
    phaseCount: new Set(rows.map((item) => item.phaseCode)).size,
    standaloneCount: rows.filter((item) => item.hasStandaloneInstanceList).length,
    projectExecutionCount: rows.filter(
      (item) => item.meta.projectDisplayRequirementCode !== 'STANDALONE_INSTANCE_LIST',
    ).length,
  }
}

export function listPcsWorkItemLibraryRows(): Array<PcsWorkItemLibraryListRow & { meta: NonNullable<ReturnType<typeof getPcsWorkItemLibraryMeta>> }> {
  return listPcsWorkItems().map((item) => {
    const meta = getPcsWorkItemLibraryMeta(item.id)
    if (!meta) {
      throw new Error(`未找到工作项目录元数据：${item.id}`)
    }
    const primary = getPrimaryModuleOrDisplay(meta)
    return {
      ...item,
      meta,
      fieldCount: meta.fieldCount,
      statusCount: meta.statusCount,
      operationCount: meta.operationCount,
      libraryDisplayKind: meta.libraryDisplayKind,
      runtimeCarrierLabel: meta.runtimeCarrierLabel,
      hasStandaloneInstanceList: meta.hasStandaloneInstanceList,
      standaloneInstanceText: meta.hasStandaloneInstanceList ? '是' : '否',
      primaryModuleOrDisplay: primary.primaryModuleOrDisplay,
      primaryModuleHint: primary.primaryModuleHint,
      legacyReferenceUseMode: meta.legacyReferenceUseMode,
    }
  })
}

function buildFieldRow(
  field: PcsProjectNodeFieldDefinition,
  legacyReference: PcsWorkItemLegacyReference | null,
): PcsWorkItemFieldRow {
  const fromLegacyReference = Boolean(
    legacyReference?.legacyFieldLabels.some((label) => label === field.label),
  )
  return {
    groupTitle: field.groupTitle,
    groupDescription: field.groupDescription,
    label: field.label,
    fieldKey: field.fieldKey,
    type: field.type,
    required: field.required,
    readonly: field.readonly,
    meaning: field.meaning,
    sourceText: `${field.sourceKind} / ${field.sourceRef}`,
    sourceKind: field.sourceKind,
    sourceRef: field.sourceRef,
    fromLegacyReference,
  }
}

export function getPcsWorkItemDetailViewModel(workItemId: string): PcsWorkItemDetailViewModel | null {
  const item = getPcsWorkItemById(workItemId)
  const contract = getProjectWorkItemContractById(workItemId)
  const meta = getPcsWorkItemLibraryMeta(workItemId)
  if (!item || !contract || !meta) return null

  const runtimeCarrier = getPcsWorkItemRuntimeCarrierDefinition(contract.workItemTypeCode)
  const legacyReference = getPcsWorkItemLegacyReference(contract.workItemTypeCode)
  const fieldGroups = listProjectWorkItemFieldGroups(contract.workItemTypeCode).map((group) => ({
    ...group,
    rows: group.fields.map((field) => buildFieldRow(field, legacyReference)),
  }))
  const fieldRows = fieldGroups.flatMap((group) => group.rows)

  return {
    item,
    contract,
    meta,
    runtimeCarrier,
    legacyReference,
    fieldGroups,
    fieldRows,
    statusDefinitions: contract.statusDefinitions.map((status) => ({
      ...status,
      entryConditions: [...status.entryConditions],
      exitConditions: [...status.exitConditions],
    })),
    operationDefinitions: contract.operationDefinitions.map((operation) => ({
      ...operation,
      preconditions: [...operation.preconditions],
      effects: [...operation.effects],
      writebackRules: [...operation.writebackRules],
    })),
    projectDisplayRequirementText:
      PROJECT_DISPLAY_REQUIREMENT_TEXT[runtimeCarrier.projectDisplayRequirementCode],
    projectDisplayReasonText: runtimeCarrier.carrierReason,
  }
}
