'use client'

import { useEffect } from 'react'
import { getPdaSession } from '@/lib/fcs/fcs-store'

export default function PdaPage() {
  useEffect(() => {
    const session = getPdaSession()
    if (!session.userId || !session.factoryId) {
      window.location.replace('/fcs/pda/login')
    } else {
      window.location.replace('/fcs/pda/notify')
    }
  }, [])

  return null
}
