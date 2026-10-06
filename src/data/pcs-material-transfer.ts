import { getPcsDurableFileReference, resolvePcsFileReference, runPcsRecordCommand, insertPcsRecordGroups } from './pcs-record-runtime.ts'
import { buildProcessedMaterialCode, materialCodeSegment, checkedMaterialCode, canonicalMaterialUnit, materialMoney, validateMaterialRelation } from './pcs-material-rules.ts'
import { getMaterialTemplate, getMaterialTemplateByVersion, listMaterialUnitDefinitions, listMaterialProcessConfigurations } from './pcs-material-config.ts'
import { getMaterialPatternReference } from './pcs-material-pattern.ts'
import { validateMaterialDimensions, validateMaterialTemplateValues, validateMaterialEquipmentPairs } from './pcs-material-attributes.ts'
import { getMaterialArchiveStoreSnapshot, getMaterialArchiveByCode, withMaterialArchiveMutationBatch, getMaterialUnitFactor, getMaterialPricingRelationId, createMaterialArchive, createMaterialSkuRecord, createProcessedMaterialSku, saveMaterialUnitRelation, saveMaterialStandardCost, resolveMaterialSkuIdentity, materialSkuIdentityFingerprint, buildTmfSemiFinishedSkuCode, listMaterialCostVersions, type MaterialArchiveDraft } from './pcs-material-archive-repository.ts'
import type { MaterialArchiveKind, MaterialSkuDraftInput, MaterialSkuRecord, MaterialProcessDraft, MaterialStandardCostVersion, MaterialUnitRelation, MaterialSpecValues, MaterialEquipmentCompatibility } from './pcs-material-archive-types.ts'
import { prepareNewMaterialArchiveGroup, getMaterialImportReferenceSnapshot, getMaterialArchiveIdentities, MATERIAL_ARCHIVE_STORAGE_KEY } from './pcs-material-archive-repository.ts'

export type MaterialTransferMode = 'archives' | 'units' | 'costs'
export const MATERIAL_TRANSFER_LABELS: Record<MaterialTransferMode, string> = { archives: '物料主档与 SKU', units: 'SKU 单位关系', costs: 'SKU 标准成本' }
const archiveHeaders = ['物料编码','物料名称','英文名称','子类','规格摘要','技术属性JSON','成分JSON','主图','附图JSON','备注','主计量单位','SKU颜色','SKU颜色编码','SKU规格名称','SKU识别图','SKU身份属性JSON','加工类型','直接投入SKU','Pantone体系','Pantone色号','花型ID','花型版本ID','花型展示图','背面花型ID','背面花型版本ID','印花面别','渗透印','交付修订段','有效规格JSON','执行资料ID','工艺资料版本','投入计量关系ID','模板ID','模板版本','设备适配JSON','SKU名称','旧码条码别名JSON']
const unitHeaders = ['SKU编码或ID','关系ID','辅助单位','1辅等于主数量','依据类型','换算依据','包装规格ID','适用用途','默认用途','状态','调整原因']
const costHeaders = ['SKU编码或ID','标准采购成本RMB','基础运输成本RMB','本道加工费RMB','采购已含运输','产出计价单位','计量关系ID','原币金额','原币','原报价单位','原币折算CNY','归一依据','调整原因']
export const materialTransferHeaders = (mode: MaterialTransferMode): string[] => [...(mode === 'archives' ? archiveHeaders : mode === 'units' ? unitHeaders : costHeaders)]
export interface MaterialImportRow { line: number; values: Record<string, string>; key: string; description: string; errors: string[] }
export interface MaterialImportGroup { key: string; rows: MaterialImportRow[]; errors: string[] }
export interface MaterialImportPreview { mode: MaterialTransferMode; kind: MaterialArchiveKind; rows: MaterialImportRow[]; groups: MaterialImportGroup[]; validGroups: number; failedRows: number }
export interface MaterialImportCommitResult { key: string; ok: boolean; codes: string[]; lineNumbers: number[]; message: string }
export type MaterialImportCommit = (recipe: () => string[], operationId: string) => Promise<string[]>

