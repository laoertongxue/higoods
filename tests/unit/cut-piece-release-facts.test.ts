import {test} from 'node:test'
import assert from 'node:assert/strict'
import {projectReleaseTicket,getCutPieceReleaseEligibilityForDetail,buildReleaseBagEvidence,isReleaseTicketCraftRequirementKnown} from '../../src/data/fcs/cutting/cut-piece-release-facts.ts'
const crafts=[1,2,3].map(index=>({specialCraftId:`CRAFT-${index}`,craftCategory:index===1?'辅助工艺':'特种工艺',craftType:`工艺${index}`,craftName:`工艺${index}`,receiverFactoryId:`F${index}`,receiverFactoryName:`工厂${index}`}))
const ticket:any={feiTicketId:'FT-1',feiTicketNo:'FT-1',actualCutPieceQty:100,qty:100,partCode:'front',partName:'前片',printStatus:'PRINTED',garmentColor:'成衣红',fabricColor:'面料白',skuSize:'M',sourceBasisType:'ACTUAL_CUTTING_OUTPUT',sourceMarkerPlanNo:'MK-1',cutOrderNo:'CUT-1',specialCrafts:crafts,hasSpecialCraft:true}
const bag={ticketId:'FT-1',bagCode:'BAG-1',bagUseId:'CYCLE-1',eventId:'PACK-1',at:'2026-10-09T00:00:00Z',operator:'仓管',locationLabel:'架1'}
const receipt=(stage:number,returnedQty:number):any=>({feiTicketId:'FT-1',specialCraftId:`CRAFT-${stage}`,receiverFactoryId:`F${stage}`,returnedQty,eventId:`RETURN-${stage}`,returnedAt:`2026-10-09T0${stage}:00:00Z`,returnedBy:'仓管',differenceReason:'工艺损耗',expectedQty:stage===1?100:stage===2?95:90,processingCompleted:true})
const project=(overrides:Record<string,unknown>={})=>projectReleaseTicket({ticket,materialId:'MAT::BOM',materialName:'主料',bag,receipts:[],craftRequirementKnown:true,...overrides} as any)
test('N 道只按最终逐票实收，不累计道数或非最终回仓',()=>{
 const waiting=project();assert.equal(waiting.physicalPieceQty,100);assert.equal(waiting.eligiblePieceQty,0)
 const first=project({receipts:[receipt(1,95)]});assert.equal(first.physicalPieceQty,95);assert.equal(first.eligiblePieceQty,0)
 const final=project({receipts:[receipt(1,95),receipt(2,90),receipt(3,80)]});assert.equal(final.eligiblePieceQty,80);assert.equal(final.physicalPieceQty,80);assert.equal(final.receiptId,'RETURN-3');assert.equal(final.craftSteps.length,3)
 assert.equal(final.printedPieceQty,100);assert.equal(ticket.actualCutPieceQty,100);assert.equal(final.fabricColor,'面料白');assert.equal(final.garmentColor,'成衣红')
})
test('末道独有回仓、错票、错工厂、逆序回仓均不得计齐套',()=>{
 assert.equal(project({receipts:[receipt(3,80)]}).eligiblePieceQty,0)
 const receipts=[receipt(1,95),receipt(2,90),receipt(3,80)]
 assert.equal(project({receipts:receipts.map(r=>({...r,feiTicketId:'OTHER'}))}).eligiblePieceQty,0)
 assert.equal(project({receipts:[receipts[0],receipts[1],{...receipts[2],receiverFactoryId:'OTHER'}]}).eligiblePieceQty,0)
 assert.equal(project({receipts:[receipts[0],receipts[1],{...receipts[2],returnedAt:'2026-10-09T00:00:00Z'}]}).eligiblePieceQty,0)
 assert.equal(project({receipts:[receipts[0],receipts[1],{...receipts[2],returnedAt:'INVALID'}]}).eligiblePieceQty,0)
})
test('真实厂间完成事实只证明前道，末道仍以实际裁床回仓为准',()=>{
 const completions:any[]=[1,2].map(stage=>({feiTicketId:'FT-1',specialCraftId:`CRAFT-${stage}`,receiverFactoryId:`F${stage}`,returnedQty:stage===1?95:90,processingCompleted:true,returnedAt:`2026-10-09T0${stage}:00:00Z`,returnedBy:'仓管',eventId:`DIRECT-${stage}`,directTransfer:true}));
 const pending=project({completions});assert.equal(pending.physicalPieceQty,90);assert.equal(pending.eligiblePieceQty,0);assert.equal(pending.receiptId,undefined);assert.equal(pending.craftSteps[0].returnedQty,null);assert.equal(pending.craftSteps[0].status,'已交下一工艺');
 const final=project({completions,receipts:[receipt(3,80)]});assert.equal(final.eligiblePieceQty,80);assert.equal(final.receiptId,'RETURN-3');assert.equal(final.printedPieceQty,100);
 assert.equal(project({completions:completions.map(fact=>({...fact,receiverFactoryId:'OTHER'})),receipts:[receipt(3,80)]}).eligiblePieceQty,0);
 assert.equal(project({completions,receipts:[receipt(3,100)]}).eligiblePieceQty,0);
})
test('前道非法实收不能被加工完成标记绕过',()=>{
 for(const bad of [101,NaN,-1]) assert.equal(project({receipts:[receipt(1,bad),receipt(2,90),receipt(3,80)]}).eligiblePieceQty,0);
})
test('实际已分配厂取代票上默认厂，多家未确认不猜厂，打印票保持原样',()=>{
 const oneTicket={...ticket,specialCrafts:[crafts[0]]},before=structuredClone(oneTicket)
 const binding:any={feiTicketId:'FT-1',specialCraftId:'CRAFT-1',targetFactoryId:'ACTUAL-F',targetFactoryName:'实际承接厂',assignedFactoryConfirmed:true,specialCraftFlowStatus:'待发料'}
 const actual={...receipt(1,90),receiverFactoryId:'ACTUAL-F'}
 const detail=project({ticket:oneTicket,bindings:[binding],receipts:[actual]})
 assert.equal(detail.eligiblePieceQty,90);assert.equal(detail.craftSteps[0].factoryName,'实际承接厂');assert.deepEqual(oneTicket,before)
 assert.equal(project({ticket:oneTicket,bindings:[binding],receipts:[receipt(1,90)]}).eligiblePieceQty,0,'默认厂的回仓不能冒充实际已分配厂')
 const ambiguous=project({ticket:oneTicket,bindings:[binding,{...binding,targetFactoryId:'OTHER-F',targetFactoryName:'另一厂'}],receipts:[actual]})
 assert.equal(ambiguous.eligiblePieceQty,0);assert.equal(ambiguous.craftSteps[0].factoryName,'承接厂待确认')
})
test('直转前道须有明确工艺身份完成，最终回仓受前道实物上限约束',()=>{
 const bindings:any[]=[1,2].map(stage=>({feiTicketId:'FT-1',specialCraftId:`CRAFT-${stage}`,targetFactoryId:`F${stage}`,specialCraftFlowStatus:'已完成',closingQty:stage===1?95:90}))
 assert.equal(project({bindings,receipts:[receipt(3,80)]}).eligiblePieceQty,80)
 assert.equal(project({bindings,receipts:[receipt(3,100)]}).eligiblePieceQty,0)
 assert.equal(project({bindings:bindings.map(binding=>({...binding,specialCraftId:''})),receipts:[receipt(3,80)]}).eligiblePieceQty,0,'不能只凭名称猜前道完成')
})
test('零量点收保留凭据；整票不可用和未知资料不贡献',()=>{
 const zero=project({receipts:[receipt(1,95),receipt(2,90),receipt(3,0)]});assert.equal(zero.eligiblePieceQty,0);assert.equal(zero.physicalPieceQty,0);assert.equal(zero.receiptId,'RETURN-3')
 const unavailable=project({valid:false,receipts:[receipt(1,95),receipt(2,90),receipt(3,80)]});assert.equal(unavailable.physicalPieceQty,0);assert.equal(unavailable.printedPieceQty,100);assert.equal(getCutPieceReleaseEligibilityForDetail(unavailable).canHandover,false)
 assert.equal(project({craftRequirementKnown:false}).eligiblePieceQty,0)
})
test('普通未装袋票不进放行，但既有简易交出可保持；正常换袋去重',()=>{
 const ordinary=project({ticket:{...ticket,specialCrafts:[],hasSpecialCraft:false},bag:undefined});assert.equal(ordinary.eligiblePieceQty,0);assert.equal(getCutPieceReleaseEligibilityForDetail(ordinary).canHandover,true)
 const events:any[]=[1,2].map(index=>({eventId:`PACK-${index}`,eventStatus:'已记录',eventType:'菲票装袋',occurredAt:'2026-10-09T00:00:00Z',operatorName:'仓管',refs:{usageCycleId:`USE${index}`},payload:{bagCode:`BAG${index}`,feiTicketItems:[{feiTicketId:'FT-1',feiTicketNo:'FT-1',pieceQty:100,printStatus:'PRINTED'}]}}))
 const evidence=buildReleaseBagEvidence(events);assert.equal(evidence.size,1);assert.equal(evidence.get('FT-1')?.bagCode,'BAG2')
})

