'use client'

import { useEffect, useRef } from 'react'

/**
 * Scroll-triggered reveal hook.
 * Adds/removes `revealed` class when element enters/leaves viewport.
 *
 * Usage:
 *   <div ref={ref} className="reveal">content</div>
 *   <div ref={ref} className="reveal-stagger">
 *     <div className="reveal">...</div>
 *     <div className="reveal">...</div>
 *   </div>
 */
export function useReveal() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
          }
        }
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px',
      },
    )

    // Observe the element itself AND all .reveal children
    observer.observe(el)
    el.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach((child) => {
      observer.observe(child)
    })

    return () => observer.disconnect()
  }, [])

  return ref
}
