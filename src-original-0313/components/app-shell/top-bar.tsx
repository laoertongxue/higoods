'use client'

import { Bell, Menu, ChevronDown, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { useAppShell } from './app-shell-context'

export function TopBar() {
  const {
    systems,
    currentSystem,
    switchSystem,
    setSidebarOpen,
  } = useAppShell()

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center border-b bg-background px-4">
      {/* 左侧：Logo + 汉堡菜单 */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">打开菜单</span>
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm">
            HG
          </div>
          <span className="font-semibold text-lg hidden sm:inline">HiGood</span>
        </div>
      </div>

      {/* 中间：系统导航 */}
      <div className="flex-1 mx-4 overflow-hidden">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex items-center gap-1">
            {systems.map((system) => (
              <button
                key={system.id}
                onClick={() => switchSystem(system.id)}
                className={cn(
                  'relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap',
                  'hover:bg-accent hover:text-accent-foreground',
                  currentSystem?.id === system.id
                    ? 'text-blue-600'
                    : 'text-muted-foreground'
                )}
              >
                <span>{system.name}</span>
                <span className="text-xs text-muted-foreground">({system.shortName})</span>
                {currentSystem?.id === system.id && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* 右侧：通知 + 用户 */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
          <span className="sr-only">通知</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-blue-100 text-blue-600 text-sm">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:inline text-sm">管理员</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem>个人设置</DropdownMenuItem>
            <DropdownMenuItem>账号管理</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">退出登录</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
