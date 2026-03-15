"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
  ArrowLeft,
  Search,
  RotateCcw,
  RefreshCw,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  ShoppingCart,
} from "lucide-react"

// Mock同步错误数据
const mockProductSyncErrors = [
  {
    id: "E-001",
    store: "IDN-Store-A",
    productId: "CP-001",
    productName: "印尼风格碎花连衣裙",
    errorType: "类目不匹配",
    errorMsg: "平台类目Women>Dresses已下架",
    time: "2026-01-13 10:30",
    status: "待处理",
  },
  {
    id: "E-002",
    store: "VN-Store-B",
    productId: "CP-005",
    productName: "波西米亚长裙",
    errorType: "库存同步失败",
    errorMsg: "仓库接口超时",
    time: "2026-01-13 09:15",
    status: "已重试",
  },
  {
    id: "E-003",
    store: "IDN-Store-A",
    productId: "CP-008",
    productName: "休闲T恤",
    errorType: "图片上传失败",
    errorMsg: "图片尺寸不符合要求(min 500x500)",
    time: "2026-01-12 16:00",
    status: "待处理",
  },
]

const mockOrderSyncErrors = [
  {
    id: "OE-001",
    store: "IDN-Store-A",
    orderId: "TT7890123456",
    errorType: "订单拉取失败",
    errorMsg: "API限流，稍后重试",
    time: "2026-01-13 11:00",
    status: "已恢复",
  },
  {
    id: "OE-002",
    store: "TH-Store-D",
    orderId: "LZ1234567890",
    errorType: "发货同步失败",
    errorMsg: "运单号格式错误",
    time: "2026-01-12 14:30",
    status: "待处理",
  },
]

export default function SyncStatusPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("product")
  const [searchKeyword, setSearchKeyword] = useState("")
  const [storeFilter, setStoreFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  // 统计
  const productStats = {
    total: mockProductSyncErrors.length,
    pending: mockProductSyncErrors.filter((e) => e.status === "待处理").length,
    retried: mockProductSyncErrors.filter((e) => e.status === "已重试").length,
  }

  const orderStats = {
    total: mockOrderSyncErrors.length,
    pending: mockOrderSyncErrors.filter((e) => e.status === "待处理").length,
    recovered: mockOrderSyncErrors.filter((e) => e.status === "已恢复").length,
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/channels/stores")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回店铺列表
              </Button>
              <div>
                <h1 className="text-2xl font-bold">同步状态与错误回执</h1>
                <p className="text-muted-foreground">查看商品同步和订单同步的错误信息与处理状态</p>
              </div>
            </div>
            <Button variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="product" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                商品同步 ({productStats.total})
              </TabsTrigger>
              <TabsTrigger value="order" className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                订单同步 ({orderStats.total})
              </TabsTrigger>
            </TabsList>

            {/* 商品同步 */}
            <TabsContent value="product" className="space-y-6">
              {/* 统计卡片 */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{productStats.total}</div>
                      <div className="text-sm text-muted-foreground">全部错误</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <XCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{productStats.pending}</div>
                      <div className="text-sm text-muted-foreground">待处理</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Clock className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{productStats.retried}</div>
                      <div className="text-sm text-muted-foreground">已重试</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 筛选栏 */}
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="商品ID/名称"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={storeFilter} onValueChange={setStoreFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="店铺" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部店铺</SelectItem>
                    <SelectItem value="IDN-Store-A">IDN-Store-A</SelectItem>
                    <SelectItem value="VN-Store-B">VN-Store-B</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="待处理">待处理</SelectItem>
                    <SelectItem value="已重试">已重试</SelectItem>
                    <SelectItem value="已解决">已解决</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchKeyword("")
                    setStoreFilter("all")
                    setStatusFilter("all")
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  重置
                </Button>
              </div>

              {/* 错误列表 */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>店铺</TableHead>
                        <TableHead>商品</TableHead>
                        <TableHead>错误类型</TableHead>
                        <TableHead>错误信息</TableHead>
                        <TableHead>时间</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockProductSyncErrors.map((error) => (
                        <TableRow key={error.id}>
                          <TableCell>{error.store}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{error.productName}</div>
                              <div className="text-xs text-muted-foreground">{error.productId}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{error.errorType}</Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{error.errorMsg}</TableCell>
                          <TableCell>{error.time}</TableCell>
                          <TableCell>
                            <Badge variant={error.status === "待处理" ? "destructive" : "secondary"}>
                              {error.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => toast.info("查看详情")}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => toast.success("重试已提交")}>
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 订单同步 */}
            <TabsContent value="order" className="space-y-6">
              {/* 统计卡片 */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{orderStats.total}</div>
                      <div className="text-sm text-muted-foreground">全部错误</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <XCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{orderStats.pending}</div>
                      <div className="text-sm text-muted-foreground">待处理</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{orderStats.recovered}</div>
                      <div className="text-sm text-muted-foreground">已恢复</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 错误列表 */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>店铺</TableHead>
                        <TableHead>订单ID</TableHead>
                        <TableHead>错误类型</TableHead>
                        <TableHead>错误信息</TableHead>
                        <TableHead>时间</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockOrderSyncErrors.map((error) => (
                        <TableRow key={error.id}>
                          <TableCell>{error.store}</TableCell>
                          <TableCell className="font-mono">{error.orderId}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{error.errorType}</Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{error.errorMsg}</TableCell>
                          <TableCell>{error.time}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                error.status === "待处理"
                                  ? "destructive"
                                  : error.status === "已恢复"
                                    ? "default"
                                    : "secondary"
                              }
                            >
                              {error.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => toast.info("查看详情")}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => toast.success("重试已提交")}>
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="text-center text-muted-foreground py-4">订单同步完整功能将在 v1 版本实现</div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
