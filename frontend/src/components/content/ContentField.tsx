import { Check, Copy, PenLine, Plus, RefreshCw, Trash2 } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip } from '@/components/ui/tooltip'
import type { ReelScene } from '@/lib/api/types'
import { copyText } from '@/lib/clipboard'
import { asList, asScenes, asString, fieldToText, type FieldSpec } from '@/lib/content'
import { cn } from '@/lib/utils'

interface ContentFieldProps {
  spec: FieldSpec
  value: unknown
  onSave?: (value: unknown) => Promise<unknown>
  onRegenerate?: (instruction: string) => Promise<unknown>
  regenerating?: boolean
  compact?: boolean
}

/** One component of a piece of content, with copy / edit / regenerate controls. */
export function ContentField({
  spec,
  value,
  onSave,
  onRegenerate,
  regenerating,
  compact,
}: ContentFieldProps) {
  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [draft, setDraft] = React.useState<unknown>(value)
  const text = fieldToText(spec, value)
  const empty = !text.trim()

  const startEdit = () => {
    setDraft(value)
    setEditing(true)
  }
  const save = async () => {
    if (!onSave) return
    setSaving(true)
    try {
      await onSave(draft)
      setEditing(false)
    } catch {
      /* the caller shows the error toast; stay in edit mode */
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      aria-label={spec.label}
      className={cn(
        'group/field relative rounded-lg transition-colors',
        compact ? 'py-2' : 'py-3',
        regenerating && 'animate-pulse',
        !editing && 'hover:bg-surface-2/50',
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 px-3">
        <h4 className="text-subtle text-[11.5px] font-semibold tracking-[0.06em] uppercase">
          {spec.label}
          {spec.help && <span className="ml-2 font-normal tracking-normal normal-case">{spec.help}</span>}
        </h4>
        {!editing && (
          <div className="flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within/field:opacity-100 sm:group-hover/field:opacity-100">
            {!empty && (
              <Tooltip content={`Copy ${spec.label.toLowerCase()}`}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void copyText(text, `${spec.label} copied`)}
                  aria-label={`Copy ${spec.label}`}
                >
                  <Copy />
                </Button>
              </Tooltip>
            )}
            {onSave && (
              <Tooltip content="Edit">
                <Button variant="ghost" size="icon-sm" onClick={startEdit} aria-label={`Edit ${spec.label}`}>
                  <PenLine />
                </Button>
              </Tooltip>
            )}
            {onRegenerate && (
              <RegenerateButton label={spec.label} onRegenerate={onRegenerate} busy={regenerating} />
            )}
          </div>
        )}
      </div>

      <div className="px-3">
        {editing ? (
          <div className="flex flex-col gap-2">
            <FieldEditor spec={spec} value={draft} onChange={setDraft} />
            <div className="flex gap-2">
              <Button size="sm" onClick={save} loading={saving}>
                <Check /> Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <FieldDisplay spec={spec} value={value} />
        )}
      </div>
    </section>
  )
}

function RegenerateButton({
  label,
  onRegenerate,
  busy,
}: {
  label: string
  onRegenerate: (instruction: string) => Promise<unknown>
  busy?: boolean
}) {
  const [instruction, setInstruction] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const run = () => {
    setOpen(false)
    void onRegenerate(instruction).then(() => setInstruction(''))
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content={`Regenerate ${label.toLowerCase()} only`}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" disabled={busy} aria-label={`Regenerate ${label}`}>
            <RefreshCw className={cn(busy && 'animate-spin')} />
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="end">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            run()
          }}
        >
          <div>
            <p className="text-[14px] font-semibold">Regenerate {label.toLowerCase()}</p>
            <p className="text-muted text-[12.5px]">Everything else stays exactly as it is.</p>
          </div>
          <Input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Optional: e.g. shorter, more playful, ask a question"
            maxLength={500}
            aria-label="Direction for the new version"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <PopoverClose asChild>
              <Button type="button" variant="ghost" size="sm">
                Cancel
              </Button>
            </PopoverClose>
            <Button type="submit" size="sm" variant="accent">
              <RefreshCw /> Regenerate
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

export function FieldDisplay({ spec, value }: { spec: FieldSpec; value: unknown }) {
  switch (spec.kind) {
    case 'hashtags': {
      const tags = asList(value)
      if (!tags.length) return <p className="text-subtle text-[14px] italic">None</p>
      return (
        <p className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className="bg-ember-soft/70 text-ember-ink rounded-md px-1.5 py-0.5 text-[13px]">
              {t}
            </span>
          ))}
        </p>
      )
    }
    case 'list':
      return (
        <ol className="flex flex-col gap-1.5">
          {asList(value).map((line, i) => (
            <li key={i} className="flex gap-2.5 text-[14.5px]">
              <span className="bg-surface-3 text-muted mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
                {i + 1}
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
      )
    case 'scenes':
      return <ScenesDisplay scenes={asScenes(value)} />
    case 'card': {
      const card = (value ?? {}) as { headline?: string; subtext?: string; visual_direction?: string }
      return (
        <div className="flex flex-col gap-2">
          <div className="bg-ink text-paper flex aspect-square max-w-64 flex-col items-center justify-center gap-2 rounded-lg p-6 text-center">
            <p className="font-display text-[22px] leading-tight text-balance">{card.headline}</p>
            {card.subtext && (
              <p className="text-paper/60 text-[12px] tracking-wide uppercase">{card.subtext}</p>
            )}
          </div>
          {card.visual_direction && (
            <p className="text-muted text-[13px]">Design direction: {card.visual_direction}</p>
          )}
        </div>
      )
    }
    default: {
      const text = asString(value)
      if (!text.trim()) return <p className="text-subtle text-[14px] italic">None</p>
      return (
        <p
          className={cn(
            'whitespace-pre-line',
            spec.emphasis
              ? 'font-display text-[24px] leading-[1.2] text-balance'
              : 'text-[14.5px] leading-relaxed',
          )}
        >
          {text}
        </p>
      )
    }
  }
}

function ScenesDisplay({ scenes }: { scenes: ReelScene[] }) {
  return (
    <ol className="relative flex flex-col gap-0">
      {scenes.map((scene, i) => (
        <li key={i} className="relative grid grid-cols-[64px_1fr] gap-3 pb-4 last:pb-0">
          <div className="flex flex-col items-start gap-1">
            <span className="bg-ink text-paper rounded-md px-1.5 py-0.5 font-mono text-[11px]">
              {scene.timing || `#${i + 1}`}
            </span>
            {i < scenes.length - 1 && <span className="bg-line ml-3 h-full w-px" aria-hidden />}
          </div>
          <div className="flex flex-col gap-1 text-[14px]">
            <p className="font-medium">{scene.visual}</p>
            {scene.action && <p className="text-muted">{scene.action}</p>}
            {scene.on_screen_text && (
              <p>
                <span className="bg-warn-soft mr-1.5 rounded px-1 text-[11px] font-semibold tracking-wide uppercase">
                  Text
                </span>
                {scene.on_screen_text}
              </p>
            )}
            {scene.voiceover && (
              <p className="text-muted italic">
                <span className="bg-surface-3 mr-1.5 rounded px-1 text-[11px] font-semibold tracking-wide uppercase not-italic">
                  VO
                </span>
                “{scene.voiceover}”
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

function FieldEditor({
  spec,
  value,
  onChange,
}: {
  spec: FieldSpec
  value: unknown
  onChange: (v: unknown) => void
}) {
  switch (spec.kind) {
    case 'hashtags':
      return (
        <Textarea
          aria-label={spec.label}
          value={asList(value).join(' ')}
          onChange={(e) => onChange(e.target.value.split(/\s+/).filter(Boolean))}
          className="min-h-16 font-mono text-[13px]"
          autoFocus
        />
      )
    case 'list':
      return (
        <Textarea
          aria-label={`${spec.label} (one per line)`}
          value={asList(value).join('\n')}
          onChange={(e) => onChange(e.target.value.split('\n'))}
          onBlur={(e) => onChange(e.target.value.split('\n').filter((l) => l.trim()))}
          className="min-h-28"
          autoFocus
        />
      )
    case 'card': {
      const card = { headline: '', subtext: '', visual_direction: '', ...(value as object) }
      return (
        <div className="flex flex-col gap-2">
          {(['headline', 'subtext', 'visual_direction'] as const).map((key) => (
            <Input
              key={key}
              aria-label={key.replace('_', ' ')}
              placeholder={key.replace('_', ' ')}
              value={card[key]}
              onChange={(e) => onChange({ ...card, [key]: e.target.value })}
            />
          ))}
        </div>
      )
    }
    case 'scenes': {
      const scenes = asScenes(value)
      const update = (i: number, patch: Partial<ReelScene>) =>
        onChange(scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)))
      return (
        <div className="flex flex-col gap-3">
          {scenes.map((scene, i) => (
            <div key={i} className="border-line grid gap-2 rounded-lg border p-3 sm:grid-cols-[90px_1fr]">
              <Input
                aria-label={`Scene ${i + 1} timing`}
                value={scene.timing}
                onChange={(e) => update(i, { timing: e.target.value })}
              />
              <Input
                aria-label={`Scene ${i + 1} visual`}
                placeholder="Visual"
                value={scene.visual}
                onChange={(e) => update(i, { visual: e.target.value })}
              />
              <Input
                aria-label={`Scene ${i + 1} action`}
                placeholder="Action"
                value={scene.action}
                onChange={(e) => update(i, { action: e.target.value })}
                className="sm:col-start-2"
              />
              <Input
                aria-label={`Scene ${i + 1} on-screen text`}
                placeholder="On-screen text"
                value={scene.on_screen_text}
                onChange={(e) => update(i, { on_screen_text: e.target.value })}
                className="sm:col-start-2"
              />
              <Input
                aria-label={`Scene ${i + 1} voice-over`}
                placeholder="Voice-over"
                value={scene.voiceover}
                onChange={(e) => update(i, { voiceover: e.target.value })}
                className="sm:col-start-2"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-self-start sm:col-start-2"
                onClick={() => onChange(scenes.filter((_, j) => j !== i))}
                disabled={scenes.length <= 2}
              >
                <Trash2 /> Remove scene
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() =>
              onChange([...scenes, { timing: '', visual: '', action: '', on_screen_text: '', voiceover: '' }])
            }
          >
            <Plus /> Add scene
          </Button>
        </div>
      )
    }
    default:
      return spec.kind === 'text' ? (
        <Input
          aria-label={spec.label}
          value={asString(value)}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
        />
      ) : (
        <Textarea
          aria-label={spec.label}
          value={asString(value)}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-32"
          autoFocus
        />
      )
  }
}
