import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import ts from 'typescript'
import { validatePrototypeReviewCoverage, type ReviewRecordSource } from './prototype-review.ts'

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
// Deliberately limited to presentation utilities. Visibility, hit-testing, custom classes,
// arbitrary values, layout direction and selectors may change behavior and remain exact.
const PRESENTATION_CLASS = /^(?:(?:sm|md|lg|xl|2xl|hover|focus|focus-visible|dark):)*(?:[pm][xytrbl]?-(?:0|px|\d+(?:\.\d+)?)|gap(?:-[xy])?-(?:\d+(?:\.\d+)?)|text-(?:xs|sm|base|lg|xl|[2-9]xl)|font-(?:normal|medium|semibold|bold)|(?:text|bg|border)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}|(?:text|bg|border)-(?:black|white)|rounded(?:-(?:none|sm|md|lg|xl|2xl|3xl|full))?|border(?:-[01248])?|leading-(?:none|tight|snug|normal|relaxed|loose|\d+))$/
const EXPRESSION_MARKER = /__LIST_EXPRESSION_\d+__/g

function textShape(value: string, inHeader = false): string {
  if (!value.trim()) return '#space'
  // A numeric or dynamic text node is immutable as a whole: guessing a finite unit
  // vocabulary loses signs, dates and units such as boxes/tonnes. This also preserves
  // the adjacent unit and qualifier when a quantity is interpolated rather than static.
  const quantityContext = /数量|单位|重量|长度|面积|体积|公斤|千克|厘米|毫米|片|件|米|码|克|包|袋|个|套|箱|吨|卷|瓶|捆|匹|%|¥|￥|\b(?:kg|lb|lbs|pcs|ton|tons|cm|mm|ml|m2|m3)\b/i
  if (inHeader || /\d|__LIST_EXPRESSION_|[零〇一二两三四五六七八九十百千万亿半]/.test(value) || quantityContext.test(value)) return JSON.stringify(['#fact-text', value])
  return '#text'
}

