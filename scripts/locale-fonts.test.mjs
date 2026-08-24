import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { URL } from 'node:url'

const indexHtml = readFileSync(
  new URL('../index.html', import.meta.url),
  'utf8',
)
const globalCss = readFileSync(
  new URL('../src/styles/global.css', import.meta.url),
  'utf8',
)
const tailwindConfig = readFileSync(
  new URL('../tailwind.config.js', import.meta.url),
  'utf8',
)
const localizedDom = readFileSync(
  new URL('../src/i18n/useLocalizedDom.ts', import.meta.url),
  'utf8',
)

test('loads only the Korean UI weights used by the project', () => {
  assert.match(
    indexHtml,
    /family=Noto\+Sans\+KR:wght@400;500;600;700&display=swap/,
  )
  assert.doesNotMatch(indexHtml, /Noto\+Sans\+KR:wght@100\.\.900/)
})

test('switches only the locale-aware UI font while preserving serif display styles', () => {
  assert.match(globalCss, /html\[lang='ko'\][\s\S]*--font-ui: 'Noto Sans KR'/)
  assert.match(globalCss, /--font-ui:\s*'Noto Sans JP'/)
  assert.match(globalCss, /textarea[\s\S]*font-family: var\(--font-ui\)/)
  assert.match(tailwindConfig, /sans: \['var\(--font-ui\)'\]/)
  assert.match(tailwindConfig, /serif: \['"Noto Serif JP"'/)
})

test('marks the active public or admin locale on the root and html element', () => {
  assert.match(localizedDom, /setAttribute\('data-locale', locale\)/)
  assert.match(localizedDom, /document\.documentElement\.lang = locale/)
  assert.match(localizedDom, /classList\.toggle\('lang-ko', locale === 'ko'\)/)
  assert.match(localizedDom, /classList\.toggle\('lang-ja', locale === 'ja'\)/)
})
