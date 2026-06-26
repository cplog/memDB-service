'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BankConfig } from './bank-config'
import { MentalModelsPanel } from './mental-models-panel'

interface AdminSettingsProps {
  bankId: string
}

export function AdminSettings({ bankId }: AdminSettingsProps) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[15px] font-medium tracking-tight">Bank settings</h1>
        <p className="text-xs text-[hsl(var(--vault-muted))] mt-1 leading-relaxed max-w-xl">
          Tune what gets retained, how Reflect answers, and which standing playbooks agents reuse.
          Bank name steers world vs experience attribution during extraction.
        </p>
      </div>
      <Tabs defaultValue="retain">
        <TabsList className="bg-[hsl(var(--secondary))] p-0.5 min-h-[44px] flex-wrap h-auto">
          <TabsTrigger value="retain" className="text-xs data-[state=active]:bg-[hsl(var(--canvas))]">
            Retain
          </TabsTrigger>
          <TabsTrigger value="reflect" className="text-xs data-[state=active]:bg-[hsl(var(--canvas))]">
            Reflect
          </TabsTrigger>
          <TabsTrigger value="playbooks" className="text-xs data-[state=active]:bg-[hsl(var(--canvas))]">
            Playbooks
          </TabsTrigger>
          <TabsTrigger value="advanced" className="text-xs data-[state=active]:bg-[hsl(var(--canvas))]">
            Advanced
          </TabsTrigger>
        </TabsList>

        <TabsContent value="retain" className="mt-4">
          <BankConfig bankId={bankId} section="retain" />
        </TabsContent>
        <TabsContent value="reflect" className="mt-4">
          <BankConfig bankId={bankId} section="reflect" />
        </TabsContent>
        <TabsContent value="playbooks" className="mt-4">
          <MentalModelsPanel bankId={bankId} />
        </TabsContent>
        <TabsContent value="advanced" className="mt-4">
          <BankConfig bankId={bankId} section="advanced" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
