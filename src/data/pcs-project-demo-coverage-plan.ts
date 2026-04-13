import type { PcsProjectWorkItemCode } from './pcs-project-domain-contract.ts'

export type PcsProjectDemoCoverageSourceKind =
  | 'project-root'
  | 'inline-record'
  | 'standalone-instance'
  | 'aggregate-object'

export interface PcsProjectNodeMinCoveragePlanItem {
  workItemTypeCode: PcsProjectWorkItemCode
  minCount: 4
  sourceKind: PcsProjectDemoCoverageSourceKind
}

export const PCS_PROJECT_NODE_MIN_COVERAGE_PLAN: PcsProjectNodeMinCoveragePlanItem[] = [
  { workItemTypeCode: 'PROJECT_INIT', minCount: 4, sourceKind: 'project-root' },
  { workItemTypeCode: 'SAMPLE_ACQUIRE', minCount: 4, sourceKind: 'inline-record' },
  { workItemTypeCode: 'SAMPLE_INBOUND_CHECK', minCount: 4, sourceKind: 'inline-record' },
  { workItemTypeCode: 'FEASIBILITY_REVIEW', minCount: 4, sourceKind: 'inline-record' },
  { workItemTypeCode: 'SAMPLE_SHOOT_FIT', minCount: 4, sourceKind: 'inline-record' },
  { workItemTypeCode: 'SAMPLE_CONFIRM', minCount: 4, sourceKind: 'inline-record' },
  { workItemTypeCode: 'SAMPLE_COST_REVIEW', minCount: 4, sourceKind: 'inline-record' },
  { workItemTypeCode: 'SAMPLE_PRICING', minCount: 4, sourceKind: 'inline-record' },
  { workItemTypeCode: 'CHANNEL_PRODUCT_LISTING', minCount: 4, sourceKind: 'standalone-instance' },
  { workItemTypeCode: 'VIDEO_TEST', minCount: 4, sourceKind: 'standalone-instance' },
  { workItemTypeCode: 'LIVE_TEST', minCount: 4, sourceKind: 'standalone-instance' },
  { workItemTypeCode: 'TEST_DATA_SUMMARY', minCount: 4, sourceKind: 'inline-record' },
  { workItemTypeCode: 'TEST_CONCLUSION', minCount: 4, sourceKind: 'inline-record' },
  { workItemTypeCode: 'STYLE_ARCHIVE_CREATE', minCount: 4, sourceKind: 'aggregate-object' },
  { workItemTypeCode: 'PROJECT_TRANSFER_PREP', minCount: 4, sourceKind: 'aggregate-object' },
  { workItemTypeCode: 'PATTERN_TASK', minCount: 4, sourceKind: 'standalone-instance' },
  { workItemTypeCode: 'PATTERN_ARTWORK_TASK', minCount: 4, sourceKind: 'standalone-instance' },
  { workItemTypeCode: 'FIRST_SAMPLE', minCount: 4, sourceKind: 'standalone-instance' },
  { workItemTypeCode: 'PRE_PRODUCTION_SAMPLE', minCount: 4, sourceKind: 'standalone-instance' },
  { workItemTypeCode: 'SAMPLE_RETAIN_REVIEW', minCount: 4, sourceKind: 'inline-record' },
  { workItemTypeCode: 'SAMPLE_RETURN_HANDLE', minCount: 4, sourceKind: 'inline-record' },
]

export const PCS_PROJECT_NODE_MIN_COVERAGE_PLAN_MAP = new Map(
  PCS_PROJECT_NODE_MIN_COVERAGE_PLAN.map((item) => [item.workItemTypeCode, item]),
)
