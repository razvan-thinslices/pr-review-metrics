'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  delay?: number // ms before showing, default 100
  maxWidth?: number // px, default 360
}

export default function Tooltip({ content, children, delay = 100, maxWidth = 360 }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      if (!triggerRef.current) return
      setVisible(true)
    }, delay)
  }, [delay])

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setVisible(false)
    setCoords(null)
  }, [])

  // Position the tooltip after it renders so we can measure its dimensions
  useEffect(() => {
    if (!visible || !tooltipRef.current || !triggerRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const pad = 8

    // Center horizontally above the trigger
    let left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2
    let top = triggerRect.top - tooltipRect.height - 8

    // Clamp horizontal edges
    if (left < pad) left = pad
    if (left + tooltipRect.width > window.innerWidth - pad) {
      left = window.innerWidth - pad - tooltipRect.width
    }

    // If it overflows the top of the viewport, show below instead
    if (top < pad) {
      top = triggerRect.bottom + 8
    }

    setCoords({ top, left })
  }, [visible])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const tooltip = visible ? (
    <div
      ref={tooltipRef}
      role="tooltip"
      style={{
        position: 'fixed',
        top: coords?.top ?? -9999,
        left: coords?.left ?? -9999,
        maxWidth,
        zIndex: 9999,
        // Invisible until we've measured and positioned
        opacity: coords ? 1 : 0,
      }}
      className="px-3 py-2 text-sm leading-relaxed font-normal normal-case tracking-normal text-gray-100 bg-gray-900 dark:text-gray-100 dark:bg-gray-700 rounded-lg shadow-lg border border-gray-700 dark:border-gray-600 pointer-events-none"
    >
      {content}
    </div>
  ) : null

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        className="inline-flex"
      >
        {children}
      </span>
      {mounted && tooltip && createPortal(tooltip, document.body)}
    </>
  )
}
