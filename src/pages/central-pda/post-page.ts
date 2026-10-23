// @page-pattern: pda
import { appStore } from '../../state/store.ts'
import { hydrateIcons } from '../../components/shell.ts'
import { getFactoryMasterRecordById, listFactoryMasterRecords } from '../../data/fcs/factory-master-store.ts'
import { isCentralPdaFactory } from '../../data/fcs/pda-experience-scope.ts'
import { readFactoryPdaExecutionUsers, normalizePdaLoginId, verifyPdaPassword } from '../../data/fcs/store-domain-pda.ts'
import { ensurePostFinishingRecordState, registerPostFinishingFile, releasePostFinishingPendingFile } from '../../data/fcs/post-finishing-records.ts'
import { centralSession as session, ensureCentralSessionAccount, saveCentralSessionPreference, registerCentralDraftDiscard, discardCentralDrafts } from './session.ts'
import { renderCentralPdaFrame, type CentralPdaFrameInput, type CentralPdaTab } from './frame.ts'
import { cb, ce, ct, centralNotice, centralFormalName } from './ui.ts'
import {
  centralPostDeliveries, centralPostDelivery, centralPostScan, centralPostReceipts, centralPostQcTasks,
  centralPostOutbound, centralPostTasks, centralPostRechecks, centralPostWaitHandovers, centralPostWaitProcess, centralPostWaitProcessMovements, centralPostWaitHandoverMovements, centralPostCanConfirm,
  centralPostConfirmer, saveCentralPostReceipt, completeCentralPostQc, sendCentralPostToQc, claimCentralPostQc, centralPostReworkOptions,
  centralPostDefectReasons, centralPostProcessProgress, registerCentralPostProcess, submitCentralPostRecheck,
  claimCentralPostRecheck, scanCentralPostBarcode, markCentralPostRelabeled, completeCentralPostRecheck,
  receiveCentralPostOutbound, type CentralPostTab,
} from './post-model.ts'
import { pt, postDetail, postListCard, postStatus } from './post-view.ts'

const prefix = '/fcs/pda/central/post'
type CountValue = { passed: string; defect: string; return: string; defectReason: string; returnReason: string; returnReceiver: string }
let path = '', generation = 0, saving = false, entryError: unknown, message: unknown, success = '', scan = '', login = { account: '', password: '' }
let needsSecond = '', needsAuth = '', authValue = '', diffReason = '', qcAuth = '', qcAuthReason = ''
let qcProcessItems: string[] = []
let recheckAuth = '', recheckAuthReason = ''
const counts = new Map<string, string>(), secondCounts = new Map<string, string>(), qcValues = new Map<string, CountValue>(), barcodeInputs = new Map<string, string>()
const processQty = new Map<string, string>(), processReason = new Map<string, string>(), recheckQty = new Map<string, string>(), qcPhotos = new Map<string, string>()
const receiptQty = new Map<string, string>()
let receiptAuth = '', receiptAuthReason = ''
const processKey = (taskId: string, item: string, skuId: string) => `${taskId}|${item}|${skuId}`
const recheckQtyKey = (recheckId: string, skuId: string) => `${recheckId}|${skuId}`
const root = () => document.querySelector<HTMLElement>('[data-central-family="post"]')
const lang = () => session.language, t = (key: Parameters<typeof ct>[1]) => ct(lang(), key)
const route = () => { const url = new URL(path || prefix + '/receive', 'https://pda.local'), parts = url.pathname.split('/'); let id = ''; try { id = decodeURIComponent(parts[6] || '') } catch {} return { tab: (['receive', 'execute', 'warehouse'].includes(parts[5]) ? parts[5] : 'receive') as CentralPostTab, id } }
const key = (skuId: string, field: string) => route().id + '|' + skuId + '|' + field
const qcLineKey = (skuId: string) => route().id + '|' + skuId
registerCentralDraftDiscard(() => { scan = ''; message = undefined; qcValues.clear(); counts.clear(); secondCounts.clear() }, () => false)

function notice() { return message ? centralNotice(message instanceof Error ? message.message : t('notSaved'), true) : success ? centralNotice(success) : '' }
function input(label: string, attrs: string, value: string) { return `<label class="mb-2 block text-sm">${ce(label)}<input class="mt-1 min-h-12 w-full rounded-xl border bg-white p-2 text-base" ${attrs} value="${ce(value)}" autocomplete="off"></label>` }
function qcValue(skuId: string): CountValue { return qcValues.get(qcLineKey(skuId)) || { passed: '', defect: '0', return: '0', defectReason: '', returnReason: '', returnReceiver: '' } }

function receivePanel(d: NonNullable<ReturnType<typeof centralPostDelivery>>) {
  const second = d.status === '待二次点数' || needsSecond === d.deliveryId
  let content = `<h2 class="mb-2 mt-4 text-lg font-bold">${lang() === 'id' ? 'Hitung penerimaan' : '回货点数'}</h2>`
    + d.lines.map(line => `<label class="mb-2 block text-sm">${ce(line.sku.skuCode)} · ${lang() === 'id' ? 'Hitung 1' : '一次点数'}<input class="mt-1 min-h-12 w-full rounded-xl border bg-white p-2 text-base" data-post-count="${ce(line.sku.skuId)}" inputmode="numeric" value="${ce(counts.get(d.deliveryId + '|' + line.sku.skuId) ?? String(line.registeredQty))}"></label>`
      + (second ? `<label class="mb-2 block text-sm">${ce(line.sku.skuCode)} · ${lang() === 'id' ? 'Hitung 2' : '二次点数'}<input class="mt-1 min-h-12 w-full rounded-xl border bg-white p-2 text-base" data-post-second="${ce(line.sku.skuId)}" inputmode="numeric" value="${ce(secondCounts.get(d.deliveryId + '|' + line.sku.skuId) ?? String(line.secondCountQty ?? line.registeredQty))}"></label>` : '')).join('')
  return { content, primary: { label: saving ? t('saving') : (lang() === 'id' ? 'Konfirmasi terima' : '确认回货'), action: 'post-confirm', disabled: saving } }
}

