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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowLeft,
  Edit,
  Upload,
  CheckCircle,
  Calculator,
  XCircle,
  Download,
  Plus,
  ExternalLink,
  AlertTriangle,
  Package,
  Video,
  ImageIcon,
  FileText,
  Shirt,
} from "lucide-react"

// 场次状态枚举
const SESSION_STATUS = {
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

const SESSION_PURPOSE = {
  TEST: { label: "测款", color: "bg-purple-100 text-purple-700" },
  SELL: { label: "带货", color: "bg-blue-100 text-blue-700" },
  RESTOCK: { label: "复播", color: "bg-cyan-100 text-cyan-700" },
  CLEARANCE: { label: "清仓", color: "bg-orange-100 text-orange-700" },
  SOFT_LAUNCH: { label: "上新", color: "bg-pink-100 text-pink-700" },
  CONTENT: { label: "内容", color: "bg-indigo-100 text-indigo-700" },
}

const EVALUATION_INTENT = {
  SELL: { label: "带货", color: "bg-blue-100 text-blue-700" },
  TEST: { label: "测款", color: "bg-purple-100 text-purple-700" },
  REVIEW: { label: "复测", color: "bg-cyan-100 text-cyan-700" },
}

// Mock详情数据
const mockSessionDetail = {
  id: "LS-20260122-001",
  title: "TikTok IDN 新款测试专场",
  status: "RECONCILING",
  purposes: ["TEST", "SELL"],
  liveAccount: "TikTok IDN Store-A",
  anchor: "家播-小N",
  startAt: "2026-01-22 19:00",
  endAt: "2026-01-22 22:30",
  owner: "张三",
  operator: "李四",
  recorder: "王五",
  reviewer: "赵六",
  site: "雅加达",
  isTestAccountingEnabled: true,
  testAccountingStatus: "PENDING",
  gmvTotal: 45680,
  orderTotal: 156,
  exposureTotal: 125000,
  clickTotal: 8900,
  cartTotal: 1250,
  createdAt: "2026-01-22 14:00",
  updatedAt: "2026-01-22 23:15",
  completedBy: null,
  completedAt: null,
  accountedBy: null,
  accountedAt: null,
  note: "重点测试春季新款连衣裙系列",
}

// Mock明细行数据
const mockItems = [
  {
    id: "item-001",
    intent: "TEST",
    projectRef: "PRJ-20260115-001",
    productRef: "SPU-A001",
    productName: "印尼风格碎花连衣裙",
    sku: "SKU-A001-M-RED",
    segmentStart: "19:15",
    segmentEnd: "19:45",
    exposure: 15000,
    click: 1200,
    cart: 180,
    order: 45,
    pay: 42,
    gmv: 8400,
    listPrice: 299,
    payPrice: 199,
    recommendation: "继续",
    recommendationReason: "转化率高于均值，建议加大推广",
    evidence: ["screenshot-001.png"],
    decisionLink: null,
  },
  {
    id: "item-002",
    intent: "TEST",
    projectRef: "PRJ-20260115-002",
    productRef: "SPU-B002",
    productName: "波西米亚风半身裙",
    sku: "SKU-B002-L-BLUE",
    segmentStart: "19:50",
    segmentEnd: "20:20",
    exposure: 12000,
    click: 850,
    cart: 95,
    order: 18,
    pay: 15,
    gmv: 2985,
    listPrice: 259,
    payPrice: 199,
    recommendation: "改版",
    recommendationReason: "转化率偏低，建议优化版型",
    evidence: ["screenshot-002.png"],
    decisionLink: null,
  },
  {
    id: "item-003",
    intent: "SELL",
    projectRef: null,
    productRef: "SPU-C003",
    productName: "基础款白色T恤",
    sku: "SKU-C003-M-WHITE",
    segmentStart: "20:25",
    segmentEnd: "20:45",
    exposure: 18000,
    click: 1500,
    cart: 280,
    order: 85,
    pay: 82,
    gmv: 6560,
    listPrice: 99,
    payPrice: 79,
    recommendation: null,
    recommendationReason: null,
    evidence: [],
    decisionLink: null,
  },
  {
    id: "item-004",
    intent: "TEST",
    projectRef: "PRJ-20260115-003",
    productRef: "SPU-D004",
    productName: "牛仔短裤夏季款",
    sku: "SKU-D004-S-DENIM",
    segmentStart: "20:50",
    segmentEnd: "21:15",
    exposure: 10000,
    click: 680,
    cart: 72,
    order: 12,
    pay: 10,
    gmv: 1990,
    listPrice: 259,
    payPrice: 199,
    recommendation: "补测",
    recommendationReason: "样本量不足，建议下场再测",
    evidence: ["screenshot-004.png"],
    decisionLink: null,
  },
]

// Mock样衣数据
const mockSamples = [
  {
    id: "SAM-001",
    name: "印尼风格碎花连衣裙-M红",
    site: "雅加达",
    status: "使用中",
    location: "直播间A",
    holder: "小N",
  },
  { id: "SAM-002", name: "波西米亚风半身裙-L蓝", site: "雅加达", status: "使用中", location: "直播间A", holder: "小N" },
  { id: "SAM-003", name: "基础款白色T恤-M白", site: "雅加达", status: "使用中", location: "直播间A", holder: "小N" },
  {
    id: "SAM-004",
    name: "牛仔短裤夏季款-S牛仔蓝",
    site: "雅加达",
    status: "使用中",
    location: "直播间A",
    holder: "小N",
  },
  { id: "SAM-005", name: "复古皮夹克-L黑", site: "雅加达", status: "可用", location: "仓库B-3", holder: "-" },
]

// Mock日志数据
const mockLogs = [
  { time: "2026-01-22 23:15", action: "更新明细数据", user: "王五", detail: "导入CSV数据，更新12条明细" },
  { time: "2026-01-22 22:35", action: "下播", user: "系统", detail: "直播结束，状态变更为核对中" },
  { time: "2026-01-22 19:00", action: "开播", user: "系统", detail: "直播开始" },
  { time: "2026-01-22 14:00", action: "创建场次", user: "张三", detail: "创建直播场次草稿" },
]

export default function LiveSessionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const sessionId = params.id as string

  const [activeTab, setActiveTab] = useState("overview")
  const [editItemDrawerOpen, setEditItemDrawerOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [closeAccountDialogOpen, setCloseAccountDialogOpen] = useState(false)
  const [testAccountingDialogOpen, setTestAccountingDialogOpen] = useState(false)

  const session = mockSessionDetail
  const items = mockItems
  const samples = mockSamples
  const logs = mockLogs

  const testItems = items.filter((item) => item.intent === "TEST")

  const handleEditItem = (item: any) => {
    setSelectedItem(item)
    setEditItemDrawerOpen(true)
  }

  // Header按钮显隐逻辑
  const showEditButton = session.status === "DRAFT" || session.status === "RECONCILING"
  const showImportButton = session.status === "DRAFT" || session.status === "RECONCILING"
  const showCloseAccountButton = session.status === "RECONCILING"
  const showTestAccountingButton =
    (session.status === "RECONCILING" || session.status === "COMPLETED") && session.testAccountingStatus === "PENDING"
  const showCancelButton = session.status === "DRAFT" || session.status === "RECONCILING"
  const showExportButton = session.status === "COMPLETED"

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto">
          {/* 顶部Header */}
          <div className="sticky top-0 z-10 bg-background border-b">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => router.push("/testing/live")}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  返回列表
                </Button>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold">{session.title}</h1>
                    <Badge className={SESSION_STATUS[session.status as keyof typeof SESSION_STATUS]?.color}>
                      {SESSION_STATUS[session.status as keyof typeof SESSION_STATUS]?.label}
                    </Badge>
                    <Badge
                      className={
                        TEST_ACCOUNTING_STATUS[session.testAccountingStatus as keyof typeof TEST_ACCOUNTING_STATUS]
                          ?.color
                      }
                    >
                      {
                        TEST_ACCOUNTING_STATUS[session.testAccountingStatus as keyof typeof TEST_ACCOUNTING_STATUS]
                          ?.label
                      }
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {session.liveAccount} · {session.anchor} · {session.startAt} - {session.endAt || "进行中"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {showEditButton && (
                  <Button variant="outline" size="sm">
                    <Edit className="w-4 h-4 mr-1" />
                    编辑
                  </Button>
                )}
                {showImportButton && (
                  <Button variant="outline" size="sm">
                    <Upload className="w-4 h-4 mr-1" />
                    导入数据
                  </Button>
                )}
                {showCloseAccountButton && (
                  <Button variant="outline" size="sm" onClick={() => setCloseAccountDialogOpen(true)}>
                    <CheckCircle className="w-4 h-4 mr-1" />
                    完成关账
                  </Button>
                )}
                {showTestAccountingButton && (
                  <Button size="sm" onClick={() => setTestAccountingDialogOpen(true)}>
                    <Calculator className="w-4 h-4 mr-1" />
                    完成测款入账
                  </Button>
                )}
                {showCancelButton && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 bg-transparent"
                    onClick={() => toast({ title: "取消场次", description: "已取消场次" })}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    取消
                  </Button>
                )}
                {showExportButton && (
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-1" />
                    导出报告
                  </Button>
                )}
              </div>
            </div>

            {/* 警告条 */}
            {session.testAccountingStatus === "PENDING" && session.status === "COMPLETED" && (
              <div className="px-4 py-2 bg-yellow-50 border-t border-yellow-200 flex items-center gap-2 text-sm text-yellow-800">
                <AlertTriangle className="w-4 h-4" />
                <span>存在 TEST 行待入账，请尽快完成测款核对</span>
              </div>
            )}
          </div>

          {/* 内容区域 */}
          <div className="p-6">
            <div className="flex gap-6">
              {/* 左侧主内容 */}
              <div className="flex-1 space-y-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid grid-cols-7 w-full">
                    <TabsTrigger value="overview">概览</TabsTrigger>
                    <TabsTrigger value="items">场次明细</TabsTrigger>
                    <TabsTrigger value="reconcile">数据核对</TabsTrigger>
                    <TabsTrigger value="evidence">证据素材</TabsTrigger>
                    <TabsTrigger value="accounting">测款入账</TabsTrigger>
                    <TabsTrigger value="samples">样衣关联</TabsTrigger>
                    <TabsTrigger value="logs">日志审计</TabsTrigger>
                  </TabsList>

                  {/* Tab1 概览 */}
                  <TabsContent value="overview" className="space-y-6 mt-6">
                    {/* KPI卡片 */}
                    <div className="grid grid-cols-6 gap-4">
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold text-primary">
                            ¥{session.gmvTotal?.toLocaleString() || "-"}
                          </p>
                          <p className="text-xs text-muted-foreground">GMV</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold">{session.orderTotal || "-"}</p>
                          <p className="text-xs text-muted-foreground">订单数</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold">{session.exposureTotal?.toLocaleString() || "-"}</p>
                          <p className="text-xs text-muted-foreground">曝光</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold">{session.clickTotal?.toLocaleString() || "-"}</p>
                          <p className="text-xs text-muted-foreground">点击</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold">{session.cartTotal?.toLocaleString() || "-"}</p>
                          <p className="text-xs text-muted-foreground">加购</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold">
                            {session.clickTotal && session.exposureTotal
                              ? ((session.clickTotal / session.exposureTotal) * 100).toFixed(2) + "%"
                              : "-"}
                          </p>
                          <p className="text-xs text-muted-foreground">点击率</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* 健康检查 */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">健康检查</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            {session.endAt ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                            <span className="text-sm">下播时间已填写</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {items.length > 0 ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                            <span className="text-sm">
                              明细行数 {">"}= 1 (当前: {items.length})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {testItems.every((i) => i.projectRef || i.productRef) ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-yellow-500" />
                            )}
                            <span className="text-sm">所有TEST行已绑定项目/商品</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Tab2 场次明细 */}
                  <TabsContent value="items" className="space-y-4 mt-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        共 {items.length} 条明细，其中 TEST 行 {testItems.length} 条
                      </p>
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-1" />
                        新增明细
                      </Button>
                    </div>
                    <Card>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="w-[80px]">意图</TableHead>
                              <TableHead>绑定对象</TableHead>
                              <TableHead>款信息</TableHead>
                              <TableHead>讲解时段</TableHead>
                              <TableHead className="text-right">曝光</TableHead>
                              <TableHead className="text-right">点击</TableHead>
                              <TableHead className="text-right">加购</TableHead>
                              <TableHead className="text-right">订单</TableHead>
                              <TableHead className="text-right">GMV</TableHead>
                              <TableHead>建议</TableHead>
                              <TableHead className="w-[80px]">操作</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((item) => (
                              <TableRow key={item.id} className={item.intent === "TEST" ? "bg-purple-50/30" : ""}>
                                <TableCell>
                                  <Badge
                                    className={EVALUATION_INTENT[item.intent as keyof typeof EVALUATION_INTENT]?.color}
                                  >
                                    {EVALUATION_INTENT[item.intent as keyof typeof EVALUATION_INTENT]?.label}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {item.projectRef ? (
                                    <span className="text-xs text-primary">{item.projectRef}</span>
                                  ) : item.productRef ? (
                                    <span className="text-xs text-muted-foreground">{item.productRef}</span>
                                  ) : (
                                    <span className="text-xs text-red-500">未绑定</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <p className="text-sm font-medium">{item.productName}</p>
                                  <p className="text-xs text-muted-foreground">{item.sku}</p>
                                </TableCell>
                                <TableCell className="text-sm">
                                  {item.segmentStart} - {item.segmentEnd}
                                </TableCell>
                                <TableCell className="text-right text-sm">{item.exposure?.toLocaleString()}</TableCell>
                                <TableCell className="text-right text-sm">{item.click?.toLocaleString()}</TableCell>
                                <TableCell className="text-right text-sm">{item.cart}</TableCell>
                                <TableCell className="text-right text-sm">{item.order}</TableCell>
                                <TableCell className="text-right text-sm font-medium">
                                  ¥{item.gmv?.toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  {item.recommendation ? (
                                    <Badge
                                      variant="outline"
                                      className={
                                        item.recommendation === "继续"
                                          ? "text-green-600"
                                          : item.recommendation === "改版"
                                            ? "text-orange-600"
                                            : item.recommendation === "补测"
                                              ? "text-blue-600"
                                              : "text-red-600"
                                      }
                                    >
                                      {item.recommendation}
                                    </Badge>
                                  ) : (
                                    "-"
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="sm" onClick={() => handleEditItem(item)}>
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

                  {/* Tab3 数据核对 */}
                  <TabsContent value="reconcile" className="space-y-4 mt-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">数据导入</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex gap-4">
                          <Button variant="outline">
                            <Download className="w-4 h-4 mr-2" />
                            下载模板
                          </Button>
                          <Button>
                            <Upload className="w-4 h-4 mr-2" />
                            上传CSV文件
                          </Button>
                        </div>
                        <div className="p-4 bg-muted rounded-lg">
                          <p className="text-sm text-muted-foreground">
                            支持从TikTok/Shopee后台导出的数据文件，系统将自动匹配字段并导入
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Tab4 证据素材 */}
                  <TabsContent value="evidence" className="space-y-4 mt-6">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-base">场次级证据</CardTitle>
                        <Button size="sm" variant="outline">
                          <Plus className="w-4 h-4 mr-1" />
                          上传
                        </Button>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-4 gap-4">
                          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                            <Video className="w-8 h-8 text-muted-foreground" />
                          </div>
                          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Tab5 测款入账 */}
                  <TabsContent value="accounting" className="space-y-4 mt-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">TEST 行清单</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>款信息</TableHead>
                              <TableHead>绑定项目</TableHead>
                              <TableHead>绑定商品</TableHead>
                              <TableHead>GMV</TableHead>
                              <TableHead>建议</TableHead>
                              <TableHead>决策实例</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {testItems.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>
                                  <p className="font-medium">{item.productName}</p>
                                  <p className="text-xs text-muted-foreground">{item.sku}</p>
                                </TableCell>
                                <TableCell>
                                  {item.projectRef ? (
                                    <span className="text-primary">{item.projectRef}</span>
                                  ) : (
                                    <span className="text-red-500">未绑定</span>
                                  )}
                                </TableCell>
                                <TableCell>{item.productRef || "-"}</TableCell>
                                <TableCell>¥{item.gmv?.toLocaleString()}</TableCell>
                                <TableCell>{item.recommendation || "-"}</TableCell>
                                <TableCell>
                                  {item.decisionLink ? (
                                    <Button variant="link" size="sm" className="p-0 h-auto">
                                      查看 <ExternalLink className="w-3 h-3 ml-1" />
                                    </Button>
                                  ) : (
                                    <span className="text-muted-foreground">待入账</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Tab6 样衣关联 */}
                  <TabsContent value="samples" className="space-y-4 mt-6">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-base">本场关联样衣</CardTitle>
                        <Button size="sm">
                          <Plus className="w-4 h-4 mr-1" />
                          发起样衣使用申请
                        </Button>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>样衣编号</TableHead>
                              <TableHead>名称</TableHead>
                              <TableHead>站点</TableHead>
                              <TableHead>状态</TableHead>
                              <TableHead>位置</TableHead>
                              <TableHead>保管人</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {samples.map((sample) => (
                              <TableRow key={sample.id}>
                                <TableCell className="text-primary">{sample.id}</TableCell>
                                <TableCell>{sample.name}</TableCell>
                                <TableCell>{sample.site}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{sample.status}</Badge>
                                </TableCell>
                                <TableCell>{sample.location}</TableCell>
                                <TableCell>{sample.holder}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Tab7 日志审计 */}
                  <TabsContent value="logs" className="space-y-4 mt-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">操作日志</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {logs.map((log, index) => (
                            <div key={index} className="flex gap-4 pb-4 border-b last:border-0">
                              <div className="w-2 h-2 mt-2 rounded-full bg-primary flex-shrink-0" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{log.action}</span>
                                  <span className="text-xs text-muted-foreground">by {log.user}</span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">{log.detail}</p>
                                <p className="text-sm text-muted-foreground mt-1">{log.time}</p>
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
              <div className="w-[280px] space-y-4 flex-shrink-0">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">关键人</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">负责人</span>
                      <span>{session.owner}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">场控</span>
                      <span>{session.operator || "-"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">录入人</span>
                      <span>{session.recorder || "-"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">审核人</span>
                      <span>{session.reviewer || "-"}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">关账信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {session.completedBy ? (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">关账人</span>
                          <span>{session.completedBy}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">关账时间</span>
                          <span>{session.completedAt}</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">未关账</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">入账信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {session.accountedBy ? (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">入账人</span>
                          <span>{session.accountedBy}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">入账时间</span>
                          <span>{session.accountedAt}</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">未入账</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">快捷联查</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
                      <Package className="w-4 h-4 mr-2" />
                      相关项目
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
                      <FileText className="w-4 h-4 mr-2" />
                      相关决策实例
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
                      <Shirt className="w-4 h-4 mr-2" />
                      样衣库存与台账
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* 明细行编辑抽屉 (LS6) */}
      <Sheet open={editItemDrawerOpen} onOpenChange={setEditItemDrawerOpen}>
        <SheetContent className="w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>编辑明细行</SheetTitle>
          </SheetHeader>
          {selectedItem && (
            <div className="space-y-6 mt-6">
              <div>
                <Label>评估意图 *</Label>
                <Select defaultValue={selectedItem.intent}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SELL">带货 (SELL)</SelectItem>
                    <SelectItem value="TEST">测款 (TEST)</SelectItem>
                    <SelectItem value="REVIEW">复测 (REVIEW)</SelectItem>
                  </SelectContent>
                </Select>
                {selectedItem.intent === "TEST" && (
                  <p className="text-xs text-orange-600 mt-1">TEST行入账前必须绑定项目/商品，并有最小指标数据</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>关联项目</Label>
                  <Input defaultValue={selectedItem.projectRef || ""} placeholder="PRJ-xxx" />
                </div>
                <div>
                  <Label>关联商品</Label>
                  <Input defaultValue={selectedItem.productRef || ""} placeholder="SPU-xxx" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>讲解开始</Label>
                  <Input type="time" defaultValue={selectedItem.segmentStart} />
                </div>
                <div>
                  <Label>讲解结束</Label>
                  <Input type="time" defaultValue={selectedItem.segmentEnd} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>曝光</Label>
                  <Input type="number" defaultValue={selectedItem.exposure} />
                </div>
                <div>
                  <Label>点击</Label>
                  <Input type="number" defaultValue={selectedItem.click} />
                </div>
                <div>
                  <Label>加购</Label>
                  <Input type="number" defaultValue={selectedItem.cart} />
                </div>
                <div>
                  <Label>订单</Label>
                  <Input type="number" defaultValue={selectedItem.order} />
                </div>
                <div>
                  <Label>支付</Label>
                  <Input type="number" defaultValue={selectedItem.pay} />
                </div>
                <div>
                  <Label>GMV</Label>
                  <Input type="number" defaultValue={selectedItem.gmv} />
                </div>
              </div>

              <div>
                <Label>建议</Label>
                <Select defaultValue={selectedItem.recommendation || ""}>
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
                <Textarea defaultValue={selectedItem.recommendationReason || ""} rows={2} />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  className="flex-1 bg-transparent"
                  onClick={() => setEditItemDrawerOpen(false)}
                >
                  取消
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    toast({ title: "保存成功" })
                    setEditItemDrawerOpen(false)
                  }}
                >
                  保存
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* 完成关账弹窗 */}
      <Dialog open={closeAccountDialogOpen} onOpenChange={setCloseAccountDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>完成场次（关账）</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Step1 完成前检查</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {session.endAt ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span>下播时间已填写</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {items.length > 0 ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span>明细行数 ≥ 1</span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Step2 关账信息</h4>
              <div>
                <Label>完成类型 *</Label>
                <Select defaultValue="normal">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">正常完成</SelectItem>
                    <SelectItem value="abnormal">异常完成</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>关账备注 *</Label>
                <Textarea placeholder="填写关账说明..." rows={2} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseAccountDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                toast({ title: "关账成功" })
                setCloseAccountDialogOpen(false)
              }}
            >
              确认关账
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 完成测款核对入账弹窗 */}
      <Dialog open={testAccountingDialogOpen} onOpenChange={setTestAccountingDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>完成测款核对（入账）</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Step1 TEST行校验</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {testItems.length > 0 ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span>至少存在1条TEST行 (当前: {testItems.length})</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {testItems.every((i) => i.projectRef || i.productRef) ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span>每条TEST行已绑定项目/商品</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {testItems.every((i) => i.pay || i.order || i.gmv) ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span>每条TEST行有最小指标数据</span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Step2 入账预览</h4>
              <div className="p-3 bg-blue-50 rounded-lg text-sm">
                <p>将生成/更新的"测款结论判定"实例:</p>
                <ul className="list-disc list-inside mt-2 text-muted-foreground">
                  {testItems
                    .filter((i) => i.projectRef)
                    .map((i) => (
                      <li key={i.id}>项目维度: {i.projectRef} (追加1条证据)</li>
                    ))}
                  {testItems
                    .filter((i) => !i.projectRef && i.productRef)
                    .map((i) => (
                      <li key={i.id}>商品维度: {i.productRef} (新建实例)</li>
                    ))}
                </ul>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Step3 入账确认</h4>
              <div>
                <Label>入账备注 *</Label>
                <Textarea placeholder="填写入账说明..." rows={2} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestAccountingDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                toast({ title: "入账成功", description: "测款核对已完成，决策实例已生成" })
                setTestAccountingDialogOpen(false)
              }}
            >
              确认入账
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
