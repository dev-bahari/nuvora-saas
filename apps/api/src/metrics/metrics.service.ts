import { Injectable, Optional } from '@nestjs/common';
import pg from 'pg';
import { withTenant } from '../tenancy/tenant-transaction.js';
import type { RequestContext } from '../tenancy/tenant-context.js';

export interface DashboardMetrics {
  invoicesThisMonth: number;
  revenueThisMonth: string;
  pendingDian: number;
  rejectedThisMonth: number;
  recentDocuments: Array<{
    id: string;
    documentType: string;
    status: string;
    customerName: string;
    grandTotal: string;
    currency: string;
    issueDate: string;
  }>;
}

@Injectable()
export class MetricsService {
  private pool: pg.Pool;

  constructor(@Optional() customPool?: pg.Pool) {
    this.pool =
      customPool ??
      new pg.Pool({
        connectionString:
          process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/nuvora',
      });
  }

  async getDashboard(ctx: RequestContext): Promise<DashboardMetrics> {
    return withTenant(this.pool, ctx, async (tx) => {
      const { rows: [kpi] } = await tx.query<{
        invoices_this_month: string;
        revenue_this_month: string;
        pending_dian: string;
        rejected_this_month: string;
      }>(`
        SELECT
          COUNT(*) FILTER (
            WHERE document_type = 'INVOICE'
              AND status = 'ISSUED'
              AND date_trunc('month', created_at) = date_trunc('month', NOW())
          ) AS invoices_this_month,

          COALESCE(SUM(grand_total) FILTER (
            WHERE document_type = 'INVOICE'
              AND status = 'ISSUED'
              AND date_trunc('month', created_at) = date_trunc('month', NOW())
          ), 0) AS revenue_this_month,

          COUNT(*) FILTER (
            WHERE status IN ('PROCESSING', 'DIAN_PENDING')
          ) AS pending_dian,

          COUNT(*) FILTER (
            WHERE status = 'REJECTED'
              AND date_trunc('month', created_at) = date_trunc('month', NOW())
          ) AS rejected_this_month

        FROM fiscal_documents
      `);

      const { rows: recent } = await tx.query<{
        id: string;
        document_type: string;
        status: string;
        customer_name: string;
        grand_total: string;
        currency: string;
        issue_date: string;
      }>(`
        SELECT
          id,
          document_type,
          status,
          customer_snapshot->>'legalName' AS customer_name,
          grand_total,
          currency,
          issue_date::text
        FROM fiscal_documents
        ORDER BY created_at DESC
        LIMIT 5
      `);

      return {
        invoicesThisMonth: parseInt(kpi!.invoices_this_month, 10),
        revenueThisMonth: parseFloat(kpi!.revenue_this_month).toFixed(2),
        pendingDian: parseInt(kpi!.pending_dian, 10),
        rejectedThisMonth: parseInt(kpi!.rejected_this_month, 10),
        recentDocuments: recent.map((r) => ({
          id: r.id,
          documentType: r.document_type,
          status: r.status,
          customerName: r.customer_name ?? '',
          grandTotal: parseFloat(r.grand_total).toFixed(2),
          currency: r.currency,
          issueDate: r.issue_date,
        })),
      };
    });
  }
}
