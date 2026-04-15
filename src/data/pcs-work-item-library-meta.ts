import {
  getProjectWorkItemContractById,
  listProjectWorkItemContracts,
} from './pcs-project-domain-contract.ts'
import {
  LEGACY_PROJECT_WORK_ITEM_MAPPINGS,
} from './pcs-work-item-configs/mappings.ts'
import {
  getPcsWorkItemRuntimeCarrierDefinition,
  listPcsWorkItemRuntimeCarrierDefinitions,
  type PcsWorkItemLibraryDisplayKind,
  type PcsWorkItemProjectDisplayRequirementCode,
  type PcsWorkItemRuntimeCarrierMode,
} from './pcs-work-item-runtime-carrier.ts'
import {
  getPcsWorkItemLegacyReference,
  type PcsWorkItemLegacyReferenceUseMode,
} from './pcs-work-item-legacy-reference.ts'

export interface PcsWorkItemLibraryMeta {
  workItemId: string
  workItemTypeCode: string
  fieldCount: number
  statusCount: number
  nodeStatusCount: number
  instanceStatusCount: number
  operationCount: number
  runtimeCarrierMode: PcsWorkItemRuntimeCarrierMode
  runtimeCarrierLabel: string
  libraryDisplayKind: PcsWorkItemLibraryDisplayKind
  projectDisplayRequirementCode: PcsWorkItemProjectDisplayRequirementCode
  projectDisplayRequirementLabel: string
  hasStandaloneInstanceList: boolean
  moduleName: string
  listRoute: string | null
  projectDisplayMode: string
  carrierReason: string
  legacyReferenceCodes: string[]
  legacyReferenceNames: string[]
  legacyReferenceUseMode: PcsWorkItemLegacyReferenceUseMode | null
}

function collectLegacyReferenceCodes(workItemTypeCode: string): string[] {
  return Array.from(
    new Set(
      LEGACY_PROJECT_WORK_ITEM_MAPPINGS
        .filter((item) => item.workItemTypeCode === workItemTypeCode)
        .flatMap((item) => [item.legacyCode, item.legacyName].filter(Boolean) as string[]),
    ),
  )
}

export function buildPcsWorkItemLibraryMeta(workItemId: string): PcsWorkItemLibraryMeta | null {
  const contract = getProjectWorkItemContractById(workItemId)
  if (!contract) return null
  const carrier = getPcsWorkItemRuntimeCarrierDefinition(contract.workItemTypeCode)
  const legacyReference = getPcsWorkItemLegacyReference(contract.workItemTypeCode)
  const legacyReferenceCodes = Array.from(
    new Set([
      ...collectLegacyReferenceCodes(contract.workItemTypeCode),
      ...(legacyReference?.legacyCodes ?? []),
    ]),
  )
  return {
    workItemId: contract.workItemId,
    workItemTypeCode: contract.workItemTypeCode,
    fieldCount: contract.fieldDefinitions.length,
    statusCount: contract.statusDefinitions.length + (contract.instanceStatusDefinitions?.length ?? 0),
    nodeStatusCount: contract.statusDefinitions.length,
    instanceStatusCount: contract.instanceStatusDefinitions?.length ?? 0,
    operationCount: contract.operationDefinitions.length,
    runtimeCarrierMode: carrier.runtimeCarrierMode,
    runtimeCarrierLabel: carrier.runtimeCarrierLabel,
    libraryDisplayKind: carrier.libraryDisplayKind,
    projectDisplayRequirementCode: carrier.projectDisplayRequirementCode,
    projectDisplayRequirementLabel: carrier.projectDisplayRequirementLabel,
    hasStandaloneInstanceList: carrier.hasStandaloneInstanceList,
    moduleName: carrier.moduleName,
    listRoute: carrier.listRoute,
    projectDisplayMode: carrier.projectDisplayMode,
    carrierReason: carrier.carrierReason,
    legacyReferenceCodes,
    legacyReferenceNames: legacyReference?.legacyNames ?? [],
    legacyReferenceUseMode: legacyReference?.referenceUseMode ?? null,
  }
}

export function listPcsWorkItemLibraryMetas(): PcsWorkItemLibraryMeta[] {
  const runtimeCarriers = new Set(
    listPcsWorkItemRuntimeCarrierDefinitions().map((item) => item.workItemTypeCode),
  )
  return listProjectWorkItemContracts().map((contract) => {
    if (!runtimeCarriers.has(contract.workItemTypeCode)) {
      throw new Error(`工作项未配置运行时承载方式：${contract.workItemTypeCode}`)
    }
    return buildPcsWorkItemLibraryMeta(contract.workItemId) as PcsWorkItemLibraryMeta
  })
}
