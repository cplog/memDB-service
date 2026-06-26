'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface EndpointDef {
  id: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  description: string
  body?: Record<string, unknown>
  query?: Record<string, string>
  note?: string
}

const ENDPOINTS: EndpointDef[] = [
  {
    id: 'health',
    method: 'GET',
    path: '/health',
    description: 'Health check — returns service status',
  },
  {
    id: 'teams',
    method: 'GET',
    path: '/api/teams',
    description: 'List all teams accessible to the authenticated user',
  },
  {
    id: 'banks',
    method: 'GET',
    path: '/api/banks',
    description: 'List all banks the user has access to',
  },
  {
    id: 'banks-create',
    method: 'PUT',
    path: '/api/banks',
    description: 'Create a new bank for a team (consultant only)',
    body: { teamId: 'product' },
    note: 'Requires consultant role. Creates bank if it does not exist.',
  },
  {
    id: 'documents',
    method: 'GET',
    path: '/api/documents',
    description: 'List documents in a bank',
    query: { bankId: 'team-product', limit: '50', offset: '0', q: '', tags: '', tagsMatch: 'any_strict' },
  },
  {
    id: 'document-get',
    method: 'GET',
    path: '/api/documents/{documentId}',
    description: 'Get a single document by ID',
    query: { bankId: 'team-product' },
  },
  {
    id: 'document-delete',
    method: 'DELETE',
    path: '/api/documents/{documentId}',
    description: 'Delete a document from a bank',
    query: { bankId: 'team-product' },
  },
  {
    id: 'document-update',
    method: 'PUT',
    path: '/api/documents/{documentId}',
    description: 'Update document content (retain as new version)',
    body: { bankId: 'team-product', content: 'Updated content here...' },
  },
  {
    id: 'document-tags',
    method: 'PATCH',
    path: '/api/documents/{documentId}',
    description: 'Update document tags (consultant only)',
    body: { bankId: 'team-product', tags: ['tag1', 'tag2'] },
    note: 'Requires consultant role.',
  },
  {
    id: 'memories',
    method: 'GET',
    path: '/api/memories',
    description: 'List memory units in a bank',
    query: { bankId: 'team-product', limit: '50', offset: '0', documentId: '', q: '' },
  },
  {
    id: 'retain',
    method: 'POST',
    path: '/api/retain',
    description: 'Ingest new content into a bank (retain)',
    body: {
      bankId: 'team-product',
      content: 'Content to remember...',
      title: 'Optional title',
      slug: 'optional-slug',
      tags: ['user-tag'],
      sourceType: 'note',
      sourceDate: '2026-01-01',
    },
  },
  {
    id: 'recall',
    method: 'POST',
    path: '/api/recall',
    description: 'Search memories by semantic query (recall)',
    body: { bankId: 'team-product', query: 'What do we know about...?', budget: 'mid', scenarioId: '' },
  },
  {
    id: 'reflect',
    method: 'POST',
    path: '/api/reflect',
    description: 'Generate an answer from bank knowledge (reflect)',
    body: { bankId: 'team-product', query: 'Summarize our approach to...', budget: 'mid', scenarioId: '' },
  },
  {
    id: 'stats',
    method: 'POST',
    path: '/api/stats',
    description: 'Get bank statistics (document count, pending ops, etc.)',
    body: { bankId: 'team-product' },
  },
  {
    id: 'config-get',
    method: 'POST',
    path: '/api/config',
    description: 'Get bank configuration',
    body: { bankId: 'team-product', action: 'get' },
  },
  {
    id: 'config-update',
    method: 'POST',
    path: '/api/config',
    description: 'Update bank configuration (consultant only)',
    body: { bankId: 'team-product', action: 'update', updates: { name: 'New Name' } },
    note: 'Requires consultant role.',
  },
  {
    id: 'graph',
    method: 'GET',
    path: '/api/banks/{bankId}/graph',
    description: 'Get force-directed graph data for a bank',
  },
  {
    id: 'wiki',
    method: 'GET',
    path: '/api/banks/{bankId}/wiki',
    description: 'Export bank as OKF-style wiki bundle',
    query: { bankLabel: 'Product' },
  },
  {
    id: 'mental-models',
    method: 'GET',
    path: '/api/mental-models',
    description: 'List mental models for a bank',
    query: { bankId: 'team-product', detail: 'content', limit: '50', offset: '0' },
  },
  {
    id: 'mental-model-create',
    method: 'POST',
    path: '/api/mental-models',
    description: 'Create a mental model (consultant only)',
    body: { bankId: 'team-product', name: 'Model Name', sourceQuery: 'query text', tags: [], maxTokens: 2000, autoRefresh: false },
    note: 'Requires consultant role.',
  },
  {
    id: 'mental-model-refresh',
    method: 'POST',
    path: '/api/mental-models/{mentalModelId}/refresh',
    description: 'Refresh a mental model (consultant only)',
    body: { bankId: 'team-product' },
    note: 'Requires consultant role.',
  },
  {
    id: 'mental-model-clear',
    method: 'POST',
    path: '/api/mental-models/{mentalModelId}/clear',
    description: 'Clear a mental model (consultant only)',
    body: { bankId: 'team-product' },
    note: 'Requires consultant role.',
  },
  {
    id: 'entities',
    method: 'GET',
    path: '/api/entities',
    description: 'List extracted entities for a bank',
    query: { bankId: 'team-product', limit: '50', offset: '0' },
  },
  {
    id: 'entity-get',
    method: 'GET',
    path: '/api/entities/{entityId}',
    description: 'Get a single entity by ID',
    query: { bankId: 'team-product' },
  },
  {
    id: 'export',
    method: 'POST',
    path: '/api/export',
    description: 'Export bank data (consultant only)',
    body: { bankId: 'team-product' },
    note: 'Requires consultant role.',
  },
  {
    id: 'export-wiki',
    method: 'POST',
    path: '/api/export-wiki',
    description: 'Export bank as wiki bundle (consultant only)',
    body: { bankId: 'team-product', bankLabel: 'Product' },
    note: 'Requires consultant role.',
  },
  {
    id: 'upload',
    method: 'POST',
    path: '/api/upload',
    description: 'Upload a file to a bank (multipart/form-data)',
    note: 'Use multipart/form-data. Fields: bankId, file, parser (markitdown| unstructured), documentId (optional), sourceType, meetingName, ticketId, sourceDate, scenarioId, retainStrategy.',
  },
]

