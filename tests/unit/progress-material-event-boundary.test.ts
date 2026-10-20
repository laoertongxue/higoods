import assert from 'node:assert/strict'
import test from 'node:test'
import { handleProgressMaterialEvent } from '../../src/pages/progress-material.ts'

test('物料进度原生字段只在 input/change 更新，点击下拉框不消费事件或读取值', () => {
  const inputDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'HTMLInputElement')
  const selectDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'HTMLSelectElement')
  class MaterialInput {}
  class MaterialSelect {
    dataset = { materialField: 'executionStatus' }
    valueReads = 0
    get value() { this.valueReads += 1; return 'ALL' }
    closest(selector: string) { return selector === '[data-material-field]' ? this : null }
  }
  Object.defineProperty(globalThis, 'HTMLInputElement', { configurable: true, value: MaterialInput })
  Object.defineProperty(globalThis, 'HTMLSelectElement', { configurable: true, value: MaterialSelect })
  try {
    const select = new MaterialSelect()
    const target = select as unknown as HTMLElement
    assert.equal(handleProgressMaterialEvent(target, new Event('click')), false)
    assert.equal(handleProgressMaterialEvent(target, new Event('focus')), false)
    assert.equal(handleProgressMaterialEvent(target), false)
    assert.equal(select.valueReads, 0)

    assert.equal(handleProgressMaterialEvent(target, new Event('input')), true)
    assert.equal(handleProgressMaterialEvent(target, new Event('change')), true)
    assert.equal(select.valueReads, 2)

    const reset = {
      dataset: { materialAction: 'reset-filters' },
      closest(selector: string) { return selector === '[data-material-action]' ? this : null },
    } as unknown as HTMLElement
    assert.equal(handleProgressMaterialEvent(reset, new Event('click')), true)
  } finally {
    if (inputDescriptor) Object.defineProperty(globalThis, 'HTMLInputElement', inputDescriptor)
    else Reflect.deleteProperty(globalThis, 'HTMLInputElement')
    if (selectDescriptor) Object.defineProperty(globalThis, 'HTMLSelectElement', selectDescriptor)
    else Reflect.deleteProperty(globalThis, 'HTMLSelectElement')
  }
})
