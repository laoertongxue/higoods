import assert from 'node:assert/strict'
import { cloneProductionOrderTechPackSnapshot } from '../src/data/fcs/production-tech-pack-snapshot-builder.ts'
import { scopeWoolPieceGenerationIssues } from '../src/data/fcs/wool-domain/tech-pack-source.ts'
import { extractWoolPieceSources } from '../src/data/fcs/wool-domain/piece-source.ts'
import type { ProductionOrderTechPackSnapshot, TechPackPatternFileSnapshot } from '../src/data/fcs/production-tech-pack-snapshot-types.ts'
import type { TechnicalProcessEntry } from '../src/data/pcs-technical-data-version-types.ts'

const route = (id: string, craftCode: string, predecessorEntryIds: string[] = []): TechnicalProcessEntry => ({
  id, craftCode, craftName: craftCode, predecessorEntryIds,
  entryType: 'CRAFT', stageCode: 'PROD', stageName: '生产', processCode: 'SPECIAL_CRAFT', processName: '工艺',
  assignmentGranularity: 'DETAIL', defaultDocType: 'TASK', taskTypeMode: 'CRAFT', isSpecialCraft: true,
  routeSourceKind: 'PIECE_CRAFT', routeObjectKey: 'PATTERN:PACKAGE:PIECE:Q', targetObject: 'CUT_PIECE_PART',
  inputObjectType: 'KNITTED_PANEL', outputObjectType: 'KNITTED_PANEL',
})

const pattern = (): TechPackPatternFileSnapshot => ({
  id: 'YARN-A', sourcePatternPackageId: 'PACKAGE', linkedBomItemId: 'BOM-A',
  patternFileId: 'YARN-A', patternFileName: '毛织纸样', patternVersion: '1.2',
  patternMaterialType: 'WOOL', patternMaterialTypeLabel: '毛织', patternFileMode: 'SINGLE_FILE',
  fileName: 'Q.rar', fileUrl: '/Q.rar', uploadedAt: '2026-09-18', uploadedBy: '版师', rulSizeList: [], parseStatus: 'PARSED',
  pieceRows: [{ id: 'Q', name: 'Q', count: 2, applicableSkuCodes: ['STYLE-black-M'],
    colorAllocations: [{ id: 'black', colorName: 'black', skuCodes: ['STYLE-black-M'], pieceCount: 2 }],
    specialCrafts: [{ processCode: 'SPECIAL_CRAFT', processName: '工艺', craftCode: 'EMB', craftName: '绣花', displayName: '绣花' }],
  }],
  pieceInstances: [1, 2].map((sequenceNo) => ({
    pieceInstanceId: `Q-${sequenceNo}`, sourcePieceId: 'Q', pieceName: 'Q', sizeName: 'M', colorId: 'black', colorName: 'black',
    sequenceNo, displayName: `Q 第 ${sequenceNo} 片`, status: '已配置',
    specialCraftAssignments: [{ assignmentId: `A-${sequenceNo}`, craftCode: 'EMB', craftName: '绣花', craftCategory: 'SPECIAL',
      targetObject: 'CUT_PIECE_PART', craftPosition: 'FACE', craftPositionName: '面', remark: '原要求' }],
  })),
})