function qcState(task: ReturnType<typeof centralPostQcTasks>[number]) {
  let valid = true, hasDifference = false
  const results = task.lines.map(line => {
    const values = qcValue(line.sku.skuId)
    const passedQty = Number(values.passed || line.expectedQty), defectQty = Number(values.defect || 0), returnQty = Number(values.return || 0)
    if (![passedQty, defectQty, returnQty].every(Number.isSafeInteger) || passedQty < 0 || defectQty < 0 || returnQty < 0) valid = false
    if (defectQty > 0 && !values.defectReason.trim()) valid = false
    if (returnQty > 0 && (!values.returnReason.trim() || !values.returnReceiver.trim())) valid = false
    if (passedQty + defectQty + returnQty !== line.expectedQty) hasDifference = true
    return { skuId: line.sku.skuId, passedQty, defectQty, returnQty, ...(defectQty > 0 ? { defectReason: values.defectReason } : {}), ...(defectQty > 0 && qcPhotos.get(qcLineKey(line.sku.skuId)) ? { defectImageUrl: qcPhotos.get(qcLineKey(line.sku.skuId)) } : {}), ...(returnQty > 0 ? { returnReason: values.returnReason, returnReceiver: values.returnReceiver } : {}) }
  })
  if (hasDifference && (!qcAuth.trim() || !qcAuthReason.trim())) valid = false
  return { results, hasDifference, valid, authorization: hasDifference ? { scanValue: qcAuth.trim(), differenceReason: qcAuthReason.trim() } : undefined }
}
function qcPanel(task: ReturnType<typeof centralPostQcTasks>[number]) {
  const state = qcState(task), rework = centralPostReworkOptions(), reasons = centralPostDefectReasons()
  let content = `<h2 class="mb-2 mt-4 text-lg font-bold">${lang() === 'id' ? 'Hasil QC' : '质检结果'}</h2><p class="mb-2 text-sm">${lang() === 'id' ? 'Isi lulus, cacat, kembali per SKU.' : '按 SKU 填写合格、不良和返工数量；合计应等于应收。'}</p>`
  for (const line of task.lines) {
    const v = qcValue(line.sku.skuId)
    content += `<article class="mb-3 rounded-xl border bg-white p-3"><strong class="block break-words">${ce(line.sku.skuCode)}</strong><div class="mb-1 text-sm">${lang() === 'id' ? 'Harus' : '应收'} ${line.expectedQty}</div><div class="grid grid-cols-3 gap-2">${(['passed', 'defect', 'return'] as const).map(field => `<label class="text-sm">${field === 'passed' ? (lang() === 'id' ? 'Lulus' : '合格') : field === 'defect' ? (lang() === 'id' ? 'Cacat' : '不良') : (lang() === 'id' ? 'Kembali' : '返工')}<input class="mt-1 min-h-12 w-full rounded-xl border bg-white p-2 text-base" data-post-qc-num="${field}" data-post-sku="${ce(line.sku.skuId)}" inputmode="numeric" value="${ce(field === 'passed' ? v.passed || String(line.expectedQty) : v[field])}"></label>`).join('')}</div><label class="mt-2 block text-sm">${lang() === 'id' ? 'Alasan cacat' : '瑕疵原因'}<select class="mt-1 min-h-12 w-full rounded-xl border bg-white p-2 text-base" data-post-qc-select="defectReason" data-post-sku="${ce(line.sku.skuId)}"><option value="">${lang() === 'id' ? 'Pilih' : '请选择'}</option>${reasons.map(reason => `<option value="${ce(reason)}"${v.defectReason === reason ? ' selected' : ''}>${ce(reason)}</option>`).join('')}</select></label><label class="mt-2 block text-sm">${lang() === 'id' ? 'Pabrik perbaikan' : '返工工厂'}<select class="mt-1 min-h-12 w-full rounded-xl border bg-white p-2 text-base" data-post-qc-select="returnReceiver" data-post-sku="${ce(line.sku.skuId)}"><option value="">${lang() === 'id' ? 'Pilih' : '请选择'}</option>${rework.map(option => `<option value="${ce(option.value)}"${v.returnReceiver === option.value ? ' selected' : ''}>${ce(option.label)}</option>`).join('')}</select></label><label class="mt-2 block text-sm">${lang() === 'id' ? 'Alasan kembali' : '返工原因'}<input class="mt-1 min-h-12 w-full rounded-xl border bg-white p-2 text-base" data-post-qc-text="returnReason" data-post-sku="${ce(line.sku.skuId)}" value="${ce(v.returnReason)}"></label><div class="mt-2 text-sm"><div class="font-semibold">${lang() === 'id' ? 'Foto cacat' : '不良照片'} <span class="text-xs text-slate-500">${lang() === 'id' ? 'bila ada cacat' : '有不良时拍摄'}</span></div>${qcPhotos.get(qcLineKey(line.sku.skuId)) ? `<img class="mt-1 h-20 w-20 rounded border object-cover" src="${ce(qcPhotos.get(qcLineKey(line.sku.skuId))!)}" alt="${lang() === 'id' ? 'Foto cacat' : '不良照片'}"><div class="mt-1">${cb(lang() === 'id' ? 'Ganti foto' : '重拍 / 更换', 'post-qc-photo', line.sku.skuId)}</div>` : `<label class="mt-1 block">${cb(lang() === 'id' ? 'Ambil / pilih foto' : '拍照 / 选择照片', 'post-qc-photo', line.sku.skuId)}<input type="file" accept="image/*" capture="environment" data-post-qc-file="${ce(line.sku.skuId)}" hidden></label>`}</div></article>`
  }
  content += `<h2 class="mb-2 mt-4 text-lg font-bold">${lang() === 'id' ? 'Proses finishing' : '后道项目'}</h2><div class="grid gap-2">${['开扣眼', '装扣子', '熨烫', '包装'].map(item => cb(item, 'post-process', item, qcProcessItems.includes(item))).join('')}</div>`
    + `<h2 class="mb-2 mt-4 text-lg font-bold">${lang() === 'id' ? 'Izin selisih' : '差异授权'}</h2><p class="mb-2 text-sm">${lang() === 'id' ? 'Isi bila total tidak sama.' : '合格+不良+返工不等于应收时填写授权码和原因。'}</p>` + input(lang() === 'id' ? 'Kode izin' : '动态授权码', 'data-post-qc-auth', qcAuth) + input(lang() === 'id' ? 'Alasan selisih' : '差异原因', 'data-post-qc-auth-reason', qcAuthReason)
  return { content, primary: { label: saving ? t('saving') : (lang() === 'id' ? 'Selesaikan QC' : '提交质检结果'), action: 'post-qc-complete', disabled: saving || !state.valid } }
}

