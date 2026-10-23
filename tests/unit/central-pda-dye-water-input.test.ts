import assert from 'node:assert/strict'
import test from 'node:test'
import { dyeWaterInput, dyeWaterReasonNeeded, centralDyeWaterFooter, type DyeWaterUi } from '../../src/pages/central-pda/dye-water-view.ts'
import type { centralDyeWater } from '../../src/pages/central-pda/dye-water-model.ts'

type Water = NonNullable<ReturnType<typeof centralDyeWater>>
const state = (patch: Partial<Water> = {}) => ({ phase: 'COMPLETE', previousOutput: 7, planned: 15,
  currentMinimum: 3, node: { inputQty: 10 }, fact: { order: { waterSolubleCompletedQty: 10 } }, ...patch } as Water)
const form = (raw: string, reason = ''): DyeWaterUi => ({ raw, reason, decision: '' })

test('C03.45/46: water entry is current-batch cumulative; archived output only decides the note rule', () => {
  assert.deepEqual(dyeWaterInput(state(), form('8'), 'zh'), { action: 'COMPLETE', outputQty: 8, reason: '' })
  assert.equal(dyeWaterReasonNeeded(state(), '8', 'zh'), false)
  assert.throws(() => dyeWaterInput(state(), form('7'), 'zh'), /reasonRequired/)
  assert.equal(dyeWaterInput(state(), form('7', 'Bahan kurang'), 'zh').reason, 'Bahan kurang')
  assert.throws(() => dyeWaterInput(state(), form('2', 'Bahan kurang'), 'zh'), /minimum/)
  assert.throws(() => dyeWaterInput(state(), form('11', 'Bahan kurang'), 'zh'), /maximum/)
})

test('C03.45/X08: Indonesian decimals retain the same water amount, with no exponent or thousands parsing', () => {
  const context = state({ planned: 15.125 })
  assert.equal(dyeWaterInput(context, form('8,125'), 'id').outputQty, 8.125)
  for (const raw of ['8.125', '8,1.25', '1e1', '-1']) assert.throws(() => dyeWaterInput(context, form(raw), 'id'))
})

test('C03.48: a zero-output pause cannot continue into dyeing, and cleared forms have no confirm action', () => {
  const paused = state({ phase: 'PAUSE', fact: { order: { waterSolubleCompletedQty: 0 } } as Water['fact'] })
  assert.throws(() => dyeWaterInput(paused, { ...form(''), decision: 'CONTINUE_WITH_ACTUAL_QTY' }, 'id'), /noActual/)
  assert.throws(() => dyeWaterInput(paused, { ...form(''), decision: 'UNKNOWN' }, 'id'), /choose/)
  assert.equal(centralDyeWaterFooter(state(), form(''), 'id', false, true)?.disabled, true)
  assert.equal(centralDyeWaterFooter(state(), form('8'), 'id', false, true)?.disabled, false)
})
