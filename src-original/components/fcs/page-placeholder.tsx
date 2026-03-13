'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface PagePlaceholderProps {
  title: string
  description: string
  category: string
}

export function PagePlaceholder({ title, description, category }: PagePlaceholderProps) {
  return (
    <div className="p-6">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground mb-1">{category}</p>
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 bg-muted/30 rounded-lg border-2 border-dashed border-muted">
            <p className="text-muted-foreground">页面内容开发中...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
