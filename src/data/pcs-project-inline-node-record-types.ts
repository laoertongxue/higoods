export const PCS_PROJECT_INLINE_NODE_RECORD_WORK_ITEM_TYPES = [
  'SAMPLE_ACQUIRE',
  'SAMPLE_INBOUND_CHECK',
  'FEASIBILITY_REVIEW',
  'SAMPLE_SHOOT_FIT',
  'SAMPLE_CONFIRM',
  'SAMPLE_COST_REVIEW',
  'SAMPLE_PRICING',
  'TEST_DATA_SUMMARY',
  'TEST_CONCLUSION',
  'SAMPLE_RETURN_HANDLE',
] as const

export type PcsProjectInlineNodeRecordWorkItemTypeCode =
  (typeof PCS_PROJECT_INLINE_NODE_RECORD_WORK_ITEM_TYPES)[number]

export type ProjectDecisionResult = '' | '通过' | '淘汰'

export interface PcsProjectInlineNodeRef {
  refModule: string
  refType: string
  refId: string
  refCode: string
  refTitle: string
  refStatus: string
}

export interface PcsProjectInlineNodeRecordBase<
  TWorkItemTypeCode extends PcsProjectInlineNodeRecordWorkItemTypeCode,
  TPayload,
  TDetailSnapshot,
> {
  recordId: string
  recordCode: string
  projectId: string
  projectCode: string
  projectName: string
  projectNodeId: string
  workItemTypeCode: TWorkItemTypeCode
  workItemTypeName: string
  businessDate: string
  recordStatus: string
  ownerId: string
  ownerName: string
  payload: TPayload
  detailSnapshot: TDetailSnapshot
  sourceModule: string
  sourceDocType: string
  sourceDocId: string
  sourceDocCode: string
  upstreamRefs: PcsProjectInlineNodeRef[]
  downstreamRefs: PcsProjectInlineNodeRef[]
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  legacyProjectRef: string | null
  legacyWorkItemInstanceId: string | null
}

export interface SampleAcquirePayload {
  sampleSourceType: string
  sampleSupplierId: string
  sampleLink: string
  sampleUnitPrice: string | number
}

export interface SampleAcquireDetailSnapshot {
  acquireMethod?: string
  acquirePurpose?: string
  applicant?: string
  externalPlatform?: string
  externalShop?: string
  orderTime?: string
  quantity?: number | string
  colors?: string[]
  sizes?: string[]
  specNote?: string
  sampleCode?: string
  sampleStatus?: string
  approvalStatus?: string
  approver?: string
  handler?: string
}

export interface SampleInboundCheckPayload {
  sampleCode: string
  arrivalTime: string
  checkResult: string
}

export interface SampleInboundCheckDetailSnapshot {
  sampleIds?: string[]
  warehouseLocation?: string
  receiver?: string
  inboundRequestNo?: string
  sampleQuantity?: number | string
  colorCode?: string
  sizeCombination?: string
  expressCompany?: string
  trackingNumber?: string
  arrivalPhotos?: string[]
  inboundVoucher?: string
  approvalStatus?: string
  approver?: string
  currentHandler?: string
}

export interface FeasibilityReviewPayload {
  reviewConclusion: ProjectDecisionResult
  reviewRisk: string
  reviewConclusionLegacyValue?: string
  migrationNote?: string
}

export interface FeasibilityReviewDetailSnapshot {
  evaluationDimension?: string[]
  judgmentDescription?: string
  evaluationParticipants?: string[]
  approvalStatus?: string
  approver?: string
}

export interface SampleShootFitPayload {
  shootPlan: string
  fitFeedback: string
  sampleFlatImageIds: string[]
  sampleTryOnImageIds: string[]
  sampleDetailImageIds: string[]
  sampleVideoUrls: string[]
  shootImageNote: string
  listingCandidateImageIds: string[]
  styleArchiveCandidateImageIds: string[]
}

export interface SampleShootFitDetailSnapshot {
  shootDate?: string
  shootLocation?: string
  requiredMaterials?: string[]
  shootStyle?: string
  actualShootDate?: string
  photographer?: string
  modelInvolved?: boolean
  modelName?: string
  editingRequired?: boolean
  editingDeadline?: string
  retouchingLevel?: string
}

export interface SampleConfirmPayload {
  confirmResult: ProjectDecisionResult
  confirmNote: string
  confirmResultLegacyValue?: string
  migrationNote?: string
}

export interface SampleConfirmDetailSnapshot {
  appearanceConfirmation?: string
  sizeConfirmation?: string
  craftsmanshipConfirmation?: string
  materialConfirmation?: string
  revisionRequired?: boolean
  revisionNotes?: string
  proceedToNextStage?: boolean
  confirmationNotes?: string
}

export interface SampleCostReviewPayload {
  costTotal: number | string
  costNote: string
}

export interface SampleCostReviewDetailSnapshot {
  actualSampleCost?: number | string
  targetProductionCost?: number | string
  costVariance?: number | string
  costVariancePercentage?: number | string
  costCompliance?: string
  costReviewNotes?: string
  proceedWithProduction?: boolean
  decisionRationale?: string
}

export interface SamplePricingPayload {
  priceRange: string
  pricingNote: string
}

export interface SamplePricingDetailSnapshot {
  baseCost?: number | string
  targetProfitMargin?: number | string
  calculatedPrice?: number | string
  finalPrice?: number | string
  pricingStrategy?: string
  approvedBy?: string
  approvalDate?: string
  approvalStatus?: string
  approvalComments?: string
}

