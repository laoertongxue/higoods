import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, posix, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { resolveGovernanceScope, isReviewRecordPath, type GovernanceScope } from './workflow-governance/governance-scope.ts'
import { assertHistoricalListCorrection } from './workflow-governance/list-page-policy.ts'
import type { ReviewRecordSource } from './workflow-governance/prototype-review.ts'

export type PagePattern = 'list' | 'detail' | 'form' | 'dashboard' | 'pda'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PAGE_ROOT = join(ROOT, 'src/pages')
const BASELINE_PATH = join(ROOT, 'scripts/standard-list-page-baseline.json')
const LIST_SIGNALS = [/<table\b/i, /render(?:Standard)?List/i, /renderTablePagination/i, /data-[\w-]*(?:list|table)/i]
// 页面级渲染入口：render<页面名>Page（排除列表骨架公共组件，如 renderStandardListPage / renderEngineeringStandardListPage）
const PAGE_ENTRY_EXPORT = /export\s+(?:async\s+)?function\s+(render\w+Page)\s*\(|export\s+const\s+(render\w+Page)\s*[=:]/g
const PAGE_ENTRY_COMPONENT_SUFFIX = /(?:StandardList|EngineeringList)Page$/

function standaloneDirective(source: string, name: string, parsed?: ts.SourceFile): string | null {
  const file = parsed ?? ts.createSourceFile('directive.ts', source, ts.ScriptTarget.Latest, true)
  const comments = new Map<number, string>()
  const add = (ranges: ts.CommentRange[] | undefined) => {
    for (const range of ranges ?? []) {
      if (range.kind !== ts.SyntaxKind.SingleLineCommentTrivia) continue
      const lineStart = source.lastIndexOf('\n', range.pos - 1) + 1
      if (source.slice(lineStart, range.pos).trim()) continue
      comments.set(range.pos, source.slice(range.pos, range.end).trim())
    }
  }
  function visit(node: ts.Node): void {
    add(ts.getLeadingCommentRanges(source, node.pos))
    add(ts.getTrailingCommentRanges(source, node.end))
    ts.forEachChild(node, visit)
  }
  visit(file)
  const values = [...comments.values()].flatMap((comment) => {
    const match = new RegExp(`^//\\s*@${name}:\\s*(.*?)\\s*$`).exec(comment)
    return match ? [match[1]] : []
  })
  assert(values.length <= 1, `@${name} 声明重复；每个文件只能有一个独立行声明`)
  return values[0] ?? null
}

export function parsePagePattern(source: string): PagePattern | null {
  const value = standaloneDirective(source, 'page-pattern')
  if (value === null) return null
  assert(['list', 'detail', 'form', 'dashboard', 'pda'].includes(value), `@page-pattern 声明无效：${value}`)
  return value as PagePattern
}

export function isListCandidate(source: string): boolean {
  const pattern = parsePagePattern(source)
  if (pattern && pattern !== 'list') return false
  if (pattern === 'list') return true
  return LIST_SIGNALS.filter((signal) => signal.test(source)).length >= 2
}

export function isPageEntry(source: string): boolean {
  if (parsePagePattern(source)) return true
  for (const match of source.matchAll(PAGE_ENTRY_EXPORT)) {
    const name = match[1] ?? match[2]
    if (name && !PAGE_ENTRY_COMPONENT_SUFFIX.test(name)) return true
  }
  return false
}

export function hasStandardListContract(
  source: string,
  pagePath = 'src/pages/example.ts',
  readSource?: (path: string) => string | null,
): boolean {
  type ImportBinding = { path: string; name: string }
  type Context = { path: string; source: string; file: ts.SourceFile; checker: ts.TypeChecker; imports: Map<ts.Symbol, ImportBinding>; exports: Map<string, ts.Symbol>; pagination: string | null }
  type Argument = { node: ts.Expression; context: Context; bindings: Map<ts.Symbol, Argument> }
  const modules: Record<string, string> = {
    renderStandardListPage: 'src/components/ui/list-page.ts',
    renderStandardListTable: 'src/components/ui/list-table.ts',
    renderTablePagination: 'src/components/ui/pagination.ts',
    createProcessOrderListController: 'src/components/ui/process-order-list-controller.ts',
  }
  const contexts = new Map<string, Context | null>()
  function context(path: string, input?: string): Context | null {
    if (contexts.has(path)) return contexts.get(path)!
    const text = input ?? readSource?.(path)
    if (text == null) { contexts.set(path, null); return null }
    const name = posix.resolve('/governance', path)
    const file = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true)
    if ((file as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics?.length) { contexts.set(path, null); return null }
    const options = { noResolve: true, noLib: true, target: ts.ScriptTarget.Latest }
    const host = ts.createCompilerHost(options)
    host.getSourceFile = (requested) => requested === name ? file : undefined
    host.fileExists = (requested) => requested === name
    host.readFile = (requested) => requested === name ? text : undefined
    const checker = ts.createProgram([name], options, host).getTypeChecker()
    const ctx: Context = { path, source: text, file, checker, imports: new Map(), exports: new Map(), pagination: standaloneDirective(text, 'list-pagination', file) }
    contexts.set(path, ctx)
    for (const statement of file.statements) {
      if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && !statement.importClause?.isTypeOnly) {
        const binding = statement.importClause?.namedBindings
        if (!binding || !ts.isNamedImports(binding) || !statement.moduleSpecifier.text.startsWith('.')) continue
        let target = posix.normalize(posix.join(posix.dirname(path), statement.moduleSpecifier.text))
        if (!target.endsWith('.ts')) target += '.ts'
        if (!target.startsWith('src/')) continue
        for (const item of binding.elements) {
          const symbol = checker.getSymbolAtLocation(item.name)
          if (!item.isTypeOnly && symbol && symbol.declarations?.every(ts.isImportSpecifier)) ctx.imports.set(symbol, { path: target, name: item.propertyName?.text ?? item.name.text })
        }
      }
      const exported = ts.canHaveModifiers(statement) && ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
      if (exported && ts.isFunctionDeclaration(statement) && statement.name) {
        const symbol = checker.getSymbolAtLocation(statement.name)
        if (symbol) ctx.exports.set(statement.name.text, symbol)
      }
      if (exported && ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          const symbol = checker.getSymbolAtLocation(declaration.name)
          if (symbol) ctx.exports.set(declaration.name.text, symbol)
        }
      }
      if (ts.isExportDeclaration(statement) && !statement.moduleSpecifier && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const item of statement.exportClause.elements) {
          const local = checker.getExportSpecifierLocalTargetSymbol(item)
          if (local) ctx.exports.set(item.name.text, local)
        }
      }
    }
    return ctx
  }
  const entry = context(pagePath, source)
  if (!entry) return false
  // A page's unused exported helpers are not page entry points. Existing modules
  // co-locate explicitly named detail/create forms with their list renderer.
  const pageRoots = [...entry.exports].filter(([name]) => /^render\w+Page$/.test(name) && !PAGE_ENTRY_COMPONENT_SUFFIX.test(name))
  const roots = pageRoots.length
    ? pageRoots.filter(([name]) => !/(?:Detail|Create|Edit|Form|Dialog)Page$/.test(name))
    : [...entry.exports].filter(([name]) => /^(?:render[A-Z_]|create\w*List)/.test(name))
  return roots.length > 0 && roots.every(([, root]) => {
    const calls = new Set<string>()
    const collectors: Array<Set<string>> = [calls]
    const collectorIds = new Map<Set<string>, number>([[calls, 0]])
    let completeReturnedPage = false
    const active = new Set<ts.Symbol>()
    const visited = new Map<ts.Node, Set<string>>()
    let remainingNodes = 200000
    function body(ctx: Context, fn: ts.FunctionLikeDeclaration, args: Argument[], inherited: Map<ts.Symbol, Argument>): void {
      const bindings = new Map(inherited)
      fn.parameters.forEach((parameter, index) => {
        if (ts.isIdentifier(parameter.name) && args[index]) {
          const symbol = ctx.checker.getSymbolAtLocation(parameter.name)
          if (symbol) bindings.set(symbol, args[index])
        }
      })
      if (fn.body) walk(ctx, fn.body, bindings)
    }
    function callSymbol(ctx: Context, symbol: ts.Symbol, args: Argument[], bindings: Map<ts.Symbol, Argument>): void {
      const argument = bindings.get(symbol)
      if (argument) { invoke(argument.context, argument.node, args, argument.bindings); return }
      if (active.has(symbol)) return
      active.add(symbol)
      try {
        const imported = ctx.imports.get(symbol)
        if (imported) {
          if (modules[imported.name] === imported.path) {
            for (const collector of collectors) collector.add(imported.name)
            if (imported.name === 'renderStandardListPage') {
              const configuration = args[0]
              const slotDependencies = (name: string) => {
                const dependencies = new Set<string>()
                const slot = configuration && selectedProperty(configuration.context, configuration.node, name, configuration.bindings)
                if (!slot) return dependencies
                collectorIds.set(dependencies, collectorIds.size)
                collectors.push(dependencies)
                const previousComplete = completeReturnedPage
                walk(slot.context, slot.node, slot.bindings)
                completeReturnedPage = previousComplete
                collectors.pop()
                return dependencies
              }
              const table = slotDependencies('tableHtml')
              const pagination = slotDependencies('paginationHtml')
              const reason = /^none\s*—\s*(.+)$/.exec(ctx.pagination ?? '')?.[1]?.trim()
              const noPagination = Boolean(reason && !/^(?:无|待填写|不适用|N\/?A)$/i.test(reason))
              const tableValid = table.has('renderStandardListTable') || table.has('controller-tableHtml')
              const paginationValid = pagination.has('renderTablePagination') || pagination.has('controller-paginationHtml') || noPagination
              if (tableValid && paginationValid) completeReturnedPage = true
            }
            return
          }
          // Follow only rendering/wrapper dependencies, through the SAME selected source
          // version. This is not a filesystem fallback or an import-name allow-list.
          if (!/^(?:render|with|create)/.test(imported.name)) return
          const next = context(imported.path)
          const exported = next?.exports.get(imported.name)
          if (next && exported) callSymbol(next, exported, args, new Map())
          return
        }
        for (const declaration of symbol.declarations ?? []) {
          if (ts.isFunctionDeclaration(declaration)) body(ctx, declaration, args, bindings)
          if (ts.isVariableDeclaration(declaration) && declaration.initializer) invoke(ctx, declaration.initializer, args, bindings)
        }
      } finally { active.delete(symbol) }
    }
    function invoke(ctx: Context, expression: ts.Expression, args: Argument[], bindings: Map<ts.Symbol, Argument>): void {
      if (ts.isParenthesizedExpression(expression) || ts.isNonNullExpression(expression) || ts.isAsExpression(expression)) return invoke(ctx, expression.expression, args, bindings)
      if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) { body(ctx, expression, args, bindings); return }
      if (ts.isIdentifier(expression)) {
        const symbol = ctx.checker.getSymbolAtLocation(expression)
        if (symbol) callSymbol(ctx, symbol, args, bindings)
        return
      }
      if (ts.isPropertyAccessExpression(expression) && expression.name.text === 'render') {
        const cached = cachedMapValue(ctx, expression)
        if (cached) { walk(ctx, cached, bindings); return }
      }
      walk(ctx, expression, bindings)
    }
    const reading = new Set<ts.Symbol>()
    function selectedProperty(ctx: Context, value: ts.Expression, name: string, bindings: Map<ts.Symbol, Argument>, depth = 0): Argument | null | undefined {
      if (depth > 16) return null
      if (ts.isParenthesizedExpression(value) || ts.isNonNullExpression(value) || ts.isAsExpression(value)) return selectedProperty(ctx, value.expression, name, bindings, depth + 1)
      if (ts.isIdentifier(value)) {
        const symbol = ctx.checker.getSymbolAtLocation(value)
        const bound = symbol && bindings.get(symbol)
        if (bound) return selectedProperty(bound.context, bound.node, name, bound.bindings, depth + 1)
        const declaration = symbol?.declarations?.find(ts.isVariableDeclaration)
        if (declaration?.initializer) return selectedProperty(ctx, declaration.initializer, name, bindings, depth + 1)
      }
      if (!ts.isObjectLiteralExpression(value)) return undefined
      // Unknown keys/spreads may overwrite a field, so cannot prove its value.
      if (value.properties.some((property) => ts.isSpreadAssignment(property) || (property.name && ts.isComputedPropertyName(property.name)))) return null
      const property = [...value.properties].reverse().find((item) => item.name?.getText(ctx.file).replace(/^['"]|['"]$/g, '') === name)
      if (property && ts.isPropertyAssignment(property)) return { context: ctx, node: property.initializer, bindings }
      if (property && ts.isShorthandPropertyAssignment(property)) {
        const symbol = ctx.checker.getShorthandAssignmentValueSymbol(property)
        const declaration = symbol?.declarations?.find(ts.isVariableDeclaration)
        if (declaration?.initializer) return { context: ctx, node: declaration.initializer, bindings }
      }
      return null
    }
    function cachedMapValue(ctx: Context, expression: ts.PropertyAccessExpression): ts.Expression | null {
      const get = ts.isNonNullExpression(expression.expression) ? expression.expression.expression : expression.expression
      if (!ts.isCallExpression(get) || !ts.isPropertyAccessExpression(get.expression) || get.expression.name.text !== 'get' || get.arguments.length !== 1) return null
      const cache = ctx.checker.getSymbolAtLocation(get.expression.expression)
      if (!cache?.declarations?.some((item) => ts.isVariableDeclaration(item) && item.initializer && ts.isNewExpression(item.initializer) && item.initializer.expression.getText(ctx.file) === 'Map')) return null
      const returned = expression.parent.parent
      if (!ts.isReturnStatement(returned) || !ts.isBlock(returned.parent)) return null
      const preceding = returned.parent.statements[returned.parent.statements.indexOf(returned) - 1]
      if (!preceding || !ts.isIfStatement(preceding) || preceding.elseStatement || !ts.isPrefixUnaryExpression(preceding.expression) || preceding.expression.operator !== ts.SyntaxKind.ExclamationToken) return null
      const has = preceding.expression.operand
      if (!ts.isCallExpression(has) || !ts.isPropertyAccessExpression(has.expression) || has.expression.name.text !== 'has' || ctx.checker.getSymbolAtLocation(has.expression.expression) !== cache || has.arguments.length !== 1 || has.arguments[0].getText(ctx.file) !== get.arguments[0].getText(ctx.file)) return null
      const insertion = preceding.thenStatement
      if (!ts.isExpressionStatement(insertion) || !ts.isCallExpression(insertion.expression) || !ts.isPropertyAccessExpression(insertion.expression.expression)) return null
      const call = insertion.expression
      if (call.expression.name.text !== 'set' || ctx.checker.getSymbolAtLocation(call.expression.expression) !== cache || call.arguments.length !== 2 || call.arguments[0].getText(ctx.file) !== get.arguments[0].getText(ctx.file)) return null
      return call.arguments[1]
    }
    function cachedRenderer(ctx: Context, declaration: ts.VariableDeclaration): ts.Expression | null {
      // Existing PCS lists use one small lazy-cache idiom. Follow only its value
      // assignment, not arbitrary expression statements or unrelated side effects.
      const initial = declaration.initializer
      if (!initial || !ts.isCallExpression(initial) || !ts.isPropertyAccessExpression(initial.expression) || initial.expression.name.text !== 'get' || initial.arguments.length !== 1 || !ts.isIdentifier(declaration.name)) return null
      const receiver = initial.expression.expression
      if (!ts.isIdentifier(receiver)) return null
      const cache = ctx.checker.getSymbolAtLocation(receiver)
      if (!cache?.declarations?.some((item) => ts.isVariableDeclaration(item) && item.initializer && ts.isNewExpression(item.initializer) && item.initializer.expression.getText(ctx.file) === 'Map')) return null
      const statement = declaration.parent.parent
      if (!ts.isVariableStatement(statement) || !ts.isBlock(statement.parent)) return null
      const following = statement.parent.statements[statement.parent.statements.indexOf(statement) + 1]
      if (!following || !ts.isIfStatement(following) || following.elseStatement || !ts.isPrefixUnaryExpression(following.expression) || following.expression.operator !== ts.SyntaxKind.ExclamationToken || !ts.isIdentifier(following.expression.operand) || !ts.isBlock(following.thenStatement)) return null
      const symbol = ctx.checker.getSymbolAtLocation(declaration.name)
      if (ctx.checker.getSymbolAtLocation(following.expression.operand) !== symbol || following.thenStatement.statements.length !== 2) return null
      const [assignment, insertion] = following.thenStatement.statements
      if (!ts.isExpressionStatement(assignment) || !ts.isBinaryExpression(assignment.expression) || assignment.expression.operatorToken.kind !== ts.SyntaxKind.EqualsToken || !ts.isIdentifier(assignment.expression.left) || ctx.checker.getSymbolAtLocation(assignment.expression.left) !== symbol) return null
      if (!ts.isExpressionStatement(insertion) || !ts.isCallExpression(insertion.expression) || !ts.isPropertyAccessExpression(insertion.expression.expression)) return null
      const call = insertion.expression
      if (call.expression.name.text !== 'set' || ctx.checker.getSymbolAtLocation(call.expression.expression) !== cache || call.arguments.length !== 2 || call.arguments[0].getText(ctx.file) !== initial.arguments[0].getText(ctx.file) || !ts.isIdentifier(call.arguments[1]) || ctx.checker.getSymbolAtLocation(call.arguments[1]) !== symbol) return null
      return assignment.expression.right
    }
    function walk(ctx: Context, node: ts.Node, bindings: Map<ts.Symbol, Argument>): void {
      const bindingKey = String(collectorIds.get(collectors.at(-1)!)) + ':' + [...bindings].map(([symbol, argument]) => `${symbol.name}:${argument.context.path}:${argument.node.pos}`).sort().join('|')
      const seen = visited.get(node) ?? new Set<string>()
      if (seen.has(bindingKey)) return
      seen.add(bindingKey)
      visited.set(node, seen)
      if (--remainingNodes < 0) return
      if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) return
      if (ts.isBlock(node)) {
        for (const statement of node.statements) {
          if (!ts.isVariableStatement(statement) && !ts.isExpressionStatement(statement)) walk(ctx, statement, bindings)
          if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) break
        }
        return
      }
      if (ts.isIfStatement(node)) {
        if (node.expression.kind !== ts.SyntaxKind.FalseKeyword) walk(ctx, node.thenStatement, bindings)
        if (node.expression.kind !== ts.SyntaxKind.TrueKeyword && node.elseStatement) walk(ctx, node.elseStatement, bindings)
        return
      }
      if (ts.isConditionalExpression(node)) {
        if (node.condition.kind === ts.SyntaxKind.TrueKeyword) walk(ctx, node.whenTrue, bindings)
        else if (node.condition.kind === ts.SyntaxKind.FalseKeyword) walk(ctx, node.whenFalse, bindings)
        // Dynamic alternatives are not merged into one component contract.
        return
      }
      if (ts.isBinaryExpression(node)) {
        if (node.operatorToken.kind === ts.SyntaxKind.CommaToken) walk(ctx, node.right, bindings)
        else if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
          walk(ctx, node.left, bindings)
          walk(ctx, node.right, bindings)
        }
        return
      }
      if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        const name = ts.isPropertyAccessExpression(node) ? node.name.text : node.argumentExpression && ts.isStringLiteral(node.argumentExpression) ? node.argumentExpression.text : null
        if (name === null) return
        const selected = selectedProperty(ctx, node.expression, name, bindings)
        if (selected) { walk(selected.context, selected.node, selected.bindings); return }
        if (selected === null) return
        // Only existing renderer/controller surfaces can carry list HTML through
        // a non-literal object. Unknown property access is not evidence.
        if (name === 'tableHtml' || name === 'paginationHtml') {
          const projection = new Set<string>()
          collectorIds.set(projection, collectorIds.size)
          collectors.push(projection)
          walk(ctx, node.expression, bindings)
          collectors.pop()
          if (projection.has('createProcessOrderListController')) for (const collector of collectors) collector.add(`controller-${name}`)
        } else if (name === 'render' || name === 'getView') walk(ctx, node.expression, bindings)
        return
      }
      if (ts.isCallExpression(node)) {
        if (ts.isPropertyAccessExpression(node.expression) && ['replace', 'replaceAll'].includes(node.expression.name.text) && node.arguments.length === 2 && node.arguments.every(ts.isStringLiteral)) {
          const [from, to] = node.arguments as unknown as [ts.StringLiteral, ts.StringLiteral]
          const addsSkipAttribute = /^data-[a-z-]+=$/.test(from.text) && to.text === `data-skip-page-rerender="true" ${from.text}`
          const addsPageMarker = from.text === 'data-standard-list-page' && /^data-standard-list-page data-[a-z-]+$/.test(to.text)
          if (addsSkipAttribute || addsPageMarker) {
            walk(ctx, node.expression.expression, bindings)
            return
          }
        }
        invoke(ctx, node.expression, node.arguments.map((argument) => ({ node: argument, context: ctx, bindings })), bindings)
        return
      }
      // A reached list factory can expose its renderer as the public `render` entry.
      if (ts.isReturnStatement(node) && node.expression && ts.isObjectLiteralExpression(node.expression)) {
        for (const property of node.expression.properties) {
          if (ts.isPropertyAssignment(property) && property.name.getText(ctx.file).replace(/['"]/g, '') === 'render') invoke(ctx, property.initializer, [], bindings)
          else if (ts.isMethodDeclaration(property) && property.name.getText(ctx.file) === 'render') body(ctx, property, [], bindings)
          else if (ts.isShorthandPropertyAssignment(property) && property.name.text === 'render') {
            const symbol = ctx.checker.getShorthandAssignmentValueSymbol(property)
            if (symbol) callSymbol(ctx, symbol, [], bindings)
          }
        }
        return
      }
      if (ts.isIdentifier(node)) {
        const symbol = ctx.checker.getSymbolAtLocation(node)
        const argument = symbol && bindings.get(symbol)
        if (argument) { walk(argument.context, argument.node, argument.bindings); return }
        if (symbol && !reading.has(symbol)) {
          reading.add(symbol)
          try {
            for (const declaration of symbol.declarations ?? []) if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
              walk(ctx, cachedRenderer(ctx, declaration) ?? declaration.initializer, bindings)
            }
          } finally { reading.delete(symbol) }
        }
        return
      }
      if (ts.isReturnStatement(node) && node.expression) walk(ctx, node.expression, bindings)
      else if (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node)) walk(ctx, node.expression, bindings)
      else if (ts.isTemplateExpression(node)) { for (const span of node.templateSpans) walk(ctx, span.expression, bindings) }
      else if (ts.isObjectLiteralExpression(node)) { for (const property of node.properties) if (ts.isPropertyAssignment(property)) walk(ctx, property.initializer, bindings) }
      else if (ts.isTryStatement(node)) walk(ctx, node.tryBlock, bindings)
      // Other expression forms do not prove that their evaluated result carries HTML.
    }
    callSymbol(entry, root, [], new Map())
    return remainingNodes >= 0 && completeReturnedPage
  })
}

