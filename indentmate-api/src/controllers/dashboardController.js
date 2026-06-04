import { query } from '../db/pool.js'

export async function getDashboardStats(_req, res, next) {
  try {
    const result = await query(`
      SELECT
        COUNT(*)::int AS total_indents,
        COALESCE(SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END), 0)::int AS pending_indents,
        COALESCE(SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END), 0)::int AS approved_indents,
        COALESCE(SUM(CASE WHEN status = 'Issued' THEN 1 ELSE 0 END), 0)::int AS issued_indents
      FROM indents
    `)

    const stats = result.rows[0]

    return res.json({
      data: {
        total: stats.total_indents,
        pending: stats.pending_indents,
        approved: stats.approved_indents,
        issued: stats.issued_indents,
      },
    })
  } catch (error) {
    return next(error)
  }
}
