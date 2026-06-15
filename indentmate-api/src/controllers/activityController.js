import { query } from '../db/pool.js'

export async function listActivityOptions(req, res, next) {
  try {
    const projectCodes = normalizeQueryValues(req.query?.projectCode)

    if (!projectCodes.length) {
      return res.status(400).json({ message: 'projectCode is required' })
    }

    const result = await query(
      `
        SELECT DISTINCT ON (activity_code)
          project_code,
          activity_code,
          COALESCE(NULLIF(description, ''), activity_code) AS description,
          COALESCE(NULLIF(activity_type, ''), '') AS activity_type,
          COALESCE(NULLIF(critical_capacity_type, ''), '') AS critical_capacity_type,
          COALESCE(NULLIF(work_auth_status, ''), 'Released') AS work_auth_status
        FROM activity_master
        WHERE lower(btrim(project_code)) = ANY($1)
          AND activity_code IS NOT NULL
          AND btrim(activity_code) <> ''
        ORDER BY activity_code ASC, description ASC
      `,
      [projectCodes.map((projectCode) => projectCode.toLowerCase())],
    )

    return res.json({ data: result.rows })
  } catch (error) {
    return next(error)
  }
}

function normalizeQueryValues(value) {
  const values = Array.isArray(value) ? value : [value]

  return [...new Set(
    values
      .flatMap((entry) => String(entry ?? '').split(','))
      .map((entry) => entry.trim())
      .filter(Boolean),
  )]
}