function fixture(): ProductionOrderTechPackSnapshot {
  return {
    snapshotId: 'SNAPSHOT-V1.2', productionOrderId: 'PO', productionOrderNo: 'PO1', styleId: 'STYLE', styleCode: 'STYLE', styleName: '毛织款',
    status: 'RELEASED', versionLabel: 'v1.2', sourceTechPackVersionId: 'V1.2', sourceTechPackVersionCode: 'TP1.2', sourceTechPackVersionLabel: 'v1.2',
    sourcePublishedAt: '2026-09-10', snapshotAt: '2026-09-10', snapshotBy: '计划', patternDesc: '', completenessScore: 100,
    bomItems: [{ id: 'BOM-A', type: '纱线', name: '纱线 A', spec: 'black', unitConsumption: 1, lossRate: 0, supplier: '供方',
      usageProcessCodes: ['PROC_WOOL'], linkedPatternIds: ['YARN-A'] }],
    patternFiles: [pattern()], processEntries: [route('EMB-1', 'EMB')], sizeTable: [], sizeMeasurements: [], cutPieceParts: [],
    colorMaterialMappings: [{ id: 'MAP', spuCode: 'STYLE', colorCode: 'black', colorName: 'black', status: 'CONFIRMED', generatedMode: 'MANUAL',
      mappingOrigin: 'TECH_PACK', lines: [{ id: 'MAP-A', bomItemId: 'BOM-A', patternId: 'YARN-A', materialName: '纱线 A', materialType: '其他',
        unit: 'kg', applicableSkuCodes: ['STYLE-black-M'], sourceMode: 'MANUAL' }] }],
    imageSnapshot: { productImages: [], styleImages: [], sampleImages: [], materialImages: [], accessoryImages: [], patternImages: [], markerImages: [], artworkImages: [] },
    patternDesigns: [], linkedDesignRevisionTaskIds: [], linkedPatternTaskIds: [], linkedArtworkTaskIds: [],
  }
}

const run = (snapshot: ProductionOrderTechPackSnapshot) => extractWoolPieceSources({
  snapshot, sourceTaskId: 'TASK', scopeSkuLines: [{ skuCode: 'STYLE-black-M', color: 'black', size: 'M', qty: 100 }],
})

let checks = 0
const check = (name: string, fn: () => void) => { fn(); checks += 1; console.log(`✓ ${name}`) }

check('绑定版本与逐片配置、工艺前置关系均深复制；读取后修改不污染原版本', () => {
  const original = fixture()
  const frozen = cloneProductionOrderTechPackSnapshot(original)!
  original.patternFiles[0].pieceInstances![0].specialCraftAssignments[0].remark = '新版要求'
  original.patternFiles[0].pieceInstances![0].pieceName = '新版片'
  original.processEntries[0].predecessorEntryIds!.push('NEW')
  assert.equal(frozen.patternFiles[0].pieceInstances![0].specialCraftAssignments[0].remark, '原要求')
  assert.equal(frozen.patternFiles[0].pieceInstances![0].pieceName, 'Q')
  assert.deepEqual(frozen.processEntries[0].predecessorEntryIds, [])
  const extracted = run(frozen)
  assert.equal(extracted.sourceTechPackVersionId, 'V1.2')
  assert.equal(extracted.pieces.length, 2)
  extracted.pieces[0].assignments[0].remark = '读后修改'
  assert.equal(frozen.patternFiles[0].pieceInstances![0].specialCraftAssignments[0].remark, '原要求')
})

check('部位毛织和整件毛织读取相同逐片模型；两片各 100 片且不制造不外发片', () => {
  for (const woolTaskType of ['PART_PANEL', 'WHOLE_GARMENT'] as const) {
    const snapshot = fixture()
    snapshot.processEntries.push({ ...route('WOOL', ''), processCode: 'WOOL', woolTaskType, linkedPatternIds: ['YARN-A'], isSpecialCraft: false })
    const result = extractWoolPieceSources({ snapshot, sourceTaskId: 'TASK', sourceEntryId: 'WOOL', scopeSkuLines: [{ skuCode: 'STYLE-black-M', color: 'black', size: 'M', qty: 100 }] })
    assert.deepEqual(result.issues, [])
    assert.deepEqual(result.pieces.map((piece) => [piece.pieceInstanceId, piece.pieceCountPerGarment, piece.plannedQty]), [['Q-1', 1, 100], ['Q-2', 1, 100]])
  }
})

