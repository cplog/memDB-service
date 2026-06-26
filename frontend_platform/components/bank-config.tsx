'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Spinner } from './hindsight-icons'
import { cn } from '@/lib/utils'

type ConfigSection = 'retain' | 'reflect' | 'advanced'

interface BankConfigProps {
  bankId: string
  section?: ConfigSection
}

const EXTRACTION_MODES = [
  { value: 'concise', label: 'Concise — selective, general-purpose (default)' },
  { value: 'verbose', label: 'Verbose — richer facts with full context' },
  { value: 'custom', label: 'Custom — your own extraction rules' },
]

const STRATEGIES = [
  { value: 'default', label: 'Default — balanced recall' },
  { value: 'custom', label: 'Custom — mission-driven' },
]

export function BankConfig({ bankId, section = 'retain' }: BankConfigProps) {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [bankName, setBankName] = useState('')
  const [extractionMode, setExtractionMode] = useState('concise')
  const [retainMission, setRetainMission] = useState('')
  const [retainCustomInstructions, setRetainCustomInstructions] = useState('')
  const [reflectMission, setReflectMission] = useState('')
  const [observationsMission, setObservationsMission] = useState('')
  const [strategy, setStrategy] = useState('default')
  const [enableObservations, setEnableObservations] = useState(true)
  const [storeDocumentText, setStoreDocumentText] = useState(true)
  const [enableTracing, setEnableTracing] = useState(false)
  const [entityLabelsJson, setEntityLabelsJson] = useState('')
  const [retainDefaultStrategy, setRetainDefaultStrategy] = useState('')
  const [retainStrategiesJson, setRetainStrategiesJson] = useState('')

  useEffect(() => {
    loadConfig()
  }, [bankId])

  async function loadConfig() {
    setLoading(true)
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankId, action: 'get' }),
      })
      const data = await res.json()
      setConfig(data)

      if (data) {
        setBankName(String(data.name || bankId))
        setExtractionMode(String(data.retain_extraction_mode || 'concise'))
        setRetainMission(String(data.retain_mission || ''))
        setRetainCustomInstructions(String(data.retain_custom_instructions || ''))
        setReflectMission(String(data.reflect_mission || ''))
        setObservationsMission(String(data.observations_mission || ''))
        setStrategy(String(data.reflect_strategy || 'default'))
        setEnableObservations(data.enable_observations !== false)
        setStoreDocumentText(data.store_document_text !== false)
        setEnableTracing(Boolean(data.enable_tracing))
        if (data.entity_labels) {
          setEntityLabelsJson(JSON.stringify(data.entity_labels, null, 2))
        }
        setRetainDefaultStrategy(String(data.retain_default_strategy || ''))
        if (data.retain_strategies) {
          setRetainStrategiesJson(JSON.stringify(data.retain_strategies, null, 2))
        } else {
          setRetainStrategiesJson('')
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setMessage('')
    try {
      const updates: Record<string, unknown> = {
        name: bankName.trim() || bankId,
        retain_extraction_mode: extractionMode,
        retain_mission: retainMission,
        reflect_mission: reflectMission,
        observations_mission: observationsMission,
        reflect_strategy: strategy,
        enable_observations: enableObservations,
        store_document_text: storeDocumentText,
        enable_tracing: enableTracing,
      }
      if (extractionMode === 'custom') {
        updates.retain_custom_instructions = retainCustomInstructions
      }
      if (entityLabelsJson.trim()) {
        updates.entity_labels = JSON.parse(entityLabelsJson)
      }
      if (retainDefaultStrategy.trim()) {
        updates.retain_default_strategy = retainDefaultStrategy.trim()
      }
      if (retainStrategiesJson.trim()) {
        updates.retain_strategies = JSON.parse(retainStrategiesJson)
      }

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankId, action: 'update', updates }),
      })
      if (res.ok) {
        setMessage('Configuration saved')
        await loadConfig()
      } else {
        const data = await res.json()
        setMessage(String(data.error ?? 'Failed to save configuration'))
      }
    } catch {
      setMessage('Error saving — check JSON fields (entity_labels, retain_strategies)')
    } finally {
      setSaving(false)
    }
  }

  const sectionTitle =
    section === 'retain'
      ? 'Retain extraction'
      : section === 'reflect'
        ? 'Reflect & observations'
        : 'Advanced'

  return (
    <Card className="border-border bg-[hsl(var(--card))] max-w-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[13px] font-medium">{sectionTitle}</CardTitle>
          <Badge variant="secondary" className="text-[10px] font-mono">
            {bankId}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="size-5" />
          </div>
        ) : (
          <>
            {section === 'retain' ? (
              <>
                <div className="rounded-sm border border-border bg-[hsl(var(--canvas))] px-3 py-2">
                  <p className="text-[11px] text-[hsl(var(--vault-muted))] leading-relaxed">
                    Set a human-readable bank name so first-person statements are attributed
                    correctly. Use each item&apos;s <code className="text-[10px]">context</code>{' '}
                    field on transcripts to name the speaker (e.g. &quot;Customer Maria is
                    speaking&quot;).
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Agent / bank name</Label>
                  <Input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Product team agent"
                    className="min-h-[44px] text-[12px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Extraction mode</Label>
                  <Select value={extractionMode} onValueChange={setExtractionMode}>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXTRACTION_MODES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Retain mission</Label>
                  <Textarea
                    value={retainMission}
                    onChange={(e) => setRetainMission(e.target.value)}
                    placeholder="Always include technical decisions and API trade-offs. Ignore meeting logistics and greetings."
                    className="min-h-[88px] text-[12px]"
                  />
                  <p className="text-[11px] text-[hsl(var(--vault-muted))] leading-relaxed">
                    Plain-language steer injected into extraction — narrows focus without replacing
                    built-in rules.
                  </p>
                </div>

                {extractionMode === 'custom' ? (
                  <div className="space-y-2">
                    <Label className="text-sm">Custom extraction instructions</Label>
                    <Textarea
                      value={retainCustomInstructions}
                      onChange={(e) => setRetainCustomInstructions(e.target.value)}
                      placeholder="Write your full extraction rules here…"
                      className="min-h-[120px] text-[12px] font-mono"
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label className="text-sm">Default retain strategy</Label>
                  <Input
                    value={retainDefaultStrategy}
                    onChange={(e) => setRetainDefaultStrategy(e.target.value)}
                    placeholder="meetings"
                    className="min-h-[44px] text-[12px] font-mono"
                  />
                  <p className="text-[11px] text-[hsl(var(--vault-muted))] leading-relaxed">
                    Key into retain_strategies below. Used when upload/note does not pick a
                    strategy.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Retain strategies (JSON)</Label>
                  <Textarea
                    value={retainStrategiesJson}
                    onChange={(e) => setRetainStrategiesJson(e.target.value)}
                    placeholder={'{"meetings":{"retain_extraction_mode":"concise"},"uploads":{"retain_extraction_mode":"verbose"}}'}
                    className="min-h-[100px] text-[11px] font-mono"
                  />
                  <p className="text-[11px] text-[hsl(var(--vault-muted))] leading-relaxed">
                    Named extraction profiles for different content types in this team bank.
                    Scenarios choose tags; strategies choose how content is extracted.
                  </p>
                </div>
              </>
            ) : null}

            {section === 'reflect' ? (
              <>
                <div className="space-y-2">
                  <Label className="text-sm">Reflect mission</Label>
                  <Textarea
                    value={reflectMission}
                    onChange={(e) => setReflectMission(e.target.value)}
                    placeholder="Summarize product direction, open decisions, and customer-facing risks."
                    className="min-h-[88px] text-[12px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Reflect strategy</Label>
                  <Select value={strategy} onValueChange={setStrategy}>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STRATEGIES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Enable observations</Label>
                    <p className="text-[11px] text-[hsl(var(--vault-muted))]">
                      Consolidate patterns after retain (async background job)
                    </p>
                  </div>
                  <Switch checked={enableObservations} onCheckedChange={setEnableObservations} />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Observations mission</Label>
                  <Textarea
                    value={observationsMission}
                    onChange={(e) => setObservationsMission(e.target.value)}
                    placeholder="Track recurring themes, conflicting priorities, and customer patterns."
                    className="min-h-[88px] text-[12px]"
                  />
                </div>

                <div className="rounded-sm border border-border bg-[hsl(var(--canvas))] px-3 py-2">
                  <p className="text-[11px] text-[hsl(var(--vault-muted))] leading-relaxed">
                    <span className="font-medium text-foreground">Scopes:</span> private retains use{' '}
                    <code className="text-[10px]">per_tag</code> consolidation; shared retains use{' '}
                    <code className="text-[10px]">combined</code> — keeps team/private observations
                    from bleeding across visibility boundaries.
                  </p>
                </div>
              </>
            ) : null}

            {section === 'advanced' ? (
              <>
                <div className="space-y-2">
                  <Label className="text-sm">Entity labels (JSON)</Label>
                  <Textarea
                    value={entityLabelsJson}
                    onChange={(e) => setEntityLabelsJson(e.target.value)}
                    placeholder='[{"key":"content_kind","description":"…","type":"value","values":[…]}]'
                    className="min-h-[120px] text-[11px] font-mono"
                  />
                  <p className="text-[11px] text-[hsl(var(--vault-muted))] leading-relaxed">
                    Controlled vocabulary extracted at retain time — labels become entities and
                    link related memories. Example keys: pedagogy:scaffolding, audience:client.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Store document text</Label>
                      <p className="text-[11px] text-[hsl(var(--vault-muted))]">
                        Keep raw source alongside extracted facts
                      </p>
                    </div>
                    <Switch checked={storeDocumentText} onCheckedChange={setStoreDocumentText} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Enable LLM tracing</Label>
                      <p className="text-[11px] text-[hsl(var(--vault-muted))]">
                        Debug retain/recall calls
                      </p>
                    </div>
                    <Switch checked={enableTracing} onCheckedChange={setEnableTracing} />
                  </div>
                </div>

                {config ? (
                  <div className="bg-[hsl(var(--canvas))] rounded-sm p-3 border border-border">
                    <div className="text-[10px] font-medium text-[hsl(var(--vault-muted))] mb-2 uppercase tracking-widest">
                      Resolved config
                    </div>
                    <pre className="text-[10px] text-[hsl(var(--vault-muted))] overflow-auto max-h-40 font-mono">
                      {JSON.stringify(config, null, 2)}
                    </pre>
                  </div>
                ) : null}
              </>
            ) : null}

            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 text-[12px] min-h-[44px]"
              >
                {saving ? <Spinner className="mr-2" /> : null}
                Save
              </Button>
              <Button
                variant="outline"
                onClick={loadConfig}
                disabled={loading}
                className="text-[12px] min-h-[44px]"
              >
                Reload
              </Button>
            </div>

            {message ? (
              <div
                className={cn(
                  'text-[12px] p-2 rounded-sm',
                  message.includes('saved')
                    ? 'bg-[hsl(var(--success-bg))] text-[hsl(var(--success-fg))]'
                    : 'bg-[hsl(var(--error-bg))] text-[hsl(var(--error-fg))]'
                )}
              >
                {message}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
