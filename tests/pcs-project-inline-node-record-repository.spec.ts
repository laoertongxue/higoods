import assert from 'node:assert/strict'

import {
  getLatestProjectInlineNodeRecord,
  listProjectInlineNodeRecordsByNode,
  listProjectInlineNodeRecordsByProject,
  listProjectInlineNodeRecordsByWorkItemType,
  resetProjectInlineNodeRecordRepository,
  upsertProjectInlineNodeRecord,
} from '../src/data/pcs-project-inline-node-record-repository.ts'

resetProjectInlineNodeRecordRepository()

const baseProject = {
  projectId: 'PRJ-INLINE-001',
  projectCode: 'PRJ-INLINE-001',
  projectName: '节点正式记录仓储测试项目',
}

const baseOwner = {
  ownerId: 'user-test',
  ownerName: '测试用户',
}

const sampleAcquireOld = upsertProjectInlineNodeRecord({
  recordId: 'inline-sample-acquire-001',
  recordCode: 'INR-001',
  ...baseProject,
  projectNodeId: 'node-sample-acquire-001',
  workItemTypeCode: 'SAMPLE_ACQUIRE',
  workItemTypeName: '样衣获取',
  businessDate: '2026-04-10',
  recordStatus: '已完成',
  ...baseOwner,
  payload: {
    sampleSourceType: '外采',
    sampleSupplierId: 'supplier-a',
    sampleLink: 'https://example.com/sample-a',
    sampleUnitPrice: '188',
    unexpectedField: '应被过滤',
  },
  detailSnapshot: {
    acquireMethod: '外采',
    externalPlatform: '电商平台',
    trackingNumber: 'EXP-001',
    illegalField: '应被过滤',
  },
  sourceModule: '商品项目',
  sourceDocType: '样衣获取登记',
  sourceDocId: 'DOC-SA-001',
  sourceDocCode: 'DOC-SA-001',
  upstreamRefs: [],
  downstreamRefs: [],
  createdAt: '2026-04-10 10:00',
  createdBy: '测试用户',
  updatedAt: '2026-04-10 10:00',
  updatedBy: '测试用户',
  legacyProjectRef: null,
  legacyWorkItemInstanceId: 'legacy-sample-acquire-001',
} as never)

const sampleAcquireLatest = upsertProjectInlineNodeRecord({
  recordId: 'inline-sample-acquire-002',
  recordCode: 'INR-002',
  ...baseProject,
  projectNodeId: 'node-sample-acquire-001',
  workItemTypeCode: 'SAMPLE_ACQUIRE',
  workItemTypeName: '样衣获取',
  businessDate: '2026-04-11',
  recordStatus: '已完成',
  ...baseOwner,
  payload: {
    sampleSourceType: '委托打样',
    sampleSupplierId: 'supplier-b',
    sampleLink: '',
    sampleUnitPrice: 268,
  },
  detailSnapshot: {
    acquireMethod: '委托打样',
    acquirePurpose: '测试新面料',
    handler: '采购专员',
  },
  sourceModule: '商品项目',
  sourceDocType: '样衣获取登记',
  sourceDocId: 'DOC-SA-002',
  sourceDocCode: 'DOC-SA-002',
  upstreamRefs: [],
  downstreamRefs: [],
  createdAt: '2026-04-11 09:00',
  createdBy: '测试用户',
  updatedAt: '2026-04-11 09:00',
  updatedBy: '测试用户',
  legacyProjectRef: 'LEGACY-PROJECT-001',
  legacyWorkItemInstanceId: 'legacy-sample-acquire-002',
} as never)

assert.equal(sampleAcquireOld.workItemTypeCode, 'SAMPLE_ACQUIRE', '应能写入 SAMPLE_ACQUIRE 记录')
assert.deepEqual(
  Object.keys(sampleAcquireLatest.payload).sort(),
  ['sampleLink', 'sampleSourceType', 'sampleSupplierId', 'sampleUnitPrice'].sort(),
  'payload 必须保留当前 contract 字段键',
)
assert.equal(
  'unexpectedField' in (sampleAcquireOld.payload as Record<string, unknown>),
  false,
  'payload 不应保留未定义字段',
)
assert.equal(
  'illegalField' in (sampleAcquireOld.detailSnapshot as Record<string, unknown>),
  false,
  'detailSnapshot 不应保留未允许字段',
)
assert.equal(
  getLatestProjectInlineNodeRecord('node-sample-acquire-001')?.recordId,
  'inline-sample-acquire-002',
  '应能按 projectNodeId 读取最新 record',
)

