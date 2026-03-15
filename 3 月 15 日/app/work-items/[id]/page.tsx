"use client"

import { useParams, useRouter } from "next/navigation"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  FileText,
  CheckCircle,
  AlertCircle,
  Type,
  List,
  Hash,
  Calendar,
  ImageIcon,
  ToggleLeft,
  Calculator,
  Paperclip,
  Info,
  Zap,
  Lock,
  RefreshCw,
  Copy,
  RotateCcw,
  GitBranch,
  Shield,
  ArrowRight,
  Ban,
  Users,
  Link2,
  Tag,
  Clock,
  FileCode,
  Lightbulb,
  Play,
  User,
} from "lucide-react"
import { getWorkItemTemplateConfig } from "@/lib/work-item-configs"

// 字段类型图标映射
const fieldTypeIcons: Record<string, any> = {
  text: Type,
  textarea: FileText,
  select: List,
  "multi-select": List,
  "cascade-select": List,
  "single-select": List,
  number: Hash,
  date: Calendar,
  datetime: Clock,
  radio: ToggleLeft,
  computed: Calculator,
  image: ImageIcon,
  file: Paperclip,
  files: Paperclip,
  url: Link2,
  reference: Link2,
  user: User,
  "user-select": User,
  "user-multi-select": Users,
  "team-select": Users,
  tags: Tag,
  log: FileText,
}

// 字段类型中文映射
const fieldTypeLabels: Record<string, string> = {
  text: "单行文本",
  textarea: "多行文本",
  select: "单选下拉",
  "multi-select": "多选标签",
  "cascade-select": "级联选择",
  "single-select": "单选下拉",
  number: "数字",
  date: "日期",
  datetime: "日期时间",
  radio: "单选按钮",
  computed: "自动计算",
  image: "图片上传",
  file: "文件上传",
  files: "多文件上传",
  url: "URL链接",
  reference: "关联引用",
  user: "用户选择",
  "user-select": "用户选择",
  "user-multi-select": "多用户选择",
  "team-select": "团队选择",
  tags: "标签",
  log: "操作日志",
}

