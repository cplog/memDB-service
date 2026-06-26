'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface StatsPanelProps {
  bankId: string
}

export function StatsPanel({ bankId }: StatsPanelProps) {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(String(data.error ?? `Could not load stats (${res.status})`))
        setStats(null)
        return
      }
      setStats(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load stats')
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [bankId])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  return (
    <section>
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border bg-[hsl(var(--card))]">
        <h2 className="text-sm font-medium tracking-tight">Bank stats</h2>
        <Badge variant="secondary" className="text-[10px] font-normal">
          {bankId}
        </Badge>
      </div>
      <div className="p-5">
        {error ? (
          <div className="space-y-3">
            <p className="text-xs text-[hsl(var(--error-fg))]">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px] text-xs"
              onClick={() => void loadStats()}
            >
              Retry
            </Button>
          </div>
        ) : loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : stats ? (
          <pre className="text-xs bg-[hsl(var(--canvas))] rounded-md p-4 overflow-auto max-h-[320px] font-mono text-[hsl(var(--vault-muted))] border border-border leading-relaxed">
            {JSON.stringify(stats, null, 2)}
          </pre>
        ) : (
          <div className="text-center text-[hsl(var(--vault-muted))] text-xs py-8">
            No stats available
          </div>
        )}
      </div>
    </section>
  )
}
