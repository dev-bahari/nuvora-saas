/**
 * Tenancy Context & Security Boundary
 * Every tenant-scoped operation in Nuvora requires an authenticated RequestContext.
 */

export type TenantId = string;
export type UserId = string;

export type Permission =
  | 'customers.read'
  | 'customers.write'
  | 'products.read'
  | 'products.write'
  | 'invoices.read'
  | 'invoices.create'
  | 'invoices.write'
  | 'invoices.issue'
  | 'credit_notes.create'
  | 'credit_notes.issue'
  | 'debit_notes.create'
  | 'debit_notes.issue'
  | 'dian.configure'
  | 'accounting.read'
  | 'accounting.write'
  | 'notifications.manage'
  | 'notifications.read'
  | 'users.manage'
  | 'tenant.settings'
  | 'audit.read'
  | 'taxes.read';

export interface RequestContext {
  readonly userId: UserId;
  readonly tenantId: TenantId;
  readonly permissions: readonly Permission[];
  readonly requestId: string;
}

/**
 * Verifies if the active RequestContext holds a specific required permission.
 */
export function hasPermission(ctx: RequestContext, permission: Permission): boolean {
  return ctx.permissions.includes(permission);
}
