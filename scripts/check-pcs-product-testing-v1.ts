import assert from 'node:assert/strict'

import {
  DOMESTIC_PURCHASE_SAMPLE_TEMPLATE_ID,
  WANLONG_REVISION_SAMPLE_TEMPLATE_ID,
  getProjectWorkItemMultiInstanceDefinition,
  getProjectWorkItemContract,
  listProjectTemplateSchemas,
  listProjectWorkItemContracts,
  type PcsProjectWorkItemCode,
} from '../src/data/pcs-project-domain-contract.ts'
import { ensurePcsProjectDemoDataReady } from '../src/data/pcs-project-demo-seed-service.ts'
import {
  createEmptyProjectDraft,
  createProject,
  getProjectCreateCatalog,
  listActiveProjectTemplates,
  listProjectNodes,
  listProjectPhases,
  listProjects,
} from '../src/data/pcs-project-repository.ts'
import { createBootstrapProjectInlineNodeRecordSnapshot } from '../src/data/pcs-project-inline-node-record-bootstrap.ts'
import { listProjectTemplates } from '../src/data/pcs-templates.ts'
import { SAMPLE_COST_RAW_MATERIAL_ROWS_KEY, calculateSampleCostReview } from '../src/data/pcs-sample-cost-review-pricing.ts'
import {
  listPcsSampleLedgerEvents,
  listPcsSampleRecords,
  listPcsSampleReturnCases,
} from '../src/data/pcs-sample-management.ts'

const domesticFlow: PcsProjectWorkItemCode[] = [
  'PROJECT_INIT',
  'SAMPLE_ACQUIRE',
  'SAMPLE_INBOUND_CHECK',
  'FEASIBILITY_REVIEW',
  'SAMPLE_COST_REVIEW',
  'CHANNEL_PRODUCT_LISTING',
  'LIVE_TEST',
  'VIDEO_TEST',
  'TEST_DATA_SUMMARY',
  'TEST_CONCLUSION',
  'STYLE_ARCHIVE_CREATE',
  'SAMPLE_RETURN_HANDLE',
]

const wanlongFlow: PcsProjectWorkItemCode[] = [
  'PROJECT_INIT',
  'SAMPLE_ACQUIRE',
  'REVISION_TASK',
  'PATTERN_TASK',
  'PATTERN_ARTWORK_TASK',
  'FIRST_SAMPLE',
  'FIRST_ORDER_SAMPLE',
  'SAMPLE_INBOUND_CHECK',
  'FEASIBILITY_REVIEW',
  'SAMPLE_COST_REVIEW',
  'CHANNEL_PRODUCT_LISTING',
  'LIVE_TEST',
  'VIDEO_TEST',
  'TEST_DATA_SUMMARY',
  'TEST_CONCLUSION',
  'STYLE_ARCHIVE_CREATE',
  'SAMPLE_RETURN_HANDLE',
]

function fieldKeys(workItemTypeCode: PcsProjectWorkItemCode): string[] {
  return getProjectWorkItemContract(workItemTypeCode).fieldDefinitions.map((field) => field.fieldKey)
}

function fieldOptions(workItemTypeCode: PcsProjectWorkItemCode, fieldKey: string): string[] {
  const field = getProjectWorkItemContract(workItemTypeCode).fieldDefinitions.find((item) => item.fieldKey === fieldKey)
  return field?.options?.map((option) => option.value) ?? []
}

function assertIncludesAll(actual: string[], expected: string[], message: string): void {
  const missing = expected.filter((item) => !actual.includes(item))
  assert.deepEqual(missing, [], message)
}

function flattenSchemaNodeCodes(templateId: string): string[] {
  const schema = listProjectTemplateSchemas().find((item) => item.templateId === templateId)
  assert.ok(schema, `缺少模板矩阵：${templateId}`)
  return schema.phaseSchemas.flatMap((phase) => phase.nodeCodes)
}

