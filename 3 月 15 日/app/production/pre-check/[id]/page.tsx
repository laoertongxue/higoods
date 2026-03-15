"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowLeft,
  Truck,
  PackageCheck,
  Warehouse,
  Package,
  FileCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Lock,
  Unlock,
  ExternalLink,
  Download,
  FileText,
  ImageIcon,
  Link2,
  Play,
  Square,
} from "lucide-react"

// Mock详情数据
const mockDetail = {
  id: "PP-20260115-001",
  title: "产前版-碎花连衣裙",
  status: "COMPLETED",
  projectRef: "PRJ-20260105-001",
  projectName: "印尼风格碎花连衣裙",
  sourceType: "首单",
  sourceRef: "FS-20260109-005",
  factoryRef: "JKT-Factory-03",
  factoryName: "雅加达工厂03",
  targetSite: "雅加达",
  patternRef: "PT-20260112-004",
  patternVersion: "P2",
  patternFrozenAt: "2026-01-12 18:00",
  patternFrozenBy: "王版师",
  artworkRef: "AT-20260109-001",
  artworkVersion: "A1",
  artworkFrozenAt: "2026-01-09 16:30",
  artworkFrozenBy: "李设计师",
  expectedArrival: "2026-01-17",
  trackingNo: "JNE-99230018",
  shippedAt: "2026-01-15 10:00",
  arrivedAt: "2026-01-18 14:10",
  stockedInAt: "2026-01-18 16:00",
  sampleRef: "SY-JKT-00045",
  sampleName: "碎花连衣裙-产前版",
  warehouse: "JKT-WH-01",
  location: "B-02-15",
  preprodResult: "PASS",
  gateStatus: "MET",
  gateConfirmedBy: "张经理",
  gateConfirmedAt: "2026-01-18 17:00",
  owner: "王版师",
  participants: ["李版师", "陈仓管"],
  createdAt: "2026-01-15 09:00",
  updatedAt: "2026-01-18 17:00",
  completedAt: "2026-01-18 17:00",
  requirements: "使用确认的面料批次，注意花型对位精度，腰部收省位置按P2版修正",
  receiptEventId: "EVT-20260118-001",
  stockinEventId: "EVT-20260118-002",
  // 验收清单
  checklist: [
    { item: "色差△E", standard: "≤1.2", actual: "0.8", passed: true },
    { item: "定位偏移", standard: "≤0.4cm", actual: "0.3cm", passed: true },
    { item: "胸围误差", standard: "≤1cm", actual: "0.5cm", passed: true },
    { item: "腰围误差", standard: "≤1cm", actual: "0.8cm", passed: true },
    { item: "衣长误差", standard: "≤1cm", actual: "0.6cm", passed: true },
    { item: "缝制质量", standard: "无跳线/断线", actual: "合格", passed: true },
  ],
  issues: [],
  conclusionNote: "产前版样衣各项指标均符合量产标准，建议进入量产阶段",
  // 日志
  logs: [
    { time: "2026-01-18 17:00", action: "门禁确认通过", user: "张经理", detail: "允许进入量产阶段" },
    { time: "2026-01-18 16:30", action: "产前结论提交", user: "王版师", detail: "结论：通过（可量产）" },
    { time: "2026-01-18 16:00", action: "核对入库", user: "陈仓管", detail: "样衣编号：SY-JKT-00045，台账事件已写入" },
    { time: "2026-01-18 14:10", action: "到样签收", user: "陈仓管", detail: "运单：JNE-99230018，台账事件已写入" },
    { time: "2026-01-15 10:00", action: "录入运单", user: "王版师", detail: "运单号：JNE-99230018" },
    { time: "2026-01-15 09:00", action: "创建任务", user: "王版师", detail: "产前版样衣任务已创建" },
  ],
}

const STATUS = {
  NOT_STARTED: { label: "未开始", color: "bg-gray-100 text-gray-700" },
  IN_PROGRESS: { label: "进行中", color: "bg-blue-100 text-blue-700" },
  IN_TRANSIT: { label: "在途", color: "bg-yellow-100 text-yellow-700" },
  ARRIVED: { label: "已到样", color: "bg-orange-100 text-orange-700" },
  IN_QC: { label: "验收中", color: "bg-purple-100 text-purple-700" },
  COMPLETED: { label: "已完成", color: "bg-green-100 text-green-700" },
  BLOCKED: { label: "阻塞", color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "已取消", color: "bg-gray-100 text-gray-500" },
}