const GROUPS = [
  { id: 'core', label: 'Core', filter: (e: EndpointDef) => !e.path.includes('mental') && !e.path.includes('export') && !e.path.includes('wiki') && !e.path.includes('graph') && e.id !== 'upload' },
  { id: 'knowledge', label: 'Knowledge', filter: (e: EndpointDef) => e.path.includes('mental') || e.id === 'graph' || e.id === 'wiki' },
  { id: 'export', label: 'Export & Upload', filter: (e: EndpointDef) => e.path.includes('export') || e.id === 'upload' },
]

function buildCurl(endpoint: EndpointDef, baseUrl: string, apiKey: string, bankId: string, documentId: string, mentalModelId: string, entityId: string, bodyOverride: string): string {
  let url = `${baseUrl}${endpoint.path}`
  url = url.replace('{bankId}', bankId).replace('{documentId}', documentId).replace('{mentalModelId}', mentalModelId).replace('{entityId}', entityId)

  const queryParts: string[] = []
  if (endpoint.query) {
    for (const [k, v] of Object.entries(endpoint.query)) {
      const val = k === 'bankId' ? bankId : v
      if (val) queryParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(val)}`)
    }
  }
  if (queryParts.length) url += `?${queryParts.join('&')}`

  let cmd = `curl -X ${endpoint.method} "${url}"`

  if (apiKey) {
    cmd += ` \\\n  -H "Authorization: Bearer ${apiKey}"`
  }

  if (endpoint.body || bodyOverride) {
    cmd += ` \\\n  -H "Content-Type: application/json"`
  }

  if (endpoint.id === 'upload') {
    cmd = `curl -X POST "${baseUrl}/api/upload" \\\n  -H "Authorization: Bearer ${apiKey}" \\\n  -F "bankId=${bankId}" \\\n  -F "file=@/path/to/file.pdf" \\\n  -F "parser=markitdown"`
    return cmd
  }

  let bodyStr = bodyOverride
  if (!bodyStr && endpoint.body) {
    const body = { ...endpoint.body }
    if ('bankId' in body) body.bankId = bankId
    if ('documentId' in body) body.documentId = documentId
    if ('mentalModelId' in body) body.mentalModelId = mentalModelId
    if ('entityId' in body) body.entityId = entityId
    bodyStr = JSON.stringify(body, null, 2)
  }

  if (bodyStr) {
    cmd += ` \\\n  -d '${bodyStr}'`
  }

  return cmd
}

function buildFetch(endpoint: EndpointDef, baseUrl: string, apiKey: string, bankId: string, documentId: string, mentalModelId: string, entityId: string, bodyOverride: string): string {
  let url = `${baseUrl}${endpoint.path}`
  url = url.replace('{bankId}', bankId).replace('{documentId}', documentId).replace('{mentalModelId}', mentalModelId).replace('{entityId}', entityId)

  const queryParts: string[] = []
  if (endpoint.query) {
    for (const [k, v] of Object.entries(endpoint.query)) {
      const val = k === 'bankId' ? bankId : v
      if (val) queryParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(val)}`)
    }
  }
  if (queryParts.length) url += `?${queryParts.join('&')}`

  const headers: string[] = []
  if (apiKey) headers.push(`    'Authorization': 'Bearer ${apiKey}',`)
  if (endpoint.body || bodyOverride) headers.push(`    'Content-Type': 'application/json',`)

  let bodyStr = bodyOverride
  if (!bodyStr && endpoint.body) {
    const body = { ...endpoint.body }
    if ('bankId' in body) body.bankId = bankId
    if ('documentId' in body) body.documentId = documentId
    if ('mentalModelId' in body) body.mentalModelId = mentalModelId
    if ('entityId' in body) body.entityId = entityId
    bodyStr = JSON.stringify(body, null, 2)
  }

  if (endpoint.id === 'upload') {
    return `const formData = new FormData();
formData.append('bankId', '${bankId}');
formData.append('file', fileInput.files[0]);
formData.append('parser', 'markitdown');

fetch('${baseUrl}/api/upload', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${apiKey}',
  },
  body: formData,
})`
  }

  let code = `fetch('${url}', {
  method: '${endpoint.method}',`

  if (headers.length) {
    code += `\n  headers: {\n${headers.join('\n')}\n  },`
  }

  if (bodyStr) {
    code += `\n  body: ${JSON.stringify(bodyStr)},`
  }

  code += `\n})\n  .then(r => r.json())\n  .then(data => console.log(data))\n  .catch(err => console.error(err))`

  return code
}