function detailPanel(d: NonNullable<ReturnType<typeof centralPostDelivery>>) {
  let content = ''
  let primary: CentralPdaFrameInput['primary']
  if (['待后道确认', '待二次点数'].includes(d.status)) {
    if (centralPostCanConfirm(session.account)) { const panel = receivePanel(d); content += panel.content; primary = panel.primary }
    else content += centralNotice(lang() === 'id' ? 'Hanya supervisor yang dapat mengonfirmasi.' : '当前账号只读；回货确认由后道主管办理。', true)
  }
  if (d.status === '差异待授权') {
    if (centralPostCanConfirm(session.account)) {
      content += centralNotice(lang() === 'id' ? 'Selisih memerlukan kode izin.' : '数量差异需授权人提供动态授权码。', true) + input(lang() === 'id' ? 'Kode izin' : '动态授权码', 'data-post-auth', authValue) + input(lang() === 'id' ? 'Alasan selisih' : '差异原因', 'data-post-reason', diffReason)
      primary = { label: saving ? t('saving') : (lang() === 'id' ? 'Konfirmasi dengan izin' : '授权确认回货'), action: 'post-confirm', disabled: saving || !authValue.trim() || !diffReason.trim() }
    } else content += centralNotice(lang() === 'id' ? 'Hanya supervisor yang dapat mengizinkan.' : '当前账号只读；差异授权由后道主管办理。', true)
  }
  if (d.status === '已确认待送检') primary = { label: saving ? t('saving') : (lang() === 'id' ? 'Kirim ke QC' : '送检出库'), action: 'post-send-qc', disabled: saving }
  if (d.status === '已送检') {
    const task = centralPostQcTasks(session.currentFactory).find(row => row.deliveryId === d.deliveryId)
    if (task?.status === '待质检') primary = { label: saving ? t('saving') : (lang() === 'id' ? 'Ambil tugas QC' : '领取质检单'), action: 'post-qc-claim', disabled: saving }
    else if (task?.status === '质检中') {
      if (task.claimedBy?.actorId === session.account?.userId) { const panel = qcPanel(task); content += panel.content; primary = panel.primary }
      else content += centralNotice(lang() === 'id' ? `Sedang QC oleh ${task.claimedBy?.actorName || ''}` : `质检中：${task.claimedBy?.actorName || ''}`)
    }
  }
  const postTasks = centralPostTasks(session.currentFactory).filter(row => row.deliveryId === d.deliveryId)
  if (postTasks.length) content += `<h2 class="mb-2 mt-4 text-lg font-bold">${lang() === 'id' ? 'Tugas finishing' : '后道任务'}</h2>`
  for (const task of postTasks) {
    const progress = centralPostProcessProgress(task.postTaskId)
    content += `<article class="mb-2 rounded-xl border bg-white p-3"><strong>${ce(task.postTaskNo)}</strong><div class="text-sm">${ce(postStatus(task.status, lang()))} · ${task.processItems.map(ce).join(' / ')}</div>`
    if (['待后道', '后道中'].includes(task.status)) for (const process of progress.processes.filter(item => item.applicable && item.availableQty > 0)) {
      const hasDraft = [...processQty.keys()].some(key => key.startsWith(`${task.postTaskId}|${process.processItem}|`)) || processReason.has(`${task.postTaskId}|${process.processItem}`)
      content += `<details class="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2"${hasDraft ? ' open' : ''}><summary class="min-h-8 cursor-pointer font-semibold">${lang() === 'id' ? 'Catat' : '登记'}${ce(process.processItem)}${lang() === 'id' ? '' : '完成'} · ${lang() === 'id' ? 'Tersedia' : '可用'} ${process.availableQty}</summary><p class="mt-1 text-xs text-slate-600">${lang() === 'id' ? 'Isi jumlah per ukuran; sisa dihitung otomatis.' : '逐尺码填写已处理，剩余自动计算；未填数量保留。'}</p>`
      for (const line of process.lines.filter(row => row.availableQty > 0)) {
        const k = processKey(task.postTaskId, process.processItem, line.sku.skuId), value = processQty.get(k) ?? ''
        content += `<label class="mb-2 block text-sm">${ce(line.sku.skuCode)} <span class="text-xs text-slate-500">${lang() === 'id' ? 'Tersedia' : '可登记'} ${line.availableQty} · ${lang() === 'id' ? 'Sisa' : '剩余'} <span data-post-process-remain>${line.availableQty - Number(value || 0)}</span></span><input class="mt-1 min-h-12 w-full rounded-xl border bg-white p-2 text-base" data-post-process-qty data-post-task="${ce(task.postTaskId)}" data-post-process="${ce(process.processItem)}" data-post-sku="${ce(line.sku.skuId)}" data-post-available="${line.availableQty}" inputmode="numeric" value="${ce(value)}" placeholder="0"></label>`
      }
      content += `<label class="mb-1 block text-sm">${lang() === 'id' ? 'Alasan sisa (bila belum semua)' : '未处理原因（未填满时必填）'}<input class="mt-1 min-h-12 w-full rounded-xl border bg-white p-2" data-post-process-reason data-post-task="${ce(task.postTaskId)}" data-post-process="${ce(process.processItem)}" value="${ce(processReason.get(`${task.postTaskId}|${process.processItem}`) ?? '')}"></label><div class="mt-1 flex flex-wrap gap-2">${cb(lang() === 'id' ? 'Isi semua' : '填入全部', 'post-process-fill', `${task.postTaskId}|${process.processItem}`)}${cb(lang() === 'id' ? 'Simpan proses' : '保存本工序', 'post-process-save', `${task.postTaskId}|${process.processItem}`)}</div></details>`
    }
    if (progress.lines.some(line => line.availableForRecheckQty > 0)) content += `<div class="mt-2">${cb(lang() === 'id' ? 'Kirim ke recheck' : '交复检', 'post-submit-recheck', task.postTaskId)}</div>`
    content += '</article>'
  }
  const rechecks = centralPostRechecks(session.currentFactory).filter(row => row.deliveryId === d.deliveryId)
  if (rechecks.length) content += `<h2 class="mb-2 mt-4 text-lg font-bold">${lang() === 'id' ? 'Recheck' : '复检'}</h2>`
  for (const record of rechecks) {
    content += `<article class="mb-2 rounded-xl border bg-white p-3"><strong>${ce(record.recheckOrderNo)}</strong><div class="text-sm">${ce(postStatus(record.status, lang()))}</div>`
    if (record.status === '待复检') content += `<div class="mt-2">${cb(lang() === 'id' ? 'Ambil recheck' : '领取复检', 'post-recheck-claim', record.recheckOrderNo)}</div>`
    if (['复检中', '条码异常待重贴'].includes(record.status) && record.claimedBy?.actorId === session.account?.userId) {
      const recheckValues = record.lines.map(line => Number(recheckQty.get(recheckQtyKey(record.recheckOrderId, line.sku.skuId)) ?? line.expectedQty))
      const recheckDifference = record.lines.some((line, index) => recheckValues[index] !== line.expectedQty)
      for (const line of record.lines) {
        const lineKey = record.recheckOrderId + '|' + line.sku.skuId
        content += `<div class="mt-2 text-sm"><strong>${ce(line.sku.skuCode)}</strong> · ${ce(postStatus(line.barcodeStatus, lang()))} · ${lang() === 'id' ? 'Harus' : '应收'} ${line.expectedQty}<label class="mt-1 block">${lang() === 'id' ? 'Jumlah aktual' : '实际交出'}<input class="mt-1 min-h-12 w-full rounded-xl border bg-white p-2 text-base" data-post-recheck-qty data-post-recheck="${ce(record.recheckOrderId)}" data-post-sku="${ce(line.sku.skuId)}" inputmode="numeric" value="${ce(recheckQty.get(recheckQtyKey(record.recheckOrderId, line.sku.skuId)) ?? String(line.expectedQty))}"></label>`
        if (line.barcodeStatus !== '正确') content += `<div class="mt-1 flex gap-2"><input class="min-h-12 min-w-0 flex-1 rounded-xl border bg-white p-2" data-post-barcode data-post-expected="${ce(line.sku.barcode)}" data-post-recheck="${ce(record.recheckOrderId)}" data-post-sku="${ce(line.sku.skuId)}" value="${ce(barcodeInputs.get(lineKey) || '')}" placeholder="${lang() === 'id' ? 'Pindai barcode' : '扫描条码'}"><button type="button" class="min-h-12 rounded-xl border px-3" data-central-action="post-scan-barcode" data-central-value="${ce(lineKey)}">${lang() === 'id' ? 'Pindai' : '扫描'}</button></div>`
        if (line.barcodeStatus === '错误待重贴') content += `<div class="mt-1">${cb(lang() === 'id' ? 'Sudah tempel ulang' : '已重新贴码', 'post-recheck-relabel', lineKey)}</div>`
        content += '</div>'
      }
      content += `<article class="mt-2 rounded-xl border ${recheckDifference ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'} p-2"><strong>${recheckDifference ? (lang() === 'id' ? 'Selisih jumlah perlu izin' : '数量差异需授权') : (lang() === 'id' ? 'Izin selisih (isi bila ada selisih)' : '差异授权（仅数量差异时填写）')}</strong><label class="mt-1 block text-sm">${lang() === 'id' ? 'Kode izin' : '动态授权码'}<input class="mt-1 min-h-12 w-full rounded-xl border bg-white p-2" data-post-recheck-auth value="${ce(recheckAuth)}"></label><label class="mt-1 block text-sm">${lang() === 'id' ? 'Alasan selisih' : '差异原因'}<input class="mt-1 min-h-12 w-full rounded-xl border bg-white p-2" data-post-recheck-auth-reason value="${ce(recheckAuthReason)}"></label></article>`
      if (record.lines.every(line => line.expectedQty === 0 || line.barcodeStatus === '正确')) content += `<div class="mt-2">${cb(lang() === 'id' ? 'Selesaikan recheck' : '完成复检', 'post-complete-recheck', record.recheckOrderId)}</div>`
    }
    content += '</article>'
  }
  for (const row of centralPostOutbound(session.currentFactory).filter(row => row.deliveryId === d.deliveryId && row.status === '待仓库接收')) {
    const values = row.lines.map(line => ({ line, qty: Number(receiptQty.get(`${row.outboundOrderNo}|${line.sku.skuId}`) ?? line.outboundQty) }))
    const differs = values.some(item => item.qty !== item.line.outboundQty)
    content += `<details class="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2"${receiptQty.size ? ' open' : ''}><summary class="min-h-8 cursor-pointer font-semibold">${lang() === 'id' ? 'Terima gudang' : '仓库实收'} ${ce(row.outboundOrderNo)}</summary>`
    for (const item of values) content += `<label class="mb-2 block text-sm">${ce(item.line.sku.skuCode)} · ${lang() === 'id' ? 'Keluar' : '出库'} ${item.line.outboundQty}<input class="mt-1 min-h-12 w-full rounded-xl border bg-white p-2 text-base" data-post-receipt-qty data-post-outbound="${ce(row.outboundOrderNo)}" data-post-sku="${ce(item.line.sku.skuId)}" inputmode="numeric" value="${ce(receiptQty.get(`${row.outboundOrderNo}|${item.line.sku.skuId}`) ?? String(item.line.outboundQty))}"></label>`
    content += `<article class="mb-2 rounded-xl border ${differs ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'} p-2"><strong>${differs ? (lang() === 'id' ? 'Selisih terima perlu izin' : '实收差异需授权') : (lang() === 'id' ? 'Izin selisih (bila ada)' : '差异授权（仅实收差异时填写）')}</strong><label class="mt-1 block text-sm">${lang() === 'id' ? 'Kode izin' : '动态授权码'}<input class="mt-1 min-h-12 w-full rounded-xl border bg-white p-2" data-post-receipt-auth value="${ce(receiptAuth)}"></label><label class="mt-1 block text-sm">${lang() === 'id' ? 'Alasan selisih' : '差异原因'}<input class="mt-1 min-h-12 w-full rounded-xl border bg-white p-2" data-post-receipt-auth-reason value="${ce(receiptAuthReason)}"></label></article><div class="mt-1">${cb(lang() === 'id' ? 'Konfirmasi terima' : '确认仓库实收', 'post-outbound-receive', row.outboundOrderNo)}</div></details>`
  }
  const handovers = centralPostWaitHandovers(session.currentFactory).filter(row => row.productionOrderNo === d.productionOrderNo)
  if (handovers.length) {
    content += `<h2 class="mb-2 mt-4 text-lg font-bold">${lang() === 'id' ? 'Gudang serah terima' : '待交出仓'}</h2>`
    for (const row of handovers) content += `<article class="mb-2 rounded-xl border bg-white p-3"><strong>${ce(row.warehouseRecordId)}</strong><div class="text-sm">${ce(postStatus(row.status, lang()))} · ${row.lines.map(line => `${ce(line.sku.skuCode)} ${line.inboundQty}/${line.handedOverQty}`).join(' · ')}</div></article>`
  }
  return { content, primary }
}

