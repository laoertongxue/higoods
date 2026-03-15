"use client"

import { useState } from "react"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { useToast } from "@/hooks/use-toast"
import {
  AlertTriangle,
  Search,
  RefreshCw,
  Bell,
  Clock,
  Shirt,
  Store,
  Link2,
  Upload,
  Video,
  ExternalLink,
} from "lucide-react"

// 异常类型
const exceptionTypes = [
  { id: "workitem_overdue", label: "工作项超期", icon: Clock, color: "text-red-600", count: 5 },
  { id: "sample_overdue", label: "样衣超期未归还", icon: Shirt, color: "text-orange-600", count: 3 },
  { id: "store_auth", label: "店铺授权异常", icon: Store, color: "text-amber-600", count: 2 },
  { id: "mapping_error", label: "映射异常", icon: Link2, color: "text-purple-600", count: 4 },
  { id: "listing_failed", label: "上架失败", icon: Upload, color: "text-pink-600", count: 3 },
  { id: "test_pending", label: "测款待入账", icon: Video, color: "text-blue-600", count: 6 },
]

// 异常数据
const allExceptions = [
  {
    id: "EX-001",
    type: "workitem_overdue",
    title: "制版任务-连衣裙",
    owner: "王版师",
    project: "印尼风格碎花连衣裙",
    overdueDays: 3,
    severity: "高",
    createdAt: "2026-01-10",
  },
  {
    id: "EX-002",
    type: "workitem_overdue",
    title: "花型任务-印花设计",
    owner: "陈设计",
    project: "Y2K银色亮片短裙",
    overdueDays: 2,
    severity: "高",
    createdAt: "2026-01-11",
  },
  {
    id: "EX-003",
    type: "workitem_overdue",
    title: "商品上架-TikTok",
    owner: "李运营",
    project: "基础打底针织上衣",
    overdueDays: 1,
    severity: "中",
    createdAt: "2026-01-12",
  },
  {
    id: "EX-004",
    type: "sample_overdue",
    title: "SY-QF-102",
    owner: "直播团队",
    project: "Y2K银色亮片短裙",
    overdueDays: 5,
    severity: "高",
    createdAt: "2026-01-08",
  },
  {
    id: "EX-005",
    type: "sample_overdue",
    title: "SY-HX-089",
    owner: "摄影棚",
    project: "立体花朵上衣",
    overdueDays: 2,
    severity: "中",
    createdAt: "2026-01-11",
  },
  {
    id: "EX-006",
    type: "store_auth",
    title: "TikTok印尼旗舰店",
    owner: "渠道组",
    project: "-",
    overdueDays: 3,
    severity: "高",
    createdAt: "2026-01-10",
  },
  {
    id: "EX-007",
    type: "store_auth",
    title: "Shopee主店",
    owner: "渠道组",
    project: "-",
    overdueDays: 1,
    severity: "中",
    createdAt: "2026-01-12",
  },
  {
    id: "EX-008",
    type: "mapping_error",
    title: "碎花连衣裙-S码",
    owner: "渠道组",
    project: "印尼风格碎花连衣裙",
    overdueDays: 0,
    severity: "中",
    createdAt: "2026-01-13",
  },
  {
    id: "EX-009",
    type: "mapping_error",
    title: "亮片短裙-M码",
    owner: "渠道组",
    project: "Y2K银色亮片短裙",
    overdueDays: 0,
    severity: "中",
    createdAt: "2026-01-13",
  },
  {
    id: "EX-010",
    type: "listing_failed",
    title: "针织上衣-白色",
    owner: "李运营",
    project: "基础打底针织上衣",
    overdueDays: 1,
    severity: "中",
    createdAt: "2026-01-12",
  },
  {
    id: "EX-011",
    type: "listing_failed",
    title: "吊带背心-黑色",
    owner: "李运营",
    project: "夏日清凉吊带",
    overdueDays: 2,
    severity: "中",
    createdAt: "2026-01-11",
  },
  {
    id: "EX-012",
    type: "test_pending",
    title: "LS-20260112-001",
    owner: "测款组",
    project: "Y2K银色亮片短裙",
    overdueDays: 1,
    severity: "低",
    createdAt: "2026-01-12",
  },
  {
    id: "EX-013",
    type: "test_pending",
    title: "SV-20260111-003",
    owner: "测款组",
    project: "印尼风格碎花连衣裙",
    overdueDays: 2,
    severity: "低",
    createdAt: "2026-01-11",
  },
]

