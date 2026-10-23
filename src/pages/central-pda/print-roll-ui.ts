import type { CentralPdaLanguage } from './frame.ts'
import type { CentralPrintRollInput, CentralPrintRoll } from './print-output-model.ts'
import { dyeNumber, translateDyeNumber } from './dye-ui.ts'
import { printUsesRolls } from './print-ui.ts'
export interface PrintRollFields { quantity:string; measure:'NATIVE'|'METERS'; weightMode:'ACTUAL'|'THEORETICAL';weight:string;gsm:string;width:string;vat:string;remark:string;batch:string }
export function initialPrintRollFields(roll:CentralPrintRoll,lang:CentralPdaLanguage):PrintRollFields{
 const raw=(n:number)=>translateDyeNumber(String(n),'zh',lang)
 return{quantity:roll.quantityConfirmed!==false&&roll.lengthY>0?raw(roll.lengthY):'',measure:'NATIVE',weightMode:roll.weightSource==='ACTUAL'?'ACTUAL':'THEORETICAL',weight:roll.weightSource==='ACTUAL'&&roll.weightKg>0?raw(roll.weightKg):'',gsm:raw(roll.gsm),width:raw(roll.widthCm),vat:roll.vatNo||'',remark:roll.remark||'',batch:roll.batchId||''}
}
/** The native quantity remains separate from meter and weight measurements. */
export function printRollInput(output:{objectType:string;qtyUnit:string},roll:CentralPrintRoll,fields:PrintRollFields,remaining:number,lang:CentralPdaLanguage):CentralPrintRollInput{
 const usesFabric=printUsesRolls(output.objectType),kg=['kg','公斤','千克'].includes(output.qtyUnit.toLowerCase())&&!usesFabric
 const qty=dyeNumber(fields.quantity,lang,kg?3:2)
 if(fields.measure==='METERS'&&(!usesFabric||output.qtyUnit.toLowerCase()!=='yard'))throw new Error('PRINT_rollMeasure')
 const native=fields.measure==='METERS'?Math.round(qty/.9144*100)/100:qty
 if(native>remaining+.01+.000001)throw new Error('QUANTITY_MAX')
 const input:CentralPrintRollInput={gsm:usesFabric?dyeNumber(fields.gsm,lang,null):roll.gsm,widthCm:usesFabric?dyeNumber(fields.width,lang,null):roll.widthCm,vatNo:fields.vat.trim(),warehouseName:roll.warehouseName,remark:fields.remark.trim()}
 if(fields.batch)input.batchId=fields.batch
 if(kg){input.weightKg=qty;input.weightMeasured=true}
 else{if(fields.measure==='METERS')input.meters=qty;else input.lengthY=qty
  if(fields.weightMode==='ACTUAL'){input.weightKg=dyeNumber(fields.weight,lang,3);input.weightMeasured=true}
  else input.weightMeasured=false
 }
 return input
}
