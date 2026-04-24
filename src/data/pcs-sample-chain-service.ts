import type { FirstOrderSampleTaskRecord } from './pcs-first-order-sample-types.ts'
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
  linkedSampleCode = '',
): SamplePlanLine {
  return {
    lineId,
    sampleRole,
    materialMode,
    quantity: 1,
    targetFactoryId: '',
    targetFactoryName: '',
    linkedSampleCode,
    status: linkedSampleCode ? '已确认' : '待确认',
    note: '',
  }
}

export function createReuseFirstSamplePlanLine(linkedSampleCode = ''): SamplePlanLine {
  return createPlanLine('reuse-first-sample-01', '复用首版结论', '沿用首版', linkedSampleCode)
}

export function createDefaultSamplePlanLines(mode: SampleChainMode, linkedSampleCode = ''): SamplePlanLine[] {
  if (mode === '替代布与正确布双确认') {
    return [
      createPlanLine('dual-substitute-01', '替代布确认样', '替代布'),
      createPlanLine('dual-correct-01', '正确布确认样', '正确布'),
    ]
  }
  if (mode === '新增首单样衣确认') {
    return [createPlanLine('new-correct-sample-01', '正确布确认样', '正确布')]
  }
  return [createReuseFirstSamplePlanLine(linkedSampleCode)]
}

export function normalizeSamplePlanLines(
  mode: SampleChainMode,
  lines: SamplePlanLine[] | undefined,
  linkedSampleCode = '',
): SamplePlanLine[] {
  const normalized = Array.isArray(lines)
    ? lines.map((line, index) => ({
        lineId: line.lineId || nextLineId('sample-line', index),
        sampleRole: line.sampleRole || '复用首版结论',
        materialMode: line.materialMode || (line.sampleRole === '复用首版结论' ? '沿用首版' : '正确布'),
        quantity: Number.isFinite(line.quantity) && line.quantity > 0 ? line.quantity : 1,
        targetFactoryId: line.targetFactoryId || '',
        targetFactoryName: line.targetFactoryName || '',
        linkedSampleCode: line.linkedSampleCode || '',
        status: line.status || (line.linkedSampleCode ? '已确认' : '待确认'),
        note: line.note || '',
      }))
    : []

  if (mode === '替代布与正确布双确认') {
    const hasSubstitute = normalized.some((line) => line.sampleRole === '替代布确认样')
    const hasCorrect = normalized.some((line) => line.sampleRole === '正确布确认样')
    return [
      ...normalized,
      ...(hasSubstitute ? [] : [createPlanLine('dual-substitute-01', '替代布确认样', '替代布')]),
      ...(hasCorrect ? [] : [createPlanLine('dual-correct-01', '正确布确认样', '正确布')]),
    ]
  }

  if (mode === '新增首单样衣确认') {
    const hasNewSample = normalized.some((line) => line.sampleRole === '正确布确认样' || line.sampleRole === '工厂参照确认')
    return hasNewSample ? normalized : [createPlanLine('new-correct-sample-01', '正确布确认样', '正确布')]
  }

  const reuseLine = normalized.find((line) => line.sampleRole === '复用首版结论')
  return [
    {
      ...(reuseLine || createReuseFirstSamplePlanLine(linkedSampleCode)),
      linkedSampleCode: reuseLine?.linkedSampleCode || linkedSampleCode,
      status: reuseLine?.linkedSampleCode || linkedSampleCode ? '已确认' : reuseLine?.status || '待确认',
    },
    ...normalized.filter((line) => line.sampleRole !== '复用首版结论'),
  ]
}

export function getFirstOrderSampleChainMissingFields(task: FirstOrderSampleTaskRecord): string[] {
  const missing: string[] = []
  if (!task.sampleChainMode) missing.push('首单确认方式')
  if (task.sampleChainMode === '复用首版结论') {
    if (!task.sourceFirstSampleTaskCode && !task.sourceFirstSampleTaskId) missing.push('来源首版任务')
    if (!task.samplePlanLines.some((line) => line.sampleRole === '复用首版结论')) missing.push('复用首版结论记录')
  }
  if (task.sampleChainMode === '新增首单样衣确认') {
    if (!task.samplePlanLines.some((line) => line.sampleRole === '正确布确认样')) missing.push('正确布首单确认样')
  }
  if (task.sampleChainMode === '替代布与正确布双确认') {
    if (!task.samplePlanLines.some((line) => line.sampleRole === '替代布确认样')) missing.push('替代布确认样')
    if (!task.samplePlanLines.some((line) => line.sampleRole === '正确布确认样')) missing.push('正确布确认样')
  }
  if (task.productionReferenceRequiredFlag && !task.samplePlanLines.some((line) => line.sampleRole === '工厂参照确认' && line.quantity > 0)) {
    missing.push('工厂参照确认')
  }
  return missing
}
