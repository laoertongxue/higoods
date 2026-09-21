// 本地演示款式图片映射：避免原型依赖不可用的历史外链，同时保持按款式类别展示真实服装照片。
export function resolveStableStyleImage(styleName: string, fallback = ''): string {
  const value = styleName.toLowerCase()
  if (styleName.includes('裙') || value.includes('dress')) return '/dress-sample-1.jpg'
  if (styleName.includes('夹克') || styleName.includes('外套') || value.includes('jacket') || value.includes('hoodie')) return '/jacket-sample.jpg'
  if (styleName.includes('开衫') || value.includes('cardigan') || styleName.includes('毛衣')) return '/cardigan-sample.jpg'
  if (styleName.includes('裤') || value.includes('pants') || value.includes('shorts')) return '/pants-sample.jpg'
  if (styleName.includes('衬衫') || value.includes('shirt')) return '/shirt-sample.jpg'
  if (styleName.includes('T恤') || value.includes('tee') || value.includes('polo')) return '/tshirt-sample.jpg'
  return fallback.startsWith('/') ? fallback : '/tshirt-sample.jpg'
}
