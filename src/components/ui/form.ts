// ============ 表单组件 ============

import type {
  InputConfig,
  SelectConfig,
  TextareaConfig,
  CheckboxConfig,
  FormFieldConfig,
} from './types.ts'
import { toFieldAttr, toFilterAttr } from './types.ts'

/**
 * HTML 转义
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ============ 基础样式 ============

const INPUT_BASE_CLASSES =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium ' +
  'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

const SELECT_BASE_CLASSES =
  'flex h-10 w-full items-center justify-between rounded-md border border-input ' +
  'bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground ' +
  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

const TEXTAREA_BASE_CLASSES =
  'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

const CHECKBOX_BASE_CLASSES =
  'h-4 w-4 shrink-0 rounded border border-primary ring-offset-background ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ' +
  'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground'

// ============ 输入框组件 ============

/**
 * 渲染输入框
 */
export function renderInput(config: InputConfig): string {
  const {
    id,
    name,
    value = '',
    placeholder = '',
    type = 'text',
    required = false,
    disabled = false,
    readonly = false,
    prefix,
    field,
    className = '',
    icon,
  } = config

  const attrs: string[] = []
  if (id) attrs.push(`id="${id}"`)
  if (name) attrs.push(`name="${name}"`)
  if (value) attrs.push(`value="${escapeHtml(value)}"`)
  if (placeholder) attrs.push(`placeholder="${escapeHtml(placeholder)}"`)
  if (required) attrs.push('required')
  if (disabled) attrs.push('disabled')
  if (readonly) attrs.push('readonly')
  if (prefix && field) attrs.push(toFieldAttr(prefix, field))

  const inputHtml = `<input type="${type}" class="${INPUT_BASE_CLASSES} ${className}" ${attrs.join(' ')}>`

  if (icon) {
    return `
      <div class="relative">
        <i data-lucide="${icon}" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"></i>
        <input type="${type}" class="${INPUT_BASE_CLASSES} pl-10 ${className}" ${attrs.join(' ')}>
      </div>
    `
  }

  return inputHtml
}

/**
 * 渲染带标签的输入框
 */
export function renderLabeledInput(
  label: string,
  config: InputConfig,
  required = false
): string {
  const id = config.id || `input-${Math.random().toString(36).slice(2, 8)}`
  return `
    <div class="space-y-2">
      <label for="${id}" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        ${escapeHtml(label)}${required ? '<span class="text-rose-500 ml-1">*</span>' : ''}
      </label>
      ${renderInput({ ...config, id })}
    </div>
  `
}

// ============ 选择框组件 ============

/**
 * 渲染选择框
 */
export function renderSelect(config: SelectConfig): string {
  const {
    id,
    name,
    value = '',
    options,
    placeholder = '请选择',
    required = false,
    disabled = false,
    prefix,
    field,
    filter,
    className = '',
  } = config

  const attrs: string[] = []
  if (id) attrs.push(`id="${id}"`)
  if (name) attrs.push(`name="${name}"`)
  if (required) attrs.push('required')
  if (disabled) attrs.push('disabled')
  if (prefix && field) attrs.push(toFieldAttr(prefix, field))
  if (prefix && filter) attrs.push(toFilterAttr(prefix, filter))

  const optionsHtml = options
    .map(opt => {
      const selected = opt.value === value ? 'selected' : ''
      const optDisabled = opt.disabled ? 'disabled' : ''
      return `<option value="${escapeHtml(opt.value)}" ${selected} ${optDisabled}>${escapeHtml(opt.label)}</option>`
    })
    .join('')

  return `
    <select class="${SELECT_BASE_CLASSES} ${className}" ${attrs.join(' ')}>
      <option value="" disabled ${!value ? 'selected' : ''}>${escapeHtml(placeholder)}</option>
      ${optionsHtml}
    </select>
  `
}

/**
 * 渲染带标签的选择框
 */
export function renderLabeledSelect(
  label: string,
  config: SelectConfig,
  required = false
): string {
  const id = config.id || `select-${Math.random().toString(36).slice(2, 8)}`
  return `
    <div class="space-y-2">
      <label for="${id}" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        ${escapeHtml(label)}${required ? '<span class="text-rose-500 ml-1">*</span>' : ''}
      </label>
      ${renderSelect({ ...config, id })}
    </div>
  `
}

// ============ 文本域组件 ============

/**
 * 渲染文本域
 */