export default function WorkItemTemplateDetailPage() {
  const params = useParams()
  const router = useRouter()
  const workItemId = params.id as string
  const config = getWorkItemTemplateConfig(workItemId)

  console.log("[v0] workItemId:", workItemId)
  console.log("[v0] config:", config)
  console.log("[v0] config keys:", config ? Object.keys(config) : "no config")

  if (!config) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SystemNav />
        <div className="flex flex-1 overflow-hidden">
          <SidebarNav />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="text-center py-12">
              <p className="text-muted-foreground">工作项模板不存在</p>
              <Button onClick={() => router.push("/work-items")} className="mt-4">
                返回列表
              </Button>
            </div>
          </main>
        </div>
      </div>
    )
  }

  const isProjectInit = config.code === "PROJECT_INIT"
  const isSampleAcquire = config.code === "SAMPLE_ACQUIRE"

  // 计算章节序号
  let sectionIndex = 0
  const getNextSection = () => {
    sectionIndex++
    const sectionLabels = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"]
    return sectionLabels[sectionIndex - 1] || sectionIndex.toString()
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* 顶部信息栏 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => router.push("/work-items")} className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  返回
                </Button>
                <div className="h-6 w-px bg-border" />
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl font-semibold text-foreground">{config.name}</h1>
                    {config.code && (
                      <Badge variant="outline" className="font-mono text-xs">
                        {config.code}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={
                        config.type === "execute"
                          ? "border-blue-500 text-blue-500"
                          : "border-orange-500 text-orange-500"
                      }
                    >
                      {config.type === "execute" ? "执行类" : "决策类"}
                    </Badge>
                    {config.isBuiltin && (
                      <Badge variant="secondary" className="gap-1">
                        <Lock className="w-3 h-3" />
                        系统内置
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    所属分类：{config.category || config.stage} · 默认执行角色：{config.role}
                  </p>
                </div>
              </div>
            </div>

            {/* 一、基础信息（系统字段） */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  {getNextSection()}
                </span>
                基础信息
                <Badge variant="outline" className="text-xs ml-2">
                  系统字段 · 只读
                </Badge>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">工作项名称</p>
                  <p className="font-medium text-foreground">{config.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">工作项编码</p>
                  <p className="font-mono text-foreground">{config.code || config.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">工作项分类</p>
                  <p className="text-foreground">{config.category || config.stage}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">是否系统内置</p>
                  <Badge variant={config.isBuiltin ? "default" : "secondary"}>{config.isBuiltin ? "是" : "否"}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">是否可被模板选用</p>
                  <Badge variant={config.isSelectable !== false ? "default" : "secondary"}>
                    {config.isSelectable !== false ? "是" : "否"}
                  </Badge>
                </div>
              </div>
            </Card>

            {/* 二、工作项能力定义 */}
            {config.capabilities && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {getNextSection()}
                  </span>
                  工作项能力定义
                  <Badge variant="outline" className="text-xs ml-2">
                    系统属性 · 只读
                  </Badge>
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-muted/30">
                    <div
                      className={`p-2 rounded-full ${config.capabilities.canReuse ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}
                    >
                      <RefreshCw className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">可复用</p>
                      <p className="font-medium">{config.capabilities.canReuse ? "是" : "否"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-muted/30">
                    <div
                      className={`p-2 rounded-full ${config.capabilities.canMultiInstance ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}
                    >
                      <Copy className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">可多实例</p>
                      <p className="font-medium">{config.capabilities.canMultiInstance ? "是" : "否"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-muted/30">
                    <div
                      className={`p-2 rounded-full ${config.capabilities.canRollback ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}
                    >
                      <RotateCcw className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">可回退</p>
                      <p className="font-medium">{config.capabilities.canRollback ? "是" : "否"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-muted/30">
                    <div
                      className={`p-2 rounded-full ${config.capabilities.canParallel ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}
                    >
                      <GitBranch className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">可并行</p>
                      <p className="font-medium">{config.capabilities.canParallel ? "是" : "否"}</p>
                    </div>
                  </div>
                </div>
                {(config.capabilityNotes || config.capabilityDescription) && (
                  <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-sm text-blue-700">
                      <Info className="w-4 h-4 inline mr-2" />
                      说明：{config.capabilityDescription || config.capabilityNotes}
                    </p>
                  </div>
                )}
              </Card>
            )}

            {/* 三、表单字段定义 */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  {getNextSection()}
                </span>
                {isSampleAcquire ? "表单字段" : isProjectInit ? "核心输出字段定义" : "字段定义"}
                {isSampleAcquire && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    （用于该工作项实例的创建/编辑）
                  </span>
                )}
                {isProjectInit && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">（商品项目主数据）</span>
                )}
              </h2>

              {isSampleAcquire && (
                <div className="mb-6 p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-sm text-blue-700">
                    <Info className="w-4 h-4 inline mr-2" />
                    每项标注：字段名 - 类型 - 必填性 - 说明 / 校验 / 示例 / 条件必填说明
                  </p>
                </div>
              )}

              {isProjectInit && (
                <div className="mb-6 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-sm text-amber-700">
                    <AlertCircle className="w-4 h-4 inline mr-2" />
                    以下字段<strong>全部属于该工作项的输出结果</strong>，其数据将成为商品项目的
                    <strong>长期主数据</strong>
                  </p>
                </div>
              )}

              {config.fieldGroups && config.fieldGroups.length > 0 ? (
                config.fieldGroups.map((group, groupIndex) => (
                  <div key={groupIndex} className="mb-8 last:mb-0">
                    <h3 className="text-base font-medium text-foreground mb-3 pb-2 border-b border-border flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-sm font-semibold">
                        {isSampleAcquire ? group.title.charAt(0) : groupIndex + 1}
                      </span>
                      {isSampleAcquire ? group.title.substring(3) : group.title}
                      {group.description && (
                        <span className="text-xs font-normal text-muted-foreground ml-2">（{group.description}）</span>
                      )}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground w-[200px]">
                              字段名称
                            </th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground w-[120px]">
                              字段类型
                            </th>
                            <th className="text-center py-3 px-4 font-medium text-muted-foreground w-[80px]">必填</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">说明 / 校验</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.fields &&
                            group.fields.map((field, fieldIndex) => {
                              const IconComponent = fieldTypeIcons[field.type] || Type
                              const hasCondition =
                                (field as any).conditionalDisplay || (field as any).conditionalRequired
                              const conditionalRequired = (field as any).conditionalRequired
                              const validationMsg = (field as any).validation
                              return (
                                <tr
                                  key={fieldIndex}
                                  className={`border-b border-border/50 hover:bg-muted/20 ${hasCondition ? "bg-orange-50/30" : ""}`}
                                >
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-foreground">{field.label}</span>
                                      {hasCondition && (
                                        <Badge variant="outline" className="text-xs border-orange-400 text-orange-600">
                                          条件必填
                                        </Badge>
                                      )}
                                    </div>
                                    {field.id && (
                                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{field.id}</p>
                                    )}
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                      <IconComponent className="w-4 h-4 text-muted-foreground" />
                                      <span>{fieldTypeLabels[field.type] || field.type}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    {field.required ? (
                                      <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4">
                                    {field.description && <p className="text-muted-foreground">{field.description}</p>}
                                    {validationMsg && (
                                      <p className="text-xs text-blue-600 mt-1">校验：{validationMsg}</p>
                                    )}
                                    {conditionalRequired && (
                                      <p className="text-xs text-orange-600 mt-1">条件：{conditionalRequired}</p>
                                    )}
                                    {(field as any).example && (
                                      <p className="text-xs text-gray-500 mt-1">示例：{(field as any).example}</p>
                                    )}
                                    {(field as any).unit && (
                                      <Badge variant="outline" className="text-xs mt-1">
                                        单位：{(field as any).unit}
                                      </Badge>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>暂无字段定义</p>
                </div>
              )}
            </Card>

            {/* 四、条件必填与校验规则 */}
            {config.validationRules && config.validationRules.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {getNextSection()}
                  </span>
                  条件必填与校验规则
                  <Badge variant="outline" className="text-xs ml-2 border-red-500 text-red-500">
                    必须实现
                  </Badge>
                </h2>
                <ol className="space-y-3 list-decimal list-inside">
                  {config.validationRules.map((rule: string, index: number) => (
                    <li key={index} className="text-foreground pl-2">
                      <span className="text-foreground">{rule}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            )}

            {/* 五、状态定义 */}
            {(config.statusDefinitions || config.statusOptions || config.statusFlow) && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {getNextSection()}
                  </span>
                  状态定义
                </h2>

                {config.statusFlow && (
                  <div className="mb-6 p-4 rounded-lg bg-gray-50 border border-gray-200">
                    <p className="text-sm font-medium text-foreground mb-2">状态流转：</p>
                    {/* Check if statusFlow is an array of objects with from/to/action */}
                    {Array.isArray(config.statusFlow) &&
                    config.statusFlow.length > 0 &&
                    typeof config.statusFlow[0] === "object" &&
                    config.statusFlow[0].from ? (
                      <div className="space-y-2">
                        {config.statusFlow.map((flow: any, index: number) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <Badge variant="outline">{flow.from}</Badge>
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                            <Badge variant="outline">{flow.to}</Badge>
                            <span className="text-muted-foreground ml-2">（{flow.action}）</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center flex-wrap gap-2">
                        {(Array.isArray(config.statusFlow)
                          ? config.statusFlow
                          : String(config.statusFlow).split("→")
                        ).map((status: any, index: number, arr: any[]) => (
                          <div key={index} className="flex items-center gap-2">
                            <Badge variant="outline" className="text-sm">
                              {typeof status === "string" ? status.trim() : String(status)}
                            </Badge>
                            {index < arr.length - 1 && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {config.statusOptions && config.statusOptions.length > 0 && (
                  <div className="mb-6">
                    <p className="text-sm font-medium text-foreground mb-3">状态定义：</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {config.statusOptions.map((status: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border bg-muted/30"
                        >
                          <span
                            className={`w-3 h-3 rounded-full ${
                              status.color === "green"
                                ? "bg-green-500"
                                : status.color === "red"
                                  ? "bg-red-500"
                                  : status.color === "yellow"
                                    ? "bg-yellow-500"
                                    : status.color === "blue"
                                      ? "bg-blue-500"
                                      : "bg-gray-400"
                            }`}
                          />
                          <div>
                            <span className="font-medium">{status.label}</span>
                            {status.description && (
                              <p className="text-xs text-muted-foreground">{status.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {config.rollbackRules && config.rollbackRules.length > 0 && (
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-2">
                      <RotateCcw className="w-4 h-4" />
                      回退规则示例：
                    </p>
                    <ul className="space-y-1">
                      {config.rollbackRules.map((rule: any, index: number) => (
                        <li key={index} className="text-sm text-amber-700">
                          • {typeof rule === "string" ? rule : `从「${rule.from}」回退到「${rule.to}」：${rule.action}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            )}

            {/* 六、权限与可编辑性 */}
            {config.permissions && config.permissions.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {getNextSection()}
                  </span>
                  权限与可编辑性
                </h2>
                <div className="space-y-4">
                  {config.permissions.map((perm: any, index: number) => (
                    <div key={index} className="flex items-start gap-4 p-4 rounded-lg border border-border bg-muted/30">
                      <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{perm.role}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {perm.actions.map((action: string, actionIndex: number) => (
                            <Badge key={actionIndex} variant="secondary" className="text-xs">
                              {action}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <p className="text-sm text-muted-foreground">
                    <Lock className="w-4 h-4 inline mr-2" />
                    系统内置字段（工作项编码、创建时间等）不可编辑。
                  </p>
                </div>
              </Card>
            )}

            {/* 七、系统约束说明 */}
            {config.systemConstraints && config.systemConstraints.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {getNextSection()}
                  </span>
                  系统约束说明
                </h2>
                <ul className="space-y-3">
                  {config.systemConstraints.map((constraint: string, index: number) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs flex items-center justify-center font-bold mt-0.5">
                        <Shield className="w-3 h-3" />
                      </span>
                      <span className="text-foreground">{constraint}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* 八、示例数据 */}
            {config.example && Object.keys(config.example).length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {getNextSection()}
                  </span>
                  示例
                  <span className="text-sm font-normal text-muted-foreground ml-2">（供 UI 字段占位与提示）</span>
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(config.example).map(([key, value], index) => (
                    <div key={index} className="p-3 rounded-lg border border-border bg-muted/30">
                      <p className="text-sm text-muted-foreground mb-1">{key}</p>
                      <p className="font-medium text-foreground">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* 九、API/表结构提示 */}
            {config.apiHints && (config.apiHints.requiredFields || config.apiHints.optionalFields) && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {getNextSection()}
                  </span>
                  API / 表结构提示
                  <span className="text-sm font-normal text-muted-foreground ml-2">（供开发）</span>
                </h2>
                <div className="space-y-4">
                  {config.apiHints.requiredFields && config.apiHints.requiredFields.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        必存字段：
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {config.apiHints.requiredFields.map((field: string, index: number) => (
                          <Badge key={index} variant="outline" className="font-mono text-xs">
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {config.apiHints.optionalFields && config.apiHints.optionalFields.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-gray-500" />
                        可选字段：
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {config.apiHints.optionalFields.map((field: string, index: number) => (
                          <Badge key={index} variant="secondary" className="font-mono text-xs">
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* 十、扩展建议 */}
            {config.extensionSuggestions && config.extensionSuggestions.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {getNextSection()}
                  </span>
                  扩展建议
                  <Badge variant="outline" className="text-xs ml-2">
                    非必填，但建议实现
                  </Badge>
                </h2>
                <ul className="space-y-3">
                  {config.extensionSuggestions.map((suggestion: string, index: number) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs flex items-center justify-center font-bold mt-0.5">
                        <Lightbulb className="w-3 h-3" />
                      </span>
                      <span className="text-foreground">{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* 其他旧版字段兼容 - 输入字段定义 */}
            {!isSampleAcquire && config.inputFields && config.inputFields.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {getNextSection()}
                  </span>
                  输入字段定义
                </h2>
                <div className="space-y-2">
                  {config.inputFields.map((field: any, index: number) => (
                    <div key={index} className="p-3 rounded-lg border border-border bg-muted/30">
                      <span className="font-medium">{field.label}</span>
                      <span className="text-muted-foreground ml-2">- {field.description}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* 旧版兼容 - 业务规则 */}
            {config.businessRules && config.businessRules.length > 0 && !config.validationRules && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {getNextSection()}
                  </span>
                  业务规则
                </h2>
                <ul className="space-y-3">
                  {config.businessRules.map((rule: string, index: number) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-bold mt-0.5">
                        <Zap className="w-3 h-3" />
                      </span>
                      <span className="text-foreground">{rule}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* 旧版兼容 - 交互说明 */}
            {config.interactions && config.interactions.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {getNextSection()}
                  </span>
                  交互说明
                </h2>
                <ul className="space-y-3">
                  {config.interactions.map((interaction: string, index: number) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-600 text-xs flex items-center justify-center font-bold mt-0.5">
                        <Play className="w-3 h-3" />
                      </span>
                      <span className="text-foreground">{interaction}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* 旧版兼容 - 页面限制说明 */}
            {config.pageLimitations && config.pageLimitations.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {getNextSection()}
                  </span>
                  页面限制说明
                </h2>
                <ul className="space-y-3">
                  {config.pageLimitations.map((limitation: string, index: number) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs flex items-center justify-center font-bold mt-0.5">
                        <Ban className="w-3 h-3" />
                      </span>
                      <span className="text-foreground">{limitation}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {config.uiSuggestions && config.uiSuggestions.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {getNextSection()}
                  </span>
                  UI呈现建议
                  <Badge variant="outline" className="text-xs ml-2 border-cyan-500 text-cyan-500">
                    前端参考
                  </Badge>
                </h2>
                <ul className="space-y-3">
                  {config.uiSuggestions.map((suggestion: string, index: number) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-100 text-cyan-600 text-xs flex items-center justify-center font-bold mt-0.5">
                        <Lightbulb className="w-3 h-3" />
                      </span>
                      <span className="text-foreground">{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* 底部间距 */}
            <div className="h-12" />
          </div>
        </main>
      </div>
    </div>
  )
}
