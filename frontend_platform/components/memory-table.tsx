'use client'

import { useMemo, useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from './hindsight-icons'
import { cn } from '@/lib/utils'

export interface TableRow {
  id: string
  text: string
  date: string
  entities: string[]
  context: string
}

export interface MemoryTableProps {
  rows: TableRow[]
  loading?: boolean
  onRowClick?: (row: TableRow) => void
}

type SortKey = 'date' | 'text' | 'entities'

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: 'date', label: 'Date', className: 'w-28 shrink-0' },
  { key: 'text', label: 'Text' },
  { key: 'entities', label: 'Entities', className: 'w-40 shrink-0 hidden lg:table-cell' },
]

export function MemoryTable({ rows, loading, onRowClick }: MemoryTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'date') {
        cmp = (a.date ?? '').localeCompare(b.date ?? '')
      } else if (sortKey === 'text') {
        cmp = (a.text ?? '').localeCompare(b.text ?? '')
      } else if (sortKey === 'entities') {
        cmp = (a.entities?.length ?? 0) - (b.entities?.length ?? 0)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [rows, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'date' ? 'desc' : 'asc')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="size-5" />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="text-center text-[hsl(var(--vault-muted))] text-[12px] py-10">
        No facts to show.
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[hsl(var(--border))] text-left">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-2 text-xs font-medium text-[hsl(var(--vault-muted))] uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors',
                  col.className
                )}
                onClick={() => toggleSort(col.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key ? (
                    <span className="text-[hsl(var(--vault-active))]">
                      {sortDir === 'asc' ? '↑' : '↓'}
                    </span>
                  ) : null}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.id}
              className={cn(
                'border-b border-[hsl(var(--border))] last:border-b-0 transition-colors',
                onRowClick && 'cursor-pointer hover:bg-[hsl(var(--secondary))]/50'
              )}
              onClick={() => onRowClick?.(row)}
            >
              <td className="px-4 py-2 text-xs tabular-nums text-[hsl(var(--vault-muted))]">
                {row.date || '—'}
              </td>
              <td className="px-4 py-2 text-sm leading-relaxed">
                {row.text || '—'}
              </td>
              <td className="px-4 py-2 text-xs text-[hsl(var(--vault-muted))] hidden lg:table-cell">
                {row.entities?.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {row.entities.slice(0, 4).map((e) => (
                      <span
                        key={e}
                        className="inline-block rounded-full px-1.5 py-0.5 bg-[hsl(var(--accent))]/10 text-[hsl(var(--vault-active))]"
                      >
                        {e}
                      </span>
                    ))}
                    {row.entities.length > 4 ? (
                      <span className="text-[hsl(var(--vault-muted))]">+{row.entities.length - 4}</span>
                    ) : null}
                  </div>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  )
}
