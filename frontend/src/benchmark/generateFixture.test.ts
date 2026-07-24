import { describe, expect, it } from 'vitest'

import { generateRendererFixture } from './generateFixture'

describe('renderer benchmark fixture', () => {
  it('generates deterministic positions and valid links', () => {
    const first = generateRendererFixture(10, 20)
    const second = generateRendererFixture(10, 20)

    expect(Array.from(first.positions)).toEqual(Array.from(second.positions))
    expect(Array.from(first.links)).toEqual(Array.from(second.links))
    expect(first.positions).toHaveLength(20)
    expect(first.links).toHaveLength(40)
    expect(Math.max(...first.links)).toBeLessThan(10)
  })

  it('rejects invalid counts', () => {
    expect(() => generateRendererFixture(0, 1)).toThrow('positive integer')
    expect(() => generateRendererFixture(1, -1)).toThrow('non-negative integer')
  })
})