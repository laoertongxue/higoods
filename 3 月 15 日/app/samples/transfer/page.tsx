"use client"

import { useState } from "react"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import {
  Search,
  Download,
  Settings2,
  MoreHorizontal,
  ArrowRight,
  CalendarIcon,
  Copy,
  ExternalLink,
  AlertTriangle,
  Clock,
  Package,
  Truck,
  FileText,
  Filter,
} from "lucide-react"
import { format, subDays, subHours, addDays } from "date-fns"
import { zhCN } from "date-fns/locale"
import { cn } from "@/lib/utils"

// 时间常量
const NOW = new Date()
const NOW_ISO = NOW.toISOString()

// 流转类型定义
const TRANSFER_CATEGORIES = [
  { value: "all", label: "全部类型" },
  { value: "inbound", label: "入库流" },
  { value: "borrow", label: "借用流" },
  { value: "logistics", label: "物流流" },
  { value: "return", label: "退货流" },
  { value: "inventory", label: "盘点纠正" },
  { value: "disposal", label: "处置流" },
]

// 事件类型定义
const EVENT_TYPES = [
  { value: "ARRIVAL_SIGN", label: "到样签收", category: "inbound" },
  { value: "CHECK_IN", label: "核对入库", category: "inbound" },
  { value: "BORROW_OUT", label: "领用出库", category: "borrow" },
  { value: "RETURN_IN", label: "归还入库", category: "borrow" },
  { value: "SHIP_OUT", label: "寄出", category: "logistics" },
  { value: "RECEIVE_SIGN", label: "签收", category: "logistics" },
  { value: "INVENTORY_ADJUST", label: "盘点", category: "inventory" },
  { value: "RETURN_VENDOR", label: "退货", category: "return" },
  { value: "DISPOSAL", label: "处置", category: "disposal" },
]

// 站点定义
const SITES = [
  { value: "all", label: "全部站点" },
  { value: "shenzhen", label: "深圳" },
  { value: "jakarta", label: "雅加达" },
]

// 风险类型
const RISK_TYPES = {
  IN_TRANSIT_TIMEOUT: { label: "在途超时", color: "bg-red-100 text-red-700" },
  OVERDUE_RETURN: { label: "超期未归还", color: "bg-orange-100 text-orange-700" },
  PENDING_CHECK: { label: "待核对", color: "bg-yellow-100 text-yellow-700" },
}

// Mock 样衣数据
const SAMPLES = [
  {
    id: "SPL-20251201-001",
    code: "SPL-20251201-001",
    name: "印尼风格碎花连衣裙-红色-M",
    img: "/red-floral-dress.png",
  },
  {
    id: "SPL-20251201-002",
    code: "SPL-20251201-002",
    name: "波西米亚风长裙-蓝色-L",
    img: "/blue-bohemian-skirt.jpg",
  },
  { id: "SPL-20251201-003", code: "SPL-20251201-003", name: "简约T恤-白色-S", img: "/white-tshirt.png" },
  { id: "SPL-20251201-004", code: "SPL-20251201-004", name: "牛仔短裤-深蓝-M", img: "/denim-shorts.png" },
  { id: "SPL-20251201-005", code: "SPL-20251201-005", name: "针织开衫-米色-F", img: "/beige-cardigan.jpg" },
  { id: "SPL-20251201-006", code: "SPL-20251201-006", name: "休闲西装外套-黑色-L", img: "/black-blazer.jpg" },
  { id: "SPL-20251201-007", code: "SPL-20251201-007", name: "运动卫衣-灰色-XL", img: "/gray-hoodie.png" },
  { id: "SPL-20251201-008", code: "SPL-20251201-008", name: "雪纺衬衫-粉色-S", img: "/pink-chiffon-blouse.jpg" },
]

// Mock 项目数据
const PROJECTS = [
  { id: "PRJ-20251216-001", name: "印尼风格碎花连衣裙" },
  { id: "PRJ-20251216-002", name: "波西米亚风长裙系列" },
  { id: "PRJ-20251216-003", name: "基础款T恤系列" },
  { id: "PRJ-20251216-004", name: "夏季牛仔系列" },
]

// Mock 工作项数据
const WORK_ITEMS = [
  { id: "WI-001", name: "商品项目立项" },
  { id: "WI-002", name: "样衣获取" },
  { id: "WI-003", name: "样衣拍摄试穿" },
  { id: "WI-004", name: "直播测款" },
]

