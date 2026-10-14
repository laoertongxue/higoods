/** Keep internal operation identity out of labels without changing persistence or URLs. */
export function pmsBusinessNumber(value:string):string {
  const match=/^(CGF|MREQ|LOG|APPLY|PAY-[ML])[-:]([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})([-:]\d+)?$/i.exec(value)
  if(!match && /^(CGF|MREQ|LOG|APPLY|PAY-[ML])[-:]\D/.test(value)){const prefix=/^(CGF|MREQ|LOG|APPLY|PAY-[ML])/.exec(value)![1];let hash=2166136261;for(const char of value){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}return `${prefix}-${(hash>>>0).toString(16).padStart(8,'0').toUpperCase()}`}
  return match?`${match[1]}-${match[2].replaceAll('-','').slice(0,10).toUpperCase()}${match[3] || ''}`:value
}