export function materialRowsToCsv(rows: unknown[][]): string {
  return '\uFEFF' + rows.map(row => row.map(value => '"' + String(value ?? '').replaceAll('"', '""') + '"').join(',')).join('\r\n')
}
export function parseMaterialBusinessCsv(text: string): string[][] {
  const result: string[][] = [], row: string[] = []; let cell = '', quoted = false
  text = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++ } else quoted = !quoted }
    else if (!quoted && char === ',') { row.push(cell.trim()); cell = '' }
    else if (!quoted && (char === '\n' || char === '\r')) { if (char === '\r' && text[i + 1] === '\n') i++; row.push(cell.trim()); if (row.some(Boolean)) result.push([...row]); row.length = 0; cell = '' }
    else cell += char
  }
  if (quoted) throw new Error('CSV 引号未闭合，请检查文件格式。')
  row.push(cell.trim()); if (row.some(Boolean)) result.push(row)
  return result
}
function json<T>(value: string | undefined, fallback: T, label: string): T { if (!value) return fallback; try { return JSON.parse(value) as T } catch { throw new Error(`${label}不是有效 JSON。`) } }
function obj(value: string | undefined, label: string): MaterialSpecValues {
  const result = json<unknown>(value, {}, label)
  if (!result || Array.isArray(result) || typeof result !== 'object') throw new Error(`${label}应为字段和值的对象。`)
  for (const [key, item] of Object.entries(result)) {
    if (key === 'dimensions' && Array.isArray(item) && item.some(value=>typeof value==='object')) { validateMaterialDimensions(item); continue }
    if (item!==null&&typeof item!=='string'&&typeof item!=='number'&&!(Array.isArray(item)&&item.every(x=>typeof x==='string'))) throw new Error(`${label}的值应为文字、数值、多选文字或命名尺寸数组。`)
  }
  return result as MaterialSpecValues
}
const numeric = (value: string | undefined): number | null => value === undefined || value === '' ? null : materialMoney(Number(value))
const split = (value: string | undefined) => (value || '').split(/[、,，|]/).map(x => x.trim()).filter(Boolean)
function enumValue(value: string | undefined, allowed: string[], label: string, fallback = ''): string { const chosen = value || fallback; if (!allowed.includes(chosen)) throw new Error(`${label}应为 ${allowed.join(' / ')}。`); return chosen }
function safeImage(url: string | undefined): string { if (url && /^(data|blob|javascript):/i.test(url)) throw new Error('图片请使用已保存的文件引用或静态资料地址，不能导入内嵌图片字节或临时地址。'); return resolvePcsFileReference(url || '') }
function unitEnabled(unit: string): string { const normalized = canonicalMaterialUnit(unit); if (!listMaterialUnitDefinitions().some(item => item.enabled && item.code === normalized)) throw new Error('主单位或计价单位需在基础配置中启用。'); return normalized }
function rootInput(kind: MaterialArchiveKind, v: Record<string,string>): MaterialArchiveDraft {
  const template = v['模板ID'] ? getMaterialTemplateByVersion(v['模板ID'],Number(v['模板版本'])) : getMaterialTemplate(kind, v['子类']), attributes = obj(v['技术属性JSON'], '技术属性'), composition = json<Array<{component:string;percentage:number}>>(v['成分JSON'], [], '成分')
  if(template.kind!==kind||template.category!==v['子类'])throw new Error('模板版本不属于当前物料子类。')
  const equipment = json<MaterialEquipmentCompatibility[]>(v['设备适配JSON'],[],'设备适配')
  if(!Array.isArray(equipment)||equipment.some(item=>!item||typeof item!=='object'))throw new Error('设备适配必须为类型、型号配对数组。')
  validateMaterialEquipmentPairs(equipment,false)
  validateMaterialTemplateValues(template,'root',attributes,false)
  if (!v['物料编码'] || !v['物料名称']) throw new Error('物料编码、名称必填。')
  if(checkedMaterialCode(materialCodeSegment(v['物料编码'],'根物料编码'))!==v['物料编码'])throw new Error('根物料编码需规范化；请将空格改为短横线后再导入。')
  if (!Array.isArray(composition) || composition.some(x => !x.component || !Number.isFinite(x.percentage) || x.percentage < 0 || x.percentage > 100) || composition.length && Math.abs(composition.reduce((sum,x) => sum+x.percentage,0)-100) > .00001) throw new Error('成分需为名称和 0 至 100% 比例，合计 100%。')
  const gallery = json<string[]>(v['附图JSON'], [], '附图'); if (!Array.isArray(gallery)||gallery.some(item=>typeof item!=='string')) throw new Error('附图必须是图片地址数组。'); const resolvedGallery = gallery.map(safeImage)
  return { kind, materialCode: v['物料编码'], materialName:v['物料名称'], materialNameEn:v['英文名称'] || '', categoryName:v['子类'], specSummary:v['规格摘要'] || '',
    composition:composition.map(x=>`${x.component} ${x.percentage}%`).join('、'),compositionItems:composition,categoryAttributes:attributes,equipmentCompatibility:Array.isArray(attributes.equipment)?attributes.equipment.filter((item):item is string=>typeof item==='string'):[],equipmentCompatibilityDetails:equipment,processTags:[],
    widthText:attributes.width === undefined ? '' : `${attributes.width} ${template.fields.find(x=>x.key==='width')?.unit || 'cm'}`,gramWeightText:attributes.gramWeight === undefined ? '' : `${attributes.gramWeight} g/m²`,pricingUnit:v['主计量单位'],mainImageUrl:safeImage(v['主图']),galleryImageUrls:resolvedGallery,
    barcodeTemplateCode:'material-label-r1',remark:v['备注'] || '',templateId:template.templateId,templateVersion:template.version }
}
function baseInput(v: Record<string,string>): MaterialSkuDraftInput {
  const aliases=json<string[]>(v['旧码条码别名JSON'],[],'条码别名');if(!Array.isArray(aliases)||aliases.some(item=>typeof item!=='string'))throw new Error('条码别名必须是文字数组。')
  return {materialName:v['SKU名称']||undefined,barcodeAliases:aliases,colorName:v['SKU颜色'] || '',colorCode:v['SKU颜色编码'] || '',specName:v['SKU规格名称'] || '',sizeName:'',skuImageUrl:safeImage(v['SKU识别图'] || v['主图']),mainUnit:unitEnabled(v['主计量单位']),pricingUnit:unitEnabled(v['主计量单位']),identityValues:obj(v['SKU身份属性JSON'],'SKU 身份属性'),costPrice:0,freightCost:0,purchaseStandardCny:null,transportStandardCny:null,weightKg:0,lengthCm:0,widthCm:0,heightCm:0,barcode:''}
}
const processNames: Record<string,MaterialProcessDraft['processType']> = {染色:'DYEING',印花:'PRINTING',绣花:'EMBROIDERY',烫画:'HEAT_TRANSFER',DYEING:'DYEING',PRINTING:'PRINTING',EMBROIDERY:'EMBROIDERY',HEAT_TRANSFER:'HEAT_TRANSFER'}
function processInput(v: Record<string,string>, inputSkuId: string): MaterialProcessDraft {
  const type = processNames[v['加工类型']]; if (!type || !listMaterialProcessConfigurations().some(item=>item.id===type && item.enabled && item.material)) throw new Error('加工类型需为已启用的染色、印花、绣花或物料烫画。')
  const result:MaterialProcessDraft = {inputSkuId,processType:type,colorCode:v['SKU颜色编码'],colorName:v['SKU颜色'],pantoneSystem:v['Pantone体系'],pantoneCode:v['Pantone色号'],mainUnit:unitEnabled(v['主计量单位']),pricingUnit:unitEnabled(v['主计量单位']),skuImageUrl:safeImage(v['SKU识别图']),effectiveSpecValues:obj(v['有效规格JSON'],'有效规格'),processVersionId:v['工艺资料版本'] || '1',executionAssetIds:split(v['执行资料ID']),deliveryRevisionSegment:v['交付修订段'],unitBridgeVersionId:v['投入计量关系ID'] || undefined}
  if (type !== 'DYEING') {
    const pattern = getMaterialPatternReference(v['花型ID'],v['花型版本ID']);Object.assign(result,pattern,{patternImageUrl:safeImage(v['花型展示图']) || pattern.patternImageUrl})
    if (type === 'PRINTING') { result.printSide=enumValue(v['印花面别'],['A','AB'],'印花面别') as 'A'|'AB';result.penetration=enumValue(v['渗透印'],['是','否'],'渗透印','否')==='是';if(result.printSide==='AB'){const back=getMaterialPatternReference(v['背面花型ID']||pattern.patternId,v['背面花型版本ID']||pattern.patternVersionId);Object.assign(result,{backPatternId:back.patternId,backPatternCode:back.patternCode,backPatternVersionId:back.patternVersionId})} }
  }
  return result
}
function unitInput(v: Record<string,string>, sku: MaterialSkuRecord): Parameters<typeof saveMaterialUnitRelation>[1] {
  const input = {relationId:v['关系ID']||undefined,auxUnitId:unitEnabled(v['辅助单位']),mainQtyPerAux:Number(v['1辅等于主数量']),basisType:enumValue(v['依据类型'],['FIXED','SPECIFICATION','PACKAGE'],'依据类型') as MaterialUnitRelation['basisType'],basisReference:v['换算依据']||'',packageSpecId:v['包装规格ID']||undefined,uses:split(v['适用用途']) as MaterialUnitRelation['uses'],isDefaultForUse:split(v['默认用途']) as MaterialUnitRelation['uses'],status:enumValue(v['状态'],['ACTIVE','INACTIVE'],'状态','ACTIVE') as 'ACTIVE'|'INACTIVE',changeReason:v['调整原因']||''}
  if ([...input.uses,...input.isDefaultForUse].some(x=>!['PURCHASE','PRICING','ISSUE'].includes(x))) throw new Error('用途只能为 PURCHASE、PRICING、ISSUE。')
  validateMaterialRelation(sku.mainUnit!,{...input,relationId:input.relationId||'preview',materialSkuId:sku.materialSkuId,version:1,createdAt:''})
  return input
}
function costInput(v: Record<string,string>, sku: MaterialSkuRecord): Partial<MaterialStandardCostVersion> & {changeReason:string} {
  if (!v['调整原因']) throw new Error('调整原因必填。')
  const unit=unitEnabled(v['产出计价单位']),relation=getMaterialPricingRelationId(sku.materialSkuId,unit,v['计量关系ID']||undefined)
  if (getMaterialUnitFactor(sku.materialSkuId,unit,sku.mainUnit!,relation)===null) throw new Error('计价单位缺少有效换算关系。')
  const input: Partial<MaterialStandardCostVersion> & {changeReason:string} = {pricingUnit:unit,pricingUnitRelationId:relation,changeReason:v['调整原因']}
  if(sku.inputSkuId){if(v['标准采购成本RMB']||v['基础运输成本RMB'])throw new Error('加工 SKU 仅维护本道加工费，不重复录入采购或运输。');input.processStandardCny=numeric(v['本道加工费RMB'])}
  else {if(v['本道加工费RMB'])throw new Error('基础 SKU 不维护加工费。');input.purchaseStandardCny=numeric(v['标准采购成本RMB']);input.transportStandardCny=numeric(v['基础运输成本RMB']);input.purchaseIncludesTransport=enumValue(v['采购已含运输'],['是','否'],'采购已含运输','否')==='是'}
  if(v['原币金额']){const amount=numeric(v['原币金额']),fx=Number(v['原币折算CNY']);if(amount===null||!Number.isFinite(fx)||fx<=0||!v['归一依据'])throw new Error('原币归一需正数汇率及明确依据。');if(getMaterialUnitFactor(sku.materialSkuId,unit,v['原报价单位'])===null)throw new Error('原报价单位缺少换算关系。');input.sourceMoney={amount:v['原币金额'],currency:enumValue(v['原币'],['CNY','IDR','USD'],'原币'),unit:v['原报价单位'],cnyPerSourceCurrency:v['原币折算CNY'],normalizationBasis:v['归一依据']}}
  return input
}

