// @page-pattern: detail
// 单份合同固定两页的打印详情；累计节点表和规则表不是管理记录列表。
import type { ProductionContract } from '../../../data/fcs/production-contracts.ts'
import { escapeHtml } from '../../../utils.ts'

export const PRODUCTION_CONTRACT_MASTER_TEMPLATE_CODE = 'PRODUCTION_CONTRACT_SPK_ID_V2_TWO_NODES'
export const PRODUCTION_CONTRACT_LEGACY_TEMPLATE_CODE = 'PRODUCTION_CONTRACT_SPK_ID_V1'
export const PRODUCTION_CONTRACT_MASTER_PAGE_COUNT = 2
export const PRODUCTION_CONTRACT_MASTER_SOURCE = '/fcs/contracts/template/production-contract-master.pdf'
export const PRODUCTION_CONTRACT_MASTER_SOURCE_SHA256 = 'faa13a7aa6942f41c30ac3651ff78ea728841dedd941a99a5ea8b5de62edff8c'
export const PRODUCTION_CONTRACT_MASTER_ASSETS = [
  '/fcs/contracts/template/production-contract-master-1.png',
  '/fcs/contracts/template/production-contract-master-2.png',
] as const

// 与母版PNG逐RGBA像素一致的无损编码；原件和追溯地址保持原样。
export const PRODUCTION_CONTRACT_MASTER_RENDER_ASSETS = [
  '/fcs/contracts/template/production-contract-master-1.webp',
  '/fcs/contracts/template/production-contract-master-2.webp',
] as const

const PDF_WIDTH = 595.303937007874
const PDF_HEIGHT = 841.889763779528
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export interface ProductionContractPrintMeta {
  printedAt?: string
  printedBy?: string
}

interface OverlayField {
  key: string
  value: string
  x: number
  top: number
  width: number
  height: number
  align?: 'left' | 'center' | 'right'
  fontSizePt?: number
  minFontSizePt?: number
  fontWeight?: 400 | 600 | 700
  adaptive?: boolean
  wrap?: boolean
  lineHeight?: number
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value)
}

