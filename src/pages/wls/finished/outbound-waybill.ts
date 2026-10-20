import type { FinishedOutboundOrder } from '../../../data/wls/finished-outbound-orders.ts'

// 本页演示面单，不包含线上收件资料或承运商有效条码。
export function createOutboundWaybillPdf(orders: readonly FinishedOutboundOrder[]): Uint8Array {
  if (!orders.length) throw new Error('请选择出库单')
  const hex = (value: string) => [...value].map(char => char.charCodeAt(0).toString(16).padStart(4, '0')).join('')
  const objects: string[] = []
  objects.push('<< /Type /Catalog /Pages 2 0 R >>', '')
  objects.push('<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [4 0 R] >>')
  objects.push('<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> >>')
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const pages: number[] = []
  for (const order of orders) {
    const lines = [
      'HiGood 演示面单', '仅供原型演示，不用于真实发货', '',
      `出库单号：${order.outboundOrderNo}`, `关联单号：${order.relatedOrderNo}`,
      `跟踪单号：${order.trackingNo || '未分配'}`, `出库仓库：${order.warehouse}`,
      `平台：${order.platform}`, `订单类型：${order.orderType}`, '',
      ...order.products.flatMap(product => [`SPU：${product.spu}`, `SKU：${product.sku}`, `数量：${product.quantity} 件`]),
      '', `合计：${order.products.reduce((sum, product) => sum + product.quantity, 0)} 件`,
      '收件资料：演示文件不提供真实收件资料',
    ]
    // 按页切分，避免多 SKU 或长单号截断。每页保留演示用途标题。
    const wrapped = lines.flatMap(line => {
      const parts: string[] = []; let part = ''; let width = 0
      for (const char of line) { const size = char.charCodeAt(0) < 128 ? 0.5 : 1; if (width + size > 27) { parts.push(part); part = ''; width = 0 }; part += char; width += size }
      parts.push(part); return parts
    })
    for (let offset = 0; offset < wrapped.length; offset += 24) {
      const pageId = objects.length + 1
      const contentId = pageId + 1
      pages.push(pageId)
      const chunk = wrapped.slice(offset, offset + 24)
      const text = (line: string) => (line.match(/[^\x00-\x7f]+|[\x00-\x7f]+/g) || []).map(run => run.charCodeAt(0) < 128 ? `/F2 11 Tf (${run.replace(/[\\()]/g, '\\$&')}) Tj` : `/F1 11 Tf <${hex(run)}> Tj`).join(' ')
      const stream = `BT 28 475 Td 18 TL ${chunk.map((line, index) => `${index ? 'T* ' : ''}${text(line)}`).join('\n')} ET`
      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 360 510] /Resources << /Font << /F1 3 0 R /F2 5 0 R >> >> /Contents ${contentId} 0 R >>`)
      objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
    }
  }
  objects[1] = `<< /Type /Pages /Kids [${pages.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((body, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${body}\nendobj\n` })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(pdf)
}
