import assert from 'node:assert/strict'
import test from 'node:test'

import '../../src/data/fcs/design-revision-process-work-order-adapter.ts'
import {
  DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS,
  confirmEngineeringIndependentSamplingScheme,
  copyEngineeringIndependentSamplingDrafts,
  createEngineeringIndependentSampling,
  getEngineeringIndependentSamplingRecord,
  listEngineeringIndependentAvailablePatternVersions,
  listEngineeringIndependentSamplingRecords,
  replaceEngineeringIndependentDesignFiles,
  saveEngineeringIndependentSamplingDraftRequirements,
  submitEngineeringIndependentProfessionalTask,
} from '../../src/data/pcs-engineering-master-sampling.ts'
import { getEngineeringBomPricingPlan, getEngineeringBomVersionById, saveEngineeringBomPricingPlan, saveEngineeringBomVersion } from '../../src/data/pcs-engineering-bom-repository.ts'
import { resolveDesignRevisionMaterialSku } from '../../src/data/pcs-design-revision-material-sku.ts'
import { calculateEngineeringBomTotalRequirement, resolveEngineeringBomConversion, resolveEngineeringBomMaterialLine } from '../../src/data/pcs-engineering-bom-material-resolver.ts'
import { collectProjectArchiveAutoData } from '../../src/data/pcs-project-archive-collector.ts'
import { getProjectArchiveByProjectId } from '../../src/data/pcs-project-archive-repository.ts'
import { getProjectById } from '../../src/data/pcs-project-repository.ts'
import { listProjectRelationsBySourceObject } from '../../src/data/pcs-project-relation-repository.ts'
import { getStyleArchiveById } from '../../src/data/pcs-style-archive-repository.ts'
import { getDyeWorkOrderById } from '../../src/data/fcs/dyeing-task-domain.ts'
import { getPrintWorkOrderById } from '../../src/data/fcs/printing-task-domain.ts'
import { renderPcsIndependentSamplingDetailPage, renderPcsIndependentSamplingProfessionalTaskPage } from '../../src/pages/pcs-independent-sampling.ts'

test('目标 SKU 的四种加工组合、前序实物和 BOM Q 均按已建档字段读取', () => {
  const cases = [
    { id: 'dr_cotton_raw', dye: false, print: false, raw: 'dr_cotton_raw', dyed: '' },
    { id: 'dr_cotton_dyed', dye: true, print: false, raw: 'dr_cotton_raw', dyed: 'dr_cotton_dyed' },
    { id: 'dr_cotton_print', dye: false, print: true, raw: 'dr_cotton_raw', dyed: '' },
    { id: 'dr_cotton_dye_print', dye: true, print: true, raw: 'dr_cotton_raw', dyed: 'dr_cotton_dyed' },
  ]
  cases.forEach(({ id, dye, print, raw, dyed }) => {
    const snapshot = resolveDesignRevisionMaterialSku(id, '2026-09-23 09:00:00')
    assert.equal(snapshot.targetSkuId, id)
    assert.equal(snapshot.requiresDye, dye)
    assert.equal(snapshot.requiresPrint, print)
    assert.equal(snapshot.rawSkuId, raw)
    assert.equal(snapshot.dyedSkuId, dyed)
    assert.ok(snapshot.materialImageUrl)
    if (dye) assert.ok(snapshot.pantoneCode)
    if (print) assert.ok(snapshot.patternCode && snapshot.patternImageUrl)
  })
  assert.throws(() => resolveDesignRevisionMaterialSku('missing-sku'), /不存在或已停用/)
  const conversion = resolveEngineeringBomConversion('dr_cotton_dye_print', 'Yard', 'Yard')
  assert.equal(calculateEngineeringBomTotalRequirement({ usage: 2, sampleQuantity: 3, lossRate: 0, conversionToPricingUnit: conversion }), 6)
  assert.equal(calculateEngineeringBomTotalRequirement({ usage: 6, quantityBasis: 'ORDER_TOTAL', sampleQuantity: 3, lossRate: 0, conversionToPricingUnit: conversion }), 6)
  assert.equal(calculateEngineeringBomTotalRequirement({ usage: 6, quantityBasis: 'ORDER_TOTAL', sampleQuantity: 3, lossRate: 0, conversionToPricingUnit: 0.9144 }), 5.4864)
  const resolved = resolveEngineeringBomMaterialLine({ materialSkuId: 'dr_cotton_dye_print', usage: 6, quantityBasis: 'ORDER_TOTAL', sampleQuantity: 3, usageUnit: 'Yard', lossRate: 0 })
  assert.equal(resolved.totalRequirementQuantity, 6)
  assert.equal(resolved.materialCostCny, Math.round(6 * resolved.standardUnitPriceCny! * 100) / 100)
  const converted = resolveEngineeringBomMaterialLine({ materialSkuId: 'dr_cotton_dye_print', usage: 2, quantityBasis: 'PER_SAMPLE', sampleQuantity: 2, usageUnit: '米', lossRate: 0 })
  assert.equal(converted.pricingUnit, 'Yard')
  assert.ok(Math.abs(converted.totalRequirementQuantity - 4 / 0.9144) < 0.000001)
  assert.equal(resolveEngineeringBomConversion('material_fabric_001_sku_001', '米', 'Yard'), 1 / 0.9144)
})