function parseDateParts(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

export function formatContractDateIndonesian(value: string, short = false): string {
  const parts = parseDateParts(value)
  if (!parts || parts.month < 1 || parts.month > 12) return value || 'Belum tersedia'
  const month = (short ? SHORT_MONTHS : MONTHS)[parts.month - 1]
  return `${parts.day} ${month} ${parts.year}`
}

export function formatContractDateTimeIndonesian(value: string): string {
  const date = formatContractDateIndonesian(value)
  const time = /(?:T|\s)(\d{2}):(\d{2})/.exec(value)
  return time ? `${date}, ${time[1]}.${time[2]}` : date
}

function printedByInIndonesian(value: string): string {
  const roleNames: Record<string, string> = {
    '生产计划员': 'Perencana Produksi',
    '平台定标员': 'Petugas Penetapan Tender',
    '系统': 'Sistem',
  }
  return roleNames[value] || value || 'Perencana Produksi'
}

function estimateTextUnits(value: string): number {
  return Array.from(value).reduce((total, character) => {
    if (/\s/.test(character)) return total + 0.32
    if (/[\u2E80-\u9FFF]/.test(character)) return total + 1
    if (/[A-Z0-9]/.test(character)) return total + 0.62
    return total + 0.52
  }, 0)
}

function resolveAdaptiveFontSize(field: OverlayField): number {
  const preferred = field.fontSizePt ?? 8.5
  if (!field.adaptive || !field.value) return preferred
  const availableWidth = Math.max(1, field.width - 5)
  const lineCount = field.wrap ? 2 : 1
  const unitsPerLine = Math.max(1, estimateTextUnits(field.value) / lineCount)
  const fitted = availableWidth / unitsPerLine
  return Math.max(field.minFontSizePt ?? 5.5, Math.min(preferred, fitted))
}

function renderOverlay(field: OverlayField): string {
  const left = field.x / PDF_WIDTH * 100
  const top = field.top / PDF_HEIGHT * 100
  const width = field.width / PDF_WIDTH * 100
  const height = field.height / PDF_HEIGHT * 100
  return `<span data-contract-field="${escapeHtml(field.key)}" data-contract-adaptive="${field.adaptive ? 'true' : 'false'}" data-contract-wrap="${field.wrap ? 'true' : 'false'}" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;font-size:${resolveAdaptiveFontSize(field)}pt;font-weight:${field.fontWeight ?? 400};line-height:${field.lineHeight ?? (field.wrap ? 1.14 : 1.08)};text-align:${field.align ?? 'left'}">${escapeHtml(field.value)}</span>`
}

function buildPageOneFields(contract: ProductionContract, meta: ProductionContractPrintMeta): OverlayField[] {
  const printedAt = meta.printedAt || contract.generatedAt
  const printedBy = printedByInIndonesian(meta.printedBy || contract.generatedBy)
  const details = contract.templateSnapshot.taskDetails.slice(0, 3)
  const detailRows = Array.from({ length: 3 }, (_, index) => details[index])
  const milestones = isTwoNodeContract(contract) ? [] : contract.returnRuleSnapshot.milestones.slice(0, 3)
  const cumulativeQty = milestones.map((item) => item.targetQty)
  const stageQty = cumulativeQty.map((qty, index) => Math.max(0, qty - (cumulativeQty[index - 1] || 0)))
  const fields: OverlayField[] = [
    { key: 'NO_KONTRAK', value: contract.contractNo, x: 35, top: 87, width: 126, height: 19, fontWeight: 600, adaptive: true },
    { key: 'VERSI', value: `V${contract.version}`, x: 216, top: 80, width: 72, height: 17, fontWeight: 600 },
    { key: 'WAKTU_CETAK', value: formatContractDateTimeIndonesian(printedAt), x: 312, top: 87, width: 108, height: 19, fontWeight: 600, adaptive: true, wrap: true },
    { key: 'DICETAK_OLEH', value: printedBy, x: 432, top: 87, width: 114, height: 19, fontWeight: 600, adaptive: true, wrap: true },
    { key: 'TGL_PEMBAGIAN', value: formatContractDateIndonesian(contract.assignmentDate), x: 35, top: 131, width: 126, height: 19, fontWeight: 600, adaptive: true },
    { key: 'TGL_PENGAMBILAN', value: contract.templateSnapshot.pickupDate === 'Belum diambil' ? 'Belum diambil' : formatContractDateIndonesian(contract.templateSnapshot.pickupDate), x: 180, top: 125, width: 106, height: 21, fontWeight: 600, adaptive: true, wrap: true },
    { key: 'NAMA_MAKLON', value: contract.factoryName, x: 299, top: 125, width: 121, height: 21, fontSizePt: 7.5, minFontSizePt: 5.8, fontWeight: 600, adaptive: true, wrap: true },
    { key: 'PIC_MAKLON_HEADER', value: contract.templateSnapshot.factoryPicName, x: 432, top: 125, width: 114, height: 21, fontWeight: 600, adaptive: true, wrap: true },
    { key: 'NAMA_PPIC_HEADER', value: contract.templateSnapshot.ppicName, x: 92, top: 163, width: 70, height: 15, fontWeight: 600 },
    { key: 'MASK_JENIS_TUGAS_INLINE', value: '', x: 262, top: 159, width: 32, height: 13 },
    { key: 'MASK_JENIS_PROSES_INLINE', value: '', x: 390, top: 159, width: 30, height: 13 },
    { key: 'JENIS_TUGAS', value: contract.templateSnapshot.taskTypeId, x: 166, top: 168, width: 128, height: 17, fontWeight: 600 },
    { key: 'JENIS_PROSES', value: contract.templateSnapshot.processTypeId, x: 299, top: 165, width: 121, height: 20, fontWeight: 600 },
    { key: 'PERHITUNGAN_HARI', value: contract.templateSnapshot.dayCalculationId, x: 432, top: 170, width: 102, height: 15, fontWeight: 600 },
    { key: 'TOTAL_QTY', value: formatNumber(contract.assignedQty), x: 458, top: 310, width: 103, height: 21, align: 'center', fontSizePt: 9, fontWeight: 700 },
    { key: 'NAMA_PPIC_SIGNATURE', value: contract.templateSnapshot.ppicName, x: 92, top: 595, width: 60, height: 14, align: 'center', fontSizePt: 8, fontWeight: 600 },
    { key: 'PIC_MAKLON_SIGNATURE', value: contract.templateSnapshot.factoryPicName, x: 266, top: 595, width: 64, height: 14, align: 'center', fontSizePt: 8, fontWeight: 600 },
  ]

  const rowTops = [244, 264.5, 284.8]
  const columns = [
    { key: 'SPU', x: 34, width: 103 },
    { key: 'PO', x: 140, width: 103 },
    { key: 'SPK', x: 246, width: 103 },
    { key: 'CATATAN', x: 352, width: 103 },
    { key: 'QTY', x: 458, width: 103 },
  ] as const
  detailRows.forEach((detail, index) => {
    const values = detail
      ? [detail.spuNo, detail.purchaseOrderNo, detail.productionSpkNo, detail.note, formatNumber(detail.qty)]
      : ['', '', '', '', '']
    columns.forEach((column, columnIndex) => fields.push({
      key: `${column.key}_${index + 1}`,
      value: values[columnIndex],
      x: column.x,
      top: rowTops[index],
      width: column.width,
      height: 17,
      align: 'center',
      fontSizePt: column.key === 'CATATAN' ? 6.2 : 8.5,
      fontWeight: 600,
      adaptive: true,
      wrap: column.key === 'CATATAN',
    }))
  })

  const milestoneTops = [390, 410.4, 430.7]
  milestones.forEach((milestone, index) => {
    const rowValues = [
      { key: 'HARI', value: String(milestone.naturalDay), x: 123, width: 85 },
      { key: 'DEADLINE', value: formatContractDateIndonesian(milestone.deadlineDate, true), x: 211, width: 86 },
      { key: 'QTY_TAHAP', value: formatNumber(stageQty[index]), x: 389, width: 85 },
      { key: 'QTY_KUM', value: formatNumber(milestone.targetQty), x: 477, width: 84 },
    ]
    rowValues.forEach((item) => fields.push({
      key: `${item.key}_${index + 1}`,
      value: item.value,
      x: item.x,
      top: milestoneTops[index],
      width: item.width,
      height: 17,
      align: 'center',
      fontWeight: 600,
    }))
  })
  return fields
}

export function isTwoNodeContract(contract: ProductionContract): boolean {
  const nodes = contract.returnRuleSnapshot.milestones
  return nodes.length === 2 && nodes[0]?.ratio === 0.35 && nodes[1]?.ratio === 1
}

export function getProductionContractTemplateCode(contract: ProductionContract): string {
  return isTwoNodeContract(contract) ? PRODUCTION_CONTRACT_MASTER_TEMPLATE_CODE : PRODUCTION_CONTRACT_LEGACY_TEMPLATE_CODE
}

function renderTwoNodeReturnTable(contract: ProductionContract): string {
  let previousQty = 0
  const rows = contract.returnRuleSnapshot.milestones.map((node, index) => {
    const stageQty = node.targetQty - previousQty
    previousQty = node.targetQty
    return `<tr><td>${index + 1}</td><td data-contract-field="HARI_${index + 1}">${node.naturalDay}</td><td data-contract-field="DEADLINE_${index + 1}">${escapeHtml(formatContractDateIndonesian(node.deadlineDate, true))}</td><td>${Math.round(node.ratio * 100)}%</td><td data-contract-field="QTY_TAHAP_${index + 1}">${formatNumber(stageQty)}</td><td data-contract-field="QTY_KUM_${index + 1}">${formatNumber(node.targetQty)}</td></tr>`
  }).join('')
  const estimated = contract.templateSnapshot.returnQuantityBasis !== 'TASK_ASSIGNMENT' && contract.templateSnapshot.returnQuantityBasis !== 'CONFIRMED_RETURN_BASIS'
  const basis = estimated ? 'Estimasi berdasarkan jumlah tugas; jumlah wajib kembali dikonfirmasi saat serah terima. / 按分配量预估；正式应回数量以交出或放行依据为准。' : contract.templateSnapshot.returnQuantityBasis === 'TASK_ASSIGNMENT' ? 'Dasar: jumlah tugas yang dibagikan. / 应回依据：任务分配数量。' : 'Dasar: jumlah wajib kembali yang telah dikonfirmasi. / 应回依据：已确认的应回数量版本。'
  return `<div class="production-contract-return-table" data-contract-return-table="two-nodes"><table><thead><tr><th>Tahap<br>阶段</th><th>Hari Ke-<br>第几天</th><th>Batas Waktu<br>截止日期</th><th>Target Kumulatif<br>累计比例</th><th>Jumlah Tahap Ini<br>本阶段数量</th><th>Jumlah Kumulatif<br>累计数量</th></tr></thead><tbody>${rows}</tbody></table><p>${escapeHtml(basis)} WIB (Asia/Jakarta).</p></div>`
}

function renderTwoNodeRuleTable(): string {
  return `<div class="production-contract-rule-table" data-contract-rule-table="two-nodes"><table><thead><tr><th>Jenis Proses / 工序类型</th><th>Tahap 1 / 第一节点</th><th>Tahap Akhir / 最终节点</th></tr></thead><tbody><tr><th>Jahit / 缝纫</th><td>Hari ke-4 ≥ 35%<br>第4天 ≥ 35%</td><td>Hari ke-9 = 100%<br>第9天 = 100%</td></tr><tr><th>Jahit s.d. Packing / 缝纫到包装</th><td>Hari ke-5 ≥ 35%<br>第5天 ≥ 35%</td><td>Hari ke-10 = 100%<br>第10天 = 100%</td></tr><tr><th>Cutting s.d. Packing / 裁剪到包装</th><td>Hari ke-6 ≥ 35%<br>第6天 ≥ 35%</td><td>Hari ke-12 = 100%<br>第12天 = 100%</td></tr></tbody></table></div>`
}

function renderReturnBasisNotes(): string {
  return `<div class="production-contract-basis-note"><b>PENTING / 重要：</b>Target kumulatif = jumlah wajib kembali × rasio, dibulatkan ke atas. Jahit tanpa kekurangan potongan: jumlah lengkap yang diserahkan; bila ada kekurangan: jumlah pelepasan yang terkonfirmasi. Cutting s.d. Packing: jumlah tugas yang dibagikan.<br>累计目标按应回数量×比例向上取整。无缺片按实际交出齐套量，有缺片按裁片放行量；裁剪到包装按任务分配量。分配日为第1自然日，包含星期日；节点当日23:59:59 WIB截止。</div>`
}

function renderReturnCalculationRules(): string {
  return `<div class="production-contract-calculation"><h3>2. DASAR PERHITUNGAN SISTEM / 系统计算规则</h3><p>• Hari pembagian tugas adalah hari ke-1; hari kalender termasuk Minggu. Batas setiap tahap: 23.59.59 WIB (Asia/Jakarta).<br><small>任务分配日为第1天，全部自然日，节点当日23:59:59雅加达时间截止。</small></p><p>• Target kumulatif dibulatkan ke atas dari jumlah wajib kembali × rasio; jumlah tahap adalah selisih dua target kumulatif. Jumlah tugas tetap dicatat terpisah.<br><small>累计目标以应回数量为基数；本阶段数量为累计目标差额，分配数量单独保留。</small></p><p>• Estimasi sebelum serah terima ditandai pada halaman 1. Perubahan dasar dicatat dalam versi baru; versi lama tetap tersimpan.<br><small>交出前预估在第一页明确标示；依据变化形成新版本，历史原件保留。</small></p></div>`
}

export function renderProductionContractMasterTemplate(contract: ProductionContract, meta: ProductionContractPrintMeta = {}): string {
  const pageOneFields = buildPageOneFields(contract, meta).map(renderOverlay).join('')
  const twoNodes = isTwoNodeContract(contract)
  return `
    <main class="production-contract-master" data-contract-template="${getProductionContractTemplateCode(contract)}" data-contract-pages="2">
      <section class="production-contract-master__page production-contract-master__page--one">
        <img src="${PRODUCTION_CONTRACT_MASTER_RENDER_ASSETS[0]}" data-contract-master-source="${PRODUCTION_CONTRACT_MASTER_ASSETS[0]}" alt="SPK dan komitmen jadwal pengembalian halaman 1" />
        <div class="production-contract-master__fields">${pageOneFields}</div>
        ${twoNodes ? renderTwoNodeReturnTable(contract) + renderReturnBasisNotes() : ''}
      </section>
      <section class="production-contract-master__page">
        <img src="${PRODUCTION_CONTRACT_MASTER_RENDER_ASSETS[1]}" data-contract-master-source="${PRODUCTION_CONTRACT_MASTER_ASSETS[1]}" alt="Ketentuan komitmen waktu, pengingat dan sanksi halaman 2" />
        ${twoNodes ? renderTwoNodeRuleTable() + renderReturnCalculationRules() : ''}
      </section>
    </main>
    <style>
      @page{size:A4 portrait;margin:0}
      .production-contract-master{width:210mm;margin:0 auto;background:#fff;color:#111}
      .production-contract-master__page{position:relative;width:210mm;height:297mm;overflow:hidden;background:#fff;break-after:page;page-break-after:always}
      .production-contract-master__page:last-child{break-after:auto;page-break-after:auto}
      .production-contract-master__page>img{display:block;width:210mm;height:297mm;object-fit:fill}
      .production-contract-master__fields{position:absolute;inset:0}
      .production-contract-master__fields>span{position:absolute;display:flex;align-items:center;box-sizing:border-box;overflow:hidden;white-space:nowrap;background:#fff;font-family:Arial,"Noto Sans",sans-serif;padding:0 .6mm;justify-content:flex-start}
      .production-contract-master__fields>span[data-contract-wrap="true"]{white-space:normal;overflow-wrap:anywhere;word-break:break-word}
      .production-contract-master__fields>span[style*="text-align:center"]{justify-content:center}
      .production-contract-return-table,.production-contract-rule-table{position:absolute;left:5.46%;width:89.05%;background:#fff;font-family:Arial,"Noto Sans",sans-serif;box-sizing:border-box}
      .production-contract-return-table{top:42.33%;height:10.88%}
      .production-contract-rule-table{top:9.60%;height:14.05%}
      .production-contract-return-table table,.production-contract-rule-table table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8.2pt;text-align:center;background:#fff}
      .production-contract-return-table th,.production-contract-return-table td,.production-contract-rule-table th,.production-contract-rule-table td{border:1pt solid #111;padding:1.1mm .6mm;line-height:1.15}
      .production-contract-return-table thead tr{height:10.5mm}.production-contract-return-table tbody tr{height:7.2mm}
      .production-contract-return-table th,.production-contract-rule-table thead th{background:#eee}
      .production-contract-return-table p{margin:0;padding:.8mm 1mm;font-size:6.4pt;line-height:1.2;border:1pt solid #111;border-top:0}
      .production-contract-rule-table table{height:100%}.production-contract-rule-table tbody th{font-size:8pt}
      .production-contract-basis-note{position:absolute;left:5.46%;top:53.34%;width:89.05%;height:6.67%;box-sizing:border-box;border:1.3pt solid #e00000;background:#fff;padding:1.4mm;font-family:Arial,"Noto Sans",sans-serif;font-size:8pt;line-height:1.22;overflow:hidden}
      .production-contract-basis-note>b{color:#d00000}
      .production-contract-calculation{position:absolute;left:6.1%;top:25.94%;width:43.6%;height:15.50%;box-sizing:border-box;background:#fff;font-family:Arial,"Noto Sans",sans-serif;font-size:8pt;line-height:1.18;overflow:hidden}
      .production-contract-calculation h3{margin:0 0 1mm;font-size:8.7pt;line-height:1.2}.production-contract-calculation p{margin:0 0 1.1mm}.production-contract-calculation small{font-size:7.4pt;color:#666}
      @media print{
        html,body{margin:0!important;padding:0!important;background:#fff!important}
        .production-contract-master{margin:0!important}
        *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      }
    </style>
  `
}
