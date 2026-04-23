#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import {
  getPdaHandoverRecordsByHead,
  listPdaHandoverHeads,
  listQuantityObjections,
} from '../src/data/fcs/pda-handover-events.ts'
import { removedLegacyProcessCodes } from './utils/special-craft-banlist.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

const pageFiles = [
  'src/pages/pda-handover.ts',
  'src/pages/pda-handover-detail.ts',
  'src/pages/progress-handover.ts',
  'src/pages/progress-handover-order.ts',
] as const

function readFile(filePath: string): string {
  return fs.readFileSync(path.resolve(filePath), 'utf8')
}

function legacyMobileCopy(...parts: string[]): string {
  return parts.join('')
}

function checkForbiddenCopy(): void {
  const forbiddenTerms = [
    legacyMobileCopy('领料', '头'),
    legacyMobileCopy('交出', '头'),
    '仓库自动回写',
    '工厂只查看',
    '仓库确认',
    legacyMobileCopy('印花', ' ', 'PDA'),
    legacyMobileCopy('染色', ' ', 'PDA'),
    legacyMobileCopy('印花', 'PDA'),
    legacyMobileCopy('染色', 'PDA'),
    legacyMobileCopy('PDA', '交出'),
    legacyMobileCopy('PDA', ' ', 'Handover'),
  ]

  pageFiles.forEach((file) => {
    const source = readFile(file)
    forbiddenTerms.forEach((term) => {
      assert(!source.includes(term), `${file} 仍残留禁用文案：${term}`)
    })
  })
}

function checkPageSignals(): void {
  const listPage = readFile('src/pages/pda-handover.ts')
  const detailPage = readFile('src/pages/pda-handover-detail.ts')
  const ledgerPage = readFile('src/pages/progress-handover.ts')
  const orderPage = readFile('src/pages/progress-handover-order.ts')
  const execPage = readFile('src/pages/pda-exec-detail.ts')

  ;['接收方', '已交出', '已回写', '差异', '异议', '待回写', '查看交出单', '新增交出记录'].forEach((term) => {
    assert(listPage.includes(term), `pda-handover.ts 缺少列表关键信号：${term}`)
  })

  ;['交出单二维码', '交出记录二维码', '新增交出记录', '完成领料单', '完成交出单', '接收方回写', '发起异议', '接受差异', '入库记录', '出库记录', '已入待加工仓', '已生成出库记录', '已驳回'].forEach((term) => {
    assert(detailPage.includes(term), `pda-handover-detail.ts 缺少详情关键信号：${term}`)
  })
  ;['中转袋', '扫码装袋', '移除菲票', '完成装袋', '扫描中转袋', '按袋回写', '按菲票回写', '袋内明细'].forEach((term) => {
    assert((detailPage + readFile('src/pages/pda-transfer-bag-detail.ts')).includes(term), `移动端交接缺少中转袋闭环字段：${term}`)
  })
  ;['特殊工艺菲票', '原数量', '当前数量', '报废数量', '货损数量', '已完成特殊工艺', '差异状态'].forEach((term) => {
    assert(detailPage.includes(term), `pda-handover-detail.ts 缺少特殊工艺深化字段：${term}`)
  })

  assert(
    detailPage.includes('handoverRecordQrValue') || detailPage.includes('getHandoverRecordQrDisplayValue'),
    'pda-handover-detail.ts 未使用交出记录二维码字段或 helper',
  )
  assert(detailPage.includes('createFactoryHandoverRecord'), 'pda-handover-detail.ts 未接入新增交出记录 helper')
  assert(detailPage.includes('writeBackHandoverRecord'), 'pda-handover-detail.ts 未接入接收方回写 helper')
  assert(detailPage.includes('receiverWrittenQty') || detailPage.includes('getRecordReceiverWrittenQty'), 'pda-handover-detail.ts 未切换到 receiverWritten 主口径')
  assert(detailPage.includes('linkPickupConfirmToInboundRecord'), 'pda-handover-detail.ts 未接入待领料到入库联动 helper')
  assert(detailPage.includes('linkHandoverRecordToOutboundRecord'), 'pda-handover-detail.ts 未接入交出到出库联动 helper')
  assert(detailPage.includes('syncReceiverWritebackToOutboundRecord'), 'pda-handover-detail.ts 未接入回写同步出库 helper')
  assert(detailPage.includes('syncQuantityObjectionToOutboundRecord'), 'pda-handover-detail.ts 未接入异议同步出库 helper')

  ;['接收方回写', '交出单', '交出记录'].forEach((term) => {
    assert(ledgerPage.includes(term), `progress-handover.ts 缺少台账口径：${term}`)
  })
  assert(orderPage.includes('查看交出详情'), 'progress-handover-order.ts 未提供交出详情入口')

  assert(!execPage.includes('去交接（待交出）'), 'pda-exec-detail.ts 被回退为旧文案：去交接（待交出）')
  assert(execPage.includes('任务二维码'), 'pda-exec-detail.ts 丢失任务二维码')
  assert(execPage.includes('查看交出单'), 'pda-exec-detail.ts 丢失查看交出单')
  assert(execPage.includes('新增交出记录'), 'pda-exec-detail.ts 丢失新增交出记录')
}

function checkDataSignals(): void {
  const heads = listPdaHandoverHeads()
  const handoutHeads = heads.filter((head) => head.headType === 'HANDOUT')
  const pickupHeads = heads.filter((head) => head.headType === 'PICKUP')

  assert(handoutHeads.length > 0, '缺少交出单样例')
  assert(pickupHeads.length > 0, 'pickup 领料样例丢失')

  handoutHeads.forEach((head) => {
    const records = getPdaHandoverRecordsByHead(head.handoverId)
    records.forEach((record) => {
      assert(Boolean(record.handoverRecordQrValue), `交出记录缺少二维码：${record.recordId}`)
      assert(record.factorySubmittedByKind === 'FACTORY', `交出记录必须由工厂发起：${record.recordId}`)
    })
    assert(!['BUTTONHOLE', 'BUTTON_ATTACH', 'IRONING', 'PACKAGING'].includes(head.processBusinessCode || ''), `后道产能节点误入交出场景：${head.handoverId}`)
    assert(!['WASHING', ...removedLegacyProcessCodes].includes(head.processBusinessCode || ''), `历史停用工序误入交出场景：${head.handoverId}`)
  })

  const objections = listQuantityObjections()
  objections.forEach((objection) => {
    assert(objection.raisedByKind === 'FACTORY', `数量异议必须由工厂发起：${objection.objectionId}`)
  })
}

function main(): void {
  checkForbiddenCopy()
  checkPageSignals()
  checkDataSignals()
  console.log('check:pda-handover-pages passed')
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
}
