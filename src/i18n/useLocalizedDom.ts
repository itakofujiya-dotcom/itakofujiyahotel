import { useLayoutEffect } from 'react'

type Locale = 'ja' | 'ko'
type TextTranslationState = { source: string; rendered: string }
type AttributeTranslationState = Record<
  string,
  { source: string; rendered: string }
>

const textStates = new WeakMap<Text, TextTranslationState>()
const attributeStates = new WeakMap<Element, AttributeTranslationState>()
const translatedAttributes = ['placeholder', 'title', 'aria-label'] as const

export function useLocalizedDom({
  locale,
  rootSelector,
  ignoreSelector,
  translate,
}: {
  locale: Locale
  rootSelector: string
  ignoreSelector: string
  translate: (value: string) => string
}) {
  useLayoutEffect(() => {
    const localize = (root: ParentNode) => {
      const roots: Element[] = []
      if (root instanceof Element && root.matches(rootSelector))
        roots.push(root)
      if ('querySelectorAll' in root)
        roots.push(...root.querySelectorAll(rootSelector))

      for (const localizedRoot of roots) {
        localizedRoot.setAttribute('lang', locale)
        document.documentElement.lang = locale
        localizeElement(localizedRoot, locale, ignoreSelector, translate)
      }
    }

    localize(document.body)
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          const element = mutation.target as Element
          if (
            element.closest(rootSelector) &&
            mutation.attributeName &&
            translatedAttributes.includes(
              mutation.attributeName as (typeof translatedAttributes)[number],
            )
          )
            localizeAttribute(
              element,
              mutation.attributeName as (typeof translatedAttributes)[number],
              locale,
              translate,
            )
          continue
        }
        if (mutation.type === 'characterData') {
          const parent = mutation.target.parentElement
          if (parent?.closest(rootSelector))
            localizeTextNode(
              mutation.target as Text,
              locale,
              ignoreSelector,
              translate,
            )
          continue
        }
        for (const node of mutation.addedNodes) {
          if (node instanceof Text) {
            if (node.parentElement?.closest(rootSelector))
              localizeTextNode(node, locale, ignoreSelector, translate)
          } else if (node instanceof Element) {
            const localizedRoot = node.closest(rootSelector)
            if (localizedRoot)
              localizeElement(node, locale, ignoreSelector, translate)
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
  }, [ignoreSelector, locale, rootSelector, translate])
}

function localizeElement(
  element: Element,
  locale: Locale,
  ignoreSelector: string,
  translate: (value: string) => string,
) {
  if (element.closest(ignoreSelector)) return
  for (const attribute of translatedAttributes)
    localizeAttribute(element, attribute, locale, translate)

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    localizeTextNode(node as Text, locale, ignoreSelector, translate)
    node = walker.nextNode()
  }
  for (const child of element.querySelectorAll('*')) {
    if (child.closest(ignoreSelector)) continue
    for (const attribute of translatedAttributes)
      localizeAttribute(child, attribute, locale, translate)
  }
}

function localizeTextNode(
  node: Text,
  locale: Locale,
  ignoreSelector: string,
  translate: (value: string) => string,
) {
  if (node.parentElement?.closest(ignoreSelector)) return
  const current = node.data
  const previous = textStates.get(node)
  const source =
    previous && current === previous.rendered ? previous.source : current
  const rendered = locale === 'ja' ? source : translate(source)
  textStates.set(node, { source, rendered })
  if (current !== rendered) node.data = rendered
}

function localizeAttribute(
  element: Element,
  attribute: (typeof translatedAttributes)[number],
  locale: Locale,
  translate: (value: string) => string,
) {
  const current = element.getAttribute(attribute)
  if (current === null) return
  const states = attributeStates.get(element) ?? {}
  const previous = states[attribute]
  const source =
    previous && current === previous.rendered ? previous.source : current
  const rendered = locale === 'ja' ? source : translate(source)
  states[attribute] = { source, rendered }
  attributeStates.set(element, states)
  if (current !== rendered) element.setAttribute(attribute, rendered)
}
