// One instance per isolated browser context. A 304 has no response body: its
// bytes are proven by that context's earlier 200 and the exact HTTP validator.
import {createHash} from 'node:crypto'
import {existsSync,readFileSync} from 'node:fs'
import {resolve} from 'node:path'
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
export function createQualityRuntimeAssetProof(dist){
 const priorResponses=new Map()
 return async response=>{
  const url=response.url(),name=new URL(url).pathname,file=resolve(dist,name.replace(/^\//,'')),status=response.status()
  if(response.fromServiceWorker?.())throw Error('Runtime asset must come from the declared server or its verified HTTP cache')
  if(status===200){
   const reading=(async()=>{const bytes=await response.body(),headers=response.headers(),servedSha256=sha(bytes),fileSha256=existsSync(file)?sha(readFileSync(file)):null
    return{url,status,servedSha256,fileSha256,matches:servedSha256===fileSha256,bytes:bytes.length,etag:headers.etag||'',lastModified:headers['last-modified']||'',proof:'native-response-body'}
   })()
   priorResponses.set(url,reading)
   try{return await reading}catch(error){if(priorResponses.get(url)===reading)priorResponses.delete(url);throw error}
  }
  if(status!==304)throw Error(`Unexpected runtime asset HTTP status ${status}: ${url}`)
  const earlier=priorResponses.get(url)
  if(!earlier)throw Error(`304 has no earlier body in this isolated context: ${url}`)
  const original=await earlier,headers=response.request().headers(),condition=headers['if-none-match'],modified=headers['if-modified-since']
  const validatorMatches=condition
   ? !!original.etag&&condition.split(',').some(value=>value.trim()===original.etag)
   : !!modified&&!!original.lastModified&&modified===original.lastModified
  if(!original.matches||!validatorMatches)throw Error(`304 does not identify the verified earlier body: ${url}`)
  const current=existsSync(file)?sha(readFileSync(file)):null
  if(current!==original.fileSha256)throw Error(`Frozen runtime asset changed after the earlier response: ${url}`)
  return{...original,status,proof:'http-304-with-verified-same-context-200',verifiedCache:true,conditionalHeaders:{ifNoneMatch:condition||'',ifModifiedSince:modified||''},originalBodyStatus:200}
 }
}