function findSchemaPhaseCode(templateId: string, workItemCode: PcsProjectWorkItemCode): string {
  const schema = listProjectTemplateSchemas().find((item) => item.templateId === templateId)
  assert.ok(schema, `缺少模板矩阵：${templateId}`)
  const phase = schema.phaseSchemas.find((item) => item.nodeCodes.includes(workItemCode))
  assert.ok(phase, `${templateId} 缺少工作项：${workItemCode}`)
  return phase.phaseCode
}

function buildDraft(templateId: string) {
  const catalog = getProjectCreateCatalog()
  const category = catalog.categories[0]
  const child = category.children[0]
  const brand = catalog.brands[0]
  const owner = catalog.owners[0]
  const team = catalog.teams[0]

  return {
    ...createEmptyProjectDraft(),
    projectName: templateId === WANLONG_REVISION_SAMPLE_TEMPLATE_ID ? '验收-万隆改版出样衣测款项目' : '验收-国内采购样衣测款项目',
    projectSourceType: catalog.projectSourceTypes[0],
    templateId,
    categoryId: category.id,
    categoryName: category.name,
    subCategoryId: child?.id ?? '',
    subCategoryName: child?.name ?? '',
    brandId: brand.id,
    brandName: brand.name,
    yearTag: catalog.yearTags[1] ?? catalog.yearTags[0],
    priceRangeLabel: catalog.priceRanges[1] ?? catalog.priceRanges[0],
    targetChannelCodes: catalog.channelOptions.slice(0, 1).map((item) => item.code),
    ownerId: owner.id,
    ownerName: owner.name,
    teamId: team.id,
    teamName: team.name,
    priorityLevel: '中' as const,
  }
}

const templates = listProjectTemplates()
const activeTemplates = listActiveProjectTemplates()
const schemas = listProjectTemplateSchemas()

assert.equal(templates.length, 2, '项目模板 mock 应收口为国内采购样衣测款和万隆改版出样衣测款两套模板')
assert.equal(activeTemplates.length, 2, '两套正式业务模板都应启用')
assert.deepEqual(
  templates.map((item) => item.name).sort(),
  ['万隆改版出样衣测款项目', '国内采购样衣测款项目'].sort(),
  '模板名称应仅保留国内采购样衣测款和万隆改版出样衣测款两类',
)
assert.equal(schemas.length, 2, '正式模板矩阵应仅保留两套')
assert.ok(!templates.some((item) => /快时尚款 -|设计款 -|完整测款转档|直播快反|设计验证/.test(item.name)), '模板列表不应保留旧四模板名称')
assert.ok(!templates.some((item) => /工程打样转测款/.test(item.name)), '模板列表不应保留第三类工程打样转测款项目')

const projectCountBeforeDemoSeed = listProjects().length
ensurePcsProjectDemoDataReady()
assert.equal(listProjects().length, projectCountBeforeDemoSeed, '清洁状态下不应额外注入商品项目 mock')

assert.deepEqual(flattenSchemaNodeCodes(DOMESTIC_PURCHASE_SAMPLE_TEMPLATE_ID), domesticFlow, '国内采购样衣测款模板节点顺序不符合 v1.0')
assert.deepEqual(flattenSchemaNodeCodes(WANLONG_REVISION_SAMPLE_TEMPLATE_ID), wanlongFlow, '万隆改版出样衣测款模板节点顺序不符合改版、制版、花型、首版和首单样衣链路')
assert.equal(
  getProjectWorkItemContract('CHANNEL_PRODUCT_LISTING').phaseCode,
  'PHASE_02',
  '商品上架工作项库默认阶段应统一为样衣形成与商品准备',
)
assert.equal(
  findSchemaPhaseCode(DOMESTIC_PURCHASE_SAMPLE_TEMPLATE_ID, 'CHANNEL_PRODUCT_LISTING'),
  'PHASE_02',
  '国内采购样衣测款模板中的商品上架应在样衣形成与商品准备阶段',
)
assert.equal(
  findSchemaPhaseCode(WANLONG_REVISION_SAMPLE_TEMPLATE_ID, 'CHANNEL_PRODUCT_LISTING'),
  'PHASE_02',
  '万隆改版出样衣测款模板中的商品上架应在样衣形成与商品准备阶段',
)