// 生成 Mock 流转记录
function generateTransferRecords() {
  const records: any[] = []
  let id = 1

  // 入库流 - 到样签收
  records.push({
    transfer_id: `TRF-${String(id++).padStart(6, "0")}`,
    event_type: "ARRIVAL_SIGN",
    transfer_category: "inbound",
    event_time: subHours(NOW, 2).toISOString(),
    sample: SAMPLES[0],
    from_entity: { type: "external", display: "淘宝店铺-美衣坊" },
    to_entity: { type: "site", display: "深圳仓-待入库区" },
    responsible_site_before: "shenzhen",
    responsible_site_after: "shenzhen",
    tracking: { carrier: "顺丰", no: "SF1234567890", eta: null },
    project: PROJECTS[0],
    work_item: WORK_ITEMS[1],
    operator: { role: "仓管", name: "李明" },
    risk_flags: [],
    summary: "淘宝外采样衣到货，已签收",
    attachments_count: 2,
  })

  // 入库流 - 核对入库
  records.push({
    transfer_id: `TRF-${String(id++).padStart(6, "0")}`,
    event_type: "CHECK_IN",
    transfer_category: "inbound",
    event_time: subHours(NOW, 1).toISOString(),
    sample: SAMPLES[0],
    from_entity: { type: "site", display: "深圳仓-待入库区" },
    to_entity: { type: "site", display: "深圳仓-A区-01-02" },
    responsible_site_before: "shenzhen",
    responsible_site_after: "shenzhen",
    tracking: null,
    project: PROJECTS[0],
    work_item: WORK_ITEMS[1],
    operator: { role: "仓管", name: "李明" },
    risk_flags: [],
    summary: "核对无误，已入库",
    attachments_count: 1,
  })

  // 借用流 - 领用出库
  records.push({
    transfer_id: `TRF-${String(id++).padStart(6, "0")}`,
    event_type: "BORROW_OUT",
    transfer_category: "borrow",
    event_time: subDays(NOW, 1).toISOString(),
    sample: SAMPLES[1],
    from_entity: { type: "site", display: "深圳仓-B区-02-05" },
    to_entity: { type: "person", display: "主播-小美" },
    responsible_site_before: "shenzhen",
    responsible_site_after: "shenzhen",
    tracking: null,
    project: PROJECTS[1],
    work_item: WORK_ITEMS[3],
    operator: { role: "买手", name: "张丽" },
    risk_flags: [],
    summary: "直播测款使用，预计3天归还",
    attachments_count: 1,
  })

  // 借用流 - 超期未归还
  records.push({
    transfer_id: `TRF-${String(id++).padStart(6, "0")}`,
    event_type: "BORROW_OUT",
    transfer_category: "borrow",
    event_time: subDays(NOW, 10).toISOString(),
    sample: SAMPLES[2],
    from_entity: { type: "site", display: "深圳仓-A区-03-01" },
    to_entity: { type: "person", display: "家播-阿杰" },
    responsible_site_before: "shenzhen",
    responsible_site_after: "shenzhen",
    tracking: null,
    project: PROJECTS[2],
    work_item: WORK_ITEMS[3],
    operator: { role: "买手", name: "王芳" },
    risk_flags: ["OVERDUE_RETURN"],
    summary: "家播测款使用，已超期7天未归还",
    attachments_count: 0,
  })

  // 物流流 - 寄出（深圳→雅加达）
  records.push({
    transfer_id: `TRF-${String(id++).padStart(6, "0")}`,
    event_type: "SHIP_OUT",
    transfer_category: "logistics",
    event_time: subDays(NOW, 3).toISOString(),
    sample: SAMPLES[3],
    from_entity: { type: "site", display: "深圳仓-C区-01-01" },
    to_entity: { type: "transit", display: "在途（深圳→雅加达）" },
    responsible_site_before: "shenzhen",
    responsible_site_after: "shenzhen", // 寄出时责任站点不变
    tracking: { carrier: "DHL", no: "DHL9876543210", eta: addDays(NOW, 2).toISOString() },
    project: PROJECTS[3],
    work_item: WORK_ITEMS[2],
    operator: { role: "仓管", name: "李明" },
    risk_flags: [],
    summary: "跨站点调拨，预计5天到达",
    attachments_count: 1,
  })

  // 物流流 - 在途超时
  records.push({
    transfer_id: `TRF-${String(id++).padStart(6, "0")}`,
    event_type: "SHIP_OUT",
    transfer_category: "logistics",
    event_time: subDays(NOW, 15).toISOString(),
    sample: SAMPLES[4],
    from_entity: { type: "site", display: "深圳仓-B区-01-03" },
    to_entity: { type: "transit", display: "在途（深圳→雅加达）" },
    responsible_site_before: "shenzhen",
    responsible_site_after: "shenzhen",
    tracking: { carrier: "EMS", no: "EMS1122334455", eta: subDays(NOW, 5).toISOString() },
    project: PROJECTS[0],
    work_item: WORK_ITEMS[2],
    operator: { role: "仓管", name: "李明" },
    risk_flags: ["IN_TRANSIT_TIMEOUT"],
    summary: "跨站点调拨，已超时10天未签收",
    attachments_count: 1,
  })

  // 物流流 - 签收（雅加达签收，责任切换）
  records.push({
    transfer_id: `TRF-${String(id++).padStart(6, "0")}`,
    event_type: "RECEIVE_SIGN",
    transfer_category: "logistics",
    event_time: subDays(NOW, 2).toISOString(),
    sample: SAMPLES[5],
    from_entity: { type: "transit", display: "在途（深圳→雅加达）" },
    to_entity: { type: "site", display: "雅加达仓-待入库区" },
    responsible_site_before: "shenzhen",
    responsible_site_after: "jakarta", // 签收时责任站点切换
    tracking: { carrier: "DHL", no: "DHL5566778899", eta: null },
    project: PROJECTS[1],
    work_item: WORK_ITEMS[2],
    operator: { role: "仓管", name: "Andi" },
    risk_flags: ["PENDING_CHECK"],
    summary: "雅加达签收，待核对入库",
    attachments_count: 2,
  })

  // 借用流 - 归还入库
  records.push({
    transfer_id: `TRF-${String(id++).padStart(6, "0")}`,
    event_type: "RETURN_IN",
    transfer_category: "borrow",
    event_time: subHours(NOW, 5).toISOString(),
    sample: SAMPLES[6],
    from_entity: { type: "person", display: "主播-小美" },
    to_entity: { type: "site", display: "深圳仓-待核对区" },
    responsible_site_before: "shenzhen",
    responsible_site_after: "shenzhen",
    tracking: null,
    project: PROJECTS[2],
    work_item: WORK_ITEMS[3],
    operator: { role: "买手", name: "张丽" },
    risk_flags: ["PENDING_CHECK"],
    summary: "直播结束归还，待核对",
    attachments_count: 1,
  })

  // 退货流
  records.push({
    transfer_id: `TRF-${String(id++).padStart(6, "0")}`,
    event_type: "RETURN_VENDOR",
    transfer_category: "return",
    event_time: subDays(NOW, 4).toISOString(),
    sample: SAMPLES[7],
    from_entity: { type: "site", display: "深圳仓-A区-02-01" },
    to_entity: { type: "external", display: "供应商-广州服饰厂" },
    responsible_site_before: "shenzhen",
    responsible_site_after: "shenzhen",
    tracking: { carrier: "顺丰", no: "SF9988776655", eta: null },
    project: PROJECTS[3],
    work_item: WORK_ITEMS[1],
    operator: { role: "仓管", name: "李明" },
    risk_flags: [],
    summary: "质量问题退货",
    attachments_count: 3,
  })

  // 盘点纠正
  records.push({
    transfer_id: `TRF-${String(id++).padStart(6, "0")}`,
    event_type: "INVENTORY_ADJUST",
    transfer_category: "inventory",
    event_time: subDays(NOW, 1).toISOString(),
    sample: SAMPLES[0],
    from_entity: { type: "site", display: "深圳仓-A区-01-02" },
    to_entity: { type: "site", display: "深圳仓-A区-01-05" },
    responsible_site_before: "shenzhen",
    responsible_site_after: "shenzhen",
    tracking: null,
    project: PROJECTS[0],
    work_item: null,
    operator: { role: "仓管", name: "李明" },
    risk_flags: [],
    summary: "盘点发现位置错误，已纠正",
    attachments_count: 1,
  })

  // 添加更多记录以丰富列表
  for (let i = 0; i < 20; i++) {
    const eventTypeIndex = i % EVENT_TYPES.length
    const eventType = EVENT_TYPES[eventTypeIndex]
    const sample = SAMPLES[i % SAMPLES.length]
    const project = PROJECTS[i % PROJECTS.length]
    const workItem = WORK_ITEMS[i % WORK_ITEMS.length]
    const hasRisk = i % 5 === 0
    const riskTypes = ["IN_TRANSIT_TIMEOUT", "OVERDUE_RETURN", "PENDING_CHECK"]

    records.push({
      transfer_id: `TRF-${String(id++).padStart(6, "0")}`,
      event_type: eventType.value,
      transfer_category: eventType.category,
      event_time: subDays(NOW, i + 5).toISOString(),
      sample,
      from_entity: {
        type: "site",
        display: `深圳仓-${String.fromCharCode(65 + (i % 3))}区-0${(i % 5) + 1}-0${(i % 10) + 1}`,
      },
      to_entity: {
        type: i % 2 === 0 ? "site" : "person",
        display: i % 2 === 0 ? `雅加达仓-待入库区` : `主播-测试${i + 1}`,
      },
      responsible_site_before: "shenzhen",
      responsible_site_after: i % 3 === 0 ? "jakarta" : "shenzhen",
      tracking:
        eventType.category === "logistics"
          ? { carrier: "DHL", no: `DHL${1000000000 + i}`, eta: addDays(NOW, 3).toISOString() }
          : null,
      project,
      work_item: workItem,
      operator: { role: "仓管", name: `操作员${i + 1}` },
      risk_flags: hasRisk ? [riskTypes[i % 3]] : [],
      summary: `流转记录 ${i + 1}`,
      attachments_count: i % 3,
    })
  }

  return records.sort((a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime())
}

const TRANSFER_RECORDS = generateTransferRecords()

// 流转类型 Badge 颜色
function getTransferCategoryBadge(category: string) {
  const colors: Record<string, string> = {
    inbound: "bg-green-100 text-green-700",
    borrow: "bg-blue-100 text-blue-700",
    logistics: "bg-purple-100 text-purple-700",
    return: "bg-orange-100 text-orange-700",
    inventory: "bg-gray-100 text-gray-700",
    disposal: "bg-red-100 text-red-700",
  }
  const labels: Record<string, string> = {
    inbound: "入库流",
    borrow: "借用流",
    logistics: "物流流",
    return: "退货流",
    inventory: "盘点纠正",
    disposal: "处置流",
  }
  return { color: colors[category] || "bg-gray-100 text-gray-700", label: labels[category] || category }
}

// 事件类型 Badge 颜色
function getEventTypeBadge(eventType: string) {
  const colors: Record<string, string> = {
    ARRIVAL_SIGN: "bg-emerald-100 text-emerald-700",
    CHECK_IN: "bg-green-100 text-green-700",
    BORROW_OUT: "bg-blue-100 text-blue-700",
    RETURN_IN: "bg-cyan-100 text-cyan-700",
    SHIP_OUT: "bg-purple-100 text-purple-700",
    RECEIVE_SIGN: "bg-violet-100 text-violet-700",
    INVENTORY_ADJUST: "bg-gray-100 text-gray-700",
    RETURN_VENDOR: "bg-orange-100 text-orange-700",
    DISPOSAL: "bg-red-100 text-red-700",
  }
  const labels: Record<string, string> = {
    ARRIVAL_SIGN: "到样签收",
    CHECK_IN: "核对入库",
    BORROW_OUT: "领用出库",
    RETURN_IN: "归还入库",
    SHIP_OUT: "寄出",
    RECEIVE_SIGN: "签收",
    INVENTORY_ADJUST: "盘点",
    RETURN_VENDOR: "退货",
    DISPOSAL: "处置",
  }
  return { color: colors[eventType] || "bg-gray-100 text-gray-700", label: labels[eventType] || eventType }
}

export default function SampleTransferPage() {
  const { toast } = useToast()
  const [searchKeyword, setSearchKeyword] = useState("")
  const [transferCategory, setTransferCategory] = useState("all")
  const [eventType, setEventType] = useState("all")
  const [responsibleSite, setResponsibleSite] = useState("all")
  const [fromSite, setFromSite] = useState("all")
  const [toSite, setToSite] = useState("all")
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: subDays(NOW, 7),
    to: NOW,
  })
  const [includeOccupyEvents, setIncludeOccupyEvents] = useState(false)
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<any>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // 筛选逻辑
  const filteredRecords = TRANSFER_RECORDS.filter((record) => {
    // 关键词搜索
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase()
      const matchSample =
        record.sample.code.toLowerCase().includes(keyword) || record.sample.name.toLowerCase().includes(keyword)
      const matchProject = record.project?.name.toLowerCase().includes(keyword)
      const matchWorkItem = record.work_item?.name.toLowerCase().includes(keyword)
      const matchTracking = record.tracking?.no.toLowerCase().includes(keyword)
      const matchOperator = record.operator.name.toLowerCase().includes(keyword)
      if (!matchSample && !matchProject && !matchWorkItem && !matchTracking && !matchOperator) {
        return false
      }
    }

    // 流转类型
    if (transferCategory !== "all" && record.transfer_category !== transferCategory) {
      return false
    }

    // 事件类型
    if (eventType !== "all" && record.event_type !== eventType) {
      return false
    }

    // 责任站点
    if (responsibleSite !== "all" && record.responsible_site_after !== responsibleSite) {
      return false
    }

    // 时间范围
    if (dateRange.from && new Date(record.event_time) < dateRange.from) {
      return false
    }
    if (dateRange.to && new Date(record.event_time) > dateRange.to) {
      return false
    }

    return true
  })

  const totalRecords = filteredRecords.length
  const totalPages = Math.ceil(totalRecords / pageSize)
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // 统计数据
  const stats = {
    total: TRANSFER_RECORDS.length,
    inTransit: TRANSFER_RECORDS.filter(
      (r) =>
        r.event_type === "SHIP_OUT" &&
        !TRANSFER_RECORDS.some(
          (r2) =>
            r2.event_type === "RECEIVE_SIGN" &&
            r2.sample.id === r.sample.id &&
            new Date(r2.event_time) > new Date(r.event_time),
        ),
    ).length,
    inTransitTimeout: TRANSFER_RECORDS.filter((r) => r.risk_flags.includes("IN_TRANSIT_TIMEOUT")).length,
    overdueReturn: TRANSFER_RECORDS.filter((r) => r.risk_flags.includes("OVERDUE_RETURN")).length,
    pendingCheck: TRANSFER_RECORDS.filter((r) => r.risk_flags.includes("PENDING_CHECK")).length,
  }

  const handleReset = () => {
    setSearchKeyword("")
    setTransferCategory("all")
    setEventType("all")
    setResponsibleSite("all")
    setFromSite("all")
    setToSite("all")
    setDateRange({ from: subDays(NOW, 7), to: NOW })
    setIncludeOccupyEvents(false)
    setCurrentPage(1)
  }

  const handleExport = () => {
    toast({ title: "导出成功", description: `已导出 ${filteredRecords.length} 条流转记录` })
  }

  const handleRowClick = (record: any) => {
    setSelectedRecord(record)
    setDrawerOpen(true)
  }

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id)
    toast({ title: "已复制", description: id })
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[1600px] mx-auto space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">样衣流转记录</h1>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowAdvancedFilter(true)}>
                  <Filter className="w-4 h-4 mr-1" />
                  高级筛选
                </Button>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-1" />
                  导出
                </Button>
                <Button variant="outline" size="sm">
                  <Settings2 className="w-4 h-4 mr-1" />
                  列配置
                </Button>
              </div>
            </div>

            {/* 筛选栏 */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="样衣编号/项目/工作项/运单号/保管人"
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={transferCategory} onValueChange={setTransferCategory}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="流转类型" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSFER_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={eventType} onValueChange={setEventType}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="事件类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部事件</SelectItem>
                      {EVENT_TYPES.map((et) => (
                        <SelectItem key={et.value} value={et.value}>
                          {et.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={responsibleSite} onValueChange={setResponsibleSite}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="责任站点" />
                    </SelectTrigger>
                    <SelectContent>
                      {SITES.map((site) => (
                        <SelectItem key={site.value} value={site.value}>
                          {site.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-[220px] justify-start text-left font-normal bg-transparent"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "MM/dd")} - {format(dateRange.to, "MM/dd")}
                            </>
                          ) : (
                            format(dateRange.from, "yyyy-MM-dd")
                          )
                        ) : (
                          "选择时间范围"
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange.from}
                        selected={{ from: dateRange.from, to: dateRange.to }}
                        onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                        numberOfMonths={2}
                        locale={zhCN}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button onClick={() => setCurrentPage(1)}>查询</Button>
                  <Button variant="outline" onClick={handleReset}>
                    重置
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 统计卡片 */}
            <div className="grid grid-cols-5 gap-4">
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setTransferCategory("all")
                  setCurrentPage(1)
                }}
              >
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">全部流转</div>
                  <div className="text-2xl font-bold mt-1">{stats.total}</div>
                </CardContent>
              </Card>
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setTransferCategory("logistics")
                  setCurrentPage(1)
                }}
              >
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Truck className="w-4 h-4" />
                    当前在途
                  </div>
                  <div className="text-2xl font-bold mt-1 text-purple-600">{stats.inTransit}</div>
                </CardContent>
              </Card>
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow border-red-200 bg-red-50"
                onClick={() => toast({ title: "筛选", description: "显示在途超时记录" })}
              >
                <CardContent className="p-4">
                  <div className="text-sm text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    在途超时
                  </div>
                  <div className="text-2xl font-bold mt-1 text-red-600">{stats.inTransitTimeout}</div>
                </CardContent>
              </Card>
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow border-orange-200 bg-orange-50"
                onClick={() => toast({ title: "筛选", description: "显示超期未归还记录" })}
              >
                <CardContent className="p-4">
                  <div className="text-sm text-orange-600 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    超期未归还
                  </div>
                  <div className="text-2xl font-bold mt-1 text-orange-600">{stats.overdueReturn}</div>
                </CardContent>
              </Card>
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow border-yellow-200 bg-yellow-50"
                onClick={() => toast({ title: "筛选", description: "显示待核对记录" })}
              >
                <CardContent className="p-4">
                  <div className="text-sm text-yellow-700 flex items-center gap-1">
                    <Package className="w-4 h-4" />
                    待核对
                  </div>
                  <div className="text-2xl font-bold mt-1 text-yellow-700">{stats.pendingCheck}</div>
                </CardContent>
              </Card>
            </div>

            {/* 数据表格 */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[160px]">时间</TableHead>
                      <TableHead className="w-[200px]">样衣</TableHead>
                      <TableHead className="w-[80px]">流转类型</TableHead>
                      <TableHead className="w-[90px]">事件类型</TableHead>
                      <TableHead className="min-w-[200px]">From → To</TableHead>
                      <TableHead className="w-[120px]">责任站点</TableHead>
                      <TableHead className="w-[150px]">运单</TableHead>
                      <TableHead className="w-[150px]">关联项目</TableHead>
                      <TableHead className="w-[100px]">经办人</TableHead>
                      <TableHead className="w-[100px]">风险</TableHead>
                      <TableHead className="w-[80px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRecords.map((record) => {
                      const catBadge = getTransferCategoryBadge(record.transfer_category)
                      const eventBadge = getEventTypeBadge(record.event_type)
                      const siteChanged = record.responsible_site_before !== record.responsible_site_after

                      return (
                        <TableRow
                          key={record.transfer_id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleRowClick(record)}
                        >
                          <TableCell className="text-sm">
                            {format(new Date(record.event_time), "MM-dd HH:mm", { locale: zhCN })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <img
                                src={record.sample.img || "/placeholder.svg"}
                                alt={record.sample.name}
                                className="w-10 h-10 rounded object-cover"
                              />
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">{record.sample.code}</div>
                                <div className="text-xs text-muted-foreground truncate">{record.sample.name}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={cn("text-xs", catBadge.color)}>
                              {catBadge.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={cn("text-xs", eventBadge.color)}>
                              {eventBadge.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <span className="text-muted-foreground">{record.from_entity.display}</span>
                              <ArrowRight className="w-4 h-4 text-primary flex-shrink-0" />
                              <span className="font-medium">{record.to_entity.display}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {siteChanged ? (
                              <div className="flex items-center gap-1 text-sm">
                                <span>{record.responsible_site_before === "shenzhen" ? "深圳" : "雅加达"}</span>
                                <ArrowRight className="w-3 h-3 text-orange-500" />
                                <span className="text-orange-600 font-medium">
                                  {record.responsible_site_after === "shenzhen" ? "深圳" : "雅加达"}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm">
                                {record.responsible_site_after === "shenzhen" ? "深圳" : "雅加达"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {record.tracking ? (
                              <div className="text-sm">
                                <span className="text-muted-foreground">{record.tracking.carrier}</span>
                                <span className="ml-1">{record.tracking.no.slice(-6)}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {record.project ? (
                              <div className="text-sm truncate max-w-[140px]" title={record.project.name}>
                                {record.project.name}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <span className="text-muted-foreground">{record.operator.role}</span>
                              <span className="ml-1">{record.operator.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {record.risk_flags.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {record.risk_flags.map((flag: string) => {
                                  const risk = RISK_TYPES[flag as keyof typeof RISK_TYPES]
                                  return (
                                    <Badge key={flag} variant="secondary" className={cn("text-xs", risk?.color)}>
                                      {risk?.label || flag}
                                    </Badge>
                                  )
                                })}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRowClick(record)
                                  }}
                                >
                                  查看详情
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toast({ title: "跳转", description: "打开台账" })
                                  }}
                                >
                                  打开台账
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toast({ title: "跳转", description: "打开库存" })
                                  }}
                                >
                                  打开库存
                                </DropdownMenuItem>
                                {record.project && (
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toast({ title: "跳转", description: "打开项目" })
                                    }}
                                  >
                                    打开项目
                                  </DropdownMenuItem>
                                )}
                                {record.work_item && (
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toast({ title: "跳转", description: "打开工作项" })
                                    }}
                                  >
                                    打开工作项
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>

                {/* 分页 */}
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="text-sm text-muted-foreground">共 {totalRecords} 条</div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      上一页
                    </Button>
                    <span className="text-sm">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* 流转详情抽屉 */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          {selectedRecord && (
            <>
              <SheetHeader className="pb-4 border-b">
                <div className="flex items-start justify-between">
                  <div>
                    <SheetTitle className="flex items-center gap-2">
                      <Badge className={getTransferCategoryBadge(selectedRecord.transfer_category).color}>
                        {getTransferCategoryBadge(selectedRecord.transfer_category).label}
                      </Badge>
                      <span>·</span>
                      <Badge className={getEventTypeBadge(selectedRecord.event_type).color}>
                        {getEventTypeBadge(selectedRecord.event_type).label}
                      </Badge>
                    </SheetTitle>
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <span>{format(new Date(selectedRecord.event_time), "yyyy-MM-dd HH:mm:ss")}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        {selectedRecord.transfer_id}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={() => handleCopyId(selectedRecord.transfer_id)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedRecord.risk_flags.map((flag: string) => {
                      const risk = RISK_TYPES[flag as keyof typeof RISK_TYPES]
                      return (
                        <Badge key={flag} className={risk?.color}>
                          {risk?.label}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast({ title: "跳转", description: "打开库存详情" })}
                  >
                    <Package className="w-4 h-4 mr-1" />
                    库存详情
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toast({ title: "跳转", description: "打开台账" })}>
                    <FileText className="w-4 h-4 mr-1" />
                    打开台账
                  </Button>
                  {selectedRecord.project && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast({ title: "跳转", description: "打开项目" })}
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      打开项目
                    </Button>
                  )}
                </div>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                {/* A. 基本信息 */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">A. 基本信息</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">事件类型</Label>
                      <div className="mt-1">{getEventTypeBadge(selectedRecord.event_type).label}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">发生时间</Label>
                      <div className="mt-1">{format(new Date(selectedRecord.event_time), "yyyy-MM-dd HH:mm:ss")}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">经办人</Label>
                      <div className="mt-1">
                        {selectedRecord.operator.role} - {selectedRecord.operator.name}
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">摘要</Label>
                      <div className="mt-1">{selectedRecord.summary}</div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* B. From → To */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">B. From → To 交接信息</h3>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <Label className="text-muted-foreground text-xs">From</Label>
                        <div className="mt-1 font-medium">{selectedRecord.from_entity.display}</div>
                        <div className="text-xs text-muted-foreground">
                          {selectedRecord.from_entity.type === "site"
                            ? "站点仓库"
                            : selectedRecord.from_entity.type === "person"
                              ? "外部主体"
                              : "在途"}
                        </div>
                      </div>
                      <ArrowRight className="w-6 h-6 text-primary" />
                      <div className="flex-1">
                        <Label className="text-muted-foreground text-xs">To</Label>
                        <div className="mt-1 font-medium">{selectedRecord.to_entity.display}</div>
                        <div className="text-xs text-muted-foreground">
                          {selectedRecord.to_entity.type === "site"
                            ? "站点仓库"
                            : selectedRecord.to_entity.type === "person"
                              ? "外部主体"
                              : "在途"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* C. 责任站点 */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">C. 责任站点信息</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">责任站点变化</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <span>{selectedRecord.responsible_site_before === "shenzhen" ? "深圳" : "雅加达"}</span>
                        {selectedRecord.responsible_site_before !== selectedRecord.responsible_site_after && (
                          <>
                            <ArrowRight className="w-4 h-4 text-orange-500" />
                            <span className="text-orange-600 font-medium">
                              {selectedRecord.responsible_site_after === "shenzhen" ? "深圳" : "雅加达"}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">责任切换依据</Label>
                      <div className="mt-1">
                        {selectedRecord.responsible_site_before !== selectedRecord.responsible_site_after
                          ? "签收事件（跨站点）"
                          : "-"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* D. 运单信息 */}
                {selectedRecord.tracking && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-semibold mb-3">D. 运单与签收证明</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <Label className="text-muted-foreground">承运商</Label>
                          <div className="mt-1">{selectedRecord.tracking.carrier}</div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">运单号</Label>
                          <div className="mt-1 flex items-center gap-1">
                            {selectedRecord.tracking.no}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => handleCopyId(selectedRecord.tracking.no)}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        {selectedRecord.tracking.eta && (
                          <div>
                            <Label className="text-muted-foreground">预计到达</Label>
                            <div className="mt-1">{format(new Date(selectedRecord.tracking.eta), "yyyy-MM-dd")}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* E. 字段变更 Diff */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">E. 字段变更 Diff</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>字段名</TableHead>
                        <TableHead>变更前</TableHead>
                        <TableHead>变更后</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>当前位置</TableCell>
                        <TableCell className="text-muted-foreground">{selectedRecord.from_entity.display}</TableCell>
                        <TableCell className="font-medium">{selectedRecord.to_entity.display}</TableCell>
                      </TableRow>
                      {selectedRecord.responsible_site_before !== selectedRecord.responsible_site_after && (
                        <TableRow>
                          <TableCell>责任站点</TableCell>
                          <TableCell className="text-muted-foreground">
                            {selectedRecord.responsible_site_before === "shenzhen" ? "深圳" : "雅加达"}
                          </TableCell>
                          <TableCell className="font-medium">
                            {selectedRecord.responsible_site_after === "shenzhen" ? "深圳" : "雅加达"}
                          </TableCell>
                        </TableRow>
                      )}
                      {selectedRecord.to_entity.type === "person" && (
                        <TableRow>
                          <TableCell>保管人</TableCell>
                          <TableCell className="text-muted-foreground">仓库</TableCell>
                          <TableCell className="font-medium">{selectedRecord.to_entity.display}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                <Separator />

                {/* F. 关联对象与附件 */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">F. 关联对象与附件</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground w-20">样衣:</Label>
                      <div className="flex items-center gap-2">
                        <img src={selectedRecord.sample.img || "/placeholder.svg"} alt="" className="w-8 h-8 rounded" />
                        <span>{selectedRecord.sample.code}</span>
                      </div>
                    </div>
                    {selectedRecord.project && (
                      <div className="flex items-center gap-2">
                        <Label className="text-muted-foreground w-20">商品项目:</Label>
                        <Button variant="link" className="h-auto p-0" onClick={() => toast({ title: "跳转项目" })}>
                          {selectedRecord.project.id} - {selectedRecord.project.name}
                        </Button>
                      </div>
                    )}
                    {selectedRecord.work_item && (
                      <div className="flex items-center gap-2">
                        <Label className="text-muted-foreground w-20">工作项:</Label>
                        <Button variant="link" className="h-auto p-0" onClick={() => toast({ title: "跳转工作项" })}>
                          {selectedRecord.work_item.id} - {selectedRecord.work_item.name}
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground w-20">附件:</Label>
                      <span>{selectedRecord.attachments_count} 个附件</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 快捷动作 */}
              {(selectedRecord.risk_flags.includes("PENDING_CHECK") ||
                selectedRecord.risk_flags.includes("OVERDUE_RETURN") ||
                selectedRecord.to_entity.type === "transit") && (
                <div className="mt-6 pt-4 border-t">
                  <h3 className="text-sm font-semibold mb-3">快捷动作</h3>
                  <div className="flex gap-2">
                    {selectedRecord.to_entity.type === "transit" && (
                      <Button size="sm" onClick={() => toast({ title: "跳转", description: "去签收" })}>
                        去签收
                      </Button>
                    )}
                    {selectedRecord.risk_flags.includes("PENDING_CHECK") && (
                      <Button size="sm" onClick={() => toast({ title: "跳转", description: "去核对入库" })}>
                        去核对入库
                      </Button>
                    )}
                    {selectedRecord.risk_flags.includes("OVERDUE_RETURN") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toast({ title: "操作", description: "发起催办" })}
                      >
                        去催办
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* 高级筛选抽屉 */}
      <Sheet open={showAdvancedFilter} onOpenChange={setShowAdvancedFilter}>
        <SheetContent className="w-[400px]">
          <SheetHeader>
            <SheetTitle>高级筛选</SheetTitle>
          </SheetHeader>
          <div className="space-y-6 mt-6">
            <div>
              <Label>From 站点</Label>
              <Select value={fromSite} onValueChange={setFromSite}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SITES.map((site) => (
                    <SelectItem key={site.value} value={site.value}>
                      {site.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>To 站点</Label>
              <Select value={toSite} onValueChange={setToSite}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SITES.map((site) => (
                    <SelectItem key={site.value} value={site.value}>
                      {site.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="includeOccupy"
                checked={includeOccupyEvents}
                onCheckedChange={(checked) => setIncludeOccupyEvents(checked as boolean)}
              />
              <Label htmlFor="includeOccupy">包含占用事件（预占/取消）</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="inTransitOnly" />
              <Label htmlFor="inTransitOnly">仅看在途</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="overdueOnly" />
              <Label htmlFor="overdueOnly">仅看超期未归还</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="mySiteOnly" />
              <Label htmlFor="mySiteOnly">仅看责任站点=我</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="myRequestOnly" />
              <Label htmlFor="myRequestOnly">仅看关联我发起的申请</Label>
            </div>
          </div>
          <div className="flex gap-2 mt-8">
            <Button
              className="flex-1"
              onClick={() => {
                setShowAdvancedFilter(false)
                setCurrentPage(1)
              }}
            >
              应用筛选
            </Button>
            <Button variant="outline" onClick={handleReset}>
              重置
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
