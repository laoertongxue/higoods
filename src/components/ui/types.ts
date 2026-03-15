// ============ UI 组件库类型定义 ============

// ============ 通用类型 ============

/**
 * 事件配置 - 用于生成 data-{prefix}-action="{action}" 属性
 */
export interface ActionConfig {
  prefix: string   // 事件前缀，如 'spu', 'sku', 'sample'
  action: string   // 动作名，如 'close-drawer', 'submit'
}

/**
 * 生成 data-action 属性字符串
 */
export function toActionAttr(config: ActionConfig): string {
  return `data-${config.prefix}-action="${config.action}"`
}

/**
 * 生成 data-field 属性字符串
 */
export function toFieldAttr(prefix: string, field: string): string {
  return `data-${prefix}-field="${field}"`
}

/**
 * 生成 data-filter 属性字符串
 */
export function toFilterAttr(prefix: string, filter: string): string {
  return `data-${prefix}-filter="${filter}"`
}

// ============ 按钮类型 ============

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonConfig {
  label?: string
  icon?: string
  variant?: ButtonVariant
  size?: ButtonSize
  action?: ActionConfig
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit' | 'reset'
}

// ============ 徽章类型 ============

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'outline'

export interface BadgeConfig {
  text: string
  variant: BadgeVariant
  icon?: string
  className?: string
}

export interface StatusBadgeMap {
  [status: string]: {
    text: string
    variant: BadgeVariant
    icon?: string
  }
}

// ============ 抽屉类型 ============

export type DrawerWidth = 'sm' | 'md' | 'lg'  // sm=480px, md=600px, lg=720px

export interface DrawerConfig {
  title: string
  subtitle?: string
  closeAction: ActionConfig
  width?: DrawerWidth
  animate?: boolean
}

export interface DrawerFooterConfig {
  cancel?: ActionConfig & { label?: string }
  confirm?: ActionConfig & { label: string; variant?: ButtonVariant; disabled?: boolean }
  extra?: string  // 额外的按钮HTML
}

// ============ 对话框类型 ============

export type DialogWidth = 'xs' | 'sm' | 'md' | 'lg'  // xs=360px, sm=420px, md=480px, lg=600px

export interface DialogConfig {
  title: string
  description?: string
  closeAction: ActionConfig
  width?: DialogWidth
}

export interface ConfirmDialogConfig extends DialogConfig {
  confirmAction: ActionConfig & { label: string; variant?: ButtonVariant }
  cancelLabel?: string
  danger?: boolean
}

export interface AlertDialogConfig extends DialogConfig {
  variant?: 'info' | 'warning' | 'danger' | 'success'
  confirmLabel?: string
}

// ============ 表格类型 ============

export interface TableColumn<T = any> {
  key: keyof T | string
  title: string
  width?: string
  minWidth?: string
  align?: 'left' | 'center' | 'right'
  render?: (row: T, index: number) => string
  sortable?: boolean
  className?: string
}

export interface TableOptions {
  rowAction?: ActionConfig & { dataKey: string }  // 行点击事件
  emptyText?: string
  striped?: boolean
  hoverable?: boolean
  compact?: boolean
  className?: string
}

// ============ 表单类型 ============

export interface InputConfig {
  id?: string
  name?: string
  value?: string
  placeholder?: string
  type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url'
  required?: boolean
  disabled?: boolean
  readonly?: boolean
  prefix?: string  // 事件前缀
  field?: string   // 字段名
  className?: string
  icon?: string    // 左侧图标
}

export interface SelectConfig {
  id?: string
  name?: string
  value?: string
  options: Array<{ value: string; label: string; disabled?: boolean }>
  placeholder?: string
  required?: boolean
  disabled?: boolean
  prefix?: string
  field?: string
  filter?: string  // 作为筛选器时的filter名
  className?: string
}

export interface TextareaConfig {
  id?: string
  name?: string
  value?: string
  placeholder?: string
  rows?: number
  required?: boolean
  disabled?: boolean
  prefix?: string
  field?: string
  className?: string
}

export interface CheckboxConfig {
  id?: string
  name?: string
  checked?: boolean
  label?: string
  disabled?: boolean
  prefix?: string
  field?: string
}

export interface FormFieldConfig {
  label: string
  required?: boolean
  hint?: string
  error?: string
}

// ============ 卡片类型 ============

export interface KpiCardConfig {
  title: string
  value: string | number
  icon?: string
  trend?: { value: string; up: boolean }
  action?: ActionConfig
  tone?: string  // 数值颜色类，如 'text-green-600'
  className?: string
}

export interface InfoCardConfig {
  title: string
  items: Array<{ label: string; value: string }>
  className?: string
}

// ============ 分页类型 ============

export interface PaginationConfig {
  current: number
  total: number
  pageSize?: number
  showTotal?: boolean
  prefix?: string
  simple?: boolean
}

// ============ 筛选栏类型 ============

export interface SearchInputConfig {
  value?: string
  placeholder?: string
  prefix: string
  filter?: string
  className?: string
}

export interface FilterBarConfig {
  search?: SearchInputConfig
  filters?: Array<SelectConfig>
  actions?: Array<ButtonConfig & { action: ActionConfig }>
  resetAction?: ActionConfig
  className?: string
}