const workItemCodes = listProjectWorkItemContracts().map((item) => item.workItemTypeCode)
assertIncludesAll(workItemCodes, Array.from(new Set([...domesticFlow, ...wanlongFlow])), '工作项库缺少正式模板所需工作项')

const sampleAcquireFieldKeys = fieldKeys('SAMPLE_ACQUIRE')
assertIncludesAll(
  sampleAcquireFieldKeys,
  ['purchaseSupplierName', 'sampleLink', 'freightAmount', 'receiverName', 'needTransitFlag', 'samplePurchaseSpecQty'],
  '样衣获取字段未覆盖样衣来源和采购样衣要素',
)
assert.ok(!sampleAcquireFieldKeys.includes('saleType'), '样衣获取不应保留售卖类型字段')
assert.ok(!sampleAcquireFieldKeys.includes('targetRegionCodes'), '样衣获取不应保留区域字段')
const samplePurchaseSpecQtyField = getProjectWorkItemContract('SAMPLE_ACQUIRE').fieldDefinitions.find(
  (field) => field.fieldKey === 'samplePurchaseSpecQty',
)
assert.equal(samplePurchaseSpecQtyField?.type, 'table', '采购规格及数量必须作为结构化表格字段维护')
assert.deepEqual(
  fieldOptions('SAMPLE_ACQUIRE', 'sampleSourceType'),
  ['外采', '委托打样'],
  '样衣获取来源方式只能保留业务模板允许的外采/委托打样',
)
assert.deepEqual(
  getProjectCreateCatalog().sampleSourceTypes,
  ['外采', '委托打样'],
  '创建目录不得再提供业务模板外的样衣来源方式',
)
assertIncludesAll(
  fieldKeys('REVISION_TASK'),
  ['baseStyleCode', 'targetStyleCodeCandidate', 'revisionScopeNames', 'sampleQty', 'stylePreference', 'revisionSuggestionRichText', 'materialAdjustmentLines', 'newPatternSpuCode', 'patternChangeNote', 'patternFileIds', 'designDraftImageIds', 'ownerName', 'dueAt'],
  '改版任务字段未覆盖工程开发与打样承接信息',
)
assertIncludesAll(
  fieldKeys('SAMPLE_INBOUND_CHECK'),
  ['sampleInboundLines', 'receivedQty', 'generatedSampleCodes', 'receivedAt', 'sampleImageIds', 'qualityCheckResult', 'checkResult'],
  '样衣结果核对字段未覆盖到样登记、样衣编号和实物核对',
)
const sampleInboundContract = getProjectWorkItemContract('SAMPLE_INBOUND_CHECK')
assert.equal(sampleInboundContract.phaseCode, 'PHASE_02', '样衣结果核对必须归属样衣形成与商品准备阶段')
const sampleInboundLinesField = sampleInboundContract.fieldDefinitions.find((field) => field.fieldKey === 'sampleInboundLines')
assert.equal(sampleInboundLinesField?.type, 'table', '样衣结果核对应按颜色、尺码、计划数、实收数结构化登记')
assert.match(sampleInboundLinesField?.businessLogic || '', /实收件数生成样衣资产编号/, '样衣编号必须由实收数量生成')
const qualityCheckResultField = sampleInboundContract.fieldDefinitions.find((field) => field.fieldKey === 'qualityCheckResult')
assert.equal(qualityCheckResultField?.required, true, '到样核对结果必须为完成节点时必填')
assert.deepEqual(
  qualityCheckResultField?.options?.map((option) => option.value),
  ['到样完整', '到样有差异', '待补齐'],
  '样衣结果核对只记录到样完整、到样有差异或待补齐',
)
const checkResultField = sampleInboundContract.fieldDefinitions.find((field) => field.fieldKey === 'checkResult')
assert.equal(checkResultField?.required, true, '核对说明必须为完成节点时必填')
assert.deepEqual(
  fieldOptions('FEASIBILITY_REVIEW', 'reviewConclusion'),
  ['进入测款', '样衣退回', '重新改版出样衣'],
  '初步可行性判断必须明确进入测款、样衣退回或重新改版出样衣',
)
assertIncludesAll(
  fieldKeys('FEASIBILITY_REVIEW'),
  ['reviewConclusion', 'reviewRisk'],
  '初步可行性判断字段未覆盖结论和判断说明',
)
assertIncludesAll(
  fieldKeys('SAMPLE_COST_REVIEW'),
  [
    'spuCode',
    'productName',
    'buyerName',
    'brandName',
    'garmentCategory',
    'exchangeRate',
    'materialCostCny',
    'dyeingCostCny',
    'auxiliaryCostAmount',
    'auxiliaryCostCurrency',
    'auxiliaryCostCny',
    'fixedProcessCostCny',
    'sewingCostAmount',
    'sewingCostCurrency',
    'sewingCostCny',
    'optionalProcessCostCny',
    'costTotal',
    'salesPrice',
    'salesCurrency',
    'grossMarginRate',
    'reviewStatus',
    'costNote',
  ],
  '样衣核价字段未完整承接商品核价功能',
)
const sampleCostReviewContract = getProjectWorkItemContract('SAMPLE_COST_REVIEW')
assert.equal(sampleCostReviewContract.capabilities.canMultiInstance, false, '样衣核价必须是单实例工作项')
assert.equal(getProjectWorkItemMultiInstanceDefinition('SAMPLE_COST_REVIEW'), null, '样衣核价不应存在多实例语义定义')
const sampleCostPricing = calculateSampleCostReview({
  spuCode: 'SPU-CHECK-SAMPLE-COST',
  productName: '样衣核价规则校验',
  buyerName: '测试用户',
  brandName: 'Asaya',
  garmentCategory: '梭织',
  exchangeRate: 2200,
  materialLines: [{ materialSku: 'CNIDML359', finishCraftId: 'dye', usage: 1 }],
  fixedProcessOverrides: { cutting: 1200, postFinishing: 3500 },
  salesPrice: 35,
  salesCurrency: 'RMB',
})
assert.equal(sampleCostPricing.materialLines[0]?.materialSku, 'CNIDML359', '样衣核价物料必须保存物料 SPU')
assert.equal(sampleCostPricing.materialLines[0]?.finishCraftName, '染色', '样衣核价印染工艺必须独立于物料选择')
assert.equal(sampleCostPricing.fixedProcessLines.find((item) => item.code === 'cutting')?.cost.amount, 1200, '裁剪费应支持覆盖')
assert.equal(sampleCostPricing.fixedProcessLines.find((item) => item.code === 'postFinishing')?.cost.amount, 3500, '后道应支持覆盖')
assert.equal(sampleCostPricing.fixedProcessLines.find((item) => item.code === 'warehouseShipping')?.cost.amount, 2200, '仓库发货费必须为 2200 IDR')
const sampleCostAsayaDoublePrint = calculateSampleCostReview({
  spuCode: 'SPU-CHECK-SAMPLE-COST-ASAYA-DOUBLE-PRINT',
  productName: 'ASAYA 双面印核价规则校验',
  buyerName: '测试用户',
  brandName: 'ASAYA',
  garmentCategory: '梭织',
  exchangeRate: 2200,
  materialLines: [{ materialSku: 'CNIDPR220', finishCraftId: 'double-print', usage: 1.09361 }],
  salesPrice: 35,
  salesCurrency: 'RMB',
})
const sampleCostNonAsayaDoublePrint = calculateSampleCostReview({
  spuCode: 'SPU-CHECK-SAMPLE-COST-NON-ASAYA-DOUBLE-PRINT',
  productName: '非 ASAYA 双面印核价规则校验',
  buyerName: '测试用户',
  brandName: 'HiGood',
  garmentCategory: '梭织',
  exchangeRate: 2200,
  materialLines: [{ materialSku: 'CNIDPR220', finishCraftId: 'double-print', usage: 1.09361 }],
  salesPrice: 35,
  salesCurrency: 'RMB',
})
assert.equal(sampleCostAsayaDoublePrint.materialLines[0]?.dyeingCost.amount, 2.4, 'ASAYA 印花双面印必须按 2.4 元/米计价')
assert.equal(sampleCostNonAsayaDoublePrint.materialLines[0]?.dyeingCost.amount, 3.6, '非 ASAYA 印花双面印必须按 3.6 元/米计价')
assert.match(sampleCostAsayaDoublePrint.materialLines[0]?.dyeingRuleText || '', /双面印 ASAYA ¥2\.40\/米/, 'ASAYA 双面印规则文案不正确')
assert.match(sampleCostNonAsayaDoublePrint.materialLines[0]?.dyeingRuleText || '', /双面印 非ASAYA ¥3\.60\/米/, '非 ASAYA 双面印规则文案不正确')
const sampleCostReviewMockRecords = createBootstrapProjectInlineNodeRecordSnapshot(2).records.filter(
  (record) => record.workItemTypeCode === 'SAMPLE_COST_REVIEW',
)
assert.ok(
  sampleCostReviewMockRecords.some(
    (record) =>
      record.payload.brandName === 'ASAYA' &&
      String(record.payload[SAMPLE_COST_RAW_MATERIAL_ROWS_KEY] || '').includes('CNIDPR220') &&
      String(record.payload.dyeingRuleLines || '').includes('双面印 ASAYA ¥2.40/米'),
  ),
  '已生成样衣核价 mock 必须包含 ASAYA 双面印 2.4 元/米样本',
)
assert.ok(
  sampleCostReviewMockRecords.some(
    (record) =>
      record.payload.brandName !== 'ASAYA' &&
      String(record.payload[SAMPLE_COST_RAW_MATERIAL_ROWS_KEY] || '').includes('CNIDPR220') &&
      String(record.payload.dyeingRuleLines || '').includes('双面印 非ASAYA ¥3.60/米'),
  ),
  '已生成样衣核价 mock 必须包含非 ASAYA 双面印 3.6 元/米样本',
)
const sampleCostDefaultPricing = calculateSampleCostReview({
  spuCode: 'SPU-CHECK-SAMPLE-COST-DEFAULT',
  productName: '样衣核价默认固定工序校验',
  buyerName: '测试用户',
  brandName: 'Asaya',
  garmentCategory: '梭织',
  exchangeRate: 2200,
  materialLines: [{ materialSku: 'CNIDML359', finishCraftId: 'dye', usage: 1 }],
  fixedProcessOverrides: { cutting: '', postFinishing: null },
  salesPrice: 35,
  salesCurrency: 'RMB',
})
assert.equal(sampleCostDefaultPricing.fixedProcessLines.find((item) => item.code === 'cutting')?.cost.amount, 1000, '裁剪费空覆盖应保留默认金额')
assert.equal(sampleCostDefaultPricing.fixedProcessLines.find((item) => item.code === 'postFinishing')?.cost.amount, 3000, '后道空覆盖应保留默认金额')
const listingDefaultPriceField = getProjectWorkItemContract('CHANNEL_PRODUCT_LISTING').fieldDefinitions.find(
  (field) => field.fieldKey === 'defaultPriceAmount',
)
assert.equal(listingDefaultPriceField?.sourceRef, '样衣核价.销售价格', '商品上架默认售价必须来自样衣核价销售价格')
assertIncludesAll(
  fieldKeys('SAMPLE_RETURN_HANDLE'),
  [
    'handleType',
    'destination',
    'handledQty',
    'handledBy',
    'handledAt',
    'returnResult',
    'returnRecipient',
    'returnDepartment',
    'returnAddress',
    'expressCompany',
    'trackingNumber',
    'logisticsEvidence',
    'returnDate',
    'sampleCode',
    'returnDocCode',
  ],
  '样衣退回处理字段未覆盖退样、入库、清仓、寄回、单据和样衣编号信息',
)
const sampleReturnFields = getProjectWorkItemContract('SAMPLE_RETURN_HANDLE').fieldDefinitions
assert.equal(sampleReturnFields.find((field) => field.fieldKey === 'handleType')?.required, true, '样衣退回处理方式必须必填')
assert.equal(sampleReturnFields.find((field) => field.fieldKey === 'sampleCode')?.required, true, '样衣退回处理必须绑定样衣编号')
assert.equal(sampleReturnFields.find((field) => field.fieldKey === 'returnResult')?.required, true, '样衣退回处理结果说明必须必填')
const sampleReturnMockRecords = createBootstrapProjectInlineNodeRecordSnapshot(2).records.filter(
  (record) => record.workItemTypeCode === 'SAMPLE_RETURN_HANDLE',
)
assert.ok(sampleReturnMockRecords.length > 0, '必须存在样衣退回处理 mock 正式记录')
sampleReturnMockRecords.forEach((record) => {
  const payload = {
    ...(record.detailSnapshot || {}),
    ...(record.payload || {}),
  } as Record<string, unknown>
  assert.ok(String(payload.handleType || '').trim(), `${record.recordCode} 必须填写处理方式`)
  assert.ok(String(payload.sampleCode || '').trim(), `${record.recordCode} 必须绑定样衣编号`)
  assert.ok(String(payload.returnResult || '').trim(), `${record.recordCode} 必须填写处理结果说明`)
  assert.ok(String(payload.returnDocCode || '').trim(), `${record.recordCode} 必须填写退回单号`)
  assert.ok(String(payload.destination || '').trim(), `${record.recordCode} 必须填写处理去向`)
  if (['退样', '寄回'].includes(String(payload.handleType || '').trim())) {
    assert.ok(String(payload.expressCompany || '').trim(), `${record.recordCode} 退样或寄回时必须填写快递公司`)
    assert.ok(String(payload.trackingNumber || '').trim(), `${record.recordCode} 退样或寄回时必须填写快递单号`)
    assert.ok(String(payload.logisticsEvidence || '').trim(), `${record.recordCode} 退样或寄回时必须填写物流凭证`)
  }
})
const generatedReturnCases = listPcsSampleReturnCases().filter((item) => item.caseId.startsWith('project-'))
assert.ok(generatedReturnCases.length > 0, '样衣退回处理正式记录必须派生到样衣退货与处理案件列表')
assert.equal(
  listPcsSampleReturnCases().filter((item) => !item.caseId.startsWith('project-')).length,
  0,
  '样衣退货与处理 mock 不应保留没有商品项目节点上游的静态案件',
)
assert.ok(
  generatedReturnCases.every((item) => item.sampleCode && item.sampleCode !== '-' && item.reasonCategory !== '退回处理'),
  '项目样衣退回处理派生案件必须带真实样衣编号和处理方式',
)
assert.ok(
  generatedReturnCases
    .filter((item) => item.caseType === '退货')
    .every((item) => item.carrier && item.trackingNo && item.logisticsEvidence),
  '项目样衣退样或寄回派生案件必须带快递公司、快递单号和物流凭证',
)
assert.ok(
  listPcsSampleLedgerEvents().some((item) => generatedReturnCases.some((caseItem) => caseItem.caseCode === item.sourceDoc)),
  '样衣退回处理正式记录必须派生样衣台账事件',
)
assert.ok(
  listPcsSampleLedgerEvents()
    .filter((item) => generatedReturnCases.some((caseItem) => caseItem.caseCode === item.sourceDoc))
    .every((item) => item.sampleCode && item.sampleCode !== '-'),
  '项目样衣退回处理派生台账必须带真实样衣编号',
)
assert.ok(
  listPcsSampleLedgerEvents().every((item) => !String(item.sourceDoc || '').startsWith('RC-202604-')),
  '样衣台账不应保留没有商品项目节点上游的静态退货/处置来源',
)
assert.ok(
  listPcsSampleRecords().some((item) => ['已退货', '已处置', '待处置', '在库可用'].includes(item.status)),
  '样衣退回处理必须能覆盖样衣库存状态',
)
assert.ok(
  listPcsSampleRecords().every((item) => !item.sampleCode.startsWith('SY-INA') || !['已退货', '待处置', '已处置'].includes(item.status)),
  '静态样衣库存不应保留没有商品项目节点上游的退回/处置状态',
)

