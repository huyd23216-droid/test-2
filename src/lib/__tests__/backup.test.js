import { describe, expect, it } from 'vitest'
import { prepareRestore, validateBackup } from '../backup.js'

const ME = 'me-000'

describe('backup restore', () => {
  it('rejects files from other apps', () => {
    expect(validateBackup(null)).toMatch(/không phải/)
    expect(validateBackup({ app: 'other', cards: [] })).toMatch(/không phải/)
    expect(validateBackup({ app: 'tieng-anh-moi-ngay', cards: [] })).toBe(null)
  })

  it('restores homework progress and sessions for the current account', () => {
    const plan = prepareRestore(
      {
        app: 'tieng-anh-moi-ngay',
        cards: [],
        homework_progress: [{ user_id: 'old', item_key: 'meaning:c1', kind: 'meaning', box: 2, updated_at: 'x' }],
        homework_sessions: [{ id: 'h1', user_id: 'old', study_date: '2026-10-05', mode: 'daily', total: 12, items: [] }],
      },
      ME,
    )
    const progress = plan.tables.find((t) => t.table === 'homework_progress')
    expect(progress).toMatchObject({ onConflict: 'user_id,item_key' })
    expect(progress.rows).toEqual([{ user_id: ME, item_key: 'meaning:c1', kind: 'meaning', box: 2 }])
    const sessions = plan.tables.find((t) => t.table === 'homework_sessions')
    expect(sessions.rows[0]).toMatchObject({ id: 'h1', user_id: ME, mode: 'daily', total: 12 })
  })

  it('reassigns ownership, matches seed cards by seed_id and drops unknown columns', () => {
    const plan = prepareRestore(
      {
        app: 'tieng-anh-moi-ngay',
        user_settings: { user_id: 'old', tts_rate: 0.75, removed_seed_ids: ['w001'], hacker: true },
        cards: [
          { id: 'c1', user_id: 'old', seed_id: 'w002', word: 'be', stability: 3, mystery: 1 },
          { id: 'c2', user_id: 'old', seed_id: null, word: 'serendipity' },
        ],
        clips: [{ id: 'k1', user_id: 'old', youtube_url: 'https://youtu.be/x', transcript: 'hi' }],
        dictation_history: [
          { id: 'd1', user_id: 'old', clip_id: 'k1', sentence: 'hi', answer: 'hi', score: 1 },
          { id: 'd2', user_id: 'old', clip_id: 'gone', sentence: 'x', answer: 'x', score: 1 },
        ],
      },
      ME,
    )
    expect(plan.settings).toEqual({ tts_rate: 0.75, removed_seed_ids: ['w001'] })
    const [clips, seeds, custom, dictation] = plan.tables
    expect(clips.table).toBe('clips')
    expect(seeds).toMatchObject({ table: 'cards', onConflict: 'user_id,seed_id' })
    expect(seeds.rows).toEqual([{ user_id: ME, seed_id: 'w002', word: 'be', stability: 3 }])
    expect(custom.rows).toEqual([{ id: 'c2', user_id: ME, seed_id: null, word: 'serendipity' }])
    expect(dictation.rows.map((r) => [r.user_id, r.clip_id])).toEqual([
      [ME, 'k1'],
      [ME, null],
    ])
  })
})
