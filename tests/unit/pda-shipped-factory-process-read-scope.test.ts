import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function setup() {
  const text = readFileSync(new URL('../../src/data/fcs/factory-qc-records.ts', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('factory-qc-records.ts', text, ts.ScriptTarget.Latest, true)
  const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'ensureFactoryQcRecords')!
  const code = ts.transpileModule(node.getText(ast).replace('export ', '').replaceAll('import(', 'loadModule('), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const calls: string[] = []
  const old = { id: 'process/B', collection: 'process', version: 1, value: { quantity: 4 } }
  const fresh = { ...old, version: 2, value: { quantity: 7 } }
  const deps: any = {
    loaded: false, saving: false, records: new Map([[old.id, old]]), files: new Map(), readFailure: '',
    QC_COLLECTION: 'qc', HAND_FEEL_COLLECTION: 'handfeel', PROCESS_COLLECTION: 'process', PCS_FCS_COLLECTIONS: ['original-fcs'],
    hydrateDesignRevisionFcsCaches: () => calls.push('refresh-process-cache'),
    readPcsRecords: async (keys: string[]) => { calls.push('read:' + keys.join(',')); return { records: [fresh], files: [] } },
    loadModule: async (path: string) => path.includes('pcs-record-runtime')
      ? { ensurePcsRecordState: async () => calls.push('pcs') }
      : { hydratePostFinishingProductionContextRecords: async () => calls.push('seven-sources'), hydrateProductionContextRecords: async () => calls.push('complete-writer-source') },
  }
  const api = new Function('deps', `with(deps){${code};return ensureFactoryQcRecords}`)(deps)
  return { deps, calls, api }
}

test('共享已交出读取新加工事实桥及实际版本，不把七类来源当作完整写入准备', async () => {
  const f = setup()
  await f.api(true, true)
  assert.deepEqual(f.calls, ['pcs', 'seven-sources', 'read:qc,handfeel,process', 'refresh-process-cache'])
  assert.equal(f.deps.records.get('process/B').value.quantity, 7)
  assert.equal(f.deps.loaded, false)
  await f.api()
  assert.ok(f.calls.includes('complete-writer-source'))
  assert.equal(f.deps.loaded, true)
})

test('共享读取失败保留原记录，实际保存锁仍阻断；不回退旧洗水来源', async () => {
  const f = setup(), before = f.deps.records
  f.deps.readPcsRecords = async () => { throw Error('original read failure') }
  await assert.rejects(f.api(true, true), /original read failure/)
  assert.equal(f.deps.records, before)
  assert.equal(f.deps.loaded, false)
  assert.match(f.deps.readFailure, /original read failure/)
  f.deps.saving = true
  await assert.rejects(f.api(true, true), /上一笔加工或质检记录正在保存/)
})
