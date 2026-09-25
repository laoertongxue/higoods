"""Explicit isolated Mock prerequisite. Does not claim any tested UI operation occurred."""
import json,struct,copy,hashlib
from pathlib import Path
source=Path('output/playwright/hpb/acceptance-final/mixed.higcut')
data=source.read_bytes();length=struct.unpack('>I',data[8:12])[0];backup=json.loads(data[12:12+length])
for record in backup['records']:
    event=record.get('value',{})
    if record['collection']=='cutting-events' and event.get('eventType')=='菲票装袋' and event.get('refs',{}).get('transferBagCode')=='BAG-HPB-MIXED-VERIFY':
        other=copy.deepcopy(event['payload']['feiTicketItems'][0])
        other.update(feiTicketId='MOCK-OTHER-TASK-PART',feiTicketNo='MOCK-OTHER-TASK-PART',sewingTaskId='MOCK-OTHER-SEW-TASK',sewingTaskNo='MOCK-OTHER-SEW-TASK',pieceQty=12,partCode='BACK',partName='后片')
        event['payload']['feiTicketItems'].append(other)
        event['payload']['totalPieceQty']=32
        event['refs']['feiTicketIds'].append(other['feiTicketId']);event['refs']['feiTicketNos'].append(other['feiTicketNo'])
        event['operatorName']='隔离验收Mock前置（不同任务来源袋）'
        break
else:raise ValueError('mixed bag prerequisite missing')
encoded=json.dumps(backup,ensure_ascii=False,separators=(',',':')).encode()
target=Path('output/playwright/hpb/acceptance-bag-lifecycle/repack-prerequisite.higcut')
target.write_bytes(b'HIGCUT01'+struct.pack('>I',len(encoded))+encoded+data[12+length:])
print(json.dumps({'source':str(source),'sourceSha256':hashlib.sha256(data).hexdigest(),'target':str(target),'targetSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'mockChange':'Only add 12-piece other-task part ticket to preexisting mixed source bag. Original file unchanged. No tested repack/recovery/scrap/scan action is fabricated.'},ensure_ascii=False,indent=2))
