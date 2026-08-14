export { useWebsite, default } from './useWebsite.js'
export { useFetched } from './useFetched.js'
export { useCacheEntry } from './useCacheEntry.js'
export { useEntityDetail } from './useEntityDetail.js'
export { useCollectionQueryable } from './useCollectionQueryable.js'
export { useRouting } from './useRouting.js'
export { useActiveRoute } from './useActiveRoute.js'
export { useVersion } from './useVersion.js'
export { useScrolled } from './useScrolled.js'
export { useMobileMenu } from './useMobileMenu.js'
export { useAccordion } from './useAccordion.js'
export { useHeadings } from './useHeadings.js'
export { useGridLayout, getGridClasses } from './useGridLayout.js'
export { useInView, useIsInView } from './useInView.js'
export { usePageState } from './usePageState.js'
export { useWebsiteState } from './useWebsiteState.js'

// Keyboard shortcuts — the mechanism only; kit binds no keys of its own.
export {
  useShortcut,
  useShortcuts,
  useShortcutLabel,
  parseShortcut,
  matchesShortcut,
  formatShortcut,
  isApplePlatform
} from './useShortcut.js'

// Theme data hooks (runtime theme access)
export {
  useThemeData,
  useColorContext,
  useAppearance,
  useThemeColor,
  useThemeColorVar
} from './useThemeData.js'

// Form submission lifecycle for foundation Form components
export { useFormSubmit } from './useFormSubmit.js'
export { useFormValues, valueAt } from './useFormValues.js'

// Site tracking — one event stream (`kb/framework/plans/tracking.md`).
// `block.track(name, data)` is the common case and needs no hook; these cover
// events with no block in hand, the consent gate, and opt-in scroll reporting.
export { useTracker } from './useTracker.js'
export { useTrackingConsent } from './useTrackingConsent.js'
export { useScrollDepth } from './useScrollDepth.js'
