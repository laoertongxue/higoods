import datetime, hashlib, json, pathlib, subprocess
from pypdf import PdfReader
from PIL import Image, ImageChops, ImageDraw, ImageFont
out=pathlib.Path(pathlib.Path('/tmp/post-finishing-large-print-dir.txt').read_text())
manifest=json.loads((out/'pdf-manifest.json').read_text())
font=ImageFont.load_default(size=16)
result=[]
for entry in manifest['pdfs']:
 path=out/entry['file']; assert hashlib.sha256(path.read_bytes()).hexdigest()==entry['sha256']
 stem=path.stem; root=out/stem; root.mkdir(exist_ok=True)
 print('Rendering '+stem+' ('+str(entry['pageCount'])+' pages)',flush=True)
 subprocess.run(['pdftoppm','-r','110','-png',str(path),str(root/'page')],check=True)
 pdf=PdfReader(path); pages=[]; content=[]
 images=sorted(root.glob('page-*.png'),key=lambda p:int(p.stem.split('-')[-1]))
 assert len(images)==entry['pageCount']
 for index,image in enumerate(images,1):
  im=Image.open(image).convert('RGB'); diff=ImageChops.difference(im,Image.new('RGB',im.size,'white')).convert('L');box=diff.point(lambda value:255 if value>24 else 0).getbbox()
  assert box is not None,(stem,index)
  text=pdf.pages[index-1].extract_text() or '';(root/f'page-{index:04}.txt').write_text(text);content.append(text)
  pages.append({'page':index,'image':str(image.relative_to(out)),'sizePx':list(im.size),'nonWhiteBBox':list(box),'textChars':len(text),'visualStatus':'pending'})
 text='\n'.join(content)
 counts={f'SKU-{i}-202608':text.count(f'SKU-{i}-202608') for i in range(101,106)}
 if entry['template'].endswith('BARCODE') or entry['template'].endswith('HANGTAG'):assert list(counts.values())==[200]*5,(stem,counts)
 # Full-A4 contact sheets preserve all page edges. Content-only sheets below
 # are an additional labelled inspection aid and cannot replace full pages.
 sheets=[]
 if entry['template']=='GENERIC_BARCODE':
  # Each landscape A4 page contains one label. Include every full A4 page
  # in 100-page sheets, then each extracted content box at native pixels.
  modes=[('full',100,10),('content',100,5)]
 else:modes=[('full',6,2)]
 for mode,per,cols in modes:
  for start in range(0,len(images),per):
   selected=images[start:start+per]; rendered=[]
   for index,image in enumerate(selected,start+1):
    im=Image.open(image).convert('RGB')
    if mode=='content':
     left,top,right,bottom=pages[index-1]['nonWhiteBBox'];im=im.crop((max(0,left-8),max(0,top-8),min(im.width,right+8),min(im.height,bottom+8)))
    elif entry['template']=='GENERIC_BARCODE':im.thumbnail((260,190))
    else:im.thumbnail((910,1288))
    rendered.append((index,im))
   cellw=max(im.width for _,im in rendered)+12;cellh=max(im.height for _,im in rendered)+32
   rows=(len(rendered)+cols-1)//cols
   sheet=Image.new('RGB',(cellw*min(cols,len(rendered)),cellh*rows),'#dde3ea');draw=ImageDraw.Draw(sheet)
   for n,(page,im) in enumerate(rendered):
    x=(n%cols)*cellw;y=(n//cols)*cellh;draw.text((x+6,y+4),f'{mode.upper()} A4 PAGE {page}',font=font,fill='black');sheet.paste(im,(x+6,y+26))
   name=f'{mode}-pages-{start+1:04}-{start+len(selected):04}.png';sheet.save(root/name)
   sheets.append({'image':str((root/name).relative_to(out)),'mode':mode,'pages':list(range(start+1,start+len(selected)+1)),'visualStatus':'pending'})
 result.append({'template':entry['template'],'pdf':entry['file'],'sha256':entry['sha256'],'pages':pages,'sheets':sheets,'barcodeTextCounts':counts})
 (out/'render-inspection.json').write_text(json.dumps({'renderedAt':datetime.datetime.now().astimezone().isoformat(),'dpi':110,'electronicOnly':True,'templateResults':result},ensure_ascii=False,indent=2))
 print('Rendered '+stem+': '+str(len(images))+' pages; '+str(len(sheets))+' inspection sheets; barcode text counts '+str(counts),flush=True)
print(out,flush=True)