const PREPROD_RESULT = {
  PASS: { label: "通过", color: "bg-green-100 text-green-700" },
  FAIL: { label: "不通过", color: "bg-red-100 text-red-700" },
  NEED_RETRY: { label: "需补产前", color: "bg-orange-100 text-orange-700" },
  NEED_REVISION: { label: "需改版", color: "bg-yellow-100 text-yellow-700" },
}

export default function PreProductionSampleDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("overview")
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false)
  const [stockInDialogOpen, setStockInDialogOpen] = useState(false)
  const [conclusionDialogOpen, setConclusionDialogOpen] = useState(false)
  const [gateDialogOpen, setGateDialogOpen] = useState(false)

  const detail = mockDetail
  const statusInfo = STATUS[detail.status as keyof typeof STATUS]
  const resultInfo = detail.preprodResult ? PREPROD_RESULT[detail.preprodResult as keyof typeof PREPROD_RESULT] : null

  // 里程碑数据
  const milestones = [
    { label: "创建", time: detail.createdAt, done: true },
    { label: "发货", time: detail.shippedAt, done: !!detail.shippedAt },
    { label: "到样签收", time: detail.arrivedAt, done: !!detail.arrivedAt },
    { label: "核对入库", time: detail.stockedInAt, done: !!detail.stockedInAt },
    { label: "产前结论", time: detail.preprodResult ? detail.updatedAt : null, done: !!detail.preprodResult },
    { label: "门禁通过", time: detail.gateConfirmedAt, done: detail.gateStatus === "MET" },
  ]

  // 门禁条件
  const gateConditions = [
    { label: "已核对入库", met: !!detail.stockedInAt },
    { label: "产前结论已填写", met: !!detail.preprodResult },
    { label: "产前结论=通过", met: detail.preprodResult === "PASS" },
    { label: "版本已冻结", met: true },
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => router.back()}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  返回列表
                </Button>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold">{detail.id}</h1>
                    <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                    {resultInfo && <Badge className={resultInfo.color}>{resultInfo.label}</Badge>}
                    <Badge variant="outline" className="font-mono">
                      {detail.patternVersion}
                    </Badge>
                    {detail.artworkVersion && (
                      <Badge variant="outline" className="font-mono">
                        {detail.artworkVersion}
                      </Badge>
                    )}
                    <Badge variant="secondary">{detail.targetSite}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{detail.title}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(detail.status === "IN_PROGRESS" || detail.status === "IN_TRANSIT") && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => toast({ title: "录入运单" })}>
                      <Truck className="w-4 h-4 mr-1" />
                      录入运单
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setReceiptDialogOpen(true)}>
                      <PackageCheck className="w-4 h-4 mr-1" />
                      到样签收
                    </Button>
                  </>
                )}
                {detail.status === "ARRIVED" && (
                  <Button variant="outline" size="sm" onClick={() => setStockInDialogOpen(true)}>
                    <Warehouse className="w-4 h-4 mr-1" />
                    核对入库
                  </Button>
                )}
                {(detail.status === "IN_QC" || detail.status === "COMPLETED") && detail.sampleRef && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast({ title: "打开样衣库存", description: detail.sampleRef })}
                  >
                    <Package className="w-4 h-4 mr-1" />
                    打开库存
                  </Button>
                )}
                {detail.status === "IN_QC" && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setConclusionDialogOpen(true)}>
                      <FileCheck className="w-4 h-4 mr-1" />
                      填写结论
                    </Button>
                    <Button size="sm" onClick={() => setGateDialogOpen(true)}>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      门禁确认
                    </Button>
                  </>
                )}
                {detail.status !== "COMPLETED" && detail.status !== "CANCELLED" && (
                  <Button variant="outline" size="sm" onClick={() => toast({ title: "阻塞/取消" })}>
                    <Square className="w-4 h-4 mr-1" />
                    阻塞
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* 内容区 */}
          <div className="flex p-6 gap-6">
            {/* 左侧主内容 */}
            <div className="flex-1 space-y-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-7 w-full">
                  <TabsTrigger value="overview">概览</TabsTrigger>
                  <TabsTrigger value="version">版本与输入</TabsTrigger>
                  <TabsTrigger value="logistics">物流与到样</TabsTrigger>
                  <TabsTrigger value="stockin">入库建档</TabsTrigger>
                  <TabsTrigger value="conclusion">产前验收</TabsTrigger>
                  <TabsTrigger value="gate">门禁与下游</TabsTrigger>
                  <TabsTrigger value="logs">日志</TabsTrigger>
                </TabsList>

                {/* Tab1: 概览 */}
                <TabsContent value="overview" className="space-y-6">
                  {/* 里程碑时间轴 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">里程碑进度</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        {milestones.map((m, i) => (
                          <div key={i} className="flex flex-col items-center">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center ${m.done ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"}`}
                            >
                              {m.done ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                            </div>
                            <p className="text-xs font-medium mt-2">{m.label}</p>
                            <p className="text-xs text-muted-foreground">{m.time || "-"}</p>
                            {i < milestones.length - 1 && (
                              <div
                                className={`absolute w-full h-0.5 top-4 left-1/2 ${m.done ? "bg-green-500" : "bg-gray-200"}`}
                                style={{ width: "calc(100% - 2rem)" }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* 门禁状态卡 */}
                  <Card className={detail.gateStatus === "MET" ? "border-green-500" : "border-red-500"}>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        {detail.gateStatus === "MET" ? (
                          <Unlock className="w-4 h-4 text-green-500" />
                        ) : (
                          <Lock className="w-4 h-4 text-red-500" />
                        )}
                        门禁状态：{detail.gateStatus === "MET" ? "已满足（允许进入量产）" : "未满足"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4">
                        {gateConditions.map((c, i) => (
                          <div key={i} className="flex items-center gap-2">
                            {c.met ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                            <span className="text-sm">{c.label}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* 关键字段摘要 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">关键信息</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">工厂</p>
                          <p className="font-medium">{detail.factoryName}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">目标站点</p>
                          <p className="font-medium">{detail.targetSite}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">预计到样</p>
                          <p className="font-medium">{detail.expectedArrival}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">负责人</p>
                          <p className="font-medium">{detail.owner}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab2: 版本与输入 */}
                <TabsContent value="version" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">制版版本</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">制版任务</p>
                          <button className="text-primary hover:underline flex items-center gap-1">
                            {detail.patternRef}
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                        <div>
                          <p className="text-muted-foreground">版本</p>
                          <Badge variant="secondary" className="font-mono">
                            {detail.patternVersion}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-muted-foreground">冻结时间</p>
                          <p className="font-medium">{detail.patternFrozenAt}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">冻结人</p>
                          <p className="font-medium">{detail.patternFrozenBy}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {detail.artworkRef && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">花型版本</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">花型任务</p>
                            <button className="text-primary hover:underline flex items-center gap-1">
                              {detail.artworkRef}
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                          <div>
                            <p className="text-muted-foreground">版本</p>
                            <Badge variant="secondary" className="font-mono">
                              {detail.artworkVersion}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-muted-foreground">冻结时间</p>
                            <p className="font-medium">{detail.artworkFrozenAt}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">冻结人</p>
                            <p className="font-medium">{detail.artworkFrozenBy}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">输入包附件</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-3 border rounded hover:bg-muted/50">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-blue-500" />
                            <div>
                              <p className="text-sm font-medium">制版包_P2_碎花连衣裙.zip</p>
                              <p className="text-xs text-muted-foreground">2.4 MB · 2026-01-12</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded hover:bg-muted/50">
                          <div className="flex items-center gap-3">
                            <ImageIcon className="w-5 h-5 text-green-500" />
                            <div>
                              <p className="text-sm font-medium">花型定位图_A1.pdf</p>
                              <p className="text-xs text-muted-foreground">1.2 MB · 2026-01-09</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab3: 物流与到样 */}
                <TabsContent value="logistics" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">发货信息</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">承运商</p>
                          <p className="font-medium">JNE Express</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">运单号</p>
                          <p className="font-medium font-mono">{detail.trackingNo}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">发货时间</p>
                          <p className="font-medium">{detail.shippedAt}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">预计到达</p>
                          <p className="font-medium">{detail.expectedArrival}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">到样签收记录</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">签收人</p>
                          <p className="font-medium">陈仓管</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">签收时间</p>
                          <p className="font-medium">{detail.arrivedAt}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">台账回执</p>
                          <button className="text-primary hover:underline">{detail.receiptEventId}</button>
                        </div>
                        <div>
                          <p className="text-muted-foreground">签收凭证</p>
                          <button className="text-primary hover:underline flex items-center gap-1">
                            查看附件
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab4: 入库建档 */}
                <TabsContent value="stockin" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">核对入库信息</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">仓库</p>
                          <p className="font-medium">{detail.warehouse}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">库位</p>
                          <p className="font-medium">{detail.location}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">样衣编号</p>
                          <button className="text-primary hover:underline font-mono">{detail.sampleRef}</button>
                        </div>
                        <div>
                          <p className="text-muted-foreground">入库时间</p>
                          <p className="font-medium">{detail.stockedInAt}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">台账回执</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">核对入库</Badge>
                        <button className="text-primary hover:underline">{detail.stockinEventId}</button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">快捷入口</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-3">
                        <Button variant="outline" size="sm" onClick={() => toast({ title: "打开样衣库存抽屉" })}>
                          <Package className="w-4 h-4 mr-1" />
                          打开样衣库存
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => toast({ title: "查看样衣台账" })}>
                          <FileText className="w-4 h-4 mr-1" />
                          查看样衣台账
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab5: 产前验收与结论 */}
                <TabsContent value="conclusion" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">产前验收清单</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>检查项</TableHead>
                            <TableHead>标准</TableHead>
                            <TableHead>实测</TableHead>
                            <TableHead>结果</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detail.checklist.map((item, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{item.item}</TableCell>
                              <TableCell>{item.standard}</TableCell>
                              <TableCell>{item.actual}</TableCell>
                              <TableCell>
                                {item.passed ? (
                                  <Badge className="bg-green-100 text-green-700">通过</Badge>
                                ) : (
                                  <Badge className="bg-red-100 text-red-700">不通过</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">产前结论</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-4">
                        <p className="text-sm text-muted-foreground">结论：</p>
                        {resultInfo && (
                          <Badge className={`${resultInfo.color} text-base px-3 py-1`}>{resultInfo.label}</Badge>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">评审意见：</p>
                        <p className="text-sm bg-muted p-3 rounded">{detail.conclusionNote}</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab6: 门禁与下游 */}
                <TabsContent value="gate" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">门禁条件</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {gateConditions.map((c, i) => (
                          <div key={i} className="flex items-center justify-between p-3 border rounded">
                            <div className="flex items-center gap-3">
                              {c.met ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-500" />
                              )}
                              <span className="font-medium">{c.label}</span>
                            </div>
                            <Badge className={c.met ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                              {c.met ? "已满足" : "未满足"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {detail.gateStatus === "MET" && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">门禁确认记录</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">确认人</p>
                            <p className="font-medium">{detail.gateConfirmedBy}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">确认时间</p>
                            <p className="font-medium">{detail.gateConfirmedAt}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">下游触发（量产入口）</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <Button
                          variant="outline"
                          className="w-full justify-start bg-transparent"
                          disabled={detail.gateStatus !== "MET"}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          进入"量产准备/大货"阶段
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-start bg-transparent"
                          disabled={detail.gateStatus !== "MET"}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          创建"大货打样/排产/采购需求"
                        </Button>
                        <Button variant="outline" className="w-full justify-start bg-transparent">
                          <Download className="w-4 h-4 mr-2" />
                          导出产前确认报告（PDF）
                        </Button>
                      </div>
                      {detail.gateStatus !== "MET" && (
                        <p className="text-xs text-muted-foreground mt-3">
                          <AlertTriangle className="w-3 h-3 inline mr-1" />
                          门禁未满足，无法进入量产流程
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab7: 日志 */}
                <TabsContent value="logs" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">操作日志</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {detail.logs.map((log, i) => (
                          <div key={i} className="flex gap-4 pb-4 border-b last:border-0">
                            <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm">{log.action}</p>
                                <p className="text-xs text-muted-foreground">{log.time}</p>
                              </div>
                              <p className="text-sm text-muted-foreground">{log.user}</p>
                              <p className="text-sm mt-1">{log.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* 右侧信息卡 */}
            <div className="w-80 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">关联信息</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">项目</p>
                    <button className="text-primary hover:underline">{detail.projectRef}</button>
                    <p className="text-xs text-muted-foreground">{detail.projectName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">来源（{detail.sourceType}）</p>
                    <button className="text-primary hover:underline">{detail.sourceRef}</button>
                  </div>
                  <div>
                    <p className="text-muted-foreground">版本信息</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="secondary" className="font-mono">
                        {detail.patternVersion}
                      </Badge>
                      {detail.artworkVersion && (
                        <Badge variant="secondary" className="font-mono">
                          {detail.artworkVersion}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">台账回执</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {detail.receiptEventId && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">到样签收</span>
                      <button className="text-primary hover:underline text-xs">{detail.receiptEventId}</button>
                    </div>
                  )}
                  {detail.stockinEventId && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">核对入库</span>
                      <button className="text-primary hover:underline text-xs">{detail.stockinEventId}</button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">快捷联查</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start bg-transparent"
                    onClick={() => toast({ title: "打开样衣库存" })}
                  >
                    <Package className="w-4 h-4 mr-2" />
                    样衣库存
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start bg-transparent"
                    onClick={() => toast({ title: "打开样衣台账" })}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    样衣台账
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start bg-transparent"
                    onClick={() => toast({ title: "打开首单打样" })}
                  >
                    <Link2 className="w-4 h-4 mr-2" />
                    首单打样
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* 到样签收弹窗 */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>到样签收</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                签收时间 <span className="text-red-500">*</span>
              </Label>
              <Input type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} />
            </div>
            <div className="space-y-2">
              <Label>回执/包裹照片</Label>
              <Input type="file" accept="image/*" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiptDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                toast({ title: "到样签收成功" })
                setReceiptDialogOpen(false)
              }}
            >
              确认签收
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 核对入库弹窗 */}
      <Dialog open={stockInDialogOpen} onOpenChange={setStockInDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>核对入库</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  仓库 <span className="text-red-500">*</span>
                </Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="选择仓库" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SZ-WH-01">深圳仓库01</SelectItem>
                    <SelectItem value="JKT-WH-01">雅加达仓库01</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  库位 <span className="text-red-500">*</span>
                </Label>
                <Input placeholder="A-01-02" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                样衣编号 <span className="text-red-500">*</span>
              </Label>
              <Input defaultValue={`SY-JKT-${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`} />
            </div>
            <div className="space-y-2">
              <Label>
                初检结果 <span className="text-red-500">*</span>
              </Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="选择" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pass">合格</SelectItem>
                  <SelectItem value="fail">不合格</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockInDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                toast({ title: "核对入库成功" })
                setStockInDialogOpen(false)
              }}
            >
              确认入库
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 填写结论弹窗 */}
      <Dialog open={conclusionDialogOpen} onOpenChange={setConclusionDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>填写产前结论</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                产前结论 <span className="text-red-500">*</span>
              </Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="选择结论" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PASS">通过（可量产）</SelectItem>
                  <SelectItem value="FAIL">不通过（阻断量产）</SelectItem>
                  <SelectItem value="NEED_RETRY">需补产前版</SelectItem>
                  <SelectItem value="NEED_REVISION">需改版</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>评审意见</Label>
              <Textarea placeholder="填写评审意见..." rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConclusionDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                toast({ title: "产前结论已提交" })
                setConclusionDialogOpen(false)
              }}
            >
              提交结论
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 门禁确认弹窗 */}
      <Dialog open={gateDialogOpen} onOpenChange={setGateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>门禁确认</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">确认以下条件均已满足，允许进入量产阶段：</p>
            <div className="space-y-2">
              {gateConditions.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Checkbox checked={c.met} disabled />
                  <span className="text-sm">{c.label}</span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGateDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                toast({ title: "门禁确认通过，任务已完成" })
                setGateDialogOpen(false)
              }}
            >
              确认通过并完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
