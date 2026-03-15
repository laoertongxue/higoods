"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { getProjectData, getWorkItemInstance } from "@/lib/mock-project-data"
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Link2,
  Download,
  Paperclip,
  ExternalLink,
  Plus,
  AlertCircle,
  Lock,
} from "lucide-react"

export default function WorkItemInstanceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [activeTab, setActiveTab] = useState("full-info")
  const [showDecisionDialog, setShowDecisionDialog] = useState(false)
  const [showRecordDialog, setShowRecordDialog] = useState(false)
  const [decisionValue, setDecisionValue] = useState("")
  const [decisionNote, setDecisionNote] = useState("")

  const projectData = getProjectData(params.id as string)
  const workItem = getWorkItemInstance(params.id as string, params.workItemId as string)

  if (!projectData || !workItem) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SystemNav />
        <div className="flex flex-1">
          <SidebarNav />
          <div className="flex-1 p-6">
            <Card className="p-6">
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-lg font-semibold mb-2">工作项未找到</h2>
                <p className="text-muted-foreground mb-4">请确认工作项ID是否正确</p>
                <Button onClick={() => router.push(`/projects/${params.id}`)}>返回项目详情</Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  const { project } = projectData

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

  const handleDecisionSubmit = () => {
    setShowDecisionDialog(false)
    alert(`决策已提交：${decisionValue}`)
    router.push(`/projects/${params.id}`)
  }

  const handleComplete = () => {
    alert("工作项已标记完成")
    router.push(`/projects/${params.id}`)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />

      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header Card */}
          <div className="p-6 pb-0 flex-shrink-0">
            <Card className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <Button variant="ghost" size="sm" onClick={() => router.push(`/projects/${params.id}`)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    返回项目
                  </Button>
                  <div className="border-l h-16" />
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Link href={`/projects/${params.id}`} className="text-sm text-muted-foreground hover:underline">
                        {project.code}
                      </Link>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-sm text-muted-foreground">{project.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-xl font-bold">{workItem.name}</h1>
                      <Badge variant="outline">{workItem.nature}</Badge>
                      <Badge className={`${getStatusColor(workItem.status)} text-white`}>{workItem.status}</Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span>负责人：{workItem.owner}</span>
                      <span>更新时间：{workItem.updatedAt}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {workItem.status === "待决策" && (
                    <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => setShowDecisionDialog(true)}>
                      <AlertCircle className="h-4 w-4 mr-2" />
                      做出决策
                    </Button>
                  )}
                  {workItem.status === "进行中" && (
                    <>
                      {workItem.isMultiInstance && (
                        <Button variant="outline" onClick={() => setShowRecordDialog(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          新增记录
                        </Button>
                      )}
                      <Button className="bg-green-600 hover:bg-green-700" onClick={handleComplete}>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        标记完成
                      </Button>
                    </>
                  )}
                  {workItem.status === "未解锁" && (
                    <Button disabled variant="outline">
                      <Lock className="h-4 w-4 mr-2" />
                      等待解锁
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Tabs */}
          <div className="flex-1 overflow-hidden p-6 pt-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="w-full justify-start flex-shrink-0">
                <TabsTrigger value="full-info">全量信息</TabsTrigger>
                <TabsTrigger value="records">
                  记录
                  {workItem.full.records && workItem.full.records.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {workItem.full.records.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="attachments">
                  附件与引用
                  <Badge variant="secondary" className="ml-2">
                    {(workItem.full.attachments?.length || 0) + (workItem.full.links?.length || 0)}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="audit">
                  操作日志
                  <Badge variant="secondary" className="ml-2">
                    {workItem.full.audit?.length || 0}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto mt-4">
                {/* Tab 1: Full Info */}
                <TabsContent value="full-info" className="mt-0 space-y-4">
                  {workItem.status === "未解锁" ? (
                    <Card className="p-6">
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Lock className="h-5 w-5" />
                        <span>等待测款结论判定通过后解锁</span>
                      </div>
                    </Card>
                  ) : workItem.full.sections && workItem.full.sections.length > 0 ? (
                    workItem.full.sections.map((section: any, idx: number) => (
                      <Card key={idx} className="p-6">
                        <h3 className="font-semibold text-lg mb-4">{section.title}</h3>
                        {section.fields && (
                          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                            {section.fields.map((field: any, fieldIdx: number) => (
                              <div key={fieldIdx} className="space-y-1">
                                <div className="text-sm text-muted-foreground">{field.k}</div>
                                <div className="text-sm font-medium">{field.v}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {section.type === "table" && section.columns && section.rows && (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {section.columns.map((col: string, colIdx: number) => (
                                  <TableHead key={colIdx}>{col}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {section.rows.map((row: string[], rowIdx: number) => (
                                <TableRow key={rowIdx}>
                                  {row.map((cell: string, cellIdx: number) => (
                                    <TableCell key={cellIdx}>{cell}</TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </Card>
                    ))
                  ) : (
                    <Card className="p-6">
                      <div className="text-center py-8 text-muted-foreground">暂无信息</div>
                    </Card>
                  )}
                </TabsContent>

                {/* Tab 2: Records */}
                <TabsContent value="records" className="mt-0">
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-lg">执行记录</h3>
                      {workItem.status === "进行中" && workItem.isMultiInstance && (
                        <Button size="sm" onClick={() => setShowRecordDialog(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          新增记录
                        </Button>
                      )}
                    </div>
                    {workItem.full.records && workItem.full.records.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {Object.keys(workItem.full.records[0].cols).map((key) => (
                              <TableHead key={key}>{key}</TableHead>
                            ))}
                            <TableHead>时间</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {workItem.full.records.map((record: any) => (
                            <TableRow key={record.id}>
                              {Object.values(record.cols).map((val: any, idx: number) => (
                                <TableCell key={idx}>{val as string}</TableCell>
                              ))}
                              <TableCell className="text-muted-foreground text-sm">{record.time}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">暂无记录</div>
                    )}
                  </Card>
                </TabsContent>

                {/* Tab 3: Attachments */}
                <TabsContent value="attachments" className="mt-0 space-y-4">
                  {workItem.full.attachments && workItem.full.attachments.length > 0 && (
                    <Card className="p-6">
                      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                        <Paperclip className="h-5 w-5" />
                        附件 ({workItem.full.attachments.length})
                      </h3>
                      <div className="space-y-2">
                        {workItem.full.attachments.map((att: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <div className="font-medium text-sm">{att.name}</div>
                                <div className="text-xs text-muted-foreground">{att.time}</div>
                              </div>
                            </div>
                            <Button size="sm" variant="ghost">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {workItem.full.links && workItem.full.links.length > 0 && (
                    <Card className="p-6">
                      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                        <Link2 className="h-5 w-5" />
                        外部链接 ({workItem.full.links.length})
                      </h3>
                      <div className="space-y-2">
                        {workItem.full.links.map((link: any, idx: number) => (
                          <a
                            key={idx}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <ExternalLink className="h-5 w-5 text-muted-foreground" />
                              <span className="font-medium text-sm">{link.name}</span>
                            </div>
                            <span className="text-xs text-muted-foreground truncate max-w-xs">{link.url}</span>
                          </a>
                        ))}
                      </div>
                    </Card>
                  )}

                  {(!workItem.full.attachments || workItem.full.attachments.length === 0) &&
                    (!workItem.full.links || workItem.full.links.length === 0) && (
                      <Card className="p-6">
                        <div className="text-center py-8 text-muted-foreground">暂无附件或链接</div>
                      </Card>
                    )}
                </TabsContent>

                {/* Tab 4: Audit Log */}
                <TabsContent value="audit" className="mt-0">
                  <Card className="p-6">
                    <h3 className="font-semibold text-lg mb-4">操作日志</h3>
                    {workItem.full.audit && workItem.full.audit.length > 0 ? (
                      <div className="space-y-4">
                        {workItem.full.audit.map((log: any, idx: number) => (
                          <div key={idx} className="relative pl-4 border-l-2 border-muted pb-4 last:pb-0">
                            <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-primary" />
                            <div className="text-xs text-muted-foreground mb-1">{log.time}</div>
                            <div className="text-sm font-medium">
                              {log.by} · {log.action}
                            </div>
                            {log.note && <div className="text-sm text-muted-foreground">{log.note}</div>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">暂无操作日志</div>
                    )}
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Decision Dialog */}
      <Dialog open={showDecisionDialog} onOpenChange={setShowDecisionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>做出决策</DialogTitle>
            <DialogDescription>请选择决策结论并填写备注说明。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <RadioGroup value={decisionValue} onValueChange={setDecisionValue}>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                <RadioGroupItem value="pass" id="pass" />
                <Label htmlFor="pass" className="flex-1 cursor-pointer">
                  <div className="font-medium">通过</div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                <RadioGroupItem value="revision" id="revision" />
                <Label htmlFor="revision" className="flex-1 cursor-pointer">
                  <div className="font-medium">改版</div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                <RadioGroupItem value="reject" id="reject" />
                <Label htmlFor="reject" className="flex-1 cursor-pointer">
                  <div className="font-medium">不通过</div>
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

      {/* Record Dialog */}
      <Dialog open={showRecordDialog} onOpenChange={setShowRecordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增记录</DialogTitle>
            <DialogDescription>请填写新的执行记录信息。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>记录内容</Label>
              <Textarea placeholder="请输入记录内容..." rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecordDialog(false)}>
              取消
            </Button>
            <Button onClick={() => setShowRecordDialog(false)}>保存记录</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
