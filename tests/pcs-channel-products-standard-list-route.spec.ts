import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { resetProjectChannelProductRepository } from '../src/data/pcs-channel-product-project-repository.ts'
import { resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import { resolvePage } from '../src/router/routes.ts'

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const pageSource = readFileSync(resolve(repositoryRoot, 'src/pages/pcs-channel-products.ts'), 'utf8')
const handlerSource = readFileSync(resolve(repositoryRoot, 'src/main-handlers/pcs-handlers.ts'), 'utf8')

assert.match(pageSource, /^\/\/ @page-pattern: list/m)
assert.match(pageSource, /renderStandardListPage/)
assert.match(pageSource, /renderStandardListTable/)
assert.match(pageSource, /renderTablePagination/)
assert.match(pageSource, /renderStandardListColumnSettings/)
assert.doesNotMatch(pageSource, /工作项节点|项目模板|模板阶段/)
assert.match(handlerSource, /pcs-channel-products/)
assert.match(handlerSource, /handlePcsChannelProductListEvent/)
assert.match(handlerSource, /handlePcsChannelProductListInput/)

resetProjectRepository()
resetStyleArchiveRepository()
resetProjectChannelProductRepository()

const listHtml = await resolvePage('/pcs/products/channel-products')
assert.match(listHtml, /data-standard-list-page/)
assert.match(listHtml, /data-standard-list-table/)
assert.match(listHtml, /data-table-pagination/)
assert.match(listHtml, /渠道店铺商品/)

const detailMatch = /\/pcs\/products\/channel-products\/([^"'/?]+)/.exec(listHtml)
assert.ok(detailMatch, '列表必须保留渠道商品详情入口')
const detailHtml = await resolvePage(`/pcs/products/channel-products/${detailMatch[1]}`)
assert.match(detailHtml, /来源项目步骤/)
assert.doesNotMatch(detailHtml, /工作项节点/)

console.log('pcs-channel-products-standard-list-route.spec.ts PASS')