export function sha256(source: string): string {
  return createHash('sha256').update(source).digest('hex')
}

export function validateBaselineIntegrity(
  current: Record<string, string>,
  base: Record<string, string> | null,
): void {
  assert(base !== null || Object.keys(current).length === 0, '不能在本次变更中创建历史页面基线以规避标准组件')
  for (const [path, hash] of Object.entries(current)) {
    assert(Object.hasOwn(base!, path), `基线不得新增页面：${path}`)
    assert.equal(hash, base![path], `基线哈希不得修改：${path}`)
  }
}

function listFiles(directory: string): string[] {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return listFiles(path)
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : []
  })
}

function parseBaseline(source: string | null): Record<string, string> {
  if (source === null) return {}
  const parsed = JSON.parse(source) as unknown
  assert(parsed && typeof parsed === 'object' && !Array.isArray(parsed), '历史列表基线必须是对象')
  for (const [key, value] of Object.entries(parsed)) {
    assert(/^src\/pages\/.*\.ts$/.test(key), `基线路径必须位于 src/pages：${key}`)
    assert(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value), `基线哈希格式错误：${key}`)
  }
  return parsed as Record<string, string>
}

export function assertListPage(
  path: string,
  source: string,
  before: string | null,
  baseline: Record<string, string>,
  records: ReviewRecordSource[] = [],
  readSource?: (path: string) => string | null,
): void {
  const pattern = parsePagePattern(source)
  const wasList = before !== null && isListCandidate(before)
  if (before === null && !pattern) {
    throw new Error(`${path} 是新增页面，必须声明 @page-pattern: list|detail|form|dashboard|pda`)
  }
  if (wasList && parsePagePattern(before) === 'list' && pattern !== 'list') {
    throw new Error(`${path} 不能通过删除或修改列表声明绕过标准列表契约`)
  }
  if (!isListCandidate(source) && !wasList && !baseline[path]) return
  if (pattern === 'list') {
    assert(hasStandardListContract(source, path, readSource), `${path} 声明为列表页，但未完整使用标准列表骨架、表格和适用分页；无分页须声明具体原因`)
    return
  }
  // The fixed baseline proves that this is a grandfathered page. It must never be
  // overwritten with an approved copy edit's digest: each edit binds its own source pair.
  if (baseline[path] && before !== null) {
    if (source === before) return
    assert.equal(pattern, parsePagePattern(before), `${path} 历史局部修正不能改变页面模式声明`)
    assertHistoricalListCorrection(path, before, source, records)
    return
  }
  throw new Error(`${path} 是列表候选页，请添加 @page-pattern: list 并迁移到标准列表组件`)
}

