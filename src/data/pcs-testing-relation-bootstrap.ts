import { getVideoItems, listLegacyTestingProjectReferences } from './pcs-testing.ts'
import { listLiveProductLinesBySession, listLiveSessionRecords } from './pcs-live-testing-repository.ts'
import { listVideoTestRecords } from './pcs-video-testing-repository.ts'
import type { ProjectRelationPendingItem, ProjectRelationRecord } from './pcs-project-relation-types.ts'
import {
  buildLiveProductLineProjectRelation,
  buildVideoRecordProjectRelation,
  normalizeLegacyLiveSessionHeaderRelation,
} from './pcs-testing-relation-normalizer.ts'

export interface TestingRelationBootstrapSnapshot {
  relations: ProjectRelationRecord[]
  pendingItems: ProjectRelationPendingItem[]
}

export function createTestingRelationBootstrapSnapshot(): TestingRelationBootstrapSnapshot {
  const relations: ProjectRelationRecord[] = []
  const pendingItems: ProjectRelationPendingItem[] = []

  listLiveSessionRecords().forEach((session) => {
    listLiveProductLinesBySession(session.liveSessionId).forEach((line) => {
      if (!line.legacyProjectRef && !line.legacyProjectId) return
      const result = buildLiveProductLineProjectRelation(line, line.legacyProjectId || line.legacyProjectRef || '', {
        operatorName: '系统初始化',
        note: '',
        legacyRefType: 'liveLine.projectRef',
        legacyRefValue: line.legacyProjectId || line.legacyProjectRef || '',
      })
      if (result.relation) relations.push(result.relation)
      if (result.pendingItem) pendingItems.push(result.pendingItem)
    })
  })

  listVideoTestRecords().forEach((record) => {
    const legacyRefs = Array.from(
      new Set(
        getVideoItems(record.videoRecordId)
          .map((item) => item.projectRef)
          .filter((item): item is string => Boolean(item)),
      ),
    )

    const fallbackRefs = legacyRefs.length > 0 ? legacyRefs : [record.legacyProjectId || record.legacyProjectRef || ''].filter(Boolean)
    fallbackRefs.forEach((projectRef) => {
      const result = buildVideoRecordProjectRelation(record, projectRef, {
        operatorName: '系统初始化',
        legacyRefType: 'videoRecord.projectRef',
        legacyRefValue: projectRef,
      })
      if (result.relation) relations.push(result.relation)
      if (result.pendingItem) pendingItems.push(result.pendingItem)
    })
  })

  listLegacyTestingProjectReferences().forEach((legacy) => {
    if (!legacy.projectRef) return
    if (legacy.sourceType === '直播场次头') {
      const session = listLiveSessionRecords().find((item) => item.liveSessionId === legacy.sourceId)
      if (!session) return
      const result = normalizeLegacyLiveSessionHeaderRelation({
        session,
        productLines: listLiveProductLinesBySession(session.liveSessionId),
        rawProjectCode: legacy.projectRef,
        operatorName: '系统初始化',
      })
      relations.push(...result.relations)
      pendingItems.push(...result.pendingItems)
    }
  })

  return {
    relations,
    pendingItems,
  }
}
