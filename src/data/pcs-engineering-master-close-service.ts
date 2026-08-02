import { assertEngineeringBomPricingSnapshotValid } from './pcs-engineering-bom-snapshot-validation.ts'
import {
  commitEngineeringMasterOrderClose,
  getEngineeringMasterOrderById,
  runEngineeringMasterRepositoryTransaction,
  validateEngineeringMasterOrderCloseState,
} from './pcs-engineering-master-repository.ts'
import type { EngineeringMasterOrderRecord } from './pcs-engineering-master-types.ts'
import { getStyleArchiveById } from './pcs-style-archive-repository.ts'
import {
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
} from './pcs-technical-data-version-repository.ts'

export interface EngineeringMasterOrderCloseValidation {
  canClose: true
  masterOrderId: string
  technicalVersionId: string
}

export function validateEngineeringMasterOrderClose(
  masterOrderId: string,
): EngineeringMasterOrderCloseValidation {
  const stateValidation = validateEngineeringMasterOrderCloseState(masterOrderId)
  const master = getEngineeringMasterOrderById(stateValidation.masterOrderId)
  if (!master) throw new Error(`工程主单不存在：${masterOrderId}`)
  const style = getStyleArchiveById(master.styleId)
  if (!style?.currentTechPackVersionId) throw new Error('主单款式尚未启用正式技术包，不能关闭工程主单。')
  const version = getTechnicalDataVersionById(style.currentTechPackVersionId)
  if (
    !version
    || version.styleId !== master.styleId
    || version.sourceProjectId !== master.masterOrderId
    || version.createdFromTaskType !== 'ENGINEERING_MASTER'
    || version.createdFromTaskId !== `${master.masterOrderId}-TECH_PACK_CONFIRMATION`
    || version.versionStatus !== 'PUBLISHED'
    || version.reviewStage !== '已发布'
  ) {
    throw new Error('主单来源技术包未完成审核发布并启用，不能关闭工程主单。')
  }
  const content = getTechnicalDataVersionContent(version.technicalVersionId)
  if (!content?.bomPricingSnapshot) throw new Error('正式技术包缺少 BOM 与价格正式快照，不能关闭工程主单。')
  assertEngineeringBomPricingSnapshotValid(content.bomPricingSnapshot)
  return {
    canClose: true,
    masterOrderId: master.masterOrderId,
    technicalVersionId: version.technicalVersionId,
  }
}

export function closeEngineeringMasterOrder(
  masterOrderId: string,
  operatorName: string,
): EngineeringMasterOrderRecord {
  return runEngineeringMasterRepositoryTransaction(() => {
    const validation = validateEngineeringMasterOrderClose(masterOrderId)
    return commitEngineeringMasterOrderClose(validation.masterOrderId, operatorName)
  })
}
