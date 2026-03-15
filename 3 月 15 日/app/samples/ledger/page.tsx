"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Search,
  RefreshCw,
  Download,
  Eye,
  AlertTriangle,
  FileText,
  X,
  ChevronDown,
  ExternalLink,
  Clock,
  MapPin,
  Package,
  Archive,
  Trash2,
  Link2,
  Filter,
  Calendar,
} from "lucide-react"
import { toast } from "sonner"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"

const EVENT_TYPES = [
  { value: "RECEIVE_ARRIVAL", label: "到样签收", color: "bg-blue-100 text-blue-800" },
  { value: "CHECKIN_VERIFY", label: "核对入库", color: "bg-green-100 text-green-800" },
  { value: "RESERVE_LOCK", label: "预占锁定", color: "bg-yellow-100 text-yellow-800" },
  { value: "CANCEL_RESERVE", label: "取消预占", color: "bg-gray-100 text-gray-800" },
  { value: "CHECKOUT_BORROW", label: "领用出库", color: "bg-orange-100 text-orange-800" },
  { value: "RETURN_CHECKIN", label: "归还入库", color: "bg-teal-100 text-teal-800" },
  { value: "SHIP_OUT", label: "寄出", color: "bg-purple-100 text-purple-800" },
  { value: "DELIVER_SIGNED", label: "签收", color: "bg-indigo-100 text-indigo-800" },
  { value: "STOCKTAKE", label: "盘点", color: "bg-pink-100 text-pink-800" },
  { value: "DISPOSAL", label: "处置", color: "bg-red-100 text-red-800" },
  { value: "RETURN_SUPPLIER", label: "退货", color: "bg-rose-100 text-rose-800" },
] as const

const SITES = [
  { value: "all", label: "全部站点" },
  { value: "shenzhen", label: "深圳" },
  { value: "jakarta", label: "雅加达" },
]

const SOURCE_DOC_TYPES = [
  { value: "all", label: "全部来源" },
  { value: "use_request", label: "使用申请" },
  { value: "shipment", label: "寄出单" },
  { value: "stocktake", label: "盘点单" },
  { value: "return_doc", label: "退货单" },
  { value: "work_item", label: "工作项实例" },
]

