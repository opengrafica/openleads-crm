import { execSync } from 'node:child_process'

if (process.env.VERCEL || process.env.CI === '1') {
  console.log('postinstall: pulando Playwright browsers (Vercel/CI)')
  process.exit(0)
}

try {
  execSync('npx playwright install chromium', { stdio: 'inherit' })
} catch {
  console.warn('postinstall: falha ao instalar Chromium do Playwright')
}
