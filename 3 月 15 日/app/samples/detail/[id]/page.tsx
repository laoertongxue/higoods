"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ArrowLeft,
  Package,
  Camera,
  Ruler,
  MapPin,
  History,
  FileText,
  Clock,
  Edit,
  Save,
  ExternalLink,
  Lock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Trash2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import React from "react"

// 模拟样衣数据
const getSampleData = (id: string) => {
  const samples: Record<string, any> = {
    "SPL-001": {
      id: "SPL-001",
      projectId: "PRJ-20251220-001",
      projectName: "印尼风格碎花连衣裙",
      sourceType: "电商外采",
      sourceReference: "淘宝店铺A",
      samplingTaskId: null,
      sourceWorkItem: { id: "WI-INST-003", name: "外采样品采购" },
      role: "参考样",
      status: "在库",
      usageTags: ["测款用", "拍摄用"],
      isLocked: false,
      photos: ["/dress-sample-1.jpg", "/floral-pattern-dress-reference.jpg"],
      measurements: [
        { name: "胸围", value: "88", unit: "cm" },
        { name: "腰围", value: "68", unit: "cm" },
        { name: "臀围", value: "94", unit: "cm" },
        { name: "衣长", value: "105", unit: "cm" },
      ],
      fabricInfo: "雪纺面料，克重120g/㎡，成分100%涤纶",
      craftNotes: "包边工艺，隐形拉链",
      currentLocation: "深圳样衣仓",
      currentHolder: "张三",
      transferHistory: [
        {
          id: 1,
          from: "采购员",
          to: "深圳样衣仓",
          date: "2025-12-18 14:00",
          operator: "采购员A",
          trackingNo: "SF1234567890",
        },
      ],
      evaluationRecords: [],
      decisionRecords: [],
      logs: [
        { id: 1, action: "入库登记", user: "张三", time: "2025-12-18 14:00", detail: "样衣入库深圳样衣仓" },
        { id: 2, action: "创建样衣", user: "系统", time: "2025-12-18 10:00", detail: "由外采样品采购工作项创建" },
      ],
      createdAt: "2025-12-18 10:00",
      updatedAt: "2025-12-18 14:00",
    },
    "SPL-002": {
      id: "SPL-002",
      projectId: "PRJ-20251220-001",
      projectName: "印尼风格碎花连衣裙",
      sourceType: "深圳打样",
      sourceReference: "ST-001",
      samplingTaskId: "ST-001",
      sourceWorkItem: { id: "WI-INST-003", name: "外采样品采购" },
      role: "首版样",
      status: "外借",
      usageTags: ["测款用"],
      isLocked: false,
      borrowInfo: {
        borrower: "王主播",
        location: "直播间A",
        borrowDate: "2025-12-21 09:00",
        expectedReturn: "2025-12-25",
        purpose: "直播测款使用",
      },
      photos: ["/floral-pattern-dress-reference.jpg"],
      measurements: [
        { name: "胸围", value: "90", unit: "cm" },
        { name: "腰围", value: "70", unit: "cm" },
        { name: "臀围", value: "96", unit: "cm" },
        { name: "衣长", value: "108", unit: "cm" },
      ],
      fabricInfo: "雪纺面料，克重120g/㎡",
      craftNotes: "包边工艺，隐形拉链，腰部调整",
      currentLocation: "直播间A",
      currentHolder: "王主播",
      transferHistory: [
        {
          id: 1,
          from: "深圳打样组",
          to: "深圳样衣仓",
          date: "2025-12-20 16:00",
          operator: "李版师",
          trackingNo: "-",
        },
        { id: 2, from: "深圳样衣仓", to: "直播间A", date: "2025-12-21 09:00", operator: "张三", trackingNo: "-" },
      ],
      evaluationRecords: [{ id: 1, type: "试穿评估", result: "合适", evaluator: "模特A", date: "2025-12-20 18:00" }],
      decisionRecords: [],
      logs: [
        { id: 1, action: "外借登记", user: "张三", time: "2025-12-21 09:00", detail: "外借给王主播用于直播测款" },
        { id: 2, action: "试穿评估", user: "模特A", time: "2025-12-20 18:00", detail: "上身合体度：合适" },
        { id: 3, action: "入库登记", user: "李版师", time: "2025-12-20 16:00", detail: "打样完成入库" },
        { id: 4, action: "创建样衣", user: "系统", time: "2025-12-20 10:00", detail: "由打样任务ST-001产出" },
      ],
      createdAt: "2025-12-20 10:00",
      updatedAt: "2025-12-21 09:00",
    },
    "SPL-003": {
      id: "SPL-003",
      projectId: "PRJ-20251220-002",
      projectName: "基础白色T恤",
      sourceType: "印尼复制",
      sourceReference: "ST-002",
      samplingTaskId: "ST-002",
      sourceWorkItem: { id: "WI-INST-010", name: "制版准备" },
      role: "工程样",
      status: "运输中",
      usageTags: ["质检用"],
      isLocked: false,
      shippingInfo: {
        from: "印尼工厂",
        to: "深圳样衣仓",
        trackingNo: "JD9876543210",
        expectedArrival: "2025-12-24",
      },
      photos: ["/tshirt-sample.jpg"],
      measurements: [
        { name: "胸围", value: "104", unit: "cm" },
        { name: "肩宽", value: "44", unit: "cm" },
        { name: "衣长", value: "72", unit: "cm" },
      ],
      fabricInfo: "纯棉面料，克重180g/㎡",
      craftNotes: "标准T恤工艺",
      currentLocation: "物流途中",
      currentHolder: "-",
      transferHistory: [
        {
          id: 1,
          from: "印尼打样组",
          to: "物流途中",
          date: "2025-12-22 10:00",
          operator: "印尼版师",
          trackingNo: "JD9876543210",
        },
      ],
      evaluationRecords: [],
      decisionRecords: [],
      logs: [
        { id: 1, action: "发货登记", user: "印尼版师", time: "2025-12-22 10:00", detail: "从印尼发往深圳" },
        { id: 2, action: "创建样衣", user: "系统", time: "2025-12-22 09:00", detail: "由打样任务ST-002产出" },
      ],
      createdAt: "2025-12-22 09:00",
      updatedAt: "2025-12-22 10:00",
    },
    "SPL-004": {
      id: "SPL-004",
      projectId: "PRJ-20251220-003",
      projectName: "夏季牛仔短裤",
      sourceType: "产前样",
      sourceReference: "ST-003",
      samplingTaskId: "ST-003",
      sourceWorkItem: { id: "WI-INST-007", name: "首单样衣打样" },
      role: "产前样",
      status: "待评估",
      usageTags: ["质检用"],
      isLocked: false,
      photos: ["/denim-shorts-sample.jpg"],
      measurements: [
        { name: "腰围", value: "76", unit: "cm" },
        { name: "臀围", value: "98", unit: "cm" },
        { name: "裤长", value: "35", unit: "cm" },
      ],
      fabricInfo: "牛仔面料，10oz",
      craftNotes: "标准牛仔工艺，铆钉装饰",
      currentLocation: "印尼工厂",
      currentHolder: "质检员B",
      transferHistory: [
        { id: 1, from: "印尼打样组", to: "印尼工厂", date: "2025-12-21 14:00", operator: "张版师", trackingNo: "-" },
      ],
      evaluationRecords: [],
      decisionRecords: [],
      logs: [
        { id: 1, action: "待评估", user: "质检员B", time: "2025-12-21 14:00", detail: "等待质检评估" },
        { id: 2, action: "创建样衣", user: "系统", time: "2025-12-21 10:00", detail: "由打样任务ST-003产出" },
      ],
      createdAt: "2025-12-21 10:00",
      updatedAt: "2025-12-21 14:00",
    },
    "SPL-005": {
      id: "SPL-005",
      projectId: "PRJ-20251220-004",
      projectName: "复古皮夹克",
      sourceType: "电商外采",
      sourceReference: "淘宝店铺B",
      samplingTaskId: null,
      sourceWorkItem: { id: "WI-INST-003", name: "外采样品采购" },
      role: "参考样",
      status: "报废",
      usageTags: [],
      isLocked: true,
      scrapInfo: {
        reason: "项目终止，样衣无继续使用价值",
        operator: "张三",
        date: "2025-12-17",
      },
      photos: ["/jacket-sample.jpg"],
      measurements: [],
      fabricInfo: "PU皮革",
      craftNotes: "皮衣工艺",
      currentLocation: "报废仓",
      currentHolder: "-",
      transferHistory: [
        { id: 1, from: "采购员", to: "深圳样衣仓", date: "2025-12-15 14:00", operator: "采购员B", trackingNo: "-" },
        { id: 2, from: "深圳样衣仓", to: "报废仓", date: "2025-12-17 16:00", operator: "张三", trackingNo: "-" },
      ],
      evaluationRecords: [],
      decisionRecords: [],
      logs: [
        { id: 1, action: "报废登记", user: "张三", time: "2025-12-17 16:00", detail: "项目终止，样衣报废处理" },
        { id: 2, action: "入库登记", user: "采购员B", time: "2025-12-15 14:00", detail: "样衣入库" },
        { id: 3, action: "创建样衣", user: "系统", time: "2025-12-15 10:00", detail: "由外采样品采购工作项创建" },
      ],
      createdAt: "2025-12-15 10:00",
      updatedAt: "2025-12-17 16:00",
    },
  }
  return samples[id] || null
}

