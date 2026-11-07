---
name: react-performance
description: Performance rules for React and Next.js from Vercel - eliminating waterfalls, bundle size, server-side rendering and caching, client data fetching, re-renders, rendering and JavaScript hot paths. Use when writing React components or Next.js pages, implementing data fetching, optimizing bundle size or load time, or reviewing React code for performance issues.
source: Vercel React best practices
---

# Vercel React Best Practices

Comprehensive performance optimization guide for React and Next.js applications, maintained by Vercel. Contains 45 rules across 8 categories, prioritized by impact to guide automated refactoring and code generation.

## When to Use
Reference these guidelines when:
- Writing new React components or Next.js pages
- Implementing data fetching (client or server-side)
- Reviewing code for performance issues
- Refactoring existing React/Next.js code
- Optimizing bundle size or load times

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Eliminating Waterfalls | CRITICAL | `async-` |
| 2 | Bundle Size Optimization | CRITICAL | `bundle-` |
| 3 | Server-Side Performance | HIGH | `server-` |
| 4 | Client-Side Data Fetching | MEDIUM-HIGH | `client-` |
| 5 | Re-render Optimization | MEDIUM | `rerender-` |
| 6 | Rendering Performance | MEDIUM | `rendering-` |
| 7 | JavaScript Performance | LOW-MEDIUM | `js-` |
| 8 | Advanced Patterns | LOW | `advanced-` |

## Quick Reference

### 1. Eliminating Waterfalls (CRITICAL)

- [`async-defer-await`](rules/async-defer-await.md) - Move await into branches where actually used
- [`async-parallel`](rules/async-parallel.md) - Use Promise.all() for independent operations
- [`async-dependencies`](rules/async-dependencies.md) - Use better-all for partial dependencies
- [`async-api-routes`](rules/async-api-routes.md) - Start promises early, await late in API routes
- [`async-suspense-boundaries`](rules/async-suspense-boundaries.md) - Use Suspense to stream content

### 2. Bundle Size Optimization (CRITICAL)

- [`bundle-barrel-imports`](rules/bundle-barrel-imports.md) - Import directly, avoid barrel files
- [`bundle-dynamic-imports`](rules/bundle-dynamic-imports.md) - Use next/dynamic for heavy components
- [`bundle-defer-third-party`](rules/bundle-defer-third-party.md) - Load analytics/logging after hydration
- [`bundle-conditional`](rules/bundle-conditional.md) - Load modules only when feature is activated
- [`bundle-preload`](rules/bundle-preload.md) - Preload on hover/focus for perceived speed

### 3. Server-Side Performance (HIGH)

- [`server-cache-react`](rules/server-cache-react.md) - Use React.cache() for per-request deduplication
- [`server-cache-lru`](rules/server-cache-lru.md) - Use LRU cache for cross-request caching
- [`server-serialization`](rules/server-serialization.md) - Minimize data passed to client components
- [`server-parallel-fetching`](rules/server-parallel-fetching.md) - Restructure components to parallelize fetches
- [`server-after-nonblocking`](rules/server-after-nonblocking.md) - Use after() for non-blocking operations

### 4. Client-Side Data Fetching (MEDIUM-HIGH)

- [`client-swr-dedup`](rules/client-swr-dedup.md) - Use SWR for automatic request deduplication
- [`client-event-listeners`](rules/client-event-listeners.md) - Deduplicate global event listeners

### 5. Re-render Optimization (MEDIUM)

- [`rerender-defer-reads`](rules/rerender-defer-reads.md) - Don't subscribe to state only used in callbacks
- [`rerender-memo`](rules/rerender-memo.md) - Extract expensive work into memoized components
- [`rerender-dependencies`](rules/rerender-dependencies.md) - Use primitive dependencies in effects
- [`rerender-derived-state`](rules/rerender-derived-state.md) - Subscribe to derived booleans, not raw values
- [`rerender-functional-setstate`](rules/rerender-functional-setstate.md) - Use functional setState for stable callbacks
- [`rerender-lazy-state-init`](rules/rerender-lazy-state-init.md) - Pass function to useState for expensive values
- [`rerender-transitions`](rules/rerender-transitions.md) - Use startTransition for non-urgent updates

### 6. Rendering Performance (MEDIUM)

- [`rendering-animate-svg-wrapper`](rules/rendering-animate-svg-wrapper.md) - Animate div wrapper, not SVG element
- [`rendering-content-visibility`](rules/rendering-content-visibility.md) - Use content-visibility for long lists
- [`rendering-hoist-jsx`](rules/rendering-hoist-jsx.md) - Extract static JSX outside components
- [`rendering-svg-precision`](rules/rendering-svg-precision.md) - Reduce SVG coordinate precision
- [`rendering-hydration-no-flicker`](rules/rendering-hydration-no-flicker.md) - Use inline script for client-only data
- [`rendering-activity`](rules/rendering-activity.md) - Use Activity component for show/hide
- [`rendering-conditional-render`](rules/rendering-conditional-render.md) - Use ternary, not && for conditionals

### 7. JavaScript Performance (LOW-MEDIUM)

- [`js-batch-dom-css`](rules/js-batch-dom-css.md) - Group CSS changes via classes or cssText
- [`js-index-maps`](rules/js-index-maps.md) - Build Map for repeated lookups
- [`js-cache-property-access`](rules/js-cache-property-access.md) - Cache object properties in loops
- [`js-cache-function-results`](rules/js-cache-function-results.md) - Cache function results in module-level Map
- [`js-cache-storage`](rules/js-cache-storage.md) - Cache localStorage/sessionStorage reads
- [`js-combine-iterations`](rules/js-combine-iterations.md) - Combine multiple filter/map into one loop
- [`js-length-check-first`](rules/js-length-check-first.md) - Check array length before expensive comparison
- [`js-early-exit`](rules/js-early-exit.md) - Return early from functions
- [`js-hoist-regexp`](rules/js-hoist-regexp.md) - Hoist RegExp creation outside loops
- [`js-min-max-loop`](rules/js-min-max-loop.md) - Use loop for min/max instead of sort
- [`js-set-map-lookups`](rules/js-set-map-lookups.md) - Use Set/Map for O(1) lookups
- [`js-tosorted-immutable`](rules/js-tosorted-immutable.md) - Use toSorted() for immutability

### 8. Advanced Patterns (LOW)

- [`advanced-event-handler-refs`](rules/advanced-event-handler-refs.md) - Store event handlers in refs
- [`advanced-use-latest`](rules/advanced-use-latest.md) - useLatest for stable callback refs

## How to Use

Pick the categories that match the task and read only those rule files (linked above). Each rule file contains: why it matters, an incorrect code example, a correct code example, and additional context and references. Category definitions: [rules/_sections.md](rules/_sections.md).
