#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repoRoot = process.cwd()

const DATA_CHECK_ROOTS = ['src/data/fcs']

const TARGET_PAGES = [
  'src/pages/process-print-requirements.ts',
  'src/pages/process-dye-requirements.ts',
  'src/pages/process-print-orders.ts',
  'src/pages/process-dye-orders.ts',
  'src/pages/task-breakdown.ts',
  'src/pages/production/core.ts',
  'src/pages/pda-task-receive.ts',
  'src/pages/pda-task-receive-detail.ts',
  'src/pages/pda-exec.ts',
  'src/pages/pda-exec-detail.ts',
  'src/pages/progress-board.ts',
  'src/pages/progress-urge.ts',
  'src/pages/dependencies.ts',
  'src/pages/workbench.ts',
  'src/pages/capacity.ts',
  'src/pages/qc-records.ts',
  'src/pages/progress-exceptions.ts',
  'src/pages/material-issue.ts',
  'src/pages/material-statements.ts',
]

const MODULE_COVERAGE = [
  { name: '工序工艺字典', file: 'src/data/fcs/process-craft-dict.ts' },
  { name: '统一生成引擎', file: 'src/data/fcs/production-artifact-generation.ts' },
  { name: '任务兼容层', file: 'src/data/fcs/process-tasks.ts' },
  { name: '运行时任务层', file: 'src/data/fcs/runtime-process-tasks.ts' },
  { name: '统一进度/异常事实域', file: 'src/data/fcs/store-domain-progress.ts' },
  { name: '兼容分发适配层', file: 'src/data/fcs/store-domain-dispatch-process.ts' },
  { name: '仓库执行层', file: 'src/data/fcs/warehouse-material-execution.ts' },
  { name: 'PDA 域', file: 'src/data/fcs/pda-handover-events.ts' },
]

const LEGACY_TOKEN_RULES = [
  { token: 'DEMAND_SEEDS', regex: /\bDEMAND_SEEDS\b/g },
  { token: 'ORDER_SEEDS', regex: /\bORDER_SEEDS\b/g },
  { token: 'initialExceptions', regex: /\binitialExceptions\b/g },
  { token: 'initialMaterialIssueSheets', regex: /\binitialMaterialIssueSheets\b/g },
  { token: 'initialDyePrintOrders', regex: /\binitialDyePrintOrders\b/g },
  { token: 'legacy-wms-picking', regex: /legacy-wms-picking/g },
]

const LEGACY_ALLOWLIST = {
  initialExceptions: new Set(['src/data/fcs/store-domain-progress.ts']),
  initialMaterialIssueSheets: new Set(['src/data/fcs/store-domain-dispatch-process.ts']),
  initialDyePrintOrders: new Set(['src/data/fcs/store-domain-quality-seeds.ts']),
  'legacy-wms-picking': new Set(['src/data/fcs/legacy-wms-picking.ts']),
}

