import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { createFeedbackSeed } from '../../src/data/product-feedback/mock.ts'
import { applyFeedbackCommand, currentClassification } from '../../src/data/product-feedback/model.ts'

function renderHistory() {
  const seed = createFeedbackSeed(), comment = seed.comments.find(c => c.id === 'feedback-comment-mock-5')!
  const reason = '反馈依据需补充，撤回后重新核对'
  const snapshot = applyFeedbackCommand(seed, { type: 'withdraw-classification', operationId: 'history-withdraw', actor: '小羊.高阳.kiko', at: '2026-10-24T01:00:00.000Z', commentId: comment.id, classificationId: comment.classifications[0].id, expectedVersion: comment.version, reason })
  snapshot.logs.push({ ...snapshot.logs[0], id: 'other-comment-log', objectId: 'different-comment', detail: '其他评论的撤回原因' })
  const source = readFileSync('src/pages/product-feedback/comments.ts', 'utf8'), file = ts.createSourceFile('comments.ts', source, ts.ScriptTarget.Latest, true)
  const fn = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'commentContent')
  assert.ok(fn)
  const code = ts.transpileModule(fn.getText(file), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  const dependencies = {
    prefix: 'feedback-comments', state: { snapshot }, current: () => snapshot.comments.find(c => c.id === comment.id), currentClassification,
    h: (value: unknown) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    notice: () => '', productCell: () => '', dateText: (value: string) => value, storeName: () => 'Asaya Ind', rating: () => '', btn: () => '',
  }
  const render = new Function(...Object.keys(dependencies), `${code}; return commentContent`)(...Object.values(dependencies))
  return { html: render({ id: comment.id, tab: 'history', error: '', confirm: false, withdraw: false }), reason }
}

test('classification history shows saved withdrawal reason, operator and time after readback', () => {
  const { html, reason } = renderHistory()
  assert.ok(html.includes(reason), 'history must expose the withdrawal reason already saved in the operation log')
  assert.ok(html.includes('撤回确认'))
  assert.ok(html.includes('小羊.高阳.kiko'))
  assert.ok(html.includes('2026-10-24T01:00:00.000Z'))
  assert.ok(html.includes('已撤回'))
})

test('classification operation history is scoped to the current comment', () => {
  const { html } = renderHistory()
  assert.ok(!html.includes('其他评论的撤回原因'))
})


test('withdrawal action is ordered by its own time before the older classification', () => {
  const { html } = renderHistory()
  assert.ok(html.indexOf('撤回确认') < html.indexOf('已撤回'), 'the newest withdrawal event must precede its earlier confirmation record')
})