test('整单总量口径保存后仍按一次总量计算，不被样衣件数重复放大', () => {
  const target = listEngineeringIndependentSamplingRecords().find((record) => record.targetStyleCode === 'STYLE-PRJ-202603-012')!
  const buyer = { role: '买手' as const, userId: target.buyerId, userName: target.buyerName }
  const draft = createEngineeringIndependentSampling({
    targetStyleId: target.targetStyleId, creationReason: '验证上游已给出的整单物料总量',
    designFiles: target.designFiles, patternHandling: 'REMAKE', buyer, createdAt: '2026-09-23 09:05:00',
  })
  saveEngineeringBomVersion({
    versionId: draft.bomDraftVersionId, ...buyer,
    materialLines: [{ materialSkuId: 'dr_cotton_dye_print', usage: 6, quantityBasis: 'ORDER_TOTAL', sampleQuantity: 3, usageUnit: 'Yard', lossRate: 0, dyeRequirement: '是', printRequirement: '是' }],
    updatedAt: '2026-09-23 09:06:00',
  })
  const saved = getEngineeringBomVersionById(draft.bomDraftVersionId)!.materialLines[0]
  assert.equal(saved.quantityBasis, 'ORDER_TOTAL')
  assert.equal(saved.sampleQuantity, 3)
  assert.equal(resolveEngineeringBomMaterialLine(saved).totalRequirementQuantity, 6)
  saveEngineeringBomPricingPlan({
    ownerStage: 'INDEPENDENT_SAMPLING', ownerId: draft.samplingTaskId,
    ...buyer, customCostDecision: 'NO_CUSTOM_COST', customCosts: [], updatedAt: '2026-09-23 09:07:00',
  })
  const submitted = confirmEngineeringIndependentSamplingScheme({
    samplingTaskId: draft.samplingTaskId, actor: buyer,
    displaySampleAssignment: DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS[0],
    sampleRequirements: [{ targetColor: '整款', targetSize: 'M', requiredQuantity: 3, requirementNote: '' }],
    selectedTaskTypes: ['BASE_PATTERN', 'DISPLAY_SAMPLE'], confirmedAt: '2026-09-23 09:08:00',
  })
  const references = submitted.professionalTasks.flatMap((task) => task.processWorkOrderRefs)
  assert.equal(references.length, 2)
  assert.equal(getDyeWorkOrderById(references.find((ref) => ref.processType === 'DYEING')!.processOrderId)?.plannedQty, 6)
  const printOrder = getPrintWorkOrderById(references.find((ref) => ref.processType === 'PRINTING')!.processOrderId)!
  assert.equal(printOrder.plannedQty, 6)
  assert.equal(printOrder.sourceSnapshot?.materialWidthCm, 150)
  assert.equal(printOrder.businessView?.plannedInput.spu, 'DR-COTTON-001')
  assert.equal(printOrder.businessView?.plannedInput.composition, '100% 棉')
  assert.equal(printOrder.businessView?.output.composition, '100% 棉')
  assert.equal(printOrder.businessView?.plannedInput.widthCm, 150)
  assert.equal(printOrder.businessView?.plannedInput.gsm, 180)
})

