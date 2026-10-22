import assert from 'node:assert/strict'
import test from 'node:test'
import { pcsFileReferences } from '../../src/data/pcs-record-db.ts'

test('附件引用：空数组与共用分支不丢失相邻原始附件引用', () => {
  const empty: unknown[] = []
  const branch = { references: ['pcs-file:photo-original'], unused: empty }
  assert.deepEqual([...pcsFileReferences({ standards: [empty, branch, branch], paper: 'pcs-file:paper-original' })].sort(), ['paper-original', 'photo-original'])
})

test('附件引用：空数组自有附件编号仍受删除保护，包括不可枚举编号', () => {
  const visible: unknown[] & { fileId?: string } = []
  visible.fileId = 'visible-file'
  const hidden: unknown[] = []
  Object.defineProperty(hidden, 'fileId', { value: 'hidden-file', enumerable: false })
  assert.deepEqual([...pcsFileReferences([visible, hidden])].sort(), ['hidden-file', 'visible-file'])
})

test('附件引用：静态文件元数据和已有裸编号仍遵循原规则', () => {
  const staticFile = Object.assign([], { fileId: 'static-image', fileStorage: 'static', dataUrl: '/tshirt-sample.jpg' })
  assert.deepEqual([...pcsFileReferences({ staticFile, existing: ['kept-blob'] }, new Set(['kept-blob']))], ['kept-blob'])
})

test('附件引用：空分支不绕过内联字节及Blob校验，循环引用仍终止', () => {
  assert.throws(() => pcsFileReferences({ empty: [], values: ['DATA:image/png;base64,AAAA'] }), /Base64/)
  assert.throws(() => pcsFileReferences([[], new Blob(['original bytes'])]), /原始 Blob|文件仓库/)
  const cycle: unknown[] = []
  cycle.push(cycle, 'pcs-file:cycle-file')
  assert.deepEqual([...pcsFileReferences(cycle)], ['cycle-file'])
})

test('附件引用：零长度数组的自定义迭代仍检查引用和非法附件字节', () => {
  const own: unknown[] = []
  Object.defineProperty(own, Symbol.iterator, { value: function* () { yield 'pcs-file:iterator-file' } })
  assert.deepEqual([...pcsFileReferences(own)], ['iterator-file'])
  const inherited: unknown[] = []
  Object.setPrototypeOf(inherited, Object.assign(Object.create(Array.prototype), {
    *[Symbol.iterator]() { yield 'DATA:image/png;base64,AAAA' },
  }))
  assert.throws(() => pcsFileReferences(inherited), /Base64/)
})
