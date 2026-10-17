import thumbnails from './static-image-thumbnails.json'

/** Static derivatives only; uploads and original preview URLs stay intact. */
export function staticImageThumbnail(original: string): string {
  return (thumbnails as Record<string, { thumbnail: string }>)[original]?.thumbnail || original
}


/** Optional static HD rendition of the same verified source; originals remain canonical. */
export function staticImagePreview(original: string): string | undefined {
  return (thumbnails as Record<string, { preview?: string }>)[original]?.preview
}