test('一张设计改款 BOM 同时有 Yard 面料和 PCS 辅料时，各行独立计量且辅料无需加工调拨', () => {
  const target = listEngineeringIndependentSamplingRecords().find((record) => record.targetStyleCode === 'STYLE-PRJ-202603-012')!
  const buyer = { role: '买手' as const, userId: target.buyerId, userName: target.buyerName }
  const accessory = resolveDesignRevisionMaterialSku('material_accessory_001_sku_001')
  assert.equal(accessory.pricingUnit, 'PCS')
  assert.equal(accessory.requiresDye, false)
  assert.equal(accessory.requiresPrint, false)
  const draft = createEngineeringIndependentSampling({
    targetStyleId: target.targetStyleId, creationReason: '面料染色并使用现有辅料制作展示样衣',
    designFiles: target.designFiles, patternHandling: 'REMAKE',
    creationSampleRequirements: [{ targetColor: '整款', targetSize: 'M', requiredQuantity: 2, requirementNote: '' }],
    buyer, createdAt: '2026-09-23 09:10:00',
  })
  saveEngineeringBomVersion({
    versionId: draft.bomDraftVersionId, ...buyer,
    materialLines: [
      { materialSkuId: 'dr_cotton_dyed', usage: 2, quantityBasis: 'PER_SAMPLE', sampleQuantity: 2, usageUnit: 'Yard', lossRate: 0, dyeRequirement: '是', printRequirement: '否' },
      { materialSkuId: 'material_accessory_001_sku_001', usage: 3, quantityBasis: 'PER_SAMPLE', sampleQuantity: 2, usageUnit: 'PCS', lossRate: 0, dyeRequirement: '否', printRequirement: '否' },
    ],
    updatedAt: '2026-09-23 09:11:00',
  })
  const lines = getEngineeringBomVersionById(draft.bomDraftVersionId)!.materialLines
  assert.deepEqual(lines.map((line) => resolveEngineeringBomMaterialLine(line).totalRequirementQuantity), [4, 6])
  const html = renderPcsIndependentSamplingDetailPage(draft.samplingTaskId)
  assert.match(html, /计划用量 4\.0000 Yard/)
  assert.match(html, /计划用量 6\.0000 PCS/)
  assert.doesNotMatch(html, /计划用量 10\.0000 (?:Yard|PCS)/)
  saveEngineeringBomPricingPlan({
    ownerStage: 'INDEPENDENT_SAMPLING', ownerId: draft.samplingTaskId,
    ...buyer, customCostDecision: 'NO_CUSTOM_COST', customCosts: [], updatedAt: '2026-09-23 09:12:00',
  })
  const submitted = confirmEngineeringIndependentSamplingScheme({
    samplingTaskId: draft.samplingTaskId, actor: buyer,
    displaySampleAssignment: DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS[0],
    sampleRequirements: [{ targetColor: '整款', targetSize: 'M', requiredQuantity: 2, requirementNote: '' }],
    selectedTaskTypes: ['BASE_PATTERN', 'DISPLAY_SAMPLE'], confirmedAt: '2026-09-23 09:13:00',
  })
  const refs = submitted.professionalTasks.flatMap((task) => task.processWorkOrderRefs)
  assert.equal(refs.length, 1)
  assert.equal(refs[0].processType, 'DYEING')
  assert.equal(getDyeWorkOrderById(refs[0].processOrderId)?.plannedQty, 4)
  assert.equal(submitted.professionalTasks.find((task) => task.taskType === 'DISPLAY_SAMPLE')?.status, 'WAIT_DEPENDENCY')
})

