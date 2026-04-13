import assert from 'node:assert/strict'

import { PCS_PROJECT_NODE_MIN_COVERAGE_PLAN } from '../src/data/pcs-project-demo-coverage-plan.ts'
import { listProjects } from '../src/data/pcs-project-repository.ts'
import { listProjectInlineNodeRecordsByWorkItemType } from '../src/data/pcs-project-inline-node-record-repository.ts'
import { listProjectChannelProducts } from '../src/data/pcs-channel-product-project-repository.ts'
import { createTestingRelationBootstrapSnapshot } from '../src/data/pcs-testing-relation-bootstrap.ts'
import { listPlateMakingTasks } from '../src/data/pcs-plate-making-repository.ts'
import { listPatternTasks } from '../src/data/pcs-pattern-task-repository.ts'
import { listFirstSampleTasks } from '../src/data/pcs-first-sample-repository.ts'
import { listPreProductionSampleTasks } from '../src/data/pcs-pre-production-sample-repository.ts'
import { listStyleArchives } from '../src/data/pcs-style-archive-repository.ts'
import { listProjectArchives } from '../src/data/pcs-project-archive-repository.ts'
import { listTechnicalDataVersions } from '../src/data/pcs-technical-data-version-repository.ts'

function resolveActualCount(workItemTypeCode: string): number {
  if (workItemTypeCode === 'PROJECT_INIT') {
    return listProjects().length
  }

  if (
    [
      'SAMPLE_ACQUIRE',
      'SAMPLE_INBOUND_CHECK',
      'FEASIBILITY_REVIEW',
      'SAMPLE_SHOOT_FIT',
      'SAMPLE_CONFIRM',
      'SAMPLE_COST_REVIEW',
      'SAMPLE_PRICING',
      'TEST_DATA_SUMMARY',
      'TEST_CONCLUSION',
      'SAMPLE_RETAIN_REVIEW',
      'SAMPLE_RETURN_HANDLE',
    ].includes(workItemTypeCode)
  ) {
    return listProjectInlineNodeRecordsByWorkItemType(workItemTypeCode as never).length
  }

  if (workItemTypeCode === 'CHANNEL_PRODUCT_LISTING') {
    return listProjectChannelProducts().length
  }

  if (workItemTypeCode === 'LIVE_TEST' || workItemTypeCode === 'VIDEO_TEST') {
    const snapshot = createTestingRelationBootstrapSnapshot()
    return snapshot.relations.filter((item) => item.workItemTypeCode === workItemTypeCode).length
  }

  if (workItemTypeCode === 'PATTERN_TASK') {
    return listPlateMakingTasks().length
  }

  if (workItemTypeCode === 'PATTERN_ARTWORK_TASK') {
    return listPatternTasks().length
  }

  if (workItemTypeCode === 'FIRST_SAMPLE') {
    return listFirstSampleTasks().length
  }

  if (workItemTypeCode === 'PRE_PRODUCTION_SAMPLE') {
    return listPreProductionSampleTasks().length
  }

  if (workItemTypeCode === 'STYLE_ARCHIVE_CREATE') {
    return listStyleArchives().length
  }

  if (workItemTypeCode === 'PROJECT_TRANSFER_PREP') {
    const projects = listProjects()
    const techPackVersionIds = new Set(listTechnicalDataVersions().map((item) => item.technicalVersionId))
    const projectArchiveIds = new Set(listProjectArchives().map((item) => item.projectId))
    return projects.filter(
      (project) =>
        Boolean(project.linkedStyleId) &&
        Boolean(project.linkedTechPackVersionId) &&
        techPackVersionIds.has(project.linkedTechPackVersionId) &&
        projectArchiveIds.has(project.projectId),
    ).length
  }

  return 0
}

const rows = PCS_PROJECT_NODE_MIN_COVERAGE_PLAN.map((item) => {
  const actualCount = resolveActualCount(item.workItemTypeCode)
  return {
    workItemTypeCode: item.workItemTypeCode,
    sourceKind: item.sourceKind,
    minCount: item.minCount,
    actualCount,
    passed: actualCount >= item.minCount,
  }
})

console.log('节点编码 | 来源类型 | 最低要求 | 实际数量 | 结果')
console.log('--- | --- | --- | --- | ---')
rows.forEach((row) => {
  console.log(
    `${row.workItemTypeCode} | ${row.sourceKind} | ${row.minCount} | ${row.actualCount} | ${row.passed ? '通过' : '不通过'}`,
  )
})

const failedRows = rows.filter((row) => !row.passed)
if (failedRows.length > 0) {
  console.error('\n以下节点未达到最小覆盖要求：')
  failedRows.forEach((row) => {
    console.error(
      `- ${row.workItemTypeCode}：要求至少 ${row.minCount} 条，当前仅有 ${row.actualCount} 条，缺口 ${row.minCount - row.actualCount} 条`,
    )
  })
}

assert.equal(failedRows.length, 0, '存在未达到最小覆盖要求的商品项目节点')

console.log('\ncheck-pcs-project-node-instance-coverage.ts PASS')