function frame(): CentralPdaFrameInput {
  const r = route(), factory = getFactoryMasterRecordById(session.currentFactory), d = entryError ? undefined : centralPostDelivery(session.currentFactory, r.id)
  const base: CentralPdaFrameInput = { family: 'post', language: lang(), tab: r.tab, tabPathPrefix: prefix, accountName: centralFormalName(session.account?.name, session.account?.loginId || '', lang()), accountNo: '', factoryName: centralFormalName(factory?.name, factory?.code || '', lang()), operationName: pt(lang(), 'post'), content: '' }
  let content = notice()
  if (entryError) { base.content = content + centralNotice(entryError instanceof Error ? entryError.message : t('notSaved'), true); base.primary = { label: t('reload'), action: 'post-reload' }; return base }
  if (!session.account) {
    base.heading = t('login')
    base.content = content + `<label class="mb-3 block">${t('account')}<input class="mt-2 min-h-12 w-full rounded-xl border bg-white p-3" data-post-login="account" value="${ce(login.account)}" autocomplete="username"></label><label class="mb-3 block">${t('password')}<input type="password" class="mt-2 min-h-12 w-full rounded-xl border bg-white p-3" data-post-login="password" value="${ce(login.password)}" autocomplete="current-password"></label>`
    base.primary = { label: t('login'), action: 'post-login' }; return base
  }
  if (!r.id && r.tab === 'receive') content += `<section class="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3"><div class="text-lg font-bold">${lang() === 'id' ? 'Pengiriman jahit ke pabrik' : '车缝送货到厂'}</div><p class="mt-1 text-sm">${lang() === 'id' ? 'Mesin publik · didaftarkan oleh pengirim.' : '公共机 · 送货人登记'}</p><p class="mt-1 text-sm text-slate-600">${lang() === 'id' ? 'Pendaftaran terpisah dari penerimaan finishing.' : '送货登记与后道实收分开记录。'}</p><div class="mt-2">${cb(lang() === 'id' ? 'Mode kembali jahit' : '车缝回货模式', 'post-sewing-entry')}</div></section>`
  if (r.id) {
    base.backPath = prefix + '/' + r.tab; base.heading = d?.deliveryOrderNo || pt(lang(), 'post')
    if (!d) { base.content = content + centralNotice(t('wrongScan'), true); return base }
    content += postDetail(d, lang(), centralPostReceipts(session.currentFactory, d.deliveryId), centralPostQcTasks(session.currentFactory).filter(row => row.deliveryId === d.deliveryId), centralPostOutbound(session.currentFactory).filter(row => row.deliveryId === d.deliveryId))
    const panel = detailPanel(d); content += panel.content; base.primary = panel.primary
    content += `<div class="mt-3">${cb(t('next'), 'post-next')}</div>`; base.content = content; return base
  }
  if (r.tab === 'warehouse') {
    const waitProcess = centralPostWaitProcess(session.currentFactory), waitHandover = centralPostWaitHandovers(session.currentFactory)
    content += `<h2 class="mb-2 mt-4 text-lg font-bold">${lang() === 'id' ? 'Gudang tunggu proses' : '待加工仓'}</h2>`
    const processStock = new Map<string, number>()
    for (const row of waitProcess) for (const line of row.lines) processStock.set(line.sku.skuCode, (processStock.get(line.sku.skuCode) || 0) + line.availableQty)
    content += processStock.size ? `<article class="mb-2 rounded-xl border bg-white p-3">${[...processStock].map(([code, qty]) => `<div class="text-sm">${ce(code)} · ${lang() === 'id' ? 'Tersedia' : '可用'} ${qty}</div>`).join('')}<div class="mt-1 text-xs text-slate-600">${waitProcess.length} ${lang() === 'id' ? 'catatan penerimaan' : '条回货记录'}</div></article>` : centralNotice(lang() === 'id' ? 'Tidak ada stok.' : '待加工仓暂无库存。')
    const movementProcess = centralPostWaitProcessMovements(session.currentFactory)
    if (movementProcess.length) content += `<details class="mb-3 rounded-xl border bg-white p-3"><summary class="min-h-8 font-semibold">${lang() === 'id' ? 'Riwayat pergerakan' : '库存移动记录'}</summary>${movementProcess.map(row => `<div class="mt-1 text-sm">${ce(row.movementType)} · ${ce(row.deliveryOrderNo)} · ${row.quantities.map(line => `${ce(line.sku.skuCode)} ${line.quantity}`).join(' / ')}</div>`).join('')}</details>`
    content += `<h2 class="mb-2 mt-4 text-lg font-bold">${lang() === 'id' ? 'Gudang tunggu serah' : '待交出仓'}</h2>`
    const handoverStock = new Map<string, { inbound: number; available: number; handedOver: number }>()
    for (const row of waitHandover) for (const line of row.lines) { const current = handoverStock.get(line.sku.skuCode) || { inbound: 0, available: 0, handedOver: 0 }; current.inbound += line.inboundQty; current.available += line.availableQty; current.handedOver += line.handedOverQty; handoverStock.set(line.sku.skuCode, current) }
    content += handoverStock.size ? `<article class="mb-2 rounded-xl border bg-white p-3">${[...handoverStock].map(([code, qty]) => `<div class="text-sm">${ce(code)} · ${lang() === 'id' ? 'Masuk' : '入仓'} ${qty.inbound} · ${lang() === 'id' ? 'Sisa' : '可用'} ${qty.available} · ${lang() === 'id' ? 'Diserahkan' : '已交出'} ${qty.handedOver}</div>`).join('')}<div class="mt-1 text-xs text-slate-600">${waitHandover.length} ${lang() === 'id' ? 'catatan serah terima' : '条交出记录'}</div></article>` : centralNotice(lang() === 'id' ? 'Tidak ada stok.' : '待交出仓暂无库存。')
    const movementHandover = centralPostWaitHandoverMovements(session.currentFactory)
    if (movementHandover.length) content += `<details class="mb-3 rounded-xl border bg-white p-3"><summary class="min-h-8 font-semibold">${lang() === 'id' ? 'Riwayat pergerakan' : '库存移动记录'}</summary>${movementHandover.map(row => `<div class="mt-1 text-sm">${ce(row.movementType)} · ${ce(row.outboundOrderNo)} · ${row.quantities.map(line => `${ce(line.sku.skuCode)} ${line.quantity}`).join(' / ')}</div>`).join('')}</details>`
  }
  content += `<label class="mb-3 block font-semibold">${t('scan')}<div class="mt-2 flex gap-2"><input class="min-h-14 min-w-0 flex-1 rounded-xl border bg-white p-3 text-lg" data-post-field="scan" value="${ce(scan)}" placeholder="${ce(pt(lang(), 'scanHint'))}" autocomplete="off">${cb(t('identify'), 'post-identify')}</div></label>`
  const rows = centralPostDeliveries(session.currentFactory).filter(delivery => r.tab === 'receive' ? ['待后道确认', '待二次点数', '差异待授权'].includes(delivery.status) : r.tab === 'execute' ? ['已确认待送检', '已送检'].includes(delivery.status) : true)
  content += rows.map(delivery => postListCard(delivery, lang())).join('') || centralNotice(pt(lang(), 'noData'))
  base.content = content; return base
}

