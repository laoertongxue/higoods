import assert from 'node:assert/strict'

import { getProjectWorkItemContract } from '../src/data/pcs-project-domain-contract.ts'
import { renderPcsProjectCreatePage } from '../src/pages/pcs-projects.ts'

const createHtml = await renderPcsProjectCreatePage()
const projectInitContract = getProjectWorkItemContract('PROJECT_INIT')
const albumField = projectInitContract.fieldDefinitions.find((field) => field.fieldKey === 'projectAlbumUrls')
const legacyLinkPattern = new RegExp(['项目图册链接', '参考图片链接', '每行一个链接'].join('|'))

assert.ok(albumField, '商品项目立项应保留参考图片字段')
assert.equal(albumField?.label, '参考图片', '商品项目立项字段标签应改为参考图片')
assert.equal(albumField?.type, 'image', '商品项目立项图片字段不应再是文本域')
assert.doesNotMatch(createHtml, legacyLinkPattern, '创建页不应再显示图片链接输入文案')
assert.match(createHtml, /上传参考图片/, '创建页应显示上传参考图片文案')

console.log('pcs-project-init-no-reference-link-input.spec.ts PASS')
