import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

import { listDyeWorkOrderOnlineRows } from '../src/data/fcs/dye-work-order-online-view.ts'
import {
  DYE_ORDER_IMAGE_MANIFEST,
  PRINTING_ORDER_IMAGE_MANIFEST,
  WATER_SOLUBLE_ORDER_IMAGE_MANIFEST,
  getWaterSolubleOrderImageManifest,
} from '../src/data/fcs/process-order-image-manifest.ts'
import { listPrintingWorkOrders } from '../src/data/fcs/printing-work-order-business.ts'
import { listWaterSolubleWorkOrders } from '../src/data/fcs/water-soluble-task-domain.ts'

const projectRoot = process.cwd()

function assertRealLocalImage(label: string, url: string): void {
  assert.ok(url.startsWith('/'), `${label} 必须使用 public/ 下的稳定本地图片：${url || '空'}`)
  assert.doesNotMatch(url, /placeholder|missing|default|\.svg(?:$|\?)/i, `${label} 不能使用占位图：${url}`)
  const file = resolve(projectRoot, 'public', url.slice(1))
  assert.ok(existsSync(file), `${label} 图片文件不存在：${file}`)
  assert.ok(statSync(file).size >= 20 * 1024, `${label} 图片文件过小，不能作为真实对象图片：${file}`)
}

for (const [orderId, images] of Object.entries(PRINTING_ORDER_IMAGE_MANIFEST)) {
  assertRealLocalImage(`${orderId} 商品`, images.product)
  assertRealLocalImage(`${orderId} 加工投入`, images.input)
  assertRealLocalImage(`${orderId} 加工产出`, images.output)
  assertRealLocalImage(`${orderId} 正面花型`, images.frontPattern)
  if (images.insidePattern) assertRealLocalImage(`${orderId} 里面花型`, images.insidePattern)
}

for (const order of listPrintingWorkOrders()) {
  const manifest = PRINTING_ORDER_IMAGE_MANIFEST[order.workOrderId]
  assert.ok(manifest, `${order.printOrderNo} 缺少图片清单`)
  const images = [order.product, order.plannedInput, order.output, order.requirement.frontPattern, order.requirement.insidePattern]
    .filter((image): image is NonNullable<typeof image> => Boolean(image))
  images.forEach((image) => assertRealLocalImage(`${order.printOrderNo} ${image.imageAlt}`, image.imageUrl))
}

for (const [orderId, images] of Object.entries(DYE_ORDER_IMAGE_MANIFEST)) {
  assertRealLocalImage(`${orderId} 商品`, images.product)
  assertRealLocalImage(`${orderId} 加工投入`, images.material)
}

for (const row of listDyeWorkOrderOnlineRows()) {
  assert.notEqual(row.productCode, '—', `${row.workOrderNo} 商品编码未关联生产单或备货物料`)
  assert.notEqual(row.productName, '商品名称待补齐', `${row.workOrderNo} 商品名称未关联生产单或备货物料`)
  assertRealLocalImage(`${row.workOrderNo} ${row.productCode} 商品`, row.productImageUrl)
  assertRealLocalImage(`${row.workOrderNo} ${row.materialName}`, row.materialImageUrl)
}

for (const [orderId, images] of Object.entries(WATER_SOLUBLE_ORDER_IMAGE_MANIFEST)) {
  assert.equal(images.product, '/tshirt-sample.jpg', `${orderId} 应显示对应 T 恤商品图`)
  assert.equal(images.material, '/materials/process-orders/white-water-soluble-lace-12-15mm.jpg', `${orderId} 应显示水溶花边实物图`)
  assertRealLocalImage(`${orderId} 商品`, images.product)
  assertRealLocalImage(`${orderId} 水溶投入`, images.material)
}

for (const order of listWaterSolubleWorkOrders()) {
  const images = getWaterSolubleOrderImageManifest(order.waterOrderId)
  assert.ok(images, `${order.waterOrderNo} 缺少图片清单`)
  assertRealLocalImage(`${order.waterOrderNo} 商品`, images.product)
  assertRealLocalImage(`${order.waterOrderNo} ${order.materialName}`, images.material)
}

const imagePreviewSources = [
  'src/pages/process-factory/printing/work-orders.ts',
  'src/pages/process-factory/printing/work-order-detail.ts',
  'src/pages/process-factory/dyeing/work-orders.ts',
  'src/pages/process-factory/dyeing/work-order-overlays.ts',
  'src/pages/process-factory/dyeing/water-soluble-orders.ts',
  'src/pages/process-water-soluble-orders.ts',
]

for (const relativePath of imagePreviewSources) {
  const source = readFileSync(resolve(projectRoot, relativePath), 'utf8')
  assert.match(source, /preview-image|data-pda-image-preview-url/, `${relativePath} 缺少点击查看大图入口`)
  assert.match(source, /图片加载失败/, `${relativePath} 缺少图片失败提示`)
}

const genericPreview = readFileSync(resolve(projectRoot, 'src/components/ui/pda-image-preview.ts'), 'utf8')
assert.match(genericPreview, /max-h-\[calc\(100vh-8rem\)\]/, '通用大图预览必须限制视口高度')
assert.match(genericPreview, /data-pda-image-preview-close/, '通用大图预览必须支持关闭按钮和遮罩关闭')

const printingEvents = readFileSync(resolve(projectRoot, 'src/pages/process-factory/printing/events.ts'), 'utf8')
assert.match(printingEvents, /event\.key !== 'Escape'/, '印花大图预览必须支持 Esc 关闭')

console.log(`生产工艺加工单真实图片检查通过：印花 ${listPrintingWorkOrders().length} 单、染色 ${listDyeWorkOrderOnlineRows().length} 单、水溶 ${listWaterSolubleWorkOrders().length} 单。`)