export function renderTextarea(config: TextareaConfig): string {
  const {
    id,
    name,
    value = '',
    placeholder = '',
    rows = 4,
    required = false,
    disabled = false,
    prefix,
    field,
    className = '',
  } = config

  const attrs: string[] = []
  if (id) attrs.push(`id="${id}"`)
  if (name) attrs.push(`name="${name}"`)
  if (placeholder) attrs.push(`placeholder="${escapeHtml(placeholder)}"`)
  if (required) attrs.push('required')
  if (disabled) attrs.push('disabled')
  if (prefix && field) attrs.push(toFieldAttr(prefix, field))

  return `<textarea class="${TEXTAREA_BASE_CLASSES} ${className}" rows="${rows}" ${attrs.join(' ')}>${escapeHtml(value)}</textarea>`
}

/**
 * 渲染带标签的文本域
 */
export function renderLabeledTextarea(
  label: string,
  config: TextareaConfig,
  required = false
): string {
  const id = config.id || `textarea-${Math.random().toString(36).slice(2, 8)}`
  return `
    <div class="space-y-2">
      <label for="${id}" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        ${escapeHtml(label)}${required ? '<span class="text-rose-500 ml-1">*</span>' : ''}
      </label>
      ${renderTextarea({ ...config, id })}
    </div>
  `
}

// ============ 复选框组件 ============

/**
 * 渲染复选框
 */
export function renderCheckbox(config: CheckboxConfig): string {
  const {
    id,
    name,
    checked = false,
    label,
    disabled = false,
    prefix,
    field,
  } = config

  const checkboxId = id || `checkbox-${Math.random().toString(36).slice(2, 8)}`
  const attrs: string[] = [`id="${checkboxId}"`]
  if (name) attrs.push(`name="${name}"`)
  if (checked) attrs.push('checked')
  if (disabled) attrs.push('disabled')
  if (prefix && field) attrs.push(toFieldAttr(prefix, field))

  const checkboxHtml = `<input type="checkbox" class="${CHECKBOX_BASE_CLASSES}" ${attrs.join(' ')}>`

  if (label) {
    return `
      <div class="flex items-center space-x-2">
        ${checkboxHtml}
        <label for="${checkboxId}" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          ${escapeHtml(label)}
        </label>
      </div>
    `
  }

  return checkboxHtml
}

// ============ 表单字段包装 ============

/**
 * 渲染表单字段（带标签、必填标记、提示、错误）
 */
export function renderFormField(config: FormFieldConfig, content: string): string {
  const { label, required = false, hint, error } = config

  return `
    <div class="space-y-2">
      <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        ${escapeHtml(label)}${required ? '<span class="text-rose-500 ml-1">*</span>' : ''}
      </label>
      ${content}
      ${hint ? `<p class="text-sm text-muted-foreground">${escapeHtml(hint)}</p>` : ''}
      ${error ? `<p class="text-sm text-rose-500">${escapeHtml(error)}</p>` : ''}
    </div>
  `
}

/**
 * 渲染表单组（带标题的一组字段）
 */
export function renderFormGroup(title: string, fields: string[], description?: string): string {
  return `
    <div class="space-y-4">
      <div>
        <h3 class="text-sm font-semibold">${escapeHtml(title)}</h3>
        ${description ? `<p class="text-sm text-muted-foreground">${escapeHtml(description)}</p>` : ''}
      </div>
      <div class="space-y-4">
        ${fields.join('\n')}
      </div>
    </div>
  `
}

/**
 * 渲染两列表单布局
 */
export function renderFormRow(leftField: string, rightField: string): string {
  return `
    <div class="grid grid-cols-2 gap-4">
      ${leftField}
      ${rightField}
    </div>
  `
}

/**
 * 渲染表单分隔线
 */
export function renderFormDivider(): string {
  return '<div class="border-t my-4"></div>'
}

// ============ 快捷表单生成 ============

export interface QuickFormField {
  type: 'input' | 'select' | 'textarea' | 'checkbox'
  label: string
  required?: boolean
  config: InputConfig | SelectConfig | TextareaConfig | CheckboxConfig
}

/**
 * 快速生成表单
 */
export function renderQuickForm(fields: QuickFormField[]): string {
  return fields
    .map(field => {
      switch (field.type) {
        case 'input':
          return renderLabeledInput(field.label, field.config as InputConfig, field.required)
        case 'select':
          return renderLabeledSelect(field.label, field.config as SelectConfig, field.required)
        case 'textarea':
          return renderLabeledTextarea(field.label, field.config as TextareaConfig, field.required)
        case 'checkbox':
          return renderCheckbox(field.config as CheckboxConfig)
        default:
          return ''
      }
    })
    .join('\n')
}
