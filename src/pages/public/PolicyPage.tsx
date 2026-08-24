import { useEffect, useMemo, useRef, useState } from 'react'
import { PageHero } from '../../components/common/PageHero'
import { getPolicyDocument, type PolicyKind } from '../../content/policies'
import { useSiteTranslation } from '../../i18n/useSiteTranslation'

type PolicyContentBlock =
  { type: 'paragraph'; text: string } | { type: 'list'; items: string[] }

type PolicySection = {
  id: string
  title: string
  blocks: PolicyContentBlock[]
}

type ParsedPolicyContent = {
  introduction: PolicyContentBlock[]
  sections: PolicySection[]
}

export function PolicyPage({ kind }: { kind: PolicyKind }) {
  const { locale, t } = useSiteTranslation()
  const policyDocument = useMemo(
    () => getPolicyDocument(kind, locale),
    [kind, locale],
  )
  const content = useMemo(
    () => parsePolicyContent(policyDocument.content),
    [policyDocument.content],
  )
  const [activeSectionId, setActiveSectionId] = useState(
    content.sections[0]?.id ?? '',
  )
  const navigationTargetRef = useRef<string | null>(null)

  useEffect(() => {
    const sectionIds = new Set(content.sections.map((section) => section.id))
    const hashId = decodeURIComponent(window.location.hash.slice(1))
    const initialSectionId = sectionIds.has(hashId)
      ? hashId
      : (content.sections[0]?.id ?? '')
    navigationTargetRef.current = sectionIds.has(hashId) ? hashId : null
    setActiveSectionId(initialSectionId)

    if (!sectionIds.has(hashId)) return
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(hashId)?.scrollIntoView({ block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [content.sections])

  useEffect(() => {
    const elements = content.sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element !== null)
    if (elements.length === 0) return

    const headerOffset = 128
    const updateActiveSection = () => {
      const navigationTarget = navigationTargetRef.current
      if (navigationTarget) {
        const targetElement = elements.find(
          (element) => element.id === navigationTarget,
        )
        if (
          targetElement &&
          Math.abs(targetElement.getBoundingClientRect().top - headerOffset) >
            12 &&
          window.innerHeight + window.scrollY <
            document.documentElement.scrollHeight - 2
        )
          return
        navigationTargetRef.current = null
      }

      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2
      ) {
        setActiveSectionId(elements[elements.length - 1].id)
        return
      }

      let activeElement = elements[0]
      for (const element of elements) {
        if (element.getBoundingClientRect().top <= headerOffset + 8)
          activeElement = element
        else break
      }
      setActiveSectionId(activeElement.id)
    }
    const updateFromHash = () => {
      const hashId = decodeURIComponent(window.location.hash.slice(1))
      if (elements.some((element) => element.id === hashId)) {
        navigationTargetRef.current = hashId
        setActiveSectionId(hashId)
      }
    }

    updateFromHash()
    window.requestAnimationFrame(updateActiveSection)
    window.addEventListener('scroll', updateActiveSection, { passive: true })
    window.addEventListener('resize', updateActiveSection)
    window.addEventListener('hashchange', updateFromHash)
    return () => {
      window.removeEventListener('scroll', updateActiveSection)
      window.removeEventListener('resize', updateActiveSection)
      window.removeEventListener('hashchange', updateFromHash)
    }
  }, [content.sections])

  const tocLabel = t('policy.tableOfContents')
  const navigateToSection = (sectionId: string) => {
    navigationTargetRef.current = sectionId
    setActiveSectionId(sectionId)
  }

  return (
    <div data-site-i18n-ignore>
      <PageHero
        eyebrow="HOTEL / POLICY"
        title={policyDocument.title}
        description={policyDocument.hotelName}
      />
      <section className="mx-auto w-full max-w-[1500px] px-5 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-20">
        <div className="grid min-w-0 items-start gap-8 xl:grid-cols-[minmax(0,960px)_minmax(240px,280px)] xl:gap-12 2xl:gap-16">
          <div className="min-w-0">
            <details className="mb-6 border border-line bg-surface shadow-soft xl:hidden">
              <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-ink sm:px-7">
                {tocLabel}
              </summary>
              <div className="border-t border-line px-5 py-4 sm:px-7">
                <PolicyTableOfContents
                  sections={content.sections}
                  activeSectionId={activeSectionId}
                  label={tocLabel}
                  onNavigate={navigateToSection}
                />
              </div>
            </details>

            <article className="min-w-0 overflow-hidden border border-line bg-surface px-5 py-9 shadow-soft sm:px-10 sm:py-12 lg:px-14">
              <div className="border-b border-line pb-7">
                <p className="text-sm font-semibold tracking-[0.08em] text-accent">
                  {policyDocument.hotelName}
                </p>
                <h2 className="mt-3 break-words text-2xl font-semibold leading-tight sm:text-3xl">
                  {policyDocument.title}
                </h2>
              </div>

              <div className="policy-content mt-9 text-[15px] leading-8 text-ink sm:text-base sm:leading-9">
                <PolicyBlocks blocks={content.introduction} />
                {content.sections.map((section) => (
                  <section
                    key={section.id}
                    id={section.id}
                    className="scroll-mt-32 pt-11 first:pt-0"
                    aria-labelledby={`${section.id}-title`}
                  >
                    <h3
                      id={`${section.id}-title`}
                      className="break-words border-l-4 border-accent pl-4 text-lg font-semibold leading-8 sm:text-xl"
                    >
                      {section.title}
                    </h3>
                    <PolicyBlocks blocks={section.blocks} />
                  </section>
                ))}
              </div>
            </article>
          </div>

          <aside className="hidden min-w-0 self-start xl:sticky xl:top-28 xl:block">
            <div className="max-h-[calc(100vh-8rem)] overflow-y-auto border border-line bg-surface px-6 py-6 shadow-soft">
              <p className="border-b border-line pb-4 text-sm font-semibold tracking-[0.08em] text-ink">
                {tocLabel}
              </p>
              <PolicyTableOfContents
                sections={content.sections}
                activeSectionId={activeSectionId}
                label={tocLabel}
                onNavigate={navigateToSection}
              />
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}

function PolicyTableOfContents({
  sections,
  activeSectionId,
  label,
  onNavigate,
}: {
  sections: PolicySection[]
  activeSectionId: string
  label: string
  onNavigate: (sectionId: string) => void
}) {
  return (
    <nav aria-label={label}>
      <ol className="mt-1 space-y-1">
        {sections.map((section) => {
          const isActive = section.id === activeSectionId
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                onClick={() => onNavigate(section.id)}
                aria-current={isActive ? 'location' : undefined}
                className={`block break-words border-l-2 py-2 pl-3 pr-1 text-sm leading-6 transition-colors [overflow-wrap:anywhere] ${
                  isActive
                    ? 'border-accent font-semibold text-accent'
                    : 'border-transparent text-muted hover:border-line hover:text-ink'
                }`}
              >
                {section.title}
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function PolicyBlocks({ blocks }: { blocks: PolicyContentBlock[] }) {
  return blocks.map((block, index) => {
    if (block.type === 'list')
      return (
        <ul
          key={`${index}-${block.items[0]}`}
          className="mt-4 list-disc space-y-2 pl-6 marker:text-accent"
        >
          {block.items.map((item, itemIndex) => (
            <li
              key={`${itemIndex}-${item}`}
              className="whitespace-pre-line break-words [overflow-wrap:anywhere]"
            >
              {item}
            </li>
          ))}
        </ul>
      )
    return (
      <p
        key={`${index}-${block.text}`}
        className="mt-4 whitespace-pre-line break-words [overflow-wrap:anywhere]"
      >
        {block.text}
      </p>
    )
  })
}

function parsePolicyContent(content: string): ParsedPolicyContent {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const introduction: PolicyContentBlock[] = []
  const sections: PolicySection[] = []
  const usedSectionIds = new Set<string>()
  let currentSection: PolicySection | null = null

  const appendBlock = (block: PolicyContentBlock) => {
    if (currentSection) currentSection.blocks.push(block)
    else introduction.push(block)
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (isPolicyHeading(line)) {
      const baseId = getPolicySectionId(line, sections.length + 1)
      const id = makeUniqueSectionId(baseId, usedSectionIds)
      currentSection = { id, title: line, blocks: [] }
      sections.push(currentSection)
      continue
    }
    if (isBullet(line)) {
      const items = [stripBullet(line)]
      while (index + 1 < lines.length && isBullet(lines[index + 1])) {
        index += 1
        items.push(stripBullet(lines[index]))
      }
      appendBlock({ type: 'list', items })
      continue
    }
    appendBlock({ type: 'paragraph', text: line })
  }

  return { introduction, sections }
}

function getPolicySectionId(line: string, fallbackIndex: number) {
  const articleMatch = line.match(/^(?:第(\d+)条|제(\d+)조|([0-9]+)\.)/)
  const articleNumber = articleMatch?.slice(1).find(Boolean)
  if (articleNumber) return `article-${articleNumber}`
  if (/^(お問い合わせ|문의)$/.test(line)) return 'contact'
  if (/^(別表|별표)/.test(line)) return 'appendix'
  return `section-${fallbackIndex}`
}

function makeUniqueSectionId(baseId: string, usedIds: Set<string>) {
  let id = baseId
  let suffix = 2
  while (usedIds.has(id)) {
    id = `${baseId}-${suffix}`
    suffix += 1
  }
  usedIds.add(id)
  return id
}

function isPolicyHeading(line: string) {
  return (
    /^第\d+条/.test(line) ||
    /^제\d+조/.test(line) ||
    /^\d+\.\s*/.test(line) ||
    /^(お問い合わせ|문의)$/.test(line) ||
    /^(別表|별표)/.test(line)
  )
}

function isBullet(line: string) {
  return /^[•・]\s*/.test(line)
}

function stripBullet(line: string) {
  return line.replace(/^[•・]\s*/, '')
}
