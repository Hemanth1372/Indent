import { query } from '../db/pool.js'

const SERVICE_ORDER_SELECT_SQL = `
  SELECT
    so.id,
    so.service_order_no,
    so.status,
    so.item_code,
    so.serial_number,
    so.description,
    so.project_site,
    so.created_at,
    so.updated_at
  FROM service_orders so
`

const SEARCHABLE_SERVICE_ORDER_FIELDS = [
  'service_order_no',
  'status',
  'item_code',
  'serial_number',
  'project_site',
  'description',
]

export async function listServiceOrders(req, res, next) {
  try {
    const requestedPage = Number.parseInt(String(req.query?.page ?? ''), 10)
    const requestedLimit = Number.parseInt(String(req.query?.limit ?? ''), 10)
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 500)
      : 100
    const searchField = String(req.query?.field ?? '').trim()
    const searchValue = String(req.query?.value ?? '').trim()

    if (searchField || searchValue) {
      if (!searchField || !searchValue) {
        return res.status(400).json({ message: 'Both filter field and value are required' })
      }

      if (!SEARCHABLE_SERVICE_ORDER_FIELDS.includes(searchField)) {
        return res.status(400).json({ message: 'Invalid filter field' })
      }
    }

    const whereClause = searchField && searchValue ? `WHERE so.${searchField} ILIKE $1` : ''
    const filterParams = searchField && searchValue ? [`%${searchValue}%`] : []
    const countResult = await query(
      `
        SELECT COUNT(*)::int AS total
        FROM service_orders so
        ${whereClause}
      `,
      filterParams,
    )
    const totalRecords = Number(countResult.rows[0]?.total ?? 0)
    const totalPages = Math.max(1, Math.ceil(totalRecords / limit))
    const currentPage = Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, totalPages)
      : 1
    const offset = (currentPage - 1) * limit
    const result = await query(
      `
        ${SERVICE_ORDER_SELECT_SQL}
        ${whereClause}
        ORDER BY so.service_order_no ASC
        LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}
      `,
      [...filterParams, limit, offset],
    )

    return res.json({
      metadata: {
        totalRecords,
        totalPages,
        currentPage,
        limit,
      },
      data: result.rows,
    })
  } catch (error) {
    return next(error)
  }
}

export async function listServiceOrderOptions(_req, res, next) {
  try {
    const [itemsResult, sitesResult] = await Promise.all([
      query(`
        SELECT item_code, item_description AS item_name
        FROM item_master
        ORDER BY item_code ASC
      `),
      query(`
        SELECT site_code, project_name
        FROM projects
        WHERE site_code IS NOT NULL AND site_code <> ''
        ORDER BY site_code ASC
      `),
    ])

    return res.json({
      items: itemsResult.rows,
      sites: sitesResult.rows,
    })
  } catch (error) {
    return next(error)
  }
}

export async function createServiceOrder(req, res, next) {
  try {
    const {
      service_order_no,
      status,
      item_code = null,
      serial_number = null,
      description = null,
      project_site,
    } = req.validated.body

    const result = await query(
      `
        INSERT INTO service_orders (
          service_order_no,
          status,
          item_code,
          serial_number,
          description,
          project_site
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `,
      [service_order_no, status, item_code, serial_number, description, project_site],
    )

    const serviceOrder = await fetchServiceOrderById(result.rows[0].id)

    return res.status(201).json({
      message: 'Service order created successfully',
      data: serviceOrder,
    })
  } catch (error) {
    return handleServiceOrderError(error, res, next)
  }
}

export async function updateServiceOrder(req, res, next) {
  try {
    const { id } = req.validated.params
    const allowedFields = [
      'service_order_no',
      'status',
      'item_code',
      'serial_number',
      'description',
      'project_site',
    ]
    const updates = Object.entries(req.validated.body).filter(([key]) => allowedFields.includes(key))
    const assignments = updates.map(([key], index) => `${key} = $${index + 2}`)
    const values = updates.map(([, value]) => value)

    const result = await query(
      `
        UPDATE service_orders
        SET ${assignments.join(', ')},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id
      `,
      [id, ...values],
    )

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Service order not found' })
    }

    const serviceOrder = await fetchServiceOrderById(id)

    return res.json({
      message: 'Service order updated successfully',
      data: serviceOrder,
    })
  } catch (error) {
    return handleServiceOrderError(error, res, next)
  }
}

export async function deleteServiceOrder(req, res, next) {
  try {
    const { id } = req.validated.params
    const result = await query(
      `
        DELETE FROM service_orders
        WHERE id = $1
        RETURNING id, service_order_no
      `,
      [id],
    )

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Service order not found' })
    }

    return res.json({
      message: 'Service order deleted successfully',
      data: result.rows[0],
    })
  } catch (error) {
    return next(error)
  }
}

async function fetchServiceOrderById(id) {
  const result = await query(
    `
      ${SERVICE_ORDER_SELECT_SQL}
      WHERE so.id = $1
      LIMIT 1
    `,
    [id],
  )

  return result.rows[0]
}

function handleServiceOrderError(error, res, next) {
  if (error.code === '23505') {
    return res.status(409).json({ message: 'A service order with this order number already exists' })
  }

  if (error.code === '23503') {
    return res.status(400).json({ message: 'Referenced service order data was not found' })
  }

  return next(error)
}
