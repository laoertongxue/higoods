import type { TechnicalDataVersionContent, TechnicalDataVersionRecord, TechnicalPatternPieceRow, TechnicalProcessEntry, TechnicalReviewNode } from './pcs-technical-data-version-types.ts'

const ORIGINAL_ROOT = '/production-confirmation-demo'
const FLOW_FABRICS = [
  { role: '主面料', code: 'MAT-FB-00000001', name: '棉涤梭织坯布', unit: 'Yard', skus: ['material-r1-MAT-FB-00000001-B01', 'material-r1-process-dye', 'material-r1-process-print'], designCode: 'pl001197' },
  { role: '拼接面料', code: 'MAT-FB-00000002', name: '白底蓝花棉布坯布', unit: 'Yard', skus: ['material-r1-MAT-FB-00000002-B01', 'material-r1-process-techpack-cotton-dye', 'material-r1-process-techpack-cotton-print'], designCode: 'pl001197' },
  { role: '里布', code: 'CNIDML360', name: '经编8坑-C2813', unit: 'Yard', skus: ['material_fabric_001_sku_001', 'material-r1-process-techpack-cn360-dye', 'material-r1-process-techpack-cn360-print'], designCode: 'pl001197' },
]
const FLOW_PIECES = ['前片', '后片', '左袖片', '右袖片', '领片']