const summaryRecord = upsertProjectInlineNodeRecord({
  recordId: 'inline-testing-summary-001',
  recordCode: 'INR-101',
  ...baseProject,
  projectNodeId: 'node-testing-summary-001',
  workItemTypeCode: 'TEST_DATA_SUMMARY',
  workItemTypeName: '测款数据汇总',
  businessDate: '2026-04-12',
  recordStatus: '已完成',
  ...baseOwner,
  payload: {
    summaryText: '已完成直播和短视频测款汇总。',
    totalExposureQty: 128000,
    totalClickQty: 6800,
    totalOrderQty: 360,
    totalGmvAmount: 98600,
  },
  detailSnapshot: {
    liveRelationIds: ['rel-live-001'],
    videoRelationIds: ['rel-video-001'],
    liveRelationCodes: ['LIVE-001'],
    videoRelationCodes: ['VIDEO-001'],
    summaryOwner: '测试用户',
    summaryAt: '2026-04-12 14:00',
    channelProductId: 'cp-001',
    channelProductCode: 'CP-001',
    upstreamChannelProductCode: 'UP-CP-001',
  },
  sourceModule: '商品项目',
  sourceDocType: '测款汇总',
  sourceDocId: 'DOC-TS-001',
  sourceDocCode: 'DOC-TS-001',
  upstreamRefs: [
    {
      refModule: '直播测款',
      refType: '直播关系',
      refId: 'rel-live-001',
      refCode: 'LIVE-001',
      refTitle: '直播测款记录一',
      refStatus: '已关联',
    },
    {
      refModule: '短视频测款',
      refType: '短视频关系',
      refId: 'rel-video-001',
      refCode: 'VIDEO-001',
      refTitle: '短视频测款记录一',
      refStatus: '已关联',
    },
  ],
  downstreamRefs: [],
  createdAt: '2026-04-12 14:00',
  createdBy: '测试用户',
  updatedAt: '2026-04-12 14:00',
  updatedBy: '测试用户',
  legacyProjectRef: null,
  legacyWorkItemInstanceId: null,
} as never)

assert.equal(summaryRecord.workItemTypeCode, 'TEST_DATA_SUMMARY')
assert.equal(summaryRecord.upstreamRefs.length, 2, 'TEST_DATA_SUMMARY record 能挂 live/video refs')
assert.deepEqual(
  (summaryRecord.detailSnapshot as Record<string, unknown>).liveRelationCodes,
  ['LIVE-001'],
  'TEST_DATA_SUMMARY detailSnapshot 应保留直播关系编码',
)

const conclusionRecord = upsertProjectInlineNodeRecord({
  recordId: 'inline-testing-conclusion-001',
  recordCode: 'INR-102',
  ...baseProject,
  projectNodeId: 'node-testing-conclusion-001',
  workItemTypeCode: 'TEST_CONCLUSION',
  workItemTypeName: '测款结论判定',
  businessDate: '2026-04-12',
  recordStatus: '已完成',
  ...baseOwner,
  payload: {
    conclusion: '调整',
    conclusionNote: '直播转化不达标，需重新改版。',
    linkedChannelProductCode: 'CP-001',
    invalidationPlanned: true,
  },
  detailSnapshot: {
    summaryRecordId: 'inline-testing-summary-001',
    summaryRecordCode: 'INR-101',
    channelProductId: 'cp-001',
    channelProductCode: 'CP-001',
    upstreamChannelProductCode: 'UP-CP-001',
    invalidatedChannelProductId: 'cp-001',
    revisionTaskId: 'rev-001',
    revisionTaskCode: 'REV-001',
    linkedStyleId: '',
    linkedStyleCode: '',
    projectTerminated: false,
    projectTerminatedAt: '',
  },
  sourceModule: '商品项目',
  sourceDocType: '测款结论',
  sourceDocId: 'DOC-TC-001',
  sourceDocCode: 'DOC-TC-001',
  upstreamRefs: [
    {
      refModule: '测款汇总',
      refType: '汇总记录',
      refId: 'inline-testing-summary-001',
      refCode: 'INR-101',
      refTitle: '测款汇总记录',
      refStatus: '已完成',
    },
    {
      refModule: '渠道商品',
      refType: '渠道商品',
      refId: 'cp-001',
      refCode: 'CP-001',
      refTitle: '当前测款渠道商品',
      refStatus: '已上架待测款',
    },
  ],
  downstreamRefs: [
    {
      refModule: '渠道商品',
      refType: '作废渠道商品',
      refId: 'cp-001',
      refCode: 'CP-001',
      refTitle: '已作废渠道商品',
      refStatus: '已作废',
    },
    {
      refModule: '改版任务',
      refType: '改版任务',
      refId: 'rev-001',
      refCode: 'REV-001',
      refTitle: '改版任务一',
      refStatus: '草稿',
    },
  ],
  createdAt: '2026-04-12 15:00',
  createdBy: '测试用户',
  updatedAt: '2026-04-12 15:00',
  updatedBy: '测试用户',
  legacyProjectRef: null,
  legacyWorkItemInstanceId: null,
} as never)

