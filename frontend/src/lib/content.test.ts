import { describe, expect, it } from 'vitest'

import { CONTENT_FIELDS, fieldToText, fullBriefText, postReadyText, previewText } from './content'

const reel = {
  title: 'Latte reveal',
  hook: "It's back.",
  concept: 'Cosy reveal',
  opening_shot: 'Steam close-up',
  scenes: [
    { timing: '0-3s', visual: 'Steam', action: 'Pour', on_screen_text: 'Back!', voiceover: 'Guess what?' },
    { timing: '3-10s', visual: 'Cup', action: '', on_screen_text: '', voiceover: '' },
  ],
  script: 'Guess what? It is back.',
  voiceover: 'Warm',
  on_screen_text: ['Back!'],
  audio_suggestion: 'Lo-fi',
  caption: 'Autumn in a cup.',
  cta: 'Tag a friend',
  hashtags: ['#latte', '#autumn'],
  estimated_duration_seconds: 30,
}

describe('content formatting', () => {
  it('builds post-ready caption text with CTA and hashtags', () => {
    expect(postReadyText('reel', reel)).toBe('Autumn in a cup.\n\nTag a friend\n\n#latte #autumn')
  })

  it('does not repeat a CTA already in the caption body', () => {
    const caption = {
      hook: 'Hi',
      body: 'Hi there. Book now via the link in bio.',
      cta: 'Book now via the link in bio',
      hashtags: [],
    }
    expect(postReadyText('caption', caption)).toBe('Hi there. Book now via the link in bio.')
  })

  it('formats quotes with attribution', () => {
    const quote = {
      text: 'Slow is smooth.',
      attribution: 'Bloom',
      caption: 'Mornings.',
      hashtags: ['#coffee'],
    }
    expect(postReadyText('quote', quote)).toBe('“Slow is smooth.” — Bloom\n\nMornings.\n\n#coffee')
  })

  it('renders scenes as a numbered shot list', () => {
    const spec = CONTENT_FIELDS.reel.find((f) => f.name === 'scenes')!
    expect(fieldToText(spec, reel.scenes)).toBe(
      '1. [0-3s] Steam\n   Action: Pour\n   On screen: Back!\n   Voice-over: Guess what?\n2. [3-10s] Cup',
    )
  })

  it('produces a labelled brief with every component', () => {
    const brief = fullBriefText('reel', reel)
    expect(brief.startsWith('Latte reveal (30s)')).toBe(true)
    for (const label of ['HOOK', 'SHOTS & SCENES', 'SCRIPT', 'CAPTION', 'HASHTAGS'])
      expect(brief).toContain(label)
  })

  it('picks a sensible preview per type', () => {
    expect(previewText('reel', reel)).toBe("It's back.")
    expect(previewText('quote', { text: 'Q' })).toBe('Q')
  })
})
