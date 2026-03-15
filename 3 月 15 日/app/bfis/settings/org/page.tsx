"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Building2,
  BookOpen,
  Calendar,
  GitBranch,
  AlertTriangle,
  CheckCircle,
  Globe,
  DollarSign,
  ChevronRight,
  Plus,
  Settings,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"

// OB1｜组织与账本总览页

// Mock 集团数据
const groupInfo = {
  groupCode: "HIGOOD_GROUP",
  groupName: "HiGood Group",
  reportingCurrency: "USD",
  defaultTimezone: "Asia/Jakarta",
  fiscalYearStartMonth: 1,
  managementLedger: "GL_MGMT_USD",
  currentPeriod: "2026-01",
  status: "ACTIVE",
}

// Mock 法人主体数据
const legalEntities = [
  { code: "HK_HIGOOD_PROC", name: "HIGOOD LIVE LIMITED", alias: "HK-采购出口主体", country: "HK", currency: "USD", hasLedger: true, status: "ACTIVE" },
  { code: "KY_HIGOOD_HOLD", name: "HiGOOD LIVE Limited", alias: "KY-集团控股", country: "KY", currency: "USD", hasLedger: true, status: "ACTIVE" },
  { code: "ID_BDG_FADFAD", name: "PT FADFAD FASHION BANDUNG", alias: "BDG-生产主体", country: "ID", currency: "IDR", hasLedger: true, status: "ACTIVE" },
  { code: "ID_JKT_HIGOOD_LIVE", name: "PT HIGOOD LIVE JAKARTA", alias: "JKT-直播主体", country: "ID", currency: "IDR", hasLedger: true, status: "ACTIVE" },
  { code: "CN_BJ_FANDE", name: "北京范得科技有限公司", alias: "BJ-样衣采购", country: "CN", currency: "CNY", hasLedger: true, status: "ACTIVE" },
  { code: "CN_SZ_HIGOOD_OPS", name: "深圳嗨好科技有限公司", alias: "SZ-运营研发", country: "CN", currency: "CNY", hasLedger: true, status: "ACTIVE" },
]

// Mock 风险提示
const riskAlerts = [
  { type: "ORG_NAME_COLLISION", message: "HK与KY主体名称相似，建议核对展示别名", severity: "warn" },
]

// Mock 账本统计
const ledgerStats = {
  management: 1,
  statutory: 6,
  total: 7,
  openPeriods: 7,
}

// Mock 跨主体关系
const intercompanyRelations = [
  { from: "HK_HIGOOD_PROC", to: "ID_BDG_FADFAD", type: "SALE_PURCHASE", status: "ACTIVE" },
  { from: "ID_BDG_FADFAD", to: "ID_JKT_HIGOOD_LIVE", type: "CONSIGNMENT", status: "ACTIVE" },
  { from: "CN_BJ_FANDE", to: "HK_HIGOOD_PROC", type: "SALE_PURCHASE", status: "ACTIVE" },
  { from: "CN_SZ_HIGOOD_OPS", to: "KY_HIGOOD_HOLD", type: "SERVICE", status: "ACTIVE" },
]

const countryFlags: Record<string, string> = {
  HK: "🇭🇰",
  KY: "🇰🇾",
  ID: "🇮🇩",
  CN: "🇨🇳",
}

const relationTypeLabels: Record<string, string> = {
  SALE_PURCHASE: "采购销售",
  CONSIGNMENT: "代销",
  SERVICE: "服务",
  LOAN: "借款",
  OTHER: "其他",
}

