'use client'

import dynamic from 'next/dynamic'
import rehypeSanitize from 'rehype-sanitize'
import '@uiw/react-md-editor/markdown-editor.css'

const Editor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

const PreviewInner = dynamic(
  async () => {
    const MDEditor = (await import('@uiw/react-md-editor')).default
    return function MarkdownPreviewBody({ source }: { source: string }) {
      return (
        <div data-color-mode="light" className="wmde-markdown-var text-sm leading-relaxed">
          <MDEditor.Markdown source={source} rehypePlugins={[rehypeSanitize]} />
        </div>
      )
    }
  },
  { ssr: false }
)

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  height?: number
  placeholder?: string
}

export function MarkdownEditor({
  value,
  onChange,
  height = 280,
  placeholder,
}: MarkdownEditorProps) {
  return (
    <div
      data-color-mode="light"
      className="rounded-md overflow-hidden border border-border bg-background"
    >
      <Editor
        value={value}
        onChange={(v) => onChange(v ?? '')}
        height={height}
        data-color-mode="light"
        preview="live"
        visibleDragbar={false}
        textareaProps={{
          placeholder: placeholder ?? 'Write your note…',
        }}
      />
    </div>
  )
}

export function MarkdownPreview({ source }: { source: string }) {
  if (!source.trim()) {
    return <p className="text-sm text-muted-foreground">No content in this document.</p>
  }
  return <PreviewInner source={source} />
}
