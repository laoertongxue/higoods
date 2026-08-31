#!/usr/bin/env node

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { getSpecialCraftTaskOrderById } from '../src/data/fcs/special-craft-task-orders.ts'
import { getBindingProcessOrderById } from '../src/pages/process-factory/cutting/binding-strip-orders.ts'

type FullFlowEvidence = {
  generatedAt: string
  workOrderCount: number
  results: Array<{
    chainId: string
    workOrderId?: string
    workOrderNo?: string
    status: string
  }>
}

const root = resolve('output/verification/aux-special-accessory')
const sourcePass = ['pass-2', 'pass-1', 'adhoc'].find((label) =>
  existsSync(resolve(root, label, 'per-craft-full-flow.json'))
)
assert(sourcePass, '缺少 per-craft-full-flow.json；请先运行逐加工单本地验证轮次')

const fullFlowPath = resolve(root, sourcePass, 'per-craft-full-flow.json')
const fullFlow = JSON.parse(readFileSync(fullFlowPath, 'utf8')) as FullFlowEvidence
const gates = fullFlow.results.filter((result) => result.status === 'passed' && result.chainId !== 'ACC-LACE-01')
assert.equal(new Set(gates.map((result) => result.chainId)).size, 18, '现实 PDA 必须覆盖 17 种工艺和捆条共 18 条链')
assert.equal(new Set(gates.map((result) => result.workOrderId)).size, gates.length, '现实 PDA 加工单清单存在重复或空 ID')

function sourceContext(gate: FullFlowEvidence['results'][number]): {
  sourceType: 'SPECIAL_CRAFT' | 'BINDING_PROCESS_ORDER'
  sourceTaskId: string
  sourceTaskNo: string
  factoryId: string
  inputUnit: string
  outputUnit: string
} {
  assert(gate.workOrderId, `${gate.chainId} 缺少加工单 ID`)
  if (gate.chainId === 'BIND-01') {
    const order = getBindingProcessOrderById(gate.workOrderId)
    assert(order, `${gate.chainId} 找不到捆条加工单 ${gate.workOrderId}`)
    return {
      sourceType: 'BINDING_PROCESS_ORDER',
      sourceTaskId: order.sourceTaskId,
      sourceTaskNo: order.sourceTaskNo,
      factoryId: order.factoryId,
      inputUnit: order.materialIdentity.materialUnit || '米',
      outputUnit: order.unit,
    }
  }
  const order = getSpecialCraftTaskOrderById(gate.workOrderId)
  assert(order, `${gate.chainId} 找不到工艺加工单 ${gate.workOrderId}`)
  assert(order.sourceTaskId && order.sourceTaskNo, `${gate.chainId} 加工单缺少来源任务`)
  return {
    sourceType: 'SPECIAL_CRAFT',
    sourceTaskId: order.sourceTaskId,
    sourceTaskNo: order.sourceTaskNo,
    factoryId: order.factoryId,
    inputUnit: order.inputUnit || order.unit,
    outputUnit: order.outputUnit || order.unit,
  }
}

function actionTemplate(action: string, unit: string, requiresQty: boolean) {
  return {
    action,
    result: 'pending',
    beforeStatus: '',
    afterStatus: '',
    actualQty: requiresQty ? 0 : null,
    unit: requiresQty ? unit : '',
    operatorName: '',
    verifiedAt: '',
    photoPath: '',
    businessRecordId: '',
    note: '',
  }
}

function runTemplate(passLabel: 'pass-1' | 'pass-2') {
  const localBrowserPath = resolve(root, passLabel, 'browser', 'browser-results.json')
  const localBrowserGeneratedAt = existsSync(localBrowserPath)
    ? (JSON.parse(readFileSync(localBrowserPath, 'utf8')) as { generatedAt?: string }).generatedAt || ''
    : ''
  return {
    passLabel,
    localBrowserGeneratedAt,
    testDataResetAt: '',
    testDataResetBy: '',
    baseUrl: '',
    device: {
      kind: 'PHYSICAL_IDATA_PDA',
      manufacturer: 'iData',
      model: '',
      serialNo: '',
      androidVersion: '',
      screenResolution: '',
    },
    verifier: {
      name: '',
      employeeId: '',
    },
    entries: gates.map((gate) => {
      const source = sourceContext(gate)
      return {
        gateId: `DEVICE-${gate.chainId}-${gate.workOrderId}`,
        chainId: gate.chainId,
        workOrderId: gate.workOrderId,
        workOrderNo: gate.workOrderNo,
        sourceType: source.sourceType,
        sourceTaskId: source.sourceTaskId,
        sourceTaskNo: source.sourceTaskNo,
        factoryId: source.factoryId,
        enteredUrl: '',
        scannedCode: '',
        actions: [
          actionTemplate('扫码定位加工单', '', false),
          actionTemplate('确认接收-第1批', source.inputUnit, true),
          actionTemplate('确认接收-第2批', source.inputUnit, true),
          actionTemplate('加工填报-第1批', source.outputUnit, true),
          actionTemplate('加工填报-第2批', source.outputUnit, true),
          actionTemplate('发起交出-第1批', source.outputUnit, true),
          actionTemplate('发起交出-第2批', source.outputUnit, true),
          actionTemplate('完成加工单', source.outputUnit, true),
        ],
      }
    }),
  }
}

const template = {
  schemaVersion: 2,
  generatedFrom: fullFlowPath,
  generatedAt: new Date().toISOString(),
  instructions: [
    '这是填写模板，不是通过证据；请另存为 physical-device-evidence.json。',
    `pass-1 与 pass-2 都必须在现实 iData PDA 上完成全部 ${gates.length} 张适用加工单；每轮先重置测试数据。`,
    '每张加工单必须执行两批确认接收、两批加工填报、两批发起交出和一次完成；扫码与每个业务动作都要单独留证。',
    '扫码定位是非写入导航证据，必须填写扫码值、进入 URL、识别前后状态、操作人、时间和照片；不伪造业务动作记录 ID。',
    '其余七个业务动作都必须填写业务记录 ID、状态前后、实际数量、单位、操作人、时间和当前轮实机照片；完成加工单的数量填写完成确认时显示的最终累计数量。',
    '照片必须是本机可读取的真实文件路径；桌面浏览器小屏截图不能替代实机照片。',
  ],
  runs: [runTemplate('pass-1'), runTemplate('pass-2')],
}

mkdirSync(root, { recursive: true })
const outputPath = resolve(root, 'physical-device-evidence.template.json')
writeFileSync(outputPath, `${JSON.stringify(template, null, 2)}\n`)
console.log(`现实 PDA 双轮证据模板已生成：${outputPath}`)
