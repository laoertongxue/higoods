'use client'

import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { useAppShell } from './app-shell-context'

export function TabsBar() {
  const {
    currentTabs,
    currentActiveKey,
    handleCloseTab,
    handleActivateTab,
  } = useAppShell()

  if (currentTabs.length === 0) {
    return null
  }

  return (
    <div className="border-b bg-muted/30">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex items-center">
          {currentTabs.map((tab) => (
            <div
              key={tab.key}
              className={cn(
                'group relative flex items-center gap-2 border-r px-4 py-2 text-sm cursor-pointer transition-colors',
                'hover:bg-accent',
                currentActiveKey === tab.key
                  ? 'bg-background text-foreground'
                  : 'bg-muted/50 text-muted-foreground'
              )}
              onClick={() => handleActivateTab(tab.key)}
            >
              <span className="max-w-32 truncate">{tab.title}</span>
              {tab.closable && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCloseTab(tab.key)
                  }}
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded-sm transition-colors',
                    'hover:bg-muted-foreground/20',
                    'opacity-0 group-hover:opacity-100',
                    currentActiveKey === tab.key && 'opacity-100'
                  )}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              {currentActiveKey === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}
