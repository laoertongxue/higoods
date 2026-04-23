import type { PreProductionSampleTaskRecord } from './pcs-pre-production-sample-types.ts'
import type {
  SampleChainMode,
  SamplePlanLine,
  SamplePlanMaterialMode,
  SamplePlanRole,
} from './pcs-sample-chain-types.ts'

function nextLineId(prefix: string, index: number): string {
  return `${prefix}-${String(index + 1).padStart(2, '0')}`
}

function createPlanLine(
  lineId: string,
  sampleRole: SamplePlanRole,
  materialMode: SamplePlanMaterialMode,
  linkedSampleAssetId = '',
  linkedSampleCode = '',
): SamplePlanLine {
  return {
    lineId,
    sampleRole,
    materialMode,
    quantity: 1,
    targetFactoryId: '',
    targetFactoryName: '',
    linkedSampleAssetId,
    linkedSampleCode,
    status: linkedSampleAssetId ? '已确认' : '待计划',
    note: '',
  }
}

export function createReuseFirstSamplePlanLine(
  linkedSampleAssetId = '',
  linkedSampleCode = '',
): SamplePlanLine {
  return createPlanLine('reuse-first-sample-01', '复用首版样衣', '复用首版', linkedSampleAssetId, linkedSampleCode)
}

export function createDefaultSamplePlanLines(
  mode: SampleChainMode,
  linkedSampleAssetId = '',
  linkedSampleCode = '',
): SamplePlanLine[] {
  if (mode === '双样衣') {
    return [
      createPlanLine('dual-substitute-01', '替代布确认样', '替代布'),
      createPlanLine('dual-correct-01', '正确布确认样', '正确布'),
    ]
  }
  if (mode === '新增一件产前版样衣') {
    return [createPlanLine('new-correct-sample-01', '正确布确认样', '正确布')]
  }
  return [createReuseFirstSamplePlanLine(linkedSampleAssetId, linkedSampleCode)]
}

export function normalizeSamplePlanLines(
  mode: SampleChainMode,
  lines: SamplePlanLine[] | undefined,
  linkedSampleAssetId = '',
  linkedSampleCode = '',
): SamplePlanLine[] {
  const normalized = Array.isArray(lines)
    ? lines.map((line, index) => ({
        lineId: line.lineId || nextLineId('sample-line', index),
        sampleRole: line.sampleRole || '复用首版样衣',
        materialMode: line.materialMode || (line.sampleRole === '复用首版样衣' ? '复用首版' : '正确布'),
        quantity: Number.isFinite(line.quantity) && line.quantity > 0 ? line.quantity : 1,
        targetFactoryId: line.targetFactoryId || '',
        targetFactoryName: line.targetFactoryName || '',
        linkedSampleAssetId: line.linkedSampleAssetId || '',
        linkedSampleCode: line.linkedSampleCode || '',
        status: line.status || (line.linkedSampleAssetId ? '已确认' : '待计划'),
        note: line.note || '',
      }))
    : []

  if (mode === '双样衣') {
    const hasSubstitute = normalized.some((line) => line.sampleRole === '替代布确认样')
    const hasCorrect = normalized.some((line) => line.sampleRole === '正确布确认样')
    return [
      ...normalized,
      ...(hasSubstitute ? [] : [createPlanLine('dual-substitute-01', '替代布确认样', '替代布')]),
      ...(hasCorrect ? [] : [createPlanLine('dual-correct-01', '正确布确认样', '正确布')]),
    ]
  }

  if (mode === '新增一件产前版样衣') {
    const hasNewSample = normalized.some((line) => line.sampleRole === '正确布确认样' || line.sampleRole === '工厂参照样')
    return hasNewSample ? normalized : [createPlanLine('new-correct-sample-01', '正确布确认样', '正确布')]
  }

  const reuseLine = normalized.find((line) => line.sampleRole === '复用首版样衣')
  return [
    {
      ...(reuseLine || createReuseFirstSamplePlanLine(linkedSampleAssetId, linkedSampleCode)),
      linkedSampleAssetId: reuseLine?.linkedSampleAssetId || linkedSampleAssetId,
      linkedSampleCode: reuseLine?.linkedSampleCode || linkedSampleCode,
      status: reuseLine?.linkedSampleAssetId || linkedSampleAssetId ? '已确认' : reuseLine?.status || '待计划',
    },
    ...normalized.filter((line) => line.sampleRole !== '复用首版样衣'),
  ]
}

export function getPreProductionSampleChainMissingFields(task: PreProductionSampleTaskRecord): string[] {
  const missing: string[] = []
  if (!task.sampleChainMode) missing.push('样衣链路模式')
  if (task.sampleChainMode === '直接复用首版样衣') {
    if (!task.sourceFirstSampleAssetId) missing.push('来源首版样衣资产')
    if (!task.samplePlanLines.some((line) => line.sampleRole === '复用首版样衣')) missing.push('复用首版样衣计划行')
  }
  if (task.sampleChainMode === '新增一件产前版样衣') {
    if (!task.samplePlanLines.some((line) => line.linkedSampleAssetId)) missing.push('新增产前版样衣资产')
  }
  if (task.sampleChainMode === '双样衣') {
    if (!task.samplePlanLines.some((line) => line.sampleRole === '替代布确认样')) missing.push('替代布确认样')
    if (!task.samplePlanLines.some((line) => line.sampleRole === '正确布确认样')) missing.push('正确布确认样')
  }
  if (task.productionReferenceRequiredFlag && !task.samplePlanLines.some((line) => line.sampleRole === '工厂参照样' && line.quantity > 0)) {
    missing.push('工厂参照样计划')
  }
  if (task.finalReferenceSampleAssetIds.length === 0) missing.push('最终参照样衣')
  return missing
}
