import assert from 'node:assert/strict'

import { getProjectStoreSnapshot } from '../src/data/pcs-project-repository.ts'
import { listProjectRelationsByProject } from '../src/data/pcs-project-relation-repository.ts'
import { listProjectChannelProducts } from '../src/data/pcs-channel-product-project-repository.ts'

listProjectChannelProducts()
const snapshot = getProjectStoreSnapshot()

snapshot.projects.forEach((project) => {
  const relations = listProjectRelationsByProject(project.projectId)
  const hasTestingRelation = relations.some(
    (item) => item.sourceObjectType === '直播商品明细' || item.sourceObjectType === '短视频记录',
  )
  if (!hasTestingRelation) return

  assert.ok(
    relations.some(
      (item) =>
        item.workItemTypeCode === 'CHANNEL_PRODUCT_LISTING' &&
        item.sourceModule === '渠道商品' &&
        item.sourceObjectType === '渠道商品',
    ),
    `${project.projectCode} 存在直播或短视频正式关系时，必须存在 CHANNEL_PRODUCT_LISTING 正式渠道商品关系`,
  )
})

console.log('check-pcs-channel-product-listing-relations.ts PASS')
