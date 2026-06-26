/** Stable document_id from an uploaded filename (Hindsight upserts on same id). */
export function documentIdFromFilename(
  filename: string,
  used = new Set<string>()
): string {
  const trimmed = filename.trim()
  const safe = trimmed
    .replace(/[/\\?#%&]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  const base = safe || 'upload'
  let candidate = base
  let n = 1
  while (used.has(candidate)) {
    candidate = `${base}-${n++}`
  }
  used.add(candidate)
  return candidate
}

/** Stable document_id from a note title or user-chosen slug. */
export function documentIdFromTitle(title: string, used = new Set<string>()): string {
  return documentIdFromFilename(title, used)
}

const LEGACY_FILE_UUID = /^file_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

function metadataFilename(metadata?: Record<string, unknown> | null): string | null {
  if (!metadata) return null
  const raw =
    metadata.original_filename ??
    metadata.originalFilename ??
    metadata.filename
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}

/** Human label for a document — prefers metadata.original_filename, then stable id. */
export function documentDisplayName(
  id: string,
  metadata?: Record<string, unknown> | null
): string {
  const fromMeta = metadataFilename(metadata)
  if (fromMeta) return fromMeta
  if (LEGACY_FILE_UUID.test(id)) return 'Uploaded file'
  const base = id.split('/').pop() ?? id
  return base
}

export function truncateDocumentLabel(text: string, max = 40): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

const RAW_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Sidebar / tree: human title on first line, opaque id on second when needed. */
export function documentTreeLabels(
  id: string,
  metadata?: Record<string, unknown> | null
): { primary: string; secondary?: string } {
  const base = id.split('/').pop() ?? id
  const display = documentDisplayName(id, metadata)
  const opaque = RAW_UUID.test(base) || LEGACY_FILE_UUID.test(id)

  if (display !== base && display !== id) {
    return {
      primary: display,
      secondary: base,
    }
  }
  if (opaque) {
    return {
      primary: display === 'Uploaded file' ? 'Uploaded file' : 'Untitled source',
      secondary: base,
    }
  }
  return { primary: display }
}

/** Runnable check — node --import tsx shared/lib/document-display.selfcheck.ts */
export function runDocumentDisplaySelfCheck(): void {
  const used = new Set<string>()
  const id = documentIdFromFilename('Q1 Report.pdf', used)
  if (id !== 'Q1 Report.pdf') throw new Error('documentIdFromFilename failed')
  const dup = documentIdFromFilename('Q1 Report.pdf', used)
  if (dup !== 'Q1 Report.pdf-1') throw new Error('duplicate filename id failed')
  if (documentDisplayName('notes.md') !== 'notes.md') {
    throw new Error('documentDisplayName id failed')
  }
  if (
    documentDisplayName('file_2a1eaf03-ae77-45b2-acf2-1b5c34e789ab', {
      original_filename: 'Policy.pdf',
    }) !== 'Policy.pdf'
  ) {
    throw new Error('documentDisplayName metadata failed')
  }
  if (documentDisplayName('file_2a1eaf03-ae77-45b2-acf2-1b5c34e789ab') !== 'Uploaded file') {
    throw new Error('legacy file uuid label failed')
  }
  if (documentIdFromTitle('Q3 Planning Notes') !== 'Q3 Planning Notes') {
    throw new Error('documentIdFromTitle failed')
  }
  const tree = documentTreeLabels('cfedca67-b3e4-4260-a524-f155a31746cc')
  if (tree.primary !== 'Untitled source' || !tree.secondary) {
    throw new Error('documentTreeLabels uuid failed')
  }
  const titled = documentTreeLabels('Q3 planning')
  if (titled.primary !== 'Q3 planning' || titled.secondary) {
    throw new Error('documentTreeLabels slug failed')
  }
}