export function runListPageGovernance(args: string[], cwd = process.cwd()): { checkedPaths: string[]; excludedPaths: string[] } {
  return checkListPageGovernanceScope(resolveGovernanceScope(args, cwd))
}

export function checkListPageGovernanceScope(scope: GovernanceScope): { checkedPaths: string[]; excludedPaths: string[] } {
  const baselinePath = 'scripts/standard-list-page-baseline.json'
  const baseSource = scope.readBaseText(baselinePath)
  const base = parseBaseline(baseSource)
  // Unselected worktree dirt cannot create an exception for the selected task.
  const baseline = scope.paths.includes(baselinePath) ? parseBaseline(scope.readText(baselinePath)) : base
  validateBaselineIntegrity(baseline, baseSource === null ? null : base)
  // Excluded changes are not part of this delivery. A directly reached wrapper
  // must prove the contract with its base version instead of borrowing dirty code.
  const readDependency = (path: string) => scope.excludedPaths.includes(path) ? scope.readBaseText(path) : scope.readText(path)
  for (const path of Object.keys(base).filter((path) => !Object.hasOwn(baseline, path))) {
    const source = scope.paths.includes(path) ? scope.readText(path) : scope.readBaseText(path)
    assert(source === null || (parsePagePattern(source) === 'list' && hasStandardListContract(source, path, (dependency) => scope.paths.includes(dependency) ? scope.readText(dependency) : scope.readBaseText(dependency))), `基线项只能在页面已删除或完成标准迁移后移除：${path}`)
  }
  const records: ReviewRecordSource[] = scope.paths.filter(isReviewRecordPath).flatMap((path) => {
    const source = scope.readText(path)
    return source === null ? [] : [{ path, source }]
  })
  const checkedPaths: string[] = []
  for (const path of scope.paths.filter((path) => /^src\/pages\/.*\.ts$/.test(path))) {
    const source = scope.readText(path)
    const before = scope.readBaseText(path)
    if (source === null) {
      assert(!baseline[path], `已删除的列表页必须同步移除基线项：${path}`)
      continue
    }
    if (!isPageEntry(source) && !isListCandidate(source) && !(before && (isPageEntry(before) || isListCandidate(before))) && !baseline[path]) continue
    assertListPage(path, source, before, baseline, records, readDependency)
    checkedPaths.push(path)
  }
  console.log(`list page governance passed: ${scope.kind}, checked ${checkedPaths.length} changed pages, excluded ${scope.excludedPaths.length} paths`)
  return { checkedPaths, excludedPaths: scope.excludedPaths }
}

