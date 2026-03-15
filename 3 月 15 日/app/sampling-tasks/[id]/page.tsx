"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  ArrowLeft,
  AlertTriangle,
  User,
  Package,
  FileText,
  Link2,
  Clock,
  CheckCircle2,
  Edit,
  Save,
  ExternalLink,
  Plus,
  ChevronDown,
  XCircle,
  PlayCircle,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"

// 模拟打样任务数据 - 根据状态返回不同数据
const getSamplingTaskData = (id: string) => {
  const tasks: Record<string, any> = {
    "ST-001": {
      id: "ST-001",
      projectId: "PRJ-20251220-001",
      projectName: "印尼风格碎花连衣裙",
      triggerWorkItem: { id: "WI-INST-003", name: "外采样品采购", type: "execute" },
      samplingType: "新版打样",
      isUrgent: true,
      status: "进行中",
      blockingMainFlow: true,
      patternMethod: "新版",
      patternNotes: "基于外采样品进行版型调整，需要修改腰线位置和裙摆长度",
      fabricRequirements: "雪纺面料，克重120g/㎡，成分100%涤纶，需要过水测试",
      craftRequirements: "包边工艺，隐形拉链，腰部松紧带设计",
      referenceSamples: [{ id: "SPL-001", name: "外采碎花裙样品", image: "/dress-sample-1.jpg" }],
      responsibleTeam: "深圳打样组",
      owner: "李版师",
      plannedFinishDate: "2025-12-25",
      actualFinishDate: null,
      outputSamples: [
        {
          id: "SPL-002",
          name: "首版样衣",
          status: "待评估",
          createdAt: "2025-12-22",
          image: "/floral-pattern-dress-reference.jpg",
        },
      ],
      relatedDecisions: [
        {
          id: "DEC-001",
          type: "初步可行性判断",
          result: "通过",
          workItem: "WI-INST-002",
          timestamp: "2025-12-18 14:30",
        },
      ],
      logs: [
        { id: 1, action: "更新制版备注", user: "李版师", time: "2025-12-22 16:30", detail: "添加腰线调整说明" },
        { id: 2, action: "上传参考图片", user: "李版师", time: "2025-12-21 10:00", detail: "上传了3张参考图" },
        { id: 3, action: "创建任务", user: "系统", time: "2025-12-20 10:00", detail: "由外采样品采购工作项触发创建" },
      ],
      createdAt: "2025-12-20 10:00",
      updatedAt: "2025-12-22 16:30",
    },
    "ST-002": {
      id: "ST-002",
      projectId: "PRJ-20251220-002",
      projectName: "基础白色T恤",
      triggerWorkItem: { id: "WI-INST-010", name: "制版准备", type: "execute" },
      samplingType: "调整打样",
      isUrgent: false,
      status: "待开始",
      blockingMainFlow: false,
      patternMethod: "调整",
      patternNotes: "基于现有版型微调袖口和领口尺寸",
      fabricRequirements: "纯棉面料，克重180g/㎡",
      craftRequirements: "标准T恤工艺",
      referenceSamples: [],
      responsibleTeam: "深圳打样组",
      owner: "王版师",
      plannedFinishDate: "2025-12-26",
      actualFinishDate: null,
      outputSamples: [],
      relatedDecisions: [],
      logs: [{ id: 1, action: "创建任务", user: "系统", time: "2025-12-19 09:00", detail: "由制版准备工作项触发创建" }],
      createdAt: "2025-12-19 09:00",
      updatedAt: "2025-12-19 09:00",
    },
    "ST-003": {
      id: "ST-003",
      projectId: "PRJ-20251220-003",
      projectName: "夏季牛仔短裤",
      triggerWorkItem: { id: "WI-INST-007", name: "首单样衣打样", type: "execute" },
      samplingType: "复制打样",
      isUrgent: false,
      status: "已完成",
      blockingMainFlow: false,
      patternMethod: "复制",
      patternNotes: "完全复制现有版型",
      fabricRequirements: "牛仔面料，10oz",
      craftRequirements: "标准牛仔工艺，铆钉装饰",
      referenceSamples: [{ id: "SPL-REF-001", name: "原版短裤", image: "/denim-shorts-sample.jpg" }],
      responsibleTeam: "印尼打样组",
      owner: "张版师",
      plannedFinishDate: "2025-12-24",
      actualFinishDate: "2025-12-23",
      outputSamples: [
        {
          id: "SPL-003",
          name: "工程样衣A",
          status: "在库",
          createdAt: "2025-12-23",
          image: "/denim-shorts-sample.jpg",
        },
        {
          id: "SPL-003-B",
          name: "工程样衣B",
          status: "在库",
          createdAt: "2025-12-23",
          image: "/denim-shorts-sample.jpg",
        },
      ],
      relatedDecisions: [
        {
          id: "DEC-002",
          type: "样衣质检",
          result: "通过",
          workItem: "WI-INST-008",
          timestamp: "2025-12-23 16:00",
        },
      ],
      logs: [
        { id: 1, action: "标记完成", user: "张版师", time: "2025-12-23 16:30", detail: "打样任务完成" },
        { id: 2, action: "添加样衣", user: "张版师", time: "2025-12-23 14:00", detail: "添加了2件工程样衣" },
        { id: 3, action: "开始执行", user: "张版师", time: "2025-12-20 09:00", detail: "开始打样" },
        { id: 4, action: "创建任务", user: "系统", time: "2025-12-18 10:00", detail: "由首单样衣打样工作项触发创建" },
      ],
      createdAt: "2025-12-18 10:00",
      updatedAt: "2025-12-23 16:30",
    },
    "ST-004": {
      id: "ST-004",
      projectId: "PRJ-20251220-004",
      projectName: "复古皮夹克",
      triggerWorkItem: { id: "WI-INST-003", name: "外采样品采购", type: "execute" },
      samplingType: "新版打样",
      isUrgent: false,
      status: "已取消",
      blockingMainFlow: false,
      patternMethod: "新版",
      patternNotes: "项目已终止，取消打样",
      fabricRequirements: "PU皮革",
      craftRequirements: "皮衣工艺",
      referenceSamples: [],
      responsibleTeam: "深圳打样组",
      owner: "陈版师",
      plannedFinishDate: "2025-12-28",
      actualFinishDate: null,
      cancelReason: "项目可行性评估未通过，成本过高",
      outputSamples: [],
      relatedDecisions: [
        {
          id: "DEC-003",
          type: "初步可行性判断",
          result: "不通过",
          workItem: "WI-INST-002",
          timestamp: "2025-12-17 15:00",
        },
      ],
      logs: [
        { id: 1, action: "取消任务", user: "陈版师", time: "2025-12-17 16:00", detail: "项目可行性评估未通过" },
        { id: 2, action: "创建任务", user: "系统", time: "2025-12-17 10:00", detail: "由外采样品采购工作项触发创建" },
      ],
      createdAt: "2025-12-17 10:00",
      updatedAt: "2025-12-17 16:00",
    },
  }
  return tasks[id] || null
}

