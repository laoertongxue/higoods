"use client"

import { useState } from "react"
import Link from "next/link"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, MoreVertical } from "lucide-react"

interface WorkItem {
  id: string
  name: string
  nature: "决策类" | "执行类"
  category: string
  capabilities: string[]
  role: string
  time: string
  desc: string
}

const workItemsData: WorkItem[] = [
  {
    id: "WI-001",
    name: "商品项目立项",
    nature: "决策类",
    category: "商品项目",
    capabilities: ["可复用"],
    role: "买手/买手助理/SO",
    time: "2025-12-16 12:30:30",
    desc: "商品项目创建的起点",
  },
  {
    id: "WI-002",
    name: "商品项目转档",
    nature: "执行类",
    category: "商品项目",
    capabilities: ["可复用"],
    role: "买手/买手助理/SO",
    time: "2025-12-16 12:30:30",
    desc: "商品项目生命周期的终结节点",
  },
  {
    id: "WI-003",
    name: "样衣获取",
    nature: "执行类",
    category: "样衣资产",
    capabilities: ["可复用", "可多实例", "可回退", "可并行"],
    role: "买手/买手助理/SO/采购",
    time: "2025-12-16 12:30:30",
    desc: "外采/打版/放版等来源的一键抽象",
  },
  {
    id: "WI-004",
    name: "到样入库与核对",
    nature: "执行类",
    category: "样衣资产",
    capabilities: ["可复用", "可多实例", "可回退", "可并行"],
    role: "质检仓管/采购",
    time: "2025-12-16 12:30:30",
    desc: "样衣到货后的入库与核验管理",
  },
  {
    id: "WI-005",
    name: "样衣退货与处置",
    nature: "执行类",
    category: "样衣资产",
    capabilities: ["可复用", "可多实例", "可回退", "可并行"],
    role: "买手",
    time: "2025-12-16 12:30:30",
    desc: "样衣退回/处理流程",
  },
  {
    id: "WI-006",
    name: "测款结论判定",
    nature: "决策类",
    category: "商品项目",
    capabilities: ["可复用", "可回退", "可并行"],
    role: "买手/买手经理",
    time: "2025-12-16 12:30:30",
    desc: "测款结论判定 (推进开口)",
  },
  {
    id: "WI-007",
    name: "样衣留存与库存",
    nature: "执行类",
    category: "样衣资产",
    capabilities: ["可复用", "可多实例", "可回退", "可并行"],
    role: "质检仓管/买手/仓库/SO",
    time: "2025-12-16 12:30:30",
    desc: "样衣长期留存与资产管理",
  },
  {
    id: "WI-008",
    name: "样衣寄送与周转",
    nature: "执行类",
    category: "样衣资产",
    capabilities: ["可复用", "可多实例", "可回退", "可并行"],
    role: "质检仓管/买手/仓库/SO",
    time: "2025-12-16 12:30:30",
    desc: "寄样、分发至拍摄/直播/拍摄现场管理",
  },
  {
    id: "WI-009",
    name: "初步可行性判断",
    nature: "决策类",
    category: "评估与决策",
    capabilities: ["可复用", "可多实例", "可回退", "可并行"],
    role: "主播、运营",
    time: "2025-12-16 12:30:30",
    desc: "是否继续推进项目的早期判断",
  },
  {
    id: "WI-010",
    name: "样衣确认",
    nature: "决策类",
    category: "评估与决策",
    capabilities: ["可复用", "可多实例", "可回退", "可并行"],
    role: "买手/买手助理",
    time: "2025-12-16 12:30:30",
    desc: "确认样衣是否符合需求",
  },
  {
    id: "WI-011",
    name: "样衣核价",
    nature: "执行类",
    category: "评估与决策",
    capabilities: ["可复用", "可多实例", "可回退", "可并行"],
    role: "核价师",
    time: "2025-12-16 12:30:30",
    desc: "样衣成本测算与评估",
  },
  {
    id: "WI-012",
    name: "样衣定价",
    nature: "决策类",
    category: "评估与决策",
    capabilities: ["可复用", "可多实例", "可回退", "可并行"],
    role: "买手",
    time: "2025-12-16 12:30:30",
    desc: "确认样衣零售价/售价策略",
  },
  {
    id: "WI-013",
    name: "样衣拍摄与试穿",
    nature: "执行类",
    category: "内容与市场验证",
    capabilities: ["可复用", "可多实例", "可回退", "可并行"],
    role: "买手/买手助理",
    time: "2025-12-16 12:30:30",
    desc: "拍摄素材与试穿验证",
  },
  {
    id: "WI-014",
    name: "商品上架",
    nature: "执行类",
    category: "内容与市场验证",
    capabilities: ["可复用", "可回退"],
    role: "买手/买手助理/SO",
    time: "2025-12-16 12:30:30",
    desc: "商品发布到销售渠道",
  },
  {
    id: "WI-015",
    name: "短视频测款",
    nature: "执行类",
    category: "内容与市场验证",
    capabilities: ["可复用", "可多实例", "可回退", "可并行"],
    role: "买手",
    time: "2025-12-16 12:30:30",
    desc: "通过短视频进行市场验证",
  },
  {
    id: "WI-016",
    name: "直播测款",
    nature: "执行类",
    category: "内容与市场验证",
    capabilities: ["可复用", "可多实例", "可回退", "可并行"],
    role: "买手/SO/OP/OPM",
    time: "2025-12-16 12:30:30",
    desc: "测款/测品直播回测验证",
  },
  {
    id: "WI-017",
    name: "改版任务",
    nature: "执行类",
    category: "设计与改动",
    capabilities: ["可复用", "可多实例", "可回退", "可并行"],
    role: "买手/买手设计师",
    time: "2025-12-16 12:30:30",
    desc: "根据反馈进行设计改动 (含前置/反馈类型)",
  },
  {
    id: "WI-018",
    name: "首单样衣打样",
    nature: "执行类",
    category: "制版与生产准备",
    capabilities: ["可复用", "可多实例", "可回退", "可并行"],
    role: "跟单",
    time: "2025-12-16 12:30:30",
    desc: "首单样衣打样",
  },
  {
    id: "WI-019",
    name: "制版准备-打版任务",
    nature: "执行类",
    category: "制版与生产准备",
    capabilities: ["可复用", "可多实例", "可回退", "可并行"],
    role: "跟单/版师/核价师",
    time: "2025-12-16 12:30:30",
    desc: "制版所需的打版准备工作",
  },
  {
    id: "WI-020",
    name: "制版准备-花型任务",
    nature: "执行类",
    category: "制版与生产准备",
    capabilities: ["可复用", "可多实例", "可回退", "可并行"],
    role: "花型设计师",
    time: "2025-12-16 12:30:30",
    desc: "花型设计与调色任务",
  },
  {
    id: "WI-021",
    name: "产前版样衣",
    nature: "执行类",
    category: "制版与生产准备",
    capabilities: ["可复用", "可多实例", "可回退", "可并行"],
    role: "跟单",
    time: "2025-12-16 12:30:30",
    desc: "样衣在各环节的流转管理",
  },
]

