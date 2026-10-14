import thumbnails from './static-image-thumbnails.json'

/** Static derivatives only; uploads and original preview URLs stay intact. */
export function staticImageThumbnail(original: string): string {
  return (thumbnails as Record<string, { thumbnail: string }>)[original]?.thumbnail || original
}