assert.equal(conclusionRecord.workItemTypeCode, 'TEST_CONCLUSION')
assert.equal(conclusionRecord.upstreamRefs.length, 2, 'TEST_CONCLUSION record 能挂 summary/channel product refs')
assert.equal(conclusionRecord.downstreamRefs.length, 2, 'TEST_CONCLUSION record 能挂 downstream refs')
assert.equal(
  (conclusionRecord.detailSnapshot as Record<string, unknown>).revisionTaskCode,
  'REV-001',
  'TEST_CONCLUSION detailSnapshot 应保留 downstream 任务信息',
)

const retainRecord = upsertProjectInlineNodeRecord({
  recordId: 'inline-sample-retain-001',
  recordCode: 'INR-201',
  ...baseProject,
  projectNodeId: 'node-sample-retain-001',
  workItemTypeCode: 'SAMPLE_RETAIN_REVIEW',
  workItemTypeName: '样衣留存评估',
  businessDate: '2026-04-13',
  recordStatus: '已完成',
  ...baseOwner,
  payload: {
    retainResult: '留存',
    retainNote: '该样衣转入长期留存。',
  },
  detailSnapshot: {
    sampleAssetId: 'sample-asset-001',
    sampleCode: 'SMP-001',
    sampleLedgerEventId: 'ledger-001',
    sampleLedgerEventCode: 'LEDGER-001',
    inventoryStatusAfter: '在库',
    availabilityAfter: '可用',
    locationAfter: '留样仓 A-01',
    disposalDocId: 'dispose-001',
    disposalDocCode: 'DISPOSE-001',
  },
  sourceModule: '样衣资产',
  sourceDocType: '留样处置单',
  sourceDocId: 'dispose-001',
  sourceDocCode: 'DISPOSE-001',
  upstreamRefs: [
    {
      refModule: '样衣资产',
      refType: '样衣资产',
      refId: 'sample-asset-001',
      refCode: 'SMP-001',
      refTitle: '测试样衣',
      refStatus: '在库',
    },
    {
      refModule: '样衣台账',
      refType: '台账事件',
      refId: 'ledger-001',
      refCode: 'LEDGER-001',
      refTitle: '样衣留存事件',
      refStatus: '已完成',
    },
    {
      refModule: '样衣处置单',
      refType: '处置单',
      refId: 'dispose-001',
      refCode: 'DISPOSE-001',
      refTitle: '留样处置单',
      refStatus: '已完成',
    },
  ],
  downstreamRefs: [],
  createdAt: '2026-04-13 09:30',
  createdBy: '测试用户',
  updatedAt: '2026-04-13 09:30',
  updatedBy: '测试用户',
  legacyProjectRef: null,
  legacyWorkItemInstanceId: null,
} as never)

