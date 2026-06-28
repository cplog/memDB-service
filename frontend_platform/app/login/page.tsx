'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MarkIcon, Spinner } from '@/components/hindsight-icons'
import { useScrambleText } from '@/hooks/use-scramble-text'

function LoginFieldsSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-[68px] rounded-sm bg-[hsl(var(--secondary))]/40" />
      <div className="h-[68px] rounded-sm bg-[hsl(var(--secondary))]/40" />
      <div className="h-[44px] rounded-sm bg-[hsl(var(--secondary))]/40" />
    </div>
  )
}

export default function LoginPage() {
  const [mounted, setMounted] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const { ref: titleRef } = useScrambleText({
    text: 'Crewio.ai Portal',
    chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$_-',
    cursor: '|',
    revealRate: 50,
    settleDuration: 800,
    from: 'random',
    duration: 2000,
    perturbation: 4,
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (res.ok) {
        router.push('/')
        router.refresh()
      } else {
        setError(data.error || 'Login failed')
      }
    } catch {
      setError('Connection error. Check your network and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--vault))] px-4">
      <div className="w-full max-w-sm border border-border bg-[hsl(var(--card))] p-6">
        <div className="flex items-center gap-2.5 mb-6">
          <MarkIcon className="size-5 text-[hsl(var(--vault-active))]" title="Crewio.ai" />
          <div>
            <h1 ref={titleRef} className="text-[15px] font-medium tracking-tight">Crewio.ai Portal</h1>
            <p className="text-xs text-[hsl(var(--vault-muted))]">Sign in to your vault</p>
          </div>
        </div>

        {!mounted ? (
          <LoginFieldsSkeleton />
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs text-[hsl(var(--vault-muted))]">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="alice@ech.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-[44px] text-[13px]"
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs text-[hsl(var(--vault-muted))]">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-[44px] text-[13px]"
                autoComplete="current-password"
              />
            </div>
            {error ? (
              <p
                role="alert"
                className="text-xs text-[hsl(var(--error-fg))] bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] px-3 py-2 rounded-sm"
              >
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full min-h-[44px] text-[12px]" disabled={loading}>
              {loading ? <Spinner className="mr-2" /> : null}
              Sign in
            </Button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-border text-xs text-[hsl(var(--vault-muted))] space-y-3 leading-relaxed">
          <p className="uppercase tracking-widest text-xs">Demo accounts</p>
          <div className="space-y-2">
            <div>
              <p className="text-[hsl(var(--foreground))]/90 font-medium">eric@consultant.com</p>
              <p className="opacity-80">Operations mode · all teams, config, export</p>
            </div>
            <div>
              <p className="text-[hsl(var(--foreground))]/90 font-medium">carol@ech.com</p>
              <p className="opacity-80">Overview mode · all teams, team-wide query</p>
            </div>
            <div>
              <p className="text-[hsl(var(--foreground))]/90 font-medium">alice@ech.com · bob@ech.com</p>
              <p className="opacity-80">Workspace mode · one team, your contributions only</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
