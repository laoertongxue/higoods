'use client'

import { AppShellProvider } from './app-shell-context'
import { TopBar } from './top-bar'
import { LeftSidebar } from './left-sidebar'
import { TabsBar } from './tabs-bar'
import { systems, menusBySystem } from '@/lib/mock-data'

interface AppShellProps {
  children: React.ReactNode
  systemId: string
}

export function AppShell({ children, systemId }: AppShellProps) {
  return (
    <AppShellProvider systems={systems} menusBySystem={menusBySystem} initialSystemId={systemId}>
      <div className="flex h-screen flex-col overflow-hidden">
        {/* 顶部导航栏 */}
        <TopBar />
        
        <div className="flex flex-1 overflow-hidden">
          {/* 左侧菜单 */}
          <LeftSidebar />
          
          {/* 主内容区 */}
          <main className="flex flex-1 flex-col min-h-0 min-w-0">
            {/* 页面标签栏 */}
            <TabsBar />
            
            {/* 页面内容 - 可滚动区域 */}
            <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
              <div className="p-4 lg:p-6 max-w-full">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </AppShellProvider>
  )
}