export default function SampleDetailPage() {
  const [id, setId] = useState("")
  const router = useRouter()
  const params = useParams()
  const [isEditing, setIsEditing] = useState(false)
  const [showLogPanel, setShowLogPanel] = useState(true)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [showBorrowDialog, setShowBorrowDialog] = useState(false)
  const [showReturnDialog, setShowReturnDialog] = useState(false)
  const [showScrapDialog, setShowScrapDialog] = useState(false)

  React.useEffect(() => {
    if (params.id) {
      setId(params.id)
    }
  }, [params])

  const sample = getSampleData(id)

  if (!sample) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SystemNav />
        <div className="flex flex-1 overflow-hidden">
          <SidebarNav />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="text-center py-12">
              <p className="text-muted-foreground">未找到样衣 {id}</p>
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
      在库: "bg-green-500/20 text-green-400 border-green-500/30",
      外借: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      运输中: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      报废: "bg-red-500/20 text-red-400 border-red-500/30",
      待评估: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    }
    return colors[status] || "bg-gray-500/20 text-gray-400 border-gray-500/30"
  }

  // 根据状态渲染不同的操作按钮
  const renderActionButtons = () => {
    if (sample.isLocked) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Lock className="h-4 w-4" />
          <span>已锁定</span>
        </div>
      )
    }

    switch (sample.status) {
      case "在库":
        return (
          <>
            <Button variant="outline" onClick={() => setShowTransferDialog(true)}>
              <MapPin className="h-4 w-4 mr-2" />
              流转登记
            </Button>
            <Button variant="outline" onClick={() => setShowBorrowDialog(true)}>
              <ExternalLink className="h-4 w-4 mr-2" />
              外借登记
            </Button>
          </>
        )
      case "外借":
        return (
          <>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <span className="text-sm text-yellow-400">
                外借给 {sample.borrowInfo?.borrower}，预计 {sample.borrowInfo?.expectedReturn} 归还
              </span>
            </div>
            <Button variant="outline" onClick={() => setShowReturnDialog(true)}>
              <RotateCcw className="h-4 w-4 mr-2" />
              归还登记
            </Button>
          </>
        )
      case "运输中":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-md">
            <Package className="h-4 w-4 text-blue-400" />
            <span className="text-sm text-blue-400">
              运单号: {sample.shippingInfo?.trackingNo}，预计 {sample.shippingInfo?.expectedArrival} 到达
            </span>
          </div>
        )
      case "待评估":
        return (
          <Button className="bg-orange-600 hover:bg-orange-700">
            <FileText className="h-4 w-4 mr-2" />
            开始评估
          </Button>
        )
      case "报废":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-md">
            <Trash2 className="h-4 w-4 text-red-400" />
            <span className="text-sm text-red-400">
              已报废：{sample.scrapInfo?.reason} ({sample.scrapInfo?.date})
            </span>
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
                  <h1 className="text-2xl font-semibold text-foreground">{sample.id}</h1>
                  <Badge className={`${getStatusColor(sample.status)} border`}>{sample.status}</Badge>
                  <Badge variant="outline">{sample.role}</Badge>
                  {sample.isLocked && (
                    <Badge className="bg-gray-500/20 text-gray-400 border border-gray-500/30">
                      <Lock className="h-3 w-3 mr-1" />
                      已锁定
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-sm mt-1">
                  {sample.sourceType} · {sample.projectName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!sample.isLocked && sample.status !== "报废" && (
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

          <div className="grid grid-cols-3 gap-6">
            {/* 左栏 - 基本信息和物理信息 */}
            <div className="col-span-2 space-y-6">
              {/* 基本信息 */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    基本信息
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-sm">所属项目</Label>
                      <div>
                        <Link href={`/projects/${sample.projectId}`} className="text-primary hover:underline">
                          {sample.projectName}
                        </Link>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-sm">来源工作项</Label>
                      <div>
                        <Link
                          href={`/projects/${sample.projectId}/work-items/${sample.sourceWorkItem.id}`}
                          className="text-primary hover:underline"
                        >
                          {sample.sourceWorkItem.name}
                        </Link>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-sm">来源类型</Label>
                      <div className="text-foreground">{sample.sourceType}</div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-sm">来源参考</Label>
                      <div className="text-foreground">
                        {sample.samplingTaskId ? (
                          <Link
                            href={`/sampling-tasks/${sample.samplingTaskId}`}
                            className="text-primary hover:underline"
                          >
                            打样任务 {sample.samplingTaskId}
                          </Link>
                        ) : (
                          sample.sourceReference
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-sm">样衣角色</Label>
                      <div>
                        <Badge variant="outline">{sample.role}</Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-sm">用途标签</Label>
                      <div className="flex gap-1 flex-wrap">
                        {sample.usageTags.map((tag: string) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                        {sample.usageTags.length === 0 && <span className="text-muted-foreground">-</span>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 样衣照片 */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    样衣照片
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {sample.photos.length === 0 ? (
                    <p className="text-muted-foreground text-center py-6">暂无照片</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative aspect-[4/3] bg-muted/30 rounded-lg overflow-hidden">
                        <Image
                          src={sample.photos[currentPhotoIndex] || "/placeholder.svg"}
                          alt={`样衣照片 ${currentPhotoIndex + 1}`}
                          fill
                          className="object-contain"
                        />
                        {sample.photos.length > 1 && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80"
                              onClick={() =>
                                setCurrentPhotoIndex((i) => (i - 1 + sample.photos.length) % sample.photos.length)
                              }
                            >
                              <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80"
                              onClick={() => setCurrentPhotoIndex((i) => (i + 1) % sample.photos.length)}
                            >
                              <ChevronRight className="h-5 w-5" />
                            </Button>
                          </>
                        )}
                      </div>
                      <div className="flex gap-2 justify-center">
                        {sample.photos.map((photo: string, index: number) => (
                          <button
                            key={index}
                            onClick={() => setCurrentPhotoIndex(index)}
                            className={`w-16 h-16 rounded overflow-hidden border-2 ${
                              index === currentPhotoIndex ? "border-primary" : "border-transparent"
                            }`}
                          >
                            <Image
                              src={photo || "/placeholder.svg"}
                              alt={`缩略图 ${index + 1}`}
                              width={64}
                              height={64}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 物理信息 */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Ruler className="h-4 w-4" />
                    物理信息
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 尺寸信息 */}
                  {sample.measurements.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-sm">尺寸信息</Label>
                      <div className="grid grid-cols-4 gap-3">
                        {sample.measurements.map((m: any, index: number) => (
                          <div key={index} className="bg-muted/30 p-3 rounded-lg">
                            <p className="text-xs text-muted-foreground">{m.name}</p>
                            <p className="font-medium text-foreground">
                              {m.value} {m.unit}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm">面料信息</Label>
                    <p className="text-foreground bg-muted/30 p-3 rounded-md">{sample.fabricInfo || "-"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm">工艺备注</Label>
                    <p className="text-foreground bg-muted/30 p-3 rounded-md">{sample.craftNotes || "-"}</p>
                  </div>
                </CardContent>
              </Card>

              {/* 流转历史 */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4" />
                    流转历史
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>流转方向</TableHead>
                        <TableHead>时间</TableHead>
                        <TableHead>操作人</TableHead>
                        <TableHead>运单号</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sample.transferHistory.map((record: any) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            {record.from} → {record.to}
                          </TableCell>
                          <TableCell>{record.date}</TableCell>
                          <TableCell>{record.operator}</TableCell>
                          <TableCell>{record.trackingNo}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* 右栏 - 位置和日志 */}
            <div className="space-y-6">
              {/* 当前位置 */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    当前位置
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">位置</span>
                      <span className="font-medium text-foreground">{sample.currentLocation}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">持有人</span>
                      <span className="font-medium text-foreground">{sample.currentHolder}</span>
                    </div>
                  </div>
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
                        {sample.logs.map((log: any) => (
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

      {/* 流转登记对话框 */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>流转登记</DialogTitle>
            <DialogDescription>登记样衣的流转信息</DialogDescription>
          </DialogHeader>
          {/* 其他对话框内容 */}
        </DialogContent>
      </Dialog>

      {/* 外借登记对话框 */}
      <Dialog open={showBorrowDialog} onOpenChange={setShowBorrowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>外借登记</DialogTitle>
            <DialogDescription>登记样衣的外借信息</DialogDescription>
          </DialogHeader>
          {/* 其他对话框内容 */}
        </DialogContent>
      </Dialog>

      {/* 归还登记对话框 */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>归还登记</DialogTitle>
            <DialogDescription>登记样衣的归还信息</DialogDescription>
          </DialogHeader>
          {/* 其他对话框内容 */}
        </DialogContent>
      </Dialog>

      {/* 报废登记对话框 */}
      <Dialog open={showScrapDialog} onOpenChange={setShowScrapDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>报废登记</DialogTitle>
            <DialogDescription>登记样衣的报废信息</DialogDescription>
          </DialogHeader>
          {/* 其他对话框内容 */}
        </DialogContent>
      </Dialog>
    </div>
  )
}
