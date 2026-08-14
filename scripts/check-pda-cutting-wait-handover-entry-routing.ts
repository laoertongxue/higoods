#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const waitHandoverSource = fs.readFileSync(path.join(ROOT, 'src/pages/pda-warehouse-wait-handover.ts'), 'utf8')
const repackSource = fs.readFileSync(path.join(ROOT, 'src/pages/pda-cutting-transfer-bag-repack.ts'), 'utf8')
const handoverSource = fs.readFileSync(path.join(ROOT, 'src/pages/pda-cutting-handover.ts'), 'utf8')
const { getPdaCuttingWaitHandoverActions, resolvePdaCuttingWaitHandoverLegacyActionRoute } = await import('../src/pages/pda-cutting-wait-handover-actions.ts')
const { routes: pdaRoutes } = await import('../src/router/routes-pda.ts')

const entries = getPdaCuttingWaitHandoverActions()
assert.deepEqual(entries.map(({ key, title }) => ({ key, title })), [
  { key: 'fei-ticket-bagging', title: '菲票装袋' },
  { key: 'transfer-bag-inbound', title: '中转袋入仓' },
  { key: 'transfer-bag-handover', title: '中转袋交出' },
  { key: 'special-craft-return', title: '特殊工艺回仓' },
  { key: 'fei-ticket-numbering', title: '菲票打编号' },
  { key: 'transfer-bag-recovery', title: '中转袋回收' },
  { key: 'transfer-bag-scrap', title: '中转袋报废' },
], 'PDA 待交出仓必须恰好显示七个独立入口，拆袋重装并入中转袋交出')
assert.equal(entries.some((entry) => entry.title === '拆袋重装'), false, 'PDA 不得保留独立拆袋重装入口')
assert.equal(entries.find((entry) => entry.key === 'transfer-bag-handover')?.route, '/fcs/pda/cutting/transfer-bag/repack', 'PDA 中转袋交出必须进入任务驱动的合并流程')
assert.match(entries.find((entry) => entry.key === 'special-craft-return')?.route || '', /action=special-craft-return$/, '特殊工艺回仓必须进入独立操作页')
assert.equal(entries.find((entry) => entry.key === 'fei-ticket-numbering')?.route, '/fcs/pda/cutting/fei-ticket-numbering', '菲票打编号必须进入既有 PDA 编号页')
assert.equal(resolvePdaCuttingWaitHandoverLegacyActionRoute('handover-bagging-confirm'), '/fcs/pda/cutting/transfer-bag/repack')
assert.match(resolvePdaCuttingWaitHandoverLegacyActionRoute('special-craft-return') || '', /action=special-craft-return$/)
assert.equal(resolvePdaCuttingWaitHandoverLegacyActionRoute('numbering'), '/fcs/pda/cutting/fei-ticket-numbering')

assert(pdaRoutes.exactRoutes['/fcs/pda/cutting/transfer-bag/repack'], 'PDA 合并交出流程必须保留稳定路由')
assert(waitHandoverSource.includes('renderCuttingWaitHandoverActionCards(getPdaCuttingWaitHandoverActions())'), 'PDA 待交出仓卡片必须直接读取七入口契约')
for (const marker of [
  '中转袋交出',
  '第 ${visibleStep} 步，共 5 步',
  '1 扫车缝任务',
  '2 核对相关袋',
  '3 直接交出或重装',
  '4 剩余来源袋',
  '5 汇总确认',
  'data-pda-repack-field="sewingTaskNo"',
  'data-pda-repack-field="receiverPpicId"',
  '扫描或填写',
  'submitWaitHandoverTaskBatch({',
]) assert(repackSource.includes(marker), `PDA 合并交出流程缺少：${marker}`)
assert(repackSource.includes("disposition === 'DIRECT_HANDOVER'"), 'PDA 必须识别整袋直接交出')
assert(repackSource.includes("disposition === 'REPACK_REQUIRED'"), 'PDA 必须识别正常拆袋重装')
assert(repackSource.includes('默认原库位，也可以重新扫描或手工填写'), 'PDA 剩余来源袋必须默认原库位并允许扫码或手填变更')
assert(!handoverSource.includes('<div class="font-medium">特殊工艺回仓扫码</div>'), 'PDA 特殊工艺回仓不得保留重复说明模块')

console.log('PASS check-pda-cutting-wait-handover-entry-routing')
