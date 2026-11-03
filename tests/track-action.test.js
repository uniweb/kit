/**
 * `trackAction` — what a section reports when a visitor does something its author may count.
 *
 * The names it has reported live in the module for the life of the document, so each test imports
 * a fresh copy: otherwise a name one test reported would be silently skipped by the next, and an
 * assertion about a second call would pass by measuring the first test.
 */

let trackAction

beforeEach(async () => {
  vi.resetModules()
  ;({ trackAction } = await import('../src/utils/trackAction.js'))
})

/** A block that records what it is asked to send, standing in for core's `Block#track`. */
const recordingBlock = () => {
  const sent = []
  return { sent, track: (event, data) => sent.push({ event, ...data }) }
}

describe('trackAction', () => {
  test('a conversion when the author counts the act as one', () => {
    const block = recordingBlock()
    trackAction(block, 'command_copied', true)
    expect(block.sent).toEqual([{ event: 'conversion', name: 'command_copied' }])
  })

  test('an engagement otherwise, so the act is still counted', () => {
    for (const converts of [false, undefined, null, 'true', 1]) {
      const block = recordingBlock()
      trackAction(block, `video_watched_${String(converts)}`, converts)
      expect(block.sent.map((e) => e.event)).toEqual(['engagement'])
    }
  })

  test('only the name crosses: the block adds where it happened', () => {
    const block = recordingBlock()
    trackAction(block, 'prompt_copied', true)
    expect(Object.keys(block.sent[0]).sort()).toEqual(['event', 'name'])
  })

  test('once per name per page load, across sections', () => {
    const hero = recordingBlock()
    const closing = recordingBlock()
    trackAction(hero, 'command_copied', true)
    trackAction(hero, 'command_copied', true)
    trackAction(closing, 'command_copied', true)
    expect(hero.sent).toHaveLength(1)
    expect(closing.sent).toHaveLength(0)
  })

  test('a conversion and an engagement of one name are counted apart', () => {
    const steps = recordingBlock()
    const hero = recordingBlock()
    trackAction(steps, 'command_copied', false)
    trackAction(hero, 'command_copied', true)
    expect(steps.sent).toEqual([{ event: 'engagement', name: 'command_copied' }])
    expect(hero.sent).toEqual([{ event: 'conversion', name: 'command_copied' }])
  })

  test('different names are different acts', () => {
    const block = recordingBlock()
    trackAction(block, 'command_copied', true)
    trackAction(block, 'prompt_copied', true)
    expect(block.sent.map((e) => e.name)).toEqual(['command_copied', 'prompt_copied'])
  })

  test('no name, no block or a block with nothing to send: nothing happens, and nothing throws', () => {
    const block = recordingBlock()
    trackAction(block, '', true)
    trackAction(block, undefined, true)
    expect(block.sent).toEqual([])
    expect(() => trackAction(undefined, 'command_copied', true)).not.toThrow()
    expect(() => trackAction({}, 'command_copied', true)).not.toThrow()
  })
})
