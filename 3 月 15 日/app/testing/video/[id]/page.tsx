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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowLeft,
  Edit,
  Upload,
  CheckCircle,
  Calculator,
  Download,
  Eye,
  Play,
  ImageIcon,
  FileText,
  Link2,
  AlertTriangle,
  ExternalLink,
  Plus,
  Shirt,
} from "lucide-react"

// 状态枚举
const RECORD_STATUS = {
  DRAFT: { label: "草稿", color: "bg-gray-100 text-gray-700" },
  RECONCILING: { label: "核对中", color: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "已关账", color: "bg-green-100 text-green-700" },
  CANCELLED: { label: "已取消", color: "bg-red-100 text-red-700" },
}

const TEST_ACCOUNTING_STATUS = {
  NONE: { label: "无测款", color: "bg-gray-100 text-gray-600" },
  PENDING: { label: "待入账", color: "bg-yellow-100 text-yellow-700" },
  ACCOUNTED: { label: "已入账", color: "bg-green-100 text-green-700" },
}

const INTENT_TYPES = {
  SELL: { label: "SELL-沉淀", color: "bg-blue-100 text-blue-700" },
  TEST: { label: "TEST-测款", color: "bg-purple-100 text-purple-700" },
  REVIEW: { label: "REVIEW-复测", color: "bg-orange-100 text-orange-700" },
}

// Mock详情数据
const mockRecordDetail = {
  id: "SV-20260123-012",
  title: "春季新款印花裙穿搭分享",
  status: "COMPLETED",
  purposes: ["PROMOTION", "SALES"],
  platform: "TikTok",
  account: "IDN-Store-A",
  creator: "KOL-Blue",
  publishedAt: "2026-01-23 11:30",
  owner: "张三",
  recorder: "李四",
  isTestAccountingEnabled: true,
  testAccountingStatus: "ACCOUNTED",
  videoUrl: "https://tiktok.com/@idnstore/video/123456",
  views: 125000,
  watchTime: 45000,
  completionRate: 68.5,
  likes: 8500,
  comments: 320,
  shares: 156,
  clicks: 2800,
  orders: 45,
  gmv: 12680,
  completedBy: "张三",
  completedAt: "2026-01-23 14:00",
  completionNote: "数据核对完成，关账",
  accountedBy: "张三",
  accountedAt: "2026-01-23 15:30",
  accountedNote: "TEST条目已入账",
  createdAt: "2026-01-22 18:00",
  updatedAt: "2026-01-23 15:30",
}

// Mock条目数据
const mockItems = [
  {
    id: "ITEM-001",
    evaluationIntent: "SELL",
    projectRef: null,
    productRef: "SPU-2026-DRESS-001",
    productName: "印花连衣裙-粉色",
    exposureType: "上身展示",
    views: 45000,
    likes: 3200,
    comments: 120,
    shares: 56,
    clicks: 980,
    orders: 18,
    gmv: 4680,
    recommendation: null,
    decisionRef: null,
  },
  {
    id: "ITEM-002",
    evaluationIntent: "TEST",
    projectRef: "PRJ-20251216-001",
    productRef: "SPU-2026-DRESS-002",
    productName: "波点连衣裙-蓝色",
    exposureType: "试穿讲解",
    views: 52000,
    likes: 3800,
    comments: 145,
    shares: 68,
    clicks: 1200,
    orders: 22,
    gmv: 5720,
    recommendation: "继续",
    decisionRef: "DEC-PRJ001-TEST-001",
  },
  {
    id: "ITEM-003",
    evaluationIntent: "SELL",
    projectRef: null,
    productRef: "SPU-2026-TOP-003",
    productName: "蕾丝衬衫-白色",
    exposureType: "搭配展示",
    views: 28000,
    likes: 1500,
    comments: 55,
    shares: 32,
    clicks: 620,
    orders: 5,
    gmv: 2280,
    recommendation: null,
    decisionRef: null,
  },
]

// Mock证据数据
const mockEvidence = [
  { id: "EV-001", type: "video", name: "原始视频文件", url: "#", uploadedAt: "2026-01-23 10:00" },
  { id: "EV-002", type: "screenshot", name: "数据面板截图", url: "#", uploadedAt: "2026-01-23 14:30" },
  { id: "EV-003", type: "screenshot", name: "评论区截图", url: "#", uploadedAt: "2026-01-23 14:35" },
]

