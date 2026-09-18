import assert from 'node:assert/strict'
import test from 'node:test'

import {
  addPmsConfirmationBoxSpec,
  addPmsConfirmationPackageDetail,
  calculatePmsBoxVolume,
  generatePmsConfirmationLabels,
  generatePmsConfirmationRolls,
  removePmsConfirmationBoxSpec,
  removePmsConfirmationPackageDetail,
  resetPmsConfirmationRuntimeForTest,
} from '../../src/data/pms/supplier-confirmations.ts'
import { PMS_BUYER_ACTOR, PmsDomainError } from '../../src/data/pms/runtime.ts'

test('生成卷号按前缀、每卷米数、重量与起始序号生成并写入包装明细', () => {
  resetPmsConfirmationRuntimeForTest()
  const confirmation = generatePmsConfirmationRolls(
    'CONF-2026-0004',
    { rollCount: 9, qtyPerPackage: 100, packageUnit: '卷', boxCount: 3, rollNoPrefix: 'HD-FLEECE', metersPerRoll: 100, weightPerRoll: 21.5, startSequence: 3 },
    PMS_BUYER_ACTOR,
  )
  assert.equal(confirmation.rolls.length, 8)
  assert.equal(confirmation.rolls[0].rollNo, 'HD-FLEECE-3')
  assert.equal(confirmation.rolls[7].rollNo, 'HD-FLEECE-10')
  assert.equal(confirmation.rolls[0].qty, 100)
  assert.equal(confirmation.rolls[7].qty, 100)
  assert.equal(confirmation.rolls.reduce((sum, roll) => sum + roll.qty, 0), 800)
  assert.equal(confirmation.rolls.every((roll) => roll.weight === 21.5), true)
  assert.equal(confirmation.packageQty, 100)
  assert.equal(confirmation.packageUnit, '卷')
  assert.equal(confirmation.status, '已编辑')
})

test('生成卷号时尾卷承载剩余数量，卷数按采购数量与每卷米数自动取整', () => {
  resetPmsConfirmationRuntimeForTest()
  const confirmation = generatePmsConfirmationRolls(
    'CONF-2026-0004',
    { rollCount: 1, qtyPerPackage: 100, packageUnit: '卷', boxCount: 1, rollNoPrefix: 'FAB', metersPerRoll: 300, startSequence: 1 },
    PMS_BUYER_ACTOR,
  )
  assert.equal(confirmation.rolls.length, 3)
  assert.deepEqual(confirmation.rolls.map((roll) => roll.rollNo), ['FAB-1', 'FAB-2', 'FAB-3'])
  assert.deepEqual(confirmation.rolls.map((roll) => roll.qty), [300, 300, 200])
  assert.deepEqual(confirmation.rolls.map((roll) => roll.weight), [0, 0, 0])
})

test('非法卷号参数被拒绝并抛出中文域错误', () => {
  resetPmsConfirmationRuntimeForTest()
  const base = { rollCount: 1, qtyPerPackage: 100, packageUnit: '卷', boxCount: 1 }
  assert.throws(() => generatePmsConfirmationRolls('CONF-2026-0004', { ...base, rollNoPrefix: '', metersPerRoll: 100, startSequence: 1 }, PMS_BUYER_ACTOR), PmsDomainError)
  assert.throws(() => generatePmsConfirmationRolls('CONF-2026-0004', { ...base, rollNoPrefix: '', metersPerRoll: 100, startSequence: 1 }, PMS_BUYER_ACTOR), /前缀不能为空/)
  assert.throws(() => generatePmsConfirmationRolls('CONF-2026-0004', { ...base, rollNoPrefix: 'FAB', metersPerRoll: 0, startSequence: 1 }, PMS_BUYER_ACTOR), /每卷米数必须大于 0/)
  assert.throws(() => generatePmsConfirmationRolls('CONF-2026-0004', { ...base, rollNoPrefix: 'FAB', metersPerRoll: 100, startSequence: 0 }, PMS_BUYER_ACTOR), /起始序号必须是大于等于 1 的整数/)
  assert.throws(() => generatePmsConfirmationRolls('CONF-2026-0004', { ...base, rollNoPrefix: 'FAB', metersPerRoll: 100, startSequence: 1.5 }, PMS_BUYER_ACTOR), /起始序号必须是大于等于 1 的整数/)
  assert.throws(() => generatePmsConfirmationRolls('CONF-2026-0004', { ...base, rollNoPrefix: 'FAB', metersPerRoll: 100, startSequence: 1, weightPerRoll: 0 }, PMS_BUYER_ACTOR), /每卷重量必须大于 0/)
  assert.throws(() => generatePmsConfirmationRolls('CONF-2026-0004', { ...base, rollNoPrefix: 'FAB', metersPerRoll: 100, startSequence: 1, weightPerRoll: -2 }, PMS_BUYER_ACTOR), /每卷重量必须大于 0/)
})

