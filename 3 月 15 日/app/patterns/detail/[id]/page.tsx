"use client"

import type React from "react"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Edit,
  ExternalLink,
  Eye,
  FileText,
  GitBranch,
  GitCompare,
  History,
  Lock,
  MoreHorizontal,
  Plus,
  Scissors,
  Settings,
  Upload,
  CheckCircle,
  Snowflake,
  Layers,
  Ruler,
  Package,
  Workflow,
  ArrowRight,
} from "lucide-react"
import Link from "next/link"

const getPatternTaskDetail = (id: string) => {
  return {
    id: id,
    name: "V领印花连衣裙-初版制版",
    projectId: "PRJ-20251216-001",
    projectName: "印尼风格碎花连衣裙",
    workItemId: "WI-PRJ001-010",
    workItemName: "制版准备",
    patternType: "初版",
    status: "进行中",
    currentVersion: "V2.1",
    versionStatus: "已通过",
    source: "深圳打样",
    relatedSamplingTask: "ST-001",
    technicalOwner: "王版师",
    creator: "张三",
    createTime: "2025-12-10 09:30",
    lastUpdateTime: "2025-12-18 14:30",
    styleType: "设计款",
    category: "裙装 / 连衣裙",
    team: "深圳团队",
    remark: "基于测款样衣反馈进行优化，重点调整腰部版型",

    // 版本列表
    versions: [
      {
        version: "V2.1",
        status: "已通过",
        isActive: true,
        changeReason: "根据试穿反馈调整腰部收省位置",
        creator: "王版师",
        createTime: "2025-12-18 14:30",
      },
      {
        version: "V2",
        status: "已废弃",
        isActive: false,
        changeReason: "优化袖笼弧线，调整领口深度",
        creator: "王版师",
        createTime: "2025-12-15 10:00",
      },
      {
        version: "V1",
        status: "已废弃",
        isActive: false,
        changeReason: "初版制版",
        creator: "王版师",
        createTime: "2025-12-10 09:30",
      },
    ],

    bom: {
      version: "BOM-V2.1",
      status: "已确认",
      targetCost: 45.0,
      actualCost: 42.8,
      items: [
        {
          id: "BOM-001",
          materialType: "面料",
          materialSKU: "FAB-PRINT-001",
          materialName: "印花梭织布",
          colorSpec: "热带花卉印花",
          usage: 1.8,
          unit: "米",
          lossRate: 5,
          unitCost: 18.0,
          totalCost: 34.02,
          relatedProcess: ["裁剪", "缝制"],
          relatedPattern: ["PTN-001", "PTN-002", "PTN-003"],
          remark: "需对花裁剪",
        },
        {
          id: "BOM-002",
          materialType: "辅料",
          materialSKU: "ACC-ZIP-001",
          materialName: "隐形拉链",
          colorSpec: "米白色 50cm",
          usage: 1,
          unit: "条",
          lossRate: 2,
          unitCost: 2.5,
          totalCost: 2.55,
          relatedProcess: ["缝制"],
          relatedPattern: ["PTN-001"],
          remark: "后中隐形拉链",
        },
        {
          id: "BOM-003",
          materialType: "辅料",
          materialSKU: "ACC-BTN-002",
          materialName: "珍珠扣",
          colorSpec: "白色 10mm",
          usage: 3,
          unit: "粒",
          lossRate: 5,
          unitCost: 0.8,
          totalCost: 2.52,
          relatedProcess: ["后整"],
          relatedPattern: [],
          remark: "袖口装饰扣",
        },
        {
          id: "BOM-004",
          materialType: "辅料",
          materialSKU: "ACC-LINING-001",
          materialName: "里布衬",
          colorSpec: "白色",
          usage: 0.3,
          unit: "米",
          lossRate: 3,
          unitCost: 5.0,
          totalCost: 1.55,
          relatedProcess: ["裁剪", "缝制"],
          relatedPattern: ["PTN-003"],
          remark: "领口贴边衬",
        },
        {
          id: "BOM-005",
          materialType: "包装",
          materialSKU: "PKG-BAG-001",
          materialName: "OPP包装袋",
          colorSpec: "透明 30x40cm",
          usage: 1,
          unit: "个",
          lossRate: 1,
          unitCost: 0.3,
          totalCost: 0.3,
          relatedProcess: ["包装"],
          relatedPattern: [],
          remark: "",
        },
        {
          id: "BOM-006",
          materialType: "包装",
          materialSKU: "PKG-TAG-001",
          materialName: "吊牌",
          colorSpec: "品牌吊牌",
          usage: 1,
          unit: "套",
          lossRate: 2,
          unitCost: 1.5,
          totalCost: 1.53,
          relatedProcess: ["包装"],
          relatedPattern: [],
          remark: "含主牌+洗水牌",
        },
      ],
    },

    patterns: [
      {
        id: "PTN-001",
        name: "前后主身片",
        type: "主身",
        position: "上身",
        cutQuantity: 2,
        isPrimary: true,
        format: "DXF",
        fileName: "main-body-v2.1.dxf",
        applicableSizes: ["S", "M", "L", "XL"],
        fabricLimit: "梭织面料，厚度≤0.8mm",
        relatedProcess: ["裁剪", "缝制", "熨烫"],
        remark: "含前后片、腰省，需对花",
      },
      {
        id: "PTN-002",
        name: "袖片",
        type: "袖",
        position: "上身",
        cutQuantity: 2,
        isPrimary: false,
        format: "DXF",
        fileName: "sleeve-v2.1.dxf",
        applicableSizes: ["S", "M", "L", "XL"],
        fabricLimit: "与主身同料",
        relatedProcess: ["裁剪", "缝制"],
        remark: "泡泡袖，袖山高调整",
      },
      {
        id: "PTN-003",
        name: "领口贴边",
        type: "领",
        position: "上身",
        cutQuantity: 2,
        isPrimary: false,
        format: "DXF",
        fileName: "collar-v2.1.dxf",
        applicableSizes: ["S", "M", "L", "XL"],
        fabricLimit: "与主身同料+衬布",
        relatedProcess: ["裁剪", "粘衬", "缝制"],
        remark: "V领贴边，需粘衬",
      },
      {
        id: "PTN-004",
        name: "侧袋布",
        type: "口袋",
        position: "下身",
        cutQuantity: 4,
        isPrimary: false,
        format: "PDF",
        fileName: "pocket-v2.1.pdf",
        applicableSizes: ["S", "M", "L", "XL"],
        fabricLimit: "里布",
        relatedProcess: ["裁剪", "缝制"],
        remark: "隐形侧袋，左右各2片",
      },
      {
        id: "PTN-005",
        name: "裙摆片",
        type: "主身",
        position: "下身",
        cutQuantity: 2,
        isPrimary: false,
        format: "DXF",
        fileName: "skirt-v2.1.dxf",
        applicableSizes: ["S", "M", "L", "XL"],
        fabricLimit: "梭织面料",
        relatedProcess: ["裁剪", "缝制", "熨烫"],
        remark: "A字裙摆，需对花",
      },
    ],

    processFlow: {
      stages: [
        {
          id: "STAGE-01",
          name: "裁剪准备",
          order: 1,
          processes: [
            {
              id: "PROC-01-01",
              name: "排料",
              techniques: [
                {
                  id: "TECH-01-01-01",
                  name: "对花排料",
                  requirements: "印花图案需对位，误差≤0.5cm",
                  relatedBOM: ["BOM-001"],
                  relatedPattern: ["PTN-001", "PTN-005"],
                },
              ],
            },
            {
              id: "PROC-01-02",
              name: "裁剪",
              techniques: [
                {
                  id: "TECH-01-02-01",
                  name: "自动裁床裁剪",
                  requirements: "裁片精度±0.2cm，毛边不超过0.3cm",
                  relatedBOM: ["BOM-001"],
                  relatedPattern: ["PTN-001", "PTN-002", "PTN-003", "PTN-004", "PTN-005"],
                },
                {
                  id: "TECH-01-02-02",
                  name: "手工修边",
                  requirements: "弧线部位需手工修整",
                  relatedBOM: [],
                  relatedPattern: ["PTN-002", "PTN-003"],
                },
              ],
            },
            {
              id: "PROC-01-03",
              name: "粘衬",
              techniques: [
                {
                  id: "TECH-01-03-01",
                  name: "领口粘衬",
                  requirements: "温度150°C，时间10秒，压力适中",
                  relatedBOM: ["BOM-004"],
                  relatedPattern: ["PTN-003"],
                },
              ],
            },
          ],
        },
        {
          id: "STAGE-02",
          name: "缝制",
          order: 2,
          processes: [
            {
              id: "PROC-02-01",
              name: "省道缝制",
              techniques: [
                {
                  id: "TECH-02-01-01",
                  name: "腰省缝制",
                  requirements: "省尖距腰线8cm，省道需烫倒向中心",
                  relatedBOM: [],
                  relatedPattern: ["PTN-001"],
                },
              ],
            },
            {
              id: "PROC-02-02",
              name: "侧缝合并",
              techniques: [
                {
                  id: "TECH-02-02-01",
                  name: "侧缝四线包缝",
                  requirements: "缝份1cm，包缝宽度0.5cm",
                  relatedBOM: [],
                  relatedPattern: ["PTN-001", "PTN-005"],
                },
                {
                  id: "TECH-02-02-02",
                  name: "侧袋口制作",
                  requirements: "袋口长度15cm，袋布与侧缝一体缝合",
                  relatedBOM: [],
                  relatedPattern: ["PTN-004"],
                },
              ],
            },
            {
              id: "PROC-02-03",
              name: "领口处理",
              techniques: [
                {
                  id: "TECH-02-03-01",
                  name: "V领贴边缝制",
                  requirements: "领口贴边宽3cm，走明线0.1cm",
                  relatedBOM: ["BOM-004"],
                  relatedPattern: ["PTN-003"],
                },
              ],
            },
            {
              id: "PROC-02-04",
              name: "袖子制作",
              techniques: [
                {
                  id: "TECH-02-04-01",
                  name: "泡泡袖抽褶",
                  requirements: "袖山抽褶量2-3cm，均匀分布",
                  relatedBOM: [],
                  relatedPattern: ["PTN-002"],
                },
                {
                  id: "TECH-02-04-02",
                  name: "上袖",
                  requirements: "袖笼弧线圆顺，无角点",
                  relatedBOM: [],
                  relatedPattern: ["PTN-002"],
                },
              ],
            },
            {
              id: "PROC-02-05",
              name: "拉链安装",
              techniques: [
                {
                  id: "TECH-02-05-01",
                  name: "隐形拉链安装",
                  requirements: "后中隐形拉链，拉链头距领口2cm",
                  relatedBOM: ["BOM-002"],
                  relatedPattern: ["PTN-001"],
                },
              ],
            },
            {
              id: "PROC-02-06",
              name: "下摆处理",
              techniques: [
                {
                  id: "TECH-02-06-01",
                  name: "下摆卷边",
                  requirements: "下摆卷边1cm，走暗线",
                  relatedBOM: [],
                  relatedPattern: ["PTN-005"],
                },
              ],
            },
          ],
        },
        {
          id: "STAGE-03",
          name: "后整",
          order: 3,
          processes: [
            {
              id: "PROC-03-01",
              name: "熨烫整形",
              techniques: [
                {
                  id: "TECH-03-01-01",
                  name: "省道熨烫",
                  requirements: "省道烫倒向中心，不可有褶皱",
                  relatedBOM: [],
                  relatedPattern: ["PTN-001"],
                },
                {
                  id: "TECH-03-01-02",
                  name: "整体熨烫",
                  requirements: "温度140°C，中压熨烫",
                  relatedBOM: [],
                  relatedPattern: [],
                },
              ],
            },
            {
              id: "PROC-03-02",
              name: "钉扣",
              techniques: [
                {
                  id: "TECH-03-02-01",
                  name: "袖口装饰扣",
                  requirements: "每袖3粒，间距1cm",
                  relatedBOM: ["BOM-003"],
                  relatedPattern: ["PTN-002"],
                },
              ],
            },
            {
              id: "PROC-03-03",
              name: "质检",
              techniques: [
                {
                  id: "TECH-03-03-01",
                  name: "尺寸检验",
                  requirements: "按成衣关键尺寸表检验",
                  relatedBOM: [],
                  relatedPattern: [],
                },
                {
                  id: "TECH-03-03-02",
                  name: "外观检验",
                  requirements: "检查印花对位、线头、污渍",
                  relatedBOM: [],
                  relatedPattern: [],
                },
              ],
            },
          ],
        },
        {
          id: "STAGE-04",
          name: "包装",
          order: 4,
          processes: [
            {
              id: "PROC-04-01",
              name: "挂吊牌",
              techniques: [
                {
                  id: "TECH-04-01-01",
                  name: "吊牌安装",
                  requirements: "主牌+洗水牌，挂于后领标",
                  relatedBOM: ["BOM-006"],
                  relatedPattern: [],
                },
              ],
            },
            {
              id: "PROC-04-02",
              name: "折叠包装",
              techniques: [
                {
                  id: "TECH-04-02-01",
                  name: "OPP袋包装",
                  requirements: "按标准折叠方式，正面朝上",
                  relatedBOM: ["BOM-005"],
                  relatedPattern: [],
                },
              ],
            },
          ],
        },
      ],
    },

    // 放码规则
    gradingRules: {
      id: "GRADE-001",
      baseSize: "M",
      sizeRange: ["XS", "S", "M", "L", "XL"],
      horizontalGrade: 4,
      verticalGrade: 2,
      gradingTable: [
        { part: "胸围", XS: "-8", S: "-4", M: "0", L: "+4", XL: "+8", unit: "cm" },
        { part: "腰围", XS: "-8", S: "-4", M: "0", L: "+4", XL: "+8", unit: "cm" },
        { part: "臀围", XS: "-8", S: "-4", M: "0", L: "+4", XL: "+8", unit: "cm" },
        { part: "衣长", XS: "-2", S: "-1", M: "0", L: "+1", XL: "+2", unit: "cm" },
        { part: "袖长", XS: "-1", S: "-0.5", M: "0", L: "+0.5", XL: "+1", unit: "cm" },
        { part: "肩宽", XS: "-2", S: "-1", M: "0", L: "+1", XL: "+2", unit: "cm" },
      ],
      specialNotes: "XS码袖山高减少0.5cm，XL码袖山高增加0.5cm，以保证袖型比例",
      gradingFiles: [
        { name: "放码规格表.xlsx", size: "45KB" },
        { name: "放码图纸.pdf", size: "1.2MB" },
      ],
    },

    // 下游使用情况
    downstreamUsage: {
      samplingTasks: [
        { id: "ST-001", name: "印花连衣裙首样", status: "已完成", version: "V2.1" },
        { id: "ST-002", name: "印花连衣裙改版样", status: "进行中", version: "V2.1" },
      ],
      samples: [
        { id: "SPL-001", name: "印花连衣裙样衣-M码", status: "在库", version: "V2" },
        { id: "SPL-008", name: "印花连衣裙样衣-L码", status: "在库", version: "V2.1" },
      ],
      productionOrders: [{ id: "PO-001", name: "印花连衣裙首单", quantity: 500, status: "待排产", version: "V2.1" }],
      skus: [
        { id: "SKU-001", name: "印花连衣裙-S-热带花卉", status: "待创建" },
        { id: "SKU-002", name: "印花连衣裙-M-热带花卉", status: "待创建" },
        { id: "SKU-003", name: "印花连衣裙-L-热带花卉", status: "待创建" },
      ],
    },

    // 操作日志
    logs: [
      { time: "2025-12-18 14:30", user: "王版师", action: "发布新版本", detail: "发布V2.1版本，调整腰部收省位置" },
      { time: "2025-12-18 11:00", user: "王版师", action: "上传纸样", detail: "上传V2.1主身纸样文件" },
      { time: "2025-12-17 16:00", user: "李采购", action: "确认BOM", detail: "BOM-V2.1已确认，实际成本42.80元" },
      { time: "2025-12-15 10:00", user: "王版师", action: "发布新版本", detail: "发布V2版本，优化袖笼弧线" },
      { time: "2025-12-10 09:30", user: "王版师", action: "创建任务", detail: "创建制版任务，初版制版" },
    ],
  }
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; bg: string }> = {
  未开始: { color: "text-gray-500", icon: <Clock className="w-4 h-4" />, bg: "bg-gray-500/10" },
  进行中: { color: "text-blue-500", icon: <Settings className="w-4 h-4 animate-spin" />, bg: "bg-blue-500/10" },
  已完成: { color: "text-green-500", icon: <CheckCircle className="w-4 h-4" />, bg: "bg-green-500/10" },
  已冻结: { color: "text-cyan-500", icon: <Snowflake className="w-4 h-4" />, bg: "bg-cyan-500/10" },
}

