/**
 * Site services — re-export shim.
 *
 * ⛔ **The implementation moved to `@uniweb/core/services`. Edit it there, not
 * here.** This file exists so that no foundation's import had to change:
 * `import { resolveService } from '@uniweb/kit'` is still the way a foundation
 * reaches it, and still should be.
 *
 * **Why it moved:** `@uniweb/runtime` resolves a service address itself (for
 * `tracking`) and **does not depend on `@uniweb/kit`** — only on core and
 * theming. The alternative was a second resolver with the same job and its own
 * base-joining rules, which is precisely the defect `@uniweb/core/route-match`
 * was created to end after one matcher was implemented twice and the copies
 * diverged by one character.
 *
 * The full contract — two tiers, site-outranks-host, open registry,
 * absent-means-absent, and why entitlement and decline strings are deliberately
 * unmodelled — lives in the module header there.
 *
 * @module @uniweb/kit/utils/services
 */

export {
  resolveService,
  resolveServiceUrl,
  readServiceOptions
} from '@uniweb/core/services'
