import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  buildMarkerAllocationDiffFormula,
  buildMarkerAllocationSumFormula,
  buildMarkerExplodedPieceQtyFormula,
  buildMarkerFinalUnitUsageFormula,
  buildMarkerFoldedEffectiveWidthFormula,
  buildMarkerHighLowMatrixTotalFormula,
  buildMarkerLayoutLineSpreadLengthFormula,
  buildMarkerLayoutLineSystemUnitUsageFormula,
  buildMarkerModeDetailSpreadLengthFormula,
  buildMarkerModeDetailSystemUnitUsageFormula,
  buildMarkerPlannedSpreadLengthFormula,
  buildMarkerSkuExplodedPieceQtyFormula,
  buildMarkerSystemUnitUsageFormula,
  buildMarkerTotalPiecesFormula,
  computeMarkerAllocationDiffBySize,
  computeMarkerAllocationSumBySize,
  computeMarkerExplodedPieceQty,
  computeMarkerFoldedEffectiveWidth,
  computeMarkerFoldWidthCheckPassed,
  computeMarkerHighLowMatrixTotal,
  computeMarkerLayoutLineSpreadLength,
  computeMarkerLayoutLineSystemUnitUsage,
  computeMarkerModeDetailSpreadLength,
  computeMarkerModeDetailSystemUnitUsage,
  computeMarkerPlanFinalUnitUsage,
  computeMarkerPlanSystemUnitUsage,
  computeMarkerPlanTotalPieces,
  createEmptySizeRatioRows,
  deriveMarkerAllocationStatus,
  deriveMarkerLayoutStatus,
  deriveMarkerMappingStatus,
  deriveMarkerPlanDefaultTab,
  deriveMarkerPlanStatus,
  deriveMarkerReadyForSpreading,
  markerPlanModeMeta,
  type MarkerAllocationRow,
  type MarkerHighLowMatrixCell,
  type MarkerPieceExplosionRow,
} from '../src/pages/process-factory/cutting/marker-plan-domain.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function main(): void {
  const pieceExplosionSource = readFileSync(
    fileURLToPath(new URL('../src/pages/process-factory/cutting/marker-piece-explosion.ts', import.meta.url)),
    'utf-8',
  )
  assert(
    !/marker-spreading-model(?:\.ts)?['"]/.test(pieceExplosionSource),
    'marker-piece-explosion.ts 仍然直接依赖 marker-spreading-model.ts',
  )

  const sizeRatioRows = createEmptySizeRatioRows().map((row) => {
    if (row.sizeCode === 'S') return { ...row, qty: 3 }
    if (row.sizeCode === 'M') return { ...row, qty: 5 }
    if (row.sizeCode === 'L') return { ...row, qty: 4 }
    return row
  })
  const totalPieces = computeMarkerPlanTotalPieces(sizeRatioRows)
  assert(totalPieces === 12, `单层总件数计算错误，期望 12，实际 ${totalPieces}`)

  const systemUnitUsage = computeMarkerPlanSystemUnitUsage(8.4, totalPieces)
  assert(systemUnitUsage === 0.7, `系统单件用量计算错误，期望 0.7，实际 ${systemUnitUsage}`)

  const finalUnitUsage = computeMarkerPlanFinalUnitUsage(systemUnitUsage, 0.742)
  assert(finalUnitUsage === 0.742, `最终单件用量优先人工修正错误，期望 0.742，实际 ${finalUnitUsage}`)

  const lineSystemUnitUsage = computeMarkerLayoutLineSystemUnitUsage({
    markerLength: 6.6,
    markerPieceQty: 11,
  })
  assert(lineSystemUnitUsage === 0.6, `普通模式行级单件量错误，期望 0.6，实际 ${lineSystemUnitUsage}`)

  const lineSpreadLength = computeMarkerLayoutLineSpreadLength(
    {
      markerLength: 6.6,
      repeatCount: 3,
    },
    0.06,
  )
  assert(lineSpreadLength === 19.98, `普通模式行级铺布总长度错误，期望 19.98，实际 ${lineSpreadLength}`)

  const modeDetailSystemUnitUsage = computeMarkerModeDetailSystemUnitUsage({
    markerLength: 5.2,
    markerPieceQty: 8,
  })
  assert(modeDetailSystemUnitUsage === 0.65, `高低层模式行级单件量错误，期望 0.65，实际 ${modeDetailSystemUnitUsage}`)

  const modeDetailSpreadLength = computeMarkerModeDetailSpreadLength(
    {
      markerLength: 5.2,
      repeatCount: 4,
    },
    0.06,
  )
  assert(modeDetailSpreadLength === 21.04, `高低层模式铺布总长度错误，期望 21.04，实际 ${modeDetailSpreadLength}`)

  const matrixCells: MarkerHighLowMatrixCell[] = [
    { sectionType: 'HIGH', sectionName: '高层', sizeCode: 'S', qty: 4 },
    { sectionType: 'HIGH', sectionName: '高层', sizeCode: 'M', qty: 6 },
    { sectionType: 'LOW', sectionName: '低层', sizeCode: 'L', qty: 2 },
  ]
  const matrixTotal = computeMarkerHighLowMatrixTotal(matrixCells)
  assert(matrixTotal === 12, `高低层矩阵总数错误，期望 12，实际 ${matrixTotal}`)

  const foldedEffectiveWidth = computeMarkerFoldedEffectiveWidth({
    originalEffectiveWidth: 168,
    foldAllowance: 2,
  })
  assert(foldedEffectiveWidth === 83, `对折后有效门幅错误，期望 83，实际 ${foldedEffectiveWidth}`)
  assert(
    computeMarkerFoldWidthCheckPassed({
      foldedEffectiveWidth,
      maxLayoutWidth: 81,
    }) === true,
    '对折门幅校验通过判断错误',
  )
  assert(
    computeMarkerFoldWidthCheckPassed({
      foldedEffectiveWidth,
      maxLayoutWidth: 86,
    }) === false,
    '对折门幅校验不通过判断错误',
  )

  const allocationRows: MarkerAllocationRow[] = [
    {
      id: 'a-1',
      sourceCutOrderId: 'cut-1',
      sourceProductionOrderId: 'po-1',
      colorCode: '红',
      materialSku: 'FAB-001',
      styleCode: 'ST-001',
      spuCode: 'SPU-001',
      techPackSpu: 'SPU-001',
      sizeCode: 'S',
      garmentQty: 3,
      note: '',
      specialFlags: [],
    },
    {
      id: 'a-2',
      sourceCutOrderId: 'cut-2',
      sourceProductionOrderId: 'po-1',
      colorCode: '红',
      materialSku: 'FAB-001',
      styleCode: 'ST-001',
      spuCode: 'SPU-001',
      techPackSpu: 'SPU-001',
      sizeCode: 'M',
      garmentQty: 6,
      note: '',
      specialFlags: [],
    },
  ]
  const allocationSum = computeMarkerAllocationSumBySize(allocationRows)
  assert(allocationSum.S === 3 && allocationSum.M === 6, '尺码分配合计计算错误')
  const diffMap = computeMarkerAllocationDiffBySize(sizeRatioRows, allocationRows)
  assert(diffMap.S === 0 && diffMap.M === 1, '尺码分配差值计算错误')
  assert(deriveMarkerAllocationStatus(sizeRatioRows, allocationRows) === 'unbalanced', '分配状态派生错误')
  const allocationFormula = buildMarkerAllocationSumFormula('M', allocationRows)
  const diffFormula = buildMarkerAllocationDiffFormula('M', sizeRatioRows, allocationRows)
  assert(Boolean(allocationFormula && allocationFormula.includes('=')), '尺码分配合计公式字符串缺失')
  assert(Boolean(diffFormula && diffFormula.includes('=')), '尺码分配差值公式字符串缺失')

  const pieceRows: MarkerPieceExplosionRow[] = [
    {
      id: 'piece-1',
      sourceCutOrderId: 'cut-1',
      colorCode: '红',
      sizeCode: 'S',
      skuCode: 'SKU-RED-S',
      materialSku: 'FAB-001',
      patternCode: 'PATTERN-A',
      partCode: 'BODY',
      partNameCn: '前片',
      partNameId: 'Badan Depan',
      piecePerGarment: 2,
      garmentQty: 3,
      explodedPieceQty: computeMarkerExplodedPieceQty(2, 3),
      mappingStatus: 'MATCHED',
      issueReason: '',
    },
    {
      id: 'piece-2',
      sourceCutOrderId: 'cut-1',
      colorCode: '红',
      sizeCode: 'M',
      skuCode: 'SKU-RED-M',
      materialSku: 'FAB-001',
      patternCode: 'PATTERN-B',
      partCode: 'SLEEVE',
      partNameCn: '袖片',
      partNameId: 'Lengan',
      piecePerGarment: 2,
      garmentQty: 6,
      explodedPieceQty: computeMarkerExplodedPieceQty(2, 6),
      mappingStatus: 'MISSING_COLOR_MAPPING',
      issueReason: '颜色映射待人工确认',
    },
  ]
  assert(pieceRows[0].explodedPieceQty === 6 && pieceRows[1].explodedPieceQty === 12, '裁片拆解数计算错误')
  assert(deriveMarkerMappingStatus(pieceRows) === 'issue', '裁片映射状态派生错误')
  assert(Boolean(buildMarkerExplodedPieceQtyFormula(2, 6).includes('=')), '裁片片数公式字符串缺失')
  assert(Boolean(buildMarkerSkuExplodedPieceQtyFormula(pieceRows).includes('=')), 'SKU裁片片数公式字符串缺失')

  assert(
    deriveMarkerLayoutStatus({
      markerMode: 'fold_normal',
      layoutLines: [
        {
          id: 'line-1',
          lineNo: 1,
          layoutCode: 'A1',
          ratioNote: 'S3/M5',
          colorCode: '红',
          repeatCount: 2,
          markerLength: 6.4,
          markerPieceQty: 8,
          systemUnitUsage: 0.8,
          spreadLength: 12.92,
          widthCode: '165',
          note: '',
        },
      ],
      modeDetailLines: [],
      foldConfig: {
        originalEffectiveWidth: 168,
        foldAllowance: 2,
        foldDirection: '对边折入',
        foldedEffectiveWidth: 83,
        maxLayoutWidth: 82,
        widthCheckPassed: true,
      },
    }) === 'done',
    '对折普通模式排版状态派生错误',
  )

  assert(
    deriveMarkerReadyForSpreading({
      totalPieces: 12,
      netLength: 8.4,
      allocationStatus: 'balanced',
      mappingStatus: 'passed',
      layoutStatus: 'done',
    }) === true,
    '可交接铺布判定错误',
  )

  assert(
    deriveMarkerPlanStatus({
      allocationStatus: 'balanced',
      mappingStatus: 'passed',
      layoutStatus: 'done',
      imageStatus: 'pending',
      readyForSpreading: true,
    }) === 'WAITING_IMAGE',
    '缺图状态下的唛架主状态派生错误',
  )

  assert(
    deriveMarkerPlanStatus({
      allocationStatus: 'balanced',
      mappingStatus: 'passed',
      layoutStatus: 'done',
      imageStatus: 'done',
      readyForSpreading: true,
    }) === 'READY_FOR_SPREADING',
    '唛架状态派生错误',
  )

  assert(
    deriveMarkerPlanDefaultTab({
      allocationStatus: 'unbalanced',
      mappingStatus: 'pending',
      layoutStatus: 'pending',
      imageStatus: 'pending',
      lastVisitedTab: 'basic',
    }) === 'allocation',
    '默认编辑页签优先级错误',
  )

  const modeKeys = new Set(Object.keys(markerPlanModeMeta))
  assert(modeKeys.has('normal'), '缺少普通模式样例')
  assert(modeKeys.has('high_low'), '缺少高低层模式样例')
  assert(modeKeys.has('fold_normal'), '缺少对折-普通模式样例')
  assert(modeKeys.has('fold_high_low'), '缺少对折-高低层模式样例')

  const totalPiecesFormula = buildMarkerTotalPiecesFormula(sizeRatioRows)
  const systemUnitFormula = buildMarkerSystemUnitUsageFormula(8.4, totalPieces)
  const finalUnitFormula = buildMarkerFinalUnitUsageFormula(systemUnitUsage, 0.742)
  const layoutUnitFormula = buildMarkerLayoutLineSystemUnitUsageFormula({ markerLength: 6.6, markerPieceQty: 11 })
  const layoutSpreadFormula = buildMarkerLayoutLineSpreadLengthFormula({ markerLength: 6.6, repeatCount: 3 }, 0.06)
  const modeUnitFormula = buildMarkerModeDetailSystemUnitUsageFormula({ markerLength: 5.2, markerPieceQty: 8 })
  const modeSpreadFormula = buildMarkerModeDetailSpreadLengthFormula({ markerLength: 5.2, repeatCount: 4 }, 0.06)
  const matrixFormula = buildMarkerHighLowMatrixTotalFormula(matrixCells)
  const foldFormula = buildMarkerFoldedEffectiveWidthFormula({ originalEffectiveWidth: 168, foldAllowance: 2 })
  const allocationSumFormula = buildMarkerAllocationSumFormula('M', allocationRows)
  const allocationDiffFormula = buildMarkerAllocationDiffFormula('M', sizeRatioRows, allocationRows)
  const explodedPieceFormula = buildMarkerExplodedPieceQtyFormula(2, 6)
  const skuExplodedPieceFormula = buildMarkerSkuExplodedPieceQtyFormula(pieceRows)
  const plannedSpreadFormula = buildMarkerPlannedSpreadLengthFormula({
    markerMode: 'normal',
    layoutLines: [
      {
        id: 'line-1',
        lineNo: 1,
        layoutCode: 'A1',
        ratioNote: 'S3/M5',
        colorCode: '红',
        repeatCount: 2,
        markerLength: 6.4,
        markerPieceQty: 8,
        systemUnitUsage: 0.8,
        spreadLength: 12.92,
        widthCode: '165',
        note: '',
      },
    ],
    modeDetailLines: [],
    singleSpreadFixedLoss: 0.06,
  })

  ;[
    totalPiecesFormula,
    systemUnitFormula,
    finalUnitFormula,
    layoutUnitFormula,
    layoutSpreadFormula,
    modeUnitFormula,
    modeSpreadFormula,
    matrixFormula,
    foldFormula,
    allocationSumFormula,
    allocationDiffFormula,
    explodedPieceFormula,
    skuExplodedPieceFormula,
    plannedSpreadFormula,
  ].forEach((formula, index) => {
    assert(Boolean(formula && formula.trim() && formula.includes('=')), `公式字符串缺失或为空，第 ${index + 1} 条`)
  })

  console.log(
    [
      '唛架计划层公式与状态检查通过',
      `唛架成衣件数（件）：${totalPieces}`,
      `系统单件成衣用量（m/件）：${systemUnitUsage}`,
      `高低层矩阵成衣件数（件）：${matrixTotal}`,
      `模式数：${modeKeys.size}`,
    ].join('\n'),
  )
}

main()
