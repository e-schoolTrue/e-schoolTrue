import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks — hoisted before any static imports
//
// IMPORTANT: 'path' is shimmed by vite-plugin-electron-renderer with a CJS
// wrapper that breaks in the jsdom test environment (require is not defined).
// We override it with our own mock so that electron/config/env.ts can be
// imported without crashing during test collection.
// ---------------------------------------------------------------------------

// Shared mock references so that default and named exports point to the same
// spy instances (vitest hoisting requires vi.hoisted for this).
const mockPath = vi.hoisted(() => ({
  default: {
    join: (...args: string[]) => args.join('/'),
    resolve: (...args: string[]) => args.join('/'),
  },
  join: (...args: string[]) => args.join('/'),
  resolve: (...args: string[]) => args.join('/'),
}))

const mockFs = vi.hoisted(() => {
  const existsSync = vi.fn()
  const writeFileSync = vi.fn()
  return {
    default: { existsSync, writeFileSync },
    existsSync,
    writeFileSync,
  }
})

vi.mock('path', () => mockPath)
vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getPath: vi.fn(() => '/mock/userData'),
  },
}))
vi.mock('fs', () => mockFs)
vi.mock('dotenv', () => ({
  config: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Suite: ENV configuration — verification tests for the startup crash fix
// ---------------------------------------------------------------------------
describe('ENV configuration (graceful degradation fix)', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    // Clear module cache so each test gets a fresh evaluation of env.ts
    vi.resetModules()

    // Suppress console noise in test output and capture warn calls
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // Reset mocked modules to a known default state:
    //   - dev mode (app.isPackaged = false)
    //   - .env file already exists (existsSync returns true)
    const electronMod = await import('electron')
    electronMod.app.isPackaged = false
    vi.mocked(electronMod.app.getPath).mockReset().mockReturnValue('/mock/userData')

    const fsMod = await import('fs')
    vi.mocked(fsMod.existsSync).mockReset().mockReturnValue(true)
    vi.mocked(fsMod.writeFileSync).mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  // -----------------------------------------------------------------------
  // Test 1: Graceful degradation when Supabase env vars are missing
  // -----------------------------------------------------------------------
  it('exports empty strings and warns when SUPABASE_URL / SUPABASE_KEY are missing', async () => {
    // Clear Supabase env vars so the module sees them as missing
    vi.stubEnv('SUPABASE_URL', '')
    vi.stubEnv('SUPABASE_KEY', '')

    // After the fix, this import MUST NOT throw — the hard error was replaced
    // with console.warn(...) for graceful degradation.
    const { ENV } = await import('../env')

    expect(ENV.SUPABASE_URL).toBe('')
    expect(ENV.SUPABASE_KEY).toBe('')

    // Verify that the replacement warning was issued
    expect(consoleWarnSpy).toHaveBeenCalled()
    expect(consoleWarnSpy.mock.calls[0][0]).toContain('Supabase non configuré')
  })

  // -----------------------------------------------------------------------
  // Test 2: Env vars are read correctly when set
  // -----------------------------------------------------------------------
  it('reads SUPABASE_URL and SUPABASE_KEY when they are set in the environment', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('SUPABASE_KEY', 'test-key-12345')

    const { ENV } = await import('../env')

    expect(ENV.SUPABASE_URL).toBe('https://test.supabase.co')
    expect(ENV.SUPABASE_KEY).toBe('test-key-12345')
  })

  // -----------------------------------------------------------------------
  // Test 3: .env template creation writes documented placeholder values
  // -----------------------------------------------------------------------
  it('writes .env template with SUPABASE_URL and SUPABASE_KEY placeholders on first run', async () => {
    const testUserDataPath = '/mock/userData/e-school'

    // Switch to packaged mode
    const electronMod = await import('electron')
    electronMod.app.isPackaged = true
    vi.mocked(electronMod.app.getPath).mockReturnValue(testUserDataPath)

    // Simulate .env file not existing
    const fsMod = await import('fs')
    vi.mocked(fsMod.existsSync).mockReturnValue(false)

    // Trigger module evaluation — should create the .env template
    await import('../env')

    expect(fsMod.writeFileSync).toHaveBeenCalledTimes(1)

    const writeArgs = vi.mocked(fsMod.writeFileSync).mock.calls[0]
    const writtenPath = writeArgs[0] as string
    const writtenContent = writeArgs[1] as string

    // Verify the file was written to the expected location (userData + '/.env')
    expect(writtenPath).toBe(testUserDataPath + '/.env')

    // The improved template must contain documented placeholder values
    expect(writtenContent).toContain('SUPABASE_URL')
    expect(writtenContent).toContain('SUPABASE_KEY')
  })

  // -----------------------------------------------------------------------
  // Test 4: Hardcoded fallback credentials in supabase.ts
  // -----------------------------------------------------------------------
  it('contains hardcoded fallback credentials in supabase.ts config', async () => {
    // Ensure Supabase env vars are absent so fallback values are used
    vi.stubEnv('SUPABASE_URL', '')
    vi.stubEnv('SUPABASE_KEY', '')

    const { supabaseConfig } = await import('../supabase')

    // The fallback values are the hardcoded strings in the `||` clause
    expect(supabaseConfig.url).toBe('https://xebukndcynlvjpguwrcb.supabase.co')
    expect(supabaseConfig.key).toBe(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlYnVrbmRjeW5sdmpwZ3V3cmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY3NDQ5ODcsImV4cCI6MjA2MjMyMDk4N30.N6avpTRmQ-OPAoLuWviaKJVMJ7Eq-Q7j5sjDY04tEVE'
    )
  })
})
