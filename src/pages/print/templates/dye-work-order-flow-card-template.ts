import { dyeTheoreticalWeight } from '../../../data/fcs/dye-work-order-demo-details.ts'
import { renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import {
  createPrintDocumentId,
  getPrintGeneratedAt,
  type PrintDocument,
  type PrintDocumentBuildInput,
  type PrintField,
} from '../../../data/fcs/print-service.ts'
import { listDyeWorkOrderOnlineRows, type DyeWorkOrderOnlineRow } from '../../../data/fcs/dye-work-order-online-view.ts'
import { escapeHtml } from '../../../utils.ts'

type FlowCardInput = PrintDocumentBuildInput | string

function resolveInput(input: FlowCardInput): PrintDocumentBuildInput {
  return typeof input === 'string'
    ? { documentType: 'TASK_ROUTE_CARD', sourceType: 'DYEING_WORK_ORDER', sourceId: input }
    : input
}

function formatQty(value: number, unit: string): string {
  return `${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${unit}`
}

function fields(rows: Array<[string, string, boolean?]>): PrintField[] {
  return rows.map(([label, value, emphasis]) => ({ label, value: value || '—', emphasis }))
}

function buildSingle(input: PrintDocumentBuildInput, row: DyeWorkOrderOnlineRow): PrintDocument {
  const generatedAt = getPrintGeneratedAt()
  const targetRoute = `/fcs/craft/dyeing/work-orders?dyeOrderId=${encodeURIComponent(row.dyeOrderId)}`
  const qrPayload = new URLSearchParams({
    documentType: 'TASK_ROUTE_CARD',
    sourceType: 'DYEING_WORK_ORDER',
    sourceId: row.dyeOrderId,
    workOrderNo: row.workOrderNo,
    targetRoute,
  }).toString()
  return {
    printDocumentId: createPrintDocumentId({ ...input, sourceId: row.dyeOrderId }, 'DYEING_WORK_ORDER_FLOW_CARD'),
    documentType: 'TASK_ROUTE_CARD',
    documentTitle: '染整生产流程卡',
    sourceType: 'DYEING_WORK_ORDER',
    sourceId: row.dyeOrderId,
    templateCode: 'DYEING_WORK_ORDER_FLOW_CARD',
    paperType: 'A4',
    orientation: 'portrait',
    printTitle: '染整生产流程卡',
    printSubtitle: 'Kartu Alur Produksi Pencelupan dan Penyempurnaan',
    headerFields: fields([
      ['卡序号 Urutan kartu', '1', true],
      ['平台加工单号', row.workOrderNo, true],
      ['下单日期 Tgl', row.orderedAt.split(' ')[0] || row.orderedAt],
      ['是否加急 Mendesak', '否 Tidak'],
      ['需求单号 No. Permintaan', row.purchaseOrderNo],
      ['面料接收人 Penerima kain', row.fabricReceiver],
      ['是否补料', row.isReplenishment ? '是' : '否'],
      ['开单日期 Tgl buka', generatedAt],
      ['生产单号 No. Produksi', row.productionOrderNo || '备货创建'],
    ]),
    imageBlocks: [
      { title: '投入物料', imageUrl: row.materialImageUrl, imageLabel: row.materialName, sourceLabel: '投入物料档案', fallbackLabel: '投入物料图待补充' },
      { title: '目标色样', imageUrl: row.sampleImageUrl, imageLabel: row.colorNo, sourceLabel: '原型留样效果图', fallbackLabel: '色样尚未提供' },
      { title: '商品 SPU', imageUrl: row.productImageUrl, imageLabel: row.productCode, sourceLabel: '商品资料', fallbackLabel: '暂无商品图' },
    ],
    qrCodes: [{ title: '染色加工单二维码', value: qrPayload, description: '扫码查看平台染色加工单', sizeMm: 32 }],
    barcodes: [],
    sections: [
      {
        sectionId: 'color-sample',
        title: '色样与商品信息 Informasi sampel warna dan produk',
        fields: fields([
          ['色样备注 Cat sampel', row.sampleNote],
          ['正式色样', row.targetColorName],
          ['辅料 GCC 色卡', '—'],
          ['TPG 色卡', '—'],
          ['TCX 色卡', '—'],
          ['样衣 SPU', row.isReplenishment ? '' : row.productCode],
          ['布料样品 SPU', row.rawMaterialSku],
          ['翻单 SPU', row.isReplenishment ? row.productCode : ''],
          ['批号 No. batch', row.batchNo],
        ]),
      },
      {
        sectionId: 'material',
        title: '原料信息 Informasi bahan baku',
        fields: fields([
          ['布料供应商', row.supplierName],
          ['原料名称 Nama bahan baku', row.materialName],
          ['色号 No. Warna', row.colorNo, true],
          ['原料 Bahan baku', row.rawMaterialSku, true],
          ['目标颜色 Warna', row.colorSku || row.targetColorName],
          ['重量 Berat (kg)', String(dyeTheoreticalWeight(row.plannedQty, row.qtyUnit, parseFloat(row.width), row.weightGsm || 0) ?? '不适用')],
          ['数量 Kuantitas (KG/Y)', formatQty(row.plannedQty, row.qtyUnit), true],
          ['卷数', row.materialType === '纱线' ? '不适用（按 pcs / kg 计量）' : '以实际卷记录为准'],
          ['成分 Komposisi', row.composition],
          ['幅宽 Lebar', row.materialType === '纱线' ? '不适用（纱线）' : row.width],
          ['克重 Berat (gram)', row.materialType === '纱线' ? '不适用（按纱支规格）' : row.weightGsm ? `${row.weightGsm}G` : '不适用'],
        ]),
      },
      {
        sectionId: 'quantity-and-handover',
        title: '投入产出与交接',
        fields: fields([
          ['已接收', row.receiptKnown ? formatQty(row.receivedInputQty, row.qtyUnit) : '历史接收待补录'],
          ['实际使用', row.usageKnown ? formatQty(row.rawMaterialQty, row.qtyUnit) : '待补录'],
          ['完成产出', formatQty(row.completedQty, row.qtyUnit)],
          ['确认损耗', row.lossKnown ? formatQty(row.lossQty, row.qtyUnit) : '待确认'],
          ['下游接收方', row.receiverName],
          ['接收仓库', row.receiverWarehouseName],
          ['已交出', formatQty(row.handedOverQty, row.qtyUnit)],
          ['下游已收', formatQty(row.downstreamReceivedQty, row.qtyUnit)],
          ['下游待接收', formatQty(row.pendingInboundQty, row.qtyUnit)],
        ]),
      },
      {
        sectionId: 'preparation',
        title: '备料 Persiapan bahan baku',
        fields: fields([
          ['松布 Pelonggaran kain', ''],
          ['装袋 Pengemasan ke dalam kantong', ''],
          ['卷支 Jumlah roll atau gulungan', ''],
          ['络筒 Penggulungan benang ke tabung', ''],
        ]),
      },
    ],
    tables: [
      {
        tableId: 'dye-flow-signoff',
        title: '现场流程签认 Proses dan tanda tangan lapangan',
        headers: ['工序 Proses', '开始时间 Waktu mulai', '完成时间 Waktu selesai', '操作人 Operator', '签字 Tanda tangan'],
        rows: [
          ['复样 Pencocokan sampel/duplikasi sampel', '', '', '', ''],
          ['染色 Pencelupan', '', '', '', ''],
          ['脱水 Penghilangan air', '', '', '', ''],
          ['开幅 Pembukaan kain', '', '', '', ''],
          ['烘干 Pengeringan', '', '', '', ''],
          ['定型 Finishing', '', '', '', ''],
          ['包装 Kemasan', '', '', '', ''],
          ['出货 Pengiriman', '', '', '', ''],
        ],
        minRows: 8,
      },
    ],
    signatureBlocks: [
      { label: '染厂主管签字', signerRole: 'Supervisor pencelupan' },
      { label: '面料接收人签字', signerRole: row.receiverName || 'Penerima kain' },
    ],
    differenceBlocks: [],
    footerFields: [
      { label: '备注 Catatan', value: row.remark || '—' },
      { label: '打印时间', value: generatedAt },
    ],
    printMeta: {
      generatedAt,
      generatedBy: '系统自动生成',
      printNotice: '打印前请在浏览器打印设置中关闭页眉和页脚',
      returnHref: targetRoute,
    },
    printVersionNo: 'V1',
    qrPayload,
  }
}

export function buildDyeWorkOrderFlowCardPrintDocument(input: FlowCardInput): PrintDocument {
  const resolved = resolveInput(input)
  const ids = resolved.sourceId.split(',').map((item) => item.trim()).filter(Boolean)
  if (!ids.length) throw new Error('缺少染色加工单 ID')
  const allRows = listDyeWorkOrderOnlineRows()
  const rows = ids.map((id) => allRows.find((row) => row.dyeOrderId === id)).filter((row): row is DyeWorkOrderOnlineRow => Boolean(row))
  if (rows.length !== ids.length) throw new Error('染色加工单不存在，无法打印流程卡')
  const document = buildSingle(resolved, rows[0]!)
  if (ids.length > 1) {
    document.sourceId = resolved.sourceId
    document.relatedObjectIds = ids
    document.batchPrintId = `DYE-FLOW-BATCH-${ids.join('-')}`
    document.printDocumentId = createPrintDocumentId(resolved, 'DYEING_WORK_ORDER_FLOW_CARD_BATCH')
  }
  return document
}

function renderSingle(document: PrintDocument, sequence = 1, total = 1): string {
  const values = [...document.headerFields, ...document.sections.flatMap(section => section.fields)]
  const field = (label: string) => escapeHtml(values.find(item => item.label === label)?.value.replace(/^—$/, '') || '')
  const supplement = field('是否补料') === '是'
  const qr = document.qrCodes[0]
  const picture = (title: string) => {
    const img = document.imageBlocks.find(item => item.title === title)
    return img?.imageUrl ? `<button type="button" class="dye-flow-image" data-skip-page-rerender="true" data-pda-image-preview-url="${escapeHtml(img.imageUrl)}" data-pda-image-preview-title="${escapeHtml(img.imageLabel || title)}" aria-label="查看${title}大图"><img src="${escapeHtml(img.imageUrl)}" alt="${escapeHtml(img.imageLabel || title)}" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败'"><span>加载中</span></button>` : '尚未提供'
  }
  const pair = (left: string, right: string) => `<tr class="dye-flow-sign"><th>${left}</th><td colspan="2"></td><th>${right}</th><td colspan="2"></td></tr>`
  return `<article class="dye-flow-card" data-dye-flow-source="${escapeHtml(document.sourceId)}" data-dye-flow-sequence="${sequence}">
    ${supplement ? '<div class="dye-flow-supplement">补料 / Bahan Tambahan</div>' : ''}
    <div class="dye-flow-heading"><span class="dye-flow-sequence">${sequence}</span><h1>染整生产流程卡<br><span>Kartu Alur Produksi<br>Pencelupan dan Penyempurnaan</span></h1>${qr ? renderRealQrPlaceholder({value: qr.value, size: 140, title: qr.title, label: ''}) : ''}${supplement ? '<div class="dye-flow-stamp">补料 / Bahan Tambahan</div>' : ''}</div>
    <div class="dye-flow-meta"><div><b>下单日期 Tgl</b> ${field('下单日期 Tgl')}</div><div><b>是否加急 Mendesak</b> ${field('是否加急 Mendesak')}</div><div><b>开单日期 Tgl buka</b> ${field('开单日期 Tgl buka')}</div><div><b>生产单号 No. Produksi</b> ${field('生产单号 No. Produksi')}</div><div class="dye-flow-meta-wide"><b>需求单号 No. Permintaan</b> ${field('需求单号 No. Permintaan')}</div><div class="dye-flow-meta-wide"><b>面料接收人 Penerima kain</b> ${field('面料接收人 Penerima kain')}</div></div>
    <table class="dye-flow-table"><colgroup>${'<col style="width:16.666%">'.repeat(6)}</colgroup><tbody>
      <tr><th rowspan="4">色样备注 Cat sampel${picture('目标色样')}<small>${field('正式色样')}</small></th><th colspan="2">纱线 RAINBOW 色卡</th><td></td><th>辅料 GCC 色卡</th><td></td></tr>
      <tr><th colspan="2">TPG 色卡</th><td></td><th>TCX 色卡</th><td></td></tr>
      <tr><th colspan="2">样衣 SPU</th><td><div class="dye-flow-ref">${field('样衣 SPU') ? picture('商品 SPU') : ''}<span>${field('样衣 SPU')}</span></div></td><th>布料样品 SPU</th><td><div class="dye-flow-ref">${picture('投入物料')}<span>${field('布料样品 SPU')}</span></div></td></tr>
      <tr><th colspan="2">翻单 SPU</th><td colspan="3"><div class="dye-flow-ref">${field('翻单 SPU') ? picture('商品 SPU') : ''}<span>${field('翻单 SPU')}</span></div></td></tr>
      <tr><th colspan="2">布料供应商</th><td>${field('布料供应商')}</td><th>批号</th><td colspan="2">${field('批号 No. batch')}</td></tr>
      <tr><th colspan="2">原料名称 Nama bahan baku</th><td colspan="4"><div class="dye-flow-material">${picture('投入物料')}<span>${field('原料名称 Nama bahan baku')}<br>${field('原料 Bahan baku')}</span></div></td></tr>
      <tr class="dye-flow-data"><th>色号 No. Warna</th><td class="dye-flow-red">${field('色号 No. Warna')}</td><th>原料 Bahan baku</th><td>${field('原料 Bahan baku')}</td><th>数量 Kuantitas<br>(KG/Y/M)</th><td>${field('数量 Kuantitas (KG/Y)')}</td></tr>
      <tr class="dye-flow-data"><th>印染单号 ID cetak</th><td class="dye-flow-red">${field('平台加工单号')}</td><th>颜色 Warna</th><td>${field('目标颜色 Warna')}</td><th>重量 Berat (kg)<small>理论换算</small></th><td class="dye-flow-red">${field('重量 Berat (kg)')}</td></tr>
      <tr class="dye-flow-data"><th>成分 Komposisi</th><td>${field('成分 Komposisi')}</td><th>幅宽 Lebar</th><td>${field('幅宽 Lebar')}</td><th>克重 Berat<br>(gram)</th><td>${field('克重 Berat (gram)')}</td></tr>
      <tr class="dye-flow-sign"><th rowspan="2">备料 Persiapan bahan baku</th><th colspan="2">松布 Pelonggaran kain</th><td></td><th>装袋 Pengemasan ke dalam kantong</th><td></td></tr>
      <tr class="dye-flow-sign"><th colspan="2">卷支 Jumlah roll atau gulungan</th><td></td><th>络筒 Penggulungan benang ke tabung</th><td></td></tr>
      ${pair('复样 Pencocokan sampel/duplikasi sampel','染色 Pencelupan')}${pair('脱水 Penghilangan air','开幅 Pembukaan kain')}${pair('烘干 Pengeringan','定型 Finishing')}${pair('包装 Kemasan','出货 Pengiriman')}
    </tbody></table><div class="dye-flow-note">${field('色样备注 Cat sampel')}<span>${sequence} / ${total}</span></div>
  </article>`
}

export function renderDyeWorkOrderFlowCardTemplate(document: PrintDocument): string {
  const ids = document.relatedObjectIds || [document.sourceId]
  const cards = ids.length === 1 ? renderSingle(document) : ids.map((id,index) => renderSingle(buildDyeWorkOrderFlowCardPrintDocument(id),index+1,ids.length)).join('')
  return `<style>
  .print-preview-root:has(.dye-flow-card){background:#e8eaed;padding:24px;min-height:100vh}
  .print-preview-root:has(.dye-flow-card) .print-preview-toolbar{max-width:640px;margin:0 auto 16px}
  .dye-flow-card{width:160mm;max-width:100%;margin:0 auto 24px;background:#fff;color:#25282c;border:1px solid #72777e;font-family:Arial,"Microsoft YaHei",sans-serif;font-size:10px;line-height:1.5;font-variant-numeric:tabular-nums;box-sizing:border-box;break-after:page;box-shadow:0 3px 14px #2028300d}
  .dye-flow-card:last-child{break-after:auto}
  .dye-flow-heading{height:44mm;position:relative;display:flex;align-items:center;justify-content:space-around;padding:12px 14px;gap:16px;border-bottom:1px solid #92979e}
  .dye-flow-heading h1{margin:0;font-size:17px;line-height:1.65;text-align:center;font-weight:700;flex:1}
  .dye-flow-heading h1 span{display:inline-block;font-size:12px;line-height:1.5;font-weight:600}
  .dye-flow-sequence{display:grid;place-items:center;border:1.5px solid #53585e;border-radius:50%;height:30px;width:30px;font-size:16px;font-weight:600;flex:none}
  .dye-flow-heading [data-qr-value]{flex:none}
  .dye-flow-meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));column-gap:14px;row-gap:10px;padding:12px 10px;border-bottom:1px solid #92979e;font-size:10px;line-height:1.5;min-height:22mm;align-items:start}
  .dye-flow-meta>div{min-width:0;overflow-wrap:break-word}
  .dye-flow-meta b{display:block;color:#b42324;font-size:9px;line-height:1.5;font-weight:600;margin-bottom:3px;white-space:nowrap}
  .dye-flow-meta-wide{grid-column:span 2}
  .dye-flow-table{border-collapse:collapse;width:100%;table-layout:fixed}
  .dye-flow-table td,.dye-flow-table th{border:1px solid #a2a6ac;padding:6px;text-align:center;vertical-align:middle;overflow-wrap:break-word;line-height:1.5;height:8mm}
  .dye-flow-table th{background:#f6f7f8;color:#34383d;font-size:9.5px;font-weight:600;text-wrap:balance}
  .dye-flow-table td{font-weight:400}
  .dye-flow-table tr>*:first-child{border-left:0}
  .dye-flow-table tr>*:last-child{border-right:0}
  .dye-flow-table tr:first-child>*{border-top:0}
  .dye-flow-data{height:18mm}
  .dye-flow-sign{height:17mm}
  .dye-flow-red{color:#b42324}
  .dye-flow-image{display:block;position:relative;background:#fff;border:1px solid #e1e3e6;padding:2px;margin:6px auto;width:20mm;height:20mm;cursor:zoom-in;overflow:hidden}
  .dye-flow-image img{display:block;width:100%;height:100%;object-fit:contain}
  .dye-flow-image span{position:absolute;inset:0;background:#fff}
  .dye-flow-card small{display:block;margin-top:3px;color:#62676e;font-size:9px;line-height:1.4;font-weight:400}
  .dye-flow-material{display:flex;align-items:center;gap:10px;text-align:left;padding:2px}
  .dye-flow-material .dye-flow-image{margin:0;flex:none;width:12mm;height:12mm}
  .dye-flow-material>span{min-width:0;line-height:1.6}
  .dye-flow-supplement{background:#b42324;color:#fff;text-align:center;padding:8px;font-size:18px;font-weight:700;letter-spacing:1px}
  .dye-flow-stamp{position:absolute;left:28%;bottom:9px;transform:rotate(-12deg);border:1.5px solid #b42324;color:#b42324;padding:2px 7px;font-size:12px;font-weight:600}
  .dye-flow-ref{display:flex;align-items:center;justify-content:center;gap:5px}
  .dye-flow-ref>span{min-width:0;font-size:9px;line-height:1.45}
  .dye-flow-ref .dye-flow-image{flex:none;width:7mm;height:7mm;margin:0;padding:1px}
  .dye-flow-note{padding:7px 9px;display:flex;align-items:baseline;justify-content:space-between;gap:16px;color:#555b63;font-size:9px;line-height:1.5}
  .dye-flow-note>span{flex:none}
  @media print{
    @page{size:A4 portrait;margin:8mm}
    .print-preview-root:has(.dye-flow-card){padding:0!important;background:#fff!important}
    .dye-flow-card{width:160mm;max-width:none;margin:0 auto;break-inside:avoid;box-shadow:none}
    .dye-flow-heading{height:38mm}
    .dye-flow-meta{padding:9px 10px;row-gap:7px}
    .dye-flow-data{height:15mm}
    .dye-flow-sign{height:13mm}
    .dye-flow-supplement{padding:5px}
    .dye-flow-card,.dye-flow-card *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  }
  </style>${cards}`
}