function patch() { const host = root(); if (!host) return; const main = host.querySelector<HTMLElement>('[data-central-content]')!, top = main.scrollTop, template = document.createElement('template'); template.innerHTML = renderCentralPdaFrame(frame()); const next = template.content.firstElementChild!; host.lang = next.getAttribute('lang') || ''; host.querySelector('header')!.replaceWith(next.querySelector('header')!); host.querySelector('[data-central-heading]')!.replaceWith(next.querySelector('[data-central-heading]')!); main.replaceChildren(...next.querySelector('[data-central-content]')!.childNodes); host.querySelector('[data-central-footer]')?.remove(); host.querySelector('nav')?.remove(); for (const selector of ['[data-central-footer]', 'nav']) { const el = next.querySelector(selector); if (el) host.append(el) } main.scrollTop = top; mountCentralPostPage(); hydrateIcons(host); if (message) host.querySelector('[role="alert"]')?.scrollIntoView({ block: 'start' }) }
function navigate(next: string) { message = undefined; success = ''; scan = ''; counts.clear(); secondCounts.clear(); qcValues.clear(); barcodeInputs.clear(); needsSecond = ''; needsAuth = ''; authValue = ''; diffReason = ''; qcAuth = ''; qcAuthReason = ''; qcProcessItems = []; recheckAuth = ''; recheckAuthReason = ''; processQty.clear(); processReason.clear(); recheckQty.clear(); receiptQty.clear(); receiptAuth = ''; receiptAuthReason = ''; for (const url of qcPhotos.values()) releasePostFinishingPendingFile(url); qcPhotos.clear(); path = next; if (appStore.getState().pathname === next) patch(); else appStore.navigate(next) }
function signOut() { discardCentralDrafts(); session.signedOut = true; session.account = undefined; login = { account: '', password: '' }; saveCentralSessionPreference(); message = undefined; patch() }
function identify() { const found = centralPostScan(scan, session.currentFactory); if (found.length === 1) navigate(prefix + '/' + route().tab + '/' + encodeURIComponent(found[0].deliveryId)); else { message = new Error(t('wrongScan')); patch(); root()?.querySelector<HTMLInputElement>('[data-post-field="scan"]')?.select() } }
function refreshPrimary() { const button = root()?.querySelector<HTMLButtonElement>('[data-central-footer] button'), primary = frame().primary; if (button && primary) button.disabled = !!primary.disabled }
async function execute(action: () => Promise<unknown>) { if (saving) return; message = undefined; success = ''; saving = true; patch(); try { await action(); success = t('saved') } catch (error) { message = error } finally { saving = false; if (root()) patch() } }
async function confirmReceipt() {
  const d = entryError ? undefined : centralPostDelivery(session.currentFactory, route().id), user = session.account
  if (!d || !user || saving) return
  const first = d.lines.map(line => ({ skuId: line.sku.skuId, actualQty: Number(counts.get(d.deliveryId + '|' + line.sku.skuId) ?? line.firstCountQty ?? line.registeredQty) }))
  const second = d.status === '待二次点数' || d.status === '差异待授权' || needsSecond === d.deliveryId ? d.lines.map(line => ({ skuId: line.sku.skuId, actualQty: Number(secondCounts.get(d.deliveryId + '|' + line.sku.skuId) ?? line.secondCountQty ?? line.firstCountQty ?? line.registeredQty) })) : undefined
  const authorization = d.status === '差异待授权' || needsAuth === d.deliveryId ? { scanValue: authValue.trim(), differenceReason: diffReason.trim() } : undefined
  await execute(async () => { try { await saveCentralPostReceipt(d.deliveryId, first, second, user, authorization) } catch (error) { const text = error instanceof Error ? error.message : ''; if (/二次点数/.test(text)) needsSecond = d.deliveryId; else if (/授权/.test(text)) needsAuth = d.deliveryId; throw error } })
}
async function completeQcForm() {
  const d = entryError ? undefined : centralPostDelivery(session.currentFactory, route().id), user = session.account
  const task = d ? centralPostQcTasks(session.currentFactory).find(row => row.deliveryId === d.deliveryId && row.status === '质检中') : undefined
  if (!task || !user || saving) return
  const state = qcState(task)
  if (!state.valid) { message = new Error(lang() === 'id' ? 'Periksa jumlah, alasan, dan izin.' : '请核对数量、原因和差异授权。'); patch(); return }
  await execute(async () => { await completeCentralPostQc(task.qcTaskId, state.results, qcProcessItems, user, state.authorization); qcValues.clear(); qcProcessItems = []; qcAuth = ''; qcAuthReason = ''; qcPhotos.clear() })
}
export async function renderCentralPostPage(next: string, isCurrent = () => true) {
  const token = ++generation; path = next
  try { await ensurePostFinishingRecordState(); if (token !== generation || !isCurrent()) return ''; const preferred = session.currentFactory || session.preference.factoryId || ''; const valid = listFactoryMasterRecords().some(factory => factory.id === preferred && factory.status === 'active' && isCentralPdaFactory(factory)); ensureCentralSessionAccount(valid ? preferred : listFactoryMasterRecords().find(factory => factory.status === 'active' && isCentralPdaFactory(factory))?.id || ''); entryError = undefined; if (next.split('?')[0].endsWith('/sewing-return')) { const sewing = await import('./post-sewing-page.ts'); if (token !== generation || !isCurrent()) return ''; return sewing.renderCentralPostSewingPage(next, isCurrent) } return renderCentralPdaFrame(frame()) }
  catch (error) { if (token !== generation || !isCurrent()) return ''; entryError = error; return renderCentralPdaFrame(frame()) }
}
export async function handleCentralPostEvent(target: Element, event?: Event): Promise<boolean> {
  if (!root()) return false
  if (path.split('?')[0].endsWith('/sewing-return')) { const sewing = await import('./post-sewing-page.ts'); return sewing.handleCentralPostSewingEvent(target, event) }
  if (event instanceof KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); if (route().id) navigate(prefix + '/' + route().tab); return true }
    if (event.key === 'F1') { event.preventDefault(); root()?.querySelector<HTMLButtonElement>('[data-central-footer] button:not(:disabled)')?.focus(); return true }
    if (event.key === 'Enter' && !event.isComposing) {
      if (target.matches('[data-post-field="scan"]')) { event.preventDefault(); identify(); return true }
      if (target.matches('[data-post-login="account"]')) { event.preventDefault(); root()?.querySelector<HTMLInputElement>('[data-post-login="password"]')?.focus(); return true }
      if (target.matches('[data-post-login="password"]')) { event.preventDefault(); root()?.querySelector<HTMLButtonElement>('[data-central-action="post-login"]')?.click(); return true }
    }
  }
  const qcFile = target.closest<HTMLInputElement>('[data-post-qc-file]')
  if (qcFile && event?.type === 'change') { const picked = qcFile.files?.[0]; if (picked) { try { const key = qcLineKey(qcFile.dataset.postQcFile || ''); const old = qcPhotos.get(key); if (old) releasePostFinishingPendingFile(old); qcPhotos.set(key, registerPostFinishingFile(picked)); message = undefined } catch (error) { message = error } patch() } return true }
  const select = target.closest<HTMLSelectElement>('select[data-post-qc-select]')
  if (select && event?.type === 'change') { const values = qcValue(select.dataset.postSku || ''); (values as unknown as Record<string, string>)[select.dataset.postQcSelect || ''] = select.value; qcValues.set(qcLineKey(select.dataset.postSku || ''), values); refreshPrimary(); return true }
  const input = target.closest<HTMLInputElement>('[data-post-field],[data-post-login],[data-post-count],[data-post-second],[data-post-auth],[data-post-reason],[data-post-qc-num],[data-post-qc-text],[data-post-qc-auth],[data-post-qc-auth-reason],[data-post-barcode],[data-post-process-qty],[data-post-process-reason],[data-post-recheck-qty],[data-post-receipt-qty],[data-post-receipt-auth],[data-post-receipt-auth-reason],[data-post-recheck-auth],[data-post-recheck-auth-reason]')
  if (input && (event?.type === 'input' || event?.type === 'change')) {
    if (input.dataset.postLogin) { login[input.dataset.postLogin as 'account' | 'password'] = input.value; return true }
    if (input.dataset.postField === 'scan') { scan = input.value; return true }
    if (input.dataset.postBarcode !== undefined) { barcodeInputs.set((input.dataset.postRecheck || '') + '|' + (input.dataset.postSku || ''), input.value); return true }
    if (input.dataset.postProcessReason !== undefined) { processReason.set(`${input.dataset.postTask || ''}|${input.dataset.postProcess || ''}`, input.value); return true }
    if (input.dataset.postProcessQty !== undefined) { processQty.set(processKey(input.dataset.postTask || '', input.dataset.postProcess || '', input.dataset.postSku || ''), input.value); const remain = input.closest('label')?.querySelector('[data-post-process-remain]'); if (remain) remain.textContent = String(Number(input.dataset.postAvailable || 0) - Number(input.value || 0)); return true }
    if (input.dataset.postRecheckQty !== undefined) { recheckQty.set(recheckQtyKey(input.dataset.postRecheck || '', input.dataset.postSku || ''), input.value); return true }
    if (input.dataset.postRecheckAuth !== undefined) { recheckAuth = input.value; return true }
    if (input.dataset.postRecheckAuthReason !== undefined) { recheckAuthReason = input.value; return true }
    if (input.dataset.postReceiptQty !== undefined) { receiptQty.set(`${input.dataset.postOutbound || ''}|${input.dataset.postSku || ''}`, input.value); return true }
    if (input.dataset.postReceiptAuth !== undefined) { receiptAuth = input.value; return true }
    if (input.dataset.postReceiptAuthReason !== undefined) { receiptAuthReason = input.value; return true }
    if (input.dataset.postCount) { counts.set(route().id + '|' + input.dataset.postCount, input.value); return true }
    if (input.dataset.postSecond) { secondCounts.set(route().id + '|' + input.dataset.postSecond, input.value); return true }
    if (input.dataset.postAuth !== undefined) { authValue = input.value; refreshPrimary(); return true }
    if (input.dataset.postReason !== undefined) { diffReason = input.value; refreshPrimary(); return true }
    if (input.dataset.postQcAuth !== undefined) { qcAuth = input.value; refreshPrimary(); return true }
    if (input.dataset.postQcAuthReason !== undefined) { qcAuthReason = input.value; refreshPrimary(); return true }
    if (input.dataset.postQcNum) { const values = qcValue(input.dataset.postSku || ''); (values as unknown as Record<string, string>)[input.dataset.postQcNum] = input.value; qcValues.set(qcLineKey(input.dataset.postSku || ''), values); refreshPrimary(); return true }
    if (input.dataset.postQcText) { const values = qcValue(input.dataset.postSku || ''); (values as unknown as Record<string, string>)[input.dataset.postQcText] = input.value; qcValues.set(qcLineKey(input.dataset.postSku || ''), values); refreshPrimary(); return true }
    return true
  }
  const nav = target.closest<HTMLElement>('[data-central-nav]')?.dataset.centralNav
  if (nav) { navigate(nav); return true }
  const control = target.closest<HTMLElement>('[data-central-action]'), action = control?.dataset.centralAction, value = control?.dataset.centralValue
  if (!action) return false
  switch (action) {
    case 'language': session.language = lang() === 'id' ? 'zh' : 'id'; message = undefined; saveCentralSessionPreference(); patch(); break
    case 'logout': discardCentralDrafts(); signOut(); break
    case 'post-login': { const user = readFactoryPdaExecutionUsers().find(row => normalizePdaLoginId(row.loginId) === normalizePdaLoginId(login.account)); if (!user || !verifyPdaPassword(login.password, user.passwordHash) || user.status !== 'ACTIVE' || !listFactoryMasterRecords().some(factory => factory.id === user.factoryId && factory.status === 'active' && isCentralPdaFactory(factory))) { message = new Error(t('loginFail')); patch(); break } discardCentralDrafts(); session.account = user; session.currentFactory = user.factoryId; session.signedOut = false; login = { account: '', password: '' }; saveCentralSessionPreference(); navigate(prefix + '/' + route().tab); break }
    case 'post-identify': identify(); break
    case 'post-sewing-entry': navigate(prefix + '/sewing-return'); break
    case 'post-order': navigate(prefix + '/' + route().tab + '/' + encodeURIComponent(value || '')); break
    case 'post-next': navigate(prefix + '/' + route().tab); break
    case 'post-reload': window.location.reload(); break
    case 'post-confirm': await confirmReceipt(); break
    case 'post-send-qc': { const d = centralPostDelivery(session.currentFactory, route().id); if (d) await execute(() => sendCentralPostToQc(d.deliveryId, session.account!)); break }
    case 'post-qc-claim': { const qcTask = centralPostQcTasks(session.currentFactory).find(row => row.deliveryId === route().id && row.status === '待质检'); if (qcTask) await execute(() => claimCentralPostQc(qcTask.qcTaskNo, session.account!)); break }
    case 'post-qc-photo': root()?.querySelector<HTMLInputElement>(`[data-post-qc-file="${value || ''}"]`)?.click(); break
    case 'post-qc-complete': await completeQcForm(); break
    case 'post-process': { const item = value || ''; qcProcessItems = qcProcessItems.includes(item) ? qcProcessItems.filter(row => row !== item) : [...qcProcessItems, item]; patch(); break }
    case 'post-process-fill': { const [taskId, item] = (value || '').split('|'); const progress = centralPostProcessProgress(taskId), process = progress.processes.find(row => row.processItem === item && row.applicable); for (const line of process?.lines.filter(row => row.availableQty > 0) || []) { processQty.set(processKey(taskId, item, line.sku.skuId), String(line.availableQty)); for (const input of root()?.querySelectorAll<HTMLInputElement>('[data-post-process-qty]') || []) if (input.dataset.postTask === taskId && input.dataset.postProcess === item && input.dataset.postSku === line.sku.skuId) { input.value = String(line.availableQty); const remain = input.closest('label')?.querySelector('[data-post-process-remain]'); if (remain) remain.textContent = '0' } } break }
    case 'post-process-save': { const [taskId, item] = (value || '').split('|'); const progress = centralPostProcessProgress(taskId), process = progress.processes.find(row => row.processItem === item && row.applicable); if (!process) break; const quantities = process.lines.filter(row => row.availableQty > 0).map(line => ({ skuId: line.sku.skuId, quantity: Number(processQty.get(processKey(taskId, item, line.sku.skuId)) ?? 0) })); const filled = quantities.reduce((sum, line) => sum + line.quantity, 0); if (filled < process.availableQty && !(processReason.get(`${taskId}|${item}`) || '').trim()) { message = new Error(lang() === 'id' ? 'Isi alasan bila belum semua diproses.' : '未填满时请填写未处理原因。'); patch(); break } await execute(() => registerCentralPostProcess(taskId, item, session.account!, quantities, processReason.get(`${taskId}|${item}`))); if (!message) { for (const key of [...processQty.keys()]) if (key.startsWith(`${taskId}|${item}|`)) processQty.delete(key); processReason.delete(`${taskId}|${item}`); patch() } break }
    case 'post-submit-recheck': await execute(() => submitCentralPostRecheck(value || '', session.account!)); break
    case 'post-recheck-claim': await execute(() => claimCentralPostRecheck(value || '', session.account!)); break
    case 'post-scan-barcode': { const [recheckId, skuId] = (value || '').split('|'); await execute(() => scanCentralPostBarcode(recheckId, skuId, barcodeInputs.get(value || '') || '', session.account!)); break }
    case 'post-recheck-relabel': { const [recheckId, skuId] = (value || '').split('|'); await execute(() => markCentralPostRelabeled(recheckId, skuId, session.account!)); break }
    case 'post-complete-recheck': { const record = centralPostRechecks(session.currentFactory).find(row => row.recheckOrderId === value); const results = record?.lines.map(line => ({ skuId: line.sku.skuId, handoverQty: Number(recheckQty.get(recheckQtyKey(record.recheckOrderId, line.sku.skuId)) ?? line.expectedQty) })); const authorization = recheckAuth.trim() || recheckAuthReason.trim() ? { scanValue: recheckAuth.trim(), differenceReason: recheckAuthReason.trim() } : undefined; await execute(() => completeCentralPostRecheck(value || '', session.account!, results, authorization)); if (!message) { for (const key of [...recheckQty.keys()]) if (key.startsWith(`${value || ''}|`)) recheckQty.delete(key); recheckAuth = ''; recheckAuthReason = ''; patch() } break }
    case 'post-outbound-receive': { const order = centralPostOutbound(session.currentFactory).find(row => row.outboundOrderNo === value); const results = order?.lines.map(line => ({ skuId: line.sku.skuId, receivedQty: Number(receiptQty.get(`${value}|${line.sku.skuId}`) ?? line.outboundQty) })); const authorization = receiptAuth.trim() || receiptAuthReason.trim() ? { scanValue: receiptAuth.trim(), differenceReason: receiptAuthReason.trim() } : undefined; await execute(() => receiveCentralPostOutbound(value || '', session.account!, results, authorization)); if (!message) { receiptQty.clear(); receiptAuth = ''; receiptAuthReason = ''; patch() } break }
    case 'operation': openOperationOverlay(); break
    case 'post-close': closeCentralPostOverlay(); break
    case 'post-other': navigate('/fcs/pda/central/receive'); break
  }
  return true
}
function openOperationOverlay() { const el = document.createElement('div'); el.dataset.postOverlay = ''; el.className = 'fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-2'; el.innerHTML = `<section role="dialog" aria-modal="true" class="max-h-[90dvh] w-full max-w-[420px] overflow-auto rounded-2xl bg-white p-3"><h2 class="mb-2 text-lg font-bold">${pt(lang(), 'post')}</h2><div class="grid gap-2">${cb(pt(lang(), 'post'), 'post-close', undefined, true)}${cb(lang() === 'id' ? 'Proses lain' : '其他工序', 'post-other')}</div><div class="mt-3">${cb(t('close'), 'post-close')}</div></section>`; el.addEventListener('click', e => { if (e.target === el) el.remove() }); (root()?.parentElement ?? document.body).append(el); hydrateIcons(el) }
export function closeCentralPostOverlay() { document.querySelector('[data-post-overlay]')?.remove(); document.querySelector('[data-sewing-overlay]')?.remove() }
let mounted = false
export function mountCentralPostPage() { const host = root(); if (!host) return; const size = () => { if (root()) root()!.style.height = `${Math.round(window.visualViewport?.height || innerHeight)}px` }; if (!mounted) { mounted = true; window.visualViewport?.addEventListener('resize', size) } size(); if (path.split('?')[0].endsWith('/sewing-return')) { void import('./post-sewing-page.ts').then(module => module.mountCentralPostSewingPage()); return } if (!document.querySelector('[data-post-overlay]')) { const scanInput = host.querySelector<HTMLInputElement>('[data-post-field="scan"]'); (scanInput || host.querySelector<HTMLInputElement>('[data-post-login="account"]'))?.focus({ preventScroll: true }) } }
