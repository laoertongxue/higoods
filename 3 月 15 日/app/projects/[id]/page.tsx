"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { getProjectData } from "@/lib/mock-project-data"
import {
  FileText,
  Link2,
  Paperclip,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Clock,
  AlertCircle,
  Lock,
  MoreHorizontal,
  PlayCircle,
  XCircle,
} from "lucide-react"

export default function ProductProjectDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const projectData = getProjectData(params.id as string)

  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>("wi_01")
  const [expandedPhases, setExpandedPhases] = useState<string[]>([
    "phase_01",
    "phase_02",
    "phase_03",
    "phase_04",
    "phase_05",
  ])
  const [showDecisionDialog, setShowDecisionDialog] = useState(false)
  const [decisionValue, setDecisionValue] = useState("")
  const [decisionNote, setDecisionNote] = useState("")

  if (!projectData) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SystemNav />
        <div className="flex flex-1">
          <SidebarNav />
          <div className="flex-1 p-6">
            <Card className="p-6">
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-lg font-semibold mb-2">项目未找到</h2>
                <p className="text-muted-foreground mb-4">请确认项目ID是否正确</p>
                <Button onClick={() => router.push("/")}>返回项目列表</Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  const { project, phases, workItems, logs } = projectData

  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => (prev.includes(phaseId) ? prev.filter((id) => id !== phaseId) : [...prev, phaseId]))
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "已完成":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "进行中":
        return <PlayCircle className="h-4 w-4 text-blue-500" />
      case "待决策":
        return <AlertCircle className="h-4 w-4 text-orange-500" />
      case "未解锁":
        return <Lock className="h-4 w-4 text-gray-400" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "已完成":
        return "bg-green-500"
      case "进行中":
        return "bg-blue-500"
      case "待决策":
        return "bg-orange-500"
      case "未解锁":
        return "bg-gray-300 text-gray-600"
      default:
        return "bg-gray-400"
    }
  }

  const selectedWorkItem = selectedWorkItemId ? workItems[selectedWorkItemId as keyof typeof workItems] : null

  const getPhaseStats = (phaseItems: string[]) => {
    const items = phaseItems.map((id) => workItems[id as keyof typeof workItems]).filter(Boolean)
    const completed = items.filter((item) => item.status === "已完成").length
    const hasDecision = items.some((item) => item.status === "待决策")
    const hasBlocked = items.some((item) => item.status === "未解锁")
    return { total: items.length, completed, hasDecision, hasBlocked }
  }

  // Check if there's a pending decision in current phase
  const currentPhase = phases.find((p) => p.id === project.currentPhaseId)
  const hasPendingDecision = currentPhase?.items.some((id) => {
    const item = workItems[id as keyof typeof workItems]
    return item?.status === "待决策"
  })

  const handleDecisionSubmit = () => {
    setShowDecisionDialog(false)
    alert(`决策已提交：${decisionValue}`)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />

      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Project Header */}
          <div className="p-6 pb-0 flex-shrink-0">
            <Card className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-2xl font-bold">{project.name}</h1>
                      <Badge variant="outline">{project.code}</Badge>
                      <Badge className="bg-blue-500 text-white">{project.status}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{project.category}</span>
                      <span>·</span>
                      <span>{project.styleType}</span>
                      <span>·</span>
                      <span>{project.tags.join("、")}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-sm">
                    <div className="text-muted-foreground">负责人</div>
                    <div className="font-medium">{project.owner}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-muted-foreground">当前阶段</div>
                    <div className="font-medium">{currentPhase?.name}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-muted-foreground">最后更新</div>
                    <div className="font-medium">{project.lastUpdated}</div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Three Column Layout */}
          <div className="flex-1 flex gap-6 p-6 overflow-hidden">
            {/* Left: Stage Navigator */}
            <div className="w-80 flex-shrink-0 overflow-y-auto">
              <Card className="p-4">
                <h3 className="font-semibold mb-4">阶段与工作项</h3>
                <div className="space-y-2">
                  {phases.map((phase) => {
                    const stats = getPhaseStats(phase.items)
                    const isExpanded = expandedPhases.includes(phase.id)
                    const isCurrent = phase.id === project.currentPhaseId

                    return (
                      <div key={phase.id} className="border rounded-lg overflow-hidden">
                        <button
                          className={`w-full p-3 flex items-center justify-between text-left hover:bg-muted/50 transition-colors ${
                            isCurrent ? "bg-primary/5 border-l-4 border-l-primary" : ""
                          }`}
                          onClick={() => togglePhase(phase.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
                                stats.completed === stats.total
                                  ? "bg-green-500 text-white"
                                  : isCurrent
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {phase.no}
                            </div>
                            <div>
                              <div className="font-medium text-sm">{phase.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {stats.completed}/{stats.total} 完成
                                {stats.hasDecision && <span className="ml-2 text-orange-500">· 待决策</span>}
                              </div>
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="border-t bg-muted/30">
                            {phase.items.map((itemId) => {
                              const item = workItems[itemId as keyof typeof workItems]
                              if (!item) return null
                              const isSelected = selectedWorkItemId === item.id

                              return (
                                <button
                                  key={item.id}
                                  className={`w-full p-3 pl-12 flex items-center gap-3 text-left hover:bg-muted/50 transition-colors ${
                                    isSelected ? "bg-primary/10" : ""
                                  }`}
                                  onClick={() => setSelectedWorkItemId(item.id)}
                                >
                                  {getStatusIcon(item.status)}
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">{item.name}</div>
                                    <div className="text-xs text-muted-foreground">{item.owner}</div>
                                  </div>
                                  {item.nature === "决策类" && (
                                    <Badge variant="outline" className="text-xs flex-shrink-0">
                                      决策
                                    </Badge>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Card>
            </div>

            {/* Center: Work Item Summary Panel */}
            <div className="flex-1 overflow-y-auto">
              {selectedWorkItem ? (
                <Card className="p-6">
                  {/* Work Item Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-xl font-semibold">{selectedWorkItem.name}</h2>
                        <Badge variant="outline">{selectedWorkItem.nature}</Badge>
                        <Badge className={`${getStatusColor(selectedWorkItem.status)} text-white`}>
                          {selectedWorkItem.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>负责人：{selectedWorkItem.owner}</span>
                        <span>·</span>
                        <span>更新：{selectedWorkItem.updatedAt}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedWorkItem.status === "未解锁" ? (
                        <Button disabled variant="outline" size="sm">
                          <Lock className="h-4 w-4 mr-2" />
                          等待解锁
                        </Button>
                      ) : (
                        <Link href={`/projects/${params.id}/work-items/${selectedWorkItem.id}`}>
                          <Button size="sm">
                            查看全部
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Locked State Hint */}
                  {selectedWorkItem.status === "未解锁" && (
                    <div className="bg-muted/50 border rounded-lg p-4 mb-6">
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Lock className="h-5 w-5" />
                        <span>等待测款结论判定通过后解锁</span>
                      </div>
                    </div>
                  )}

                  {/* Key Outputs */}
                  {selectedWorkItem.status !== "未解锁" && (
                    <>
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-muted-foreground mb-3">关键产出</h3>
                        <div className="grid grid-cols-3 gap-4">
                          {selectedWorkItem.summary.keyOutputs.map((output, idx) => (
                            <div key={idx} className="bg-muted/30 rounded-lg p-4">
                              <div className="text-xs text-muted-foreground mb-1">{output.label}</div>
                              <div className="text-sm font-semibold">{output.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Evidence Counters */}
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-muted-foreground mb-3">关键证据</h3>
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <Paperclip className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{selectedWorkItem.summary.evidence?.attachments || 0} 附件</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{selectedWorkItem.summary.evidence?.links || 0} 链接</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{selectedWorkItem.summary.evidence?.records || 0} 记录</span>
                          </div>
                        </div>
                      </div>

                      {/* Multi-Instance KPIs */}
                      {selectedWorkItem.multiInstance && (
                        <div className="mb-6">
                          <h3 className="text-sm font-semibold text-muted-foreground mb-3">汇总指标</h3>
                          <div className="grid grid-cols-4 gap-4">
                            {selectedWorkItem.multiInstance.kpis.map((kpi, idx) => (
                              <div
                                key={idx}
                                className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center"
                              >
                                <div className="text-lg font-bold text-primary">{kpi.value}</div>
                                <div className="text-xs text-muted-foreground">{kpi.label}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Latest Records */}
                      {selectedWorkItem.summary.latestRecords && selectedWorkItem.summary.latestRecords.length > 0 && (
                        <div className="mb-6">
                          <h3 className="text-sm font-semibold text-muted-foreground mb-3">最近记录</h3>
                          <div className="space-y-2">
                            {selectedWorkItem.summary.latestRecords.slice(0, 3).map((record, idx) => (
                              <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                <div>
                                  <div className="font-medium text-sm">{record.title}</div>
                                  <div className="text-xs text-muted-foreground">{record.meta}</div>
                                </div>
                                <div className="text-xs text-muted-foreground">{record.time}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Multi-Instance Records */}
                      {selectedWorkItem.multiInstance && (
                        <div className="mb-6">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-muted-foreground">实例记录</h3>
                            {selectedWorkItem.status === "进行中" && (
                              <Button size="sm" variant="outline">
                                新增记录
                              </Button>
                            )}
                          </div>
                          <div className="space-y-2">
                            {selectedWorkItem.multiInstance.records.map((record) => (
                              <div key={record.id} className="border rounded-lg p-4">
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <div className="font-medium">{record.title}</div>
                                    <div className="text-sm text-muted-foreground">{record.sub}</div>
                                  </div>
                                  <div className="text-xs text-muted-foreground">{record.time}</div>
                                </div>
                                <div className="text-sm text-muted-foreground">{record.metrics}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-3 pt-4 border-t">
                        {selectedWorkItem.status === "待决策" && (
                          <Button
                            className="bg-orange-500 hover:bg-orange-600"
                            onClick={() => setShowDecisionDialog(true)}
                          >
                            <AlertCircle className="h-4 w-4 mr-2" />
                            做出决策
                          </Button>
                        )}
                        {selectedWorkItem.status === "进行中" && (
                          <>
                            {selectedWorkItem.isMultiInstance && <Button variant="outline">新增记录</Button>}
                            <Button className="bg-green-600 hover:bg-green-700">
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              标记完成
                            </Button>
                          </>
                        )}
                        <Link href={`/projects/${params.id}/work-items/${selectedWorkItem.id}`}>
                          <Button variant="outline">
                            查看全部
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </>
                  )}
                </Card>
              ) : (
                <Card className="p-6">
                  <div className="text-center py-8 text-muted-foreground">请从左侧选择一个工作项查看详情</div>
                </Card>
              )}
            </div>

            {/* Right: Project Timeline */}
            <div className="w-80 flex-shrink-0 overflow-y-auto">
              <Card className="p-4">
                <h3 className="font-semibold mb-4">项目日志</h3>
                <div className="space-y-4">
                  {logs.slice(0, 10).map((log, idx) => (
                    <div key={idx} className="relative pl-4 border-l-2 border-muted pb-4 last:pb-0">
                      <div
                        className={`absolute left-[-5px] top-0 w-2 h-2 rounded-full ${
                          log.type === "决策" ? "bg-orange-500" : log.type === "工作项" ? "bg-green-500" : "bg-blue-500"
                        }`}
                      />
                      <div className="text-xs text-muted-foreground mb-1">{log.time}</div>
                      <div className="text-sm font-medium">{log.title}</div>
                      <div className="text-xs text-muted-foreground">{log.detail}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {/* Bottom: Stage Gate Bar */}
          {hasPendingDecision && (
            <div className="flex-shrink-0 p-6 pt-0">
              <Card className="p-4 bg-orange-50 border-orange-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-orange-500" />
                    <div>
                      <div className="font-semibold text-orange-800">阶段推进待决策</div>
                      <div className="text-sm text-orange-600">
                        "测款结论判定"待决策，通过后将解锁工程准备相关工作项
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      className="border-orange-300 text-orange-700 hover:bg-orange-100 bg-transparent"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      不通过 - 项目终止
                    </Button>
                    <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => setShowDecisionDialog(true)}>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      通过 - 推进至工程准备
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Decision Dialog */}
      <Dialog open={showDecisionDialog} onOpenChange={setShowDecisionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>测款结论判定</DialogTitle>
            <DialogDescription>请根据测款数据做出决策，选择结论后将影响后续工作项的解锁状态。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <RadioGroup value={decisionValue} onValueChange={setDecisionValue}>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                <RadioGroupItem value="pass" id="pass" />
                <Label htmlFor="pass" className="flex-1 cursor-pointer">
                  <div className="font-medium">通过</div>
                  <div className="text-sm text-muted-foreground">解锁工程准备（转档、制版、打样）</div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                <RadioGroupItem value="revision" id="revision" />
                <Label htmlFor="revision" className="flex-1 cursor-pointer">
                  <div className="font-medium">改版</div>
                  <div className="text-sm text-muted-foreground">生成改版任务（腰线调整），改版后重新测款</div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                <RadioGroupItem value="reject" id="reject" />
                <Label htmlFor="reject" className="flex-1 cursor-pointer">
                  <div className="font-medium">淘汰</div>
                  <div className="text-sm text-muted-foreground">终止项目，样衣进入退货处理</div>
                </Label>
              </div>
            </RadioGroup>
            <div className="space-y-2">
              <Label>决策备注</Label>
              <Textarea
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                placeholder="请输入决策说明..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDecisionDialog(false)}>
              取消
            </Button>
            <Button onClick={handleDecisionSubmit} disabled={!decisionValue}>
              提交决策
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