function buildPython(endpoint: EndpointDef, baseUrl: string, apiKey: string, bankId: string, documentId: string, mentalModelId: string, entityId: string, bodyOverride: string): string {
  let url = `${baseUrl}${endpoint.path}`
  url = url.replace('{bankId}', bankId).replace('{documentId}', documentId).replace('{mentalModelId}', mentalModelId).replace('{entityId}', entityId)

  const queryParts: string[] = []
  if (endpoint.query) {
    for (const [k, v] of Object.entries(endpoint.query)) {
      const val = k === 'bankId' ? bankId : v
      if (val) queryParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(val)}`)
    }
  }
  if (queryParts.length) url += `?${queryParts.join('&')}`

  let bodyStr = bodyOverride
  if (!bodyStr && endpoint.body) {
    const body = { ...endpoint.body }
    if ('bankId' in body) body.bankId = bankId
    if ('documentId' in body) body.documentId = documentId
    if ('mentalModelId' in body) body.mentalModelId = mentalModelId
    if ('entityId' in body) body.entityId = entityId
    bodyStr = JSON.stringify(body, null, 2)
  }

  if (endpoint.id === 'upload') {
    return `import requests

url = "${baseUrl}/api/upload"
headers = {"Authorization": "Bearer ${apiKey}"}
files = {"file": open("/path/to/file.pdf", "rb")}
data = {"bankId": "${bankId}", "parser": "markitdown"}

response = requests.post(url, headers=headers, files=files, data=data)
print(response.json())`
  }

  let code = `import requests\n\nurl = "${url}"\nheaders = {`
  if (apiKey) code += `\n    "Authorization": "Bearer ${apiKey}",`
  if (bodyStr) code += `\n    "Content-Type": "application/json",`
  code += `\n}\n`

  if (bodyStr) {
    code += `\npayload = ${bodyStr}\n`
    code += `\nresponse = requests.${endpoint.method.toLowerCase()}(url, headers=headers, json=payload)\n`
  } else {
    code += `\nresponse = requests.${endpoint.method.toLowerCase()}(url, headers=headers)\n`
  }

  code += `print(response.json())`
  return code
}

function methodColor(method: string): string {
  switch (method) {
    case 'GET': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    case 'POST': return 'bg-blue-500/15 text-blue-400 border-blue-500/30'
    case 'PUT': return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    case 'PATCH': return 'bg-purple-500/15 text-purple-400 border-purple-500/30'
    case 'DELETE': return 'bg-red-500/15 text-red-400 border-red-500/30'
    default: return 'bg-muted text-muted-foreground'
  }
}

export function ApiPlayground({ bankId }: { bankId: string }) {
  const [baseUrl, setBaseUrl] = useState('https://knowledge.crewio.ai')
  const [apiKey, setApiKey] = useState('YOUR_API_KEY')
  const [documentId, setDocumentId] = useState('doc-123')
  const [mentalModelId, setMentalModelId] = useState('model-123')
  const [entityId, setEntityId] = useState('entity-123')
  const [bodyOverrides, setBodyOverrides] = useState<Record<string, string>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [lang, setLang] = useState<'curl' | 'fetch' | 'python'>('curl')

  const copyToClipboard = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500)
    } catch {
      // ponytail: fallback ignored — clipboard API is standard in all target browsers
    }
  }, [])

  const updateBodyOverride = useCallback((endpointId: string, value: string) => {
    setBodyOverrides((prev) => ({ ...prev, [endpointId]: value }))
  }, [])

  const buildCode = useCallback((endpoint: EndpointDef) => {
    const bodyOverride = bodyOverrides[endpoint.id] || ''
    switch (lang) {
      case 'curl': return buildCurl(endpoint, baseUrl, apiKey, bankId, documentId, mentalModelId, entityId, bodyOverride)
      case 'fetch': return buildFetch(endpoint, baseUrl, apiKey, bankId, documentId, mentalModelId, entityId, bodyOverride)
      case 'python': return buildPython(endpoint, baseUrl, apiKey, bankId, documentId, mentalModelId, entityId, bodyOverride)
    }
  }, [lang, baseUrl, apiKey, bankId, documentId, mentalModelId, entityId, bodyOverrides])

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">API Playground</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse all available endpoints. Copy the code snippets and use them in your own applications with your API key.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Connection Settings</CardTitle>
          <CardDescription>Configure your base URL and credentials. These are used in all generated snippets.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="baseUrl">Base URL</Label>
              <Input id="baseUrl" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://knowledge.crewio.ai" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apiKey">API Key</Label>
              <Input id="apiKey" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Bearer token or API key" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="docId">Document ID (placeholder)</Label>
              <Input id="docId" value={documentId} onChange={(e) => setDocumentId(e.target.value)} placeholder="doc-123" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="modelId">Mental Model ID (placeholder)</Label>
              <Input id="modelId" value={mentalModelId} onChange={(e) => setMentalModelId(e.target.value)} placeholder="model-123" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="entityId">Entity ID (placeholder)</Label>
              <Input id="entityId" value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="entity-123" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Current bank:</span>
            <Badge variant="outline" className="font-mono text-xs">{bankId}</Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="core" className="w-full">
        <TabsList className="mb-4">
          {GROUPS.map((g) => (
            <TabsTrigger key={g.id} value={g.id}>{g.label}</TabsTrigger>
          ))}
        </TabsList>

        {GROUPS.map((group) => (
          <TabsContent key={group.id} value={group.id} className="space-y-4">
            {ENDPOINTS.filter(group.filter).map((endpoint) => {
              const code = buildCode(endpoint)
              const hasBody = endpoint.body !== undefined || endpoint.id === 'upload'
              return (
                <Card key={endpoint.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={cn('font-mono text-xs font-semibold', methodColor(endpoint.method))}>
                            {endpoint.method}
                          </Badge>
                          <code className="text-sm font-mono text-foreground">{endpoint.path}</code>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1.5">{endpoint.description}</p>
                        {endpoint.note ? (
                          <p className="text-xs text-amber-400/80 mt-1">{endpoint.note}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'h-7 text-xs',
                            lang === 'curl' && 'bg-accent text-accent-foreground'
                          )}
                          onClick={() => setLang('curl')}
                        >
                          cURL
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'h-7 text-xs',
                            lang === 'fetch' && 'bg-accent text-accent-foreground'
                          )}
                          onClick={() => setLang('fetch')}
                        >
                          Fetch
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'h-7 text-xs',
                            lang === 'python' && 'bg-accent text-accent-foreground'
                          )}
                          onClick={() => setLang('python')}
                        >
                          Python
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs ml-1"
                          onClick={() => copyToClipboard(code, endpoint.id)}
                        >
                          {copiedId === endpoint.id ? 'Copied!' : 'Copy'}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {hasBody ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Request Body (override JSON)</Label>
                        <Textarea
                          className="font-mono text-xs min-h-[80px]"
                          placeholder={endpoint.id === 'upload' ? 'Upload uses multipart/form-data. See snippet.' : JSON.stringify(endpoint.body, null, 2)}
                          value={bodyOverrides[endpoint.id] || ''}
                          onChange={(e) => updateBodyOverride(endpoint.id, e.target.value)}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Leave empty to use the default body. Edit to customize the request payload.
                        </p>
                      </div>
                    ) : null}
                    <div className="max-h-[240px] overflow-auto rounded-md border bg-[hsl(var(--vault))]/50">
                        <pre className="p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap break-all">{code}</pre>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
