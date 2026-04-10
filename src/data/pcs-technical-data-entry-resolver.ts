import { getTechnicalMaintenanceTargetBySpuCode, resolveTechnicalSnapshotBySpuCode } from './pcs-technical-data-runtime-source.ts'

export type TechnicalDataEntryResolutionKind =
  | 'pcs_version'
  | 'pcs_style'
  | 'fcs_compat'
  | 'missing'

export interface TechnicalDataEntryResolution {
  kind: TechnicalDataEntryResolutionKind
  targetPath: string
  targetTitle: string
  styleId: string
  technicalVersionId: string
  message: string
}

export function resolveTechnicalDataEntryBySpuCode(spuCode: string): TechnicalDataEntryResolution {
  const resolution = resolveTechnicalSnapshotBySpuCode(spuCode)
  const target = getTechnicalMaintenanceTargetBySpuCode(spuCode)

  if (resolution.sourceKind === 'pcs_published' && resolution.technicalVersionId) {
    return {
      kind: 'pcs_version',
      targetPath: target.targetPath,
      targetTitle: target.targetTitle,
      styleId: resolution.styleId,
      technicalVersionId: resolution.technicalVersionId,
      message: target.message,
    }
  }

  if (target.kind === 'pcs_style' && resolution.styleId) {
    return {
      kind: 'pcs_style',
      targetPath: target.targetPath,
      targetTitle: target.targetTitle,
      styleId: resolution.styleId,
      technicalVersionId: '',
      message: target.message,
    }
  }

  if (resolution.sourceKind === 'fcs_legacy') {
    return {
      kind: 'fcs_compat',
      targetPath: `/fcs/tech-pack/${encodeURIComponent(spuCode)}`,
      targetTitle: `技术资料兼容查看 - ${spuCode}`,
      styleId: resolution.styleId,
      technicalVersionId: '',
      message: target.message,
    }
  }

  return {
    kind: 'missing',
    targetPath: `/fcs/tech-pack/${encodeURIComponent(spuCode)}`,
    targetTitle: `技术资料兼容查看 - ${spuCode}`,
    styleId: resolution.styleId,
    technicalVersionId: '',
    message: target.message,
  }
}
