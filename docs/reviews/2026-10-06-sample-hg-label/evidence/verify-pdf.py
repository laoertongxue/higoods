"""Inspect the actual printed PDF bars, not SVG metadata. No hardware claim."""
import json,sys
import pdfplumber
# Code 128-B symbols used by HG2000002, including checksum 94 and STOP.
lookup={'211214':104,'231113':40,'211313':39,'223211':18,'123122':16,'131141':94,'2331112':106}
results=[]
with pdfplumber.open(sys.argv[1]) as doc:
 assert len(doc.pages)==3
 for p in doc.pages:
  bars=sorted([r for r in p.rects if r['non_stroking_color']==(0,0,0) and r['height']>20], key=lambda r:r['x0'])
  unit=min(r['width'] for r in bars);runs=[]
  for i,r in enumerate(bars):
   runs.append(round(r['width']/unit))
   if i+1<len(bars):runs.append(round((bars[i+1]['x0']-r['x1'])/unit))
  patterns=[''.join(map(str,runs[i:i+6])) for i in range(0,len(runs)-7,6)]
  patterns.append(''.join(map(str,runs[-7:])))
  values=[lookup[pattern] for pattern in patterns]
  assert values[0]==104 and values[-1]==106
  assert (values[0]+sum(v*(i+1) for i,v in enumerate(values[1:-2])))%103==values[-2]
  decoded=''.join(chr(v+32) for v in values[1:-2]);assert decoded=='HG2000002'
  w,h=p.width*25.4/72,p.height*25.4/72
  assert abs(w-55)<.2 and abs(h-35)<.2
  assert p.extract_text().splitlines()==['HG2000002','2026-04-01','SKU-DRESS-RED-M']
  results.append({'page':p.page_number,'widthMm':w,'heightMm':h,'decodedBarcode':decoded,'checksumValid':True,'text':p.extract_text()})
print(json.dumps({'pages':results,'source':'actual PDF vector bars','physicalPrinterTested':False},ensure_ascii=False,indent=2))
