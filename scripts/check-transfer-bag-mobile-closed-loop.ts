#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderPdaCuttingTransferBagRecoveryPage } from '../src/pages/pda-cutting-transfer-bag-recovery.ts'
import { renderPdaCuttingTransferBagScrapPage } from '../src/pages/pda-cutting-transfer-bag-scrap.ts'
import { renderPdaTransferBagDetailPage } from '../src/pages/pda-transfer-bag-detail.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (path: string) => readFileSync(`${ROOT}/${path}`, 'utf8')
const recoverySource = read('src/pages/pda-cutting-transfer-bag-recovery.ts')
const scrapSource = read('src/pages/pda-cutting-transfer-bag-scrap.ts')
const detailSource = read('src/pages/pda-transfer-bag-detail.ts')
const handlerSource = read('src/main-handlers/pda-handlers.ts')
const routeSource = read('src/router/routes-pda.ts')
const keydownSource = read('src/main-handlers/pda-cutting-keydown-routing.ts')

const recoveryHtml = renderPdaCuttingTransferBagRecoveryPage()
assert(recoveryHtml.includes('确认回收'))
assert(!recoveryHtml.includes('确认报废'))
assert(recoveryHtml.includes('扫描或填写中转袋编号'))
assert(recoveryHtml.includes('实物空袋'))

const scrapHtml = renderPdaCuttingTransferBagScrapPage()
assert(scrapHtml.includes('确认报废'))
assert(!scrapHtml.includes('确认回收'))
assert(scrapHtml.includes('只有空闲袋可以报废'))

assert(recoverySource.includes('recoverTransferBag({'), '回收页必须写入共享回收事实')
assert(recoverySource.includes('physicalBagReceived'), '回收页必须确认实物袋已收到')
assert(recoverySource.includes('physicalBagEmpty'), '回收页必须确认实物袋为空')
assert(recoverySource.includes("recoveryMode: 'NORMAL' | 'FORCED'"), '回收页必须支持正常与强制回收')
assert(recoverySource.includes('latestHandoverSummary'), '回收页必须展示最近交出记录')
assert(scrapSource.includes('submitTransferBagScrap({'), '空闲袋必须直接写报废事实')
assert(scrapSource.includes('recoverThenScrapTransferBag({'), '已交出袋必须先回收再报废')
assert(scrapSource.includes('finalConfirmed'), '报废必须二次确认')
assert(scrapSource.includes('前往拆袋重装'), '有菲票的袋必须引导先拆袋重装')
assert(scrapSource.includes('authorizedBy'), '报废必须记录授权人')

const detailHtml = renderPdaTransferBagDetailPage('MOBILE-CHECK-BAG')
for (const text of ['中转袋编号', '主状态', '当前阶段', '当前使用周期', '当前袋内菲票', '最近交出快照', '回收和报废记录', '完整历史']) {
  assert(detailHtml.includes(text), `扫码详情缺少：${text}`)
}
for (const forbidden of ['车缝接收', '确认收货', '内部袋池', '按袋确认', '按菲票确认']) {
  assert(!detailHtml.includes(forbidden), `扫码详情不得出现外部车缝管理动作：${forbidden}`)
  assert(!detailSource.includes(`>${forbidden}<`), `源码不得保留外部车缝管理按钮：${forbidden}`)
}
assert(detailSource.includes('resolveTransferBagCurrentUse'), '详情必须读取共享当前袋票事实')
assert(detailSource.includes('listCuttingRuntimeEvents'), '详情必须读取完整历史事实')

for (const route of ['/fcs/pda/cutting/transfer-bag/recovery', '/fcs/pda/cutting/transfer-bag/scrap', '/fcs/pda/transfer-bag-detail']) {
  assert(routeSource.includes(route), `PDA 路由缺少：${route}`)
}
assert(handlerSource.includes('handlePdaCuttingTransferBagRecoveryEvent(target, event)'))
assert(handlerSource.includes('handlePdaCuttingTransferBagScrapEvent(target, event)'))
assert(keydownSource.includes('[data-pda-recovery-field="bagCode"]'))
assert(keydownSource.includes('[data-pda-scrap-field="bagCode"]'))

console.log('check:transfer-bag-mobile-closed-loop passed：独立回收、报废、两事实顺序入口和只读扫码详情均已闭环。')
