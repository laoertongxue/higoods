import assert from 'node:assert/strict'
import { posix } from 'node:path'

export interface ReviewRecordSource {
  path: string
  source: string
}

export interface PrototypeReviewCoverage {
  coveredPaths: string[]
  recordPaths: string[]
  technicalOnlyPaths: string[]
  userVisiblePaths: string[]
  lightweightPaths: string[]
}

type ReviewMode = '完整产品审查' | '轻量可见变更' | '无用户可见影响声明'
type ImpactKind = 'technical-only' | 'user-visible'
interface Section { title: string; level: number; body: string }
interface ParsedReviewRecord {
  path: string
  source: string
  sections: Section[]
  managedFiles: string[]
  impact: ImpactKind
  mode: ReviewMode
  verification: Array<{ command: string; passed: boolean }>
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').trim()
}

// Examples in fenced blocks are not declarations or evidence for the current record.
function withoutCodeBlocks(source: string): string {
  let fence = ''
  return source.replace(/<!--[\s\S]*?(?:-->|$)/g, '').split(/\r?\n/).map((line) => {
    const marker = /^[ \t]*(`{3,}|~{3,})/.exec(line)?.[1]
    if (marker && !fence) { fence = marker; return '' }
    if (fence) {
      if (marker?.[0] === fence[0] && marker.length >= fence.length) fence = ''
      return ''
    }
    // Metadata and evidence in indented Markdown code are examples, not declarations.
    if (/^(?: {4}| {0,3}\t)/.test(line)) return ''
    return line
  }).join('\n')
}

function parseSections(source: string): Section[] {
  const lines = source.split('\n')
  const headings = lines.flatMap((line, index) => {
    const match = /^(#{2,3})[ \t]+(?:\d+(?:\.\d+)*[.、]?[ \t]+)?(.+?)[ \t]*$/.exec(line)
    return match ? [{ title: match[2], level: match[1].length, index }] : []
  })
  return headings.map((heading, index) => {
    const end = headings.slice(index + 1).find((next) => next.level <= heading.level)?.index ?? lines.length
    return { title: heading.title, level: heading.level, body: lines.slice(heading.index + 1, end).join('\n').trim() }
  })
}

function readSection(sections: Section[], title: string): string {
  const matches = sections.filter((section) => section.title === title)
  assert(matches.length <= 1, `${title} 重复，不能用首个章节掩盖冲突`)
  return matches[0]?.body ?? ''
}

function readField(section: string, name: string, allowPlain = false): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Only horizontal whitespace is allowed; an empty field must not consume the next line.
  const prefix = allowPlain ? '(?:-[ \\t]*)?' : '-[ \\t]*'
  const matches = [...section.matchAll(new RegExp(`^[ \\t]*${prefix}${escaped}[：:][ \\t]*(.*)$`, 'gm'))]
  assert(matches.length <= 1, `${name} 重复，不能用首个值掩盖冲突`)
  return matches[0]?.[1]?.trim() ?? ''
}

function readCodeList(section: string): string[] {
  return section.split('\n').map((line) => /^-[ \t]+`([^`]+)`[ \t]*$/.exec(line.trim())?.[1] ?? '')
    .map(normalizePath).filter(Boolean)
}

const TEMPLATE_VALUES = new Set([
  '分支 / HEAD + 未提交差异哈希、服务 / 工作树、设备 / 视口、实际运行资产',
  '命名路由、实际动作、结果、截图或日志位置；复用证据保留原版本并说明理由',
  '范围、原始样本位置及版本；或为何没有影响初始化、布局成本、事件链',
  '实际对象与命名路由', '具体文字或样式', '未变化的行为、数据及路由契约',
  '实际页面操作和布局核验方法', '实际执行者；不代填用户接受',
])
function assertUseful(value: string, label: string): void {
  value = value.trim()
  assert(
    value && !/^(?:待填写|待验证|未验证|未运行|待补充|TODO|TBD)/i.test(value)
      && !/^(?:无|N\/?A|不适用|暂无|不涉及|无影响|无变化|不需要|通过|已核对|已检查|同上|略)[。.!！]?$/i.test(value)
      && !TEMPLATE_VALUES.has(value)
      && !/^(?:通过|有|完整产品审查)[ \t]*\//.test(value),
    `${label} 缺少可核验内容或仍是模板待填写说明`,
  )
}

function parseVerification(section: string, path: string): ParsedReviewRecord['verification'] {
  const lines = section.split('\n').map((line) => line.trim()).filter((line) => /^-[ \t]+/.test(line))
  assert(lines.length > 0, `${path} 缺少验证命令`)
  const commands = new Set<string>()
  return lines.map((line) => {
    const match = /^-[ \t]+`([^`]+)`[ \t]*[：:][ \t]*(.+)$/.exec(line)
    assert(match, `${path} 的验证命令缺少明确验证结果：${line}`)
    const [, command, result] = match
    assert(!commands.has(command.trim()), `${path} 验证命令重复；本次结果必须唯一`)
    commands.add(command.trim())
    assertUseful(command, `${path} 验证命令`)
    // Status is an enum. Counts, explanations and source links belong in evidence fields.
    if (result === '通过') return { command, passed: true }
    const notApplicable = /^不适用[ \t]*(?:[（(](.*)[）)]|[：:]([^\n]+))$/.exec(result)
    assert(notApplicable, `${path} 验证未通过或不适用缺少理由：${line}`)
    assertUseful(notApplicable[1] ?? notApplicable[2] ?? '', `${path} 验证不适用理由`)
    return { command, passed: false }
  })
}

function assertBasicInformation(sections: Section[], path: string): void {
  const basic = readSection(sections, '基本信息')
  const date = readField(basic, '日期')
  assertUseful(date, `${path} 基本信息日期`)
  assert(/^[1-9]\d{3}-\d{2}-\d{2}$/.test(date), `${path} 基本信息日期必须为有效 YYYY-MM-DD`)
  const [year, month, day] = date.split('-').map(Number)
  const calendar = new Date(Date.UTC(year, month - 1, day))
  assert(calendar.getUTCFullYear() === year && calendar.getUTCMonth() === month - 1 && calendar.getUTCDate() === day, `${path} 基本信息日期必须为有效 YYYY-MM-DD`)
  assertUseful(readField(basic, '任务 / 需求编号'), `${path} 基本信息任务 / 需求编号`)
  assertUseful(readField(basic, '验证人'), `${path} 基本信息验证人`)
}

function hasCurrentGovernanceReference(record: ParsedReviewRecord): boolean {
  const preface = record.source.split(/^##[ \t]+/m)[0]
  const references = [preface, ...record.sections.filter((section) => ['参考规范', '规范引用'].includes(section.title)).map((section) => section.body)].join('\n')
  if (/(?:^|[^`])`AGENTS\.md`(?!`)/.test(references)) return true
  for (const match of references.matchAll(/\[[^\]\n]*\]\((?:<([^>\n]+)>|([^\s)]+))\)/g)) {
    let target: string
    try { target = decodeURIComponent((match[1] ?? match[2]).split('#')[0]) } catch { continue }
    if (!target || /^(?:[a-z][a-z\d+.-]*:|\/)/i.test(target) || target.includes('?') || target.includes('\\')) continue
    if (posix.normalize(posix.join(posix.dirname(record.path), target)) === 'AGENTS.md') return true
  }
  return false
}

function parseCurrentRecord(record: ReviewRecordSource): ParsedReviewRecord {
  const source = withoutCodeBlocks(record.source)
  const sections = parseSections(source)
  for (const section of sections) readSection(sections, section.title)
  for (const [title, fields] of Object.entries({
    影响判定: ['记录模式', '用户可见影响', '判定依据', '契约变化'],
    页面证据: ['版本', '证据'], 性能结论: ['结论', '依据'], 技术证据: ['对象与结果', '证据'],
    轻量变更: ['对象 / 路由', '改了什么', '保留什么', '如何验证', '结果'],
  })) {
    for (const field of fields) readField(readSection(sections, title), field)
  }
  assertBasicInformation(sections, record.path)
  const impact = readSection(sections, '影响判定')
  const mode = readField(impact, '记录模式')
  assert(['完整产品审查', '轻量可见变更', '无用户可见影响声明'].includes(mode), `${record.path} 本次交付必须明确记录模式，不能省略或使用历史默认模式`)
  const visible = readField(impact, '用户可见影响')
  assert(['有', '无'].includes(visible), `${record.path} 用户可见影响必须明确为有或无`)
  assert.equal(visible === '无', mode === '无用户可见影响声明', `${record.path} 记录模式与用户可见影响不一致`)
  assertUseful(readField(impact, '判定依据'), `${record.path} 影响判定依据`)
  const managedFiles = readCodeList(readSection(sections, '受管文件'))
  assert(managedFiles.length > 0, `${record.path} 缺少受管文件`)
  assert.equal(new Set(managedFiles).size, managedFiles.length, `${record.path} 受管文件重复`)
  return {
    path: normalizePath(record.path), source, sections, managedFiles,
    mode: mode as ReviewMode, impact: visible === '无' ? 'technical-only' : 'user-visible',
    verification: parseVerification(readSection(sections, '验证命令'), record.path),
  }
}

function assertFinalConclusion(record: ParsedReviewRecord, required: boolean): void {
  const section = readSection(record.sections, '最终结论')
  if (!required && !section) return
  assert.equal(readField(section, '结论', true), '通过', `${record.path} 最终结论未通过，不得以不适用或有条件通过关闭交付`)
}

function assertSelfCheck(record: ParsedReviewRecord, required: boolean): void {
  const section = readSection(record.sections, '自查结论')
  if (!required && !section) return
  const tableLines = section.split('\n').filter((line) => /^\|/.test(line.trim()))
  assert(tableLines.every((line) => line.trim().endsWith('|')), `${record.path} 自查表缺少完整行边界`)
  const rows = tableLines.map((line) => line.trim().slice(1, -1).split(/(?<!\\)\|/).map((cell) => cell.trim()))
  const header = rows[0] ?? []
  const resultIndex = header.indexOf('结论')
  const evidenceIndex = header.findIndex((cell) => /证据|说明|问题及处理/.test(cell))
  assert(resultIndex > 0 && evidenceIndex > resultIndex && rows.length >= 3, `${record.path} 缺少有效自查结论表`)
  assert(rows[1].every((cell) => /^:?-+:?$/.test(cell)), `${record.path} 自查表格式不完整`)
  const seen = new Set<string>()
  for (const row of rows.slice(2)) {
    assert.equal(row.length, header.length, `${record.path} 自查行字段不完整`)
    assertUseful(row[0], `${record.path} 自查检查项`)
    assert(!seen.has(row[0]), `${record.path} 自查检查项重复：${row[0]}`)
    seen.add(row[0])
    assert(['通过', '不适用'].includes(row[resultIndex]), `${record.path} 自查存在未通过或待填写项：${row[0]}`)
    assertUseful(row[evidenceIndex], `${record.path} 自查证据或不适用理由：${row[0]}`)
  }
  assert(seen.size > 0, `${record.path} 自查没有实际检查项`)
}

function assertVisibleEvidence(record: ParsedReviewRecord): void {
  const performance = readSection(record.sections, '性能结论')
  assert(['通过', '不适用'].includes(readField(performance, '结论')), `${record.path} 性能未通过或缺少性能结论`)
  assertUseful(readField(performance, '依据'), `${record.path} 性能依据`)
  const page = readSection(record.sections, '页面证据')
  assertUseful(readField(page, '版本'), `${record.path} 页面证据版本 / 环境`)
  assertUseful(readField(page, '证据'), `${record.path} 页面证据`)
}

function assertCurrentRecord(record: ParsedReviewRecord): void {
  const full = record.mode === '完整产品审查'
  assertFinalConclusion(record, full)
  assertSelfCheck(record, full)
  if (record.mode !== '无用户可见影响声明') assertVisibleEvidence(record)
  else {
    const performance = readSection(record.sections, '性能结论')
    if (performance) {
      assert(['通过', '不适用'].includes(readField(performance, '结论')), `${record.path} 性能未通过`)
      assertUseful(readField(performance, '依据'), `${record.path} 性能依据`)
    }
    const technical = readSection(record.sections, '技术证据')
    assertUseful(readField(technical, '对象与结果'), `${record.path} 直接技术验证对象与结果`)
    assertUseful(readField(technical, '证据'), `${record.path} 直接技术验证证据`)
    const governanceOrFormatting = /(?:governance|workflow:|\bgit[ \t]+(?:diff|status|show)\b|\b(?:prettier|eslint)\b|(?:run[ \t]+|:)(?:lint|format)(?:\b|:))/i
    assert(record.verification.some(({ command, passed }) => passed && !governanceOrFormatting.test(command)), `${record.path} 缺少证明渲染、数据、路由或交互结果不变的直接技术验证，不能只用格式或治理自证`)
  }
  if (record.mode === '轻量可见变更') {
    assert.equal(readField(readSection(record.sections, '影响判定'), '契约变化'), '无', `${record.path} 轻量可见变更必须声明契约变化：无`)
    const light = readSection(record.sections, '轻量变更')
    for (const field of ['对象 / 路由', '改了什么', '保留什么', '如何验证']) assertUseful(readField(light, field), `${record.path} ${field}`)
    assert.equal(readField(light, '结果'), '通过', `${record.path} 轻量变更结果未通过`)
  }
  if (full) {
    assert(hasCurrentGovernanceReference(record), `${record.path} 缺少 AGENTS.md 当前治理基线引用；须在模板头或规范引用节精确引用根文件`)
    const exceptions = readSection(record.sections, '例外').split('\n').filter((line) => /^-[ \t]+/.test(line.trim())).map((line) => line.trim().replace(/^-[ \t]+/, ''))
    assert(exceptions.length > 0, `${record.path} 缺少例外说明；无例外时填写“- 无”`)
    for (const exception of exceptions) if (exception !== '无') assertUseful(exception, `${record.path} 例外`)
    assert(!exceptions.includes('无') || exceptions.length === 1, `${record.path} 例外不能同时声明无与具体例外`)
  }
}

/** Read-only historical metadata, never a coverage or acceptance result. */
export function parseHistoricalPrototypeReviewRecord(record: ReviewRecordSource): {
  path: string; managedFiles: string[]; declaredModes: string[]; historicalOnly: true
} {
  const sections = parseSections(withoutCodeBlocks(record.source))
  return {
    path: normalizePath(record.path),
    managedFiles: [...new Set(sections.filter((section) => section.title === '受管文件').flatMap((section) => readCodeList(section.body)))],
    declaredModes: sections.filter((section) => section.title === '影响判定').flatMap((section) => [...section.body.matchAll(/^-[ \t]*记录模式[：:][ \t]*(.*)$/gm)].map((match) => match[1].trim()).filter(Boolean)),
    historicalOnly: true,
  }
}

/** Strict current-delivery validation. Historical records cannot opt out of current requirements. */
export function validatePrototypeReviewCoverage(
  prototypeChanges: string[],
  recordSources: ReviewRecordSource[],
): PrototypeReviewCoverage {
  const changedPaths = [...new Set(prototypeChanges.map(normalizePath))].sort()
  const changed = new Set(changedPaths)
  // Historical records outside this task are not forced to adopt the current schema.
  const relevantSources = recordSources.filter((record) => parseHistoricalPrototypeReviewRecord(record).managedFiles.some((path) => changed.has(path)))
  assert.equal(new Set(relevantSources.map((record) => normalizePath(record.path))).size, relevantSources.length, '同一路径的审查记录重复，不能用首份记录掩盖冲突')
  const records = relevantSources.map(parseCurrentRecord)
  const usedRecords = new Map<string, ParsedReviewRecord>()
  const technicalOnlyPaths: string[] = []
  const userVisiblePaths: string[] = []
  const lightweightPaths: string[] = []
  for (const changedPath of changedPaths) {
    const matching = records.filter((record) => record.managedFiles.includes(changedPath))
    const record = matching[0]
    assert(record, `${changedPath} 没有关联的影响声明或原型审查记录；记录必须在“受管文件”中明确列出该文件`)
    assert(matching.every((candidate) => candidate.impact === record.impact), `${changedPath} 多份记录的用户可见影响冲突`)
    assert(matching.every((candidate) => candidate.mode === record.mode), `${changedPath} 多份记录的记录模式冲突`)
    for (const candidate of matching) usedRecords.set(candidate.path, candidate)
    if (record.impact === 'technical-only') technicalOnlyPaths.push(changedPath)
    else userVisiblePaths.push(changedPath)
    if (record.mode === '轻量可见变更') lightweightPaths.push(changedPath)
  }
  for (const record of usedRecords.values()) assertCurrentRecord(record)
  return { coveredPaths: changedPaths, recordPaths: [...usedRecords.keys()].sort(), technicalOnlyPaths, userVisiblePaths, lightweightPaths }
}