const conclusionField = getProjectWorkItemContract('TEST_CONCLUSION').fieldDefinitions.find((field) => field.fieldKey === 'conclusion')
assert.deepEqual(
  conclusionField?.options?.map((option) => option.value),
  ['通过', '不通过', '继续测试'],
  '测款结论必须为通过、不通过、继续测试',
)
assertIncludesAll(
  fieldKeys('TEST_CONCLUSION'),
  ['productPositioningConclusion', 'stockGrade', 'continueTestFlag', 'downShelfFlag', 'returnDestination', 'nextTestPlan'],
  '测款结论字段未覆盖产品定位、备货等级、继续测试、下架和退回去向',
)

const domesticProject = createProject(buildDraft(DOMESTIC_PURCHASE_SAMPLE_TEMPLATE_ID), '验收脚本').project
assert.equal(domesticProject.projectType, '商品开发', '国内采购样衣测款项目应生成商品开发项目类型')
assert.ok(!(('style' + 'Type') in domesticProject), '商品项目主记录不应再包含旧属性字段')
assert.deepEqual(
  listProjectNodes(domesticProject.projectId).map((node) => node.workItemTypeCode),
  domesticFlow,
  '国内采购样衣测款项目创建后的节点顺序不正确',
)
const domesticSampleCostNode = listProjectNodes(domesticProject.projectId).find((node) => node.workItemTypeCode === 'SAMPLE_COST_REVIEW')
assert.equal(domesticSampleCostNode?.multiInstanceFlag, false, '国内采购样衣测款项目中的样衣核价节点必须为单实例')
assert.deepEqual(
  listProjectPhases(domesticProject.projectId).map((phase) => phase.phaseCode),
  ['PHASE_01', 'PHASE_02', 'PHASE_03', 'PHASE_04', 'PHASE_05'],
  '国内采购样衣测款项目应生成五个阶段',
)

const wanlongProject = createProject(buildDraft(WANLONG_REVISION_SAMPLE_TEMPLATE_ID), '验收脚本').project
assert.equal(wanlongProject.projectType, '改版开发', '万隆改版出样衣测款项目应生成改版开发项目类型')
assert.ok(!(('style' + 'Type') in wanlongProject), '万隆改版项目主记录不应再包含旧属性字段')
assert.deepEqual(
  listProjectNodes(wanlongProject.projectId).map((node) => node.workItemTypeCode),
  wanlongFlow,
  '万隆改版出样衣测款项目创建后的节点顺序不正确',
)
const wanlongSampleCostNode = listProjectNodes(wanlongProject.projectId).find((node) => node.workItemTypeCode === 'SAMPLE_COST_REVIEW')
assert.equal(wanlongSampleCostNode?.multiInstanceFlag, false, '万隆改版项目中的样衣核价节点必须为单实例')

console.log('check-pcs-product-testing-v1 passed')
