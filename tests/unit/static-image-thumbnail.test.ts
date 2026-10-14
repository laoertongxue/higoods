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