test('复用既有纸样与参照 BOM 的无印染任务可直接提交样衣并自动完成；复制只生成草稿', () => {
  const seeded = listEngineeringIndependentSamplingRecords()
  const reference = seeded.find((record) => record.targetStyleCode === 'STYLE-PRJ-202603-011' && record.status === 'COMPLETED')!
  const target = seeded.find((record) => record.targetStyleCode === 'STYLE-PRJ-202603-012')!
  const buyer = { role: '买手', userId: target.buyerId, userName: target.buyerName }
  const pattern = reference.professionalTasks.find((task) => task.taskType === 'BASE_PATTERN')?.results[0]?.files.find((file) => file.extension === 'prj')
  const sampleImage = reference.professionalTasks.find((task) => task.taskType === 'DISPLAY_SAMPLE')?.results[0]?.files.find((file) => file.extension === 'jpg' || file.extension === 'png')
  assert.ok(pattern)
  assert.ok(sampleImage)
  const conceptSampleImage = {
    ...sampleImage,
    fileName: 'style-prj-202603-012-blue-floral-polo-effect.jpg',
    dataUrl: '/design-revision-demo/style-prj-202603-012-blue-floral-polo-effect.jpg',
  }

  const draft = createEngineeringIndependentSampling({
    sourceStyleId: reference.targetStyleId,
    targetStyleId: target.targetStyleId,
    creationReason: '沿用纸样，按目标款制作销售展示样衣',
    designFiles: target.designFiles,
    patternHandling: 'REUSE',
    reusedPatternFiles: [pattern],
    creationSampleRequirements: [{ targetColor: '整款', targetSize: 'M', requiredQuantity: 1, requirementNote: '' }],
    buyer,
    createdAt: '2026-09-23 09:00:00',
  })
  const bom = getEngineeringBomVersionById(draft.bomDraftVersionId)!
  assert.ok(bom.sourceVersionId, '有参照时须带入来源 BOM')
  assert.equal(bom.materialLines.length, 1)
  assert.equal(draft.professionalTasks.length, 0)

  saveEngineeringBomPricingPlan({
    ownerStage: 'INDEPENDENT_SAMPLING', ownerId: draft.samplingTaskId,
    role: '买手', userId: buyer.userId, userName: buyer.userName,
    customCostDecision: 'NO_CUSTOM_COST', customCosts: [], updatedAt: '2026-09-23 09:01:00',
  })
  const submission = {
    samplingTaskId: draft.samplingTaskId, actor: buyer,
    displaySampleAssignment: DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS[0],
    sampleRequirements: [{ targetColor: '整款', targetSize: 'M', requiredQuantity: 1, requirementNote: '' }],
    confirmedAt: '2026-09-23 09:02:00',
  }
  assert.throws(() => confirmEngineeringIndependentSamplingScheme({
    ...submission,
    displaySampleAssignment: { ...DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS[0], receivingFactoryId: 'ID-F014', receivingFactoryName: '其他工厂' },
    selectedTaskTypes: ['DISPLAY_SAMPLE'],
  }), /goto_global 中央车缝工厂/)
  assert.throws(() => confirmEngineeringIndependentSamplingScheme({
    ...submission, selectedTaskTypes: ['DISPLAY_SAMPLE', 'PATTERN_ARTWORK'],
  }), /只生成基码纸样和销售展示样衣/)
  assert.equal(getEngineeringIndependentSamplingRecord(draft.samplingTaskId)?.status, 'DRAFT')

  const active = confirmEngineeringIndependentSamplingScheme({ ...submission, selectedTaskTypes: ['DISPLAY_SAMPLE'] })
  assert.deepEqual(active.professionalTasks.map((task) => task.taskType), ['DISPLAY_SAMPLE'])
  const sample = active.professionalTasks[0]
  assert.equal(sample.processWorkOrderRefs.length, 0)
  const sampleHtml = renderPcsIndependentSamplingProfessionalTaskPage(sample.taskId)
  assert.match(sampleHtml, /可填报样衣/)
  assert.doesNotMatch(sampleHtml, /data-pcs-independent-sampling-action="start-task"/)
  const requirement = sample.sampleRequirements[0]
  const paperVersion = listEngineeringIndependentAvailablePatternVersions(active)[0]?.value
  assert.ok(paperVersion?.startsWith('REUSE:'))
  const completed = submitEngineeringIndependentProfessionalTask({
    taskId: sample.taskId,
    actor: { role: '管理员', userId: 'U-ADMIN', userName: '中央工厂验收员' },
    results: [{
      title: '整款 / M 销售展示样衣', requirementLineId: requirement.requirementLineId,
      sampleQuantity: 1, sampleColor: '整款', sampleSize: 'M', sourcePatternVersion: paperVersion,
      description: '使用既有面辅料制作', files: [conceptSampleImage],
    }],
    submittedAt: '2026-09-23 09:03:00',
  })
  assert.equal(completed.status, 'COMPLETED')
  assert.equal(completed.confirmedAt, '2026-09-23 09:03:00')
  assert.equal(completed.professionalTasks[0].status, 'COMPLETED')
  assert.match(renderPcsIndependentSamplingProfessionalTaskPage(sample.taskId), /概念效果图 · 仅供 Mock 演示，不代表实物样衣照片/)
  const targetStyle = getStyleArchiveById(completed.targetStyleId)!
  const project = getProjectById(targetStyle.sourceProjectId)!
  const archive = getProjectArchiveByProjectId(project.projectId)!
  const relations = listProjectRelationsBySourceObject({
    sourceModule: '设计改款任务', sourceObjectType: '设计改款任务', sourceObjectId: completed.samplingTaskId,
  })
  assert.equal(relations.length, 1)
  assert.equal(relations[0].sourceStatus, 'COMPLETED')
  const autoCollected = collectProjectArchiveAutoData(archive, project, targetStyle)
  const archivedTask = autoCollected.documents.find((item) => item.documentGroup === 'DESIGN_REVISION_RECORD' && item.sourceObjectId === completed.samplingTaskId)
  assert.equal(archivedTask?.documentStatus, 'COMPLETED')
  assert.ok(autoCollected.files.some((file) => file.archiveDocumentId === archivedTask?.archiveDocumentId && file.fileName === conceptSampleImage.fileName))
  assert.throws(() => submitEngineeringIndependentProfessionalTask({
    taskId: sample.taskId,
    actor: { role: '管理员', userId: 'U-ADMIN', userName: '中央工厂验收员' },
    results: [{ title: '重复提交', requirementLineId: requirement.requirementLineId, sampleQuantity: 1,
      sampleColor: '整款', sampleSize: 'M', sourcePatternVersion: paperVersion,
      description: '同一成果重复提交', files: [sampleImage] }],
    submittedAt: '2026-09-23 09:03:01',
  }), /当前任务尚不能提交/)
  assert.equal(listProjectRelationsBySourceObject({
    sourceModule: '设计改款任务', sourceObjectType: '设计改款任务', sourceObjectId: completed.samplingTaskId,
  }).length, 1)

  const copy = copyEngineeringIndependentSamplingDrafts({
    samplingTaskIds: [completed.samplingTaskId], actor: buyer, createdAt: '2026-09-23 09:04:00',
  })[0]
  assert.equal(copy.error, '')
  const copied = getEngineeringIndependentSamplingRecord(copy.draftTaskId)!
  assert.equal(copied.status, 'DRAFT')
  assert.equal(copied.professionalTasks.length, 0)
  assert.equal(copied.confirmedAt, '')
  assert.equal(copied.creationSampleRequirements.length, 0)
  assert.equal(getEngineeringBomVersionById(copied.bomDraftVersionId)?.materialLines.length, 1)
})