/** Read-only validation: no commands, seed writes or draft persistence. */
export function previewMaterialBusinessImport(kind: MaterialArchiveKind, mode: MaterialTransferMode, text: string): MaterialImportPreview {
  const table=parseMaterialBusinessCsv(text), headers=table.shift() || [], expected=materialTransferHeaders(mode)
  if(!table.length)throw new Error('文件没有业务数据行。')
  if(headers.some((name,index)=>headers.indexOf(name)!==index)||!(mode==='archives'?expected.slice(0,32):expected).every(name=>headers.includes(name)))throw new Error('表头缺失或重复，请使用对应业务模板。')
  if(table.length>5000)throw new Error('单批最多 5000 行，请按物料拆分文件。')
  const snapshot=mode==='archives'?getMaterialImportReferenceSnapshot(new Set(table.map(row=>row[headers.indexOf('物料编码')]))):getMaterialArchiveStoreSnapshot(),rootByCode=new Map(snapshot.records.map(root=>[root.materialCode,root])),skuByCode=new Map(snapshot.skuRecords.map(sku=>[sku.materialSkuCode,sku])),skuById=new Map(snapshot.skuRecords.map(sku=>[sku.materialSkuId,sku])),groups=new Map<string,MaterialImportGroup>(),rows:MaterialImportRow[]=[],seen=new Set<string>(),counts=new Map<string,number>()
  const knownStages=new Map(snapshot.skuRecords.map(s=>[s.materialSkuId,s.stage||'BASE']))
  const existingCodes=mode==='archives'?getMaterialArchiveIdentities().skuCodes:new Set<string>()
  const baseIdentities=new Map<string,Set<string>>()
  for(const sku of snapshot.skuRecords)if(!sku.inputSkuId){const values=baseIdentities.get(sku.materialCode)||new Set<string>();values.add(materialSkuIdentityFingerprint(sku));baseIdentities.set(sku.materialCode,values);counts.set(sku.materialCode,(counts.get(sku.materialCode)||0)+1)}
  for(let i=0;i<table.length;i++){
    const values=Object.fromEntries(headers.map((name,index)=>[name,table[i][index]||''])),rawKey=mode==='archives'?values['物料编码']:values['SKU编码或ID'],key=mode==='archives'?rawKey:(skuById.get(rawKey)||skuByCode.get(rawKey))?.materialSkuCode||rawKey,row:MaterialImportRow={line:i+2,values,key,description:'',errors:[]}
    rows.push(row);let group=groups.get(key);if(!group){group={key,rows:[],errors:[]};groups.set(key,group)}group.rows.push(row)
    try{
      if(table[i].length!==headers.length)throw new Error('该行列数与表头不一致。')
      if(!key)throw new Error(mode==='archives'?'物料编码必填。':'SKU 编码或 ID 必填。')
      if(mode==='archives'){
        const existing=rootByCode.get(key),input=rootInput(kind,values)
        if(existing&&(existing.kind!==kind||existing.categoryName!==input.categoryName||existing.materialName!==input.materialName))throw new Error('已有物料编码的类别、子类或名称不一致；不会覆盖已有主档。')
        if(existing?.status==='ARCHIVED'||existing?.status==='INACTIVE')throw new Error('停用或归档物料不能新增选用。')
        if(existing)getMaterialTemplateByVersion(existing.templateId!,existing.templateVersion||1)
        if(group.rows.length>1){const first=group.rows[0].values;for(const field of archiveHeaders.slice(0,10))if(first[field]!==values[field])throw new Error('同一物料组的主档资料不一致：'+field)}
        const processType=values['加工类型'],isBase=!processType||processType==='基础'||processType==='BASE'
        let code:string,sku:MaterialSkuRecord
        if(isBase){const base=baseInput(values);validateMaterialTemplateValues(getMaterialTemplateByVersion(existing?.templateId||input.templateId!,existing?.templateVersion||input.templateVersion||1),'sku',{...base.identityValues,color:base.colorName},false);const identity=key+'|'+materialSkuIdentityFingerprint(base);if(seen.has(identity)||baseIdentities.get(key)?.has(materialSkuIdentityFingerprint(base)))throw new Error('基础 SKU 身份重复；改变展示名称不会产生新规格。');seen.add(identity);const count=(counts.get(key)||0)+1;counts.set(key,count);code=['织带','绳子'].includes(input.categoryName)?buildTmfSemiFinishedSkuCode({spuCode:key,colorCode:base.colorCode||base.colorName,pantoneCode:base.pantoneCode,patternCode:base.patternCode}):`${key}-B${String(count).padStart(2,'0')}`;sku={...base,materialSkuId:code,materialSkuCode:code,materialId:existing?.materialId||key,materialCode:key,stage:'BASE'} as MaterialSkuRecord}
        else{const parent=skuByCode.get(values['直接投入SKU'])||skuById.get(values['直接投入SKU']);if(!parent||parent.materialCode!==key)throw new Error('直接投入 SKU 不存在或不属于该物料；请将基础/上道行放在本行前。');const process=processInput(values,parent.materialSkuId);let cursor:MaterialSkuRecord|undefined=parent;while(cursor){if(knownStages.get(cursor.materialSkuId)===process.processType)throw new Error('同一物料对象不能重复相同工艺。');cursor=cursor.inputSkuId?skuById.get(cursor.inputSkuId):undefined}code=buildProcessedMaterialCode(parent.materialSkuCode,process);sku={...parent,materialSkuId:code,materialSkuCode:code,inputSkuId:parent.materialSkuId,stage:process.processType} as MaterialSkuRecord}
        if(skuByCode.has(code)||existingCodes.has(code))throw new Error('产出编码已存在：'+code)
        if(code.length>256)throw new Error('产出编码超过 256 字符。')
        skuByCode.set(code,sku);skuById.set(sku.materialSkuId,sku);knownStages.set(sku.materialSkuId,sku.stage||'BASE');row.description=code
      }else{
        const sku=skuById.get(key)||skuByCode.get(key);if(!sku)throw new Error('找不到内部物料 SKU。')
        const root=snapshot.records.find(item=>item.materialId===sku.materialId);if(root?.kind!==kind)throw new Error('该 SKU 不属于当前物料类别。')
        row.description=sku.materialSkuCode
        if(mode==='units'){const input=unitInput(values,sku),existing=input.relationId?snapshot.unitRelations?.find(item=>item.relationId===input.relationId):null;if(input.relationId&&(!existing||existing.materialSkuId!==sku.materialSkuId))throw new Error('关系 ID 不属于所选 SKU。');if(input.packageSpecId&&!snapshot.packages?.some(item=>item.packageSpecId===input.packageSpecId&&item.ownerSkuId===sku.materialSkuId&&item.status==='ACTIVE'&&item.packageTypeId===input.auxUnitId))throw new Error('包装规格需属于所选 SKU，处于启用状态且单位一致。');if(existing&&!input.changeReason.trim())throw new Error('调整换算关系请填写原因。');if(snapshot.unitRelations?.some(item=>item.materialSkuId===sku.materialSkuId&&item.status==='ACTIVE'&&item.relationId!==existing?.relationId&&canonicalMaterialUnit(item.auxUnitId)===input.auxUnitId&&(item.packageSpecId||'')===(input.packageSpecId||'')))throw new Error('此辅助关系已有有效版本，请填写原关系 ID 后编辑。');if(input.status==='INACTIVE'&&canonicalMaterialUnit(sku.pricingUnit)===input.auxUnitId)throw new Error('当前计价仍依赖此关系，不能停用。');if(input.status==='INACTIVE'&&snapshot.processDefinitions?.some(p=>p.inputSkuId===sku.materialSkuId&&(p.unitBridgeVersionId===existing?.relationId||canonicalMaterialUnit(snapshot.skuRecords.find(x=>x.materialSkuId===p.outputSkuId)?.pricingUnit||'')===input.auxUnitId)))throw new Error('下游标准成本仍依赖此关系，不能停用。');const identity=sku.materialSkuId+'|'+input.auxUnitId+'|'+(input.packageSpecId||'');if(seen.has(identity))throw new Error('同一批次不能重复维护同一计量关系。');seen.add(identity)}
        else{costInput(values,sku);if(seen.has(sku.materialSkuId))throw new Error('同一批次每个 SKU 只接受一个新标准。');seen.add(sku.materialSkuId)}
      }
    }catch(error){row.errors.push(error instanceof Error?error.message:'该行业务数据不正确。')}
  }
  for(const group of groups.values())group.errors=group.rows.flatMap(row=>row.errors.map(error=>`第 ${row.line} 行：${error}`))
  return {mode,kind,rows,groups:[...groups.values()],validGroups:[...groups.values()].filter(group=>!group.errors.length).length,failedRows:rows.filter(row=>row.errors.length).length}
}