// 订阅配置
interface SubscriptionConfig {
  enabled: boolean
  types: string[]
  severity: string[]
  notifyMethod: string
}

export default function ExceptionCenterPage() {
  const { toast } = useToast()

  // 状态
  const [activeType, setActiveType] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [severityFilter, setSeverityFilter] = useState("全部")
  const [ownerFilter, setOwnerFilter] = useState("全部")
  const [refreshing, setRefreshing] = useState(false)

  // 订阅配置
  const [subscriptionOpen, setSubscriptionOpen] = useState(false)
  const [subscription, setSubscription] = useState<SubscriptionConfig>({
    enabled: true,
    types: ["workitem_overdue", "sample_overdue", "store_auth"],
    severity: ["高", "中"],
    notifyMethod: "飞书",
  })

  // 过滤异常
  const filteredExceptions = allExceptions.filter((ex) => {
    if (activeType !== "all" && ex.type !== activeType) return false
    if (severityFilter !== "全部" && ex.severity !== severityFilter) return false
    if (ownerFilter !== "全部" && ex.owner !== ownerFilter) return false
    if (
      searchQuery &&
      !ex.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !ex.project.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false
    return true
  })

  // 刷新
  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => {
      setRefreshing(false)
      toast({ title: "刷新成功" })
    }, 1000)
  }

  // 处理异常
  const handleProcess = (ex: (typeof allExceptions)[0]) => {
    toast({ title: `处理异常: ${ex.title}`, description: "跳转到对应模块" })
  }

  // 获取类型标签
  const getTypeLabel = (type: string) => {
    return exceptionTypes.find((t) => t.id === type)?.label || type
  }

  // 获取类型颜色
  const getTypeColor = (type: string) => {
    return exceptionTypes.find((t) => t.id === type)?.color || "text-gray-600"
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">异常中心</h1>
              <p className="text-sm text-muted-foreground">全量异常监控与订阅管理</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
                刷新
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSubscriptionOpen(true)}>
                <Bell className="w-4 h-4 mr-1" />
                订阅设置
              </Button>
            </div>
          </div>

          {/* 异常类型卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card
              className={`cursor-pointer transition-all ${activeType === "all" ? "ring-2 ring-primary" : "hover:shadow-md"}`}
              onClick={() => setActiveType("all")}
            >
              <CardContent className="p-4 text-center">
                <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-600" />
                <p className="text-2xl font-bold">{allExceptions.length}</p>
                <p className="text-xs text-muted-foreground">全部异常</p>
              </CardContent>
            </Card>
            {exceptionTypes.map((type) => (
              <Card
                key={type.id}
                className={`cursor-pointer transition-all ${activeType === type.id ? "ring-2 ring-primary" : "hover:shadow-md"}`}
                onClick={() => setActiveType(type.id)}
              >
                <CardContent className="p-4 text-center">
                  <type.icon className={`w-6 h-6 mx-auto mb-2 ${type.color}`} />
                  <p className="text-2xl font-bold">{type.count}</p>
                  <p className="text-xs text-muted-foreground">{type.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 筛选条 */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索异常标题/项目..."
                className="pl-9 h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-28 h-9">
                <SelectValue placeholder="严重程度" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="全部">全部</SelectItem>
                <SelectItem value="高">高</SelectItem>
                <SelectItem value="中">中</SelectItem>
                <SelectItem value="低">低</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-28 h-9">
                <SelectValue placeholder="责任人" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="全部">全部</SelectItem>
                <SelectItem value="王版师">王版师</SelectItem>
                <SelectItem value="陈设计">陈设计</SelectItem>
                <SelectItem value="李运营">李运营</SelectItem>
                <SelectItem value="渠道组">渠道组</SelectItem>
                <SelectItem value="测款组">测款组</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 异常列表 */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">异常类型</TableHead>
                    <TableHead>标题</TableHead>
                    <TableHead>关联项目</TableHead>
                    <TableHead className="w-20">责任人</TableHead>
                    <TableHead className="w-20">严重程度</TableHead>
                    <TableHead className="w-24">逾期天数</TableHead>
                    <TableHead className="w-28">发现时间</TableHead>
                    <TableHead className="w-20">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExceptions.map((ex) => (
                    <TableRow key={ex.id} className={ex.severity === "高" ? "bg-red-50/50" : ""}>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${getTypeColor(ex.type)}`}>
                          {getTypeLabel(ex.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{ex.title}</TableCell>
                      <TableCell className="text-muted-foreground">{ex.project}</TableCell>
                      <TableCell>{ex.owner}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            ex.severity === "高" ? "destructive" : ex.severity === "中" ? "secondary" : "outline"
                          }
                          className="text-xs"
                        >
                          {ex.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {ex.overdueDays > 0 ? (
                          <span className="text-red-600 font-medium">{ex.overdueDays}天</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{ex.createdAt}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7" onClick={() => handleProcess(ex)}>
                          处理 <ExternalLink className="w-3 h-3 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredExceptions.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">暂无异常数据</div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* 订阅配置抽屉 */}
      <Sheet open={subscriptionOpen} onOpenChange={setSubscriptionOpen}>
        <SheetContent className="w-[400px]">
          <SheetHeader>
            <SheetTitle>异常订阅设置</SheetTitle>
            <SheetDescription>配置异常通知规则和方式</SheetDescription>
          </SheetHeader>
          <div className="py-6 space-y-6">
            <div className="flex items-center justify-between">
              <Label>启用异常订阅</Label>
              <Switch
                checked={subscription.enabled}
                onCheckedChange={(checked) => setSubscription((prev) => ({ ...prev, enabled: checked }))}
              />
            </div>

            <div>
              <Label className="text-sm font-medium">订阅异常类型</Label>
              <div className="mt-3 space-y-2">
                {exceptionTypes.map((type) => (
                  <div key={type.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={type.id}
                      checked={subscription.types.includes(type.id)}
                      onCheckedChange={(checked) => {
                        setSubscription((prev) => ({
                          ...prev,
                          types: checked ? [...prev.types, type.id] : prev.types.filter((t) => t !== type.id),
                        }))
                      }}
                    />
                    <label htmlFor={type.id} className="text-sm">
                      {type.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">订阅严重程度</Label>
              <div className="mt-3 space-y-2">
                {["高", "中", "低"].map((sev) => (
                  <div key={sev} className="flex items-center space-x-2">
                    <Checkbox
                      id={sev}
                      checked={subscription.severity.includes(sev)}
                      onCheckedChange={(checked) => {
                        setSubscription((prev) => ({
                          ...prev,
                          severity: checked ? [...prev.severity, sev] : prev.severity.filter((s) => s !== sev),
                        }))
                      }}
                    />
                    <label htmlFor={sev} className="text-sm">
                      {sev}严重
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">通知方式</Label>
              <Select
                value={subscription.notifyMethod}
                onValueChange={(v) => setSubscription((prev) => ({ ...prev, notifyMethod: v }))}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="飞书">飞书</SelectItem>
                  <SelectItem value="企业微信">企业微信</SelectItem>
                  <SelectItem value="邮件">邮件</SelectItem>
                  <SelectItem value="站内信">站内信</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setSubscriptionOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                setSubscriptionOpen(false)
                toast({ title: "订阅配置已保存" })
              }}
            >
              保存配置
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
