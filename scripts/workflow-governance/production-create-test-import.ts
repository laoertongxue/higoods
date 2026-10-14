import ts from 'typescript'

const ORIGINAL = '../src/data/fcs/production-orders.ts'
const CREATE = '../src/data/fcs/production-order-create.ts'
const BUILDERS = new Set(['buildProductionOrderFromSeed', 'buildProductionOrderFromDemand', 'buildProductionOrderFromDemands'])

/** Only the exact internal builder import relocation is equivalent. Test bodies stay byte-identical. */
export function isProductionCreateImportOnly(before: string, after: string): boolean {
  function inspect(source: string, migrated: boolean) {
    const ast = ts.createSourceFile('test.ts', source, ts.ScriptTarget.Latest, true)
    if ((ast as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length) return null
    const imports = ast.statements.filter(ts.isImportDeclaration)
    const unrelated: string[] = [], original: string[] = [], builders: string[] = []
    const order: string[] = []
    for (const node of imports) {
      const path = ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : ''
      if (path !== ORIGINAL && path !== CREATE) { unrelated.push(node.getText(ast)); order.push(node.getText(ast)); continue }
      if (node.attributes) return null
      order.push(path)
      const bindings = node.importClause?.namedBindings
      if (!bindings || !ts.isNamedImports(bindings) || node.importClause?.name || node.importClause?.isTypeOnly) return null
      if (path === CREATE && !migrated) return null
      for (const item of bindings.elements) {
        const name = item.propertyName?.text || item.name.text
        if (BUILDERS.has(name)) {
          if (migrated && path !== CREATE) return null
          builders.push(item.getText(ast))
        } else {
          if (path === CREATE) return null
          original.push(item.getText(ast))
        }
      }
    }
    let body = source
    for (const node of [...imports].reverse()) body = body.slice(0, node.getStart(ast)) + body.slice(node.end)
    if (migrated) {
      const createIndex = order.indexOf(CREATE), originalIndex = order.indexOf(ORIGINAL)
      if (createIndex !== originalIndex + 1 || originalIndex < 0
        || order.lastIndexOf(CREATE) !== createIndex || order.lastIndexOf(ORIGINAL) !== originalIndex) return null
      order.splice(createIndex, 1)
    }
    return { body: body.trim(), unrelated, original, builders, order }
  }
  const left = inspect(before, false), right = inspect(after, true)
  return Boolean(left && right && left.builders.length > 0 && right.builders.length > 0
    && left.body === right.body && JSON.stringify(left.unrelated) === JSON.stringify(right.unrelated)
    && JSON.stringify(left.original) === JSON.stringify(right.original)
    && JSON.stringify(left.order) === JSON.stringify(right.order)
    && JSON.stringify(left.builders) === JSON.stringify(right.builders))
}
