import assert from 'node:assert/strict'

import {
  PCS_PROJECT_NODE_MIN_COVERAGE_PLAN,
  type PcsProjectDemoCoverageSourceKind,
} from '../src/data/pcs-project-demo-coverage-plan.ts'
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

const EXPECTED_PLAN = {
  PROJECT_INIT: 'project-root',
  SAMPLE_ACQUIRE: 'inline-record',
  SAMPLE_INBOUND_CHECK: 'inline-record',
  FEASIBILITY_REVIEW: 'inline-record',
  SAMPLE_SHOOT_FIT: 'inline-record',
  SAMPLE_CONFIRM: 'inline-record',
  SAMPLE_COST_REVIEW: 'inline-record',
  SAMPLE_PRICING: 'inline-record',
  CHANNEL_PRODUCT_LISTING: 'standalone-instance',
  VIDEO_TEST: 'standalone-instance',
  LIVE_TEST: 'standalone-instance',
  TEST_DATA_SUMMARY: 'inline-record',
  TEST_CONCLUSION: 'inline-record',
  STYLE_ARCHIVE_CREATE: 'aggregate-object',
  PROJECT_TRANSFER_PREP: 'aggregate-object',
  PATTERN_TASK: 'standalone-instance',
  PATTERN_ARTWORK_TASK: 'standalone-instance',
  FIRST_SAMPLE: 'standalone-instance',
  PRE_PRODUCTION_SAMPLE: 'standalone-instance',
  SAMPLE_RETAIN_REVIEW: 'inline-record',
  SAMPLE_RETURN_HANDLE: 'inline-record',
} satisfies Record<string, PcsProjectDemoCoverageSourceKind>

function resolveActualCoverageCount(workItemTypeCode: keyof typeof EXPECTED_PLAN): number {
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
    return listProjectInlineNodeRecordsByWorkItemType(workItemTypeCode).length
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
    const technicalVersionIds = new Set(listTechnicalDataVersions().map((item) => item.technicalVersionId))
    const archivedProjectIds = new Set(listProjectArchives().map((item) => item.projectId))

    return projects.filter(
      (project) =>
        Boolean(project.linkedStyleId) &&
        Boolean(project.linkedTechPackVersionId) &&
        technicalVersionIds.has(project.linkedTechPackVersionId) &&
        archivedProjectIds.has(project.projectId),
    ).length
  }

  return 0
}

assert.equal(
  PCS_PROJECT_NODE_MIN_COVERAGE_PLAN.length,
  Object.keys(EXPECTED_PLAN).length,
  '覆盖计划的工作项数量必须与正式工作项总数一致',
)

const actualPlanCodes = new Set(PCS_PROJECT_NODE_MIN_COVERAGE_PLAN.map((item) => item.workItemTypeCode))
Object.keys(EXPECTED_PLAN).forEach((workItemTypeCode) => {
  assert.ok(actualPlanCodes.has(workItemTypeCode), `覆盖计划缺少 ${workItemTypeCode}`)
})

PCS_PROJECT_NODE_MIN_COVERAGE_PLAN.forEach((item) => {
  assert.equal(item.minCount, 4, `${item.workItemTypeCode} 的最小覆盖数量必须固定为 4`)
  assert.equal(
    item.sourceKind,
    EXPECTED_PLAN[item.workItemTypeCode],
    `${item.workItemTypeCode} 的 sourceKind 应为 ${EXPECTED_PLAN[item.workItemTypeCode]}`,
  )

  const actualCount = resolveActualCoverageCount(item.workItemTypeCode)
  assert.ok(
    actualCount >= item.minCount,
    `${item.workItemTypeCode} 当前正式数据仅有 ${actualCount} 条，低于覆盖计划要求的 ${item.minCount} 条`,
  )
})

console.log('pcs-project-node-min-coverage-plan.spec.ts PASS')
