'use client'

import { useState, useMemo } from 'react'
// useRouter removed — use window.location for PDA navigation
import { LogIn, LogOut, Factory, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useFcs } from '@/lib/fcs/fcs-store'
import { getPdaSession, setPdaSession, clearPdaSession } from '@/lib/fcs/fcs-store'
import { t } from '@/lib/i18n'

export default function PdaLoginPage() {

  const { toast } = useToast()
  const { state } = useFcs()

  const session = getPdaSession()

  const [selectedFactoryId, setSelectedFactoryId] = useState<string>(session.factoryId || '')
  const [selectedUserId, setSelectedUserId] = useState<string>(session.userId || '')

  // 只展示 ACTIVE 工厂（所有 ACTIVE 工厂都视为 pdaEnabled=true）
  const availableFactories = useMemo(
    () => state.factories.filter(f => f.status === 'ACTIVE'),
    [state.factories]
  )

  // 按 factoryId 过滤用户，只展示 ACTIVE 用户
  const availableUsers = useMemo(() => {
    if (!selectedFactoryId) return []
    return state.factoryUsers.filter(
      u => u.factoryId === selectedFactoryId
    )
  }, [state.factoryUsers, selectedFactoryId])

  const handleFactoryChange = (factoryId: string) => {
    setSelectedFactoryId(factoryId)
    setSelectedUserId('')
  }

  const handleLogin = () => {
    if (!selectedFactoryId || !selectedUserId) return

    const user = state.factoryUsers.find(u => u.userId === selectedUserId)
    if (!user || user.status === 'LOCKED') {
      toast({ title: t('common.tip'), description: t('pda.auth.login.factoryDisabled'), variant: 'destructive' })
      return
    }

    setPdaSession(selectedUserId, selectedFactoryId)
    toast({ title: t('pda.auth.login.success') })
    window.location.href = '/fcs/pda/notify'
  }

  const handleLogout = () => {
    clearPdaSession()
    setSelectedFactoryId('')
    setSelectedUserId('')
    toast({ title: t('pda.auth.login.logout') })
  }

  const isLoggedIn = !!(session.userId && session.factoryId)
  const currentUser = isLoggedIn
    ? state.factoryUsers.find(u => u.userId === session.userId)
    : undefined
  const currentFactory = isLoggedIn
    ? state.factories.find(f => f.id === session.factoryId)
    : undefined

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Factory className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">{t('pda.auth.login.title')}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* 当前会话信息 */}
          {isLoggedIn && currentUser && currentFactory && (
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Factory className="h-4 w-4" />
                <span className="font-medium text-foreground">{currentFactory.name}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{currentUser.name}</span>
              </div>
            </div>
          )}

          {/* 工厂选择 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t('pda.auth.login.selectFactory')}
            </label>
            <Select value={selectedFactoryId} onValueChange={handleFactoryChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('pda.auth.login.placeholder.factory')} />
              </SelectTrigger>
              <SelectContent>
                {availableFactories.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {t('pda.auth.login.noActiveFactory')}
                  </div>
                ) : (
                  availableFactories.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      <span className="font-medium">{f.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{f.code}</span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* 用户选择 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t('pda.auth.login.selectUser')}
            </label>
            <Select
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              disabled={!selectedFactoryId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('pda.auth.login.placeholder.user')} />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {t('pda.auth.login.noActiveUser')}
                  </div>
                ) : (
                  availableUsers.map(u => (
                    <SelectItem
                      key={u.userId}
                      value={u.userId}
                      disabled={u.status === 'LOCKED'}
                    >
                      <span>{u.name}</span>
                      {u.status === 'LOCKED' && (
                        <span className="ml-2 text-xs text-destructive">
                          {t('pda.auth.login.userLocked')}
                        </span>
                      )}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* 登录按钮 */}
          <Button
            className="w-full"
            onClick={handleLogin}
            disabled={!selectedFactoryId || !selectedUserId}
          >
            <LogIn className="mr-2 h-4 w-4" />
            {t('pda.auth.login.login')}
          </Button>

          {/* 退出按钮（已登录时显示） */}
          {isLoggedIn && (
            <Button variant="outline" className="w-full" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              {t('pda.auth.login.logout')}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