export default function OrgOverviewPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">组织与账本</h1>
          <p className="text-muted-foreground">
            集团—法人主体—账本—期间的主数据体系，统一定义记账边界、币种口径与主体归属
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/bfis/settings/org/entities">
            <Button variant="outline" size="sm">
              <Building2 className="h-4 w-4 mr-2" />
              管理法人
            </Button>
          </Link>
          <Link href="/bfis/settings/org/ledgers">
            <Button variant="outline" size="sm">
              <BookOpen className="h-4 w-4 mr-2" />
              管理账本
            </Button>
          </Link>
        </div>
      </div>

      {/* 风险提示 */}
      {riskAlerts.length > 0 && (
        <div className="space-y-2">
          {riskAlerts.map((alert, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
              <div className="flex-1">
                <span className="text-sm text-yellow-800">{alert.message}</span>
              </div>
              <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                {alert.type}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* 集团卡片 */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                {groupInfo.groupName}
              </CardTitle>
              <CardDescription className="mt-1">集团编码: {groupInfo.groupCode}</CardDescription>
            </div>
            <Badge className="bg-green-100 text-green-700">ACTIVE</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="p-3 bg-background rounded-lg">
              <div className="text-sm text-muted-foreground">集团报告币</div>
              <div className="text-lg font-bold mt-1">{groupInfo.reportingCurrency}</div>
            </div>
            <div className="p-3 bg-background rounded-lg">
              <div className="text-sm text-muted-foreground">默认时区</div>
              <div className="text-lg font-bold mt-1">{groupInfo.defaultTimezone}</div>
            </div>
            <div className="p-3 bg-background rounded-lg">
              <div className="text-sm text-muted-foreground">会计年度起始</div>
              <div className="text-lg font-bold mt-1">{groupInfo.fiscalYearStartMonth}月</div>
            </div>
            <div className="p-3 bg-background rounded-lg">
              <div className="text-sm text-muted-foreground">管理账本</div>
              <div className="text-lg font-bold mt-1">{groupInfo.managementLedger}</div>
            </div>
            <div className="p-3 bg-background rounded-lg">
              <div className="text-sm text-muted-foreground">当前期间</div>
              <div className="text-lg font-bold mt-1">{groupInfo.currentPeriod}</div>
            </div>
            <div className="p-3 bg-background rounded-lg">
              <div className="text-sm text-muted-foreground">法人主体数</div>
              <div className="text-lg font-bold mt-1">{legalEntities.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{legalEntities.length}</div>
                <div className="text-sm text-muted-foreground">法人主体</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <BookOpen className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{ledgerStats.total}</div>
                <div className="text-sm text-muted-foreground">账本总数</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{ledgerStats.openPeriods}</div>
                <div className="text-sm text-muted-foreground">开放期间</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <GitBranch className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{intercompanyRelations.length}</div>
                <div className="text-sm text-muted-foreground">跨主体关系</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 法人主体概览表 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">法人主体概览</CardTitle>
            <Link href="/bfis/settings/org/entities">
              <Button variant="ghost" size="sm">
                查看全部 <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>法人编码</TableHead>
                <TableHead>法人名称</TableHead>
                <TableHead>展示别名</TableHead>
                <TableHead>注册地</TableHead>
                <TableHead>本位币</TableHead>
                <TableHead>账本</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {legalEntities.map((entity) => (
                <TableRow key={entity.code}>
                  <TableCell className="font-mono text-sm">{entity.code}</TableCell>
                  <TableCell className="font-medium">{entity.name}</TableCell>
                  <TableCell className="text-muted-foreground">{entity.alias}</TableCell>
                  <TableCell>
                    <span className="mr-1">{countryFlags[entity.country]}</span>
                    {entity.country}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{entity.currency}</Badge>
                  </TableCell>
                  <TableCell>
                    {entity.hasLedger ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={entity.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                      {entity.status === "ACTIVE" ? "启用" : "停用"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 跨主体关系概览 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">跨主体关系</CardTitle>
            <Link href="/bfis/settings/org/relations">
              <Button variant="ghost" size="sm">
                查看全部 <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>甲方主体</TableHead>
                <TableHead></TableHead>
                <TableHead>乙方主体</TableHead>
                <TableHead>关系类型</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {intercompanyRelations.map((rel, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-sm">{rel.from}</TableCell>
                  <TableCell className="text-center">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                  <TableCell className="font-mono text-sm">{rel.to}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{relationTypeLabels[rel.type]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-green-100 text-green-700">启用</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 口径说明 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">口径说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">集团管理口径</h4>
              <p className="text-muted-foreground">
                集团报告币 USD（已确认）。老板视角统一以 USD 展示，所有金额的集团 USD 展示必须能追溯到"主体/账本/期间/汇率"。
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">法人法定口径</h4>
              <p className="text-muted-foreground">
                每个法人主体配置法定账本（STATUTORY），本位币按法人经营/法定要求配置（如 IDR、CNY）。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
