import { listProjectRelationsByLiveProductLine, listProjectRelationsByVideoRecord } from './pcs-project-relation-repository.ts'
import { listLiveProductLinesBySession } from './pcs-live-testing-repository.ts'
import type { LiveProductLine } from './pcs-live-testing-types.ts'
import type { VideoTestRecord } from './pcs-video-testing-types.ts'

export type TestingOwnershipKind = 'FORMAL_PROJECT' | 'LEGACY_HISTORY' | 'INDEPENDENT_HISTORY' | 'MIXED'
export type TestingOwnershipFilter = 'all' | 'formal' | 'history'

export interface TestingOwnershipSummary {
  kind: TestingOwnershipKind
  label: string
  badgeTone: string
  detailText: string
  legacyHintText: string
}

function buildLegacyHintText(legacyProjectRef: string | null | undefined): string {
  if (!legacyProjectRef) return ''
  return `历史项目字段：${legacyProjectRef}，当前仅保留为迁移痕迹。`
}

function buildOwnershipSummary(
  kind: TestingOwnershipKind,
  legacyProjectRef?: string | null,
): TestingOwnershipSummary {
  if (kind === 'FORMAL_PROJECT') {
    return {
      kind,
      label: '正式项目测款',
      badgeTone: 'bg-blue-50 text-blue-700 border-blue-200',
      detailText: '当前样本已纳入正式商品项目链路，页面按正式项目测款展示。',
      legacyHintText: '',
    }
  }
  if (kind === 'LEGACY_HISTORY') {
    return {
      kind,
      label: '历史迁移测款样本',
      badgeTone: 'bg-amber-50 text-amber-700 border-amber-200',
      detailText: '当前样本没有正式项目归属，只保留历史迁移测款记录用于演示。',
      legacyHintText: buildLegacyHintText(legacyProjectRef),
    }
  }
  if (kind === 'MIXED') {
    return {
      kind,
      label: '混合测款样本',
      badgeTone: 'bg-violet-50 text-violet-700 border-violet-200',
      detailText: '当前记录同时包含正式项目测款与历史演示样本，请按商品明细分别查看归属。',
      legacyHintText: '',
    }
  }
  return {
    kind: 'INDEPENDENT_HISTORY',
    label: '独立历史测款样本',
    badgeTone: 'bg-slate-100 text-slate-700 border-slate-200',
    detailText: '当前样本没有正式项目归属，仅作为独立历史演示样本展示。',
    legacyHintText: '',
  }
}

export function getLiveLineOwnershipSummary(line: LiveProductLine): TestingOwnershipSummary {
  const relations = listProjectRelationsByLiveProductLine(line.liveLineId)
  if (relations.length > 0) return buildOwnershipSummary('FORMAL_PROJECT')
  if (line.legacyProjectRef || line.legacyProjectId) {
    return buildOwnershipSummary('LEGACY_HISTORY', line.legacyProjectRef || line.legacyProjectId)
  }
  return buildOwnershipSummary('INDEPENDENT_HISTORY')
}

export function getLiveSessionOwnershipSummary(liveSessionId: string): TestingOwnershipSummary {
  const lines = listLiveProductLinesBySession(liveSessionId)
  if (!lines.length) return buildOwnershipSummary('INDEPENDENT_HISTORY')

  let formalCount = 0
  let legacyCount = 0
  let independentCount = 0

  lines.forEach((line) => {
    const ownership = getLiveLineOwnershipSummary(line)
    if (ownership.kind === 'FORMAL_PROJECT') {
      formalCount += 1
    } else if (ownership.kind === 'LEGACY_HISTORY') {
      legacyCount += 1
    } else {
      independentCount += 1
    }
  })

  if (formalCount > 0 && legacyCount === 0 && independentCount === 0) {
    return buildOwnershipSummary('FORMAL_PROJECT')
  }
  if (formalCount === 0 && legacyCount > 0 && independentCount === 0) {
    return buildOwnershipSummary('LEGACY_HISTORY')
  }
  if (formalCount === 0 && legacyCount === 0 && independentCount > 0) {
    return buildOwnershipSummary('INDEPENDENT_HISTORY')
  }
  return buildOwnershipSummary('MIXED')
}

export function getVideoRecordOwnershipSummary(record: VideoTestRecord): TestingOwnershipSummary {
  const relations = listProjectRelationsByVideoRecord(record.videoRecordId)
  if (relations.length > 0) return buildOwnershipSummary('FORMAL_PROJECT')
  if (record.legacyProjectRef || record.legacyProjectId) {
    return buildOwnershipSummary('LEGACY_HISTORY', record.legacyProjectRef || record.legacyProjectId)
  }
  return buildOwnershipSummary('INDEPENDENT_HISTORY')
}

export function matchTestingOwnershipFilter(
  summary: TestingOwnershipSummary,
  filter: TestingOwnershipFilter,
): boolean {
  if (filter === 'all') return true
  if (filter === 'formal') {
    return summary.kind === 'FORMAL_PROJECT' || summary.kind === 'MIXED'
  }
  return summary.kind === 'LEGACY_HISTORY' || summary.kind === 'INDEPENDENT_HISTORY' || summary.kind === 'MIXED'
}
