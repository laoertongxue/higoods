import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync(new URL('../src/pages/pcs-work-items.ts', import.meta.url), 'utf8')

;[
  '字段',
  '状态',
  '操作',
  '实例承载方式',
  '独立实例列表',
  '主实例模块 / 项目内展示方式',
].forEach((column) => {
  assert.ok(html.includes(column), `工作项库列表页应展示列：${column}`)
})

console.log('pcs-work-item-library-columns.spec.ts PASS')
