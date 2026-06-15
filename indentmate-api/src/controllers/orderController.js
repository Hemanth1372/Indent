import { query } from '../db/pool.js'

export async function listOrderOptions(req, res, next) {
  try {
    const projectCodes = normalizeQueryValues(req.query?.projectCode)

    if (!projectCodes.length) {
      return res.status(400).json({ message: 'projectCode is required' })
    }

    const params = [projectCodes.map((projectCode) => projectCode.toLowerCase())]
    const serviceResult = await query(
      `
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
        WHERE lower(btrim(project_site)) = ANY($1)
          AND service_order_no IS NOT NULL
          AND btrim(service_order_no) <> ''
          AND lower(COALESCE(NULLIF(btrim(status), ''), 'released')) = 'released'
        ORDER BY service_order_no ASC
      `,
      params,
    )

    const rentalResult = await query(
      `
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
        WHERE lower(btrim(project_code)) = ANY($1)
          AND rental_order IS NOT NULL
          AND btrim(rental_order) <> ''
          AND lower(COALESCE(NULLIF(btrim(status), ''), 'released')) = 'released'
        ORDER BY rental_order ASC
      `,
      params,
    )

    return res.json({
      data: [...serviceResult.rows, ...rentalResult.rows].sort((left, right) =>
        String(left.order_no).localeCompare(String(right.order_no)),
      ),
    })
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