/** A conservative HTML shape, not a general browser HTML parser. Uncertain input fails closed. */
function htmlShape(value: string): string | null {
  if (!/<[A-Za-z][\w:-]*(?:\s|>)/.test(value) || /<!--|<!|<\?|<\/?(?:script|style)\b/i.test(value)) return null
  const stack: string[] = []
  const frames: Array<{ name: string; texts: Array<{ index: number; value: string }>; hasBlockChild: boolean }> = []
  const shape: string[] = []
  let cursor = 0
  while (cursor < value.length) {
    if (value[cursor] !== '<') {
      const end = value.indexOf('<', cursor)
      const text = value.slice(cursor, end < 0 ? undefined : end)
      for (const frame of frames) frame.texts.push({ index: shape.length, value: text })
      shape.push(textShape(text, stack.some((name) => ['th', 'thead'].includes(name.toLowerCase()))))
      cursor = end < 0 ? value.length : end
      continue
    }
    let quote = ''
    let end = cursor + 1
    for (; end < value.length; end++) {
      const char = value[end]
      if (quote) { if (char === quote) quote = ''; continue }
      if (char === '"' || char === "'") { quote = char; continue }
      if (char === '>') break
      if (char === '<') return null
    }
    if (end >= value.length || quote) return null
    const tag = value.slice(cursor, end + 1)
    const closing = /^<\/([A-Za-z][\w:-]*)\s*>$/.exec(tag)
    if (closing) {
      if (stack.pop() !== closing[1]) return null
      const frame = frames.pop()!
      // Quantity and unit can be split across inline children. Preserve the whole
      // cell/display group, without freezing sibling cells or the full page shell.
      const numeric = frame.texts.some((text) => /\d|__LIST_EXPRESSION_|[零〇一二两三四五六七八九十百千万亿半]/.test(text.value))
      const cell = ['td', 'th', 'label', 'button', 'p', 'li', 'dd', 'dt'].includes(frame.name)
      const compactGroup = !frame.hasBlockChild && ['div', 'span', 'section', 'article'].includes(frame.name)
      if (numeric && (cell || compactGroup)) for (const text of frame.texts) shape[text.index] = JSON.stringify(['#quantity-group-text', text.value])
      shape.push(`</${closing[1]}>`)
    } else {
      const opening = /^<([A-Za-z][\w:-]*)([\s\S]*?)\s*(\/?)>$/.exec(tag)
      if (!opening) return null
      const [, name, rest, selfClosing] = opening
      let attributes = rest
      const parsed: Array<[string, string | null]> = []
      const seen = new Set<string>()
      while (attributes.trim()) {
        const attribute = /^\s+([^\s="'<>/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/.exec(attributes)
        if (!attribute) return null
        const key = attribute[1]
        if (seen.has(key.toLowerCase())) return null
        seen.add(key.toLowerCase())
        let content = attribute[2] ?? null
        if (key === 'class' && content && /^["']/.test(content) && !content.match(EXPRESSION_MARKER)) {
          content = JSON.stringify(content.slice(1, -1).split(/\s+/).filter(Boolean).filter((token) => !PRESENTATION_CLASS.test(token)))
        }
        parsed.push([key, content])
        attributes = attributes.slice(attribute[0].length)
      }
      shape.push(JSON.stringify([name, parsed, Boolean(selfClosing)]))
      if (!selfClosing && !VOID_TAGS.has(name.toLowerCase())) {
        if (['div', 'section', 'article', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'ul', 'ol', 'li', 'p', 'label', 'button', 'dd', 'dt'].includes(name.toLowerCase())) for (const frame of frames) frame.hasBlockChild = true
        stack.push(name)
        frames.push({ name: name.toLowerCase(), texts: [], hasBlockChild: false })
      }
    }
    cursor = end + 1
  }
  return stack.length === 0 ? JSON.stringify(shape) : null
}

function sourceShape(source: string): string {
  const file = ts.createSourceFile('list.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const diagnostics = (file as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? []
  assert.equal(diagnostics.length, 0, '历史列表源码无法解析，不能证明是非结构修正')
  function visit(node: ts.Node): unknown {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const html = htmlShape(node.text)
      return [node.kind, html === null ? node.text : { html }]
    }
    if (ts.isTemplateExpression(node)) {
      const combined = node.head.text + node.templateSpans.map((span, index) => `__LIST_EXPRESSION_${index}__${span.literal.text}`).join('')
      const html = htmlShape(combined)
      if (html !== null) return [node.kind, html, node.templateSpans.map((span) => visit(span.expression))]
    }
    const children = node.getChildren(file)
    return children.length ? [node.kind, children.map(visit)] : [node.kind, node.getText(file)]
  }
  return JSON.stringify(visit(file))
}

export function isNonStructuralListCorrection(before: string, after: string): boolean {
  if (sourceShape(before) !== sourceShape(after)) return false
  // Even a Tailwind utility may have been reused as a local event selector. Such a
  // change needs the behavioral path instead of this automatic presentation exception.
  const classes = (source: string) => [...source.matchAll(/\bclass\s*=\s*(["'])(.*?)\1/g)].map((match) => match[2].split(/\s+/).filter(Boolean))
  const oldClasses = classes(before)
  const newClasses = classes(after)
  const changed = new Set<string>()
  for (let index = 0; index < Math.max(oldClasses.length, newClasses.length); index++) {
    const old = new Set(oldClasses[index] ?? [])
    const next = new Set(newClasses[index] ?? [])
    for (const token of old) if (!next.has(token)) changed.add(token)
    for (const token of next) if (!old.has(token)) changed.add(token)
  }
  for (const source of [before, after]) {
    let selectorUse = false
    const file = ts.createSourceFile('list.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    function visit(node: ts.Node): void {
      if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && htmlShape(node.text) === null) {
        if ([...changed].some((token) => node.text.includes(token))) selectorUse = true
      }
      ts.forEachChild(node, visit)
    }
    visit(file)
    if (selectorUse) return false
  }
  return true
}

function stripFences(source: string): string {
  let fence = ''
  return source.replace(/<!--[\s\S]*?(?:-->|$)/g, '').split(/\r?\n/).map((line) => {
    const marker = /^[ \t]*(`{3,}|~{3,})/.exec(line)?.[1]
    if (!fence && marker) { fence = marker; return '' }
    if (fence) { if (marker?.[0] === fence[0] && marker.length >= fence.length) fence = ''; return '' }
    if (/^(?: {4}| {0,3}\t)/.test(line)) return ''
    return line
  }).join('\n')
}

function correctionRows(source: string): string[][] {
  const lines = stripFences(source).split('\n')
  const headings = lines.flatMap((line, index) => {
    const match = /^(#{2,3})[ \t]+(?:\d+(?:\.\d+)*[.、]?[ \t]+)?历史列表局部修正[ \t]*$/.exec(line)
    return match ? [{ index, level: match[1].length }] : []
  })
  assert(headings.length <= 1, '历史列表局部修正小节不得重复')
  if (!headings.length) return []
  const start = headings[0]
  let end = lines.length
  for (let index = start.index + 1; index < lines.length; index++) {
    const heading = /^(#{1,3})[ \t]+/.exec(lines[index])
    if (heading && heading[1].length <= start.level) { end = index; break }
  }
  const rows = lines.slice(start.index + 1, end).filter((line) => /^\|/.test(line.trim()))
    .map((line) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()))
  assert.deepEqual(rows[0], ['文件', '基准 SHA256', '当前 SHA256', '依据'], '历史列表局部修正表头必须明确文件、基准 SHA256、当前 SHA256、依据')
  assert(rows[1]?.length === 4 && rows[1].every((cell) => /^:?-+:?$/.test(cell)), '历史列表局部修正表缺少分隔行')
  assert(rows.length >= 3, '历史列表局部修正表没有实际记录')
  const seen = new Set<string>()
  for (const row of rows.slice(2)) {
    assert.equal(row.length, 4, '历史列表局部修正行必须有四个字段')
    row[0] = row[0].replace(/^`|`$/g, '')
    assert(!seen.has(row[0]), `历史列表局部修正文件重复：${row[0]}`)
    seen.add(row[0])
    assert(/^[a-f0-9]{64}$/.test(row[1]) && /^[a-f0-9]{64}$/.test(row[2]), '历史列表局部修正必须填写真实的前后 SHA256')
    assert(row[3] && !/^(?:待填写|TODO|TBD|通过|无|不适用|契约无)[。！!]?$/i.test(row[3]), '历史列表局部修正缺少具体依据')
  }
  return rows.slice(2)
}

export function assertHistoricalListCorrection(
  path: string, before: string, after: string, records: ReviewRecordSource[],
): void {
  assert(isNonStructuralListCorrection(before, after), `${path} 无法证明仅为非结构文案或静态外观修正；请按列表结构／行为变化迁移标准组件`)
  const coverage = validatePrototypeReviewCoverage([path], records)
  assert(coverage.lightweightPaths.includes(path), `${path} 历史局部修正必须有当前轻量可见变更记录和直接页面证据`)
  const relevant = records.filter((record) => coverage.recordPaths.includes(record.path))
  const rows = relevant.flatMap((record) => correctionRows(record.source).filter((row) => row[0] === path))
  assert.equal(rows.length, 1, `${path} 必须有且仅有一条历史列表局部修正的前后哈希记录`)
  const hash = (source: string) => createHash('sha256').update(source).digest('hex')
  assert.equal(rows[0][1], hash(before), `${path} 基准 SHA256 与所选范围的修改前源码不一致`)
  assert.equal(rows[0][2], hash(after), `${path} 当前 SHA256 与所选范围的实际源码不一致`)
}
