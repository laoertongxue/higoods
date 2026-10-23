import { renderCode128Barcode } from '../../components/real-barcode.ts'
import { renderRealQrPlaceholder } from '../../components/real-qr-placeholder.ts'
import type { CentralPdaLanguage } from './frame.ts'
import { ce } from './ui.ts'
import { printNumber, printUnit, printUsesRolls } from './print-ui.ts'
import { centralPrintOutput } from './print-output-model.ts'
/** Original Web stock is 100 x 60 mm; both original machine-readable identities remain exact. */
export function renderCentralPrintLabel(orderId:string,rollIds:string[],factoryId:string,lang:CentralPdaLanguage){
 const state=centralPrintOutput(orderId,factoryId)
 if(!state||!rollIds.length||new Set(rollIds).size!==rollIds.length)throw new Error('PRINT_wrongRoll')
 const rolls=rollIds.map(id=>state.rolls.find(roll=>roll.id===id))
 if(rolls.some(roll=>!roll?.printable)||!state.fact.order.output.imageUrl)throw new Error('PRINT_labelNotReady')
 const o=state.fact.order,text=(zh:string,id:string)=>lang==='id'?id:zh
 return `<!doctype html><html lang="${lang==='id'?'id':'zh-CN'}"><head><meta charset="utf-8"><title>${ce(o.printOrderNo)}</title><style>
 @page{size:100mm 60mm;margin:0}@media screen{body{zoom:var(--label-scale,.75)}}@media print{body{zoom:1}}*{box-sizing:border-box}body{margin:0;color:#102337;font:10px Arial,sans-serif}article{width:100mm;height:60mm;padding:3mm;display:grid;grid-template-columns:minmax(0,1fr) 23mm;grid-template-rows:11mm minmax(0,24mm) 13mm;gap:1mm;break-after:page;overflow-wrap:anywhere}article:last-child{break-after:auto}header{grid-column:1/-1;display:flex;align-items:center;gap:2mm;min-width:0}header img{width:10mm;height:10mm;object-fit:contain;flex:none}header strong{font-size:12px}p{margin:1mm 0;line-height:1.2}.facts{min-width:0}.amount{font-size:17px;font-weight:700;margin-top:0}.qr{align-self:start;width:22mm;height:22mm}.qr svg{width:22mm;height:22mm}.machine{grid-column:1/-1;min-width:0}.machine>svg{display:block;width:100%;height:10mm}.machine p{font-size:9px;text-align:center;margin:0}.metadata{font-size:9px}.note{font-size:9px}
 </style></head><body>${rolls.map(row=>{const r=row!;return `<article data-central-print-paper>
 <header><img src="${ce(o.output.imageUrl)}" alt="${ce(o.output.sku)}"><div><strong>${ce(o.printOrderNo)} · ${ce(r.rollNo)}</strong><p>${ce(r.sku)}</p></div></header>
 <div class="facts"><p class="amount">${printNumber(r.lengthY,lang)} ${ce(printUnit(o.output.qtyUnit,lang))}</p>
 ${r.weightKg>0?`<p>${text(r.weightSource==='ACTUAL'?'实称重量':'理论重量',r.weightSource==='ACTUAL'?'Berat timbang':'Berat teori')} · ${printNumber(r.weightKg,lang)} kg</p>`:''}
 ${printUsesRolls(o.output.objectType)?`<p>${printNumber(r.gsm,lang)} g/m² · ${printNumber(r.widthCm,lang)} cm</p>`:''}
 ${r.vatNo?`<p class="metadata">${text('缸号','Kode bak')} · ${ce(r.vatNo)}</p>`:''}${r.warehouseName?`<p class="metadata">${ce(r.warehouseName)}</p>`:''}${r.remark?`<p class="note">${ce(r.remark)}</p>`:''}</div>
 <div class="qr">${renderRealQrPlaceholder({value:JSON.stringify({type:'PRINTING_OUTPUT_ROLL',workOrderId:o.workOrderId,barcodeId:r.id,outputSku:o.output.sku}),size:84,title:text(printUsesRolls(o.output.objectType)?'卷二维码':'包装二维码',printUsesRolls(o.output.objectType)?'Kode QR rol':'Kode QR kemasan'),label:text(printUsesRolls(o.output.objectType)?'卷二维码':'包装二维码',printUsesRolls(o.output.objectType)?'Kode QR rol':'Kode QR kemasan'),batch:true})}</div>
 <div class="machine">${renderCode128Barcode(r.barcode,r.barcode)}<p>${ce(r.barcode)}</p></div></article>`}).join('')}</body></html>`
}
