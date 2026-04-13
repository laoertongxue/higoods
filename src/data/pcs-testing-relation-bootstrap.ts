import { getVideoItems, listLegacyTestingProjectReferences } from './pcs-testing.ts'
import {
  getLiveProductLineById,
  listLiveProductLinesBySession,
  listLiveSessionRecords,
} from './pcs-live-testing-repository.ts'
import { getVideoTestRecordById, listVideoTestRecords } from './pcs-video-testing-repository.ts'
import { createProjectChannelProductRelationBootstrapSnapshot } from './pcs-channel-product-project-repository.ts'
import type { ProjectRelationPendingItem, ProjectRelationRecord } from './pcs-project-relation-types.ts'
import {
  buildHistoricalLiveProductLineProjectRelation,
  buildHistoricalVideoRecordProjectRelation,
  normalizeLegacyLiveSessionHeaderRelation,
} from './pcs-testing-relation-normalizer.ts'

export interface TestingRelationBootstrapSnapshot {
  relations: ProjectRelationRecord[]
  pendingItems: ProjectRelationPendingItem[]
}

export function createTestingRelationBootstrapSnapshot(): TestingRelationBootstrapSnapshot {
  const channelSnapshot = createProjectChannelProductRelationBootstrapSnapshot()
  const relations: ProjectRelationRecord[] = [...channelSnapshot.relations]
  const pendingItems: ProjectRelationPendingItem[] = []

  listLiveSessionRecords().forEach((session) => {
    listLiveProductLinesBySession(session.liveSessionId).forEach((line) => {
      if (!line.legacyProjectRef && !line.legacyProjectId) return
      const result = buildHistoricalLiveProductLineProjectRelation(line, line.legacyProjectId || line.legacyProjectRef || '', {
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
      const result = buildHistoricalVideoRecordProjectRelation(record, projectRef, {
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
        skipTestingGate: true,
      })
      relations.push(...result.relations)
      pendingItems.push(...result.pendingItems)
    }
  })

  channelSnapshot.records.forEach((record) => {
    if (record.linkedLiveLineId) {
      const liveLine = getLiveProductLineById(record.linkedLiveLineId)
      if (liveLine) {
        const result = buildHistoricalLiveProductLineProjectRelation(liveLine, record.projectId, {
          operatorName: '系统初始化',
          note: '历史渠道商品已挂接直播测款记录，已回放正式直播关系。',
          legacyRefType: 'channelProduct.linkedLiveLineId',
          legacyRefValue: record.linkedLiveLineId,
        })
        if (result.relation) relations.push(result.relation)
        if (result.pendingItem) pendingItems.push(result.pendingItem)
      }
    }

    if (record.linkedVideoRecordId) {
      const videoRecord = getVideoTestRecordById(record.linkedVideoRecordId)
      if (videoRecord) {
        const result = buildHistoricalVideoRecordProjectRelation(videoRecord, record.projectId, {
          operatorName: '系统初始化',
          note: '历史渠道商品已挂接短视频测款记录，已回放正式短视频关系。',
          legacyRefType: 'channelProduct.linkedVideoRecordId',
          legacyRefValue: record.linkedVideoRecordId,
        })
        if (result.relation) relations.push(result.relation)
        if (result.pendingItem) pendingItems.push(result.pendingItem)
      }
    }
  })

  return {
    relations,
    pendingItems,
  }
}
