import {chromium} from '@playwright/test'
import {sampleLabelDocument} from '../../../../src/pages/pcs-sample-label.ts'
import {writeFile} from 'node:fs/promises'
const b=await chromium.launch(),p=await b.newPage(),identity={id:'photo-example',skuCode:'MODXU26081404-blue-m',hgCode:'HG1761420',registeredAt:'2026-08-26'}
const checks=[]
for(const [width,height] of [[60,40],[30,20],[120,100]]){
 await p.setContent(sampleLabelDocument(identity,{width:String(width),height:String(height),copies:'1'}))
 const bounds=await p.evaluate(()=>{const a=document.querySelector('article')!.getBoundingClientRect();return [...document.querySelectorAll('article>*')].every(n=>{const r=n.getBoundingClientRect();return r.bottom<=a.bottom+.5&&r.right<=a.right+.5})})
 if(!bounds)throw Error('label content overflows '+width+'x'+height)
 checks.push({width,height,bounds})
 if(width===60){await p.pdf({path:'output/playwright/sample-hg-label/photo-example.pdf',preferCSSPageSize:true});await p.locator('article').screenshot({path:'output/playwright/sample-hg-label/photo-example.png'})}
}
await writeFile('output/playwright/sample-hg-label/photo-example.json',JSON.stringify(checks,null,2));await b.close()