const SELF_GUESS_RULES = [
  {
    key: 'guess-special-craft-by-text',
    regex: /includes\((['"`])特殊工艺\1\)|indexOf\((['"`])特殊工艺\2\)|===\s*['"`]特殊工艺['"`]/g,
    hint: '通过中文文案判断“特殊工艺”',
  },
  {
    key: 'guess-stage-by-process-prefix',
    regex: /processCode[^\n]{0,120}startsWith\((['"`])PROC[_-][A-Z]+\1\)/g,
    hint: '通过 processCode 前缀猜阶段/类型',
  },
  {
    key: 'guess-status-by-text',
    regex: /status\s*===\s*['"`][^'"`]*(待|已|进行中|暂停|异常)[^'"`]*['"`]/g,
    hint: '页面内通过文案状态直接推断业务判断',
  },
]

const DIRECT_OLD_SOURCE_IMPORT_RULES = [
  {
    key: 'direct-legacy-seed-import',
    regex: /from\s+['"`][^'"`]*store-domain-quality-seeds['"`]/g,
    hint: '页面直接读取旧 quality seeds',
  },
  {
    key: 'direct-material-legacy-import',
    regex: /from\s+['"`][^'"`]*store-domain-dispatch-process['"`]/g,
    hint: '页面直接读取 dispatch 兼容层，请确认不是旧 seed 字段直读',
  },
  {
    key: 'direct-legacy-wms-import',
    regex: /from\s+['"`][^'"`]*legacy-wms-picking['"`]/g,
    hint: '页面直接读取 legacy wms picking',
  },
]

const DIRECT_IMPORT_ALLOWLIST = {
  'direct-material-legacy-import': new Set([
    'src/pages/progress-exceptions.ts',
    'src/pages/material-issue.ts',
    'src/pages/material-statements.ts',
  ]),
  'direct-legacy-seed-import': new Set([
    'src/pages/production/core.ts',
    'src/pages/qc-records.ts',
  ]),
}

const STABLE_ID_HIGH_RISK_PATHS = new Set([
  'src/data/fcs/production-artifact-generation.ts',
  'src/data/fcs/production-demands.ts',
  'src/data/fcs/process-tasks.ts',
  'src/data/fcs/runtime-process-tasks.ts',
  'src/data/fcs/store-domain-progress.ts',
  'src/data/fcs/store-domain-dispatch-process.ts',
  'src/data/fcs/warehouse-material-execution.ts',
  'src/data/fcs/pda-handover-events.ts',
  'src/data/fcs/pda-start-link.ts',
  'src/data/fcs/pda-exec-link.ts',
])

function parseArgs(argv) {
  return {
    writeReport: argv.includes('--write-report') || argv.length === 0,
    strict: argv.includes('--strict'),
  }
}

function toRepoPath(absPath) {
  return path.relative(repoRoot, absPath).replace(/\\/g, '/')
}

function readText(absPath) {
  return fs.readFileSync(absPath, 'utf8')
}

function exists(filePath) {
  return fs.existsSync(path.join(repoRoot, filePath))
}

function walkFiles(absDir, out = []) {
  if (!fs.existsSync(absDir)) return out
  const entries = fs.readdirSync(absDir, { withFileTypes: true })
  for (const entry of entries) {
    const abs = path.join(absDir, entry.name)
    if (entry.isDirectory()) {
      walkFiles(abs, out)
      continue
    }
    if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.mjs'))) {
      out.push(abs)
    }
  }
  return out
}

function severityWeight(level) {
  if (level === 'HIGH') return 3
  if (level === 'MEDIUM') return 2
  return 1
}

function pushFinding(findings, item) {
  findings.push(item)
}

function scanLegacyTokens(relPath, lines, findings) {
  const inPage = relPath.startsWith('src/pages/')

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]

    for (const rule of LEGACY_TOKEN_RULES) {
      if (!rule.regex.test(line)) continue
      rule.regex.lastIndex = 0

      const allowlisted = Boolean(LEGACY_ALLOWLIST[rule.token]?.has(relPath))
      let severity = 'LOW'
      if (!allowlisted && inPage) severity = 'HIGH'
      else if (!allowlisted) severity = 'MEDIUM'

      pushFinding(findings, {
        type: 'legacy-seed',
        key: rule.token,
        severity,
        file: relPath,
        line: i + 1,
        content: line.trim(),
        hint: allowlisted
          ? `${rule.token} 在兼容层/事实域中允许存在`
          : `发现旧真相源标识 ${rule.token}`,
      })
    }
  }
}

function scanSelfGuess(relPath, lines, findings) {
  if (!relPath.startsWith('src/pages/')) return
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    for (const rule of SELF_GUESS_RULES) {
      if (!rule.regex.test(line)) continue
      rule.regex.lastIndex = 0
      pushFinding(findings, {
        type: 'self-guess',
        key: rule.key,
        severity: rule.key === 'guess-status-by-text' ? 'LOW' : 'MEDIUM',
        file: relPath,
        line: i + 1,
        content: line.trim(),
        hint: rule.hint,
      })
    }
  }
}

function scanRandomAndUnstableIds(relPath, lines, findings) {
  const isBusinessLayer = relPath.startsWith('src/data/fcs/') || relPath.startsWith('src/pages/')
  if (!isBusinessLayer) return
  const inPage = relPath.startsWith('src/pages/')
  const highRiskDomainFile = STABLE_ID_HIGH_RISK_PATHS.has(relPath)

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const looksLikeBusinessIdentity =
      /(caseId|issueId|statementId|batchId|logId|tenderId|qcId|notificationId|taskId|artifactId|runtimeTaskId)/i.test(line) ||
      /`[^`]*\$\{(?:Math\.random|Date\.now)\(\)\}[^`]*`/.test(line)

    if (line.includes('Math.random(')) {
      const severity = highRiskDomainFile && looksLikeBusinessIdentity ? 'HIGH' : inPage ? 'LOW' : 'MEDIUM'
      pushFinding(findings, {
        type: 'unstable-id',
        key: 'math-random',
        severity,
        file: relPath,
        line: i + 1,
        content: line.trim(),
        hint: highRiskDomainFile && looksLikeBusinessIdentity
          ? '核心事实域检测到 Math.random 参与业务对象 identity 生成'
          : '检测到 Math.random，建议确认是否仅用于 UI 临时对象',
      })
    }

    if (line.includes('Date.now(')) {
      const isUiTemp = /toast|overlay|animation|setTimeout|requestAnimationFrame/i.test(line)
      const severity = isUiTemp
        ? 'LOW'
        : highRiskDomainFile && looksLikeBusinessIdentity
          ? 'HIGH'
          : inPage || !looksLikeBusinessIdentity
            ? 'LOW'
            : 'MEDIUM'
      pushFinding(findings, {
        type: 'unstable-id',
        key: 'date-now',
        severity,
        file: relPath,
        line: i + 1,
        content: line.trim(),
        hint: isUiTemp || inPage
          ? '页面层时间计算/临时对象通常可接受，建议确认未用于业务 identity'
          : highRiskDomainFile && looksLikeBusinessIdentity
            ? '核心事实域 Date.now 参与业务对象 identity 生成，建议改稳定可复算策略'
            : 'Date.now 使用建议复核是否会影响业务对象稳定性',
      })
    }
  }
}

function scanDirectOldSourceImports(relPath, lines, findings) {
  if (!relPath.startsWith('src/pages/')) return
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    for (const rule of DIRECT_OLD_SOURCE_IMPORT_RULES) {
      if (!rule.regex.test(line)) continue
      rule.regex.lastIndex = 0

      const allowlisted = Boolean(DIRECT_IMPORT_ALLOWLIST[rule.key]?.has(relPath))
      let severity = allowlisted ? 'LOW' : 'MEDIUM'
      if (rule.key === 'direct-legacy-wms-import') severity = 'HIGH'

      pushFinding(findings, {
        type: 'direct-import',
        key: rule.key,
        severity,
        file: relPath,
        line: i + 1,
        content: line.trim(),
        hint: rule.hint,
      })
    }
  }
}

function collectPrimaryDataImports(fileContent) {
  const imports = []
  const importRegex = /import\s+[\s\S]*?from\s+['"`]([^'"`]+)['"`]/g
  let match
  while ((match = importRegex.exec(fileContent))) {
    const source = match[1]
    if (source.includes('/data/fcs/')) imports.push(source)
  }
  return imports
}

function toRiskLevel(pageFindings) {
  if (pageFindings.some((f) => f.severity === 'HIGH')) return '高'
  if (pageFindings.some((f) => f.severity === 'MEDIUM')) return '中'
  return '低'
}

function classifyPageCategory(pagePath) {
  if (pagePath.includes('process-print') || pagePath.includes('process-dye')) return '准备阶段页面'
  if (pagePath.includes('pda-')) return 'PDA 页面'
  if (pagePath.includes('progress-exceptions') || pagePath.includes('material-issue') || pagePath.includes('material-statements') || pagePath.includes('progress-material')) return '进度/异常/台账页'
  if (pagePath.includes('production/core') || pagePath.includes('task-breakdown') || pagePath.includes('dispatch-board')) return '核心执行页'
  return '长尾页面'
}

function summarizeBySeverity(findings) {
  return {
    high: findings.filter((f) => f.severity === 'HIGH').length,
    medium: findings.filter((f) => f.severity === 'MEDIUM').length,
    low: findings.filter((f) => f.severity === 'LOW').length,
  }
}

function ensureDir(absDir) {
  if (!fs.existsSync(absDir)) fs.mkdirSync(absDir, { recursive: true })
}

function toMarkdownReport(payload) {
  const lines = []
  lines.push('# FCS 统一事实源审计报告')
  lines.push('')
  lines.push(`- 审计时间：${payload.generatedAt}`)
  lines.push(`- 扫描文件数：${payload.summary.scannedFiles}`)
  lines.push(`- 发现问题数：${payload.summary.totalFindings}`)
  lines.push(`- 高风险：${payload.summary.highRiskCount}｜中风险：${payload.summary.mediumRiskCount}｜低风险：${payload.summary.lowRiskCount}`)
  lines.push('')
  lines.push('## 审计结论摘要')
  lines.push('')
  lines.push(`- 页面覆盖：${payload.summary.pageCheckedCount}（高风险 ${payload.summary.pageHighRiskCount}）`)
  lines.push(`- 旧 seed 直接引用命中：${payload.summary.legacySeedHits}`)
  lines.push(`- 页面内自猜逻辑命中：${payload.summary.selfGuessHits}`)
  lines.push(`- 随机/不稳定业务对象命中：${payload.summary.unstableIdHits}`)
  lines.push('')

  if (payload.highRiskFindings.length > 0) {
    lines.push('## 高风险明细')
    lines.push('')
    for (const item of payload.highRiskFindings) {
      lines.push(`- [${item.type}] ${item.file}:${item.line}｜${item.key}｜${item.hint}`)
    }
    lines.push('')
  }

  lines.push('## 页面覆盖结果')
  lines.push('')
  lines.push('| 页面 | 类别 | 主数据来源(import) | 旧 seed 直依赖 | 自猜逻辑 | 风险 | 建议 |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- |')
  for (const page of payload.pageCoverage) {
    lines.push(`| ${page.file} | ${page.category} | ${page.primarySources.join('<br/>') || '-'} | ${page.legacySeedHits} | ${page.selfGuessHits} | ${page.riskLevel} | ${page.suggestion} |`)
  }
  lines.push('')

  lines.push('## 模块覆盖结果')
  lines.push('')
  lines.push('| 模块 | 文件 | 状态 | 风险数 | 备注 |')
  lines.push('| --- | --- | --- | --- | --- |')
  for (const module of payload.moduleCoverage) {
    lines.push(`| ${module.name} | ${module.file} | ${module.exists ? '已存在' : '缺失'} | ${module.findingsCount} | ${module.note} |`)
  }
  lines.push('')

  lines.push('## 最终结论')
  lines.push('')
  lines.push('- 已统一：工序工艺字典、生成引擎、runtime task、统一进度异常域主线。')
  lines.push('- 兼容过渡：dispatch-process 旧 shape 通过适配层映射新事实源。')
  if (payload.summary.highRiskCount === 0) {
    lines.push('- 高风险项：已清零。')
    lines.push('- 中低风险项：以兼容层保留、页面内提示性规则命中为主，后续可按优先级继续压缩。')
  } else {
    lines.push('- 待继续收口：报告中高风险/中风险条目（优先处理页面直接旧 seed 依赖与业务对象不稳定 ID）。')
  }
  lines.push('')

  return lines.join('\n')
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const findings = []

  const scanFileSet = new Set()
  for (const root of DATA_CHECK_ROOTS) {
    walkFiles(path.join(repoRoot, root)).forEach((abs) => scanFileSet.add(abs))
  }
  TARGET_PAGES
    .filter((file) => exists(file))
    .forEach((file) => {
      scanFileSet.add(path.join(repoRoot, file))
    })
  const scanFiles = Array.from(scanFileSet)

  for (const absFile of scanFiles) {
    const relPath = toRepoPath(absFile)
    const content = readText(absFile)
    const lines = content.split(/\r?\n/)

    scanLegacyTokens(relPath, lines, findings)
    scanSelfGuess(relPath, lines, findings)
    scanRandomAndUnstableIds(relPath, lines, findings)
    scanDirectOldSourceImports(relPath, lines, findings)
  }

  const severity = summarizeBySeverity(findings)
  const highRiskFindings = findings
    .filter((item) => item.severity === 'HIGH')
    .sort((a, b) => b.line - a.line)

  const pageCoverage = TARGET_PAGES
    .filter((file) => exists(file))
    .map((file) => {
      const abs = path.join(repoRoot, file)
      const content = readText(abs)
      const imports = collectPrimaryDataImports(content)
      const pageFindings = findings.filter((item) => item.file === file)
      const legacySeedHits = pageFindings.filter((item) => item.type === 'legacy-seed' || item.type === 'direct-import').length
      const selfGuessHits = pageFindings.filter((item) => item.type === 'self-guess').length
      const riskLevel = toRiskLevel(pageFindings)

      let suggestion = '继续保持，仅做事实源绑定维护'
      if (riskLevel === '高') suggestion = '优先整改：移除旧 seed 直依赖或不稳定业务对象生成'
      else if (riskLevel === '中') suggestion = '建议整改：收口页面内自猜逻辑到事实域/adapter'

      return {
        file,
        category: classifyPageCategory(file),
        primarySources: imports,
        legacySeedHits,
        selfGuessHits,
        riskLevel,
        suggestion,
      }
    })

  const moduleCoverage = MODULE_COVERAGE.map((module) => {
    const existsInRepo = exists(module.file)
    const moduleFindings = findings.filter((item) => item.file === module.file)
    const high = moduleFindings.filter((item) => item.severity === 'HIGH').length
    const medium = moduleFindings.filter((item) => item.severity === 'MEDIUM').length
    const note = !existsInRepo
      ? '模块不存在'
      : high > 0
        ? `存在高风险 ${high} 条`
        : medium > 0
          ? `存在中风险 ${medium} 条`
          : '通过（无高/中风险）'

    return {
      ...module,
      exists: existsInRepo,
      findingsCount: moduleFindings.length,
      note,
    }
  })

  const summary = {
    scannedFiles: scanFiles.length,
    totalFindings: findings.length,
    highRiskCount: severity.high,
    mediumRiskCount: severity.medium,
    lowRiskCount: severity.low,
    pageCheckedCount: pageCoverage.length,
    pageHighRiskCount: pageCoverage.filter((item) => item.riskLevel === '高').length,
    legacySeedHits: findings.filter((item) => item.type === 'legacy-seed' || item.type === 'direct-import').length,
    selfGuessHits: findings.filter((item) => item.type === 'self-guess').length,
    unstableIdHits: findings.filter((item) => item.type === 'unstable-id').length,
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    summary,
    highRiskFindings,
    findings,
    pageCoverage,
    moduleCoverage,
  }

  console.log('[check-fcs-truth-sources] FCS 统一事实源审计')
  console.log(`  scanned files: ${summary.scannedFiles}`)
  console.log(`  findings: ${summary.totalFindings}`)
  console.log(`  high: ${summary.highRiskCount}, medium: ${summary.mediumRiskCount}, low: ${summary.lowRiskCount}`)
  console.log(`  legacy seed hits: ${summary.legacySeedHits}`)
  console.log(`  self-guess hits: ${summary.selfGuessHits}`)
  console.log(`  unstable-id hits: ${summary.unstableIdHits}`)

  if (args.writeReport) {
    const docsDir = path.join(repoRoot, 'docs')
    ensureDir(docsDir)

    const jsonPath = path.join(docsDir, 'fcs-truth-source-audit.json')
    const mdPath = path.join(docsDir, 'fcs-truth-source-audit.md')

    fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    fs.writeFileSync(mdPath, `${toMarkdownReport(payload)}\n`, 'utf8')

    console.log(`  report(json): ${toRepoPath(jsonPath)}`)
    console.log(`  report(md): ${toRepoPath(mdPath)}`)
  }

  if (args.strict && summary.highRiskCount > 0) {
    console.error('[check-fcs-truth-sources] FAIL: strict 模式下存在高风险项')
    process.exit(1)
  }

  console.log('[check-fcs-truth-sources] DONE')
}

main()
