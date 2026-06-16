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

    if (result.rows.length) {
      return res.json({ data: result.rows })
    }

    const warehouseLocationResult = await query(
      `
        SELECT DISTINCT ON (location_code)
          project_code,
          project_description AS project_name,
          location_code,
          location_description AS description
        FROM warehouse_location_master
        WHERE lower(btrim(project_code)) = ANY($1)
          AND location_code IS NOT NULL
          AND btrim(location_code) <> ''
        ORDER BY location_code ASC, location_description ASC
      `,
      [projectCodes.map((projectCode) => projectCode.toLowerCase())],
    )

    return res.json({ data: warehouseLocationResult.rows })
  } catch (error) {
    return next(error)
  }
}

export async function listBusinessPartnerOptions(req, res, next) {
  try {
    const projectCodes = normalizeQueryValues(req.query?.projectCode)
    const locationCodes = normalizeQueryValues(req.query?.locationCode)

    if (projectCodes.length) {
      const conditions = ['lower(btrim(project_code)) = ANY($1)']
      const params = [projectCodes.map((projectCode) => projectCode.toLowerCase())]

      if (locationCodes.length) {
        params.push(locationCodes.map((locationCode) => locationCode.toLowerCase()))
        conditions.push(`lower(btrim(location_code)) = ANY($${params.length})`)
      }

      const result = await query(
        `
          SELECT DISTINCT ON (business_partner_code)
            project_code,
            location_code,
            business_partner_code,
            business_partner_name
          FROM bp_activity_master
          WHERE ${conditions.join(' AND ')}
            AND business_partner_code IS NOT NULL
            AND btrim(business_partner_code) <> ''
          ORDER BY business_partner_code ASC, business_partner_name ASC
        `,
        params,
      )

      if (result.rows.length || !locationCodes.length) {
        return res.json({ data: result.rows })
      }

      const projectResult = await query(
        `
          SELECT DISTINCT ON (business_partner_code)
            project_code,
            location_code,
            business_partner_code,
            business_partner_name
          FROM bp_activity_master
          WHERE lower(btrim(project_code)) = ANY($1)
            AND business_partner_code IS NOT NULL
            AND btrim(business_partner_code) <> ''
          ORDER BY business_partner_code ASC, business_partner_name ASC
        `,
        [projectCodes.map((projectCode) => projectCode.toLowerCase())],
      )

      if (projectResult.rows.length) {
        return res.json({ data: projectResult.rows })
      }

      const globalResult = await listGlobalBusinessPartnerOptions()
      return res.json({ data: globalResult.rows })
    }

    const result = await listGlobalBusinessPartnerOptions()

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

function listGlobalBusinessPartnerOptions() {
  return query(
    `
      SELECT
        business_partner_code,
        COALESCE(NULLIF(business_partner_name, ''), NULLIF(bp_name, ''), business_partner_code) AS business_partner_name
      FROM business_partner_master
      WHERE business_partner_code IS NOT NULL
        AND btrim(business_partner_code) <> ''
      ORDER BY business_partner_code ASC
    `,
  )
}
