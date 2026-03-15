"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { ArrowLeft, Edit, Building2, User, Wallet, FileText, ExternalLink } from "lucide-react"

// 归属类型
const OWNER_TYPE = {
  PERSONAL: { label: "个人", color: "bg-blue-100 text-blue-700" },
  LEGAL: { label: "法人", color: "bg-purple-100 text-purple-700" },
}

// 状态
const ACCOUNT_STATUS = {
  ACTIVE: { label: "启用", color: "bg-green-100 text-green-700" },
  INACTIVE: { label: "停用", color: "bg-gray-100 text-gray-500" },
}

// Mock提现账号详情
const mockPayoutAccount = {
  id: "PA-002",
  name: "PT HIGOOD LIVE - IDN Payout",
  payoutChannel: "平台内提现",
  identifierMasked: "****1234",
  ownerType: "LEGAL",
  ownerRefId: "LE-002",
  ownerName: "PT HIGOOD LIVE JAKARTA",
  country: "ID",
  currency: "IDR",
  status: "ACTIVE",
  createdAt: "2025-08-01 10:00",
  createdBy: "系统管理员",
  updatedAt: "2026-01-08 14:30",
  updatedBy: "李运营",
}

// Mock关联店铺
const mockRelatedStores = [
  {
    id: "ST-001",
    storeName: "IDN-Store-A",
    channel: "TikTok",
    country: "印尼",
    bindingStatus: "当前",
    effectiveFrom: "2025-10-01",
    effectiveTo: null,
  },
  {
    id: "ST-006",
    storeName: "IDN-Store-F",
    channel: "Shopee",
    country: "印尼",
    bindingStatus: "历史",
    effectiveFrom: "2025-06-01",
    effectiveTo: "2025-09-30",
  },
]

// Mock日志
const mockLogs = [
  { time: "2026-01-08 14:30", action: "更新信息", operator: "李运营", detail: "更新账号名称" },
  { time: "2025-10-01 09:00", action: "绑定店铺", operator: "李运营", detail: "绑定至IDN-Store-A" },
  { time: "2025-08-01 10:00", action: "创建账号", operator: "系统管理员", detail: "新建提现账号" },
]

export default function PayoutAccountDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/channels/stores/payout-accounts")}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                返回列表
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-muted-foreground" />
                  <h1 className="text-2xl font-bold">{mockPayoutAccount.name}</h1>
                  <Badge className={OWNER_TYPE[mockPayoutAccount.ownerType as keyof typeof OWNER_TYPE]?.color}>
                    {mockPayoutAccount.ownerType === "LEGAL" ? (
                      <Building2 className="h-3 w-3 mr-1" />
                    ) : (
                      <User className="h-3 w-3 mr-1" />
                    )}
                    {OWNER_TYPE[mockPayoutAccount.ownerType as keyof typeof OWNER_TYPE]?.label}
                  </Badge>
                  <Badge className={ACCOUNT_STATUS[mockPayoutAccount.status as keyof typeof ACCOUNT_STATUS]?.color}>
                    {ACCOUNT_STATUS[mockPayoutAccount.status as keyof typeof ACCOUNT_STATUS]?.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {mockPayoutAccount.identifierMasked} | {mockPayoutAccount.country} | {mockPayoutAccount.currency}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => toast.info("编辑功能开发中")}>
              <Edit className="h-4 w-4 mr-2" />
              编辑账号
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">基本信息</TabsTrigger>
              <TabsTrigger value="stores">关联店铺</TabsTrigger>
              <TabsTrigger value="attachments">附件与日志</TabsTrigger>
            </TabsList>

            {/* Tab1: Overview */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">账号信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">账号名称</div>
                        <div className="font-medium">{mockPayoutAccount.name}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">账号标识（脱敏）</div>
                        <div className="font-medium">{mockPayoutAccount.identifierMasked}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">提现渠道</div>
                        <div className="font-medium">{mockPayoutAccount.payoutChannel}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">国家/区域</div>
                        <div className="font-medium">{mockPayoutAccount.country}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">币种</div>
                        <div className="font-medium">{mockPayoutAccount.currency}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">状态</div>
                        <Badge
                          className={ACCOUNT_STATUS[mockPayoutAccount.status as keyof typeof ACCOUNT_STATUS]?.color}
                        >
                          {ACCOUNT_STATUS[mockPayoutAccount.status as keyof typeof ACCOUNT_STATUS]?.label}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">归属信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">归属类型</div>
                        <Badge className={OWNER_TYPE[mockPayoutAccount.ownerType as keyof typeof OWNER_TYPE]?.color}>
                          {mockPayoutAccount.ownerType === "LEGAL" ? (
                            <Building2 className="h-3 w-3 mr-1" />
                          ) : (
                            <User className="h-3 w-3 mr-1" />
                          )}
                          {OWNER_TYPE[mockPayoutAccount.ownerType as keyof typeof OWNER_TYPE]?.label}
                        </Badge>
                      </div>
                      <div>
                        <div className="text-muted-foreground">归属主体</div>
                        <div className="font-medium">{mockPayoutAccount.ownerName}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">创建时间</div>
                        <div className="font-medium">{mockPayoutAccount.createdAt}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">创建人</div>
                        <div className="font-medium">{mockPayoutAccount.createdBy}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Tab2: Related Stores */}
            <TabsContent value="stores" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">关联店铺（当前/历史绑定）</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>店铺名称</TableHead>
                        <TableHead>渠道</TableHead>
                        <TableHead>国家</TableHead>
                        <TableHead>绑定状态</TableHead>
                        <TableHead>生效区间</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockRelatedStores.map((store) => (
                        <TableRow key={store.id}>
                          <TableCell className="font-medium">{store.storeName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{store.channel}</Badge>
                          </TableCell>
                          <TableCell>{store.country}</TableCell>
                          <TableCell>
                            <Badge
                              className={
                                store.bindingStatus === "当前"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-500"
                              }
                            >
                              {store.bindingStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {store.effectiveFrom} ~ {store.effectiveTo || "当前"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/channels/stores/${store.id}`)}
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              查看店铺
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab3: Attachments & Logs */}
            <TabsContent value="attachments" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">附件</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>暂无附件</p>
                    <p className="text-sm">可上传开户证明、收款证明、平台截图等</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">操作日志</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>时间</TableHead>
                        <TableHead>操作</TableHead>
                        <TableHead>操作人</TableHead>
                        <TableHead>详情</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockLogs.map((log, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm text-muted-foreground">{log.time}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.action}</Badge>
                          </TableCell>
                          <TableCell>{log.operator}</TableCell>
                          <TableCell className="text-sm">{log.detail}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
