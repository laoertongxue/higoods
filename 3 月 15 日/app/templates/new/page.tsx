"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Library } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"

interface WorkItem {
  id: string
  name: string
  type: "execution" | "decision"
  required: boolean
  roles: string[]
  fieldModels: string[]
}

interface Stage {
  id: string
  name: string
  description: string
  required: boolean
  workItems: WorkItem[]
  expanded: boolean
}

export default function NewTemplatePage() {
  const router = useRouter()
  const [templateName, setTemplateName] = useState("")
  const [styleType, setStyleType] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState(true)
  const [stages, setStages] = useState<Stage[]>([
    {
      id: "stage-1",
      name: "立项阶段",
      description: "项目立项与信息收集",
      required: true,
      expanded: true,
      workItems: [
        {
          id: "work-1",
          name: "基础信息确认",
          type: "execution",
          required: true,
          roles: ["商品运营"],
          fieldModels: [],
        },
      ],
    },
  ])
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [workItemDialogOpen, setWorkItemDialogOpen] = useState(false)
  const [currentStageId, setCurrentStageId] = useState<string>("")
  const [selectedWorkItemIds, setSelectedWorkItemIds] = useState<string[]>([])

  const workItemLibrary = [
    { id: "WI-001", name: "制版准备", type: "execution", roles: ["版师", "商品"], fieldModels: ["制版/BOM", "纸样"] },
    { id: "WI-002", name: "样衣制作", type: "execution", roles: ["打样"], fieldModels: ["标准工艺"] },
    { id: "WI-003", name: "测款结果判断", type: "decision", roles: ["商品"], fieldModels: [] },
    { id: "WI-004", name: "花型调色", type: "execution", roles: ["设计"], fieldModels: ["花型/调色"] },
    { id: "WI-005", name: "首单备货", type: "execution", roles: ["采购"], fieldModels: ["制版/BOM"] },
  ]

  const addStage = () => {
    const newStage: Stage = {
      id: `stage-${Date.now()}`,
      name: "新阶段",
      description: "",
      required: true,
      expanded: true,
      workItems: [],
    }
    setStages([...stages, newStage])
  }

  const deleteStage = (stageId: string) => {
    setStages(stages.filter((s) => s.id !== stageId))
  }

  const updateStage = (stageId: string, updates: Partial<Stage>) => {
    setStages(stages.map((s) => (s.id === stageId ? { ...s, ...updates } : s)))
  }

  const toggleStageExpand = (stageId: string) => {
    setStages(stages.map((s) => (s.id === stageId ? { ...s, expanded: !s.expanded } : s)))
  }

  const addWorkItem = (stageId: string) => {
    const newWorkItem: WorkItem = {
      id: `work-${Date.now()}`,
      name: "新工作项",
      type: "execution",
      required: true,
      roles: [],
      fieldModels: [],
    }
    setStages(stages.map((s) => (s.id === stageId ? { ...s, workItems: [...s.workItems, newWorkItem] } : s)))
  }

  const deleteWorkItem = (stageId: string, workItemId: string) => {
    setStages(
      stages.map((s) => (s.id === stageId ? { ...s, workItems: s.workItems.filter((w) => w.id !== workItemId) } : s)),
    )
  }

  const updateWorkItem = (stageId: string, workItemId: string, updates: Partial<WorkItem>) => {
    setStages(
      stages.map((s) =>
        s.id === stageId
          ? { ...s, workItems: s.workItems.map((w) => (w.id === workItemId ? { ...w, ...updates } : w)) }
          : s,
      ),
    )
  }

  const handleSubmit = () => {
    if (!templateName || !styleType) {
      alert("请填写模板名称和适用款式类型")
      return
    }
    // Here would be the API call to save the template
    router.push("/templates")
  }

  const handleCancel = () => {
    setCancelDialogOpen(true)
  }

  const openWorkItemDialog = (stageId: string) => {
    setCurrentStageId(stageId)
    setSelectedWorkItemIds([])
    setWorkItemDialogOpen(true)
  }

  const handleAddWorkItemsFromLibrary = () => {
    const selectedItems = workItemLibrary.filter((item) => selectedWorkItemIds.includes(item.id))
    const newWorkItems: WorkItem[] = selectedItems.map((item) => ({
      id: `work-${Date.now()}-${item.id}`,
      name: item.name,
      type: item.type as "execution" | "decision",
      required: true,
      roles: item.roles,
      fieldModels: item.fieldModels,
    }))

    setStages(stages.map((s) => (s.id === currentStageId ? { ...s, workItems: [...s.workItems, ...newWorkItems] } : s)))
    setWorkItemDialogOpen(false)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6 pb-32">
            {/* Header */}
            <div>
              <h1 className="text-2xl font-semibold text-foreground">新增模板</h1>
              <p className="text-sm text-muted-foreground mt-1">创建新的商品项目模板</p>
            </div>

            {/* Basic Info */}
            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">模板基本信息</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="templateName">
                    模板名称 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="templateName"
                    placeholder="如：基础款-完整流程模板"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="styleType">
                    适用款式类型 <span className="text-destructive">*</span>
                  </Label>
                  <Select value={styleType} onValueChange={setStyleType}>
                    <SelectTrigger id="styleType">
                      <SelectValue placeholder="选择款式类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="基础款">基础款</SelectItem>
                      <SelectItem value="设计风格款">设计风格款</SelectItem>
                      <SelectItem value="设计&改版款">设计&改版款</SelectItem>
                      <SelectItem value="快速复制款">快速复制款</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">模板说明</Label>
                  <Textarea
                    id="description"
                    placeholder="描述模板适用场景..."
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

            {/* Stages Configuration */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">阶段 & 工作项配置</h2>
                <Button onClick={addStage} variant="outline" className="gap-2 bg-transparent">
                  <Plus className="w-4 h-4" />
                  新增阶段
                </Button>
              </div>

              {stages.map((stage, stageIndex) => (
                <Card key={stage.id} className="p-6 space-y-4">
                  {/* Stage Header */}
                  <div className="flex items-start gap-4">
                    <div className="flex items-center gap-2 mt-2 cursor-move">
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">阶段 {stageIndex + 1}</span>
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>阶段名称</Label>
                        <Input
                          placeholder="如：立项阶段"
                          value={stage.name}
                          onChange={(e) => updateStage(stage.id, { name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>阶段说明</Label>
                        <Input
                          placeholder="可选"
                          value={stage.description}
                          onChange={(e) => updateStage(stage.id, { description: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={stage.required}
                          onCheckedChange={(checked) => updateStage(stage.id, { required: checked })}
                        />
                        <span className="text-sm text-muted-foreground">必经</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleStageExpand(stage.id)}
                        className="h-8 w-8 p-0"
                      >
                        {stage.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteStage(stage.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Work Items */}
                  {stage.expanded && (
                    <div className="ml-8 space-y-3 border-l-2 border-border pl-6">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">工作项列表</Label>
                        <Button
                          onClick={() => openWorkItemDialog(stage.id)}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                        >
                          <Library className="w-3 h-3" />
                          从工作项库选择
                        </Button>
                      </div>

                      {stage.workItems.map((workItem, workIndex) => (
                        <div key={workItem.id} className="bg-muted/30 rounded-lg p-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <GripVertical className="w-4 h-4 text-muted-foreground mt-2 cursor-move" />
                            <div className="flex-1 space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                  <Label className="text-xs">工作项名称</Label>
                                  <Input
                                    placeholder="如：制版准备"
                                    value={workItem.name}
                                    onChange={(e) => updateWorkItem(stage.id, workItem.id, { name: e.target.value })}
                                    className="h-9"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">工作项类型</Label>
                                  <Select
                                    value={workItem.type}
                                    onValueChange={(value: "execution" | "decision") =>
                                      updateWorkItem(stage.id, workItem.id, { type: value })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="execution">执行类</SelectItem>
                                      <SelectItem value="decision">决策类</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex items-center gap-2 mt-6">
                                  <Switch
                                    checked={workItem.required}
                                    onCheckedChange={(checked) =>
                                      updateWorkItem(stage.id, workItem.id, { required: checked })
                                    }
                                  />
                                  <Label className="text-xs">必做</Label>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">执行角色</Label>
                                <div className="flex flex-wrap gap-2">
                                  {["设计", "版师", "采购", "商品", "打样", "测款"].map((role) => (
                                    <Badge
                                      key={role}
                                      variant={workItem.roles.includes(role) ? "default" : "outline"}
                                      className="cursor-pointer"
                                      onClick={() => {
                                        const newRoles = workItem.roles.includes(role)
                                          ? workItem.roles.filter((r) => r !== role)
                                          : [...workItem.roles, role]
                                        updateWorkItem(stage.id, workItem.id, { roles: newRoles })
                                      }}
                                    >
                                      {role}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">关联字段模型</Label>
                                <div className="flex flex-wrap gap-2">
                                  {["制版/BOM", "纸样", "标准工艺", "花型/调色"].map((model) => (
                                    <Badge
                                      key={model}
                                      variant={workItem.fieldModels.includes(model) ? "default" : "outline"}
                                      className="cursor-pointer"
                                      onClick={() => {
                                        const newModels = workItem.fieldModels.includes(model)
                                          ? workItem.fieldModels.filter((m) => m !== model)
                                          : [...workItem.fieldModels, model]
                                        updateWorkItem(stage.id, workItem.id, { fieldModels: newModels })
                                      }}
                                    >
                                      {model}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteWorkItem(stage.id, workItem.id)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      {stage.workItems.length === 0 && (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                          暂无工作项，点击上方按钮添加
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>

          {/* Fixed Bottom Bar */}
          <div className="fixed bottom-0 left-64 right-0 bg-card border-t border-border p-4 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={handleCancel}>
              取消
            </Button>
            <Button onClick={handleSubmit}>创建模板</Button>
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
            <AlertDialogAction onClick={() => router.push("/templates")}>确定取消</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Work Item Library Dialog */}
      <Dialog open={workItemDialogOpen} onOpenChange={setWorkItemDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>从工作项库选择</DialogTitle>
            <DialogDescription>选择需要添加到当前阶段的工作项（可多选）</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {workItemLibrary.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 cursor-pointer"
                onClick={() => {
                  setSelectedWorkItemIds((prev) =>
                    prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id],
                  )
                }}
              >
                <Checkbox checked={selectedWorkItemIds.includes(item.id)} className="mt-1" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.name}</span>
                    <Badge variant={item.type === "execution" ? "default" : "secondary"} className="text-xs">
                      {item.type === "execution" ? "执行类" : "决策类"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-muted-foreground">执行角色：</span>
                    {item.roles.map((role) => (
                      <Badge key={role} variant="outline" className="text-xs">
                        {role}
                      </Badge>
                    ))}
                  </div>
                  {item.fieldModels.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs text-muted-foreground">字段模型：</span>
                      {item.fieldModels.map((model) => (
                        <Badge key={model} variant="outline" className="text-xs">
                          {model}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkItemDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAddWorkItemsFromLibrary} disabled={selectedWorkItemIds.length === 0}>
              添加 {selectedWorkItemIds.length > 0 && `(${selectedWorkItemIds.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
