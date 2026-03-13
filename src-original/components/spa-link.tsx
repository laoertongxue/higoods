'use client'

import React from 'react'
import { spaNavigate } from '@/components/app-shell/app-shell-context'

interface SpaLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string
  children: React.ReactNode
}

/**
 * SPA-aware link component that replaces next/link.
 * Uses pushState for /fcs/ routes to avoid RSC payload fetches.
 */
export default function SpaLink({ href, children, onClick, ...props }: SpaLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) onClick(e)
    if (e.defaultPrevented) return
    // Allow normal behavior for external links, new tabs, etc.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (href.startsWith('http') || href.startsWith('//')) return
    e.preventDefault()
    spaNavigate(href)
  }

  return (
    <a href={href} onClick={handleClick} {...props}>
      {children}
    </a>
  )
}
