"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { ArrowLeft } from "lucide-react"

export default function EditWorkItemPage() {
  const params = useParams()
  const router = useRouter()

  const [name, setName] = useState("制版准备")
  const [type, setType] = useState<"execution" | "decision">("execution")
  const [description, setDescription] = useState(
    "准备制版所需的所有资料，包括BOM、纸样、工艺要求、花型调色等，用于后续生产制作",
  )
  const [status, setStatus] = useState(true)
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["版师", "商品"])
  const [selectedFieldModels, setSelectedFieldModels] = useState<string[]>(["BOM", "纸样", "标准工艺", "花型/调色"])
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

  const availableRoles = ["设计", "版师", "商品", "采购", "打样", "测款"]
  const availableFieldModels = [
    "商品基础信息",
    "外采样品",
    "测款数据",
    "BOM",
    "纸样",
    "标准工艺",
    "花型/调色",
    "质检结果",
  ]

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]))
  }

  const toggleFieldModel = (model: string) => {
    setSelectedFieldModels((prev) => (prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]))
  }

  const handleSubmit = () => {
    if (!name || selectedRoles.length === 0) {
      alert("请填写工作项名称并选择至少一个执行角色")
      return
    }
    // Here would be the API call to update the work item
    router.push(`/work-items/${params.id}`)
  }

  const handleCancel = () => {
    setCancelDialogOpen(true)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6 max-w-4xl">
            {/* Back Button */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/work-items/${params.id}`)}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                返回详情
              </Button>
            </div>

            {/* Header */}
            <div>
              <h1 className="text-2xl font-semibold text-foreground">编辑工作项</h1>
              <p className="text-sm text-muted-foreground mt-1">编号：{params.id}</p>
            </div>

            {/* Basic Info */}
            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">工作项基础信息</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    工作项名称 <span className="text-destructive">*</span>
                  </Label>
                  <Input id="name" placeholder="如：制版准备" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>
                    工作项类型 <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant={type === "execution" ? "default" : "outline"}
                      onClick={() => setType("execution")}
                      className="flex-1"
                    >
                      执行类
                    </Button>
                    <Button
                      type="button"
                      variant={type === "decision" ? "default" : "outline"}
                      onClick={() => setType("decision")}
                      className="flex-1"
                    >
                      决策类
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">执行类：需要完成具体操作；决策类：需要做出判断和选择</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">工作项说明</Label>
                  <Textarea
                    id="description"
                    placeholder="描述该工作项的业务含义和使用场景..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="status">启用状态</Label>
                  <Switch id="status" checked={status} onCheckedChange={setStatus} />
                  <span className="text-sm text-muted-foreground">{status ? "启用" : "停用"}</span>
                </div>
              </div>
            </Card>

            {/* Field Models */}
            <Card className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">默认字段模型配置</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  定义该工作项默认需要填写的结构化字段。字段模型定义的是"结构"，不包含任何业务数据。模板中可基于此进行删减或增强。
                </p>
              </div>
              <div className="space-y-2">
                <Label>字段模型（多选）</Label>
                <div className="flex flex-wrap gap-2">
                  {availableFieldModels.map((model) => (
                    <Badge
                      key={model}
                      variant={selectedFieldModels.includes(model) ? "default" : "outline"}
                      className="cursor-pointer px-4 py-2 text-sm"
                      onClick={() => toggleFieldModel(model)}
                    >
                      {model}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>

            {/* Default Roles */}
            <Card className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  默认执行角色 <span className="text-destructive">*</span>
                </h2>
                <p className="text-sm text-muted-foreground mt-1">选择负责执行此工作项的角色</p>
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {availableRoles.map((role) => (
                    <Badge
                      key={role}
                      variant={selectedRoles.includes(role) ? "default" : "outline"}
                      className="cursor-pointer px-4 py-2 text-sm"
                      onClick={() => toggleRole(role)}
                    >
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pb-6">
              <Button variant="outline" onClick={handleCancel}>
                取消
              </Button>
              <Button onClick={handleSubmit}>保存</Button>
            </div>
          </div>
        </main>
      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认取消</AlertDialogTitle>
            <AlertDialogDescription>当前编辑的内容将不会被保存，确定要取消吗？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续编辑</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push(`/work-items/${params.id}`)}>确定取消</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
