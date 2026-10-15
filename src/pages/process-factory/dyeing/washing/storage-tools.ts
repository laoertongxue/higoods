// @page-pattern: form
import { escapeHtml as e } from '../../../../utils.ts'
import { washingStorageStats, exportWashingBackup, restoreWashingBackup, cleanupWashingFiles } from '../../../../data/fcs/fabric-washing-maintenance.ts'
const button=(label:string,action:string)=>`<button class="min-h-10 rounded border bg-white px-3" data-fabric-washing-action="storage-${action}" data-skip-page-rerender="true">${label}</button>`
export async function renderWashingStorageTools(){
 const stats=await washingStorageStats()
 return `<section class="space-y-3 p-4" data-washing-storage><h1 class="text-xl font-semibold">洗水本地资料</h1><p>当前浏览器：${stats.records} 条必要 FCS 记录；附件 ${stats.files} 个，${stats.bytes} 字节。</p><p>浏览器容量估值：已用 ${stats.usage??'未知'} / 总额度 ${stats.quota??'未知'} 字节。估值不表示可永久或无限保存。</p><div class="flex flex-wrap gap-3">${button('重新估算','stats')}${button('导出完整备份','export')}${button('核验并恢复备份','restore')}${button('清理无引用洗水附件','cleanup')}</div><label>选择洗水备份文件<input class="block mt-2 max-w-full" type="file" accept=".json,application/json" data-washing-backup-input></label><p class="text-sm">恢复时保留同号相同记录，拒绝覆盖不同内容。范围为洗水及已切换的必要 FCS 记录，不处理 PCS 资料。</p><p class="text-sm">本入口不执行业务重置或清空；这些动作须另行明确范围和授权。</p><p role="alert" class="text-red-700" data-washing-error></p><p class="text-green-700" data-washing-result></p></section>`
}
export async function handleWashingStorageAction(action:string,root:HTMLElement){
 const error=root.querySelector('[data-washing-error]'),result=root.querySelector('[data-washing-result]');if(error)error.textContent=''
 try{
 if(action==='storage-stats'){root.innerHTML=await renderWashingStorageTools();return true}
 if(action==='storage-export'){
  const backup=await exportWashingBackup(),url=URL.createObjectURL(new Blob([JSON.stringify(backup)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='higood-fcs-fabric-washing-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);if(result)result.textContent='完整备份已生成，包含必要业务关系和附件。'
 }else if(action==='storage-restore'){
  const file=root.querySelector<HTMLInputElement>('[data-washing-backup-input]')?.files?.[0];if(!file)throw new Error('请先选择洗水备份文件。')
  const count=await restoreWashingBackup(JSON.parse(await file.text()));root.innerHTML=await renderWashingStorageTools();root.querySelector('[data-washing-result]')!.textContent=`恢复及回读完成，新增 ${count} 条记录。`
 }else if(action==='storage-cleanup'){const count=await cleanupWashingFiles();root.innerHTML=await renderWashingStorageTools();root.querySelector('[data-washing-result]')!.textContent=`已清理 ${count} 个无有效引用的洗水附件。`}
 }catch(err){if(error)error.textContent=e(err instanceof Error?err.message:String(err))}
 return true
}
