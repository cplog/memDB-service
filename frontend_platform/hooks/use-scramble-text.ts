import { useRef, useEffect, useCallback, useState } from 'react'
import { animate, scrambleText } from 'animejs'

interface ScrambleOptions {
  text: string
  chars?: string
  cursor?: string
  revealRate?: number
  settleDuration?: number
  from?: 'center' | 'random' | 'left' | 'right' | 'auto'
  duration?: number
  delay?: number
  perturbation?: number
}

export function useScrambleText(options: ScrambleOptions) {
  const ref = useRef<HTMLDivElement>(null)
  const animRef = useRef<ReturnType<typeof animate> | null>(null)

  const scramble = useCallback(() => {
    if (!ref.current) return
    if (animRef.current) animRef.current.cancel()

    animRef.current = animate(ref.current, {
      innerHTML: scrambleText({
        text: options.text,
        chars: options.chars ?? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*',
        cursor: options.cursor ?? '|',
        revealRate: options.revealRate ?? 40,
        settleDuration: options.settleDuration ?? 600,
        from: options.from ?? 'random',
        perturbation: options.perturbation ?? 3,
        duration: options.duration ?? 1500,
        delay: options.delay ?? 0,
      }),
    })
  }, [options.text, options.chars, options.cursor, options.revealRate, options.settleDuration, options.from, options.perturbation, options.duration, options.delay])

  useEffect(() => {
    scramble()
    return () => { animRef.current?.cancel() }
  }, [scramble])

  return { ref, scramble }
}

export function useScrambleOnHover(options: ScrambleOptions) {
  const ref = useRef<HTMLDivElement>(null)
  const animRef = useRef<ReturnType<typeof animate> | null>(null)

  const scramble = useCallback(() => {
    if (!ref.current) return
    if (animRef.current) animRef.current.cancel()

    animRef.current = animate(ref.current, {
      innerHTML: scrambleText({
        text: options.text,
        chars: options.chars ?? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*',
        cursor: options.cursor ?? '|',
        revealRate: options.revealRate ?? 40,
        settleDuration: options.settleDuration ?? 600,
        from: options.from ?? 'random',
        perturbation: options.perturbation ?? 3,
        duration: options.duration ?? 1200,
      }),
    })
  }, [options.text, options.chars, options.cursor, options.revealRate, options.settleDuration, options.from, options.perturbation, options.duration])

  useEffect(() => {
    return () => { animRef.current?.cancel() }
  }, [])

  return { ref, scramble }
}

export function useScramblePlaceholder(phrases: string[], interval = 3000) {
  const [placeholder, setPlaceholder] = useState(phrases[0])
  const indexRef = useRef(0)

  useEffect(() => {
    const timer = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % phrases.length
      setPlaceholder(phrases[indexRef.current])
    }, interval)

    return () => clearInterval(timer)
  }, [phrases, interval])

  return { placeholder }
}