test('装袋同ID错票号、超原票或无效票面不提供可交实物',()=>{
 assert.equal(project({bag:{...bag,ticketNo:'OTHER',baggedPieceQty:100}}).physicalPieceQty,0)
 assert.equal(project({bag:{...bag,ticketNo:ticket.feiTicketNo,baggedPieceQty:101}}).physicalPieceQty,0)
 assert.equal(project({ticket:{...ticket,actualCutPieceQty:-1}}).physicalPieceQty,0)
})


test('逐票工艺实收保留真实业务回仓号、来源交出号及仓区库位',()=>{
 const returned=project({receipts:[1,2,3].map(stage=>({...receipt(stage,stage===1?95:stage===2?90:80),returnRecordNo:`RC-${stage}`,sourceHandoverRecordNo:`HO-${stage}`,locationRef:{areaName:'A区',shelfNo:'一号架',locationNo:`A-0${stage}`}}))})
 const final=returned.craftSteps.at(-1)!
 assert.equal(final.receiptNo,'RC-3');assert.equal(final.sourceHandoverNo,'HO-3');assert.equal(final.returnLocationLabel,'A区 / 一号架 / A-03')
 assert.equal(returned.eligiblePieceQty,80)
})

test('旧实收缺加工完成依据保留实物，但不计最终齐套且明确待核对',()=>{
 const legacy=project({receipts:[1,2,3].map((stage)=>({...receipt(stage,stage===1?95:stage===2?90:80),processingCompleted:null}))});
 assert.equal(legacy.physicalPieceQty,80);assert.equal(legacy.eligiblePieceQty,0);assert.equal(legacy.completionEvidenceKnown,false);
 assert.equal(legacy.craftSteps.at(-1)!.returnedQty,80);assert.match(legacy.craftSteps.at(-1)!.status,/加工完成待核对/);assert.equal(getCutPieceReleaseEligibilityForDetail(legacy).canHandover,false);
})

