import { query } from '../db/pool.js'

export async function listOrderOptions(req, res, next) {
  try {
    const projectCodes = normalizeQueryValues(req.query?.projectCode)
    const search = String(req.query?.search ?? '').trim()
    const limit = normalizeOptionLimit(req.query?.limit)
    const offset = normalizeOptionOffset(req.query?.offset)

    if (!projectCodes.length) {
      return res.status(400).json({ message: 'projectCode is required' })
    }

    const params = [projectCodes.map((projectCode) => projectCode.toLowerCase())]
    const serviceFilters = [
      'lower(btrim(project_site)) = ANY($1)',
      'service_order_no IS NOT NULL',
      "btrim(service_order_no) <> ''",
      "lower(COALESCE(NULLIF(btrim(status), ''), 'released')) = 'released'",
    ]
    const rentalFilters = [
      'lower(btrim(project_code)) = ANY($1)',
      'rental_order IS NOT NULL',
      "btrim(rental_order) <> ''",
      "lower(COALESCE(NULLIF(btrim(status), ''), 'released')) = 'released'",
    ]

    if (search) {
      params.push(`%${search}%`)
      const searchParam = `$${params.length}`
      serviceFilters.push(`(
        service_order_no ILIKE ${searchParam}
        OR COALESCE(item_description, '') ILIKE ${searchParam}
        OR COALESCE(description, '') ILIKE ${searchParam}
        OR COALESCE(item_code, '') ILIKE ${searchParam}
        OR COALESCE(serial_number, '') ILIKE ${searchParam}
        OR COALESCE(status, '') ILIKE ${searchParam}
      )`)
      rentalFilters.push(`(
        rental_order ILIKE ${searchParam}
        OR COALESCE(rental_description, '') ILIKE ${searchParam}
        OR COALESCE(item_description, '') ILIKE ${searchParam}
        OR COALESCE(item_code, '') ILIKE ${searchParam}
        OR COALESCE(status, '') ILIKE ${searchParam}
      )`)
    }

    params.push(limit + 1)
    const limitParam = `$${params.length}`
    params.push(offset)
    const offsetParam = `$${params.length}`

    const result = await query(
      `
        WITH all_orders AS (
          SELECT
            'Service' AS order_type,
            service_order_no AS order_no,
            status,
            project_site AS project_code,
            COALESCE(NULLIF(project_description, ''), project_site) AS project_description,
            item_code,
            COALESCE(NULLIF(item_description, ''), NULLIF(description, ''), item_code) AS item_description,
            serial_number,
            COALESCE(NULLIF(description, ''), NULLIF(item_description, ''), item_code) AS order_description
          FROM service_orders
          WHERE ${serviceFilters.join('\n            AND ')}

          UNION ALL

          SELECT
            'Rental' AS order_type,
            rental_order AS order_no,
            status,
            project_code,
            COALESCE(NULLIF(project_description, ''), project_code) AS project_description,
            item_code,
            COALESCE(NULLIF(item_description, ''), item_code) AS item_description,
            '' AS serial_number,
            COALESCE(NULLIF(rental_description, ''), NULLIF(item_description, ''), rental_order) AS order_description
          FROM rental_order_master
          WHERE ${rentalFilters.join('\n            AND ')}
        )
        SELECT *
        FROM all_orders
        ORDER BY order_no ASC, order_type ASC
        LIMIT ${limitParam}
        OFFSET ${offsetParam}
      `,
      params,
    )

    const data = result.rows.slice(0, limit)

    return res.json({
      data,
      hasMore: result.rows.length > limit,
      nextOffset: offset + data.length,
    })
  } catch (error) {
    return next(error)
  }
}

function normalizeOptionLimit(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return 80
  return Math.min(parsed, 500)
}

function normalizeOptionOffset(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return parsed
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
