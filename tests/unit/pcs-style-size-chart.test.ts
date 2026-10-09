import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createStyleSizeChart, defaultStyleSalesContent, defaultStyleDescription, STYLE_SIZE_CHART_PRESETS, STYLE_SIZE_OPTIONS, STYLE_SIZE_PARAMETERS, STYLE_DEFAULT_CHART, generateStyleSizeChartDraft, styleSizeChartHtml, validateStyleSizeChart, applyStyleSizeChart } from '../../src/data/pcs-style-size-chart.ts'
import { styleContentHtml } from '../../src/pages/pcs-style-content-editor.ts'

test('complete online template is the default, saved and explicitly cleared descriptions are preserved', () => {
  const style = { styleName: '新款' }, content = defaultStyleSalesContent(style, 'id')
  for (const text of ['Size Type: Regular','Instruksi Pencucian:','Musim: Semua Musim','Bahan: Polyester','Petunjuk pembelian','PILIH UKURAN','custumer servis kami']) assert.ok(content.description.includes(text))
  assert.ok(content.sizeChartUrl.endsWith('/default.svg'))
  const saved = {...content, description:'',version:2}
  assert.equal(defaultStyleSalesContent({...style,salesContents:[saved]},'id').description,'')
  const copy = defaultStyleSalesContent({...style,salesContents:[saved]},'id');copy.imageUrls.push('/new.png');assert.equal(saved.imageUrls.length,0)
  assert.equal(createStyleSizeChart(style,['S','M']).generated,false)
})
test('online dictionaries retain all 14 image choices, 372 sizes and 41 measurement parameters', () => {
  assert.equal(Object.keys(STYLE_SIZE_CHART_PRESETS).length,14)
  assert.equal(STYLE_SIZE_CHART_PRESETS.tee.image,STYLE_SIZE_CHART_PRESETS.mensTee.image)
  assert.equal(STYLE_SIZE_OPTIONS.length,372);assert.equal(new Set(STYLE_SIZE_OPTIONS).size,372)
  assert.equal(STYLE_SIZE_PARAMETERS.length,41)
  assert.equal(STYLE_SIZE_OPTIONS.at(-1),'Plus Two Size');assert.equal(STYLE_SIZE_PARAMETERS.at(-1)?.value,'panjang ban pinggang')
})
test('select then generate preserves source order and entered values when a parameter column is added', () => {
  const chart = createStyleSizeChart({},[])
  assert.throws(()=>generateStyleSizeChartDraft(chart),/至少选择/)
  chart.selectedSizes=['L','M'];chart.selectedParameters=['LD','LB'];generateStyleSizeChartDraft(chart)
  assert.deepEqual(chart.rows.map(row=>row.size),['M','L']);assert.deepEqual(chart.columns,['LB','LD'])
  chart.rows[0].values=['36','97'];chart.rows[1].values=['37','101']
  chart.selectedParameters.push('Panjang');generateStyleSizeChartDraft(chart)
  assert.deepEqual(chart.rows[0].values,['36','97',''])
  assert.throws(()=>validateStyleSizeChart(chart),/有属性值为空/)
  chart.rows[0].values[2]='123-126';chart.rows[1].values[2]='free';validateStyleSizeChart(chart)
})
test('insert replaces only the generated block, retains body and other tables, and escapes text', () => {
  const base='<p>原描述</p><table><tr><td>其他资料</td></tr></table>',chart=structuredClone(STYLE_DEFAULT_CHART)
  const once=applyStyleSizeChart(base,chart);chart.rows[0].values[0]='36.5'
  const twice=applyStyleSizeChart(once,chart);assert.ok(twice.startsWith(base));assert.equal(twice.match(/PILIH UKURAN/g)?.length,1);assert.ok(twice.includes('36.5'))
  chart.rows[0].values[0]='<img onerror=alert(1)>'
  assert.ok(styleSizeChartHtml(chart).includes('&lt;img'))
  assert.equal(applyStyleSizeChart(defaultStyleDescription(),STYLE_DEFAULT_CHART).match(/custumer servis kami/g)?.length,1)
})
test('presentation survives sanitizing, active content and application handlers do not', () => {
  const clean=styleContentHtml(defaultStyleDescription())
  assert.ok(clean.includes('background-color:black'));assert.ok(clean.includes('background-color:#f2f2f2'));assert.ok(clean.includes('font-size:24px'));assert.ok(clean.includes('width:600px'))
  const unsafe=styleContentHtml('<script>alert(1)</script><p data-pcs-product-archive-action="save" onclick="alert(1)" style="color:black;position:fixed;background-image:url(https://evil.test);font-size:14px">正文</p><img src="data:image/png;base64,xxx" onerror="alert(1)">')
  assert.equal(unsafe,'<p style="color:black;font-size:14px">正文</p>')
  assert.equal(styleContentHtml(clean),clean)
})
test('all static archive defaults contain online charts without browser seed writes', () => {
  const baseline=JSON.parse(readFileSync(new URL('../../src/data/generated/pcs-record-baseline.json',import.meta.url),'utf8'))
  const styles=JSON.parse(baseline['higood-pcs-style-archive-store-v3']).records
  assert.equal(styles.length,54)
  assert.ok(styles.every((style:any)=>style.salesContents.every((content:any)=>content.description.includes('PILIH UKURAN') && content.sizeChartUrl.endsWith('/default.svg'))))
})
test('quoted font names, color, underline and link query parameters survive repeated saves', () => {
  const html='<p><span style="font-family:&quot;Arial Black&quot;;color:rgb(255, 0, 0);text-decoration-line:underline">格式</span><a href="https://example.test/?a=1&amp;b=2">链接</a></p>'
  const clean=styleContentHtml(html)
  assert.ok(clean.includes('font-family:&quot;Arial Black&quot;'))
  assert.ok(clean.includes('text-decoration-line:underline'))
  assert.ok(clean.includes('?a=1&amp;b=2'))
  assert.equal(styleContentHtml(clean),clean)
})
