import { renderCode128Barcode } from '../../components/real-barcode.ts'
import type { CentralPdaLanguage } from './frame.ts'
import { ce } from './ui.ts'
import { printNumber, printUnit } from './print-ui.ts'
import { dyeLocationLabel } from './dye-ui.ts'
import { readCentralPrintWarehouse } from './print-warehouse-model.ts'

/** Original Web input label: exact incoming code, 100 x 70 mm, no stock or print-status write. */
export function centralPrintInputLabel(factoryId: string, key: string, language: CentralPdaLanguage) {
  const row = readCentralPrintWarehouse(factoryId).input.find(row => row.key === key)
  const roll = row?.stock.rolls.find(roll => roll.barcode === row.barcode)
  const quantity = row?.quantity
  if (!row || !roll || !row.stock.imageUrl || typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) throw new Error('PRINT_labelNotReady')
  const text = (zh: string, id: string) => language === 'id' ? id : zh
  const location = row.position ? dyeLocationLabel([row.position.area.areaName, row.position.shelf.shelfNo, row.position.location.locationNo].join(' / '), language)
    : text('未记录库位', 'Lokasi belum tercatat')
  const signature = JSON.stringify([row.key, row.barcode, roll.receivedQty, quantity, row.stock.unit,
    row.stock.materialSku, row.stock.imageUrl, row.stock.sourceRecordNo, row.position?.key, row.recordedLocation])
  return { key, signature, barcode: row.barcode, html: `<!doctype html><html lang="${language === 'id' ? 'id' : 'zh-CN'}"><head><meta charset="utf-8"><title>${ce(row.barcode)}</title><style>
    @page{size:100mm 70mm;margin:5mm}*{box-sizing:border-box}body{margin:0;color:#102337;font:12px Arial,sans-serif;overflow-wrap:anywhere}article{width:90mm;min-height:60mm}h2{font-size:16px;margin:0 0 8px}p{margin:7px 0}.identity{display:flex;align-items:center;gap:8px}.identity img{width:36px;height:36px;object-fit:contain}svg{display:block;width:100%;height:60px}.barcode{font-size:11px;text-align:center}.amount{font-weight:bold}@media screen{body{zoom:.74;padding:8px}}@media print{body{zoom:1;padding:0}}
    </style></head><body><article data-central-print-input-paper><h2>${text('印花待加工仓 · 原卷', 'Gudang bahan cetak · Rol asal')}</h2><div class="identity"><img src="${ce(row.stock.imageUrl)}" alt="${ce(row.stock.materialSku)}"><strong>${ce(row.stock.materialSku)}</strong></div>${renderCode128Barcode(row.barcode, row.barcode)}<p class="barcode">${ce(row.barcode)}</p><p>${ce(location)}</p><p class="amount">${text('实收', 'Diterima')} ${printNumber(roll.receivedQty, language)} ${ce(printUnit(row.stock.unit, language))} · ${text('在仓', 'Stok')} ${printNumber(quantity, language)} ${ce(printUnit(row.stock.unit, language))}</p><p>${text('来源', 'Asal')} ${ce(row.stock.sourceRecordNo)}</p></article></body></html>` }
}
