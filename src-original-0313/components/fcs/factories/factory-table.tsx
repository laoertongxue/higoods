'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { MoreHorizontal, Pencil, Trash2, ArrowUpDown, Wifi, WifiOff } from 'lucide-react'
import type { Factory } from '@/lib/fcs/factory-types'
import { factoryStatusConfig, cooperationModeConfig, factoryTierConfig, factoryTypeConfig } from '@/lib/fcs/factory-types'
import { t } from '@/lib/i18n'

interface FactoryTableProps {
  factories: Factory[]
  allFactories: Factory[]
  onEdit: (factory: Factory) => void
  onDelete: (factory: Factory) => void
  sortField: string
  sortOrder: 'asc' | 'desc'
  onSort: (field: string) => void
}

export function FactoryTable({
  factories,
  allFactories,
  onEdit,
  onDelete,
  sortField,
  sortOrder,
  onSort,
}: FactoryTableProps) {
  const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => onSort(field)}
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  )

  const EligibilityBadges = ({ factory }: { factory: Factory }) => {
    const flags = [
      { key: 'allowDispatch', label: '派' },
      { key: 'allowBid',      label: '竞' },
      { key: 'allowExecute',  label: '执' },
      { key: 'allowSettle',   label: '结' },
    ] as const
    return (
      <div className="flex gap-1">
        {flags.map(({ key, label }) => (
          <span
            key={key}
            className={`inline-flex items-center justify-center rounded px-1 py-0.5 text-[10px] font-medium border ${
              factory.eligibility[key]
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-gray-100 text-gray-400 border-gray-200'
            }`}
          >
            {label}
          </span>
        ))}
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">
                <SortableHeader field="code">工厂编号</SortableHeader>
              </TableHead>
              <TableHead className="min-w-[160px]">
                <SortableHeader field="name">工厂名称</SortableHeader>
              </TableHead>
              <TableHead className="w-[90px]">{t('factory.columns.contactName')}</TableHead>
              <TableHead className="w-[120px]">{t('factory.columns.contactPhone')}</TableHead>
              <TableHead className="w-[160px]">{t('factory.columns.address')}</TableHead>
              <TableHead className="w-[90px]">{t('factory.columns.monthlyCapacity')}</TableHead>
              <TableHead className="w-[110px]">
                <SortableHeader field="tier">{t('factory.fields.tier')}</SortableHeader>
              </TableHead>
              <TableHead className="w-[130px]">{t('factory.fields.type')}</TableHead>
              <TableHead className="w-[130px]">{t('factory.fields.parent')}</TableHead>
              <TableHead className="w-[80px]">PDA</TableHead>
              <TableHead className="w-[120px]">{t('factory.eligibility.label')}</TableHead>
              <TableHead className="w-[90px]">
                <SortableHeader field="status">状态</SortableHeader>
              </TableHead>
              <TableHead className="w-[80px] text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {factories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="h-24 text-center text-muted-foreground">
                  暂无工厂数据
                </TableCell>
              </TableRow>
            ) : (
              factories.map((factory) => {
                const statusConfig = factoryStatusConfig[factory.status]
                const tierConfig = factoryTierConfig[factory.factoryTier]
                const typeLabel = factoryTypeConfig[factory.factoryType]?.label ?? factory.factoryType
                const parentFactory = factory.parentFactoryId
                  ? allFactories.find((f) => f.id === factory.parentFactoryId)
                  : null

                return (
                  <TableRow key={factory.id}>
                    <TableCell className="font-mono text-xs">{factory.code}</TableCell>
                    <TableCell className="font-medium">{factory.name}</TableCell>
                    <TableCell className="text-sm">
                      {(factory as any).contactName ?? (factory as any).contactPerson ?? factory.contact ?? '-'}
                    </TableCell>
                    <TableCell className="text-sm font-mono text-xs whitespace-nowrap">
                      {(factory as any).contactPhone ?? factory.phone ?? (factory as any).mobile ?? '-'}
                    </TableCell>
                    <TableCell className="max-w-[160px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm text-muted-foreground truncate block max-w-[150px]">
                            {factory.address ?? (factory as any).location ?? '-'}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          {factory.address ?? (factory as any).location ?? '-'}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums">
                      {factory.monthlyCapacity != null
                        ? Math.round(factory.monthlyCapacity).toLocaleString()
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={tierConfig.color}>
                        {tierConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground">{typeLabel}</span>
                    </TableCell>
                    <TableCell>
                      {parentFactory ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm text-muted-foreground cursor-default max-w-[110px] truncate block">
                              {parentFactory.name}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{parentFactory.name} ({parentFactory.code})</TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {factory.pdaEnabled ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 text-green-600">
                              <Wifi className="h-3.5 w-3.5" />
                              <span className="text-xs font-mono">{factory.pdaTenantId?.slice(-6) ?? '-'}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>租户ID: {factory.pdaTenantId}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <WifiOff className="h-3.5 w-3.5" />
                          <span className="text-xs">未启用</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <EligibilityBadges factory={factory} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusConfig.color}>
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">打开菜单</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(factory)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDelete(factory)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  )
}