check('多纱线关联同一纸样片仅产生一份逐片需求', () => {
  const snapshot = fixture()
  const second = structuredClone(snapshot.patternFiles[0])
  second.id = second.patternFileId = 'YARN-B'
  second.linkedBomItemId = 'BOM-B'
  snapshot.patternFiles.push(second)
  snapshot.bomItems.push({ ...snapshot.bomItems[0], id: 'BOM-B', linkedPatternIds: ['YARN-B'] })
  snapshot.colorMaterialMappings[0].lines.push({ ...snapshot.colorMaterialMappings[0].lines[0], id: 'MAP-B', bomItemId: 'BOM-B', patternId: 'YARN-B' })
  const result = run(snapshot)
  assert.deepEqual(result.issues, [])
  assert.equal(result.pieces.length, 2)
  assert.equal(new Set(result.pieces.map((piece) => piece.pieceKey)).size, 2)
})

check('同名工艺多个节点不合并，前置关系决定顺序而非数组或序号', () => {
  const snapshot = fixture()
  snapshot.processEntries = [route('EMB-2', 'EMB', ['EMB-1']), route('EMB-1', 'EMB')]
  const result = run(snapshot)
  assert.deepEqual(result.issues, [])
  assert.deepEqual(result.pieces[0].routeNodes.map((node) => node.sourceEntryId), ['EMB-1', 'EMB-2'])
  assert.deepEqual(result.pieces[0].routeNodes[1].predecessorEntryIds, ['EMB-1'])
})

check('没有逐片也没有工艺是合法无外发；不要求补齐不外发片', () => {
  const snapshot = fixture()
  snapshot.patternFiles[0].pieceInstances = []
  snapshot.patternFiles[0].pieceRows = []
  snapshot.processEntries = []
  assert.deepEqual(run(snapshot).pieces, [])
  assert.deepEqual(run(snapshot).issues, [])
})

check('其他颜色、尺码与布料工艺不污染当前任务', () => {
  const snapshot = fixture()
  const other = structuredClone(snapshot.patternFiles[0])
  other.id = other.patternFileId = 'WOVEN'
  other.sourcePatternPackageId = 'WOVEN-PACKAGE'
  other.patternMaterialType = 'WOVEN'
  snapshot.patternFiles.push(other)
  snapshot.patternFiles[0].pieceInstances!.forEach((instance) => { instance.colorName = instance.colorId = 'red' })
  snapshot.patternFiles[0].pieceRows![0].applicableSkuCodes = ['STYLE-red-M']
  assert.deepEqual(run(snapshot).pieces, [])
  assert.deepEqual(run(snapshot).issues, [])
})

check('有工艺缺实例、缺路线、缺范围不能当成无外发', () => {
  const noInstance = fixture()
  noInstance.patternFiles[0].pieceInstances = []
  assert.ok(run(noInstance).issues.some((issue) => issue.code === 'PIECE_INSTANCE_MISSING'))
  const noRoute = fixture()
  noRoute.processEntries = []
  assert.ok(run(noRoute).issues.some((issue) => issue.code === 'CRAFT_ROUTE_MISSING'))
  const noMapping = fixture()
  noMapping.colorMaterialMappings = []
  assert.ok(run(noMapping).issues.some((issue) => issue.code === 'PATTERN_SCOPE_MISSING'))
  assert.ok(extractWoolPieceSources({ snapshot: fixture(), sourceTaskId: 'TASK', scopeSkuLines: [] }).issues.some((issue) => issue.code === 'SKU_SCOPE_MISSING'))
})

check('环路、分叉、缺前置节点返回具体阻断', () => {
  const cycle = fixture()
  cycle.processEntries = [route('A', 'EMB', ['B']), route('B', 'EMB', ['A'])]
  assert.ok(run(cycle).issues.some((issue) => issue.code === 'ROUTE_CYCLE'))
  const branch = fixture()
  branch.processEntries = [route('A', 'EMB'), route('B', 'EMB', ['A']), route('C', 'EMB', ['A'])]
  assert.ok(run(branch).issues.some((issue) => issue.code === 'AMBIGUOUS_NEXT_NODE'))
  const missing = fixture()
  missing.processEntries[0].predecessorEntryIds = ['MISSING']
  assert.ok(run(missing).issues.some((issue) => issue.code === 'PREDECESSOR_MISSING' && issue.sourceEntryId === 'EMB-1'))
})