// Mock样衣数据
const mockSamples = [
  { id: "SAM-001", code: "SAM-2026-001", name: "印花连衣裙样衣", status: "使用中", location: "深圳仓" },
  { id: "SAM-002", code: "SAM-2026-002", name: "波点连衣裙样衣", status: "已归还", location: "深圳仓" },
]

// Mock日志数据
const mockLogs = [
  { id: 1, action: "完成测款入账", operator: "张三", time: "2026-01-23 15:30", detail: "TEST条目已入账，生成决策实例" },
  { id: 2, action: "完成关账", operator: "张三", time: "2026-01-23 14:00", detail: "数据核对完成" },
  { id: 3, action: "导入数据", operator: "李四", time: "2026-01-23 13:00", detail: "导入CSV数据" },
  { id: 4, action: "状态变更", operator: "张三", time: "2026-01-22 18:30", detail: "草稿 → 核对中" },
  { id: 5, action: "创建记录", operator: "张三", time: "2026-01-22 18:00", detail: "创建短视频记录" },
]

export default function ShortVideoRecordDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const id = params.id as string

  const [activeTab, setActiveTab] = useState("overview")
  const [itemDrawerOpen, setItemDrawerOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [closeAccountDialogOpen, setCloseAccountDialogOpen] = useState(false)
  const [testAccountingDialogOpen, setTestAccountingDialogOpen] = useState(false)

  // 关账表单状态
  const [closeAccountForm, setCloseAccountForm] = useState({
    completionNote: "",
    unpublishedReason: "",
  })

  // 入账表单状态
  const [testAccountingForm, setTestAccountingForm] = useState({
    accountedNote: "",
    confirmed: false,
  })

  // 条目编辑表单状态
  const [itemForm, setItemForm] = useState({
    evaluationIntent: "",
    projectRef: "",
    productRef: "",
    exposureType: "",
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    clicks: 0,
    orders: 0,
    gmv: 0,
    recommendation: "",
    recommendationReason: "",
    noDataReason: "",
  })

  const record = mockRecordDetail

  const handleOpenItemDrawer = (item: any) => {
    setSelectedItem(item)
    setItemForm({
      evaluationIntent: item.evaluationIntent,
      projectRef: item.projectRef || "",
      productRef: item.productRef || "",
      exposureType: item.exposureType || "",
      views: item.views,
      likes: item.likes,
      comments: item.comments,
      shares: item.shares,
      clicks: item.clicks,
      orders: item.orders,
      gmv: item.gmv,
      recommendation: item.recommendation || "",
      recommendationReason: "",
      noDataReason: "",
    })
    setItemDrawerOpen(true)
  }

  const handleSaveItem = () => {
    toast({ title: "保存成功", description: `条目 ${selectedItem?.id} 已更新` })
    setItemDrawerOpen(false)
  }

  const handleCloseAccount = () => {
    if (!closeAccountForm.completionNote) {
      toast({ title: "校验失败", description: "请填写关账备注", variant: "destructive" })
      return
    }
    toast({ title: "关账成功", description: `记录 ${record.id} 已完成关账` })
    setCloseAccountDialogOpen(false)
  }

  const handleTestAccounting = () => {
    if (!testAccountingForm.accountedNote) {
      toast({ title: "校验失败", description: "请填写入账备注", variant: "destructive" })
      return
    }
    if (!testAccountingForm.confirmed) {
      toast({ title: "校验失败", description: "请确认入账信息", variant: "destructive" })
      return
    }
    toast({ title: "入账成功", description: `记录 ${record.id} 测款数据已入账` })
    setTestAccountingDialogOpen(false)
  }

  const testItems = mockItems.filter((item) => item.evaluationIntent === "TEST")

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="bg-card border-b px-6 py-4 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => router.back()}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  返回列表
                </Button>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold">{record.title}</h1>
                    <Badge className={RECORD_STATUS[record.status as keyof typeof RECORD_STATUS]?.color}>
                      {RECORD_STATUS[record.status as keyof typeof RECORD_STATUS]?.label}
                    </Badge>
                    <Badge
                      className={
                        TEST_ACCOUNTING_STATUS[record.testAccountingStatus as keyof typeof TEST_ACCOUNTING_STATUS]
                          ?.color
                      }
                    >
                      {
                        TEST_ACCOUNTING_STATUS[record.testAccountingStatus as keyof typeof TEST_ACCOUNTING_STATUS]
                          ?.label
                      }
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {record.id} · {record.platform} · {record.account} · {record.creator} · {record.publishedAt}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(record.status === "DRAFT" || record.status === "RECONCILING") && (
                  <Button variant="outline" size="sm">
                    <Edit className="w-4 h-4 mr-2" />
                    编辑
                  </Button>
                )}
                {(record.status === "DRAFT" || record.status === "RECONCILING") && (
                  <Button variant="outline" size="sm">
                    <Upload className="w-4 h-4 mr-2" />
                    导入数据
                  </Button>
                )}
                {record.status === "RECONCILING" && (
                  <Button variant="outline" size="sm" onClick={() => setCloseAccountDialogOpen(true)}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    完成关账
                  </Button>
                )}
                {(record.status === "RECONCILING" || record.status === "COMPLETED") &&
                  record.testAccountingStatus === "PENDING" && (
                    <Button size="sm" onClick={() => setTestAccountingDialogOpen(true)}>
                      <Calculator className="w-4 h-4 mr-2" />
                      完成测款入账
                    </Button>
                  )}
                {record.status === "COMPLETED" && (
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    导出
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 flex gap-6">
            {/* Left: Tabs */}
            <div className="flex-1">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="overview">概览</TabsTrigger>
                  <TabsTrigger value="items">内容条目</TabsTrigger>
                  <TabsTrigger value="reconcile">数据核对</TabsTrigger>
                  <TabsTrigger value="evidence">证据素材</TabsTrigger>
                  <TabsTrigger value="accounting">测款入账</TabsTrigger>
                  <TabsTrigger value="samples">样衣关联</TabsTrigger>
                  <TabsTrigger value="logs">日志审计</TabsTrigger>
                </TabsList>

                {/* Tab1: 概览 */}
                <TabsContent value="overview" className="space-y-6">
                  {/* 指标卡片 */}
                  <div className="grid grid-cols-5 gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-sm text-muted-foreground">播放量</p>
                        <p className="text-2xl font-bold text-blue-600">{(record.views / 1000).toFixed(1)}k</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-sm text-muted-foreground">完播率</p>
                        <p className="text-2xl font-bold text-green-600">{record.completionRate}%</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-sm text-muted-foreground">点赞</p>
                        <p className="text-2xl font-bold text-pink-600">{(record.likes / 1000).toFixed(1)}k</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-sm text-muted-foreground">评论/分享</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {record.comments}/{record.shares}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-sm text-muted-foreground">GMV</p>
                        <p className="text-2xl font-bold text-orange-600">¥{record.gmv.toLocaleString()}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 视频预览 */}
                  {record.videoUrl && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">视频链接</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <a
                          href={record.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary hover:underline"
                        >
                          <Play className="w-4 h-4" />
                          {record.videoUrl}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </CardContent>
                    </Card>
                  )}

                  {/* 缺失提醒 */}
                  {mockItems.length === 0 && (
                    <Card className="border-yellow-200 bg-yellow-50">
                      <CardContent className="p-4 flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-600" />
                        <p className="text-sm text-yellow-800">暂无内容条目，请添加条目或导入数据</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Tab2: 内容条目 */}
                <TabsContent value="items" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">内容条目 ({mockItems.length})</h3>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      添加条目
                    </Button>
                  </div>
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>意图</TableHead>
                            <TableHead>绑定对象</TableHead>
                            <TableHead>商品</TableHead>
                            <TableHead>露出方式</TableHead>
                            <TableHead className="text-right">播放</TableHead>
                            <TableHead className="text-right">点赞</TableHead>
                            <TableHead className="text-right">订单/GMV</TableHead>
                            <TableHead>建议</TableHead>
                            <TableHead>决策关联</TableHead>
                            <TableHead className="text-center">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mockItems.map((item) => (
                            <TableRow key={item.id} className="hover:bg-muted/30">
                              <TableCell>
                                <Badge
                                  className={INTENT_TYPES[item.evaluationIntent as keyof typeof INTENT_TYPES]?.color}
                                >
                                  {INTENT_TYPES[item.evaluationIntent as keyof typeof INTENT_TYPES]?.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {item.projectRef ? <span className="text-primary">{item.projectRef}</span> : "-"}
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="text-sm font-medium">{item.productRef}</p>
                                  <p className="text-xs text-muted-foreground">{item.productName}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">{item.exposureType}</TableCell>
                              <TableCell className="text-right text-sm">{(item.views / 1000).toFixed(1)}k</TableCell>
                              <TableCell className="text-right text-sm">{(item.likes / 1000).toFixed(1)}k</TableCell>
                              <TableCell className="text-right text-sm">
                                {item.orders}/¥{item.gmv}
                              </TableCell>
                              <TableCell>
                                {item.recommendation && (
                                  <Badge variant="outline" className="bg-green-50 text-green-700">
                                    {item.recommendation}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {item.decisionRef && <span className="text-primary text-sm">{item.decisionRef}</span>}
                              </TableCell>
                              <TableCell className="text-center">
                                <Button variant="ghost" size="sm" onClick={() => handleOpenItemDrawer(item)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab3: 数据核对 */}
                <TabsContent value="reconcile" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">数据来源</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-4">
                        <Button variant="outline">
                          <Upload className="w-4 h-4 mr-2" />
                          CSV导入
                        </Button>
                        <Button variant="outline">
                          <Download className="w-4 h-4 mr-2" />
                          下载模板
                        </Button>
                      </div>
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground">平台API对接（v1）：暂未开放</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">核对清单</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>发布时间已填写</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>条目数据完整</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>TEST条目已绑定对象</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab4: 证据素材 */}
                <TabsContent value="evidence" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">证据与素材 ({mockEvidence.length})</h3>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      上传素材
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {mockEvidence.map((ev) => (
                      <Card key={ev.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            {ev.type === "video" ? (
                              <Play className="w-8 h-8 text-blue-500" />
                            ) : (
                              <ImageIcon className="w-8 h-8 text-green-500" />
                            )}
                            <div className="flex-1">
                              <p className="font-medium text-sm">{ev.name}</p>
                              <p className="text-xs text-muted-foreground">{ev.uploadedAt}</p>
                            </div>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                {/* Tab5: 测款入账 */}
                <TabsContent value="accounting" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">TEST条目聚合 ({testItems.length}条)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {testItems.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead>条目</TableHead>
                              <TableHead>绑定对象</TableHead>
                              <TableHead>商品</TableHead>
                              <TableHead className="text-right">核心指标</TableHead>
                              <TableHead>建议</TableHead>
                              <TableHead>决策实例</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {testItems.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>{item.id}</TableCell>
                                <TableCell>
                                  {item.projectRef ? (
                                    <span className="text-primary">{item.projectRef}</span>
                                  ) : (
                                    <span className="text-muted-foreground">仅商品</span>
                                  )}
                                </TableCell>
                                <TableCell>{item.productRef}</TableCell>
                                <TableCell className="text-right">
                                  播放{(item.views / 1000).toFixed(1)}k / GMV¥{item.gmv}
                                </TableCell>
                                <TableCell>
                                  {item.recommendation && <Badge variant="outline">{item.recommendation}</Badge>}
                                </TableCell>
                                <TableCell>
                                  {item.decisionRef ? <span className="text-primary">{item.decisionRef}</span> : "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">暂无TEST条目</p>
                      )}
                    </CardContent>
                  </Card>
                  {record.testAccountingStatus === "ACCOUNTED" && (
                    <Card className="border-green-200 bg-green-50">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <div>
                            <p className="font-medium text-green-800">已完成测款入账</p>
                            <p className="text-sm text-green-700">
                              入账人：{record.accountedBy} · 入账时间：{record.accountedAt}
                            </p>
                            <p className="text-sm text-green-700">备注：{record.accountedNote}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Tab6: 样衣关联 */}
                <TabsContent value="samples" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">使用样衣 ({mockSamples.length})</h3>
                    <Button size="sm">
                      <Shirt className="w-4 h-4 mr-2" />
                      发起样衣使用申请
                    </Button>
                  </div>
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>样衣编号</TableHead>
                            <TableHead>名称</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead>位置</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mockSamples.map((sample) => (
                            <TableRow key={sample.id}>
                              <TableCell className="text-primary">{sample.code}</TableCell>
                              <TableCell>{sample.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{sample.status}</Badge>
                              </TableCell>
                              <TableCell>{sample.location}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab7: 日志审计 */}
                <TabsContent value="logs" className="space-y-4">
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="w-[180px]">操作</TableHead>
                            <TableHead className="w-[100px]">操作人</TableHead>
                            <TableHead className="w-[160px]">时间</TableHead>
                            <TableHead>详情</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mockLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="font-medium">{log.action}</TableCell>
                              <TableCell>{log.operator}</TableCell>
                              <TableCell className="text-muted-foreground">{log.time}</TableCell>
                              <TableCell className="text-sm">{log.detail}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* Right: Info Card */}
            <div className="w-[280px] space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">负责人信息</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">负责人</span>
                    <span>{record.owner}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">录入人</span>
                    <span>{record.recorder}</span>
                  </div>
                </CardContent>
              </Card>

              {record.status === "COMPLETED" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">关账信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">关账人</span>
                      <span>{record.completedBy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">关账时间</span>
                      <span>{record.completedAt}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {record.testAccountingStatus === "ACCOUNTED" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">入账信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">入账人</span>
                      <span>{record.accountedBy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">入账时间</span>
                      <span>{record.accountedAt}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">快捷联查</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
                    <Link2 className="w-4 h-4 mr-2" />
                    查看关联项目
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
                    <FileText className="w-4 h-4 mr-2" />
                    查看测款结论
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* SV6: Item Edit Drawer */}
          <Sheet open={itemDrawerOpen} onOpenChange={setItemDrawerOpen}>
            <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>编辑条目 - {selectedItem?.id}</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div>
                    <Label>评估意图 *</Label>
                    <Select
                      value={itemForm.evaluationIntent}
                      onValueChange={(v) => setItemForm({ ...itemForm, evaluationIntent: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SELL">SELL - 沉淀内容/销售</SelectItem>
                        <SelectItem value="TEST">TEST - 测款样本</SelectItem>
                        <SelectItem value="REVIEW">REVIEW - 复测/对比</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>关联项目</Label>
                    <Input
                      placeholder="输入项目编号"
                      value={itemForm.projectRef}
                      onChange={(e) => setItemForm({ ...itemForm, projectRef: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>关联商品 *</Label>
                    <Input
                      placeholder="输入款号/SPU/SKU"
                      value={itemForm.productRef}
                      onChange={(e) => setItemForm({ ...itemForm, productRef: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>露出方式</Label>
                    <Select
                      value={itemForm.exposureType}
                      onValueChange={(v) => setItemForm({ ...itemForm, exposureType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择露出方式" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="上身展示">上身展示</SelectItem>
                        <SelectItem value="试穿讲解">试穿讲解</SelectItem>
                        <SelectItem value="对比展示">对比展示</SelectItem>
                        <SelectItem value="搭配展示">搭配展示</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground border-b pb-2">指标数据</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>播放量</Label>
                      <Input
                        type="number"
                        value={itemForm.views}
                        onChange={(e) => setItemForm({ ...itemForm, views: Number.parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label>点赞</Label>
                      <Input
                        type="number"
                        value={itemForm.likes}
                        onChange={(e) => setItemForm({ ...itemForm, likes: Number.parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label>评论</Label>
                      <Input
                        type="number"
                        value={itemForm.comments}
                        onChange={(e) => setItemForm({ ...itemForm, comments: Number.parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label>分享</Label>
                      <Input
                        type="number"
                        value={itemForm.shares}
                        onChange={(e) => setItemForm({ ...itemForm, shares: Number.parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label>点击</Label>
                      <Input
                        type="number"
                        value={itemForm.clicks}
                        onChange={(e) => setItemForm({ ...itemForm, clicks: Number.parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label>订单</Label>
                      <Input
                        type="number"
                        value={itemForm.orders}
                        onChange={(e) => setItemForm({ ...itemForm, orders: Number.parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label>GMV</Label>
                      <Input
                        type="number"
                        value={itemForm.gmv}
                        onChange={(e) => setItemForm({ ...itemForm, gmv: Number.parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  {itemForm.evaluationIntent === "TEST" &&
                    itemForm.views === 0 &&
                    itemForm.orders === 0 &&
                    itemForm.gmv === 0 && (
                      <div>
                        <Label>无数据原因 *</Label>
                        <Textarea
                          placeholder="TEST条目指标全空时需说明原因"
                          value={itemForm.noDataReason}
                          onChange={(e) => setItemForm({ ...itemForm, noDataReason: e.target.value })}
                        />
                      </div>
                    )}
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground border-b pb-2">建议</h3>
                  <div>
                    <Label>推荐建议</Label>
                    <Select
                      value={itemForm.recommendation}
                      onValueChange={(v) => setItemForm({ ...itemForm, recommendation: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择建议" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="继续">继续</SelectItem>
                        <SelectItem value="改版">改版</SelectItem>
                        <SelectItem value="补测">补测</SelectItem>
                        <SelectItem value="淘汰">淘汰</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>建议原因</Label>
                    <Textarea
                      placeholder="输入建议原因"
                      value={itemForm.recommendationReason}
                      onChange={(e) => setItemForm({ ...itemForm, recommendationReason: e.target.value })}
                    />
                  </div>
                </div>

                {selectedItem?.decisionRef && (
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-sm text-green-800">
                      <CheckCircle className="w-4 h-4 inline mr-2" />
                      已入账，关联决策实例：{selectedItem.decisionRef}
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setItemDrawerOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleSaveItem}>保存</Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* SV4: Close Account Dialog */}
          <Dialog open={closeAccountDialogOpen} onOpenChange={setCloseAccountDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>完成记录（关账）</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm">
                    <span className="font-medium">记录编号：</span>
                    {record.id}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">条目数：</span>
                    {mockItems.length}
                  </p>
                </div>

                {!record.publishedAt && (
                  <div className="space-y-2">
                    <Label>未发布原因 *</Label>
                    <Textarea
                      placeholder="请说明未发布原因"
                      value={closeAccountForm.unpublishedReason}
                      onChange={(e) => setCloseAccountForm({ ...closeAccountForm, unpublishedReason: e.target.value })}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>关账备注 *</Label>
                  <Textarea
                    placeholder="请输入关账备注"
                    value={closeAccountForm.completionNote}
                    onChange={(e) => setCloseAccountForm({ ...closeAccountForm, completionNote: e.target.value })}
                  />
                </div>

                <div className="bg-yellow-50 p-3 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <p className="text-sm text-yellow-800">关账后记录将只读，仅可补充证据</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCloseAccountDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCloseAccount}>确认关账</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* SV5: Test Accounting Dialog */}
          <Dialog open={testAccountingDialogOpen} onOpenChange={setTestAccountingDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>完成测款核对（入账）</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm">
                    <span className="font-medium">记录编号：</span>
                    {record.id}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">TEST条目数：</span>
                    {testItems.length}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="font-medium">入账预览</Label>
                  <div className="border rounded-lg p-3 space-y-2">
                    <p className="text-sm">将为以下对象生成/更新"测款结论判定"实例：</p>
                    {testItems.map((item) => (
                      <div key={item.id} className="bg-blue-50 p-2 rounded text-sm">
                        <p>• {item.projectRef ? `项目维度：${item.projectRef}` : `商品维度：${item.productRef}`}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>入账备注 *</Label>
                  <Textarea
                    placeholder="请输入入账备注"
                    value={testAccountingForm.accountedNote}
                    onChange={(e) => setTestAccountingForm({ ...testAccountingForm, accountedNote: e.target.value })}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="confirmAccounting"
                    checked={testAccountingForm.confirmed}
                    onCheckedChange={(checked) =>
                      setTestAccountingForm({ ...testAccountingForm, confirmed: !!checked })
                    }
                  />
                  <Label htmlFor="confirmAccounting">我已确认TEST条目绑定正确，数据完整</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTestAccountingDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleTestAccounting}>确认入账</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  )
}