const mockLedgerEvents = [
  {
    eventId: "EV-20260115-001",
    eventType: "RECEIVE_ARRIVAL",
    eventAt: "2026-01-15 09:30:00",
    site: "shenzhen",
    sampleAssetId: "SA-001",
    sampleCode: "SY-2026-001",
    sampleName: "印尼风格碎花连衣裙-样衣A",
    qty: 1,
    fromLocationType: "SUPPLIER",
    fromLocationId: "供应商-华南织造",
    toLocationType: "SITE_DOCK",
    toLocationId: "深圳仓-收货区",
    holderId: null,
    toPartyId: null,
    operator: "样管-李娜",
    sourceDocType: "work_item",
    sourceDocId: "WI-PRJ001-005",
    sourceDocName: "首单样衣制作",
    useRequestId: null,
    projectId: "PRJ-20260110-001",
    projectName: "印尼风格碎花连衣裙",
    workItemInstanceId: "WI-PRJ001-005",
    expectedReturnAt: null,
    carrier: "顺丰",
    trackingNo: "SF1234567890",
    attachments: [
      { name: "签收单.jpg", type: "image", url: "/mock/signed_001.jpg" },
      { name: "包裹照片.jpg", type: "image", url: "/mock/package_001.jpg" },
    ],
    remark: "外包装完好，已核对数量",
    isVoided: false,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdAt: "2026-01-15 09:31:00",
    createdBy: "样管-李娜",
    inventoryImpact: "建立样衣资产记录，状态：待核对入库",
  },
  {
    eventId: "EV-20260115-002",
    eventType: "CHECKIN_VERIFY",
    eventAt: "2026-01-15 10:15:00",
    site: "shenzhen",
    sampleAssetId: "SA-001",
    sampleCode: "SY-2026-001",
    sampleName: "印尼风格碎花连衣裙-样衣A",
    qty: 1,
    fromLocationType: "SITE_DOCK",
    fromLocationId: "深圳仓-收货区",
    toLocationType: "WAREHOUSE_BIN",
    toLocationId: "深圳仓-A1-03",
    holderId: null,
    toPartyId: null,
    operator: "样管-李娜",
    sourceDocType: "work_item",
    sourceDocId: "WI-PRJ001-005",
    sourceDocName: "首单样衣制作",
    useRequestId: null,
    projectId: "PRJ-20260110-001",
    projectName: "印尼风格碎花连衣裙",
    workItemInstanceId: "WI-PRJ001-005",
    expectedReturnAt: null,
    carrier: null,
    trackingNo: null,
    attachments: [
      { name: "样衣正面照.jpg", type: "image", url: "/mock/sample_front_001.jpg" },
      { name: "尺寸核对表.pdf", type: "pdf", url: "/mock/size_check_001.pdf" },
    ],
    remark: "尺码M，面料雪纺，工艺核对无异常",
    isVoided: false,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdAt: "2026-01-15 10:16:00",
    createdBy: "样管-李娜",
    inventoryImpact: "库存状态：在库-可用，库位：A1-03",
  },
  {
    eventId: "EV-20260115-003",
    eventType: "RESERVE_LOCK",
    eventAt: "2026-01-15 14:00:00",
    site: "shenzhen",
    sampleAssetId: "SA-001",
    sampleCode: "SY-2026-001",
    sampleName: "印尼风格碎花连衣裙-样衣A",
    qty: 1,
    fromLocationType: "WAREHOUSE_BIN",
    fromLocationId: "深圳仓-A1-03",
    toLocationType: "WAREHOUSE_BIN",
    toLocationId: "深圳仓-A1-03",
    holderId: "直播团队-A组",
    toPartyId: "直播团队-A组",
    operator: "系统",
    sourceDocType: "use_request",
    sourceDocId: "UR-20260115-001",
    sourceDocName: "直播测款申请",
    useRequestId: "UR-20260115-001",
    projectId: "PRJ-20260110-001",
    projectName: "印尼风格碎花连衣裙",
    workItemInstanceId: "WI-PRJ001-008",
    expectedReturnAt: "2026-01-20 18:00:00",
    carrier: null,
    trackingNo: null,
    attachments: [],
    remark: "直播测款预占，预计归还：2026-01-20",
    isVoided: false,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdAt: "2026-01-15 14:01:00",
    createdBy: "系统",
    inventoryImpact: "库存状态：在库-被预占，占用方：直播团队-A组",
  },
  {
    eventId: "EV-20260116-001",
    eventType: "CHECKOUT_BORROW",
    eventAt: "2026-01-16 09:00:00",
    site: "shenzhen",
    sampleAssetId: "SA-001",
    sampleCode: "SY-2026-001",
    sampleName: "印尼风格碎花连衣裙-样衣A",
    qty: 1,
    fromLocationType: "WAREHOUSE_BIN",
    fromLocationId: "深圳仓-A1-03",
    toLocationType: "PERSON",
    toLocationId: "主播-小美",
    holderId: "主播-小美",
    toPartyId: "主播-小美",
    operator: "样管-张明",
    sourceDocType: "use_request",
    sourceDocId: "UR-20260115-001",
    sourceDocName: "直播测款申请",
    useRequestId: "UR-20260115-001",
    projectId: "PRJ-20260110-001",
    projectName: "印尼风格碎花连衣裙",
    workItemInstanceId: "WI-PRJ001-008",
    expectedReturnAt: "2026-01-20 18:00:00",
    carrier: null,
    trackingNo: null,
    attachments: [{ name: "交接确认单.jpg", type: "image", url: "/mock/handover_001.jpg" }],
    remark: "领用人：主播-小美，交接方式：当面交接",
    isVoided: false,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdAt: "2026-01-16 09:01:00",
    createdBy: "样管-张明",
    inventoryImpact: "库存状态：领用中，持有人：主播-小美",
  },
  {
    eventId: "EV-20260116-002",
    eventType: "SHIP_OUT",
    eventAt: "2026-01-16 14:30:00",
    site: "shenzhen",
    sampleAssetId: "SA-002",
    sampleCode: "SY-2026-002",
    sampleName: "Y2K银色亮片短裙-样衣A",
    qty: 1,
    fromLocationType: "WAREHOUSE_BIN",
    fromLocationId: "深圳仓-B2-01",
    toLocationType: "ORG",
    toLocationId: "雅加达直播间",
    holderId: null,
    toPartyId: "雅加达直播间",
    operator: "样管-王芳",
    sourceDocType: "shipment",
    sourceDocId: "SH-20260116-001",
    sourceDocName: "跨站点寄送",
    useRequestId: null,
    projectId: "PRJ-20260108-003",
    projectName: "Y2K银色亮片短裙",
    workItemInstanceId: "WI-PRJ003-012",
    expectedReturnAt: null,
    carrier: "DHL",
    trackingNo: "DHL9876543210",
    attachments: [{ name: "快递面单.pdf", type: "pdf", url: "/mock/waybill_001.pdf" }],
    remark: "寄送至雅加达直播间，预计2天到达",
    isVoided: false,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdAt: "2026-01-16 14:31:00",
    createdBy: "样管-王芳",
    inventoryImpact: "库存状态：在途，目的地：雅加达直播间",
  },
  {
    eventId: "EV-20260117-001",
    eventType: "DELIVER_SIGNED",
    eventAt: "2026-01-17 16:00:00",
    site: "jakarta",
    sampleAssetId: "SA-002",
    sampleCode: "SY-2026-002",
    sampleName: "Y2K银色亮片短裙-样衣A",
    qty: 1,
    fromLocationType: "IN_TRANSIT",
    fromLocationId: "DHL9876543210",
    toLocationType: "SITE_DOCK",
    toLocationId: "雅加达仓-收货区",
    holderId: null,
    toPartyId: null,
    operator: "仓管-Andi",
    sourceDocType: "shipment",
    sourceDocId: "SH-20260116-001",
    sourceDocName: "跨站点寄送",
    useRequestId: null,
    projectId: "PRJ-20260108-003",
    projectName: "Y2K银色亮片短裙",
    workItemInstanceId: "WI-PRJ003-012",
    expectedReturnAt: null,
    carrier: "DHL",
    trackingNo: "DHL9876543210",
    attachments: [{ name: "签收照片.jpg", type: "image", url: "/mock/signed_002.jpg" }],
    remark: "雅加达仓管Andi签收",
    isVoided: false,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdAt: "2026-01-17 16:01:00",
    createdBy: "仓管-Andi",
    inventoryImpact: "库存状态：待核对入库（雅加达）",
  },
  {
    eventId: "EV-20260118-001",
    eventType: "STOCKTAKE",
    eventAt: "2026-01-18 10:00:00",
    site: "shenzhen",
    sampleAssetId: "SA-003",
    sampleCode: "SY-2026-003",
    sampleName: "基础款白色T恤-样衣A",
    qty: 1,
    fromLocationType: "WAREHOUSE_BIN",
    fromLocationId: "深圳仓-C1-05",
    toLocationType: "WAREHOUSE_BIN",
    toLocationId: "深圳仓-C1-05",
    holderId: null,
    toPartyId: null,
    operator: "样管-李娜",
    sourceDocType: "stocktake",
    sourceDocId: "ST-20260118-001",
    sourceDocName: "月度盘点-深圳仓",
    useRequestId: null,
    projectId: null,
    projectName: null,
    workItemInstanceId: null,
    expectedReturnAt: null,
    carrier: null,
    trackingNo: null,
    attachments: [{ name: "盘点照片.jpg", type: "image", url: "/mock/stocktake_001.jpg" }],
    remark: "盘点结果：系统1件，实际1件，无差异",
    isVoided: false,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdAt: "2026-01-18 10:01:00",
    createdBy: "样管-李娜",
    inventoryImpact: "盘点确认，无差异",
    stocktakeResult: { systemQty: 1, countQty: 1, diffQty: 0 },
  },
  {
    eventId: "EV-20260118-002",
    eventType: "STOCKTAKE",
    eventAt: "2026-01-18 10:15:00",
    site: "shenzhen",
    sampleAssetId: "SA-004",
    sampleCode: "SY-2026-004",
    sampleName: "度假风露背上衣-样衣A",
    qty: 1,
    fromLocationType: "WAREHOUSE_BIN",
    fromLocationId: "深圳仓-A3-02",
    toLocationType: "WAREHOUSE_BIN",
    toLocationId: "深圳仓-A3-02",
    holderId: null,
    toPartyId: null,
    operator: "样管-李娜",
    sourceDocType: "stocktake",
    sourceDocId: "ST-20260118-001",
    sourceDocName: "月度盘点-深圳仓",
    useRequestId: null,
    projectId: null,
    projectName: null,
    workItemInstanceId: null,
    expectedReturnAt: null,
    carrier: null,
    trackingNo: null,
    attachments: [{ name: "盘点差异照片.jpg", type: "image", url: "/mock/stocktake_diff_001.jpg" }],
    remark: "盘点结果：系统1件，实际0件，差异-1件，待追踪",
    isVoided: false,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdAt: "2026-01-18 10:16:00",
    createdBy: "样管-李娜",
    inventoryImpact: "盘点差异，需追踪处理",
    stocktakeResult: { systemQty: 1, countQty: 0, diffQty: -1 },
  },
  {
    eventId: "EV-20260119-001",
    eventType: "RETURN_CHECKIN",
    eventAt: "2026-01-19 11:00:00",
    site: "shenzhen",
    sampleAssetId: "SA-001",
    sampleCode: "SY-2026-001",
    sampleName: "印尼风格碎花连衣裙-样衣A",
    qty: 1,
    fromLocationType: "PERSON",
    fromLocationId: "主播-小美",
    toLocationType: "WAREHOUSE_BIN",
    toLocationId: "深圳仓-A1-03",
    holderId: null,
    toPartyId: null,
    operator: "样管-张明",
    sourceDocType: "use_request",
    sourceDocId: "UR-20260115-001",
    sourceDocName: "直播测款申请",
    useRequestId: "UR-20260115-001",
    projectId: "PRJ-20260110-001",
    projectName: "印尼风格碎花连衣裙",
    workItemInstanceId: "WI-PRJ001-008",
    expectedReturnAt: "2026-01-20 18:00:00",
    carrier: null,
    trackingNo: null,
    attachments: [{ name: "归还确认单.jpg", type: "image", url: "/mock/return_001.jpg" }],
    remark: "主播-小美归还，样衣完好，提前归还",
    isVoided: false,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdAt: "2026-01-19 11:01:00",
    createdBy: "样管-张明",
    inventoryImpact: "库存状态：在库-可用，释放占用",
  },
  {
    eventId: "EV-20260119-002",
    eventType: "DISPOSAL",
    eventAt: "2026-01-19 15:00:00",
    site: "shenzhen",
    sampleAssetId: "SA-005",
    sampleCode: "SY-2025-088",
    sampleName: "过季款连衣裙-样衣A",
    qty: 1,
    fromLocationType: "WAREHOUSE_BIN",
    fromLocationId: "深圳仓-D1-01",
    toLocationType: "DISPOSAL",
    toLocationId: "报废处理",
    holderId: null,
    toPartyId: null,
    operator: "样管-王芳",
    sourceDocType: "return_doc",
    sourceDocId: "RD-20260119-001",
    sourceDocName: "样衣报废处理",
    useRequestId: null,
    projectId: "PRJ-20250801-015",
    projectName: "过季款连衣裙",
    workItemInstanceId: null,
    expectedReturnAt: null,
    carrier: null,
    trackingNo: null,
    attachments: [
      { name: "报废审批单.pdf", type: "pdf", url: "/mock/disposal_approval_001.pdf" },
      { name: "报废照片.jpg", type: "image", url: "/mock/disposal_photo_001.jpg" },
    ],
    remark: "过季样衣报废处理，已获审批",
    isVoided: false,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdAt: "2026-01-19 15:01:00",
    createdBy: "样管-王芳",
    inventoryImpact: "库存终止，状态：已处置",
  },
  {
    eventId: "EV-20260119-003",
    eventType: "RETURN_SUPPLIER",
    eventAt: "2026-01-19 16:30:00",
    site: "shenzhen",
    sampleAssetId: "SA-006",
    sampleCode: "SY-2026-006",
    sampleName: "质量问题针织衫-样衣A",
    qty: 1,
    fromLocationType: "WAREHOUSE_BIN",
    fromLocationId: "深圳仓-B3-02",
    toLocationType: "SUPPLIER",
    toLocationId: "供应商-优品针织",
    holderId: null,
    toPartyId: "供应商-优品针织",
    operator: "样管-张明",
    sourceDocType: "return_doc",
    sourceDocId: "RD-20260119-002",
    sourceDocName: "质量问题退货",
    useRequestId: null,
    projectId: "PRJ-20260105-008",
    projectName: "基础款针织衫",
    workItemInstanceId: null,
    expectedReturnAt: null,
    carrier: "顺丰",
    trackingNo: "SF0987654321",
    attachments: [
      { name: "退货申请单.pdf", type: "pdf", url: "/mock/return_request_001.pdf" },
      { name: "质量问题照片.jpg", type: "image", url: "/mock/quality_issue_001.jpg" },
    ],
    remark: "针织缝线质量问题，退回供应商处理",
    isVoided: false,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdAt: "2026-01-19 16:31:00",
    createdBy: "样管-张明",
    inventoryImpact: "库存终止，状态：已退货",
  },
  {
    eventId: "EV-20260120-001",
    eventType: "CANCEL_RESERVE",
    eventAt: "2026-01-20 09:00:00",
    site: "shenzhen",
    sampleAssetId: "SA-007",
    sampleCode: "SY-2026-007",
    sampleName: "改版款短裙-样衣A",
    qty: 1,
    fromLocationType: "WAREHOUSE_BIN",
    fromLocationId: "深圳仓-A2-04",
    toLocationType: "WAREHOUSE_BIN",
    toLocationId: "深圳仓-A2-04",
    holderId: null,
    toPartyId: null,
    operator: "系统",
    sourceDocType: "use_request",
    sourceDocId: "UR-20260118-003",
    sourceDocName: "短视频拍摄申请",
    useRequestId: "UR-20260118-003",
    projectId: "PRJ-20260112-005",
    projectName: "改版款短裙",
    workItemInstanceId: "WI-PRJ005-006",
    expectedReturnAt: null,
    carrier: null,
    trackingNo: null,
    attachments: [],
    remark: "申请被取消，释放预占",
    isVoided: false,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdAt: "2026-01-20 09:01:00",
    createdBy: "系统",
    inventoryImpact: "库存状态：在库-可用，释放预占",
  },
]