export default function WorkItemsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(2)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [jumpPage, setJumpPage] = useState("")

  const filteredItems = workItemsData.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = typeFilter === "all" || item.nature === typeFilter
    return matchesSearch && matchesType
  })

  const totalPages = 50

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto">
          <div className="bg-white border-b px-6 py-3">
            <h1 className="text-xl font-semibold">工作项库</h1>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="搜索工作项名称"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="全部类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    <SelectItem value="决策类">决策类</SelectItem>
                    <SelectItem value="执行类">执行类</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="全部角色" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部角色</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="全部状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="启用">启用</SelectItem>
                  </SelectContent>
                </Select>
                <Button>查询</Button>
                <Button variant="outline">重置</Button>
              </div>
            </div>

            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-700 w-12">操作</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">工作项名称</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">工作项性质</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">工作项分类</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">系统能力</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">默认执行角色</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">最近更新</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">状态</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">工作项说明</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <button className="text-gray-400 hover:text-gray-600">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/work-items/${item.id}`} className="text-blue-600 hover:underline font-medium">
                            {item.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={
                              item.nature === "决策类"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }
                          >
                            {item.nature}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{item.category}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {item.capabilities.map((cap, i) => (
                              <Badge key={i} variant="secondary" className="bg-blue-100 text-blue-700 border-0">
                                {cap}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{item.role}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{item.time}</td>
                        <td className="px-4 py-3">
                          <Badge className="bg-green-100 text-green-700 border-0">启用</Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-md truncate">{item.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between bg-white rounded-lg border px-4 py-3">
              <div className="text-sm text-gray-600">共 80 条</div>
              <div className="flex items-center gap-4">
                <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
                  <SelectTrigger className="w-[100px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 条/页</SelectItem>
                    <SelectItem value="20">20 条/页</SelectItem>
                    <SelectItem value="50">50 条/页</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  >
                    上一页
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)}>
                    1
                  </Button>
                  <Button
                    variant={currentPage === 2 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(2)}
                  >
                    2
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(3)}>
                    3
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(4)}>
                    4
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(5)}>
                    5
                  </Button>
                  <span className="px-2 text-gray-500">...</span>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(50)}>
                    50
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  >
                    下一页
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">前往</span>
                  <Input
                    type="number"
                    value={jumpPage}
                    onChange={(e) => setJumpPage(e.target.value)}
                    className="w-16 h-8 text-center"
                    min="1"
                    max={totalPages}
                  />
                  <span className="text-sm text-gray-600">页</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
