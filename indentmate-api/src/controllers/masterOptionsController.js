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
    const projectCodes = normalizeQueryValues(req.query?.projectCode)
    const locationCodes = normalizeQueryValues(req.query?.locationCode)

    if (!projectCodes.length) {
      return res.status(400).json({ message: 'projectCode is required' })
    }

    if (!locationCodes.length) {
      return res.status(400).json({ message: 'locationCode is required' })
    }

    const result = await query(
      `
        WITH project_rows AS (
          SELECT
            project_code,
            location_code,
            business_partner_code,
            business_partner_name
          FROM bp_activity_master
          WHERE lower(btrim(project_code)) = ANY($1)
        ),
        exact_location_rows AS (
          SELECT *
          FROM project_rows
          WHERE lower(btrim(location_code)) = ANY($2)
        ),
        selected_rows AS (
          SELECT *
          FROM exact_location_rows
          UNION ALL
          SELECT *
          FROM project_rows
          WHERE NOT EXISTS (SELECT 1 FROM exact_location_rows)
        )
        SELECT DISTINCT ON (business_partner_code)
          project_code,
          location_code,
          business_partner_code,
          business_partner_name
        FROM selected_rows
        ORDER BY business_partner_code ASC, business_partner_name ASC
      `,
      [
        projectCodes.map((projectCode) => projectCode.toLowerCase()),
        locationCodes.map((locationCode) => locationCode.toLowerCase()),
      ],
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