const versionStatusConfig: Record<string, { color: string; bg: string }> = {
  草稿: { color: "text-gray-500", bg: "bg-gray-500/10" },
  评审中: { color: "text-amber-500", bg: "bg-amber-500/10" },
  已通过: { color: "text-green-500", bg: "bg-green-500/10" },
  已废弃: { color: "text-red-500", bg: "bg-red-500/10" },
}

const materialTypeConfig: Record<string, { color: string; bg: string }> = {
  面料: { color: "text-blue-600", bg: "bg-blue-500/10" },
  辅料: { color: "text-purple-600", bg: "bg-purple-500/10" },
  包装: { color: "text-amber-600", bg: "bg-amber-500/10" },
}

export default function PatternTaskDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const task = getPatternTaskDetail(id)

  const [activeTab, setActiveTab] = useState("bom")
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basicInfo: true,
    projectInfo: true,
    versionManagement: true,
    currentVersion: true,
    downstream: false,
    logs: false,
  })
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({
    "STAGE-01": true,
    "STAGE-02": true,
    "STAGE-03": false,
    "STAGE-04": false,
  })
  const [showNewVersionDialog, setShowNewVersionDialog] = useState(false)
  const [showCompareDialog, setShowCompareDialog] = useState(false)
  const [showAddBOMDialog, setShowAddBOMDialog] = useState(false)
  const [newVersionReason, setNewVersionReason] = useState("")
  const [compareVersions, setCompareVersions] = useState({ from: "V2", to: "V2.1" })

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const toggleStage = (stageId: string) => {
    setExpandedStages((prev) => ({ ...prev, [stageId]: !prev[stageId] }))
  }

  const statusInfo = statusConfig[task.status] || statusConfig["未开始"]

  const handleCreateNewVersion = () => {
    if (!newVersionReason.trim()) {
      alert("请填写变更原因")
      return
    }
    alert(`创建新版本成功！变更原因：${newVersionReason}`)
    setShowNewVersionDialog(false)
    setNewVersionReason("")
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 顶部Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/patterns")}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                返回列表
              </Button>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold">{task.id}</h1>
                <Badge className={`${statusInfo.bg} ${statusInfo.color}`}>
                  {statusInfo.icon}
                  <span className="ml-1">{task.status}</span>
                </Badge>
                <Badge
                  className={`${versionStatusConfig[task.versionStatus]?.bg} ${versionStatusConfig[task.versionStatus]?.color}`}
                >
                  {task.versionStatus}
                </Badge>
                <Badge variant="outline" className="border-primary text-primary">
                  <GitBranch className="w-3 h-3 mr-1" />
                  {task.currentVersion}
                </Badge>
                <Badge variant="outline">{task.source}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-1" />
                编辑
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowNewVersionDialog(true)}>
                <Plus className="w-4 h-4 mr-1" />
                新建版本
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Lock className="w-4 h-4 mr-2" />
                    锁定量产版本
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Download className="w-4 h-4 mr-2" />
                    导出全部文件
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">
                    <Snowflake className="w-4 h-4 mr-2" />
                    冻结任务
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* 基础信息 */}
          <Card>
            <CardHeader className="cursor-pointer py-3" onClick={() => toggleSection("basicInfo")}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  基础信息
                </CardTitle>
                {expandedSections.basicInfo ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </div>
            </CardHeader>
            {expandedSections.basicInfo && (
              <CardContent className="pt-0">
                <div className="grid grid-cols-5 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">任务名称</span>
                    <p className="font-medium mt-1">{task.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">制版类型</span>
                    <p className="font-medium mt-1">{task.patternType}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">来源</span>
                    <p className="font-medium mt-1">{task.source}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">款式类型</span>
                    <p className="font-medium mt-1">{task.styleType}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">分类</span>
                    <p className="font-medium mt-1">{task.category}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">技术负责人</span>
                    <p className="font-medium mt-1">{task.technicalOwner}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">执行团队</span>
                    <p className="font-medium mt-1">{task.team}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">关联打样任务</span>
                    <p className="font-medium mt-1">
                      <Link
                        href={`/sampling-tasks/${task.relatedSamplingTask}`}
                        className="text-primary hover:underline"
                      >
                        {task.relatedSamplingTask}
                      </Link>
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">创建时间</span>
                    <p className="font-medium mt-1">{task.createTime}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">最近更新</span>
                    <p className="font-medium mt-1">{task.lastUpdateTime}</p>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* 商品项目关联信息 */}
          <Card>
            <CardHeader className="cursor-pointer py-3" onClick={() => toggleSection("projectInfo")}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  商品项目关联
                </CardTitle>
                {expandedSections.projectInfo ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </div>
            </CardHeader>
            {expandedSections.projectInfo && (
              <CardContent className="pt-0">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">商品项目编号</span>
                    <p className="font-medium mt-1">
                      <Link
                        href={`/projects/${task.projectId}`}
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        {task.projectId}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">商品项目名称</span>
                    <p className="font-medium mt-1">{task.projectName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">触发工作项</span>
                    <p className="font-medium mt-1">
                      <Link
                        href={`/projects/${task.projectId}/work-items/${task.workItemId}`}
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        {task.workItemName}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">工作项编号</span>
                    <p className="font-medium mt-1">{task.workItemId}</p>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* 版本管理区 */}
          <Card>
            <CardHeader className="cursor-pointer py-3" onClick={() => toggleSection("versionManagement")}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <GitBranch className="w-4 h-4" />
                  版本管理
                  <Badge variant="outline" className="ml-2">
                    共 {task.versions.length} 个版本
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowCompareDialog(true)
                    }}
                  >
                    <GitCompare className="w-4 h-4 mr-1" />
                    版本对比
                  </Button>
                  {expandedSections.versionManagement ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </div>
              </div>
            </CardHeader>
            {expandedSections.versionManagement && (
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">版本号</TableHead>
                      <TableHead className="w-24">状态</TableHead>
                      <TableHead>变更原因</TableHead>
                      <TableHead className="w-24">创建人</TableHead>
                      <TableHead className="w-40">创建时间</TableHead>
                      <TableHead className="w-24">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {task.versions.map((version) => (
                      <TableRow key={version.version} className={version.isActive ? "bg-green-500/5" : ""}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {version.version}
                            {version.isActive && <Badge className="bg-green-500/10 text-green-500 text-xs">当前</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${versionStatusConfig[version.status]?.bg} ${versionStatusConfig[version.status]?.color}`}
                          >
                            {version.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{version.changeReason}</TableCell>
                        <TableCell>{version.creator}</TableCell>
                        <TableCell>{version.createTime}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                            {!version.isActive && version.status !== "已废弃" && (
                              <Button variant="ghost" size="sm">
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>

          {/* 当前版本内容 */}
          <Card>
            <CardHeader className="cursor-pointer py-3" onClick={() => toggleSection("currentVersion")}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Scissors className="w-4 h-4" />
                  当前版本内容
                  <Badge variant="outline" className="ml-2">
                    {task.currentVersion}
                  </Badge>
                </CardTitle>
                {expandedSections.currentVersion ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </div>
            </CardHeader>
            {expandedSections.currentVersion && (
              <CardContent className="pt-0">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="bom" className="gap-1">
                      <Package className="w-4 h-4" />
                      BOM管理
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {task.bom.items.length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="patterns" className="gap-1">
                      <FileText className="w-4 h-4" />
                      纸样文件
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {task.patterns.length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="process" className="gap-1">
                      <Workflow className="w-4 h-4" />
                      标准工艺
                    </TabsTrigger>
                    <TabsTrigger value="grading" className="gap-1">
                      <Ruler className="w-4 h-4" />
                      放码规则
                    </TabsTrigger>
                  </TabsList>

                  {/* BOM管理 Tab */}
                  <TabsContent value="bom" className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <Badge variant="outline">{task.bom.version}</Badge>
                        <Badge
                          className={
                            task.bom.status === "已确认"
                              ? "bg-green-500/10 text-green-500"
                              : "bg-amber-500/10 text-amber-500"
                          }
                        >
                          {task.bom.status}
                        </Badge>
                        <div className="text-sm">
                          <span className="text-muted-foreground">目标成本：</span>
                          <span className="font-medium">¥{task.bom.targetCost.toFixed(2)}</span>
                          <span className="text-muted-foreground ml-4">实际成本：</span>
                          <span
                            className={`font-medium ${task.bom.actualCost <= task.bom.targetCost ? "text-green-600" : "text-red-600"}`}
                          >
                            ¥{task.bom.actualCost.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => setShowAddBOMDialog(true)}>
                        <Plus className="w-4 h-4 mr-1" />
                        添加物料
                      </Button>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">类型</TableHead>
                          <TableHead className="w-28">物料SKU</TableHead>
                          <TableHead>物料名称</TableHead>
                          <TableHead>颜色/规格</TableHead>
                          <TableHead className="w-20 text-right">用量</TableHead>
                          <TableHead className="w-16 text-right">损耗率</TableHead>
                          <TableHead className="w-20 text-right">单价</TableHead>
                          <TableHead className="w-20 text-right">小计</TableHead>
                          <TableHead className="w-24">关联工艺</TableHead>
                          <TableHead className="w-24">关联纸样</TableHead>
                          <TableHead className="w-16">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {task.bom.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Badge
                                className={`${materialTypeConfig[item.materialType]?.bg} ${materialTypeConfig[item.materialType]?.color}`}
                              >
                                {item.materialType}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{item.materialSKU}</TableCell>
                            <TableCell className="font-medium">{item.materialName}</TableCell>
                            <TableCell className="text-sm">{item.colorSpec}</TableCell>
                            <TableCell className="text-right">
                              {item.usage}
                              {item.unit}
                            </TableCell>
                            <TableCell className="text-right">{item.lossRate}%</TableCell>
                            <TableCell className="text-right">¥{item.unitCost.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-medium">¥{item.totalCost.toFixed(2)}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {item.relatedProcess.map((p) => (
                                  <Badge key={p} variant="outline" className="text-xs">
                                    {p}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {item.relatedPattern.map((p) => (
                                  <Badge key={p} variant="secondary" className="text-xs">
                                    {p}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm">
                                <Edit className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/30 font-medium">
                          <TableCell colSpan={7} className="text-right">
                            合计
                          </TableCell>
                          <TableCell className="text-right">¥{task.bom.actualCost.toFixed(2)}</TableCell>
                          <TableCell colSpan={3}></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TabsContent>

                  {/* 纸样文件 Tab */}
                  <TabsContent value="patterns" className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        共 {task.patterns.length} 个纸样文件，总裁片数{" "}
                        {task.patterns.reduce((sum, p) => sum + p.cutQuantity, 0)} 片/件
                      </p>
                      <Button size="sm">
                        <Upload className="w-4 h-4 mr-1" />
                        上传纸样
                      </Button>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">纸样ID</TableHead>
                          <TableHead>纸样名称</TableHead>
                          <TableHead className="w-16">类型</TableHead>
                          <TableHead className="w-16">部位</TableHead>
                          <TableHead className="w-16 text-center">裁片数</TableHead>
                          <TableHead className="w-16">格式</TableHead>
                          <TableHead className="w-28">适用尺码</TableHead>
                          <TableHead>关联工艺</TableHead>
                          <TableHead className="w-16">主纸样</TableHead>
                          <TableHead className="w-20">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {task.patterns.map((pattern) => (
                          <TableRow key={pattern.id}>
                            <TableCell className="font-mono text-xs">{pattern.id}</TableCell>
                            <TableCell className="font-medium">{pattern.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{pattern.type}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{pattern.position}</Badge>
                            </TableCell>
                            <TableCell className="text-center font-medium">{pattern.cutQuantity}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="font-mono text-xs">
                                {pattern.format}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {pattern.applicableSizes.map((size) => (
                                  <Badge key={size} variant="outline" className="text-xs">
                                    {size}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {pattern.relatedProcess.map((p) => (
                                  <Badge key={p} variant="outline" className="text-xs">
                                    {p}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              {pattern.isPrimary && <Badge className="bg-primary/10 text-primary">主</Badge>}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm">
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Download className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabsContent>

                  {/* 标准工艺流程 Tab */}
                  <TabsContent value="process" className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        共 {task.processFlow.stages.length} 个阶段，
                        {task.processFlow.stages.reduce((sum, s) => sum + s.processes.length, 0)} 道工序，
                        {task.processFlow.stages.reduce(
                          (sum, s) => sum + s.processes.reduce((psum, p) => psum + p.techniques.length, 0),
                          0,
                        )}{" "}
                        项工艺
                      </p>
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-1" />
                        添加工艺
                      </Button>
                    </div>
                    <div className="space-y-4">
                      {task.processFlow.stages.map((stage) => (
                        <Card key={stage.id} className="border">
                          <CardHeader
                            className="py-3 cursor-pointer hover:bg-muted/30"
                            onClick={() => toggleStage(stage.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {expandedStages[stage.id] ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                                <Badge variant="outline" className="text-xs">
                                  阶段 {stage.order}
                                </Badge>
                                <CardTitle className="text-base">{stage.name}</CardTitle>
                                <Badge variant="secondary" className="text-xs">
                                  {stage.processes.length} 道工序
                                </Badge>
                              </div>
                            </div>
                          </CardHeader>
                          {expandedStages[stage.id] && (
                            <CardContent className="pt-0">
                              <div className="space-y-3">
                                {stage.processes.map((process, pIdx) => (
                                  <div key={process.id} className="border rounded-lg p-3 bg-muted/20">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge variant="outline" className="text-xs">
                                        {pIdx + 1}
                                      </Badge>
                                      <span className="font-medium">{process.name}</span>
                                      <Badge variant="secondary" className="text-xs ml-auto">
                                        {process.techniques.length} 项工艺
                                      </Badge>
                                    </div>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="w-32">工艺名称</TableHead>
                                          <TableHead>工艺要求</TableHead>
                                          <TableHead className="w-32">关联BOM</TableHead>
                                          <TableHead className="w-32">关联纸样</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {process.techniques.map((tech) => (
                                          <TableRow key={tech.id}>
                                            <TableCell className="font-medium">{tech.name}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                              {tech.requirements}
                                            </TableCell>
                                            <TableCell>
                                              <div className="flex flex-wrap gap-1">
                                                {tech.relatedBOM.map((b) => (
                                                  <Badge key={b} variant="outline" className="text-xs">
                                                    {b}
                                                  </Badge>
                                                ))}
                                              </div>
                                            </TableCell>
                                            <TableCell>
                                              <div className="flex flex-wrap gap-1">
                                                {tech.relatedPattern.map((p) => (
                                                  <Badge key={p} variant="secondary" className="text-xs">
                                                    {p}
                                                  </Badge>
                                                ))}
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  {/* 放码规则 Tab */}
                  <TabsContent value="grading" className="space-y-4">
                    <div className="grid grid-cols-5 gap-4 p-4 rounded-lg bg-muted/30">
                      <div>
                        <span className="text-sm text-muted-foreground">基准尺码</span>
                        <p className="font-medium mt-1">{task.gradingRules.baseSize}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">尺码区间</span>
                        <p className="font-medium mt-1">{task.gradingRules.sizeRange.join(" - ")}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">横向放码</span>
                        <p className="font-medium mt-1">{task.gradingRules.horizontalGrade}cm/档</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">纵向放码</span>
                        <p className="font-medium mt-1">{task.gradingRules.verticalGrade}cm/档</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">放码文件</span>
                        <div className="flex gap-2 mt-1">
                          {task.gradingRules.gradingFiles.map((file) => (
                            <Button key={file.name} variant="ghost" size="sm" className="h-auto p-1 text-xs">
                              <Download className="w-3 h-3 mr-1" />
                              {file.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">部位放码表</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>部位</TableHead>
                            {task.gradingRules.sizeRange.map((size) => (
                              <TableHead
                                key={size}
                                className={size === task.gradingRules.baseSize ? "bg-primary/10" : ""}
                              >
                                {size}
                                {size === task.gradingRules.baseSize && (
                                  <Badge className="ml-1 text-xs" variant="outline">
                                    基准
                                  </Badge>
                                )}
                              </TableHead>
                            ))}
                            <TableHead>单位</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {task.gradingRules.gradingTable.map((row) => (
                            <TableRow key={row.part}>
                              <TableCell className="font-medium">{row.part}</TableCell>
                              {task.gradingRules.sizeRange.map((size) => (
                                <TableCell
                                  key={size}
                                  className={size === task.gradingRules.baseSize ? "bg-primary/10 font-medium" : ""}
                                >
                                  {row[size as keyof typeof row]}
                                </TableCell>
                              ))}
                              <TableCell>{row.unit}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {task.gradingRules.specialNotes && (
                      <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <h4 className="font-medium mb-2 text-blue-600">特殊放码说明</h4>
                        <p className="text-sm text-muted-foreground">{task.gradingRules.specialNotes}</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            )}
          </Card>

          {/* 下游使用情况 */}
          <Card>
            <CardHeader className="cursor-pointer py-3" onClick={() => toggleSection("downstream")}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  下游使用情况
                </CardTitle>
                {expandedSections.downstream ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </div>
            </CardHeader>
            {expandedSections.downstream && (
              <CardContent className="pt-0">
                <div className="grid grid-cols-4 gap-4">
                  {/* 关联打样任务 */}
                  <div className="p-4 rounded-lg border">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Scissors className="w-4 h-4" />
                      关联打样任务
                      <Badge variant="secondary">{task.downstreamUsage.samplingTasks.length}</Badge>
                    </h4>
                    <div className="space-y-2">
                      {task.downstreamUsage.samplingTasks.map((st) => (
                        <div key={st.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                          <div>
                            <Link
                              href={`/sampling-tasks/${st.id}`}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              {st.id}
                            </Link>
                            <p className="text-xs text-muted-foreground">{st.name}</p>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className="text-xs">
                              {st.status}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">{st.version}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 关联样衣 */}
                  <div className="p-4 rounded-lg border">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      关联样衣
                      <Badge variant="secondary">{task.downstreamUsage.samples.length}</Badge>
                    </h4>
                    <div className="space-y-2">
                      {task.downstreamUsage.samples.map((sample) => (
                        <div key={sample.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                          <div>
                            <Link
                              href={`/samples/${sample.id}`}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              {sample.id}
                            </Link>
                            <p className="text-xs text-muted-foreground">{sample.name}</p>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className="text-xs">
                              {sample.status}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">{sample.version}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 关联生产单 */}
                  <div className="p-4 rounded-lg border">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      关联生产单
                      <Badge variant="secondary">{task.downstreamUsage.productionOrders.length}</Badge>
                    </h4>
                    <div className="space-y-2">
                      {task.downstreamUsage.productionOrders.map((po) => (
                        <div key={po.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                          <div>
                            <span className="text-sm font-medium text-primary">{po.id}</span>
                            <p className="text-xs text-muted-foreground">{po.name}</p>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className="text-xs">
                              {po.status}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {po.quantity}件 · {po.version}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 关联SKU */}
                  <div className="p-4 rounded-lg border">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      关联SKU
                      <Badge variant="secondary">{task.downstreamUsage.skus.length}</Badge>
                    </h4>
                    <div className="space-y-2">
                      {task.downstreamUsage.skus.map((sku) => (
                        <div key={sku.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                          <div>
                            <span className="text-sm font-medium">{sku.id}</span>
                            <p className="text-xs text-muted-foreground">{sku.name}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {sku.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* 操作日志 */}
          <Card>
            <CardHeader className="cursor-pointer py-3" onClick={() => toggleSection("logs")}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="w-4 h-4" />
                  操作日志
                </CardTitle>
                {expandedSections.logs ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </CardHeader>
            {expandedSections.logs && (
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {task.logs.map((log, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{log.user}</span>
                          <Badge variant="outline" className="text-xs">
                            {log.action}
                          </Badge>
                          <span className="text-xs text-muted-foreground ml-auto">{log.time}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{log.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        </main>
      </div>

      {/* 新建版本对话框 */}
      <Dialog open={showNewVersionDialog} onOpenChange={setShowNewVersionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建版本</DialogTitle>
            <DialogDescription>基于当前版本 {task.currentVersion} 创建新版本</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>变更原因 *</Label>
              <Textarea
                value={newVersionReason}
                onChange={(e) => setNewVersionReason(e.target.value)}
                placeholder="请描述本次变更的原因和主要内容..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewVersionDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreateNewVersion}>创建版本</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 版本对比对话框 */}
      <Dialog open={showCompareDialog} onOpenChange={setShowCompareDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>版本对比</DialogTitle>
            <DialogDescription>对比不同版本之间的差异</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label>基准版本</Label>
                <select
                  className="w-full mt-1 p-2 border rounded-md bg-background"
                  value={compareVersions.from}
                  onChange={(e) => setCompareVersions((prev) => ({ ...prev, from: e.target.value }))}
                >
                  {task.versions.map((v) => (
                    <option key={v.version} value={v.version}>
                      {v.version}
                    </option>
                  ))}
                </select>
              </div>
              <ArrowRight className="w-4 h-4 mt-6" />
              <div className="flex-1">
                <Label>对比版本</Label>
                <select
                  className="w-full mt-1 p-2 border rounded-md bg-background"
                  value={compareVersions.to}
                  onChange={(e) => setCompareVersions((prev) => ({ ...prev, to: e.target.value }))}
                >
                  {task.versions.map((v) => (
                    <option key={v.version} value={v.version}>
                      {v.version}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="border rounded-lg p-4 bg-muted/30">
              <h4 className="font-medium mb-3">差异摘要</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-500/10 text-green-500">新增</Badge>
                  <span>腰部收省位置调整至距腰线8cm</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-500/10 text-amber-500">修改</Badge>
                  <span>主身纸样文件更新 (main-body-v2.dxf → main-body-v2.1.dxf)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-500/10 text-amber-500">修改</Badge>
                  <span>BOM成本从 ¥43.50 调整为 ¥42.80</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompareDialog(false)}>
              关闭
            </Button>
            <Button>导出对比报告</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 添加BOM物料对话框 */}
      <Dialog open={showAddBOMDialog} onOpenChange={setShowAddBOMDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加物料</DialogTitle>
            <DialogDescription>添加新的BOM物料项</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>物料类型 *</Label>
                <select className="w-full mt-1 p-2 border rounded-md bg-background">
                  <option value="面料">面料</option>
                  <option value="辅料">辅料</option>
                  <option value="包装">包装</option>
                </select>
              </div>
              <div>
                <Label>物料SKU *</Label>
                <Input placeholder="选择或输入物料SKU" className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>用量 *</Label>
                <Input type="number" placeholder="0" className="mt-1" />
              </div>
              <div>
                <Label>单位</Label>
                <Input placeholder="米/条/粒" className="mt-1" />
              </div>
              <div>
                <Label>损耗率(%)</Label>
                <Input type="number" placeholder="0" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>关联工艺</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {["裁剪", "缝制", "后整", "包装"].map((p) => (
                  <label key={p} className="flex items-center gap-1">
                    <Checkbox />
                    <span className="text-sm">{p}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>备注</Label>
              <Input placeholder="填写备注信息" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBOMDialog(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                alert("添加成功")
                setShowAddBOMDialog(false)
              }}
            >
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