function writeBaseline(): void {
  assert(!existsSync(BASELINE_PATH), '已有历史基线，禁止覆盖生成；页面迁移后只能删除对应项')
  const baseline: Record<string, string> = {}
  for (const absolutePath of listFiles(PAGE_ROOT)) {
    const path = relative(ROOT, absolutePath)
    const source = readFileSync(absolutePath, 'utf8')
    if (isListCandidate(source) && parsePagePattern(source) !== 'list') baseline[path] = sha256(source)
  }
  writeFileSync(BASELINE_PATH, `${JSON.stringify(Object.fromEntries(Object.entries(baseline).sort()), null, 2)}\n`)
  console.log(`standard list page baseline written: ${Object.keys(baseline).length} pages`)
}

function runSelfTest(): void {
  const standard = (body: string) => `import { renderStandardListPage } from '../components/ui/list-page.ts'
import { renderStandardListTable } from '../components/ui/list-table.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
export function renderContractPage() {\n${body}\n}`
  assert.equal(parsePagePattern('// @page-pattern: list'), 'list')
  assert.equal(parsePagePattern('// @page-pattern: detail'), 'detail')
  assert.throws(() => parsePagePattern('// @page-pattern: unknown'), /声明无效/)
  assert.equal(isListCandidate('<table><tbody></tbody></table> renderTablePagination'), true)
  assert.equal(hasStandardListContract(standard('return renderStandardListPage({ tableHtml: renderStandardListTable({}), paginationHtml: renderTablePagination({}) })')), true)
  assert.equal(hasStandardListContract('renderStandardListPage({}); renderStandardListTable({})'), false)
  assert.equal(hasStandardListContract(standard('// @list-pagination: none — 固定 4 个结果，无分页需求\nreturn renderStandardListPage({ tableHtml: renderStandardListTable({}) })')), true)
  assert.equal(hasStandardListContract('// @list-pagination: none — 待填写\nrenderStandardListPage({}); renderStandardListTable({})'), false)
  assert.equal(hasStandardListContract('// @list-pagination: none — 固定 4 个结果\nrenderStandardListPage({})'), false)
  assert.equal(hasStandardListContract(`
    import { renderStandardListPage } from '../components/ui/list-page.ts'
    import { createProcessOrderListController } from '../components/ui/process-order-list-controller.ts'
    const controller = createProcessOrderListController({})
    export function renderControllerPage() { return renderStandardListPage({ tableHtml: controller.getView().tableHtml, paginationHtml: controller.getView().paginationHtml }) }
  `), true)
  assert.equal(hasStandardListContract('renderTable(<tbody>)'), false)
  assert.equal(isPageEntry('// @page-pattern: list'), true)
  assert.equal(isPageEntry('export function renderPcsRevisionTaskPage(): string { return "" }'), true)
  assert.equal(isPageEntry('export function renderEngineeringStandardListPage(): string { return "" }'), false)
  assert.throws(() => validateBaselineIntegrity({ 'src/pages/old.ts': 'a'.repeat(64) }, { 'src/pages/old.ts': 'b'.repeat(64) }))
  assert.throws(() => validateBaselineIntegrity({ 'src/pages/new.ts': 'a'.repeat(64) }, {}))
  assert.doesNotThrow(() => validateBaselineIntegrity({}, { 'src/pages/migrated.ts': 'a'.repeat(64) }))
  assert.throws(
    () => assertListPage('src/pages/new-list.ts', '<table></table> renderTablePagination', null, {}),
    /必须声明 @page-pattern/,
  )
  assert.throws(
    () => assertListPage('src/pages/marked-list.ts', '// @page-pattern: list', null, {}),
    /未完整使用标准列表骨架/,
  )
  assert.doesNotThrow(
    () => assertListPage('src/pages/detail.ts', '// @page-pattern: detail\nconst preview = "<table></table>"', null, {}),
  )
  // Validate the actual entry points; this repository no longer has the old CI YAML.
  const { scripts } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  assert.match(scripts['check:list-page-governance:static'], /scripts\/check-list-page-governance\.ts/)
  assert.match(scripts['check:list-page-governance'], /scripts\/check-list-page-governance-suite\.ts/)
  const suite = readFileSync(join(ROOT, 'scripts/check-list-page-governance-suite.ts'), 'utf8')
  assert.match(suite, /check-list-page-governance(?:\.ts|')/)
  assert.match(suite, /checkListPageGovernanceScope\(scope\)/)
  assert.match(suite, /checkPrototypeGovernance\(scope\)/)
  console.log('list page governance self-test passed')
}

function main(): void {
  const args = process.argv.slice(2)
  if (args.includes('--self-test') || args.includes('--write-baseline')) assert.equal(args.length, 1, '特殊参数必须单独使用，不能跳过所选范围检查')
  if (args.includes('--self-test')) return runSelfTest()
  if (args.includes('--write-baseline')) return writeBaseline()
  runListPageGovernance(args)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