assert.equal(retainRecord.workItemTypeCode, 'SAMPLE_RETAIN_REVIEW')
assert.equal(retainRecord.upstreamRefs.length, 3, 'SAMPLE_RETAIN_REVIEW 能挂 sample asset / ledger / disposal doc')
assert.equal(
  (retainRecord.detailSnapshot as Record<string, unknown>).disposalDocCode,
  'DISPOSE-001',
  'SAMPLE_RETAIN_REVIEW 应保留处置单信息',
)

const returnRecord = upsertProjectInlineNodeRecord({
  recordId: 'inline-sample-return-001',
  recordCode: 'INR-202',
  ...baseProject,
  projectNodeId: 'node-sample-return-001',
  workItemTypeCode: 'SAMPLE_RETURN_HANDLE',
  workItemTypeName: '样衣退回处理',
  businessDate: '2026-04-13',
  recordStatus: '已完成',
  ...baseOwner,
  payload: {
    returnResult: '已退回供应商',
  },
  detailSnapshot: {
    returnRecipient: '深圳版房甲',
    returnDepartment: '样衣部',
    returnAddress: '深圳市南山区样衣路 88 号',
    returnDate: '2026-04-13',
    logisticsProvider: '顺丰',
    trackingNumber: 'SF-20260413-001',
    modificationReason: '版型需调整',
    sampleAssetId: 'sample-asset-002',
    sampleCode: 'SMP-002',
    sampleLedgerEventId: 'ledger-002',
    sampleLedgerEventCode: 'LEDGER-002',
    returnDocId: 'return-doc-001',
    returnDocCode: 'RETURN-001',
    shouldDrop: '应被过滤',
  },
  sourceModule: '样衣资产',
  sourceDocType: '样衣退回单',
  sourceDocId: 'return-doc-001',
  sourceDocCode: 'RETURN-001',
  upstreamRefs: [
    {
      refModule: '样衣资产',
      refType: '样衣资产',
      refId: 'sample-asset-002',
      refCode: 'SMP-002',
      refTitle: '退回样衣',
      refStatus: '待退回',
    },
    {
      refModule: '样衣台账',
      refType: '台账事件',
      refId: 'ledger-002',
      refCode: 'LEDGER-002',
      refTitle: '样衣退回事件',
      refStatus: '已完成',
    },
    {
      refModule: '样衣退回单',
      refType: '退回单',
      refId: 'return-doc-001',
      refCode: 'RETURN-001',
      refTitle: '样衣退回单',
      refStatus: '已完成',
    },
  ],
  downstreamRefs: [],
  createdAt: '2026-04-13 11:00',
  createdBy: '测试用户',
  updatedAt: '2026-04-13 11:00',
  updatedBy: '测试用户',
  legacyProjectRef: null,
  legacyWorkItemInstanceId: null,
} as never)

assert.equal(returnRecord.workItemTypeCode, 'SAMPLE_RETURN_HANDLE')
assert.equal(
  (returnRecord.detailSnapshot as Record<string, unknown>).returnRecipient,
  '深圳版房甲',
  'SAMPLE_RETURN_HANDLE detailSnapshot 应包含 returnRecipient',
)
assert.equal(
  (returnRecord.detailSnapshot as Record<string, unknown>).logisticsProvider,
  '顺丰',
  'SAMPLE_RETURN_HANDLE detailSnapshot 应包含 logisticsProvider',
)
assert.equal(
  (returnRecord.detailSnapshot as Record<string, unknown>).trackingNumber,
  'SF-20260413-001',
  'SAMPLE_RETURN_HANDLE detailSnapshot 应包含 trackingNumber',
)
assert.equal(
  'shouldDrop' in (returnRecord.detailSnapshot as Record<string, unknown>),
  false,
  'SAMPLE_RETURN_HANDLE detailSnapshot 不应保留未允许字段',
)

assert.equal(
  listProjectInlineNodeRecordsByProject(baseProject.projectId).length,
  6,
  '应能按项目读取全部 inline 节点正式记录',
)
assert.equal(
  listProjectInlineNodeRecordsByNode('node-testing-summary-001').length,
  1,
  '应能按节点读取正式记录',
)
assert.equal(
  listProjectInlineNodeRecordsByWorkItemType('TEST_CONCLUSION').length,
  1,
  '应能按 workItemTypeCode 读取正式记录',
)

console.log('pcs-project-inline-node-record-repository.spec.ts PASS')
