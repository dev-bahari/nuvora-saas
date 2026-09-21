---
name: nuvora-frontend
description: Use when building or changing Nuvora Next.js, React, Tailwind, accessibility, responsive layouts, forms, invoice editor, or preview UI.
---

# Nuvora frontend

**REQUIRED SUB-SKILL:** Use `impeccable:impeccable`.

- Default to Next.js Server Components; use Client Components only for interaction, local state or browser APIs.
- Use Tailwind semantic tokens and shared primitives. Keep arbitrary values exceptional and intentional.
- Render loading, empty, validation, unauthorized, stale, failure and success states.
- Meet keyboard, focus, contrast, labeling, reduced-motion and responsive requirements.
- Never implement fiscal calculations, permission truth, RLS assumptions or DIAN rules in the UI.
- Consume generated/versioned API contracts; report contract gaps instead of guessing fields.
- The live preview may calculate locally through the shared pure engine; final PDF/XML always come from persisted server data.

Handoff viewport evidence, accessibility checks, contract version and E2E results through `nuvora-coordination`.

