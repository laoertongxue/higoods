import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_GARMENT_INSPECTION_STANDARD, buildInspectionSnapshotFromConfigurations } from '../../src/data/fcs/quality-management-records.ts'
import { bindInspectionMeasurements } from '../../src/data/fcs/quality-management-source.ts'
import { createPostQcInspection, submitPostQcRound, validatePostQcObservations } from '../../src/data/fcs/post-finishing-quality.ts'
import { resolveInspectionStandard, validateInspectionConfiguration } from '../../src/data/fcs/quality-management-rules.ts'
import type { AdditionalInspectionStandard } from '../../src/data/fcs/quality-management-types.ts'

const context = { sourceKind: 'PRODUCTION_RETURN' as const, styleId: 'STYLE-QC-001', styleCode: 'SPU-QC-001', attributes: { size: 'M' } }

test('基本标准种子包含可执行的测量/外观结构和稳定缺陷代码', () => {
  const chest = DEFAULT_GARMENT_INSPECTION_STANDARD.items.find(item => item.id === 'garment-size-chest')!
  assert.equal(chest.kind, 'MEASUREMENT')
  assert.equal(chest.method, 'MEASURE')
  assert.equal(chest.measurement?.techPackPart, '胸围')
  assert.equal(chest.measurement?.unit, 'cm')
  assert.equal(chest.defectCodes?.[0]?.code, 'SIZE_CHEST_OUT')
  const fabric = DEFAULT_GARMENT_INSPECTION_STANDARD.items.find(item => item.id === 'garment-fabric')!
  assert.equal(fabric.kind, 'VISUAL')
  assert.ok(fabric.defectCodes?.some(code => code.code === 'FABRIC_HOLE'))
  assert.equal(fabric.evidenceRequirement, 'PHOTO')
})

test('附加标准可以按 typed 字段覆盖严重度等执行属性', () => {
  const additional: AdditionalInspectionStandard = {
    id: 'additional-typed-v1', familyId: 'additional-typed', version: 1, name: '指定款严重度覆盖', status: 'EFFECTIVE', objectType: 'GARMENT', kind: 'ADDITIONAL', level: 'STYLE',
    applicability: { sourceKinds: ['PRODUCTION_RETURN'], stages: ['POST_FINISHING_QC'], styleIds: ['SPU-QC-001'] },
    createdAt: '2026-10-23T00:00:00.000Z', updatedAt: '2026-10-23T00:00:00.000Z', effectiveAt: '2026-10-23T00:00:00.000Z',
    items: [], overrides: [
      { targetItemId: 'garment-size-chest', fields: ['severity'], values: { severity: 'CRITICAL' } },
      { targetItemId: 'garment-size-chest', fields: ['measurement'], values: { measurement: { techPackPart: '胸围', unit: 'cm', tolerance: 2 } } },
    ],
  }
  assert.doesNotThrow(() => validateInspectionConfiguration(additional, [DEFAULT_GARMENT_INSPECTION_STANDARD, additional]))
  const resolved = resolveInspectionStandard({ basicStandards: [DEFAULT_GARMENT_INSPECTION_STANDARD], additionalStandards: [additional], context })
  const chest = resolved.items.find(item => item.id === 'garment-size-chest')
  assert.equal(chest?.severity, 'CRITICAL')
  assert.equal(chest?.measurement?.tolerance, 2)
})

test('测量项从生产单冻结技术包尺寸表绑定标准值、单位和公差', () => {
  const snapshot = buildInspectionSnapshotFromConfigurations(context)
  bindInspectionMeasurements(snapshot, {
    techPackVersionId: 'TDV-QC-001',
    sizeMeasurements: [{ sizeCode: 'M', measurementPart: '胸围', measurementValue: 50, measurementUnit: 'cm', tolerance: 1 }],
  })
  const chest = snapshot.items.find(item => item.id === 'garment-size-chest')!
  assert.equal(snapshot.snapshotSchemaVersion, 2)
  assert.equal(snapshot.techPackVersionId, 'TDV-QC-001')
  assert.equal(chest.measurement?.nominalBySize?.M, 50)
  assert.equal(chest.measurement?.tolerance, 1)
  assert.equal(chest.measurement?.source, 'TECH_PACK')
})

test('项目观测校验拒绝测量超差、缺缺陷代码，并允许合格记录', () => {
  const snapshot = buildInspectionSnapshotFromConfigurations(context)
  bindInspectionMeasurements(snapshot, {
    techPackVersionId: 'TDV-QC-001',
    sizeMeasurements: [{ sizeCode: 'M', measurementPart: '胸围', measurementValue: 50, measurementUnit: 'cm', tolerance: 1 }],
  })
  assert.doesNotThrow(() => validatePostQcObservations(snapshot, [{ itemId: 'garment-size-chest', result: 'PASS', measuredValue: 51 }]))
  assert.throws(() => validatePostQcObservations(snapshot, [{ itemId: 'garment-size-chest', result: 'PASS', measuredValue: 52 }]), /公差/)
  assert.throws(() => validatePostQcObservations(snapshot, [{ itemId: 'garment-fabric', result: 'FAIL' }]), /缺陷代码/)
  assert.doesNotThrow(() => validatePostQcObservations(snapshot, [{ itemId: 'garment-fabric', result: 'FAIL', defectCode: 'FABRIC_HOLE' }]))
})

test('提交轮次时项目不合格生成项目问题，但仍按用户填写的件数计数', () => {
  const snapshot = buildInspectionSnapshotFromConfigurations(context)
  bindInspectionMeasurements(snapshot, {
    techPackVersionId: 'TDV-QC-001',
    sizeMeasurements: [{ sizeCode: 'M', measurementPart: '胸围', measurementValue: 50, measurementUnit: 'cm', tolerance: 1 }],
  })
  const inspection = createPostQcInspection(snapshot)
  const round = submitPostQcRound(inspection, [{ skuId: 'SKU-M', quantity: 100 }], {
    operationId: 'round-structured-1',
    actorId: 'QC-1',
    submittedAt: '2026-10-23T08:00:00.000Z',
    lines: [{ skuId: 'SKU-M', passedQty: 29, defectQty: 1, returnQty: 0, observations: [{ itemId: 'garment-fabric', result: 'FAIL', defectCode: 'FABRIC_HOLE', note: '左侧破洞' }] }],
  })
  assert.equal(round.lines[0].issues?.[0]?.itemId, 'garment-fabric')
  assert.equal(round.lines[0].defectQty, 1)
  assert.equal(round.lines[0].observations?.[0]?.skuId, 'SKU-M')
  const inspection2 = createPostQcInspection(snapshot)
  assert.throws(() => submitPostQcRound(inspection2, [{ skuId: 'SKU-M', quantity: 100 }], {
    operationId: 'round-structured-2',
    actorId: 'QC-1',
    submittedAt: '2026-10-23T08:01:00.000Z',
    lines: [{ skuId: 'SKU-M', passedQty: 30, defectQty: 0, returnQty: 0, observations: [{ itemId: 'garment-fabric', result: 'FAIL', defectCode: 'FABRIC_HOLE' }] }],
  }), /件数为0/)
})
