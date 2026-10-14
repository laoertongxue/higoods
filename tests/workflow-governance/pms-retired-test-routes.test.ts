import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

// Source-only retirement contract. This does NOT run the legacy interaction audit,
// capture screenshots, prove its old generic click behavior, or provide browser/perf evidence.
const FILES = ['tests/pms-interaction-audit.spec.ts', 'tests/pms-style-screenshots.spec.ts'] as const
const RETIRED = new Set(['/pms/material-archives', '/pms/garment-skus', '/pms/sample-skus', '/pms/warehouses', '/pms/units', '/pms/bom-templates'])
const isRetired = (route: string): boolean => RETIRED.has(route) || route.startsWith('/pms/bom-templates/')

function routes(source: string, path: string): { rows: string[][]; driver: string } {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  let declaration: ts.VariableDeclaration | undefined
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'ROUTES') {
      assert.equal(declaration, undefined, `${path}: ROUTES must be declared once`)
      declaration = node
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  const initializer = declaration?.initializer
  assert(initializer && ts.isArrayLiteralExpression(initializer), `${path}: ROUTES must remain a literal array`)
  const rows = initializer.elements.map(element => {
    assert(ts.isArrayLiteralExpression(element) && element.elements.length === 2, `${path}: route tuple structure changed`)
    return element.elements.map(value => { assert(ts.isStringLiteral(value), `${path}: route tuple must remain literal`); return value.text })
  })
  return { rows, driver: source.slice(0, initializer.getStart(file)) + '<ROUTES retirement only>' + source.slice(initializer.end) }
}

function routeOf(row: string[]): string {
  const paths = row.filter(value => value.startsWith('/'))
  assert.equal(paths.length, 1, 'each route tuple must identify exactly one absolute route')
  return paths[0]
}

function assertRetirementOnly(previous: string, current: string, path: string): string[][] {
  const before = routes(previous, path), after = routes(current, path)
  assert.equal(after.driver, before.driver, `${path}: legacy driver changed outside ROUTES; route-only contract cannot cover it`)
  assert.deepEqual(after.rows, before.rows.filter(row => !isRetired(routeOf(row))), `${path}: changes must only remove the six retired objects and their BOM detail route, preserving every current tuple and its order`)
  assert.equal(new Set(after.rows.map(routeOf)).size, after.rows.length, `${path}: duplicate route`)
  assert(after.rows.every(row => !isRetired(routeOf(row))), `${path}: retired entrance remains`)
  return after.rows
}

function registeredPmsRoutes(): Set<string> {
  const file = ts.createSourceFile('src/router/routes-pms.ts', readFileSync('src/router/routes-pms.ts', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const registered = new Set<string>()
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node) && node.name.getText(file) === 'exactRoutes' && ts.isObjectLiteralExpression(node.initializer)) {
      for (const property of node.initializer.properties) {
        assert(ts.isPropertyAssignment(property) && ts.isStringLiteral(property.name), 'PMS exact route key must remain literal')
        registered.add(property.name.text)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  assert(registered.size > 0, 'current PMS exact route registry missing')
  return registered
}

for (const path of FILES) test(`${path}: only retired ROUTES removed; retained routes remain registered; legacy driver unexecuted`, () => {
  const previous = execFileSync('git', ['show', `HEAD:${path}`], { encoding: 'utf8' })
  const rows = assertRetirementOnly(previous, readFileSync(path, 'utf8'), path)
  const registered = registeredPmsRoutes()
  for (const row of rows) {
    const route = routeOf(row)
    if (route === '/fcs/craft/dyeing/work-orders') {
      assert.equal(path, 'tests/pms-style-screenshots.spec.ts', 'reference route belongs only to the style driver')
      assert.equal(row[0], 'dye-work-orders(fcs-reference)', 'existing reference identity changed')
    } else assert(registered.has(route), `${path}: retained route ${route} is not registered in the current PMS system`)
  }
})

test('route-only coverage rejects driver changes instead of pretending the old browser driver ran', () => {
  const path = FILES[0], source = readFileSync(path, 'utf8')
  const modified = source.replace('await page.goto(route)', "await page.goto('/pms/units')")
  assert.notEqual(modified, source, 'negative fixture must change actual driver code')
  assert.throws(() => assertRetirementOnly(source, modified, path), /driver changed outside ROUTES/)
})

test('route-only coverage rejects a new retired entrance, selector change, or route reordering', () => {
  const path = FILES[0], source = readFileSync(path, 'utf8')
  for (const modified of [
    source.replace('/pms/purchase-suggestions', '/pms/material-archives'),
    source.replace('[data-pms-psk-root]', '[data-pms-unknown-root]'),
    source.replace("['/pms/purchase-suggestions', '[data-pms-psk-root]'],\n  ['/pms/kol-demands', '[data-pms-kol-root]']", "['/pms/kol-demands', '[data-pms-kol-root]'],\n  ['/pms/purchase-suggestions', '[data-pms-psk-root]']"),
  ]) {
    assert.notEqual(modified, source, 'negative fixture must change actual route contract')
    assert.throws(() => assertRetirementOnly(source, modified, path), /changes must only remove/)
  }
})
