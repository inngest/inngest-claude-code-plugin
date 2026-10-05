/**
 * @module look
 *
 * The band's visual vocabulary, from the "Ticks" mockup: a status mark per
 * line and one small square per job. The terminal draws glyphs in theme
 * colours; the desktop draws the same marks as tiny SVGs.
 */

import type { CiStatus, CiTone } from '../types'

/** Theme keys Claude Code's themes define, so the terminal follows light and dark. */
export const TONE: Record<CiTone, string | undefined> = {
  running: 'suggestion',
  failed: 'error',
  passed: 'success',
  cancelled: undefined,
  lost: undefined,
}

export const MARK: Record<CiTone, string> = {
  running: '●',
  failed: '✕',
  passed: '✓',
  cancelled: '○',
  lost: '◌',
}

/** A job's square on the terminal; queued and skipped differ by shape too, so the line reads without colour. */
export const TICK: Record<CiStatus, { glyph: string; color?: string; isDim?: boolean }> = {
  passed: { glyph: '■', color: 'success' },
  cached: { glyph: '■', color: 'success', isDim: true },
  running: { glyph: '■', color: 'suggestion' },
  failed: { glyph: '■', color: 'error' },
  queued: { glyph: '□', isDim: true },
  skipped: { glyph: '–', isDim: true },
  cancelled: { glyph: '■', isDim: true },
}

/** SVG has no theme: mid tones that read on light and dark backgrounds alike. */
const HEX = { blue: '#5B8DEF', green: '#3FA672', red: '#DC5B57', gray: '#8A8F98' }

const TICK_FILL: Record<CiStatus, string> = {
  passed: `fill="${HEX.green}"`,
  cached: `fill="${HEX.green}" fill-opacity=".5"`,
  running: `fill="${HEX.blue}"`,
  failed: `fill="${HEX.red}"`,
  queued: '',
  skipped: '',
  cancelled: `fill="${HEX.gray}" fill-opacity=".6"`,
}

/** Pixels per tick on the desktop. */
export const TICK_PX = 11

export function markSvg(tone: CiTone): string {
  const body = {
    running: `<circle cx="6" cy="6" r="3.5" fill="${HEX.blue}"/>`,
    failed: `<path d="M3.4 3.4l5.2 5.2M8.6 3.4l-5.2 5.2" fill="none" stroke="${HEX.red}" stroke-width="1.6" stroke-linecap="round"/>`,
    passed: `<path d="M2.6 6.3l2.2 2.2 4.6-4.9" fill="none" stroke="${HEX.green}" stroke-opacity=".6" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    cancelled: `<circle cx="6" cy="6" r="3.5" fill="none" stroke="${HEX.gray}" stroke-width="1.2"/>`,
    lost: `<circle cx="6" cy="6" r="3.5" fill="none" stroke="${HEX.gray}" stroke-width="1.2" stroke-dasharray="2 1.6"/>`,
  }[tone]

  return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12">${body}</svg>`
}

export function ticksSvg(ticks: readonly CiStatus[], isDim: boolean): string {
  const width = Math.max(1, ticks.length * TICK_PX - 3)
  const shapes = ticks
    .map((status, i) => {
      const x = i * TICK_PX

      if (status === 'queued') {
        return `<rect x="${x + 0.5}" y="2.5" width="7" height="7" rx="1.5" fill="none" stroke="${HEX.gray}"/>`
      }

      if (status === 'skipped') {
        return `<path d="M${x + 1} 6h6" stroke="${HEX.gray}" stroke-width="1.6" stroke-linecap="round"/>`
      }

      return `<rect x="${x}" y="2" width="8" height="8" rx="2" ${TICK_FILL[status]}/>`
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="12" viewBox="0 0 ${width} 12"${isDim ? ' opacity=".5"' : ''}>${shapes}</svg>`
}

/** What the ticks say, for a reader that cannot see them: `7 jobs: 5 passed, 1 failed, 1 running`. */
export function ticksAlt(ticks: readonly CiStatus[]): string {
  const counts = new Map<CiStatus, number>()

  for (const status of ticks) {
    counts.set(status, (counts.get(status) ?? 0) + 1)
  }

  const parts = [...counts].map(([status, count]) => {
    return `${count} ${status === 'cached' ? 'from cache' : status}`
  })

  return `${ticks.length} ${ticks.length === 1 ? 'job' : 'jobs'}: ${parts.join(', ')}`
}
