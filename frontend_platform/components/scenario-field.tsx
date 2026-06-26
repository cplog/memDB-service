'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { TEAM_SCENARIO_PRESETS } from '../../shared/lib/scenario'
import { parseTeamBankId } from '@/lib/teams'
import { cn } from '@/lib/utils'

interface ScenarioFieldProps {
  bankId: string
  value: string
  onChange: (value: string) => void
  /** Show retain strategy picker when bank has named strategies configured. */
  retainStrategy?: string
  onRetainStrategyChange?: (value: string) => void
  retainStrategyOptions?: string[]
  className?: string
}

export function ScenarioField({
  bankId,
  value,
  onChange,
  retainStrategy,
  onRetainStrategyChange,
  retainStrategyOptions,
  className,
}: ScenarioFieldProps) {
  const teamId = parseTeamBankId(bankId)
  const presets = teamId ? (TEAM_SCENARIO_PRESETS[teamId] ?? []) : []

  return (
    <div className={cn('space-y-3', className)}>
      <div className="space-y-2">
        <Label className="text-sm">Scenario (optional)</Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="megacorp-renewal or shared"
          className="min-h-[44px] text-[12px]"
        />
        <p className="text-xs text-[hsl(var(--vault-muted))] leading-relaxed">
          Tags content as <code className="text-xs">scenario:{'{id}'}</code>. Use{' '}
          <code className="text-xs">shared</code> for docs visible across scenarios in this
          team bank. Leave empty for team-wide scope.
        </p>
        {presets.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                className="min-h-[44px] px-2"
                onClick={() => onChange(preset)}
              >
                <Badge
                  variant={value === preset ? 'default' : 'secondary'}
                  className="text-xs cursor-pointer"
                >
                  {preset}
                </Badge>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {onRetainStrategyChange && retainStrategyOptions && retainStrategyOptions.length > 0 ? (
        <div className="space-y-2">
          <Label className="text-sm">Retain strategy (optional)</Label>
          <div className="flex flex-wrap gap-1">
            <button type="button" className="min-h-[44px] px-1" onClick={() => onRetainStrategyChange('')}>
              <Badge
                variant={!retainStrategy ? 'default' : 'outline'}
                className="text-xs cursor-pointer"
              >
                default
              </Badge>
            </button>
            {retainStrategyOptions.map((name) => (
              <button
                key={name}
                type="button"
                className="min-h-[44px] px-1"
                onClick={() => onRetainStrategyChange(name)}
              >
                <Badge
                  variant={retainStrategy === name ? 'default' : 'outline'}
                  className="text-xs cursor-pointer"
                >
                  {name}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
