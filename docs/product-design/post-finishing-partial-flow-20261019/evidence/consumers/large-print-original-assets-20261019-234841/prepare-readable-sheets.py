import json,pathlib
from PIL import Image,ImageDraw,ImageFont
out=pathlib.Path(pathlib.Path('/tmp/post-finishing-large-print-dir.txt').read_text());r=json.loads((out/'render-inspection.json').read_text());font=ImageFont.load_default(size=16);sheets=[]
for item in r['templateResults']:
 if item['template'] not in ['OUTBOUND_BARCODE','OUTBOUND_HANGTAG','GENERIC_BARCODE']:continue
 mode='readable-content' if item['template']=='GENERIC_BARCODE' else 'readable-full';per=50 if item['template']=='GENERIC_BARCODE' else 2;cols=5 if item['template']=='GENERIC_BARCODE' else 2
 for start in range(0,len(item['pages']),per):
  vals=[]
  for page in item['pages'][start:start+per]:
   im=Image.open(out/page['image']).convert('RGB')
   if mode=='readable-content':
    l,t,rr,b=page['nonWhiteBBox'];im=im.crop((l-6,t-6,rr+6,b+6))
   vals.append((page['page'],im))
  cw=max(im.width for _,im in vals)+10;ch=max(im.height for _,im in vals)+28
  sheet=Image.new('RGB',(cw*min(cols,len(vals)),ch*((len(vals)+cols-1)//cols)),'#dde3ea');draw=ImageDraw.Draw(sheet)
  for n,(p,im) in enumerate(vals):
   x=n%cols*cw;y=n//cols*ch;draw.text((x+5,y+3),f'A4 PAGE {p}',font=font,fill='black');sheet.paste(im,(x+5,y+24))
  path=pathlib.Path(item['pages'][0]['image']).parent/f'{mode}-{start+1:04}-{start+len(vals):04}.png';sheet.save(out/path)
  sheets.append({'image':str(path),'mode':mode,'pages':[p for p,_ in vals],'template':item['template'],'sizePx':list(sheet.size),'visualStatus':'pending'})
(out/'readable-sheets.json').write_text(json.dumps(sheets,indent=2));print(len(sheets),'readable sheets')