test('批量复制仅继承建单输入，后续设计稿、BOM 和样衣要求均需重新维护', () => {
  const target = listEngineeringIndependentSamplingRecords().find((record) => record.targetStyleCode === 'STYLE-PRJ-202603-012')!
  const buyer = { role: '买手' as const, userId: target.buyerId, userName: target.buyerName }
  const originalDesign = target.designFiles[0]
  const secondInitialDesign = { ...originalDesign, fileId: `${originalDesign.fileId}-SECOND`, fileName: 'second-initial.jpg' }
  const source = createEngineeringIndependentSampling({
    sourceStyleId: '', targetStyleId: target.targetStyleId, creationReason: '创建字段复制检查',
    designFiles: [originalDesign, secondInitialDesign], reuseDesignFileReferences: true, patternHandling: 'REMAKE',
    buyer, createdAt: '2026-09-23 10:00:00',
  })
  saveEngineeringBomVersion({
    versionId: source.bomDraftVersionId, ...buyer,
    materialLines: [{ materialSkuId: 'dr_cotton_dye_print', usage: 2, sampleQuantity: 2, usageUnit: 'Yard', lossRate: 0, dyeRequirement: '是', printRequirement: '是' }],
    updatedAt: '2026-09-23 10:01:00',
  })
  saveEngineeringIndependentSamplingDraftRequirements({
    samplingTaskId: source.samplingTaskId, actor: buyer,
    sampleRequirements: [{ targetColor: '蓝色', targetSize: 'M', requiredQuantity: 2, requirementNote: '后续维护' }],
    savedAt: '2026-09-23 10:02:00',
  })
  replaceEngineeringIndependentDesignFiles({
    samplingTaskId: source.samplingTaskId, actor: buyer,
    designFiles: [{ ...originalDesign, fileId: `${originalDesign.fileId}-REPLACED`, fileName: 'after-creation.jpg', uploadedById: buyer.userId, uploadedByTeam: '买手' }],
    replacedAt: '2026-09-23 10:03:00',
  })
  const [missing, result] = copyEngineeringIndependentSamplingDrafts({
    samplingTaskIds: ['ES-ID-DR-MISSING', source.samplingTaskId], actor: buyer, createdAt: '2026-09-23 10:04:00',
  })
  assert.match(missing.error, /不存在/)
  assert.equal(missing.draftTaskId, '')
  assert.equal(result.error, '')
  const copied = getEngineeringIndependentSamplingRecord(result.draftTaskId)!
  assert.equal(copied.status, 'DRAFT')
  assert.equal(copied.sourceStyleId, '')
  assert.equal(copied.targetStyleId, source.targetStyleId)
  assert.equal(copied.creationReason, source.creationReason)
  assert.deepEqual(copied.designFiles.map((file) => file.fileId), [originalDesign.fileId, secondInitialDesign.fileId])
  assert.equal(copied.professionalTasks.length, 0)
  assert.equal(copied.creationSampleRequirements.length, 0)
  assert.equal(getEngineeringBomVersionById(copied.bomDraftVersionId)?.materialLines.length, 0)
})

