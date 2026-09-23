import assert from 'node:assert/strict'

import { getProjectStepDefinition } from '../src/data/pcs-project-domain-contract.ts'

const projectInitContract = getProjectStepDefinition('PROJECT_INIT')
const albumField = projectInitContract.fieldDefinitions.find((field) => field.fieldKey === 'projectAlbumUrls')

assert.ok(albumField, '商品项目立项应保留参考图片字段')
assert.equal(albumField?.label, '参考图片', '商品项目立项字段标签应改为参考图片')
assert.equal(albumField?.type, 'image', '商品项目立项图片字段不应再是文本域')

console.log('pcs-project-init-no-reference-link-input.spec.ts PASS')