/** Caller owns runPcsRecordCommand. One root and all imported children save in the same command. */
export function applyMaterialBusinessImportGroup(kind: MaterialArchiveKind, mode: MaterialTransferMode, group: MaterialImportGroup): string[] {
  if(group.errors.length)throw new Error('该物料组仍有行错误，请修正后重新预览。')
  return withMaterialArchiveMutationBatch(() => {
  const result:string[]=[]
  if(mode==='archives'){
    let root=getMaterialArchiveByCode(group.key)
    if(!root){try{root=createMaterialArchive(rootInput(kind,group.rows[0].values))}catch(error){throw materialImportRowError(group.rows[0],error)}}
    if(root.kind!==kind)throw new Error('物料类别不一致。')
    for(const row of group.rows){try{const v=row.values;if(!v['加工类型']||['基础','BASE'].includes(v['加工类型'])){const saved=createMaterialSkuRecord(root.materialId,baseInput(v));if(!saved)throw new Error('物料已不可用。');result.push(saved.materialSkuCode)}else{const parent=resolveMaterialSkuIdentity(v['直接投入SKU']);if(!parent||parent.materialId!==root.materialId)throw new Error('直接投入物料不一致。');result.push(createProcessedMaterialSku(processInput(v,parent.materialSkuId)).materialSkuCode)}}catch(error){throw materialImportRowError(row,error)}}
  }else for(const row of group.rows){try{const sku=resolveMaterialSkuIdentity(row.values['SKU编码或ID']);if(!sku)throw new Error('所选 SKU 已不存在。');if(mode==='units')saveMaterialUnitRelation(sku.materialSkuId,unitInput(row.values,sku));else saveMaterialStandardCost(sku.materialSkuId,costInput(row.values,sku));result.push(sku.materialSkuCode)}catch(error){throw materialImportRowError(row,error)}}
  return result
  })
}
function materialImportRowError(row: MaterialImportRow, error: unknown): Error {
  return new Error(`第 ${row.line} 行${row.description ? `（${row.description}）` : ''}：${error instanceof Error ? error.message : '该行业务数据未保存。'}`)
}