test('单页创建同时保存物料、费用与样衣要求；失败不留下空任务', () => {
  const source = listEngineeringIndependentSamplingRecords().find(row => row.targetStyleCode === 'STYLE-PRJ-202603-012')!
  const buyer = { role: '买手', userId: source.buyerId, userName: source.buyerName }
  const input = { sourceStyleId: '', targetStyleId: source.targetStyleId, creationReason: '单页创建',
    designFiles: source.designFiles, buyer, createdAt: '2026-09-24 11:00:00',
    creationSampleRequirements: [{ targetColor: '蓝色', targetSize: 'M', requiredQuantity: 3, requirementNote: '展示用' }],
    materialLines: [{ materialSkuId: 'dr_cotton_dye_print', usage: 2, usageUnit: 'Yard', lossRate: 0 }],
    customCosts: [{ title: '车位费', amountIdr: 12000, note: '', displayOrder: 1 }],
  }
  const before = listEngineeringIndependentSamplingRecords().length
  assert.throws(() => createEngineeringIndependentSampling({ ...input, creationSampleRequirements: [{ ...input.creationSampleRequirements[0], requiredQuantity: 0 }] }), /整数件数/)
  assert.equal(listEngineeringIndependentSamplingRecords().length, before)
  const created = createEngineeringIndependentSampling(input)
  assert.equal(listEngineeringIndependentSamplingRecords().length, before + 1)
  assert.equal(created.creationSampleRequirements[0].requiredQuantity, 3)
  const line = getEngineeringBomVersionById(created.bomDraftVersionId)!.materialLines[0]
  assert.equal(line.sampleQuantity, 3)
  assert.equal(resolveEngineeringBomMaterialLine(line).totalRequirementQuantity, 6)
  assert.equal(getEngineeringBomPricingPlan('INDEPENDENT_SAMPLING', created.samplingTaskId)!.customCosts[0].amountIdr, 12000)
  assert.equal(created.professionalTasks.length, 0)
})
