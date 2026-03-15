// ============ UI 组件库统一导出 ============
// 项目级统一 UI 组件，基于 Vanilla TypeScript + Tailwind CSS
// 组件采用纯函数渲染模式，返回 HTML 字符串

// ============ 类型定义 ============
export * from './types'

// ============ 基础组件 ============
export * from './button'
export * from './badge'

// ============ 容器组件 ============
export * from './drawer'
export * from './dialog'
export * from './card'

// ============ 数据展示组件 ============
export * from './table'

// ============ 表单组件 ============
export * from './form'

// ============ 导航组件 ============
export * from './pagination'
export * from './filter-bar'

// ============ 便捷导入 ============
// 组件使用示例：
// import { renderDrawer, renderTable, renderButton } from '../components/ui'
// 
// 或按类别导入：
// import * as UI from '../components/ui'
// UI.renderDrawer(...)

// ============ 版本信息 ============
export const UI_VERSION = '1.0.0'