const ordinaryTicket:any={...ticket,productionOrderId:'PO-1',materialSku:'BOM-1',patternIdentity:{patternFileId:'PAT-1',patternVersion:'v1'},specialCrafts:[],hasSpecialCraft:false}
const legacyPart:any={partCode:'front',partNameCn:'前片',materialSku:'BOM-1'}
const formalPattern:any={id:'PAT-1',patternFileId:'PAT-1',patternVersion:'v1',linkedBomItemId:'BOM-1',pieceRows:[{id:'front',specialCrafts:[]}]}
test('旧部位缺字段：仅同正式纸样版本材料与部位的明确无工艺允许普通袋贡献',()=>{
 const known=isReleaseTicketCraftRequirementKnown(ordinaryTicket,[legacyPart],[formalPattern]);assert.equal(known,true)
 assert.equal(project({ticket:ordinaryTicket,craftRequirementKnown:known}).eligiblePieceQty,100)
 assert.equal(project({ticket:ordinaryTicket,craftRequirementKnown:known,bag:undefined}).eligiblePieceQty,0)
 assert.equal(project({ticket:ordinaryTicket,craftRequirementKnown:known,valid:false}).eligiblePieceQty,0)
 assert.equal(legacyPart.specialCrafts,undefined)
})
test('无工艺依据不能从缺失、歧义、异版、异料或同名异部位推断',()=>{
 for(const patterns of [[],[formalPattern,formalPattern],[{...formalPattern,patternVersion:'v2'}],[{...formalPattern,linkedBomItemId:'BOM-2'}],[{...formalPattern,patternFileId:'PAT-2'}],[{...formalPattern,pieceRows:[{id:'front'}]}],[{...formalPattern,pieceRows:[{id:'other',specialCrafts:[]}]}],[{...formalPattern,pieceRows:[...formalPattern.pieceRows,...formalPattern.pieceRows]}],[{...formalPattern,pieceRows:[{id:'front',specialCrafts:[{craftName:'印花'}]}]}]])assert.equal(isReleaseTicketCraftRequirementKnown(ordinaryTicket,[legacyPart],patterns),false)
 for(const part of [{...legacyPart,materialSku:'BOM-2'},{...legacyPart,partCode:'other'}])assert.equal(isReleaseTicketCraftRequirementKnown(ordinaryTicket,[part],[formalPattern]),false)
 assert.equal(isReleaseTicketCraftRequirementKnown(ordinaryTicket,[legacyPart,legacyPart],[formalPattern]),false)
})
test('已有工艺要求不被纸样空数组覆盖；末道实收门禁保留',()=>{
 const part={...legacyPart,specialCrafts:crafts.map(c=>({displayName:c.craftName}))} as any
 assert.equal(isReleaseTicketCraftRequirementKnown(ordinaryTicket,[part],[formalPattern]),false)
 const special={...ordinaryTicket,specialCrafts:crafts,hasSpecialCraft:true}
 assert.equal(isReleaseTicketCraftRequirementKnown(special,[part],[formalPattern]),true)
 assert.equal(project({ticket:special,craftRequirementKnown:true}).eligiblePieceQty,0)
 assert.equal(project({ticket:special,craftRequirementKnown:true,receipts:[receipt(1,95),receipt(2,90),receipt(3,80)]}).eligiblePieceQty,80)
})