export default function SamplingTaskDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [id, setId] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [showLogPanel, setShowLogPanel] = useState(true)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showAddSampleDialog, setShowAddSampleDialog] = useState(false)
  const [cancelReason, setCancelReason] = useState("")

  useEffect(() => {
    if (params.id) {
      setId(params.id as string)
    }
  }, [params])

  const task = getSamplingTaskData(id)

  if (!task) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SystemNav />
        <div className="flex flex-1 overflow-hidden">
          <SidebarNav />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="text-center py-12">
              <p className="text-muted-foreground">未找到打样任务 {id}</p>
              <Button variant="link" onClick={() => router.back()}>
                返回列表
              </Button>
            </div>
          </main>
        </div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      待开始: "bg-gray-500/20 text-gray-400 border-gray-500/30",
      进行中: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      已完成: "bg-green-500/20 text-green-400 border-green-500/30",
      已取消: "bg-red-500/20 text-red-400 border-red-500/30",
    }
    return colors[status] || "bg-gray-500/20 text-gray-400 border-gray-500/30"
  }

  // 根据状态渲染不同的操作按钮
  const renderActionButtons = () => {
    switch (task.status) {
      case "待开始":
        return (
          <Button className="bg-blue-600 hover:bg-blue-700">
            <PlayCircle className="h-4 w-4 mr-2" />
            开始执行
          </Button>
        )
      case "进行中":
        return (
          <>
            <Button variant="outline" onClick={() => setShowAddSampleDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              添加样衣
            </Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => setShowCompleteDialog(true)}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              标记完成
            </Button>
          </>
        )
      case "已完成":
        return (
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle2 className="h-5 w-5" />
            <span>任务已完成</span>
          </div>
        )
      case "已取消":
        return (
          <div className="flex items-center gap-2 text-red-400">
            <XCircle className="h-5 w-5" />
            <span>任务已取消</span>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 顶部信息栏 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-semibold text-foreground">{task.id}</h1>
                  <Badge className={`${getStatusColor(task.status)} border`}>{task.status}</Badge>
                  {task.isUrgent && (
                    <Badge className="bg-red-500/20 text-red-400 border border-red-500/30">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      加急
                    </Badge>
                  )}
                  {task.blockingMainFlow && (
                    <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/30">阻塞主流程</Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-sm mt-1">
                  {task.samplingType} · {task.projectName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {task.status !== "已完成" && task.status !== "已取消" && (
                <>
                  {isEditing ? (
                    <>
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        取消
                      </Button>
                      <Button onClick={() => setIsEditing(false)}>
                        <Save className="h-4 w-4 mr-2" />
                        保存
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={() => setIsEditing(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      编辑
                    </Button>
                  )}
                </>
              )}
              {renderActionButtons()}
            </div>
          </div>

          {/* 已取消状态的提示 */}
          {task.status === "已取消" && task.cancelReason && (
            <Card className="bg-red-500/10 border-red-500/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-red-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-400">任务已取消</p>
                    <p className="text-sm text-muted-foreground mt-1">取消原因：{task.cancelReason}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-3 gap-6">
            {/* 左栏 - 基本信息 */}
            <div className="col-span-2 space-y-6">
              {/* 任务信息 */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    任务信息
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-sm">所属项目</Label>
                      <div>
                        <Link href={`/projects/${task.projectId}`} className="text-primary hover:underline">
                          {task.projectName}
                        </Link>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-sm">触发工作项</Label>
                      <div>
                        <Link
                          href={`/projects/${task.projectId}/work-items/${task.triggerWorkItem.id}`}
                          className="text-primary hover:underline"
                        >
                          {task.triggerWorkItem.name}
                        </Link>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-sm">打样类型</Label>
                      <div>
                        <Badge variant="secondary">{task.samplingType}</Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-sm">制版方式</Label>
                      <div>
                        <Badge variant="outline">{task.patternMethod}</Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-sm">执行团队</Label>
                      <div className="text-foreground">{task.responsibleTeam}</div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-sm">负责人</Label>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{task.owner}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-sm">计划完成时间</Label>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{task.plannedFinishDate}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-sm">实际完成时间</Label>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{task.actualFinishDate || "-"}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 工程要求 */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    工程要求
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm">制版备注</Label>
                    {isEditing ? (
                      <Textarea defaultValue={task.patternNotes} className="min-h-[80px]" />
                    ) : (
                      <p className="text-foreground bg-muted/30 p-3 rounded-md">{task.patternNotes}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm">面料要求</Label>
                    {isEditing ? (
                      <Textarea defaultValue={task.fabricRequirements} className="min-h-[80px]" />
                    ) : (
                      <p className="text-foreground bg-muted/30 p-3 rounded-md">{task.fabricRequirements}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm">工艺要求</Label>
                    {isEditing ? (
                      <Textarea defaultValue={task.craftRequirements} className="min-h-[80px]" />
                    ) : (
                      <p className="text-foreground bg-muted/30 p-3 rounded-md">{task.craftRequirements}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* 参考样衣 */}
              {task.referenceSamples.length > 0 && (
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      参考样衣
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4 flex-wrap">
                      {task.referenceSamples.map((sample: any) => (
                        <Link
                          key={sample.id}
                          href={`/samples/${sample.id}`}
                          className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <Image
                            src={sample.image || "/placeholder.svg"}
                            alt={sample.name}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded object-cover"
                          />
                          <div>
                            <p className="font-medium text-foreground">{sample.name}</p>
                            <p className="text-sm text-muted-foreground">{sample.id}</p>
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 产出样衣 */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      产出样衣
                      <Badge variant="secondary" className="ml-2">
                        {task.outputSamples.length}
                      </Badge>
                    </CardTitle>
                    {task.status === "进行中" && (
                      <Button variant="outline" size="sm" onClick={() => setShowAddSampleDialog(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        添加
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {task.outputSamples.length === 0 ? (
                    <p className="text-muted-foreground text-center py-6">暂无产出样衣</p>
                  ) : (
                    <div className="space-y-3">
                      {task.outputSamples.map((sample: any) => (
                        <Link
                          key={sample.id}
                          href={`/samples/${sample.id}`}
                          className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Image
                              src={sample.image || "/placeholder.svg"}
                              alt={sample.name}
                              width={48}
                              height={48}
                              className="w-12 h-12 rounded object-cover"
                            />
                            <div>
                              <p className="font-medium text-foreground">{sample.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {sample.id} · {sample.createdAt}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{sample.status}</Badge>
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 右栏 - 关联信息和日志 */}
            <div className="space-y-6">
              {/* 关联决策 */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base">关联决策</CardTitle>
                </CardHeader>
                <CardContent>
                  {task.relatedDecisions.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">暂无关联决策</p>
                  ) : (
                    <div className="space-y-3">
                      {task.relatedDecisions.map((decision: any) => (
                        <div key={decision.id} className="p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-foreground text-sm">{decision.type}</span>
                            <Badge
                              className={
                                decision.result === "通过"
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-red-500/20 text-red-400"
                              }
                            >
                              {decision.result}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{decision.timestamp}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 操作日志 */}
              <Card className="bg-card border-border">
                <Collapsible open={showLogPanel} onOpenChange={setShowLogPanel}>
                  <CardHeader className="pb-3">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between cursor-pointer">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          操作日志
                        </CardTitle>
                        <ChevronDown className={`h-4 w-4 transition-transform ${showLogPanel ? "rotate-180" : ""}`} />
                      </div>
                    </CollapsibleTrigger>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {task.logs.map((log: any) => (
                          <div key={log.id} className="flex gap-3 text-sm">
                            <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                            <div>
                              <p className="text-foreground">{log.action}</p>
                              <p className="text-muted-foreground text-xs">
                                {log.user} · {log.time}
                              </p>
                              {log.detail && <p className="text-muted-foreground text-xs mt-1">{log.detail}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* 完成确认对话框 */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认完成打样任务</DialogTitle>
            <DialogDescription>确认后任务将标记为已完成，请确保所有样衣已添加完毕。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              取消
            </Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => setShowCompleteDialog(false)}>
              确认完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 添加样衣对话框 */}
      <Dialog open={showAddSampleDialog} onOpenChange={setShowAddSampleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加产出样衣</DialogTitle>
            <DialogDescription>为此打样任务添加新的产出样衣</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>样衣名称</Label>
              <Input placeholder="输入样衣名称" />
            </div>
            <div className="space-y-2">
              <Label>样衣角色</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="选择样衣角色" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="首版样">首版样</SelectItem>
                  <SelectItem value="工程样">工程样</SelectItem>
                  <SelectItem value="产前样">产前样</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSampleDialog(false)}>
              取消
            </Button>
            <Button onClick={() => setShowAddSampleDialog(false)}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
