import { describe, expect, it } from 'vitest'

import { buildGenerateInput, initialCreatorState } from './creator-state'

describe('buildGenerateInput', () => {
  it('only sends options relevant to the content type', () => {
    const reel = buildGenerateInput('reel', {
      ...initialCreatorState('reel'),
      topic: '  New menu  ',
      reel_duration: 45,
    })
    expect(reel.topic).toBe('New menu')
    expect(reel.options.reel_duration).toBe(45)
    expect(reel.options).not.toHaveProperty('caption_length')
    expect(reel.options).not.toHaveProperty('quote_category')

    const caption = buildGenerateInput('caption', {
      ...initialCreatorState('caption'),
      caption_length: 'short',
    })
    expect(caption.options.caption_length).toBe('short')
    expect(caption.options).not.toHaveProperty('reel_duration')
  })

  it('maps "brand default" emojis to null and clears disabled hashtags/CTA', () => {
    const input = buildGenerateInput('caption', {
      ...initialCreatorState('caption'),
      include_hashtags: false,
      include_cta: false,
      cta_preference: 'DM us',
    })
    expect(input.options.emoji_style).toBeNull()
    expect(input.options.hashtag_count).toBe(0)
    expect(input.options.cta_preference).toBe('')
  })

  it('clamps variations to what each type allows', () => {
    expect(buildGenerateInput('reel', { ...initialCreatorState('reel'), variations: 9 }).variations).toBe(4)
    expect(buildGenerateInput('quote', { ...initialCreatorState('quote'), variations: 0 }).variations).toBe(1)
  })

  it('defaults to Auto quality and the brand voice', () => {
    const state = initialCreatorState('quote')
    expect(state.quality).toBe('auto')
    expect(state.tone).toBe('brand')
    expect(state.variations).toBe(5)
  })
})
