import assert from 'node:assert/strict'

import {
  getPatternLibraryConfig,
  listPatternApplicableCategoryOptions,
  resetPatternLibraryStore,
  updatePatternLibraryConfig,
} from '../src/data/pcs-pattern-library.ts'
import { renderPcsPatternLibraryConfigPage } from '../src/pages/pcs-pattern-library-config.ts'

resetPatternLibraryStore()

updatePatternLibraryConfig({
  styleTags: ['自定义风格'],
  primaryColors: ['自定义颜色'],
})

const config = getPatternLibraryConfig()
assert.ok(config.styleTags.includes('休闲'), '花型库风格标签应同步配置工作台风格')
assert.ok(config.primaryColors.includes('Rose'), '花型库主色系应同步配置工作台颜色')
assert.ok(!config.styleTags.includes('自定义风格'), '花型库不应脱离配置工作台单独维护风格标签')
assert.ok(!config.primaryColors.includes('自定义颜色'), '花型库不应脱离配置工作台单独维护主色系')

const applicableCategories = listPatternApplicableCategoryOptions()
assert.ok(applicableCategories.includes('上衣'), '花型库适用品类候选应来自配置工作台品类')

const html = renderPcsPatternLibraryConfigPage()
assert.match(html, /来源：配置工作台 \/ 风格/, '花型库配置页应明确展示风格来源')
assert.match(html, /来源：配置工作台 \/ 颜色/, '花型库配置页应明确展示颜色来源')

console.log('pcs-pattern-library.spec.ts PASS')
