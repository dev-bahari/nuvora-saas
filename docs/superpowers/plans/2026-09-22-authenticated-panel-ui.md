# Authenticated Panel UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a cohesive, responsive and accessible authenticated Empyra panel with dialogs, confirmations, toasts and polished data workflows.

**Architecture:** Establish reusable UI primitives first, then rebuild the authenticated shell and apply it consistently to dashboard, invoices, customers, products and settings. Server data contracts and fiscal behavior remain unchanged.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-22-authenticated-panel-ui-design.md`

## Global Constraints

- Preserve the existing blue/green brand palette and dark-mode support.
- Do not alter API contracts, authorization, fiscal calculations, or database schema.
- Create/edit uses dialog or side panel, never an inline form page.
- Confirm irreversible/fiscal actions and logout; use accessible toast feedback for outcomes.
- Keep keyboard navigation, focus management, WCAG AA contrast and responsive layouts.

## Review Focus

- Opening and closing a dialog restores focus to its trigger.
- Escape never performs a destructive action; it only closes an open dialog.
- Toasts announce outcomes without hiding field-level validation errors.
- Filters remain usable at 390 px without clipped controls or hidden active state.
- Sidebar navigation has an equivalent reachable mobile drawer.

---

### Task 1: Build the shared app-shell and feedback primitives

**Files:**
- Create: `apps/web/components/app-shell/AppShell.tsx`
- Create: `apps/web/components/ui/Dialog.tsx`
- Create: `apps/web/components/ui/ConfirmDialog.tsx`
- Create: `apps/web/components/ui/ToastProvider.tsx`
- Create: `apps/web/components/ui/EmptyState.tsx`
- Create: `apps/web/components/ui/DataToolbar.tsx`
- Modify: `apps/web/app/app/layout.tsx`
- Modify: `apps/web/app/globals.css`
- Test: `apps/web/components/ui/ui.test.tsx`

**Interfaces:**
- Produces `useToast(): { success(message: string): void; error(message: string): void }` and controlled `Dialog({ open, onOpenChange, title, children })`.

- [ ] Write failing tests that assert dialog focus moves into the dialog, Escape closes it, focus returns to the trigger, and toast has `role="status"`.
- [ ] Run `pnpm --filter web test`; expect the components to be absent.
- [ ] Implement focus-trapped dialogs, confirm dialog, toast viewport, responsive shell, nav active state, mobile drawer, and shared empty/filter primitives.
- [ ] Run component tests, `pnpm --filter web lint`, `pnpm --filter web typecheck`, and `pnpm --filter web build`.
- [ ] Commit `feat(ui): add authenticated shell dialogs and toasts`.

### Task 2: Redesign dashboard and invoice workflows

**Files:**
- Modify: `apps/web/app/app/dashboard/page.tsx`
- Modify: `apps/web/app/app/invoices/page.tsx`
- Modify: `apps/web/app/app/invoices/[id]/page.tsx`
- Modify: `apps/web/app/app/invoices/new/page.tsx`
- Create: `apps/web/components/dashboard/MetricCard.tsx`
- Create: `tests/e2e/dashboard-invoices-ui.spec.ts`

**Interfaces:**
- Consumes shared `PageHeader`, `DataToolbar`, `EmptyState`, `ConfirmDialog`, and `useToast` primitives from Task 1.

- [ ] Write a failing E2E scenario that opens invoice filters at 390 px, creates from the primary action, and requires confirmation before issuance/cancellation.
- [ ] Run the scenario and preserve its failure before changing page behavior.
- [ ] Implement KPI hierarchy, recent-document table, filter toolbar, responsive invoice list, action menus, modal/panel forms and confirm/toast flows while preserving existing routes and requests.
- [ ] Run the targeted E2E plus desktop/mobile screenshots, then web lint, typecheck and build.
- [ ] Commit `feat(ui): redesign dashboard and invoice workflows`.

### Task 3: Redesign customer and product workflows

**Files:**
- Modify: `apps/web/app/app/customers/page.tsx`
- Modify: `apps/web/app/app/customers/[id]/page.tsx`
- Modify: `apps/web/app/app/customers/new/page.tsx`
- Modify: `apps/web/app/app/products/page.tsx`
- Modify: `apps/web/app/app/products/[id]/page.tsx`
- Modify: `apps/web/app/app/products/new/page.tsx`
- Create: `tests/e2e/master-data-ui.spec.ts`

**Interfaces:**
- Consumes Task 1 primitives; produces consistent dialog-based customer/product create and edit flows.

- [ ] Write a failing E2E scenario that searches, clears a filter, opens the create dialog, verifies accessible labels, confirms save and receives a toast.
- [ ] Run the scenario and confirm it fails against the current inline-form flow.
- [ ] Apply shared toolbar/table/empty states, move create/edit into dialogs or panels, add confirmation to saved changes, and use toasts for API outcomes.
- [ ] Verify target E2E at 1440 px and 390 px, then lint, typecheck and build.
- [ ] Commit `feat(ui): redesign customer and product workflows`.

### Task 4: Redesign settings and finalize UI quality

**Files:**
- Modify: `apps/web/app/app/settings/page.tsx`
- Modify: `apps/web/app/app/settings/taxes/page.tsx`
- Create: `tests/e2e/settings-ui.spec.ts`
- Create: `docs/ui/authenticated-panel-redesign.md`

**Interfaces:**
- Consumes Task 1 primitives; produces a documented final panel implementation and verification record.

- [ ] Write a failing E2E scenario that edits settings in a dialog, masks DIAN secrets, confirms save, receives a toast, and uses keyboard navigation.
- [ ] Run the scenario to confirm the existing inline settings form does not satisfy it.
- [ ] Group settings into clear cards, move mutable fields into dialogs, mask secrets, add confirmation/toast feedback, and preserve server actions/API field names.
- [ ] Capture desktop and mobile views for dashboard, invoices, customers, products and settings; run accessibility checks, lint, typecheck, test, E2E and build.
- [ ] Write `docs/ui/authenticated-panel-redesign.md` with scope, reusable components, changed routes, accessibility/responsive behavior, tests and screenshots.
- [ ] Commit `docs: document authenticated panel redesign`.
