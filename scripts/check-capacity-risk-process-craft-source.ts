import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildCapacityRiskData } from '../src/data/fcs/capacity-calendar.ts'
import {
  getActiveCraftOptionsByProcess,
  getActiveProcessCraftRows,
  getActiveProcessOptions,
  resolveProcessCraft,
} from '../src/data/fcs/process-craft-dict.ts'
import {
  includesRemovedPseudoCraft,
  removedLegacyCraftNames,
  removedLegacyProcessCodes,
} from './utils/special-craft-banlist.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PAGE_PATH = path.join(ROOT, 'src/pages/capacity.ts')
const DATA_PATH = path.join(ROOT, 'src/data/fcs/capacity-calendar.ts')
const PACKAGE_PATH = path.join(ROOT, 'package.json')

function read(absolutePath: string): string {
  return fs.readFileSync(absolutePath, 'utf8')
}

function joinText(parts: string[]): string {
  return parts.join('')
}

function main(): void {
  const pageSource = read(PAGE_PATH)
  const dataSource = read(DATA_PATH)
  const packageSource = read(PACKAGE_PATH)
  const riskData = buildCapacityRiskData()
  const removedCraftNameSet = new Set(removedLegacyCraftNames)

  const riskSectionMatch = pageSource.match(/export function renderCapacityRiskPage\(\): string \{[\s\S]*?function filterBottleneckCraftRows/)
  assert(riskSectionMatch, '未找到任务工时风险页面渲染函数')
  const riskSection = riskSectionMatch[0]

  assert(!/const\s+processOptions\s*=\s*\[/.test(riskSection), '任务工时风险页仍存在页面本地硬编码 processOptions 数组')
  assert(!/const\s+craftOptions\s*=\s*\[/.test(riskSection), '任务工时风险页仍存在页面本地硬编码 craftOptions 数组')
  assert(dataSource.includes('getActiveProcessOptions()'), '任务工时风险工序下拉未从工序工艺字典 helper 生成')
  assert(dataSource.includes('getActiveCraftOptionsByProcess()'), '任务工时风险工艺下拉未从工序工艺字典 helper 生成')
  assert(dataSource.includes('assertProcessCraftExists('), '任务工时风险数据未在构建时校验工序工艺字典')
  assert(
    riskSection.includes('state.riskProcessCode ? item.processCode === state.riskProcessCode : true'),
    '任务工时风险页切换工序后，工艺下拉未限定为当前工序',
  )
  assert(
    /filter === 'risk-process-code'[\s\S]*?state\.riskProcessCode = value[\s\S]*?state\.riskCraftCode = ''/.test(pageSource),
    '任务工时风险页切换工序后未重置工艺筛选',
  )

  const activeProcessMap = new Map(getActiveProcessOptions().map((item) => [item.processCode, item.processName] as const))
  const activeCraftMap = new Map(getActiveProcessCraftRows().map((item) => [item.processCraftKey, item.processCraftLabel] as const))

  assert(
    riskData.processOptions.every((option) => activeProcessMap.get(option.value) === option.label),
    '任务工时风险工序筛选项存在工序工艺字典之外的值',
  )
  assert(
    riskData.craftOptions.every((option) => activeCraftMap.get(option.value) === option.label),
    '任务工时风险工艺筛选项存在工序工艺字典之外的值',
  )

  for (const processOption of riskData.processOptions) {
    const allowedCraftKeys = new Set(
      getActiveCraftOptionsByProcess(processOption.value).map((item) => item.processCraftKey),
    )
    const scopedCraftOptions = riskData.craftOptions.filter((item) => item.processCode === processOption.value)
    assert(
      scopedCraftOptions.every((item) => allowedCraftKeys.has(item.value)),
      `任务工时风险在工序 ${processOption.label} 下仍展示了字典外工艺`,
    )
  }

  assert(
    riskData.taskRows.every((row) => Boolean(row.processCode)),
    '任务工时风险数据存在缺少 processCode 的行',
  )
  assert(
    riskData.taskRows.every((row) => Boolean(row.craftCode)),
    '任务工时风险数据存在缺少 craftCode 的行',
  )
  assert(
    riskData.taskRows.every((row) => {
      const resolved = resolveProcessCraft(row.processCode, row.craftCode)
      return resolved
        && resolved.processName === row.processName
        && resolved.craftName === row.craftName
    }),
    '任务工时风险列表中的工序 / 工艺显示名未完全来自工序工艺字典',
  )
  assert(
    !riskData.taskRows.some((row) => row.processCode === 'POST_FINISHING' && row.craftCode === 'POST_FINISHING'),
    '任务工时风险中仍存在“后道 / 后道”自造组合',
  )
  assert(
    !riskData.taskRows.some((row) =>
      row.processCode === 'WASHING'
      || removedLegacyProcessCodes.includes(row.processCode)
      || removedCraftNameSet.has(row.craftName)
    ),
    '任务工时风险中仍存在已删除旧口径',
  )

  ;[
    '打印机编号',
    '打印速度',
    '完成量',
    '待送货量',
    '待审核量',
    '染缸编号',
    '染缸容量',
    '节点等待',
    '排染缸',
  ].forEach((token) => {
    assert(!riskSection.includes(token), `任务工时风险页仍展示专属细维度：${token}`)
  })

  assert(!includesRemovedPseudoCraft(riskSection), '任务工时风险页仍硬编码已删除伪特殊工艺')
  assert(!riskSection.includes('裁片 - 定位裁'), '任务工时风险页仍保留“裁片 - 定位裁”固定样例')

  assert(!new RegExp([String.raw`\b${joinText(['axi', 'os'])}\b`, String.raw`(^|[^\w])${joinText(['fet', 'ch\\('])}`, String.raw`\b${joinText(['api', 'Client'])}\b`, joinText(['/', 'api', '/'])].join('|')).test(pageSource + dataSource), '本次范围内出现 API 改造')
  assert(!new RegExp([String.raw`\b${joinText(['i1', '8n'])}\b`, String.raw`\b${joinText(['use', 'Translation'])}\b`, String.raw`\b${joinText(['loc', 'ales'])}\b`, String.raw`\b${joinText(['trans', 'lations'])}\b`].join('|')).test(pageSource + dataSource + packageSource), '本次范围内出现多语言改造')
  assert(!new RegExp([
    joinText(['库存', '三态']),
    joinText(['库位', '上架']),
    joinText(['拣货', '波次']),
    joinText(['完整', '入库']),
    joinText(['WMS', '入库']),
    joinText(['AI', '排程']),
    joinText(['自动', '排程']),
  ].join('|')).test(pageSource + dataSource + packageSource), '本次范围内出现 WMS / AI 排程越界')

  console.log('任务工时风险工序工艺来源检查通过：筛选、列表与风险数据均已收口到工序工艺字典。')
}

main()
