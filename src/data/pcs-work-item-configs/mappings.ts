import { getProjectPhaseNameByCode } from '../pcs-project-phase-definitions.ts'
import {
  listProjectWorkItemContracts,
  PCS_PROJECT_WORK_ITEM_LEGACY_MAPPINGS,
  type PcsProjectWorkItemCode,
} from '../pcs-project-domain-contract.ts'

export interface StandardProjectWorkItemIdentity {
  workItemId: string
  workItemTypeCode: PcsProjectWorkItemCode
  workItemTypeName: string
  phaseCode: string
}

export const STANDARD_PROJECT_WORK_ITEM_IDENTITIES: StandardProjectWorkItemIdentity[] = listProjectWorkItemContracts().map(
  (item) => ({
    workItemId: item.workItemId,
    workItemTypeCode: item.workItemTypeCode,
    workItemTypeName: item.workItemTypeName,
    phaseCode: item.phaseCode,
  }),
)

export type WorkItemType = PcsProjectWorkItemCode

export const workItemIdMap: Record<string, string> = Object.fromEntries(
  STANDARD_PROJECT_WORK_ITEM_IDENTITIES.map((item) => [item.workItemId, item.workItemTypeCode]),
)

export const typeToIdMap: Record<WorkItemType, string> = Object.fromEntries(
  STANDARD_PROJECT_WORK_ITEM_IDENTITIES.map((item) => [item.workItemTypeCode, item.workItemId]),
) as Record<WorkItemType, string>

const identityById = new Map(STANDARD_PROJECT_WORK_ITEM_IDENTITIES.map((item) => [item.workItemId, item]))
const identityByCode = new Map(STANDARD_PROJECT_WORK_ITEM_IDENTITIES.map((item) => [item.workItemTypeCode, item]))
const identityByName = new Map(
  STANDARD_PROJECT_WORK_ITEM_IDENTITIES.map((item) => [normalizeLegacyWorkItemName(item.workItemTypeName), item]),
)

export interface LegacyProjectWorkItemMapping {
  legacyName: string
  legacyCode?: string
  workItemTypeCode: WorkItemType
}

export const LEGACY_PROJECT_WORK_ITEM_MAPPINGS: LegacyProjectWorkItemMapping[] = PCS_PROJECT_WORK_ITEM_LEGACY_MAPPINGS
  .filter((item) => item.legacyName)
  .map((item) => ({
    legacyName: item.legacyName as string,
    legacyCode: item.legacyCode,
    workItemTypeCode: item.workItemTypeCode,
  }))

const legacyMappingByName = new Map(
  LEGACY_PROJECT_WORK_ITEM_MAPPINGS.map((item) => [
    normalizeLegacyWorkItemName(item.legacyName),
    getStandardProjectWorkItemIdentityByCode(item.workItemTypeCode) as StandardProjectWorkItemIdentity,
  ]),
)

export function normalizeLegacyWorkItemName(name: string): string {
  return name.trim().replace(/\s+/g, '')
}

export function listStandardProjectWorkItemIdentities(): StandardProjectWorkItemIdentity[] {
  return STANDARD_PROJECT_WORK_ITEM_IDENTITIES.map((item) => ({ ...item }))
}

export function getStandardProjectWorkItemIdentityById(
  workItemId: string,
): StandardProjectWorkItemIdentity | null {
  const found = identityById.get(workItemId)
  return found ? { ...found } : null
}

export function getStandardProjectWorkItemIdentityByCode(
  workItemTypeCode: string,
): StandardProjectWorkItemIdentity | null {
  const found = identityByCode.get(workItemTypeCode as WorkItemType)
  return found ? { ...found } : null
}

export function getStandardProjectWorkItemIdentityByName(
  workItemTypeName: string,
): StandardProjectWorkItemIdentity | null {
  const found = identityByName.get(normalizeLegacyWorkItemName(workItemTypeName))
  return found ? { ...found } : null
}

export function resolveLegacyProjectWorkItemIdentity(
  legacyName: string,
): StandardProjectWorkItemIdentity | null {
  const normalized = normalizeLegacyWorkItemName(legacyName)
  const byName = legacyMappingByName.get(normalized)
  if (byName) return { ...byName }
  const byCode = PCS_PROJECT_WORK_ITEM_LEGACY_MAPPINGS.find((item) => item.legacyCode === legacyName)
  return byCode ? getStandardProjectWorkItemIdentityByCode(byCode.workItemTypeCode) : null
}

export function resolveLegacyProjectWorkItemTypeCode(name: string): string | null {
  return resolveLegacyProjectWorkItemIdentity(name)?.workItemTypeCode ?? null
}

export function resolveLegacyProjectWorkItemId(name: string): string | null {
  return resolveLegacyProjectWorkItemIdentity(name)?.workItemId ?? null
}

export function getDefaultPhaseNameByWorkItemCode(workItemTypeCode: string): string {
  const identity = getStandardProjectWorkItemIdentityByCode(workItemTypeCode)
  return identity ? getProjectPhaseNameByCode(identity.phaseCode) : ''
}