const voidedEvent = {
  eventId: "EV-20260115-099",
  eventType: "CHECKIN_VERIFY",
  eventAt: "2026-01-15 11:00:00",
  site: "shenzhen",
  sampleAssetId: "SA-001",
  sampleCode: "SY-2026-001",
  sampleName: "印尼风格碎花连衣裙-样衣A",
  qty: 1,
  fromLocationType: "SITE_DOCK",
  fromLocationId: "深圳仓-收货区",
  toLocationType: "WAREHOUSE_BIN",
  toLocationId: "深圳仓-A1-01",
  holderId: null,
  toPartyId: null,
  operator: "样管-李娜",
  sourceDocType: "work_item",
  sourceDocId: "WI-PRJ001-005",
  sourceDocName: "首单样衣制作",
  useRequestId: null,
  projectId: "PRJ-20260110-001",
  projectName: "印尼风格碎花连衣裙",
  workItemInstanceId: "WI-PRJ001-005",
  expectedReturnAt: null,
  carrier: null,
  trackingNo: null,
  attachments: [],
  remark: "错误录入库位",
  isVoided: true,
  voidReason: "库位录入错误，实际库位为A1-03",
  voidedBy: "样管-李娜",
  voidedAt: "2026-01-15 11:30:00",
  createdAt: "2026-01-15 11:01:00",
  createdBy: "样管-李娜",
  inventoryImpact: "【已作废】",
  correctsEventId: "EV-20260115-002",
}

