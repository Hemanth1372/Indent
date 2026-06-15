import { query } from '../db/pool.js'

export async function getDashboardStats(req, res, next) {
  try {
    const monthKey = normalizeMonthKey(req.query?.month)
    const whereClause = monthKey
      ? "WHERE h.created_at >= $1::date AND h.created_at < ($1::date + INTERVAL '1 month')"
      : ''
    const params = monthKey ? [`${monthKey}-01`] : []
    const result = await query(`
      SELECT
        COUNT(*)::int AS total_indents,
        COALESCE(SUM(CASE WHEN status IN ('Created', 'Pending', 'PendingApproval', 'ApprovalPending') THEN 1 ELSE 0 END), 0)::int AS pending_indents,
        COALESCE(SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END), 0)::int AS approved_indents,
        COALESCE(SUM(CASE WHEN status IN ('Issue', 'PartiallyIssued', 'Issued', 'Completed') THEN 1 ELSE 0 END), 0)::int AS issued_indents,
        COALESCE(SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END), 0)::int AS rejected_indents
      FROM indent_headers h
      ${whereClause}
    `, params)

    const stats = result.rows[0]

    return res.json({
      data: {
        total: stats.total_indents,
        pending: stats.pending_indents,
        approved: stats.approved_indents,
        issued: stats.issued_indents,
        rejected: stats.rejected_indents,
        month: monthKey,
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function getDashboardMonthlyStats(_req, res, next) {
  try {
    const result = await query(`
      WITH recent_months AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE) - INTERVAL '2 months',
          date_trunc('month', CURRENT_DATE),
          INTERVAL '1 month'
        ) AS month_start
      )
      SELECT
        to_char(recent_months.month_start, 'YYYY-MM') AS month,
        to_char(recent_months.month_start, 'Mon') AS label,
        COUNT(h.id)::int AS total,
        COALESCE(SUM(CASE WHEN h.status IN ('Created', 'Pending', 'PendingApproval', 'ApprovalPending') THEN 1 ELSE 0 END), 0)::int AS pending,
        COALESCE(SUM(CASE WHEN h.status = 'Approved' THEN 1 ELSE 0 END), 0)::int AS approved,
        COALESCE(SUM(CASE WHEN h.status IN ('Issue', 'PartiallyIssued', 'Issued', 'Completed') THEN 1 ELSE 0 END), 0)::int AS issued,
        COALESCE(SUM(CASE WHEN h.status = 'Rejected' THEN 1 ELSE 0 END), 0)::int AS rejected
      FROM recent_months
      LEFT JOIN indent_headers h
        ON h.created_at >= recent_months.month_start
       AND h.created_at < recent_months.month_start + INTERVAL '1 month'
      GROUP BY recent_months.month_start
      ORDER BY recent_months.month_start DESC
    `)

    return res.json({ data: result.rows })
  } catch (error) {
    return next(error)
  }
}

function normalizeMonthKey(value) {
  const monthKey = String(value ?? '').trim()

  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return null
  }

  return monthKey
}
