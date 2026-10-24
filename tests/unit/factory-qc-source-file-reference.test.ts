import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { pcsFileReferences } from '../../src/data/pcs-record-db.ts'
import { registerPcsFile, getPcsDurableFileReference, releasePcsPendingFile } from '../../src/data/pcs-record-runtime.ts'

function compactBoundary() {
  const file = new URL('../../src/data/fcs/factory-qc-records.ts', import.meta.url), source = readFileSync(file, 'utf8')
  const ast = ts.createSourceFile('factory-qc-records.ts', source, ts.ScriptTarget.Latest, true)
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'compactSource')!
  let body = fn.getText(ast)
  assert.ok(body.includes("import('../pcs-record-runtime.ts')"))
  body = body.replace("import('../pcs-record-runtime.ts')", 'loadPcsFileReferences()')
  const compiled = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  let copied = 0
  const compact = new Function('files', 'urls', 'fetch', 'loadPcsFileReferences', `${compiled}; return compactSource`)(new Map(), new Map(), () => { copied++; throw new Error('a durable source must not be copied') }, async () => ({ getPcsDurableFileReference }))
  return { compact, copies: () => copied }
}

test('AC-034/040: QC source and handfeel snapshots reuse an existing PCS original file ID rather than storing the image bytes again', async () => {
  const id = 'qc-source-reference-' + crypto.randomUUID(), blob = new Blob(['original-image-bytes'], { type: 'image/png' })
  const reference = registerPcsFile(blob, id), { compact, copies } = compactBoundary(), files: unknown[] = []
  try {
    const saved = await compact({ source: { imageUrl: reference.url }, referenceImageUrl: reference.url }, files)
    assert.deepEqual(saved, { source: { imageUrl: 'pcs-file:' + id }, referenceImageUrl: 'pcs-file:' + id })
    assert.deepEqual(files, [])
    assert.equal(copies(), 0)
  } finally { releasePcsPendingFile(id) }
})


test('AC-033/034: static source attachment identities retain their actual URL and are never treated as missing user Blob files', async () => {
  const { compact, copies } = compactBoundary(), newFiles: unknown[] = []
  const source = { professionalResultAttachments: [{ fileId: 'COLOR-0001-1', fileName: '调色结果.jpg', mimeType: 'image/jpeg', sizeBytes: 148620, dataUrl: '/materials/process-orders/fog-blue-woven.png' }] }
  const saved = await compact(source, newFiles)
  assert.deepEqual(saved, { professionalResultAttachments: [{ ...source.professionalResultAttachments[0], fileStorage: 'static' }] })
  assert.deepEqual([...pcsFileReferences(saved)], []); assert.deepEqual(newFiles, []); assert.equal(copies(), 0)
})

test('a missing durable source file remains an explicit required reference; a static marker cannot disguise pcs-file or absent URL', async () => {
  const { compact } = compactBoundary()
  for (const dataUrl of ['pcs-file:missing-original', '']) {
    const saved = await compact({ fileId: 'missing-original', dataUrl }, [])
    assert.equal(saved.fileStorage, undefined)
    assert.deepEqual([...pcsFileReferences(saved)], ['missing-original'])
  }
})