/** Static demonstration content, shared physical sample files; ordinary reads never seed browser storage. */
export function completeTechnicalPackDemoContent(source: TechnicalDataVersionContent): TechnicalDataVersionContent {
  const content = structuredClone(source)
  const id = content.technicalVersionId
  const skuCodes = [...new Set(content.bomItems.flatMap(item => item.applicableSkuCodes || []))]
  const colors = [...new Set(content.colorMaterialMappings.map(item => item.colorName).filter(Boolean))]
  if (!colors.length) colors.push('默认色')
  const mainPattern = content.patternFiles.find(item => item.recordKind === 'MATERIAL_ASSOCIATION') || content.patternFiles[0]
  const patternId = mainPattern?.id || `${id}-pattern-main`
  const crafts = [
    { craftCode: 'CRAFT_3000001', craftName: '绣花' },
    { craftCode: 'CRAFT_3000002', craftName: '压褶' },
  ]
  const pieces: TechnicalPatternPieceRow[] = FLOW_PIECES.map((name, index) => ({
    id: `${patternId}-flow-piece-${index + 1}`, name, count: 1, sourceType: 'MANUAL',
    applicableSkuCodes: [...skuCodes],
    colorAllocations: colors.map((colorName, colorIndex) => ({ id: `${patternId}-flow-piece-${index + 1}-color-${colorIndex + 1}`, colorName, skuCodes: [...skuCodes], pieceCount: 1 })),
    specialCrafts: crafts.map(craft => ({ ...craft, processCode: 'SPECIAL_CRAFT', processName: '特殊工艺', displayName: craft.craftName, selectedTargetObject: '已裁部位', supportedTargetObjects: ['CUT_PIECE'], supportedTargetObjectLabels: ['已裁部位'] })),
  }))
  content.patternFiles = content.patternFiles.map(file => ({
    ...file,
    fileUrl: `${ORIGINAL_ROOT}/grey-zip-hoodie.dxf`,
    imageUrl: `${ORIGINAL_ROOT}/grey-zip-hoodie-pattern.svg`,
    dxfFileName: 'grey-zip-hoodie.dxf', rulFileName: 'grey-zip-hoodie.rul',
    patternFileMode: 'PAIRED_DXF_RUL', patternMaterialType: 'WOVEN', patternMaterialTypeLabel: '布料纸样',
    selectedSizeCodes: ['S', 'M', 'L', 'XL'], parseStatus: 'PARSED', parseStatusLabel: '已解析',
    merchandiserInfoStatus: '已填写', patternMakerInfoStatus: '已解析', maintainerStepStatus: '已完成',
    pieceRows: structuredClone(pieces), totalPieceCount: 5,
    dxfFile: { fileName: 'grey-zip-hoodie.dxf', fileType: 'DXF', fileSize: 2498, uploadedAt: file.uploadedAt, uploadedBy: '原型样本整理', dataUrl: `${ORIGINAL_ROOT}/grey-zip-hoodie.dxf` },
    rulFile: { fileName: 'grey-zip-hoodie.rul', fileType: 'RUL', fileSize: 575, uploadedAt: file.uploadedAt, uploadedBy: '原型样本整理', dataUrl: `${ORIGINAL_ROOT}/grey-zip-hoodie.rul` },
  }))
  content.patternDesc = '原型静态演示纸样：引用随应用发布的真实 DXF / RUL 样本，非本款生产文件。'
  if (!content.patternFiles.length) throw new Error('技术包演示缺少纸样资料对象，不能标记正式完成。')
  const existingFabrics = content.bomItems.filter(item => item.type === '面料')
  const fabrics = FLOW_FABRICS.map((fabric, index) => ({
    ...(existingFabrics[index] || existingFabrics[0] || content.bomItems[0]),
    id: existingFabrics[index]?.id || `${id}-flow-fabric-${index + 1}`,
    type: '面料' as const, name: fabric.name, spec: `150cm · ${fabric.role} · 染色后印花再洗水`,
    materialCode: fabric.code, materialSkuId: fabric.skus[2],
    unit: fabric.unit, unitConsumption: [1.35, 0.4, 0.8][index], lossRate: 0,
    applicableSkuCodes: [...skuCodes], linkedPatternIds: [patternId], usageProcessCodes: ['DYE', 'PRINT', 'WASH'],
    dyeRequirement: '匹染', printRequirement: '数码印花', printSideMode: 'SINGLE' as const,
    frontPatternDesignIds: [`${id}-flow-design-${index + 1}`], frontPatternDesignId: `${id}-flow-design-${index + 1}`,
    insidePatternDesignIds: [], insidePatternDesignId: '',
  }))
  content.bomItems = [...fabrics, ...content.bomItems.filter(item => item.type !== '面料').map(item => ({ ...item, printRequirement: '无', printSideMode: '' as const, frontPatternDesignIds: [], frontPatternDesignId: '', insidePatternDesignIds: [], insidePatternDesignId: '' }))]
  content.patternDesigns = fabrics.map((fabric, index) => ({ id: `${id}-flow-design-${index + 1}`, name: `${FLOW_FABRICS[index].designCode} · ${fabric.name}正面花型演示图`, designSideType: 'FRONT', fileName: 'shirt-floral-blue.jpg', originalFileName: 'shirt-floral-blue.jpg', imageUrl: '/materials/pcs-reviewed/shirt-floral-blue.jpg', uploadedAt: source.processRouteConfirmedAt || '2026-10-06 09:00' }))
  content.colorMaterialMappings = colors.map((colorName, index) => ({
    id: `${id}-flow-color-${index + 1}`, spuCode: source.colorMaterialMappings[0]?.spuCode || '', colorCode: colorName, colorName, status: 'CONFIRMED', generatedMode: 'AUTO',
    lines: fabrics.map((fabric, fabricIndex) => ({ id: `${id}-flow-color-${index + 1}-fabric-${fabricIndex + 1}`, bomItemId: fabric.id, materialCode: fabric.materialCode, materialName: fabric.name, materialType: '面料', patternId, patternName: mainPattern?.patternName || '演示纸样', pieceId: pieces[fabricIndex].id, pieceName: pieces[fabricIndex].name, pieceCountPerUnit: 1, unit: fabric.unit, applicableSkuCodes: [...skuCodes], sourceMode: 'AUTO' })),
  }))
  const entries: TechnicalProcessEntry[] = []
  fabrics.forEach((fabric, fabricIndex) => {
    ;[['DYE', '染色'], ['PRINT', '印花'], ['WASH', '洗水']].forEach(([processCode, processName], stageIndex) => {
      const skuChain = FLOW_FABRICS[fabricIndex].skus
      entries.push({ inputMaterialSkuId: skuChain[Math.min(stageIndex, 2)], outputMaterialSkuId: skuChain[Math.min(stageIndex + 1, 2)], id: `${id}-flow-prep-${fabricIndex + 1}-${stageIndex + 1}`, entryType: 'PROCESS_BASELINE', stageCode: 'PREP', stageName: '生产准备', processCode, processName, assignmentGranularity: 'DETAIL', defaultDocType: 'PREPARATION_ORDER', taskTypeMode: 'PROCESS', isSpecialCraft: false, selectedTargetObject: '完整面料', targetObject: 'FABRIC', targetObjectName: '面料', linkedBomItemIds: [fabric.id], linkedPatternIds: [], routeSourceKind: 'BOM_REQUIREMENT', routeObjectKey: `BOM:${fabric.id}`, inputObjectType: 'FABRIC', outputObjectType: 'FABRIC', routeStepNo: stageIndex + 1, routeLaneNo: fabricIndex + 1, predecessorEntryIds: stageIndex ? [`${id}-flow-prep-${fabricIndex + 1}-${stageIndex}`] : [], remark: `${fabric.name} · 第 ${stageIndex + 1} 道工序${stageIndex === 2 ? ' · 洗水保持同一物料 SKU，记录加工阶段' : ''}` })
    })
  })
  fabrics.forEach((fabric, index) => entries.push({ id: `${id}-flow-cut-${index + 1}`, entryType: 'PROCESS_BASELINE', stageCode: 'PROD', stageName: '生产执行', processCode: 'CUT_PANEL', processName: '裁剪', assignmentGranularity: 'DETAIL', defaultDocType: 'TASK', taskTypeMode: 'PROCESS', isSpecialCraft: false, targetObject: 'FABRIC', targetObjectName: '面料', selectedTargetObject: '完整面料', linkedBomItemIds: [fabric.id], linkedPatternIds: [patternId], routeSourceKind: 'BOM_REQUIREMENT', routeObjectKey: `BOM:${fabric.id}`, inputObjectType: 'FABRIC', outputObjectType: 'CUT_PIECE', routeStepNo: 4, routeLaneNo: index + 1, predecessorEntryIds: [`${id}-flow-prep-${index + 1}-3`], inputMaterialSkuId: FLOW_FABRICS[index].skus[2] }))
  pieces.forEach((piece, pieceIndex) => crafts.forEach((craft, craftIndex) => {
    entries.push({ id: `${id}-flow-prod-${pieceIndex + 1}-${craftIndex + 1}`, entryType: 'CRAFT', stageCode: 'PROD', stageName: '生产执行', processCode: 'SPECIAL_CRAFT', processName: '特殊工艺', ...craft, assignmentGranularity: 'DETAIL', defaultDocType: 'TASK', taskTypeMode: 'CRAFT', isSpecialCraft: true, selectedTargetObject: '已裁部位', targetObject: 'CUT_PIECE_PART', targetObjectName: '裁片部位', supportedTargetObjects: ['CUT_PIECE'], supportedTargetObjectLabels: ['已裁部位'], linkedBomItemIds: [fabrics[0].id], linkedPatternIds: [patternId], routeSourceKind: 'PIECE_CRAFT', routeObjectKey: `PATTERN:${patternId}:PIECE:${piece.id}`, inputObjectType: 'CUT_PIECE', outputObjectType: 'CUT_PIECE', routeStepNo: craftIndex + 5, routeLaneNo: pieceIndex + 1, predecessorEntryIds: craftIndex ? [`${id}-flow-prod-${pieceIndex + 1}-1`] : [`${id}-flow-cut-1`], remark: `${piece.name} · ${craft.craftName}` })
  }))
  entries.push({ id: `${id}-flow-sew`, entryType: 'PROCESS_BASELINE', stageCode: 'PROD', stageName: '生产执行', processCode: 'SEW', processName: '车缝', assignmentGranularity: 'DETAIL', defaultDocType: 'TASK', taskTypeMode: 'PROCESS', isSpecialCraft: false, targetObject: 'GARMENT_SEMI', targetObjectName: '成衣', selectedTargetObject: '成衣', linkedBomItemIds: fabrics.map(fabric => fabric.id), linkedPatternIds: [patternId], routeSourceKind: 'GARMENT_CATEGORY', routeObjectKey: 'GARMENT:SEW', inputObjectType: 'CUT_PIECE', outputObjectType: 'GARMENT', routeStepNo: 7, routeLaneNo: 1, predecessorEntryIds: [...pieces.map((_, index) => `${id}-flow-prod-${index + 1}-2`), `${id}-flow-cut-2`, `${id}-flow-cut-3`] })
  content.processEntries = entries
  content.processRouteSchemaVersion = 2
  content.processRouteStatus = 'CONFIRMED'
  content.processRouteConfirmedBy = '原型样本整理'
  content.processRouteConfirmedAt ||= '2026-10-06 09:00'
  content.processRouteChangeReason = '静态演示工艺路线：三个面料对象各自染色→印花→洗水，五个裁片各自绣花→压褶。'
  content.sizeTable = [{ id: `${id}-flow-size`, part: '关键尺寸', S: 48, M: 50, L: 52, XL: 54, tolerance: 1 }]
  content.qualityRules = [{ id: `${id}-flow-quality`, checkItem: '加工效果', standardText: '对照确认花型、颜色和纸样检查；尺寸偏差±1cm。', samplingRule: '首件确认、巡检与尾检', note: '原型质量要求样本' }]
  content.attachments = [{ id: `${id}-flow-original-rul`, fileName: 'grey-zip-hoodie.rul', fileType: 'RUL', fileSize: '静态文件', uploadedAt: content.processRouteConfirmedAt, uploadedBy: '原型样本整理', downloadUrl: `${ORIGINAL_ROOT}/grey-zip-hoodie.rul` }, { id: `${id}-flow-original-prj`, fileName: 'grey-zip-hoodie.prj', fileType: 'PRJ', fileSize: '静态文件', uploadedAt: content.processRouteConfirmedAt, uploadedBy: '原型样本整理', downloadUrl: `${ORIGINAL_ROOT}/grey-zip-hoodie.prj` }]
  return content
}

