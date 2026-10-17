import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { staticImageThumbnail } from '../../src/utils/static-image-thumbnail.ts'
import thumbnails from '../../src/utils/static-image-thumbnails.json'
import { renderPmsBusinessImage } from '../../src/pages/pms/shared.ts'

test('Published thumbnails retain the exact source mapping and unchanged originals', () => {
  for (const [original, entry] of Object.entries(thumbnails)) {
    const bytes = readFileSync(new URL(`../../public${original}`, import.meta.url))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sourceSha256, original)
    const thumb = readFileSync(new URL(`../../public${entry.thumbnail}`, import.meta.url))
    assert.equal(thumb.toString('ascii', 0, 4), 'RIFF')
    assert.equal(thumb.toString('ascii', 8, 12), 'WEBP')
    assert.equal(staticImageThumbnail(original), entry.thumbnail)
  }
})

test('Uploads, external images and unknown paths keep their original address', () => {
  for (const url of ['blob:https://example.test/attachment', 'https://example.test/photo.jpg', '/user-upload.png', '']) {
    assert.equal(staticImageThumbnail(url), url)
  }
})

test('PMS renders the light image while its preview still targets the original', () => {
  const original = '/production-confirmation-demo/grey-zip-hoodie.png'
  const html = renderPmsBusinessImage(original, '卫衣')
  assert.match(html, /data-image-src="\/production-confirmation-demo\/grey-zip-hoodie\.png"/)
  assert.match(html, /src="\/thumbnails\/production-confirmation-demo\/grey-zip-hoodie\.webp"/)
  assert.match(html, /aria-label="查看卫衣大图"/)
})


test('Wool and craft object thumbnails keep original preview identity and failure feedback', async () => {
  const { renderWoolObjectImage } = await import('../../src/pages/process-factory/wool/stage-display.ts')
  const original = '/production-confirmation-demo/grey-zip-hoodie.png'
  const html = renderWoolObjectImage(original, '卫衣对象图')
  assert.ok(html.includes('src="'+staticImageThumbnail(original)+'"'))
  assert.ok(html.includes('data-pda-image-preview-url="'+original+'"'))
  assert.match(html, /alt="卫衣对象图"/)
  assert.match(html, /图片加载失败/)
  for (const url of ['blob:https://example.test/local', '/user-upload.png']) assert.ok(renderWoolObjectImage(url, '用户图片').includes('src="'+url+'"'))
  assert.match(renderWoolObjectImage(undefined, '缺图'), /真实图片待补/)
})

test('Only the wool/craft image opener opts into a verified high-definition display URL', async () => {
  const { renderWoolObjectImage } = await import('../../src/pages/process-factory/wool/stage-display.ts')
  const original='/production-confirmation-demo/grey-zip-hoodie.png'
  const html=renderWoolObjectImage(original,'同源卫衣')
  assert.ok(html.includes('data-pda-image-preview-url="'+original+'"'))
  assert.ok(html.includes('data-pda-image-preview-display-url="/previews/production-confirmation-demo/grey-zip-hoodie.webp"'))
  assert.equal(renderWoolObjectImage('/user-upload.png','上传图').includes('data-pda-image-preview-display-url'),false)
})

test('Preview uses an explicitly opted-in safe display asset and otherwise retains the original source', async () => {
  const { handlePdaImagePreviewEvent }=await import('../../src/components/ui/pda-image-preview.ts')
  const previous=Object.getOwnPropertyDescriptor(globalThis,'document')
  const host={innerHTML:'',querySelector:()=>({focus(){}})}
  Object.defineProperty(globalThis,'document',{configurable:true,value:{querySelector:()=>host}})
  try {
    for (const display of ['/previews/production-confirmation-demo/grey-zip-hoodie.webp','javascript:invalid',undefined]) {
      const original='/production-confirmation-demo/grey-zip-hoodie.png'
      const opener={dataset:{pdaImagePreviewUrl:original,pdaImagePreviewDisplayUrl:display,pdaImagePreviewTitle:'高清卫衣'}}
      const target={closest:(selector:string)=>selector==='[data-pda-image-preview-url]'?opener:null} as unknown as HTMLElement
      assert.equal(handlePdaImagePreviewEvent(target),true)
      assert.ok(host.innerHTML.includes('src="'+(display?.startsWith('/')?display:original)+'"'))
      assert.equal(opener.dataset.pdaImagePreviewUrl,original)
      assert.match(host.innerHTML,/高清卫衣高清大图/)
      assert.match(host.innerHTML,/data-pda-image-preview-close/)
    }
  } finally {if(previous)Object.defineProperty(globalThis,'document',previous);else Reflect.deleteProperty(globalThis,'document')}
})

test('Every opted-in HD rendition is a committed WebP tied to the unchanged original hash', () => {
  let count=0
  for (const [original, entry] of Object.entries(thumbnails)) {
    if (!('preview' in entry)) continue
    const hd=readFileSync(new URL(`../../public${entry.preview}`,import.meta.url))
    assert.equal(hd.toString('ascii',0,4),'RIFF',original)
    assert.equal(hd.toString('ascii',8,12),'WEBP',original)
    assert.equal(createHash('sha256').update(hd).digest('hex'),entry.previewSha256,original)
    assert.ok(hd.length<readFileSync(new URL(`../../public${original}`,import.meta.url)).length,'HD rendition must reduce transfer bytes: '+original)
    count++
  }
  assert.equal(count,8)
})
