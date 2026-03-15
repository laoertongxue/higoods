"use client"

import { useState } from "react"
import Link from "next/link"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Plus, Search, MoreVertical, Edit, Copy, PowerOff, Power } from "lucide-react"

interface Template {
  id: string
  name: string
  styleType: string[]
  stageCount: number
  workItemCount: number
  creator: string
  updatedAt: string
  status: "active" | "inactive"
}

const mockTemplates: Template[] = [
  {
    id: "TPL-001",
    name: "基础款 - 完整流程模板",
    styleType: ["基础款"],
    stageCount: 5,
    workItemCount: 21,
    creator: "系统管理员",
    updatedAt: "2025-01-15 14:30",
    status: "active",
  },
  {
    id: "TPL-002",
    name: "快时尚款 - 快速上架模板",
    styleType: ["快时尚款"],
    stageCount: 5,
    workItemCount: 20,
    creator: "系统管理员",
    updatedAt: "2025-01-14 10:20",
    status: "active",
  },
  {
    id: "TPL-003",
    name: "改版款 - 旧SPU升级模板",
    styleType: ["改版款"],
    stageCount: 6,
    workItemCount: 19,
    creator: "系统管理员",
    updatedAt: "2025-01-10 16:45",
    status: "active",
  },
  {
    id: "TPL-004",
    name: "设计款 - 原创迭代模板",
    styleType: ["设计款"],
    stageCount: 5,
    workItemCount: 19,
    creator: "系统管理员",
    updatedAt: "2025-01-08 09:15",
    status: "active",
  },
]

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>(mockTemplates)
  const [searchQuery, setSearchQuery] = useState("")
  const [styleTypeFilter, setStyleTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogAction, setDialogAction] = useState<{ type: string; template: Template | null }>({
    type: "",
    template: null,
  })

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStyleType = styleTypeFilter === "all" || template.styleType.includes(styleTypeFilter)
    const matchesStatus = statusFilter === "all" || template.status === statusFilter
    return matchesSearch && matchesStyleType && matchesStatus
  })

  const handleCopy = (template: Template) => {
    const newTemplate = {
      ...template,
      id: `TPL-${String(templates.length + 1).padStart(3, "0")}`,
      name: `${template.name}-副本`,
      creator: "张三",
      updatedAt: new Date().toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    }
    setTemplates([...templates, newTemplate])
  }

  const handleToggleStatus = (template: Template) => {
    setTemplates(
      templates.map((t) =>
        t.id === template.id ? { ...t, status: t.status === "active" ? "inactive" : "active" } : t,
      ),
    )
    setDialogOpen(false)
  }

  const openDialog = (type: string, template: Template) => {
    setDialogAction({ type, template })
    setDialogOpen(true)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">商品项目模板</h1>
                <p className="text-sm text-muted-foreground mt-1">管理商品项目模板，快速生成标准化流程结构</p>
              </div>
              <Link href="/templates/new">
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  新增模板
                </Button>
              </Link>
            </div>

            {/* Filters */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索模板名称"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={styleTypeFilter} onValueChange={setStyleTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="适用款式类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部款式类型</SelectItem>
                    <SelectItem value="基础款">基础款</SelectItem>
                    <SelectItem value="快时尚款">快时尚款</SelectItem>
                    <SelectItem value="改版款">改版款</SelectItem>
                    <SelectItem value="设计款">设计款</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="active">启用</SelectItem>
                    <SelectItem value="inactive">停用</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("")
                    setStyleTypeFilter("all")
                    setStatusFilter("all")
                  }}
                >
                  重置
                </Button>
              </div>
            </div>

            {/* Templates Table */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">模板名称</th>
                      <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">适用款式类型</th>
                      <th className="text-center text-sm font-medium text-muted-foreground px-4 py-3">阶段数量</th>
                      <th className="text-center text-sm font-medium text-muted-foreground px-4 py-3">工作项数量</th>
                      <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">创建人</th>
                      <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">最近更新时间</th>
                      <th className="text-center text-sm font-medium text-muted-foreground px-4 py-3">状态</th>
                      <th className="text-center text-sm font-medium text-muted-foreground px-4 py-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTemplates.map((template) => (
                      <tr key={template.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <Link
                            href={`/templates/${template.id}`}
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            {template.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {template.styleType.map((type) => (
                              <Badge key={type} variant="outline" className="text-xs">
                                {type}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-foreground">{template.stageCount}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-foreground">{template.workItemCount}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-foreground">{template.creator}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-muted-foreground">{template.updatedAt}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={template.status === "active" ? "default" : "secondary"}>
                            {template.status === "active" ? "启用" : "停用"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/templates/${template.id}/edit`} className="flex items-center gap-2">
                                  <Edit className="w-4 h-4" />
                                  编辑
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleCopy(template)}
                                className="flex items-center gap-2"
                              >
                                <Copy className="w-4 h-4" />
                                复制
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  openDialog(template.status === "active" ? "disable" : "enable", template)
                                }
                                className="flex items-center gap-2"
                              >
                                {template.status === "active" ? (
                                  <>
                                    <PowerOff className="w-4 h-4" />
                                    停用
                                  </>
                                ) : (
                                  <>
                                    <Power className="w-4 h-4" />
                                    启用
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredTemplates.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">暂无模板数据</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogAction.type === "disable" ? "停用模板" : "启用模板"}</AlertDialogTitle>
            <AlertDialogDescription>
              {dialogAction.type === "disable"
                ? "停用后，该模板将不能用于新建商品项目，但不影响已使用该模板的项目。确定要停用吗？"
                : "确定要启用该模板吗？启用后可用于新建商品项目。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => dialogAction.template && handleToggleStatus(dialogAction.template)}>
              确定
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