test('生成标签后二维码内容包含卷号与箱规，参与打印', () => {
  resetPmsConfirmationRuntimeForTest()
  const confirmation = generatePmsConfirmationRolls(
    'CONF-2026-0004',
    { rollCount: 2, qtyPerPackage: 100, packageUnit: '卷', boxCount: 1, rollNoPrefix: 'FAB', metersPerRoll: 400, startSequence: 1 },
    PMS_BUYER_ACTOR,
  )
  assert.equal(confirmation.rolls.length, 2)
  addPmsConfirmationBoxSpec('CONF-2026-0004', { boxNo: 'BOX-001', length: 60, width: 40, height: 35 }, PMS_BUYER_ACTOR)
  generatePmsConfirmationLabels('CONF-2026-0004', [confirmation.rolls[0].rollNo], PMS_BUYER_ACTOR)
  assert.match(confirmation.rolls[0].qrContent, /卷号：FAB-1/)
  assert.match(confirmation.rolls[0].qrContent, /箱规：60×40×35cm/)
})

test('箱规新增自动计算体积，重复箱号与非法尺寸被拒，删除后计数正确', () => {
  resetPmsConfirmationRuntimeForTest()
  assert.equal(calculatePmsBoxVolume(60, 40, 35), 84000)
  assert.equal(calculatePmsBoxVolume(1.5, 2, 3.2), 9.6)
  const confirmation = addPmsConfirmationBoxSpec('CONF-2026-0001', { boxNo: 'BOX-NEW', length: 50, width: 30, height: 40, remark: '测试箱规' }, PMS_BUYER_ACTOR)
  const spec = confirmation.boxSpecs.find((item) => item.boxNo === 'BOX-NEW')
  assert.ok(spec)
  assert.equal(spec.volume, 60000)
  assert.equal(spec.remark, '测试箱规')
  assert.throws(() => addPmsConfirmationBoxSpec('CONF-2026-0001', { boxNo: 'BOX-NEW', length: 50, width: 30, height: 40 }, PMS_BUYER_ACTOR), PmsDomainError)
  assert.throws(() => addPmsConfirmationBoxSpec('CONF-2026-0001', { boxNo: '', length: 50, width: 30, height: 40 }, PMS_BUYER_ACTOR), /箱号不能为空/)
  assert.throws(() => addPmsConfirmationBoxSpec('CONF-2026-0001', { boxNo: 'BOX-BAD', length: 0, width: 30, height: 40 }, PMS_BUYER_ACTOR), /长、宽、高必须大于 0/)
  const before = confirmation.boxSpecs.length
  removePmsConfirmationBoxSpec('CONF-2026-0001', 'BOX-NEW', PMS_BUYER_ACTOR)
  assert.equal(confirmation.boxSpecs.length, before - 1)
  assert.equal(confirmation.boxSpecs.some((item) => item.boxNo === 'BOX-NEW'), false)
  assert.throws(() => removePmsConfirmationBoxSpec('CONF-2026-0001', 'BOX-NEW', PMS_BUYER_ACTOR), PmsDomainError)
})

test('包装明细可新增与删除，非法输入被拒且删除后计数正确', () => {
  resetPmsConfirmationRuntimeForTest()
  const confirmation = addPmsConfirmationPackageDetail('CONF-2026-0004', { packageMethod: '卷装', qty: 8, unit: '卷', remark: '8 卷/托' }, PMS_BUYER_ACTOR)
  assert.equal(confirmation.packageDetails.length, 1)
  assert.equal(confirmation.packageDetails[0].packageMethod, '卷装')
  assert.equal(confirmation.packageDetails[0].qty, 8)
  assert.equal(confirmation.packageDetails[0].unit, '卷')
  assert.throws(() => addPmsConfirmationPackageDetail('CONF-2026-0004', { packageMethod: '', qty: 1, unit: '卷' }, PMS_BUYER_ACTOR), /包装方式不能为空/)
  assert.throws(() => addPmsConfirmationPackageDetail('CONF-2026-0004', { packageMethod: '卷装', qty: 0, unit: '卷' }, PMS_BUYER_ACTOR), /数量必须大于 0/)
  assert.throws(() => addPmsConfirmationPackageDetail('CONF-2026-0004', { packageMethod: '卷装', qty: 1, unit: '' }, PMS_BUYER_ACTOR), /单位不能为空/)
  const packageDetailNo = confirmation.packageDetails[0].packageDetailNo
  removePmsConfirmationPackageDetail('CONF-2026-0004', packageDetailNo, PMS_BUYER_ACTOR)
  assert.equal(confirmation.packageDetails.length, 0)
  assert.throws(() => removePmsConfirmationPackageDetail('CONF-2026-0004', packageDetailNo, PMS_BUYER_ACTOR), PmsDomainError)
})

test('被包装明细引用的箱规不能删除', () => {
  assert.throws(() => removePmsConfirmationBoxSpec('CONF-2026-0001', 'BOX-001', PMS_BUYER_ACTOR), PmsDomainError)
  const added = addPmsConfirmationBoxSpec('CONF-2026-0002', { boxNo: 'BOX-NEW-1', length: 50, width: 40, height: 30 }, PMS_BUYER_ACTOR)
  assert.equal(added.boxSpecs.some((spec) => spec.boxNo === 'BOX-NEW-1'), true)
  const removed = removePmsConfirmationBoxSpec('CONF-2026-0002', 'BOX-NEW-1', PMS_BUYER_ACTOR)
  assert.equal(removed.boxSpecs.some((spec) => spec.boxNo === 'BOX-NEW-1'), false)
})