/** One completed command per parent group. Reuse the preview; repository writes recheck only that group. */
export async function runMaterialBusinessImportBatch(
  preview: MaterialImportPreview,
  batchId: string,
  previousResults: readonly MaterialImportCommitResult[] = [],
  commit: MaterialImportCommit = runPcsRecordCommand,
): Promise<MaterialImportCommitResult[]> {
  const previous = new Map(previousResults.filter(result => result.ok).map(result => [result.key, result]))
  const results: MaterialImportCommitResult[] = []
  // New roots are independent. Existing-root/unit/cost imports retain the
  // sequential command path because their changes may share existing records.
  const pending = preview.groups.filter(group => !previous.has(group.key) && !group.errors.length)
  if (commit === runPcsRecordCommand && preview.mode === 'archives' && pending.length > 1 && pending.every(group => !getMaterialArchiveByCode(group.key))) {
    const preparedResults = new Map<string, MaterialImportCommitResult>()
    try {
      const outcomes = await insertPcsRecordGroups(MATERIAL_ARCHIVE_STORAGE_KEY, () => {
        const { rootCodes, skuCodes } = getMaterialArchiveIdentities()
        return pending.flatMap(group => {
          try {
            if (rootCodes.has(group.key)) throw new Error('该物料编码已存在，请重新校验文件。')
            const prepared = prepareNewMaterialArchiveGroup(() => applyMaterialBusinessImportGroup(preview.kind, preview.mode, group))
            if (prepared.result.some(code => skuCodes.has(code))) throw new Error('产出 SKU 编码已存在，请重新校验文件。')
            rootCodes.add(group.key); prepared.result.forEach(code => skuCodes.add(code))
            return [{ operationId: `${batchId}:${preview.mode}:${encodeURIComponent(group.key)}`, snapshot: prepared.snapshot, result: { key: group.key, ok: true, codes: prepared.result, lineNumbers: group.rows.map(row => row.line), message: `${prepared.result.length} 行已保存` } }]
          } catch (error) {
            preparedResults.set(group.key, { key: group.key, ok: false, codes: [], lineNumbers: group.rows.map(row => row.line), message: error instanceof Error ? error.message : '本组未保存，请重试。' })
            return []
          }
        })
      })
      const submitted = pending.filter(group => !preparedResults.has(group.key))
      outcomes.forEach((outcome, index) => { const group = submitted[index]; preparedResults.set(group.key, outcome.ok ? outcome.result : { key: group.key, ok: false, codes: [], lineNumbers: group.rows.map(row => row.line), message: outcome.message }) })
    } catch (error) {
      for (const group of pending) if (!preparedResults.has(group.key)) preparedResults.set(group.key, { key: group.key, ok: false, codes: [], lineNumbers: group.rows.map(row => row.line), message: error instanceof Error ? error.message : '本组未保存，请重试。' })
    }
    return preview.groups.map(group => previous.get(group.key) || preparedResults.get(group.key) || { key: group.key, ok: false, codes: [], lineNumbers: group.rows.map(row => row.line), message: `未提交：${group.errors.join('；')}` })
  }
  for (const group of preview.groups) {
    const saved = previous.get(group.key)
    if (saved) { results.push(saved); continue }
    const lineNumbers = group.rows.map(row => row.line)
    if (group.errors.length) {
      results.push({ key: group.key, ok: false, codes: [], lineNumbers, message: `未提交：${group.errors.join('；')}` })
      continue
    }
    try {
      const codes = await commit(() => applyMaterialBusinessImportGroup(preview.kind, preview.mode, group), `${batchId}:${preview.mode}:${encodeURIComponent(group.key)}`)
      results.push({ key: group.key, ok: true, codes, lineNumbers, message: `${codes.length} 行已保存` })
    } catch (error) {
      results.push({ key: group.key, ok: false, codes: [], lineNumbers, message: error instanceof Error ? error.message : '本组未保存，请重试。' })
    }
  }
  return results
}