const allEvents = [...mockLedgerEvents, voidedEvent].sort(
  (a, b) => new Date(b.eventAt).getTime() - new Date(a.eventAt).getTime(),
)

export default function SampleLedgerPage() {
  const [search, setSearch] = useState("")
  const [site, setSite] = useState("all")
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([])
  const [sourceDocType, setSourceDocType] = useState("all")
  const [timeRange, setTimeRange] = useState("7d")
  const [showVoided, setShowVoided] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<(typeof allEvents)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [voidDialogOpen, setVoidDialogOpen] = useState(false)
  const [voidReason, setVoidReason] = useState("")
  const [eventTypeFilterOpen, setEventTypeFilterOpen] = useState(false)

  const filteredEvents = useMemo(() => {
    return allEvents.filter((event) => {
      if (!showVoided && event.isVoided) return false
      if (
        search &&
        !event.sampleCode.toLowerCase().includes(search.toLowerCase()) &&
        !event.sampleName.toLowerCase().includes(search.toLowerCase()) &&
        !event.eventId.toLowerCase().includes(search.toLowerCase())
      )
        return false
      if (site !== "all" && event.site !== site) return false
      if (selectedEventTypes.length > 0 && !selectedEventTypes.includes(event.eventType)) return false
      if (sourceDocType !== "all" && event.sourceDocType !== sourceDocType) return false
      return true
    })
  }, [search, site, selectedEventTypes, sourceDocType, showVoided])

  const stats = useMemo(() => {
    const today = allEvents.filter((e) => !e.isVoided && e.eventAt.startsWith("2026-01-20")).length
    const anomaly = allEvents.filter(
      (e) => !e.isVoided && e.stocktakeResult?.diffQty !== undefined && e.stocktakeResult.diffQty !== 0,
    ).length
    const inTransit = allEvents.filter((e) => !e.isVoided && e.eventType === "SHIP_OUT").length
    const voided = allEvents.filter((e) => e.isVoided).length
    return { today, anomaly, inTransit, voided, total: allEvents.filter((e) => !e.isVoided).length }
  }, [])

  const getEventTypeInfo = (type: string) => {
    return EVENT_TYPES.find((t) => t.value === type) || { label: type, color: "bg-gray-100 text-gray-800" }
  }

  const getSiteLabel = (siteCode: string) => {
    return siteCode === "shenzhen" ? "深圳" : siteCode === "jakarta" ? "雅加达" : siteCode
  }

  const handleViewDetail = (event: (typeof allEvents)[0]) => {
    setSelectedEvent(event)
    setDetailOpen(true)
  }

  const handleVoidEvent = () => {
    if (!voidReason.trim()) {
      toast.error("请填写作废原因")
      return
    }
    toast.success(`事件 ${selectedEvent?.eventId} 已作废`)
    setVoidDialogOpen(false)
    setVoidReason("")
    setDetailOpen(false)
  }

  const handleExport = () => {
    toast.success(`已导出 ${filteredEvents.length} 条台账记录`)
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
              <h1 className="text-2xl font-bold">样衣台账</h1>
              <p className="text-muted-foreground text-sm mt-1">样衣资产的不可篡改事实账，记录全链路流转事件</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => toast.success("数据已刷新")}>
                <RefreshCw className="h-4 w-4 mr-1" />
                刷新
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />
                导出
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-5 gap-4">
            <Card className="cursor-pointer hover:border-primary" onClick={() => {}}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">全部事件</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary" onClick={() => {}}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">{stats.today}</div>
                <div className="text-sm text-muted-foreground">今日新增</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary" onClick={() => {}}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-purple-600">{stats.inTransit}</div>
                <div className="text-sm text-muted-foreground">在途中</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary" onClick={() => {}}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-orange-600">{stats.anomaly}</div>
                <div className="text-sm text-muted-foreground">盘点差异</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary" onClick={() => setShowVoided(!showVoided)}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-gray-500">{stats.voided}</div>
                <div className="text-sm text-muted-foreground">已作废</div>
              </CardContent>
            </Card>
          </div>

          {/* Filter Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索样衣编号/名称/事件ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={site} onValueChange={setSite}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SITES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-[120px]">
                    <Calendar className="h-4 w-4 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">今天</SelectItem>
                    <SelectItem value="7d">近7天</SelectItem>
                    <SelectItem value="30d">近30天</SelectItem>
                    <SelectItem value="custom">自定义</SelectItem>
                  </SelectContent>
                </Select>
                <Popover open={eventTypeFilterOpen} onOpenChange={setEventTypeFilterOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="min-w-[140px] bg-transparent">
                      <Filter className="h-4 w-4 mr-1" />
                      事件类型
                      {selectedEventTypes.length > 0 && (
                        <Badge variant="secondary" className="ml-1">
                          {selectedEventTypes.length}
                        </Badge>
                      )}
                      <ChevronDown className="h-4 w-4 ml-1" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[240px] p-2">
                    <div className="space-y-2">
                      {EVENT_TYPES.map((type) => (
                        <div key={type.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={type.value}
                            checked={selectedEventTypes.includes(type.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedEventTypes([...selectedEventTypes, type.value])
                              } else {
                                setSelectedEventTypes(selectedEventTypes.filter((t) => t !== type.value))
                              }
                            }}
                          />
                          <label htmlFor={type.value} className="text-sm cursor-pointer flex-1">
                            <Badge className={type.color}>{type.label}</Badge>
                          </label>
                        </div>
                      ))}
                      <div className="pt-2 border-t flex justify-between">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedEventTypes([])}>
                          清除
                        </Button>
                        <Button size="sm" onClick={() => setEventTypeFilterOpen(false)}>
                          确定
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <Select value={sourceDocType} onValueChange={setSourceDocType}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_DOC_TYPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showVoided"
                    checked={showVoided}
                    onCheckedChange={(checked) => setShowVoided(!!checked)}
                  />
                  <label htmlFor="showVoided" className="text-sm cursor-pointer">
                    显示已作废
                  </label>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("")
                    setSite("all")
                    setSelectedEventTypes([])
                    setSourceDocType("all")
                    setTimeRange("7d")
                    setShowVoided(false)
                  }}
                >
                  重置
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">时间</TableHead>
                    <TableHead className="w-[80px]">站点</TableHead>
                    <TableHead className="w-[200px]">样衣</TableHead>
                    <TableHead className="w-[100px]">事件类型</TableHead>
                    <TableHead className="w-[200px]">位置/去向</TableHead>
                    <TableHead className="w-[120px]">持有人/目的方</TableHead>
                    <TableHead className="w-[180px]">来源单据</TableHead>
                    <TableHead className="w-[150px]">项目/工作项</TableHead>
                    <TableHead className="w-[100px]">操作人</TableHead>
                    <TableHead className="w-[80px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => {
                    const typeInfo = getEventTypeInfo(event.eventType)
                    return (
                      <TableRow key={event.eventId} className={event.isVoided ? "opacity-50 bg-gray-50" : ""}>
                        <TableCell>
                          <div className="text-sm">{event.eventAt}</div>
                          <div className="text-xs text-muted-foreground">{event.eventId}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getSiteLabel(event.site)}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{event.sampleCode}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[180px]">{event.sampleName}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={typeInfo.color}>
                            {event.isVoided && <X className="h-3 w-3 mr-1" />}
                            {typeInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm flex items-center gap-1">
                            <span className="truncate max-w-[80px]">{event.fromLocationId}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="truncate max-w-[80px]">{event.toLocationId}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {event.holderId || event.toPartyId ? (
                            <span className="text-sm">{event.holderId || event.toPartyId}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {event.sourceDocId ? (
                            <div>
                              <Button
                                variant="link"
                                className="p-0 h-auto text-sm"
                                onClick={() => toast.info(`打开单据: ${event.sourceDocId}`)}
                              >
                                {event.sourceDocId}
                              </Button>
                              <div className="text-xs text-muted-foreground">{event.sourceDocName}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {event.projectId ? (
                            <div>
                              <Button
                                variant="link"
                                className="p-0 h-auto text-xs"
                                onClick={() => toast.info(`打开项目: ${event.projectId}`)}
                              >
                                {event.projectId}
                              </Button>
                              {event.expectedReturnAt && (
                                <div className="text-xs text-orange-600">
                                  <Clock className="h-3 w-3 inline mr-1" />
                                  预计归还: {event.expectedReturnAt.split(" ")[0]}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{event.operator}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleViewDetail(event)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">共 {filteredEvents.length} 条记录</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                上一页
              </Button>
              <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">
                1
              </Button>
              <Button variant="outline" size="sm" disabled>
                下一页
              </Button>
            </div>
          </div>
        </main>
      </div>

      {/* L2 - Event Detail Drawer */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          {selectedEvent && (
            <>
              <SheetHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={getEventTypeInfo(selectedEvent.eventType).color}>
                      {selectedEvent.isVoided && <X className="h-3 w-3 mr-1" />}
                      {getEventTypeInfo(selectedEvent.eventType).label}
                    </Badge>
                    {selectedEvent.isVoided && <Badge variant="destructive">已作废</Badge>}
                  </div>
                </div>
                <SheetTitle className="text-left">
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      variant="link"
                      className="p-0 h-auto text-lg font-semibold"
                      onClick={() => toast.info(`打开样衣详情: ${selectedEvent.sampleCode}`)}
                    >
                      {selectedEvent.sampleCode}
                    </Button>
                    <Badge variant="outline">{getSiteLabel(selectedEvent.site)}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground font-normal mt-1">{selectedEvent.eventAt}</div>
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* 基本信息 */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    基本信息
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">事件ID</div>
                      <div className="font-mono">{selectedEvent.eventId}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">事件时间</div>
                      <div>{selectedEvent.eventAt}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">站点</div>
                      <div>{getSiteLabel(selectedEvent.site)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">操作人</div>
                      <div>{selectedEvent.operator}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-muted-foreground">样衣</div>
                      <div>
                        {selectedEvent.sampleCode} - {selectedEvent.sampleName}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 位置与去向 */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    位置与去向
                  </h3>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground mb-1">{selectedEvent.fromLocationType}</div>
                        <div className="font-medium">{selectedEvent.fromLocationId}</div>
                      </div>
                      <div className="flex-1 flex items-center justify-center">
                        <div className="h-px bg-border flex-1" />
                        <div className="px-2 text-muted-foreground">→</div>
                        <div className="h-px bg-border flex-1" />
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground mb-1">{selectedEvent.toLocationType}</div>
                        <div className="font-medium">{selectedEvent.toLocationId}</div>
                      </div>
                    </div>
                    {(selectedEvent.carrier || selectedEvent.trackingNo) && (
                      <div className="mt-3 pt-3 border-t text-sm">
                        <div className="flex gap-4">
                          {selectedEvent.carrier && <span>承运商: {selectedEvent.carrier}</span>}
                          {selectedEvent.trackingNo && <span>运单号: {selectedEvent.trackingNo}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 来源与绑定 */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    来源与绑定
                  </h3>
                  <div className="space-y-2 text-sm">
                    {selectedEvent.sourceDocId && (
                      <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <span className="text-muted-foreground">来源单据</span>
                        <Button
                          variant="link"
                          className="p-0 h-auto"
                          onClick={() => toast.info(`打开单据: ${selectedEvent.sourceDocId}`)}
                        >
                          {selectedEvent.sourceDocId} - {selectedEvent.sourceDocName}
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    )}
                    {selectedEvent.useRequestId && (
                      <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <span className="text-muted-foreground">使用申请</span>
                        <Button
                          variant="link"
                          className="p-0 h-auto"
                          onClick={() => toast.info(`打开申请: ${selectedEvent.useRequestId}`)}
                        >
                          {selectedEvent.useRequestId}
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    )}
                    {selectedEvent.projectId && (
                      <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <span className="text-muted-foreground">关联项目</span>
                        <Button
                          variant="link"
                          className="p-0 h-auto"
                          onClick={() => toast.info(`打开项目: ${selectedEvent.projectId}`)}
                        >
                          {selectedEvent.projectId} - {selectedEvent.projectName}
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    )}
                    {selectedEvent.workItemInstanceId && (
                      <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <span className="text-muted-foreground">工作项实例</span>
                        <Button
                          variant="link"
                          className="p-0 h-auto"
                          onClick={() => toast.info(`打开工作项: ${selectedEvent.workItemInstanceId}`)}
                        >
                          {selectedEvent.workItemInstanceId}
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    )}
                    {selectedEvent.expectedReturnAt && (
                      <div className="flex items-center justify-between p-2 bg-orange-50 rounded">
                        <span className="text-muted-foreground">预计归还时间</span>
                        <span className="text-orange-600 font-medium">{selectedEvent.expectedReturnAt}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 盘点结果 (if applicable) */}
                {selectedEvent.stocktakeResult && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      盘点结果
                    </h3>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-3 bg-muted/50 rounded">
                        <div className="text-2xl font-bold">{selectedEvent.stocktakeResult.systemQty}</div>
                        <div className="text-xs text-muted-foreground">系统数量</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded">
                        <div className="text-2xl font-bold">{selectedEvent.stocktakeResult.countQty}</div>
                        <div className="text-xs text-muted-foreground">实盘数量</div>
                      </div>
                      <div
                        className={`p-3 rounded ${selectedEvent.stocktakeResult.diffQty !== 0 ? "bg-red-50" : "bg-green-50"}`}
                      >
                        <div
                          className={`text-2xl font-bold ${selectedEvent.stocktakeResult.diffQty !== 0 ? "text-red-600" : "text-green-600"}`}
                        >
                          {selectedEvent.stocktakeResult.diffQty > 0 ? "+" : ""}
                          {selectedEvent.stocktakeResult.diffQty}
                        </div>
                        <div className="text-xs text-muted-foreground">差异</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 证据与附件 */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Archive className="h-4 w-4" />
                    证据与附件
                  </h3>
                  {selectedEvent.attachments && selectedEvent.attachments.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {selectedEvent.attachments.map((att, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2 border rounded hover:bg-muted/50 cursor-pointer"
                          onClick={() => toast.info(`查看附件: ${att.name}`)}
                        >
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm truncate">{att.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">暂无附件</div>
                  )}
                </div>

                {/* 备注 */}
                {selectedEvent.remark && (
                  <div>
                    <h3 className="font-semibold mb-2">备注</h3>
                    <div className="text-sm bg-muted/50 p-3 rounded">{selectedEvent.remark}</div>
                  </div>
                )}

                {/* 系统影响 */}
                <div>
                  <h3 className="font-semibold mb-2">系统影响</h3>
                  <div className="text-sm bg-blue-50 text-blue-800 p-3 rounded">{selectedEvent.inventoryImpact}</div>
                </div>

                {/* 作废信息 */}
                {selectedEvent.isVoided && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="font-semibold text-red-800 mb-2">作废信息</h3>
                    <div className="text-sm space-y-1">
                      <div>
                        <span className="text-muted-foreground">作废原因：</span>
                        {selectedEvent.voidReason}
                      </div>
                      <div>
                        <span className="text-muted-foreground">作废人：</span>
                        {selectedEvent.voidedBy}
                      </div>
                      <div>
                        <span className="text-muted-foreground">作废时间：</span>
                        {selectedEvent.voidedAt}
                      </div>
                      {selectedEvent.correctsEventId && (
                        <div>
                          <span className="text-muted-foreground">更正事件：</span>
                          <Button
                            variant="link"
                            className="p-0 h-auto text-sm"
                            onClick={() => toast.info(`查看更正事件: ${selectedEvent.correctsEventId}`)}
                          >
                            {selectedEvent.correctsEventId}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 审计信息 */}
                <div className="text-xs text-muted-foreground border-t pt-4">
                  <div>创建时间: {selectedEvent.createdAt}</div>
                  <div>创建人: {selectedEvent.createdBy}</div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="mt-6 pt-4 border-t flex items-center justify-between">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast.info(`打开来源单据: ${selectedEvent.sourceDocId}`)}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    打开来源单据
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedEvent.eventId)
                      toast.success("已复制事件ID")
                    }}
                  >
                    复制事件ID
                  </Button>
                </div>
                {!selectedEvent.isVoided && (
                  <Button variant="destructive" size="sm" onClick={() => setVoidDialogOpen(true)}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    作废事件
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Void Event Dialog */}
      <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>作废事件</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
              <AlertTriangle className="h-4 w-4 inline mr-1 text-yellow-600" />
              作废后该事件将被标记为无效，但不会从系统中删除。如需更正，请在作废后追加一条正确事件。
            </div>
            <div>
              <Label>
                作废原因 <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder="请输入作废原因..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleVoidEvent}>
              确认作废
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
