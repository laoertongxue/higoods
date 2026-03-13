'use client'

import { useEffect } from 'react'
import { getPdaSession } from '@/lib/fcs/fcs-store'

export default function PdaPage() {
  useEffect(() => {
    const session = getPdaSession()
    if (!session.userId || !session.factoryId) {
      window.location.replace('/fcs/pda/login')
    } else {
      // 已登录 → 进入「待办」工作台
      window.location.replace('/fcs/pda/notify')
    }
  }, [])

  return null
}
