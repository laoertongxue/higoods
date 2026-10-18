import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import ts from 'typescript'

const root = resolve(import.meta.dirname, '../..')
const config = readFileSync(resolve(root, 'vite.config.ts'), 'utf8')
const ast = ts.createSourceFile('vite.config.ts', config, ts.ScriptTarget.Latest, true)
const declarations = ast.statements.filter(node =>
  (ts.isVariableStatement(node) && node.declarationList.declarations.some(item => item.name.getText(ast) === 'craftStartupChunkGroups'))
  || (ts.isFunctionDeclaration(node) && node.name?.text === 'craftStartupChunkName'))
const javascript = ts.transpileModule(declarations.map(node => node.getText(ast)).join('\n'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText
const { groups, chunkName } = new Function(`${javascript}; return { groups: craftStartupChunkGroups, chunkName: craftStartupChunkName }`)() as {
  groups: Record<string, string[]>; chunkName: (id: string) => string | undefined
}

test('startup packs name each real source once and exclude virtual, CSS and unknown module identities', () => {
  const sources = Object.values(groups).flat()
  assert.equal(new Set(sources).size, sources.length, 'a source cannot acquire two chunk owners')
  for (const source of sources) {
    assert.ok(source.startsWith('/src/'), source)
    assert.ok(existsSync(resolve(root, source.slice(1).split('?')[0])), source)
    assert.ok(chunkName(root + source), source)
    assert.equal(chunkName('\0' + root + source), undefined, 'virtual proxies must keep their actual owning entry')
    assert.equal(chunkName(root + source + '?unrelated-proxy'), undefined, 'do not coalesce unregistered query variants')
  }
  assert.equal(chunkName(root + '/src/styles.css'), undefined)
  assert.equal(chunkName(root + '/src/styles.css?used'), undefined)
  assert.equal(chunkName(root + '/src/unregistered-page.ts'), undefined)
})

test('no main static source dependency may pull the craft packs into the shell', () => {
  const visited = new Set<string>()
  const compilerOptions: ts.CompilerOptions = { moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, allowJs: true }
  const visit = (file: string): void => {
    if (visited.has(file) || !/\.[cm]?[jt]sx?$/.test(file)) return
    visited.add(file)
    assert.equal(chunkName(file), undefined, `main static dependency was assigned to a craft pack: ${file}`)
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue
      if (!statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue
      if (ts.isImportDeclaration(statement)) {
        const clause = statement.importClause
        if (clause?.isTypeOnly) continue
        if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)
          && !clause.name && clause.namedBindings.elements.every(item => item.isTypeOnly)) continue
      } else if (statement.isTypeOnly) continue
      const specifier = statement.moduleSpecifier.text
      if (!specifier.startsWith('.')) continue
      const resolved = ts.resolveModuleName(specifier, file, compilerOptions, ts.sys).resolvedModule?.resolvedFileName
      if (resolved && resolved.startsWith(resolve(root, 'src') + '/')) visit(resolved)
    }
  }
  visit(resolve(root, 'src/main.ts'))
  assert.ok(visited.size > 1, 'the check must traverse the shell dependency graph')
})
