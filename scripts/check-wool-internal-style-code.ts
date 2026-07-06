import { readFileSync } from 'node:fs'

const techPacksSource = readFileSync('src/data/fcs/tech-packs.ts', 'utf8')
const contextSource = readFileSync('src/pages/tech-pack/context.ts', 'utf8')
const eventsSource = readFileSync('src/pages/tech-pack/events.ts', 'utf8')

function assertContains(source: string, expected: string, file: string): void {
  if (!source.includes(expected)) {
    throw new Error(`${file} 缺少 ${expected}`)
  }
}

function sourceBlock(source: string, start: string, end: string, file: string): string {
  const startIndex = source.indexOf(start)
  if (startIndex < 0) {
    throw new Error(`${file} 无法识别 ${start}`)
  }
  const endIndex = source.indexOf(end, startIndex + start.length)
  if (endIndex < 0) {
    throw new Error(`${file} 无法识别 ${end}`)
  }
  return source.slice(startIndex, endIndex)
}

const patternFileTypeBlock = sourceBlock(
  techPacksSource,
  'export interface TechPackPatternFile',
  'export interface TechPackProcess',
  'src/data/fcs/tech-packs.ts',
)
const techPackTypeBlock = sourceBlock(
  techPacksSource,
  'export interface TechPack',
  '// 计算完整度',
  'src/data/fcs/tech-packs.ts',
)
const emptyPatternFormBlock = sourceBlock(
  contextSource,
  'function createEmptyPatternFormState',
  'function createEmptyBomFormState',
  'src/pages/tech-pack/context.ts',
)
const buildPatternItemsBlock = sourceBlock(
  contextSource,
  'function buildPatternItemsFromTechPack',
  'function buildBomItemsFromTechPack',
  'src/pages/tech-pack/context.ts',
)
const patternPoolDemoBlock = sourceBlock(
  contextSource,
  'function createPatternPoolDemoPackage',
  'function createMaterialPatternDemoAssociation',
  'src/pages/tech-pack/context.ts',
)
const materialAssociationBlock = sourceBlock(
  contextSource,
  'function createMaterialPatternDemoAssociation',
  'function ensurePatternPoolDemoPackages',
  'src/pages/tech-pack/context.ts',
)
const inheritPatternPackageBlock = sourceBlock(
  contextSource,
  'function inheritPatternPackageTechnicalFields',
  'function buildPatternItemsFromTechPack',
  'src/pages/tech-pack/context.ts',
)
const syncTechPackBlock = sourceBlock(
  contextSource,
  'function syncTechPackToStore',
  'function buildPatternFormStateFromItem',
  'src/pages/tech-pack/context.ts',
)
const buildPatternFormStateBlock = sourceBlock(
  contextSource,
  'function buildPatternFormStateFromItem',
  'function resetPatternForm',
  'src/pages/tech-pack/context.ts',
)
const buildPatternItemFromFormBlock = sourceBlock(
  eventsSource,
  'function buildPatternItemFromForm',
  'function resetPieceInstanceCraftDraft',
  'src/pages/tech-pack/events.ts',
)

assertContains(patternFileTypeBlock, 'internalStyleCode?: string', 'TechPackPatternFile')
assertContains(techPackTypeBlock, 'internalStyleCode?: string', 'TechPack')
assertContains(emptyPatternFormBlock, "internalStyleCode: ''", 'createEmptyPatternFormState')
assertContains(buildPatternItemsBlock, "internalStyleCode: item.internalStyleCode || techPack.internalStyleCode || ''", 'buildPatternItemsFromTechPack')
assertContains(patternPoolDemoBlock, "internalStyleCode: '2585'", 'createPatternPoolDemoPackage')
assertContains(materialAssociationBlock, "internalStyleCode: patternPackage.internalStyleCode || ''", 'createMaterialPatternDemoAssociation')
assertContains(inheritPatternPackageBlock, 'internalStyleCode: sourcePackage.internalStyleCode', 'inheritPatternPackageTechnicalFields')
assertContains(syncTechPackBlock, 'internalStyleCode: item.internalStyleCode || undefined', 'syncTechPackToStore')
assertContains(buildPatternFormStateBlock, "internalStyleCode: item.internalStyleCode || ''", 'buildPatternFormStateFromItem')
assertContains(buildPatternItemFromFormBlock, "internalStyleCode: state.newPattern.internalStyleCode || ''", 'buildPatternItemFromForm')

console.log('毛织内部货号专项检查通过')
