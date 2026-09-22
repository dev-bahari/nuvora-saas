# Authenticated Panel Redesign

## Scope and What Changed

The authenticated panel UI was rebuilt to deliver a cohesive, accessible, and responsive experience across all inner routes. No API contracts, authorization logic, fiscal calculations, or database schema were altered.

### Routes changed

| Route | Before | After |
|---|---|---|
| `/app/settings` | Single inline form, all fields always editable | Read-only card layout; mutable fields moved into Dialogs |
| `/app/settings/taxes` | Bare table with minimal styling | Styled card-wrapped table with EmptyState |
| `/app/invoices`, `/app/customers`, `/app/products` | Inline pages for create/edit | Create/edit in Dialog; `/new` and `/[id]/edit` redirect to list |
| `/app/dashboard` | Plain stats | KPI MetricCard grid with trend indicators |

## New Reusable Components

All primitives live in `apps/web/components/`:

| Component | Path | Description |
|---|---|---|
| `AppShell` | `app-shell/AppShell.tsx` | Responsive layout with collapsible sidebar drawer at <1024 px |
| `Dialog` | `ui/Dialog.tsx` | Focus-trapped `<dialog>` element; Escape closes, backdrop click closes, scroll locked |
| `ConfirmDialog` | `ui/ConfirmDialog.tsx` | Wraps Dialog with `role="alertdialog"`, cancel-first focus, async onConfirm, error toast on throw |
| `ToastProvider` / `useToast` | `ui/ToastProvider.tsx` | `success()` / `error()` with `role="status"` / `role="alert"`, 6-second auto-dismiss, pause-on-hover, portal into open modal |
| `PageHeader` | `ui/PageHeader.tsx` | Consistent `<h1>` + optional description + optional action slot |
| `EmptyState` | `ui/EmptyState.tsx` | Centered icon + heading + description + optional action for zero-data states |
| `DataToolbar` | `ui/DataToolbar.tsx` | Search input + filter controls; filters collapse into a Dialog at <768 px |
| `MetricCard` | `components/MetricCard.tsx` | KPI tile with value, label, and optional trend badge |

## Settings Page Design

`/app/settings` is grouped into three cards:

1. **Empresa** — razón social, NIT, email, dirección, teléfono, régimen. Edit opens a Dialog.
2. **DIAN** — ambiente, Software ID (masked as `••••••••`), PIN (masked). Edit opens a Dialog; saving requires a `ConfirmDialog` because these are fiscal-critical credentials.
3. **Plan** — read-only plan name and limits.

DIAN secrets are never rendered as plaintext in the card. Inside the edit Dialog the PIN field uses `<input type="password">` with a show/hide toggle. The actual value is sent only in the PUT body.

## Accessibility

- **Focus trapping:** `Dialog` cycles focus within the dialog via a `keydown` Tab handler.
- **Escape handling:** `onCancel` is intercepted to call `onOpenChange(false)`; Escape never performs a destructive action.
- **ARIA roles:** dialogs use `role="dialog"`, confirmation dialogs use `role="alertdialog"`, toasts use `role="status"` (success) or `role="alert"` (error) with `aria-atomic="true"`.
- **Focus restoration:** on close, focus returns to the trigger element that opened the dialog.
- **Toast announcements:** success and error toasts are announced by assistive technology via live regions without hiding field-level validation errors.
- **Contrast:** blue/green brand palette maintained; WCAG AA contrast verified in light and dark modes.

## Responsive Layout

- Sidebar becomes a drawer at viewport < 1024 px, toggled by a hamburger button in the top bar.
- DataToolbar filter controls collapse into a Dialog at < 768 px to avoid clipped controls.
- Settings cards stack vertically on mobile; two-column grids within dialogs collapse to single-column.
- Tax table hides secondary columns (`treatment`, `is_active`) at < 640 px via `hidden sm:table-cell`.

## Tests

| File | Coverage |
|---|---|
| `apps/web/components/ui/ui.test.tsx` | Dialog focus trap, Escape close, focus restoration, toast role="status" |
| `tests/e2e/settings-ui.spec.ts` | Settings cards render; DIAN secrets masked; Edit dialog accessibility; keyboard Tab/Enter/Escape; DIAN confirm dialog; toast on success; tax page read-only |
| `tests/e2e/dashboard-invoices-ui.spec.ts` | Dashboard KPI cards; invoice list filter dialog at 390 px; dialog open/close |
| `tests/e2e/master-data-ui.spec.ts` | Customers/products list; create dialog; empty state |

All E2E tests use `test.skip()` until the full stack is running in CI.

## Global Constraints Preserved

- No changes to API field names, HTTP contracts, or authorization middleware.
- No changes to fiscal calculation logic or database schema.
- Money is never handled in the UI layer; values come pre-formatted from the API.
- Issued fiscal documents remain immutable; no delete or edit path was added for them.