export function applyTechnicalPackDemoReview(record: TechnicalDataVersionRecord, index: number): TechnicalDataVersionRecord {
  const published = index < 20
  const inReview = index >= 23
  const stage = published ? '已发布' : inReview ? '第一阶段并行审核' : '未提交审核'
  const reviewNode = (nodeKey: TechnicalReviewNode['nodeKey'], role: TechnicalReviewNode['reviewerRole'], reviewerId: string, reviewerName: string): TechnicalReviewNode => ({
    nodeKey, nodeName: role === '跟单' ? '跟单审核' : role === '买手' ? '买手审核' : '版师审核', reviewerRole: role, assignedReviewerRole: role,
    status: published ? '审核-已通过' : inReview && role !== '跟单' ? '审核中' : '待审核',
    assignedReviewerId: reviewerId, assignedReviewerName: reviewerName, assignedReviewerFeishuOpenId: '', assignedAt: record.createdAt, assignedBy: '原型样本整理', reviewedBy: published ? reviewerName : '', reviewedAt: published ? record.updatedAt : '', startedOpinion: '', opinion: published ? '资料齐备，原型正式版本审核通过。' : '', diffSnapshotId: '', diffStatus: '无基线', diffSummaryText: '', lastFeishuNotifyAt: '', lastFeishuNotifyStatus: '未发送', lastFeishuNotifyRecordId: '', todayFeishuNotifiedFlag: false, todayFeishuNotifyAt: '', feishuNotifyCount: 0,
  })
  return { ...record, technicalVersionCode: String(index + 1), versionLabel: record.versionLabel.replace(/^Mock\s*/i, ''), versionStatus: published ? 'PUBLISHED' : 'DRAFT', reviewStage: stage, buyerReview: reviewNode('BUYER', '买手', 'BUYER-001', '买手A'), patternMakerReview: reviewNode('PATTERN_MAKER', '版师', 'PATTERN-001', '版师B'), merchandiserReview: reviewNode('MERCHANDISER', '跟单', 'MERCH-001', '跟单C'), reviewSubmittedAt: published || inReview ? record.createdAt : '', reviewSubmittedBy: published || inReview ? '原型样本整理' : '', publishedAt: published ? record.publishedAt : '', publishedBy: published ? record.publishedBy : '' }
}
