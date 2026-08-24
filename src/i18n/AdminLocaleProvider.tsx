import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  ADMIN_LOCALE_STORAGE_KEY,
  adminTranslations,
  translateAdminText,
  type AdminLocale,
  type AdminTranslationKey,
} from './admin-translations'
import { AdminLocaleContext } from './admin-locale-context'

type TextTranslationState = { source: string; rendered: string }
type AttributeTranslationState = Record<
  string,
  { source: string; rendered: string }
>

const textStates = new WeakMap<Text, TextTranslationState>()
const attributeStates = new WeakMap<Element, AttributeTranslationState>()
const translatedAttributes = ['placeholder', 'title', 'aria-label'] as const

export function AdminLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AdminLocale>(readStoredLocale)

  const setLocale = useCallback((nextLocale: AdminLocale) => {
    setLocaleState(nextLocale)
    try {
      window.localStorage.setItem(ADMIN_LOCALE_STORAGE_KEY, nextLocale)
    } catch {
      // The in-memory selection still works when storage is unavailable.
    }
  }, [])

  const t = useCallback(
    (key: AdminTranslationKey) => adminTranslations[locale][key],
    [locale],
  )
  const translate = useCallback(
    (value: string) => translateAdminText(value, locale),
    [locale],
  )

  useLayoutEffect(() => {
    const localize = (root: ParentNode) => {
      const adminRoots: Element[] = []
      if (root instanceof Element && root.matches('[data-admin-i18n-root]'))
        adminRoots.push(root)
      if ('querySelectorAll' in root)
        adminRoots.push(...root.querySelectorAll('[data-admin-i18n-root]'))

      for (const adminRoot of adminRoots) {
        adminRoot.setAttribute('lang', locale)
        localizeElement(adminRoot, locale)
      }
    }

    localize(document.body)
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          const element = mutation.target as Element
          if (
            element.closest('[data-admin-i18n-root]') &&
            mutation.attributeName &&
            translatedAttributes.includes(
              mutation.attributeName as (typeof translatedAttributes)[number],
            )
          )
            localizeAttribute(
              element,
              mutation.attributeName as (typeof translatedAttributes)[number],
              locale,
            )
          continue
        }
        if (mutation.type === 'characterData') {
          const parent = mutation.target.parentElement
          if (parent?.closest('[data-admin-i18n-root]'))
            localizeTextNode(mutation.target as Text, locale)
          continue
        }
        for (const node of mutation.addedNodes) {
          if (node instanceof Text) {
            if (node.parentElement?.closest('[data-admin-i18n-root]'))
              localizeTextNode(node, locale)
          } else if (node instanceof Element) {
            const adminRoot = node.closest('[data-admin-i18n-root]')
            if (adminRoot) localizeElement(node, locale)
            else localize(node)
          }
        }
      }
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...translatedAttributes],
    })
    return () => observer.disconnect()
  }, [locale])

  const value = useMemo(
    () => ({ locale, setLocale, t, translate }),
    [locale, setLocale, t, translate],
  )

  return (
    <AdminLocaleContext.Provider value={value}>
      {children}
    </AdminLocaleContext.Provider>
  )
}

function localizeElement(element: Element, locale: AdminLocale) {
  if (element.closest('[data-admin-i18n-ignore]')) return
  for (const attribute of translatedAttributes)
    localizeAttribute(element, attribute, locale)

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    localizeTextNode(node as Text, locale)
    node = walker.nextNode()
  }
  for (const child of element.querySelectorAll('*')) {
    if (child.closest('[data-admin-i18n-ignore]')) continue
    for (const attribute of translatedAttributes)
      localizeAttribute(child, attribute, locale)
  }
}

function localizeTextNode(node: Text, locale: AdminLocale) {
  if (node.parentElement?.closest('[data-admin-i18n-ignore]')) return
  const current = node.data
  const previous = textStates.get(node)
  const source =
    previous && current === previous.rendered ? previous.source : current
  const rendered = translateAdminText(source, locale)
  textStates.set(node, { source, rendered })
  if (current !== rendered) node.data = rendered
}

function localizeAttribute(
  element: Element,
  attribute: (typeof translatedAttributes)[number],
  locale: AdminLocale,
) {
  const current = element.getAttribute(attribute)
  if (current === null) return
  const states = attributeStates.get(element) ?? {}
  const previous = states[attribute]
  const source =
    previous && current === previous.rendered ? previous.source : current
  const rendered = translateAdminText(source, locale)
  states[attribute] = { source, rendered }
  attributeStates.set(element, states)
  if (current !== rendered) element.setAttribute(attribute, rendered)
}

function readStoredLocale(): AdminLocale {
  if (typeof window === 'undefined') return 'ja'
  try {
    return window.localStorage.getItem(ADMIN_LOCALE_STORAGE_KEY) === 'ko'
      ? 'ko'
      : 'ja'
  } catch {
    return 'ja'
  }
}
