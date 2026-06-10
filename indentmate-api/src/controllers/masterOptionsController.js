import { query } from '../db/pool.js'

export async function listLocationOptions(req, res, next) {
  try {
    const projectCodes = normalizeQueryValues(req.query?.projectCode)

    if (!projectCodes.length) {
      return res.status(400).json({ message: 'projectCode is required' })
    }

    const result = await query(
      `
        SELECT
          project_code,
          project_name,
          location_code,
          description
        FROM location_master
        WHERE lower(btrim(project_code)) = ANY($1)
          AND LOWER(COALESCE(status, 'active')) <> 'inactive'
        ORDER BY location_code ASC
      `,
      [projectCodes.map((projectCode) => projectCode.toLowerCase())],
    )

    return res.json({ data: result.rows })
  } catch (error) {
    return next(error)
  }
}

export async function listBusinessPartnerOptions(req, res, next) {
  try {
    const result = await query(
      `
        SELECT
          business_partner_code,
          business_partner_name
        FROM business_partner_master
        ORDER BY business_partner_code ASC
      `,
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
