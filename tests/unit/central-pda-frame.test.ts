import assert from 'node:assert/strict'
import test from 'node:test'
import { renderCentralPdaFrame, type CentralPdaFrameInput } from '../../src/pages/central-pda/frame.ts'

const base: CentralPdaFrameInput = {
  accountName: 'Rina', accountNo: '018', factoryName: '中央工厂', operationName: '绣花',
  language: 'zh', tab: 'receive', content: '<article data-order="CURRENT">当前加工单</article>',
}

test('S03-S07: Central Factory frame has exactly its three work areas and no commercial or onboarding controls', () => {
  const html = renderCentralPdaFrame(base)
  assert.match(html, /Rina · 018/)
  assert.match(html, /中央工厂/)
  for (const tab of ['receive', 'execute', 'warehouse']) assert.match(html, new RegExp(`data-central-nav="/fcs/pda/central/${tab}"`))
  for (const label of ['接单', '竞价', '开工', '入驻', '结算', '待办', '权限', '管理员']) assert.ok(!html.includes(label), label)
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1)
})

test('X08: Indonesian chrome contains no Chinese, and object/account text is escaped', () => {
  const html = renderCentralPdaFrame({ ...base, language: 'id', factoryName: 'Pabrik pusat', operationName: 'Bordir', accountName: '<Rina>', content: '<article>6 panel</article>' })
  assert.match(html, /Terima/)
  assert.match(html, /Proses/)
  assert.match(html, /Gudang/)
  assert.match(html, /Ganti bahasa/)
  assert.match(html, /&lt;Rina&gt;/)
  assert.doesNotMatch(html, /[\u3400-\u9fff]/)
})

test('X05: a detail has Back and its actual primary action, without a second bottom tab bar', () => {
  const html = renderCentralPdaFrame({ ...base, heading: '确认接收', backPath: '/fcs/pda/central/receive', primary: { label: '确认接收 6 片', action: 'receive-save' } })
  assert.match(html, /aria-label="返回"/)
  assert.match(html, /data-central-action="receive-save"/)
  assert.match(html, /确认接收 6 片/)
  assert.doesNotMatch(html, /aria-label="作业模块"/)
  assert.doesNotMatch(html, /data-central-action="operation"/)
})


test('X01/X05: outgoing primary keeps quantity and escaped downstream in one confirmation control', () => {
  const html = renderCentralPdaFrame({ ...base, language: 'id', primary: { label: 'Konfirmasi kirim · 3 potong', context: '→ <APF>', action: 'wool-handover-save' } })
  assert.equal((html.match(/data-central-action="wool-handover-save"/g) || []).length, 1)
  assert.match(html, /Konfirmasi kirim · 3 potong/)
  assert.match(html, /→ &lt;APF&gt;/)
  assert.doesNotMatch(html, /→ <APF>/)
})