check('明确实例路线允许同一片行的两个物理片采用不同路线', () => {
  const snapshot = fixture()
  snapshot.processEntries = [
    { ...route('FIRST', 'EMB'), routeObjectKey: 'PATTERN:PACKAGE:PIECE_INSTANCE:Q-1' },
    { ...route('SECOND', 'EMB'), routeObjectKey: 'PATTERN:PACKAGE:PIECE_INSTANCE:Q-2' },
  ]
  const result = run(snapshot)
  assert.deepEqual(result.issues, [])
  assert.deepEqual(result.pieces.map((piece) => piece.routeNodes[0].sourceEntryId), ['FIRST', 'SECOND'])
})

check('纸样包持有实例而两条纱线关联只引用该包，不重复或丢失实例', () => {
  const snapshot = fixture()
  const owner = structuredClone(snapshot.patternFiles[0])
  owner.id = owner.patternFileId = 'PACKAGE'
  owner.recordKind = 'PACKAGE'
  owner.linkedBomItemId = undefined
  owner.sourcePatternPackageId = undefined
  snapshot.patternFiles[0].pieceInstances = []
  snapshot.patternFiles.push(owner)
  const result = run(snapshot)
  assert.deepEqual(result.issues, [])
  assert.equal(result.pieces.length, 2)
})

check('已配置逐片工艺缺片行、空路线前置字段以及跨片前置均明确阻断', () => {
  const missingRow = fixture()
  missingRow.patternFiles[0].pieceRows = []
  assert.ok(run(missingRow).issues.some((issue) => issue.code === 'PIECE_ROW_MISSING'))
  const missingOrder = fixture()
  delete missingOrder.processEntries[0].predecessorEntryIds
  assert.ok(run(missingOrder).issues.some((issue) => issue.code === 'ROUTE_ORDER_MISSING'))
  const otherPiece = fixture()
  otherPiece.processEntries.push({ ...route('OTHER-PIECE', 'EMB'), routeObjectKey: 'PATTERN:PACKAGE:PIECE:H' })
  otherPiece.processEntries[0].predecessorEntryIds = ['OTHER-PIECE']
  assert.ok(run(otherPiece).issues.some((issue) => issue.code === 'PIECE_PREDECESSOR_MISMATCH'))
})

check('坏路线问题精确落到该片；缺实例落到该 SKU，不升级为全单阻断', () => {
  const snapshot = fixture()
  snapshot.processEntries = [
    { ...route('Q1-OK', 'EMB'), routeObjectKey: 'PATTERN:PACKAGE:PIECE_INSTANCE:Q-1' },
    { ...route('Q2-A', 'EMB', ['Q2-B']), routeObjectKey: 'PATTERN:PACKAGE:PIECE_INSTANCE:Q-2' },
    { ...route('Q2-B', 'EMB', ['Q2-A']), routeObjectKey: 'PATTERN:PACKAGE:PIECE_INSTANCE:Q-2' },
  ]
  const result = run(snapshot), scope = scopeWoolPieceGenerationIssues(result)
  assert.deepEqual(scope.unscoped, []); assert.deepEqual(scope.bySku, {})
  assert.equal(scope.byPiece[result.pieces.find(piece => piece.pieceInstanceId === 'Q-1')!.pieceKey], undefined)
  assert.match(scope.byPiece[result.pieces.find(piece => piece.pieceInstanceId === 'Q-2')!.pieceKey][0], /路线成环/)
  snapshot.patternFiles[0].pieceInstances = []
  const missing = scopeWoolPieceGenerationIssues(run(snapshot))
  assert.deepEqual(missing.unscoped, []); assert.ok(missing.bySku['STYLE-black-M'].length)
})

console.log(`毛织逐片来源检查通过：${checks} 个场景`)
