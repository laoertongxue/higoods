'use client'

import { useState, useMemo } from 'react'
import { useRouter } from '@/lib/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ArrowLeft, Plus, MoreHorizontal, Pencil, Ban, Star, Check } from 'lucide-react'
import type {
  FactorySettlementProfile,
  FactoryBankAccount,
  DefaultPenaltyRule,
  SettlementProfileFormData,
  BankAccountFormData,
  PenaltyRuleFormData,
} from '@/lib/fcs/settlement-types'
import {
  cycleTypeConfig,
  pricingModeConfig,
  ruleTypeConfig,
  ruleModeConfig,
  settlementStatusConfig,
} from '@/lib/fcs/settlement-types'
import {
  settlementProfiles as initialProfiles,
  bankAccounts as initialAccounts,
  penaltyRules as initialRules,
} from '@/lib/fcs/settlement-mock-data'
import { SettlementProfileDrawer } from './settlement-profile-drawer'
import { BankAccountDrawer } from './bank-account-drawer'
import { PenaltyRuleDrawer } from './penalty-rule-drawer'

interface SettlementDetailPageProps {
  factoryId: string
}

export function SettlementDetailPage({ factoryId }: SettlementDetailPageProps) {
  const router = useRouter()
  
  // 数据状态
  const [profiles, setProfiles] = useState<FactorySettlementProfile[]>(initialProfiles)
  const [accounts, setAccounts] = useState<FactoryBankAccount[]>(initialAccounts)
  const [rules, setRules] = useState<DefaultPenaltyRule[]>(initialRules)
  
  // 当前工厂数据
  const factoryProfiles = useMemo(() => 
    profiles.filter(p => p.factoryId === factoryId), [profiles, factoryId])
  const factoryAccounts = useMemo(() => 
    accounts.filter(a => a.factoryId === factoryId), [accounts, factoryId])
  const factoryRules = useMemo(() => 
    rules.filter(r => r.factoryId === factoryId), [rules, factoryId])
  
  const currentProfile = factoryProfiles.find(p => p.isActive)
  const factoryName = currentProfile?.factoryName || '未知工厂'
  
  // 弹窗状态
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false)
  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false)
  const [ruleDrawerOpen, setRuleDrawerOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<FactoryBankAccount | null>(null)
  const [editingRule, setEditingRule] = useState<DefaultPenaltyRule | null>(null)
  
  // 确认弹窗
  const [confirmAction, setConfirmAction] = useState<{
    type: 'disableAccount' | 'setDefault' | 'disableRule'
    item: FactoryBankAccount | DefaultPenaltyRule
  } | null>(null)

  // 新建结算版本
  const handleSubmitProfile = (data: SettlementProfileFormData) => {
    // 将当前生效的版本设为失效
    setProfiles(prev => prev.map(p => 
      p.factoryId === factoryId && p.isActive
        ? { ...p, isActive: false, effectiveTo: data.effectiveFrom }
        : p
    ))
    
    // 添加新版本
    const newProfile: FactorySettlementProfile = {
      id: `sp-${Date.now()}`,
      factoryId,
      factoryName,
      cycleType: data.cycleType,
      settlementDayRule: data.settlementDayRule,
      pricingMode: data.pricingMode,
      currency: data.currency,
      isActive: true,
      effectiveFrom: data.effectiveFrom,
      updatedAt: new Date().toISOString().split('T')[0],
    }
    setProfiles(prev => [...prev, newProfile])
  }

  // 新建/编辑收款账户
  const handleSubmitAccount = (data: BankAccountFormData) => {
    if (editingAccount) {
      setAccounts(prev => prev.map(a => 
        a.id === editingAccount.id ? { ...a, ...data } : a
      ))
    } else {
      // 如果新账户设为默认，取消其他默认
      if (data.isDefault) {
        setAccounts(prev => prev.map(a => 
          a.factoryId === factoryId ? { ...a, isDefault: false } : a
        ))
      }
      const newAccount: FactoryBankAccount = {
        id: `ba-${Date.now()}`,
        factoryId,
        ...data,
      }
      setAccounts(prev => [...prev, newAccount])
    }
  }

  // 新建/编辑扣款规则
  const handleSubmitRule = (data: PenaltyRuleFormData) => {
    if (editingRule) {
      setRules(prev => prev.map(r => 
        r.id === editingRule.id ? { ...r, ...data } : r
      ))
    } else {
      const newRule: DefaultPenaltyRule = {
        id: `pr-${Date.now()}`,
        factoryId,
        ...data,
      }
      setRules(prev => [...prev, newRule])
    }
  }

  // 确认操作
  const handleConfirmAction = () => {
    if (!confirmAction) return
    
    const { type, item } = confirmAction
    
    if (type === 'disableAccount') {
      setAccounts(prev => prev.map(a => 
        a.id === (item as FactoryBankAccount).id ? { ...a, status: 'INACTIVE' } : a
      ))
    } else if (type === 'setDefault') {
      setAccounts(prev => prev.map(a => 
        a.factoryId === factoryId 
          ? { ...a, isDefault: a.id === (item as FactoryBankAccount).id }
          : a
      ))
    } else if (type === 'disableRule') {
      setRules(prev => prev.map(r => 
        r.id === (item as DefaultPenaltyRule).id ? { ...r, status: 'INACTIVE' } : r
      ))
    }
    
    setConfirmAction(null)
  }

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{factoryName}</h1>
              {currentProfile && (
                <Badge variant="outline" className={settlementStatusConfig[currentProfile.isActive ? 'ACTIVE' : 'INACTIVE'].color}>
                  {currentProfile.isActive ? '生效中' : '已失效'}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{factoryId}</p>
          </div>
        </div>
        <Button onClick={() => setProfileDrawerOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          新增版本
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">结算配置</TabsTrigger>
          <TabsTrigger value="accounts">收款账户</TabsTrigger>
          <TabsTrigger value="rules">默认扣款规则</TabsTrigger>
          <TabsTrigger value="history">版本历史</TabsTrigger>
        </TabsList>

        {/* Tab1: 结算配置 */}
        <TabsContent value="profile" className="space-y-4">
          {currentProfile ? (
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-4">当前有效版本</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">结算周期</p>
                  <p className="font-medium">{cycleTypeConfig[currentProfile.cycleType].label}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">结算日规则</p>
                  <p className="font-medium">{currentProfile.settlementDayRule || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">计价方式</p>
                  <p className="font-medium">{pricingModeConfig[currentProfile.pricingMode].label}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">默认币种</p>
                  <p className="font-medium">{currentProfile.currency}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">生效日期</p>
                  <p className="font-medium">{currentProfile.effectiveFrom}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">最近更新</p>
                  <p className="font-medium">{currentProfile.updatedAt}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
              暂无有效的结算配置，请点击"新增版本"创建
            </div>
          )}
        </TabsContent>

        {/* Tab2: 收款账户 */}
        <TabsContent value="accounts" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingAccount(null); setAccountDrawerOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              新增账户
            </Button>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>账户名称</TableHead>
                  <TableHead>银行</TableHead>
                  <TableHead>账号</TableHead>
                  <TableHead>币种</TableHead>
                  <TableHead>默认账户</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="w-[80px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {factoryAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      暂无收款账户
                    </TableCell>
                  </TableRow>
                ) : (
                  factoryAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.accountName}</TableCell>
                      <TableCell>{account.bankName}</TableCell>
                      <TableCell className="font-mono">{account.accountMasked}</TableCell>
                      <TableCell>{account.currency}</TableCell>
                      <TableCell>
                        {account.isDefault ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            <Star className="mr-1 h-3 w-3" />
                            默认
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={settlementStatusConfig[account.status].color}>
                          {settlementStatusConfig[account.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditingAccount(account); setAccountDrawerOpen(true); }}>
                              <Pencil className="mr-2 h-4 w-4" />
                              编辑
                            </DropdownMenuItem>
                            {!account.isDefault && account.status === 'ACTIVE' && (
                              <DropdownMenuItem onClick={() => setConfirmAction({ type: 'setDefault', item: account })}>
                                <Star className="mr-2 h-4 w-4" />
                                设为默认
                              </DropdownMenuItem>
                            )}
                            {account.status === 'ACTIVE' && (
                              <DropdownMenuItem 
                                onClick={() => setConfirmAction({ type: 'disableAccount', item: account })}
                                className="text-destructive focus:text-destructive"
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                禁用
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Tab3: 默认扣款规则 */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingRule(null); setRuleDrawerOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              新增规则
            </Button>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>规则类型</TableHead>
                  <TableHead>计算方式</TableHead>
                  <TableHead>数值</TableHead>
                  <TableHead>生效日期</TableHead>
                  <TableHead>失效日期</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="w-[80px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {factoryRules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      暂无扣款规则
                    </TableCell>
                  </TableRow>
                ) : (
                  factoryRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{ruleTypeConfig[rule.ruleType].label}</TableCell>
                      <TableCell>{ruleModeConfig[rule.ruleMode].label}</TableCell>
                      <TableCell>
                        {rule.ruleMode === 'PERCENTAGE' ? `${rule.ruleValue}%` : `${rule.ruleValue} 元`}
                      </TableCell>
                      <TableCell>{rule.effectiveFrom}</TableCell>
                      <TableCell>{rule.effectiveTo || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={settlementStatusConfig[rule.status].color}>
                          {settlementStatusConfig[rule.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditingRule(rule); setRuleDrawerOpen(true); }}>
                              <Pencil className="mr-2 h-4 w-4" />
                              编辑
                            </DropdownMenuItem>
                            {rule.status === 'ACTIVE' && (
                              <DropdownMenuItem 
                                onClick={() => setConfirmAction({ type: 'disableRule', item: rule })}
                                className="text-destructive focus:text-destructive"
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                禁用
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Tab4: 版本历史 */}
        <TabsContent value="history" className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>结算周期</TableHead>
                  <TableHead>计价方式</TableHead>
                  <TableHead>币种</TableHead>
                  <TableHead>生效日期</TableHead>
                  <TableHead>失效日期</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>更新时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {factoryProfiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      暂无历史版本
                    </TableCell>
                  </TableRow>
                ) : (
                  factoryProfiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">{cycleTypeConfig[profile.cycleType].label}</TableCell>
                      <TableCell>{pricingModeConfig[profile.pricingMode].label}</TableCell>
                      <TableCell>{profile.currency}</TableCell>
                      <TableCell>{profile.effectiveFrom}</TableCell>
                      <TableCell>{profile.effectiveTo || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={settlementStatusConfig[profile.isActive ? 'ACTIVE' : 'INACTIVE'].color}>
                          {profile.isActive ? '生效' : '失效'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{profile.updatedAt}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* 结算配置表单 */}
      <SettlementProfileDrawer
        open={profileDrawerOpen}
        onOpenChange={setProfileDrawerOpen}
        onSubmit={handleSubmitProfile}
      />

      {/* 收款账户表单 */}
      <BankAccountDrawer
        open={accountDrawerOpen}
        onOpenChange={setAccountDrawerOpen}
        account={editingAccount}
        onSubmit={handleSubmitAccount}
      />

      {/* 扣款规则表单 */}
      <PenaltyRuleDrawer
        open={ruleDrawerOpen}
        onOpenChange={setRuleDrawerOpen}
        rule={editingRule}
        onSubmit={handleSubmitRule}
      />

      {/* 确认弹窗 */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'setDefault' ? '设为默认账户' : '确认禁用'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'setDefault' 
                ? '确定要将此账户设为默认收款账户吗？其他账户将取消默认状态。'
                : '确定要禁用此项吗？禁用后将不再生效。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction}>确认</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
