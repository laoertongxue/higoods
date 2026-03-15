"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { Search } from "lucide-react"

interface FieldRule {
  field_key: string
  field_label?: string
  widget_type: "checkbox" | "radio" | "select"
  required: boolean
  min_selected?: number
  max_selected?: number
  default_value?: string | string[]
  allowed_mode: "all" | "whitelist" | "blacklist"
  allowed_values?: string[]
  excluded_values?: string[]
}

interface ConfigData {
  brands?: Array<{ code: string; name_zh: string }>
  categories?: Array<{ code: string; name_zh: string }>
  styles?: Array<{ code: string; name_zh: string }>
  trend_elements?: Array<{ code: string; name_zh: string }>
  fabrics?: Array<{ code: string; name_zh: string }>
  crowds?: Array<{ code: string; name_zh: string }>
  crowd_positioning?: Array<{ code: string; name_zh: string }>
  style_no?: Array<{ code: string; name_zh: string }>
  product_positioning?: Array<{ code: string; name_zh: string }>
  materials?: Array<{ code: string; name_zh: string }>
}

interface RemarkOptionsPreviewProps {
  templateFieldRules: FieldRule[]
  configData: ConfigData
}

export function RemarkOptionsPreview({ templateFieldRules, configData }: RemarkOptionsPreviewProps) {
  const [formValues, setFormValues] = useState<Record<string, string | string[]>>({})
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({})
  const [currentPage, setCurrentPage] = useState<Record<string, number>>({})

  const ITEMS_PER_PAGE = 20

  const getFieldOptions = (fieldKey: string, rule: FieldRule) => {
    const dataMap: Record<string, Array<{ code: string; name_zh: string }>> = {
      brand_ids: configData.brands || [],
      category_ids: configData.categories || [],
      style_ids: configData.styles || [],
      trend_element_ids: configData.trend_elements || [],
      fabric_ids: configData.fabrics || [],
      crowd_ids: configData.crowds || [],
      crowd_positioning_ids: configData.crowd_positioning || [],
      style_no_ids: configData.style_no || [],
      product_positioning_ids: configData.product_positioning || [],
      material_ids: configData.materials || [],
    }

    let options = dataMap[fieldKey] || []

    // Apply allowed_mode filtering
    if (rule.allowed_mode === "whitelist" && rule.allowed_values) {
      options = options.filter((opt) => rule.allowed_values!.includes(opt.code))
    } else if (rule.allowed_mode === "blacklist" && rule.excluded_values) {
      options = options.filter((opt) => !rule.excluded_values!.includes(opt.code))
    }

    return options
  }

  const handleCheckboxChange = (fieldKey: string, value: string, checked: boolean) => {
    const currentValues = (formValues[fieldKey] as string[]) || []
    const newValues = checked ? [...currentValues, value] : currentValues.filter((v) => v !== value)
    setFormValues({ ...formValues, [fieldKey]: newValues })
  }

  const handleRadioChange = (fieldKey: string, value: string) => {
    setFormValues({ ...formValues, [fieldKey]: value })
  }

  const validateField = (fieldKey: string, rule: FieldRule) => {
    const value = formValues[fieldKey]
    if (rule.required && !value) return "此项为必填项"
    if (rule.min_selected && Array.isArray(value) && value.length < rule.min_selected) {
      return `至少选择 ${rule.min_selected} 项`
    }
    if (rule.max_selected && Array.isArray(value) && value.length > rule.max_selected) {
      return `最多选择 ${rule.max_selected} 项`
    }
    return null
  }

  const renderWidget = (rule: FieldRule) => {
    const options = getFieldOptions(rule.field_key, rule)
    const searchTerm = searchTerms[rule.field_key] || ""
    const filteredOptions = searchTerm
      ? options.filter((opt) => opt.code.toLowerCase().includes(searchTerm.toLowerCase()) || opt.name_zh.includes(searchTerm))
      : options

    const needsPagination = rule.field_key === "style_no_ids" && filteredOptions.length > ITEMS_PER_PAGE
    const currentPageNum = currentPage[rule.field_key] || 1
    const paginatedOptions = needsPagination
      ? filteredOptions.slice((currentPageNum - 1) * ITEMS_PER_PAGE, currentPageNum * ITEMS_PER_PAGE)
      : filteredOptions
    const totalPages = needsPagination ? Math.ceil(filteredOptions.length / ITEMS_PER_PAGE) : 1

    const error = validateField(rule.field_key, rule)

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">
              {rule.field_label || rule.field_key}
              {rule.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {rule.min_selected && (
              <Badge variant="outline" className="text-xs">
                最少{rule.min_selected}项
              </Badge>
            )}
            {rule.max_selected && (
              <Badge variant="outline" className="text-xs">
                最多{rule.max_selected}项
              </Badge>
            )}
          </div>
          {(rule.field_key === "style_no_ids" || filteredOptions.length > 10) && (
            <div className="relative w-48">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索..."
                className="pl-8 h-9"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerms({ ...searchTerms, [rule.field_key]: e.target.value })
                  setCurrentPage({ ...currentPage, [rule.field_key]: 1 })
                }}
              />
            </div>
          )}
        </div>

        {rule.widget_type === "checkbox" && (
          <div className="space-y-2 border rounded-md p-4 max-h-96 overflow-y-auto">
            {paginatedOptions.map((option) => (
              <div key={option.code} className="flex items-center space-x-2">
                <Checkbox
                  id={`${rule.field_key}-${option.code}`}
                  checked={((formValues[rule.field_key] as string[]) || []).includes(option.code)}
                  onCheckedChange={(checked) => handleCheckboxChange(rule.field_key, option.code, checked as boolean)}
                />
                <Label htmlFor={`${rule.field_key}-${option.code}`} className="text-sm font-normal cursor-pointer">
                  {option.name_zh} ({option.code})
                </Label>
              </div>
            ))}
          </div>
        )}

        {rule.widget_type === "radio" && (
          <RadioGroup
            value={(formValues[rule.field_key] as string) || ""}
            onValueChange={(value) => handleRadioChange(rule.field_key, value)}
            className="space-y-2 border rounded-md p-4 max-h-96 overflow-y-auto"
          >
            {paginatedOptions.map((option) => (
              <div key={option.code} className="flex items-center space-x-2">
                <RadioGroupItem value={option.code} id={`${rule.field_key}-${option.code}`} />
                <Label htmlFor={`${rule.field_key}-${option.code}`} className="text-sm font-normal cursor-pointer">
                  {option.name_zh} ({option.code})
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

        {needsPagination && (
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-sm text-muted-foreground">
              显示 {(currentPageNum - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPageNum * ITEMS_PER_PAGE, filteredOptions.length)} / 共{" "}
              {filteredOptions.length} 项
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                disabled={currentPageNum === 1}
                onClick={() => setCurrentPage({ ...currentPage, [rule.field_key]: currentPageNum - 1 })}
              >
                上一页
              </button>
              <span className="text-sm">
                {currentPageNum} / {totalPages}
              </span>
              <button
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                disabled={currentPageNum === totalPages}
                onClick={() => setCurrentPage({ ...currentPage, [rule.field_key]: currentPageNum + 1 })}
              >
                下一页
              </button>
            </div>
          </div>
        )}

        {error && <div className="text-sm text-red-500 mt-1">{error}</div>}
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg border">
      <h3 className="text-lg font-semibold">备注选项预览</h3>
      {templateFieldRules.map((rule) => (
        <div key={rule.field_key}>{renderWidget(rule)}</div>
      ))}
    </div>
  )
}
