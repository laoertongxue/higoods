import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'

const BASE = 'http://127.0.0.1:43188'
const STYLE_CODE = 'STYLE-PRJ-202603-009'
const DEMAND_ID = 'DEM-TMF-PCS-UI'
const evidence = { checks: [], errors: [], navigations: [] }
mkdirSync('output/playwright/tmf-webbing', { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  page.setDefaultTimeout(20000)
  page.on('pageerror', (error) => evidence.errors.push(error.message))
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) evidence.navigations.push({ at: new Date().toISOString(), url: frame.url() })
  })

  // 预热将要使用的模块图，保证页面与脚本共享同一模块实例。
  for (const path of ['/pcs/technical-data/tech-packs', '/fcs/production/demand-inbox', '/pcs/products/styles']) {
    await page.goto(`${BASE}${path}`)
    await page.waitForTimeout(1200)
  }

  // 夹具：款式档案已有可复用的设计改款成果；建立生产准备单、技术包草稿与织带路线/规格；补一条待转换需求。
  const fixture = await page.evaluate(async ({ styleCode, demandId }) => {
    const load = (path) => import(performance.getEntriesByType('resource').find((entry) => new URL(entry.name).pathname === path)?.name ?? path)
    const styleRepo = await load('/src/data/pcs-style-archive-repository.ts')
    const masterRepo = await load('/src/data/pcs-engineering-master-repository.ts')
    const versionRepo = await load('/src/data/pcs-technical-data-version-repository.ts')
    const materialRepo = await load('/src/data/pcs-material-archive-repository.ts')
    const demandRepo = await load('/src/data/fcs/production-demands.ts')
    const routeKernel = await load('/src/data/tech-pack-process-route.ts')
    const FIXED = '2026-09-20 10:00:00'
    const merchandiser = { id: 'TM-MERCH', name: '链测试跟单' }
    const style = styleRepo.findStyleArchiveByCode(styleCode)
    if (!style) throw new Error('演示款式档案不存在')
    const master = masterRepo.createEngineeringMasterOrder({
      styleId: style.styleId, styleCode,
      merchandiserName: merchandiser.name, merchandiserId: merchandiser.id,
      createdBy: merchandiser.name, createdById: merchandiser.id, createdByRole: '跟单',
      preparationType: 'PURE_WOVEN',
      qualificationFact: {
        styleCode, formalSaleStatus: 'NO_FORMAL_SALE', formalProductionStatus: 'NO_FORMAL_PRODUCTION',
        formalSaleSource: 'UI链测试固定事实', formalProductionSource: 'UI链测试固定事实', checkedAt: FIXED,
      },
      bulkProductionQualification: {
        basisType: 'DESIGN_REVISION_READY', triggerBusinessObjectType: '设计改款任务',
        triggerBusinessObjectId: masterRepo.listEngineeringMasterPriorResultCandidates(styleCode, 'PURE_WOVEN')[0].source.samplingTaskId,
        thresholdQuantity: null, reachedQuantity: null, reachedAt: FIXED,
        reason: 'UI链测试资格', uniqueTriggerKey: `TMF-PCS-UI-${Date.now()}`,
      },
      creationReason: 'TMF发布采用UI链测试',
    })
    const candidates = masterRepo.listEngineeringMasterPriorResultCandidates(styleCode, 'PURE_WOVEN')
    masterRepo.confirmEngineeringMasterTaskPlan(master.masterOrderId, {
      confirmedBy: merchandiser.name, confirmedById: merchandiser.id, confirmedByRole: '跟单', preparationType: 'PURE_WOVEN',
      bomConditions: { hasPrintRequirement: false, hasYarnDyeRequirement: false, hasFabricDyeRequirement: false, hasAccessoryPurchaseRequirement: false },
      selectedConditionalTaskTypes: [],
      priorResultDecisions: candidates.map((candidate) => ({
        engineeringTaskType: candidate.engineeringTaskType,
        sourceSamplingTaskId: candidate.source.samplingTaskId,
        sourceProfessionalTaskId: candidate.source.professionalTaskId,
        sourceResultVersion: candidate.source.resultVersion,
        decision: candidate.engineeringTaskType === 'BASE_PATTERN_WOVEN' ? '复用' : '重新执行',
      })),
      preProductionSampleRequirements: [{ targetColor: '白', targetSize: 'S', requiredQuantity: 2, requirementNote: 'UI链测试产前确认' }],
    })
    const planned = masterRepo.getEngineeringMasterOrderById(master.masterOrderId)
    const confirmationTask = planned.tasks.find((task) => task.taskType === 'TECH_PACK_CONFIRMATION')
    const templateRecord = versionRepo.listTechnicalDataVersions().find((record) => record.technicalVersionCode === 'TDV-20260407-018')
    const template = versionRepo.getTechnicalDataVersionContent(templateRecord.technicalVersionId)
    const material = materialRepo.createMaterialArchive({
      kind: 'accessory', materialName: `TMF发布采用UI织带 ${Date.now()}`, materialNameEn: 'TMF adopt UI webbing',
      categoryName: '织带', specSummary: 'UI链测试白色 20mm', composition: '涤纶', processTags: [],
      widthText: '20mm', gramWeightText: '', pricingUnit: '米', mainUnit: '米', auxiliaryUnits: [], unitConversions: [],
      mainImageUrl: '', barcodeTemplateCode: '', remark: 'TMF发布采用UI链测试物料',
    })
    const sku = materialRepo.createMaterialSkuRecord(material.materialId, {
      colorName: '本白', specName: '20mm', sizeName: '-', skuImageUrl: '', costPrice: 10, freightCost: 0,
      weightKg: 0, lengthCm: 0, widthCm: 0, heightCm: 0, barcode: '',
    })
    const versionId = `tdv_tmf_pcs_ui_${Date.now()}`
    const specification = (id, size, lengthMm) => ({
      id, bomItemId: 'BOM-WB', usage: '腰带', garmentSize: size, piecesPerGarment: 1,
      cutLengthMm: lengthMm, finishedLengthMm: lengthMm, lengthBasis: 'EXCLUDING_ENDS', toleranceMm: 2,
      measurementCondition: '自然平放', cuttingMethod: '冷切', acceptanceRequirement: '按确认样',
      tippingRequired: false, endA: { method: 'NONE', specification: '' }, endB: { method: 'NONE', specification: '' },
    })
    versionRepo.createTechnicalDataVersionDraft({
      technicalVersionId: versionId, technicalVersionCode: 'TDV-TMF-PCS-UI', versionLabel: 'V1.0', versionNo: 1,
      styleId: style.styleId, styleCode, styleName: style.styleName,
      sourceProjectId: master.masterOrderId, sourceProjectCode: planned.masterOrderCode, sourceProjectName: 'TMF UI链测试生产准备主单',
      sourceProjectNodeId: '',
      primaryPlateTaskId: '', primaryPlateTaskCode: '', primaryPlateTaskVersion: '',
      linkedDesignRevisionTaskIds: [], linkedPatternTaskIds: [], linkedArtworkTaskIds: [],
      createdFromTaskType: 'ENGINEERING_MASTER', createdFromTaskId: confirmationTask.taskId, createdFromTaskCode: confirmationTask.taskId,
      baseTechnicalVersionId: '', baseTechnicalVersionCode: '', changeScope: '生产准备单生成', changeSummary: 'TMF UI链测试汇总',
      garmentDifficultyGrade: 'B',
      linkedPartTemplateIds: [], linkedPatternLibraryVersionIds: [], linkedPatternAssetIds: [], linkedPatternAssetCodes: [],
      archiveCollectedFlag: false, archiveCollectedAt: '',
      versionStatus: 'DRAFT', reviewStage: '未提交审核',
      bomStatus: 'COMPLETE', patternStatus: 'EMPTY', processStatus: 'COMPLETE', gradingStatus: 'EMPTY', qualityStatus: 'EMPTY',
      colorMaterialStatus: 'EMPTY', designStatus: 'COMPLETE', attachmentStatus: 'EMPTY',
      bomItemCount: 1, patternFileCount: 0, processEntryCount: 1, gradingRuleCount: 0, qualityRuleCount: 0,
      colorMaterialMappingCount: 0, designAssetCount: 0, attachmentCount: 0, completenessScore: 100,
      missingItemCodes: [], missingItemNames: [],
      publishedAt: '', publishedBy: '', createdAt: FIXED, createdBy: merchandiser.name,
      updatedAt: FIXED, updatedBy: merchandiser.name, note: '', legacySpuCode: '', legacyVersionLabel: '',
    }, {
      technicalVersionId: versionId,
      patternFiles: template.patternFiles.map((file, index) => ({ ...structuredClone(file), id: `${versionId}-PATTERN-${index + 1}` })),
      patternDesc: 'TMF UI链测试纸样结构',
      processEntries: [{
        id: 'CUT', entryType: 'PROCESS_BASELINE', stageCode: 'PREP', stageName: '准备阶段',
        processCode: 'WEBBING_CUT', processName: '织带截断',
        assignmentGranularity: 'DETAIL', defaultDocType: 'PREPARATION_ORDER', taskTypeMode: 'PROCESS', isSpecialCraft: false,
        routeObjectKey: 'BOM:BOM-WB', linkedBomItemIds: ['BOM-WB'], inputObjectType: 'ACCESSORY', outputObjectType: 'ACCESSORY',
        inputInventoryForm: 'CONTINUOUS', outputInventoryForm: 'FINISHED_PIECES',
        inputMaterialSkuId: sku.materialSkuId, outputMaterialSkuId: sku.materialSkuId,
        predecessorEntryIds: [], routeStepNo: 1, routeLaneNo: 1,
        webbingSpecifications: [specification('S-50', 'S', 500), specification('M-70', 'M', 700)],
      }],
      processRouteSchemaVersion: routeKernel.CURRENT_PROCESS_ROUTE_SCHEMA_VERSION,
      processRouteStatus: 'CONFIRMED', processRouteConfirmedBy: merchandiser.name, processRouteConfirmedAt: FIXED,
      sizeTable: template.sizeTable.map((row, index) => ({ ...structuredClone(row), id: `${versionId}-SIZE-${index + 1}` })),
      qualityRules: template.qualityRules.map((row, index) => ({ ...structuredClone(row), id: `${versionId}-QUALITY-${index + 1}` })),
      bomItems: [{
        id: 'BOM-WB', type: '辅料', name: material.materialName, spec: '20mm 白色 / 每件 0.65 米',
        materialCode: sku.materialCode, materialSkuId: sku.materialSkuId, unit: '米',
        unitConsumption: 0.65, sampleQuantity: 1, lossRate: 0, supplier: 'TMF基础生产',
      }],
      bomCustomCosts: [], bomCustomCostDecision: 'NO_CUSTOM_COST',
      colorMaterialMappings: [{
        id: `${versionId}-MAP-1`, spuCode: styleCode, colorCode: 'COLOR-1', colorName: '白',
        status: 'CONFIRMED', generatedMode: 'AUTO', confirmedBy: merchandiser.name, confirmedAt: FIXED,
        remark: 'TMF UI链测试映射',
        lines: [{
          id: `${versionId}-MAP-1-L1`, bomItemId: 'BOM-WB', materialCode: sku.materialCode, materialName: material.materialName,
          materialType: '辅料', unit: '米', applicableSkuCodes: [], sourceMode: 'AUTO', note: 'TMF UI链测试',
        }],
      }],
      patternDesigns: [], attachments: [], legacyCompatibleCostPayload: {},
    })
    return { versionId, styleId: style.styleId, materialSkuId: sku.materialSkuId }
  }, { styleCode: STYLE_CODE, demandId: DEMAND_ID })
  evidence.fixture = fixture

  // 1) 技术包页面：提交审核 → 域内固定审核人通过 → 页面发布新版本
  await page.goto(`${BASE}/pcs/products/styles/${encodeURIComponent(fixture.styleId)}/technical-data/${encodeURIComponent(fixture.versionId)}`)
  await page.locator('[data-tech-action="submit-review"]').waitFor()
  await page.locator('[data-tech-action="submit-review"]').click()
  await page.locator('[data-tech-action="confirm-submit-review"]').click()
  await page.waitForFunction(async () => {
    const load = (path) => import(performance.getEntriesByType('resource').find((entry) => new URL(entry.name).pathname === path)?.name ?? path)
    const repo = await load('/src/data/pcs-technical-data-version-repository.ts')
    const record = repo.listTechnicalDataVersions().find((item) => item.technicalVersionId.startsWith('tdv_tmf_pcs_ui_'))
    return Boolean(record && record.reviewStage && record.reviewStage !== '未提交审核')
  })
  evidence.checks.push('技术包页面“提交审核”弹窗按固定审核人提交成功，审核阶段进入第一阶段并行审核')

  await page.evaluate(async () => {
    const load = (path) => import(performance.getEntriesByType('resource').find((entry) => new URL(entry.name).pathname === path)?.name ?? path)
    const repo = await load('/src/data/pcs-technical-data-version-repository.ts')
    const review = await load('/src/data/pcs-tech-pack-review.ts')
    const record = repo.listTechnicalDataVersions().find((item) => item.technicalVersionId.startsWith('tdv_tmf_pcs_ui_'))
    for (const nodeKey of ['BUYER', 'PATTERN_MAKER']) {
      const node = nodeKey === 'BUYER' ? record.buyerReview : record.patternMakerReview
      if (!node || node.status === '无需审核' || node.status === '审核-已通过') continue
      const operator = { id: node.assignedReviewerId, name: node.assignedReviewerName }
      review.startTechPackReview(record.technicalVersionId, nodeKey, { operator, opinion: 'UI链测试开始审核' })
      review.approveTechPackReview(record.technicalVersionId, nodeKey, 'UI链测试审核通过', operator)
    }
    const refreshed = repo.getTechnicalDataVersionById(record.technicalVersionId)
    const merchandiser = refreshed.merchandiserReview
    const operator = { id: merchandiser.assignedReviewerId, name: merchandiser.assignedReviewerName }
    review.startTechPackReview(record.technicalVersionId, 'MERCHANDISER', { operator, opinion: 'UI链测试复核' })
    review.approveTechPackReview(record.technicalVersionId, 'MERCHANDISER', 'UI链测试确认发布', operator)
  })
  await page.reload()
  await page.locator('[data-tech-action="open-release"]').waitFor()
  await page.locator('[data-tech-action="open-release"]').click()
  await page.locator('[data-tech-action="confirm-release"]').click()
  await page.waitForFunction(async () => {
    const load = (path) => import(performance.getEntriesByType('resource').find((entry) => new URL(entry.name).pathname === path)?.name ?? path)
    const repo = await load('/src/data/pcs-technical-data-version-repository.ts')
    return repo.listTechnicalDataVersions().some((item) => item.technicalVersionId.startsWith('tdv_tmf_pcs_ui_') && item.versionStatus === 'PUBLISHED')
  })
  evidence.checks.push('技术包页面“发布新版本”弹窗确认后版本状态为 PUBLISHED；固定审核人节点在本链以域内动作完成，页面按钮对当前演示用户禁用')
  await page.screenshot({ path: 'output/playwright/tmf-webbing/pcs-adopt-published.png' })

  // 2) 产品档案：启用为当前生效版本
  await page.goto(`${BASE}/pcs/products/styles/${encodeURIComponent(fixture.styleId)}`)
  await page.locator('[data-pcs-product-archive-action="set-style-detail-tab"][data-value="versions"]').click()
  const activate = page.locator(`[data-pcs-product-archive-action="activate-tech-pack-version"][data-version-id="${fixture.versionId}"]`)
  await activate.waitFor()
  await activate.click()
  await page.waitForFunction(async (styleId) => {
    const load = (path) => import(performance.getEntriesByType('resource').find((entry) => new URL(entry.name).pathname === path)?.name ?? path)
    const repo = await load('/src/data/pcs-style-archive-repository.ts')
    const style = repo.getStyleArchiveById(styleId)
    return Boolean(style && style.currentTechPackVersionId && style.currentTechPackVersionId.startsWith('tdv_tmf_pcs_ui_'))
  }, fixture.styleId)
  evidence.checks.push('产品档案页面“启用为当前生效版本”点击后款式档案指向本次发布版本')

  // 3) 需求收件箱：采用选定版本生成生产单
  // 需求清单为内存数据，整页导航后会重置，因此在进入收件箱前于当前页面重新注入目标需求。
  await page.evaluate(async ({ demandId, styleCode }) => {
    const load = (path) => import(performance.getEntriesByType('resource').find((entry) => new URL(entry.name).pathname === path)?.name ?? path)
    const demandRepo = await load('/src/data/fcs/production-demands.ts')
    const templateDemand = demandRepo.productionDemands[0]
    demandRepo.productionDemands.unshift({
      ...structuredClone(templateDemand), demandId,
      spuCode: styleCode, spuName: 'TMF发布采用UI链目标款',
      skuLines: [
        { skuCode: 'SKU-TMF-UIS', size: 'S', color: '白', qty: 400 },
        { skuCode: 'SKU-TMF-UIM', size: 'M', color: '白', qty: 600 },
      ],
      requiredDeliveryDate: '2026-10-15', demandStatus: 'PENDING_CONVERT', hasProductionOrder: false, productionOrderId: null,
    })
  }, { demandId: DEMAND_ID, styleCode: STYLE_CODE })
  // 同一文档内使用站内路由进入收件箱，避免整页刷新丢弃内存需求。
  await page.evaluate(async () => {
    const load = (path) => import(performance.getEntriesByType('resource').find((entry) => new URL(entry.name).pathname === path)?.name ?? path)
    const { appStore } = await load('/src/state/store.ts')
    appStore.navigate('/fcs/production/demand-inbox')
  })
  await page.waitForURL(/demand-inbox/)
  const openSingle = page.locator(`[data-prod-action="open-demand-single"][data-demand-id="${DEMAND_ID}"]`)
  await openSingle.waitFor()
  await openSingle.click()
  const versionSelect = page.locator(`[data-prod-field="demandGenerateTechPackVersion:${DEMAND_ID}"]`)
  await versionSelect.waitFor()
  assert.equal(await versionSelect.inputValue(), fixture.versionId)
  await page.locator('[data-prod-action="open-demand-generate-confirm"]').click()
  await page.locator('[data-prod-action="confirm-demand-generate"]').click()
  await page.waitForFunction(async (demandId) => {
    const load = (path) => import(performance.getEntriesByType('resource').find((entry) => new URL(entry.name).pathname === path)?.name ?? path)
    const orders = await load('/src/data/fcs/production-orders.ts')
    return orders.productionOrders.some((order) => order.demandId === demandId && order.techPackSnapshot)
  }, DEMAND_ID)
  const adopted = await page.evaluate(async (demandId) => {
    const load = (path) => import(performance.getEntriesByType('resource').find((entry) => new URL(entry.name).pathname === path)?.name ?? path)
    const orders = await load('/src/data/fcs/production-orders.ts')
    const order = orders.productionOrders.find((item) => item.demandId === demandId)
    return { productionOrderId: order.productionOrderId, snapshotId: order.techPackSnapshot.snapshotId, sourceTechPackVersionId: order.techPackSnapshot.sourceTechPackVersionId, selectedTechPackVersionId: order.selectedTechPackVersionId }
  }, DEMAND_ID)
  evidence.adopted = adopted
  assert.equal(adopted.sourceTechPackVersionId, fixture.versionId)
  assert.equal(adopted.selectedTechPackVersionId, fixture.versionId)
  evidence.checks.push('需求收件箱按页面选择的已发布版本采用：生产单快照 RELEASED 且来源版本等于本次发布版本')

  // 4) 织带加工单：从生产单生成两条规格需求
  await page.goto(`${BASE}/fcs/craft/accessory/webbing/work-orders`)
  await page.locator('[data-tmf-work-orders-action="generate"]').click()
  const dialog = page.locator('[data-tmf-generate-action="preview"]')
  await dialog.waitFor()
  await page.locator('[name="productionOrder"]').fill(adopted.productionOrderId)
  await page.locator('[data-tmf-generate-action="preview"]').click()
  await page.waitForFunction(() => document.querySelector('[data-tmf-generate-preview]')?.textContent.includes('2 条规格需求'))
  await page.locator('[data-tmf-generate-action="confirm"]').click()
  await page.waitForFunction(() => document.querySelector('[data-tmf-work-feedback]')?.textContent.includes('已按生产单采用的技术包生成加工需求'))
  const registered = await page.evaluate(async (productionOrderId) => {
    const load = (path) => import(performance.getEntriesByType('resource').find((entry) => new URL(entry.name).pathname === path)?.name ?? path)
    const tmf = await load('/src/data/pms/tmf-material-purchases.ts')
    const demands = tmf.getTmfPurchaseState().demands.filter((item) => item.productionOrderId === productionOrderId)
    return { count: demands.length, lengths: demands.map((item) => item.specification.cutLengthMm).sort((a, b) => a - b), versionIds: [...new Set(demands.map((item) => item.techPackVersionId))], skus: [...new Set(demands.map((item) => item.materialSkuId))] }
  }, adopted.productionOrderId)
  evidence.registered = registered
  assert.equal(registered.count, 2)
  assert.deepEqual(registered.lengths, [500, 700])
  assert.deepEqual(registered.versionIds, [fixture.versionId])
  assert.deepEqual(registered.skus, [fixture.materialSkuId])
  evidence.checks.push('织带加工单页面从该生产单生成两条规格需求（500/700mm），版本与半成品SKU来自采用快照，未新增长度SKU')

  await page.setViewportSize({ width: 1024, height: 768 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: 'output/playwright/tmf-webbing/pcs-adopt-generated.png' })
  assert.deepEqual(evidence.errors, [])
} catch (error) {
  evidence.failure = String(error)
  throw error
} finally {
  writeFileSync('output/playwright/tmf-webbing/pcs-publish-adopt-browser.json', JSON.stringify(evidence, null, 2))
  await browser.close()
}
