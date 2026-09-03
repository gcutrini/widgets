# How widgets interact with the app

The widgets are legacy React-16 / Redux bundles (`full-schedule-widget`,
`summit-registration-lite`, …). They treat props as **owned, mutable state**
and **re-derive their entire internal store whenever a prop changes identity**.
The host is a React-19 app. This doc is the contract that keeps the two seams
seamless — most importantly, the rule that stops a legacy bundle re-initializing
on every host render.

## The one boundary

Host state flows to a legacy bundle through exactly one path. Each layer has a
single job:

```
 RSC index.tsx            server-fetched props (event data, colours, i18n)
   │  ①  pass down
   ▼
 Client.tsx               call the compose hook → a referentially STABLE
   │                      { props }; hand it to <Widget>.
   │  ②  compose          (auth data · realtime · schedule-state · callbacks)
   ▼
 reactComponent renderer  useMutationSafeProps() · memoize the widget element
   │  ③  isolate + memo    on the mutation-safe props
   ▼
 createWidgetShadow       shadow-DOM host · Sentry boundary · adopted vendor CSS
   │  ④  contain           (each legacy bundle mounts its own Redux provider)
   ▼
 legacy React-16 bundle   re-renders ONLY when its data actually changed
```

## The stability contract

> **A widget's props change identity if and only if its data actually changed.**

If that holds, the reactComponent renderer memoizes the widget element and React skips the
legacy subtree on any unrelated host re-render. It is enforced at three points:

1. **Stable sources.** Realtime data (`useRealTimeEvents`, `useRealTimeSummit`)
   comes from `useSyncExternalStore` — stable until a real update. `userProfile`
   is memoized (`useWidgetSafeProfile`). Server props are constant per mount.
2. **Stable callbacks — *and* they read live state.** Every `use*Callbacks`
   hook returns a **memoized** bundle of **`useCallback`'d** members. The
   guarded write chain (`useScheduleActions` → `useGuardedIntent` →
   `useAuthGuard`) keeps identity: intent builders are module-level; the guarded
   action is memoized on its builder. Never hand a widget an inline arrow or a
   fresh object literal.

   The second half matters just as much: a callback handed to a widget must be
   **stable in identity *and* read its reactive inputs live at call time** —
   never bake a reactive value (like `isLoggedIn`) into the callback's identity.
   A legacy widget captures a callback in its memoized event rows and **never
   re-threads a new one**, so a callback whose identity changes when auth flips
   leaves the widget holding the stale (anonymous) version — a post-login click
   then re-defers and reopens the login modal. `useAuthGuard` therefore returns
   a stable callback that reads `isLoggedIn` live from a ref (the `useEffectEvent`
   shape) — the same live-read a store snapshot getter gives. Rule: **stable
   identity, live reads.**
3. **Isolate only on change.** `useMutationSafeProps` (widget-mount's `mutation-safe-props` module)
   re-clones a prop only when its source reference changed, and returns the same
   object otherwise — so unchanged data yields the same element and the legacy
   subtree is skipped. (It also preserves the widget's own in-place mutations
   between renders, which the legacy model expects.)

## Where each concern lives

| Concern | Comes from | Notes |
|---|---|---|
| **Auth data** | `useAuth()` — `isLoggedIn`, `userProfile`, entitlements, `getAccessToken`, `syncSession` | Changes only on real session/profile change. |
| **Auth chrome** | `useAuthTransition()` — `isLoggingOut` | A **separate store slice** (own cached snapshot) so the overlay flag never re-renders auth (widget) consumers. Read only by `AuthTransitions`. |
| **Token** | `getAccessToken` (prop) + the resolver `kit/uicore-host` hands uicore, reading the `HostAuth` port | No real bearer on the client — a presence placeholder (`SESSION_PRESENT`); the proxy re-auths from the httpOnly cookie. |
| **Realtime** | `useRealTimeEvents` / `useRealTimeSummit` | External store; the worker holds no token. |
| **Callbacks** | `use*Callbacks` hooks | Memoized bundle of `useCallback`'d members (see contract §2). |
| **uicore config** | `configureUicore()` in `kit/uicore-host`, called by `src/components/widget/register-host.ts` at startup | `apiBaseUrl`, `idpBaseUrl`, `oauth2ClientId`, `timeApiUrl` from the `HostConfig` port, handed to uicore's `setConfig` before any widget mounts. |

## Adding or changing a widget

- Assemble props in the widget's `Client.tsx` (or a `use<Widget>Composition()` hook,
  like `useRegistrationComposition`). Return **memoized data + `useCallback`'d
  callbacks** — nothing that changes identity on an unrelated render.
- Do **not** re-implement isolation or memoize the element yourself —
  the reactComponent renderer owns that for every widget.
- Read auth via `useAuth()`; never reach for the overlay flag in widget code.
- If a widget mutates a **nested** prop value (not just a top-level field),
  escalate `mutationSafeProps` to a deep copy for that prop — see the note in
  widget-mount's `mutation-safe-props` module.

## Why this exists

The impedance mismatch is that the legacy bundle re-derives from props on any
identity change, while a React context app changes references often. Without
this contract, an unrelated host re-render (e.g. logout raising an overlay flag)
re-cloned the ~40-event array into fresh references and the widget re-initialized
— a visible flicker. The contract couples the widget to the host's **data**, not
its **render cadence**.
