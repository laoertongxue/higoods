import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const designPath = path.join(root, 'docs/product-design/PCS生产工程管理总体设计文档.md')
const planPath = path.join(root, 'docs/product-design/PCS生产工程管理实施计划.md')
const matrixPath = path.join(root, 'docs/product-design/PCS生产工程管理需求追踪与交付矩阵.md')
const allowIncomplete = process.argv.includes('--allow-incomplete')
const allowedStatuses = new Set(['待实施', '实施中', '已实现待验证', '已验证', '已阻塞', '不适用'])

for (const filePath of [designPath, planPath, matrixPath]) {
  if (!fs.existsSync(filePath)) throw new Error(`缺少交付文档：${path.relative(root, filePath)}`)
}

const design = fs.readFileSync(designPath, 'utf8')
const plan = fs.readFileSync(planPath, 'utf8')
const matrix = fs.readFileSync(matrixPath, 'utf8')

function parseMarkdownRow(line: string): string[] {
  return line.slice(1, -1).split('|').map((cell) => cell.trim())
}

const atomicRows = matrix
  .split('\n')
  .filter((line) => /^\| PCS-[A-Z]+-\d{3} \|/.test(line))
  .map((line) => {
    const cells = parseMarkdownRow(line)
    if (cells.length !== 7) throw new Error(`原子需求列数错误：${cells[0] ?? line}`)
    const [id, , , wp, , , status] = cells
    if (!/^PCS-[A-Z]+-\d{3}$/.test(id)) throw new Error(`无效需求 ID：${id}`)
    if (!/^WP\d{2}$/.test(wp)) throw new Error(`${id} 缺少有效工作包：${wp}`)
    if (!allowedStatuses.has(status)) throw new Error(`${id} 状态无效：${status}`)
    return { id, wp, status }
  })

const ids = atomicRows.map((row) => row.id)
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index)
const unfinished = atomicRows.filter((row) => !['已验证', '不适用'].includes(row.status))

if (atomicRows.length < 500) throw new Error(`原子需求数量不足：当前 ${atomicRows.length} 条`)
if (new Set(ids).size !== ids.length) throw new Error(`存在重复需求 ID：${[...new Set(duplicateIds)].join('、')}`)

const evidenceSection = matrix.match(/## 9\. 实现证据索引([\s\S]*?)## 10\./)?.[1]
if (!evidenceSection) throw new Error('需求矩阵缺少完整实现证据索引')

const evidenceRows = evidenceSection
  .split('\n')
  .filter((line) => /^\| WP\d{2} \|/.test(line))
  .map((line) => {
    const cells = parseMarkdownRow(line)
    if (cells.length !== 6) throw new Error(`实现证据列数错误：${cells[0] ?? line}`)
    const [wp, coverage, implementation, checks, browser, status] = cells
    if (!allowedStatuses.has(status)) throw new Error(`${wp} 证据结论无效：${status}`)
    return { wp, coverage, implementation, checks, browser, status }
  })

const evidenceByWp = new Map(evidenceRows.map((row) => [row.wp, row]))
if (evidenceRows.length !== 12 || evidenceByWp.size !== 12) {
  throw new Error(`实现证据索引必须唯一覆盖 WP01～WP12，当前 ${evidenceByWp.size} 个`)
}

const deliverySection = matrix.match(/## 7\. 实施与交付登记([\s\S]*?)## 8\./)?.[1]
if (!deliverySection) throw new Error('需求矩阵缺少完整实施与交付登记')
const deliveryRows = deliverySection
  .split('\n')
  .filter((line) => /^\| 交付批次 \d{2} \|/.test(line))
  .map((line) => {
    const cells = parseMarkdownRow(line)
    if (cells.length !== 8) throw new Error(`交付登记列数错误：${cells[0] ?? line}`)
    const [batch, scope, implementation, checks, browser, gitVersion, verifier, status] = cells
    const wp = scope.match(/WP\d{2}/)?.[0]
    if (!wp) throw new Error(`${batch} 缺少工作包`)
    if (!allowedStatuses.has(status)) throw new Error(`${batch} 状态无效：${status}`)
    if (![implementation, checks, browser, gitVersion, verifier].every(Boolean)) {
      throw new Error(`${batch} 的实现、检查、场景、版本或验证人证据不完整`)
    }
    return { batch, wp, status }
  })
const deliveryByWp = new Map(deliveryRows.map((row) => [row.wp, row]))
if (deliveryRows.length !== 12 || deliveryByWp.size !== 12) {
  throw new Error(`交付登记必须唯一覆盖 WP01～WP12，当前 ${deliveryByWp.size} 个`)
}

function extractEvidencePaths(value: string): string[] {
  return [...value.matchAll(/`((?:src|scripts|tests|docs)\/[^`]+)`/g)].map((match) => match[1])
}

for (let index = 1; index <= 12; index += 1) {
  const wp = `WP${String(index).padStart(2, '0')}`
  const evidence = evidenceByWp.get(wp)
  if (!evidence) throw new Error(`实现证据索引缺少 ${wp}`)
  const delivery = deliveryByWp.get(wp)
  if (!delivery) throw new Error(`交付登记缺少 ${wp}`)
  if (!evidence.coverage || !evidence.browser) throw new Error(`${wp} 覆盖需求或页面场景证据为空`)
  if (delivery.status !== evidence.status) {
    throw new Error(`${wp} 交付登记与实现证据结论不一致：${delivery.status} / ${evidence.status}`)
  }

  const implementationPaths = extractEvidencePaths(evidence.implementation)
  const checkPaths = extractEvidencePaths(evidence.checks)
  if (!implementationPaths.length) throw new Error(`${wp} 没有登记实际实现文件`)
  if (!checkPaths.length) throw new Error(`${wp} 没有登记自动检查文件`)

  for (const evidencePath of [...implementationPaths, ...checkPaths]) {
    if (!fs.existsSync(path.join(root, evidencePath))) {
      throw new Error(`${wp} 证据文件不存在：${evidencePath}`)
    }
  }

  const wpRequirements = atomicRows.filter((row) => row.wp === wp)
  const wpUnfinished = wpRequirements.filter((row) => !['已验证', '不适用'].includes(row.status))
  if (wpUnfinished.length && evidence.status === '已验证') {
    throw new Error(`${wp} 仍有 ${wpUnfinished.length} 条未闭环需求，证据结论不得标记已验证`)
  }
  if (!wpUnfinished.length && evidence.status !== '已验证') {
    throw new Error(`${wp} 所有需求已闭环，但证据结论仍为 ${evidence.status}`)
  }
}

if (unfinished.length && !allowIncomplete) {
  throw new Error(`仍有 ${unfinished.length} 条需求未闭环：${unfinished.slice(0, 8).map((row) => row.id).join('、')}`)
}

const requiredDesignPhrases = [
  '工程主单是执行线，生产准备时效是只读记录和统计线',
  '同一款式只允许存在一张未关闭的工程主单',
  '我的工程任务',
  'BOM 与价格',
  '工程变更任务',
]
for (const phrase of requiredDesignPhrases) {
  if (!design.includes(phrase)) throw new Error(`总体设计缺少关键口径：${phrase}`)
}
if (/^- \[ \]/m.test(design)) throw new Error('总体设计仍有未完成验收项')
if (!plan.includes('## 22. 实际实施完成登记')) throw new Error('实施计划缺少实际完成登记')

const incompleteSummary = unfinished.length ? `, ${unfinished.length} incomplete allowed` : ''
console.log(`check-pcs-engineering-delivery-matrix PASS (${atomicRows.length} requirements, ${new Set(ids).size} unique${incompleteSummary})`)
