"use client"

import { useState } from "react"
import { Search, Filter, Download, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"

interface OFAPageTemplateProps {
  title: string
  description?: string
  kpiCards?: {
    title: string
    value: string
    change?: string
    changeType?: "up" | "down" | "neutral"
  }[]
  tableColumns?: string[]
  tableRowCount?: number
}

export function OFAPageTemplate({
  title,
  description,
  kpiCards = [
    { title: "总金额（USD）", value: "$1,234,567", change: "+12.5%", changeType: "up" },
    { title: "待处理笔数", value: "128", change: "-5", changeType: "down" },
    { title: "本月新增", value: "456", change: "+23", changeType: "up" },
    { title: "异常项", value: "12", change: "0", changeType: "neutral" },
  ],
  tableColumns = ["编号", "日期", "类型", "金额（USD）", "状态", "责任人", "操作"],
  tableRowCount = 10,
}: OFAPageTemplateProps) {
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<number | null>(null)

  const handleRowClick = (index: number) => {
    setSelectedRow(index)
    setDetailOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && <p className="text-muted-foreground mt-1">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            新建
          </Button>
        </div>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {kpiCards.map((card, index) => (
          <Card key={index}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold">{card.value}</span>
                {card.change && (
                  <Badge
                    variant={
                      card.changeType === "up" ? "default" : card.changeType === "down" ? "destructive" : "secondary"
                    }
                  >
                    {card.change}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 筛选区 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="搜索编号、名称..." className="pl-9" />
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="状态筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待处理</SelectItem>
                <SelectItem value="processing">处理中</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all">
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="类型筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="type1">类型一</SelectItem>
                <SelectItem value="type2">类型二</SelectItem>
                <SelectItem value="type3">类型三</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 数据表格 */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {tableColumns.map((col, index) => (
                  <TableHead key={index}>{col}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: tableRowCount }).map((_, rowIndex) => (
                <TableRow
                  key={rowIndex}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(rowIndex)}
                >
                  {tableColumns.map((_, colIndex) => (
                    <TableCell key={colIndex}>
                      {colIndex === 0 ? (
                        <span className="text-primary font-medium">
                          OFA-2026-{String(rowIndex + 1).padStart(4, "0")}
                        </span>
                      ) : colIndex === 1 ? (
                        "2026-01-17"
                      ) : colIndex === 2 ? (
                        <Badge variant="outline">类型占位</Badge>
                      ) : colIndex === 3 ? (
                        `$${(Math.random() * 10000).toFixed(2)}`
                      ) : colIndex === 4 ? (
                        <Badge variant={rowIndex % 3 === 0 ? "default" : rowIndex % 3 === 1 ? "secondary" : "outline"}>
                          {rowIndex % 3 === 0 ? "已完成" : rowIndex % 3 === 1 ? "处理中" : "待处理"}
                        </Badge>
                      ) : colIndex === 5 ? (
                        "张三"
                      ) : (
                        <Button variant="ghost" size="sm">
                          查看
                        </Button>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 详情抽屉 */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle>详情 - OFA-2026-{String((selectedRow || 0) + 1).padStart(4, "0")}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {/* 基本信息 */}
            <div>
              <h3 className="text-sm font-medium mb-3">基本信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">编号</span>
                  <p className="font-medium">OFA-2026-{String((selectedRow || 0) + 1).padStart(4, "0")}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">状态</span>
                  <p>
                    <Badge>待处理</Badge>
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">金额（USD）</span>
                  <p className="font-medium">$1,234.56</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">责任人</span>
                  <p className="font-medium">张三</p>
                </div>
              </div>
            </div>

            {/* Tab 区域 */}
            <Tabs defaultValue="logs">
              <TabsList>
                <TabsTrigger value="logs">操作日志</TabsTrigger>
                <TabsTrigger value="attachments">附件</TabsTrigger>
              </TabsList>
              <TabsContent value="logs" className="mt-4">
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                      <div>
                        <p className="text-muted-foreground">2026-01-17 10:30:00</p>
                        <p>用户操作记录占位 #{i}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="attachments" className="mt-4">
                <div className="text-sm text-muted-foreground">暂无附件</div>
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