export interface TestDataSummaryPayload {
  summaryText: string
  totalExposureQty: number
  totalClickQty: number
  totalOrderQty: number
  totalGmvAmount: number
}

export interface TestDataSummaryDetailSnapshot {
  liveRelationIds?: string[]
  videoRelationIds?: string[]
  liveRelationCodes?: string[]
  videoRelationCodes?: string[]
  summaryOwner?: string
  summaryAt?: string
  channelProductId?: string
  channelProductCode?: string
  upstreamChannelProductCode?: string
}

export interface TestConclusionPayload {
  conclusion: ProjectDecisionResult
  conclusionNote: string
  linkedChannelProductCode: string
  invalidationPlanned: boolean
  linkedStyleId?: string
  linkedStyleCode?: string
  invalidatedChannelProductId?: string
  nextActionType?: string
  conclusionLegacyValue?: string
  migrationNote?: string
}

export interface TestConclusionDetailSnapshot {
  summaryRecordId?: string
  summaryRecordCode?: string
  channelProductId?: string
  channelProductCode?: string
  upstreamChannelProductCode?: string
  invalidatedChannelProductId?: string
  linkedStyleId?: string
  linkedStyleCode?: string
}

export interface SampleReturnHandlePayload {
  returnResult: string
}

export interface SampleReturnHandleDetailSnapshot {
  returnRecipient?: string
  returnDepartment?: string
  returnAddress?: string
  returnDate?: string
  modificationReason?: string
  sampleCode?: string
  returnDocId?: string
  returnDocCode?: string
}

export interface PcsProjectInlineNodeRecordPayloadMap {
  SAMPLE_ACQUIRE: SampleAcquirePayload
  SAMPLE_INBOUND_CHECK: SampleInboundCheckPayload
  FEASIBILITY_REVIEW: FeasibilityReviewPayload
  SAMPLE_SHOOT_FIT: SampleShootFitPayload
  SAMPLE_CONFIRM: SampleConfirmPayload
  SAMPLE_COST_REVIEW: SampleCostReviewPayload
  SAMPLE_PRICING: SamplePricingPayload
  TEST_DATA_SUMMARY: TestDataSummaryPayload
  TEST_CONCLUSION: TestConclusionPayload
  SAMPLE_RETURN_HANDLE: SampleReturnHandlePayload
}

export interface PcsProjectInlineNodeRecordDetailSnapshotMap {
  SAMPLE_ACQUIRE: SampleAcquireDetailSnapshot
  SAMPLE_INBOUND_CHECK: SampleInboundCheckDetailSnapshot
  FEASIBILITY_REVIEW: FeasibilityReviewDetailSnapshot
  SAMPLE_SHOOT_FIT: SampleShootFitDetailSnapshot
  SAMPLE_CONFIRM: SampleConfirmDetailSnapshot
  SAMPLE_COST_REVIEW: SampleCostReviewDetailSnapshot
  SAMPLE_PRICING: SamplePricingDetailSnapshot
  TEST_DATA_SUMMARY: TestDataSummaryDetailSnapshot
  TEST_CONCLUSION: TestConclusionDetailSnapshot
  SAMPLE_RETURN_HANDLE: SampleReturnHandleDetailSnapshot
}

export type PcsProjectInlineNodePayload<
  TWorkItemTypeCode extends PcsProjectInlineNodeRecordWorkItemTypeCode,
> = PcsProjectInlineNodeRecordPayloadMap[TWorkItemTypeCode]

export type PcsProjectInlineNodeDetailSnapshot<
  TWorkItemTypeCode extends PcsProjectInlineNodeRecordWorkItemTypeCode,
> = PcsProjectInlineNodeRecordDetailSnapshotMap[TWorkItemTypeCode]

export type PcsProjectInlineNodeRecord =
  | PcsProjectInlineNodeRecordBase<'SAMPLE_ACQUIRE', SampleAcquirePayload, SampleAcquireDetailSnapshot>
  | PcsProjectInlineNodeRecordBase<'SAMPLE_INBOUND_CHECK', SampleInboundCheckPayload, SampleInboundCheckDetailSnapshot>
  | PcsProjectInlineNodeRecordBase<'FEASIBILITY_REVIEW', FeasibilityReviewPayload, FeasibilityReviewDetailSnapshot>
  | PcsProjectInlineNodeRecordBase<'SAMPLE_SHOOT_FIT', SampleShootFitPayload, SampleShootFitDetailSnapshot>
  | PcsProjectInlineNodeRecordBase<'SAMPLE_CONFIRM', SampleConfirmPayload, SampleConfirmDetailSnapshot>
  | PcsProjectInlineNodeRecordBase<'SAMPLE_COST_REVIEW', SampleCostReviewPayload, SampleCostReviewDetailSnapshot>
  | PcsProjectInlineNodeRecordBase<'SAMPLE_PRICING', SamplePricingPayload, SamplePricingDetailSnapshot>
  | PcsProjectInlineNodeRecordBase<'TEST_DATA_SUMMARY', TestDataSummaryPayload, TestDataSummaryDetailSnapshot>
  | PcsProjectInlineNodeRecordBase<'TEST_CONCLUSION', TestConclusionPayload, TestConclusionDetailSnapshot>
  | PcsProjectInlineNodeRecordBase<'SAMPLE_RETURN_HANDLE', SampleReturnHandlePayload, SampleReturnHandleDetailSnapshot>

export interface PcsProjectInlineNodeRecordStoreSnapshot {
  version: number
  records: PcsProjectInlineNodeRecord[]
}
