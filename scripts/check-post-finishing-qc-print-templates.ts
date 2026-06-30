#!/usr/bin/env node

import { buildPrintDocument, renderPrintDocument } from '../src/data/fcs/print-template-registry.ts'
import { renderPostFinishingQcOrdersPage } from '../src/pages/process-factory/post-finishing/qc-orders.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function assertIncludes(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertRealImages(html: string, message: string): void {
  assert(/<img\b/i.test(html), `${message}：缺少图片`)
  assert(!html.includes('/placeholder.svg'), `${message}：不能使用 placeholder.svg`)
  assert(!html.includes('placehold.co'), `${message}：不能使用 placehold.co 占位图`)
  assert(!html.includes('data:image/svg+xml'), `${message}：不能使用数据 SVG 占位图`)
}

const masterDocument = buildPrintDocument({
  documentType: 'PRODUCTION_QC_MASTER' as never,
  sourceType: 'POST_FINISHING_TASK' as never,
  sourceId: 'POST-TASK-202603-0006',
})
const masterHtml = renderPrintDocument(masterDocument)

assert(masterDocument.documentTitle === '生产单质检总单', '生产单质检总单模板未注册')
assertIncludes(masterHtml, '生产单质检总单（Pemeriksaan Kualitas Produksi）', '总单标题不符合上传样式')
assertIncludes(masterHtml, '款号SPU(Satuan Pembelian)', '总单缺少款号 SPU 字段')
assertIncludes(masterHtml, '款式评级（Gaya penilaian）', '总单缺少款式评级字段')
assertIncludes(masterHtml, '生产单号（Nomor produksi tunggal）', '总单缺少生产单号字段')
assertIncludes(masterHtml, '工厂名字（Nama pabrik）', '总单缺少工厂名字字段')
assertIncludes(masterHtml, '产品图（Gambar Produk）', '总单缺少产品图字段')
assertIncludes(masterHtml, '面辅料（pakaian &amp; aksesori）', '总单缺少面辅料区')
assertIncludes(masterHtml, '尺码表（Graf ukuran）', '总单缺少尺码表区')
assertIncludes(masterHtml, 'Panjang punggung tengah', '总单尺码表缺少印尼语表头')
assertRealImages(masterHtml, '总单')

const qcDocument = buildPrintDocument({
  documentType: 'POST_FINISHING_QC_ORDER' as never,
  sourceType: 'POST_FINISHING_QC_ORDER' as never,
  sourceId: 'PF-QC-003',
})
const qcHtml = renderPrintDocument(qcDocument)

assert(qcDocument.documentTitle === '质检单', '质检单模板未注册')
assertIncludes(qcHtml, '质检单（Pemeriksaan Kualitas）', '质检单标题不符合上传样式')
assertIncludes(qcHtml, '款号SPU(Satuan Pembelian)', '质检单缺少款号 SPU 字段')
assertIncludes(qcHtml, '打印时间（Print Time）', '质检单缺少打印时间字段')
assertIncludes(qcHtml, '生产单号（Nomor produksi tunggal）', '质检单缺少生产单号字段')
assertIncludes(qcHtml, '工厂名字（Nama pabrik）', '质检单缺少工厂名字字段')
assertIncludes(qcHtml, 'SKU列表（Daftar SKU）', '质检单缺少 SKU 列表')
assertIncludes(qcHtml, '待质检数量(Tes kualitas diperlukan)', '质检单缺少待质检数量字段')
assertIncludes(qcHtml, '质检数量(Kualitas sudah diperiksa)', '质检单缺少质检数量字段')
assertIncludes(qcHtml, '日期签名(Date &amp; Tandatangan)', '质检单缺少日期签名字段')
assertIncludes(qcDocument.qrCodes[0]?.value || '', '/fcs/pda/exec/', '质检单扫码目标必须进入 PDA')
assertIncludes(qcDocument.qrCodes[0]?.value || '', 'postMobileAction=complete-qc', '质检单扫码目标必须直达完成质检')

;(globalThis as any).window = {
  location: {
    pathname: '/fcs/craft/post-finishing/qc-orders',
    search: '?tab=qc&postTaskId=POST-TASK-202603-0006',
  },
}
const qcPageHtml = renderPostFinishingQcOrdersPage()
delete (globalThis as any).window

assertIncludes(qcPageHtml, 'documentType=PRODUCTION_QC_MASTER', 'Web 页面缺少生产单质检总单打印入口')
assertIncludes(qcPageHtml, 'documentType=POST_FINISHING_QC_ORDER', 'Web 页面缺少质检单打印入口')

;(globalThis as any).window = {
  location: {
    pathname: '/fcs/craft/post-finishing/qc-orders',
    search: '?tab=qc',
  },
}
const generalQcPageHtml = renderPostFinishingQcOrdersPage()
delete (globalThis as any).window

assertIncludes(generalQcPageHtml, '打印生产单质检总单', '普通质检单列表缺少生产单质检总单打印入口')
assertIncludes(generalQcPageHtml, 'documentType=PRODUCTION_QC_MASTER', '普通质检单列表缺少生产单质检总单打印链接')
assertIncludes(generalQcPageHtml, 'documentType=POST_FINISHING_QC_ORDER', '普通质检单列表缺少质检单打印入口')

console.log('post finishing qc print template checks passed')