/** Synchronous preparation helper; browser confirmation uses runMaterialBusinessImportBatch. */
export function applyMaterialBusinessImportPreview(preview: MaterialImportPreview): Array<{key:string;codes:string[]}> {
  const groups=preview.groups.filter(group=>!group.errors.length)
  if(!groups.length)throw new Error('没有可保存的业务数据。')
  return withMaterialArchiveMutationBatch(()=>groups.map(group=>({key:group.key,codes:applyMaterialBusinessImportGroup(preview.kind,preview.mode,group)})))
}

export function buildMaterialBusinessTemplate(kind: MaterialArchiveKind, mode: MaterialTransferMode): string {
  const headers=materialTransferHeaders(mode),values:Record<string,string>={}
  if(mode==='archives'){const sample:Record<MaterialArchiveKind,[string,string,string,string]>={fabric:['CSV-FB-0001','导入示例面料','梭织布','M'],accessory:['CSV-AC-0001','导入示例纽扣','纽扣','PCS'],yarn:['CSV-YN-0001','导入示例棉纱','针织用纱','KG'],consumable:['CSV-CS-0001','导入示例包装袋','包装袋','PCS'],parts:['CSV-EP-0001','导入示例针板','缝纫机配件','PCS']};const [code,name,category,unit]=sample[kind];Object.assign(values,{'物料编码':code,'物料名称':name,'子类':category,'主计量单位':unit,'SKU颜色':'白色','SKU颜色编码':'white','SKU规格名称':'基础规格','加工类型':'基础','技术属性JSON':'{}','SKU身份属性JSON':'{}','有效规格JSON':'{}','成分JSON':'[]','附图JSON':'[]'})}
  else if(mode==='units')Object.assign(values,{'SKU编码或ID':'请替换为实际SKU','辅助单位':'KG','1辅等于主数量':'5','依据类型':'SPECIFICATION','换算依据':'经确认的技术规格','适用用途':'PURCHASE|PRICING|ISSUE','状态':'ACTIVE','调整原因':'批量维护标准换算'})
  else Object.assign(values,{'SKU编码或ID':'请替换为实际SKU','标准采购成本RMB':'5','基础运输成本RMB':'1','采购已含运输':'否','产出计价单位':kind==='yarn'?'KG':kind==='fabric'?'M':'PCS','调整原因':'批量维护标准成本'})
  return materialRowsToCsv([headers,headers.map(key=>values[key]||'')])
}
export function exportMaterialBusinessRows(mode: MaterialTransferMode, skuIds: string[], rootIds: string[] = []): string {
  const snapshot=getMaterialArchiveStoreSnapshot(),selected=new Set(skuIds),skus=snapshot.skuRecords.filter(sku=>selected.has(sku.materialSkuId)),headers=materialTransferHeaders(mode),rows:unknown[][]=[headers]
  for(const sku of skus){
    if(mode==='units'){for(const r of snapshot.unitRelations?.filter(r=>r.materialSkuId===sku.materialSkuId)||[])rows.push([sku.materialSkuCode,r.relationId,r.auxUnitId,r.mainQtyPerAux,r.basisType,r.basisReference,r.packageSpecId||'',r.uses.join('|'),r.isDefaultForUse.join('|'),r.status,r.changeReason]);continue}
    if(mode==='costs'){const c=listMaterialCostVersions(sku.materialSkuId).at(-1);rows.push([sku.materialSkuCode,c?.purchaseStandardCny,c?.transportStandardCny,c?.processStandardCny,c?.purchaseIncludesTransport?'是':'否',c?.pricingUnit||sku.pricingUnit,c?.pricingUnitRelationId,c?.sourceMoney?.amount,c?.sourceMoney?.currency,c?.sourceMoney?.unit,c?.sourceMoney?.cnyPerSourceCurrency,c?.sourceMoney?.normalizationBasis,c?.changeReason]);continue}
    const root=snapshot.records.find(item=>item.materialId===sku.materialId)!,process=snapshot.processDefinitions?.find(item=>item.outputSkuId===sku.materialSkuId),input=snapshot.skuRecords.find(item=>item.materialSkuId===sku.inputSkuId)
    rows.push([root.materialCode,root.materialName,root.materialNameEn,root.categoryName,root.specSummary,JSON.stringify(root.categoryAttributes||{}),JSON.stringify(root.compositionItems||[]),getPcsDurableFileReference(root.mainImageUrl),JSON.stringify((root.galleryImageUrls||[]).map(getPcsDurableFileReference)),root.remark,sku.mainUnit,sku.colorName,sku.colorCode,sku.specName,getPcsDurableFileReference(sku.skuImageUrl),JSON.stringify(sku.identityValues||{}),process?.processType||'BASE',input?.materialSkuCode,process?.pantoneSystem,process?.pantoneCode,process?.patternId,process?.patternVersionId,getPcsDurableFileReference(sku.patternImageUrl||''),process?.backPatternId,process?.backPatternVersionId,process?.printSide,process?.penetration?'是':'否',process?.deliveryRevisionSegment,JSON.stringify(sku.effectiveSpecValues||{}),process?.executionAssetIds.join('|'),process?.processVersionId,process?.unitBridgeVersionId,root.templateId,root.templateVersion,JSON.stringify(root.equipmentCompatibilityDetails||[]),sku.materialName,JSON.stringify(sku.barcodeAliases||[])])
  }
  if(mode==='archives')for(const root of snapshot.records.filter(root=>rootIds.includes(root.materialId)&&!snapshot.skuRecords.some(sku=>sku.materialId===root.materialId))){
    const values:Record<string,unknown>={'物料编码':root.materialCode,'物料名称':root.materialName,'英文名称':root.materialNameEn,'子类':root.categoryName,'规格摘要':root.specSummary,'技术属性JSON':JSON.stringify(root.categoryAttributes||{}),'成分JSON':JSON.stringify(root.compositionItems||[]),'主图':getPcsDurableFileReference(root.mainImageUrl),'附图JSON':JSON.stringify(root.galleryImageUrls.map(getPcsDurableFileReference)),'备注':root.remark,'加工类型':'无 SKU（待建立）','模板ID':root.templateId,'模板版本':root.templateVersion,'设备适配JSON':JSON.stringify(root.equipmentCompatibilityDetails||[])}
    rows.push(headers.map(key=>values[key]||''))
  }
  return materialRowsToCsv(rows)
}
