import { pool, query } from '../db/pool.js'

const INDENT_SELECT_SQL = `
  SELECT
    h.id,
    h.app_request_id,
    h.indent_no,
    h.created_by,
    u.employee_name AS created_by_name,
    h.project_code,
    pm.project_description AS project_name,
    h.source_warehouse,
    wm.warehouse_description AS source_warehouse_name,
    h.source_location,
    h.delivery_location,
    COALESCE(dm.description_1, dm.delivery_point) AS delivery_location_name,
    h.requirement_type,
    h.indent_type,
    h.to_entity_type,
    h.to_entity_id,
    first_line.item_code,
    first_line.item_description AS item_name,
    first_line.make,
    first_line.required_qty,
    first_line.issued_qty,
    first_line.uom,
    COALESCE(first_line.remarks, h.remarks) AS remarks,
    h.status,
    h.synced_at,
    h.approved_by,
    h.approved_at,
    h.attachments,
    h.created_at,
    h.updated_at,
    COALESCE(lines.items, '[]'::json) AS items
  FROM indent_headers h
  LEFT JOIN users u ON u.login_name = h.created_by
  LEFT JOIN project_master pm ON pm.project_code = h.project_code
  LEFT JOIN warehouse_master wm ON wm.warehouse_code = h.source_warehouse
  LEFT JOIN delivery_master dm ON dm.project_code = h.project_code AND dm.delivery_point = h.delivery_location
  LEFT JOIN LATERAL (
    SELECT
      l.item_code,
      COALESCE(l.item_description, im.item_description) AS item_description,
      l.make,
      l.required_qty,
      l.issued_qty,
      l.uom,
      l.remarks
    FROM indent_lines l
    LEFT JOIN LATERAL (
      SELECT item_description
      FROM item_master im
      WHERE im.project_site = h.project_code
        AND im.item_code = l.item_code
      ORDER BY im.id
      LIMIT 1
    ) im ON TRUE
    WHERE l.indent_header_id = h.id
    ORDER BY l.line_number
    LIMIT 1
  ) first_line ON TRUE
  LEFT JOIN LATERAL (
    SELECT json_agg(
      json_build_object(
        'id', l.id,
        'line_number', l.line_number,
        'item_code', l.item_code,
        'item_name', COALESCE(l.item_description, im.item_description),
        'make', l.make,
        'uom', l.uom,
        'required_qty', l.required_qty,
        'issued_qty', l.issued_qty,
        'work_type', l.work_type,
        'activity_code', l.activity_code,
        'location_code', l.location_code,
        'remarks', l.remarks,
        'attachment_url', l.attachment_url
      )
      ORDER BY l.line_number
    ) AS items
    FROM indent_lines l
    LEFT JOIN LATERAL (
      SELECT item_description
      FROM item_master im
      WHERE im.project_site = h.project_code
        AND im.item_code = l.item_code
      ORDER BY im.id
      LIMIT 1
    ) im ON TRUE
    WHERE l.indent_header_id = h.id
  ) lines ON TRUE
`

export async function listIndents(_req, res, next) {
  try {
    const result = await query(`
      ${INDENT_SELECT_SQL}
      ORDER BY h.created_at DESC, h.indent_no DESC
    `)

    return res.json({ data: result.rows })
  } catch (error) {
    return next(error)
  }
}

export async function listMyIndents(req, res, next) {
  try {
    const createdBy = req.user?.login_name ?? req.user?.employeeId ?? req.user?.employee_id

    if (!createdBy) {
      return res.status(401).json({ message: 'Authenticated user is required' })
    }

    const result = await query(
      `
        ${INDENT_SELECT_SQL}
        WHERE h.created_by = $1
        ORDER BY h.created_at DESC, h.indent_no DESC
      `,
      [createdBy],
    )

    return res.json({ data: result.rows })
  } catch (error) {
    return next(error)
  }
}

export async function getIndent(req, res, next) {
  try {
    const indent = await fetchIndentById(req.params.id)

    if (!indent) {
      return res.status(404).json({ message: 'Indent not found' })
    }

    return res.json({ data: indent })
  } catch (error) {
    return next(error)
  }
}

export async function getMyIndent(req, res, next) {
  try {
    const createdBy = req.user?.login_name ?? req.user?.employeeId ?? req.user?.employee_id

    if (!createdBy) {
      return res.status(401).json({ message: 'Authenticated user is required' })
    }

    const indent = await fetchIndentByIdForUser(req.params.id, createdBy)

    if (!indent) {
      return res.status(404).json({ message: 'Indent not found' })
    }

    return res.json({ data: indent })
  } catch (error) {
    return next(error)
  }
}

export async function listIndentProjectOptions(req, res, next) {
  try {
    const employeeId = String(req.user?.login_name ?? req.user?.employeeId ?? req.user?.employee_id ?? '').trim()
    const requestedRole = normalizeFieldRole(req.query?.role)
    const userRole = normalizeFieldRole(req.user?.role ?? req.user?.primary_role)
    const fieldRole = requestedRole ?? userRole

    if (!employeeId) {
      return res.status(401).json({ message: 'Authenticated user is required' })
    }

    const params = [employeeId.toLowerCase()]
    const clauses = [
      'lower(btrim(rm.employee_id)) = $1',
      "lower(COALESCE(NULLIF(btrim(rm.manual_status), ''), 'active')) <> 'inactive'",
      '(rm.valid_from IS NULL OR rm.valid_from <= CURRENT_DATE)',
      '(rm.valid_to IS NULL OR rm.valid_to >= CURRENT_DATE)',
    ]

    if (fieldRole === 'SIE') {
      clauses.push(`(
        upper(btrim(rm.responsibility)) = 'SIE'
        OR upper(btrim(rm.responsibility)) = 'STE'
        OR upper(btrim(rm.responsibility)) LIKE '%(SIE)%'
        OR upper(btrim(rm.responsibility)) LIKE '%(STE)%'
        OR upper(btrim(rm.responsibility)) LIKE '%SITE ENGINEER%'
        OR upper(btrim(rm.responsibility)) LIKE '%STE ENGINEER%'
        OR upper(btrim(rm.responsibility)) LIKE '%SITE INCHARGE ENGINEER%'
        OR upper(btrim(rm.responsibility)) LIKE '%SITE IN-CHARGE ENGINEER%'
        OR upper(btrim(rm.responsibility)) LIKE '%SITE IN CHARGE ENGINEER%'
      )`)
    } else if (fieldRole === 'SER') {
      clauses.push(`(
        upper(btrim(rm.responsibility)) IN ('SER', 'SRE')
        OR upper(btrim(rm.responsibility)) LIKE '%(SER)%'
        OR upper(btrim(rm.responsibility)) LIKE '%(SRE)%'
        OR upper(btrim(rm.responsibility)) LIKE '%SITE RECEIVING%'
        OR upper(btrim(rm.responsibility)) LIKE '%SERVICE ENGINEER%'
      )`)
    }

    const result = await query(
      `
        SELECT DISTINCT ON (project_code)
          project_code,
          project_description
        FROM (
          SELECT
            COALESCE(NULLIF(pm.project_code, ''), rm.project_id) AS project_code,
            COALESCE(NULLIF(pm.project_description, ''), NULLIF(rm.project_description, ''), rm.project_id) AS project_description
          FROM responsibility_master rm
          LEFT JOIN project_master pm
            ON lower(btrim(pm.project_code)) = lower(btrim(rm.project_id))
          WHERE ${clauses.join('\n            AND ')}
        ) assigned_projects
        WHERE project_code IS NOT NULL
          AND btrim(project_code) <> ''
        ORDER BY project_code ASC, project_description ASC
      `,
      params,
    )

    return res.json({ data: result.rows })
  } catch (error) {
    return next(error)
  }
}

export async function listIndentWarehouseLocationOptions(req, res, next) {
  try {
    const projectCode = String(req.query?.projectCode ?? '').trim()
    const warehouseCode = String(req.query?.warehouseCode ?? '').trim()

    if (!projectCode) {
      return res.status(400).json({ message: 'projectCode is required' })
    }

    const params = [projectCode.toLowerCase()]
    const clauses = [
      'lower(btrim(project_code)) = $1',
      'location_code IS NOT NULL',
      "btrim(location_code) <> ''",
    ]

    if (warehouseCode) {
      params.push(warehouseCode.toLowerCase())
      clauses.push(`lower(btrim(warehouse_code)) = $${params.length}`)
    }

    const result = await query(
      `
        SELECT DISTINCT ON (location_code)
          project_code,
          warehouse_code,
          location_code,
          COALESCE(NULLIF(location_description, ''), location_code) AS description
        FROM warehouse_location_master
        WHERE ${clauses.join('\n          AND ')}
        ORDER BY location_code ASC, location_description ASC
      `,
      params,
    )

    return res.json({ data: result.rows })
  } catch (error) {
    return next(error)
  }
}

export async function listIndentContractorOptions(req, res, next) {
  try {
    const projectCode = String(req.query?.projectCode ?? '').trim()
    const locationCode = String(req.query?.locationCode ?? '').trim()
    const activityCode = String(req.query?.activityCode ?? '').trim()
    const search = String(req.query?.search ?? '').trim()
    const limit = normalizeOptionLimit(req.query?.limit)
    const offset = normalizeOptionOffset(req.query?.offset)

    if (!projectCode) {
      return res.status(400).json({ message: 'projectCode is required' })
    }

    const params = [projectCode.toLowerCase()]
    const clauses = [
      'lower(btrim(project_code)) = $1',
      'business_partner_code IS NOT NULL',
      "btrim(business_partner_code) <> ''",
    ]

    if (locationCode) {
      params.push(locationCode.toLowerCase())
      clauses.push(`lower(btrim(location_code)) = $${params.length}`)
    }

    if (activityCode) {
      params.push(activityCode.toLowerCase())
      clauses.push(`lower(btrim(activity_code)) = $${params.length}`)
    }

    if (search.length >= 2) {
      params.push(`%${search}%`)
      clauses.push(`(
        business_partner_code ILIKE $${params.length}
        OR business_partner_name ILIKE $${params.length}
      )`)
    }

    params.push(limit + 1)
    const limitParam = params.length
    params.push(offset)
    const offsetParam = params.length

    const result = await query(
      `
        SELECT DISTINCT ON (business_partner_code)
          business_partner_code,
          COALESCE(NULLIF(business_partner_name, ''), business_partner_code) AS business_partner_name
        FROM bp_activity_master
        WHERE ${clauses.join('\n          AND ')}
        ORDER BY business_partner_code ASC, business_partner_name ASC
        LIMIT $${limitParam}
        OFFSET $${offsetParam}
      `,
      params,
    )

    const rows = result.rows.slice(0, limit)

    return res.json({
      data: rows,
      hasMore: result.rows.length > limit,
      nextOffset: offset + rows.length,
    })
  } catch (error) {
    return next(error)
  }
}

export async function listIndentOrderOptions(req, res, next) {
  try {
    const projectCode = String(req.query?.projectCode ?? '').trim()
    const search = String(req.query?.search ?? '').trim()
    const limit = normalizeOptionLimit(req.query?.limit)
    const offset = normalizeOptionOffset(req.query?.offset)

    if (!projectCode) {
      return res.status(400).json({ message: 'projectCode is required' })
    }

    const params = [projectCode.toLowerCase()]
    const serviceClauses = [
      'lower(btrim(project_site)) = $1',
      'service_order_no IS NOT NULL',
      "btrim(service_order_no) <> ''",
      "lower(COALESCE(NULLIF(btrim(status), ''), 'released')) = 'released'",
    ]
    const rentalClauses = [
      'lower(btrim(project_code)) = $1',
      'rental_order IS NOT NULL',
      "btrim(rental_order) <> ''",
      "lower(COALESCE(NULLIF(btrim(status), ''), 'released')) = 'released'",
    ]

    if (search.length >= 2) {
      params.push(`%${search}%`)
      serviceClauses.push(`(
        service_order_no ILIKE $${params.length}
        OR COALESCE(item_description, '') ILIKE $${params.length}
        OR COALESCE(description, '') ILIKE $${params.length}
        OR COALESCE(item_code, '') ILIKE $${params.length}
        OR COALESCE(serial_number, '') ILIKE $${params.length}
        OR COALESCE(status, '') ILIKE $${params.length}
      )`)
      rentalClauses.push(`(
        rental_order ILIKE $${params.length}
        OR COALESCE(rental_description, '') ILIKE $${params.length}
        OR COALESCE(item_description, '') ILIKE $${params.length}
        OR COALESCE(item_code, '') ILIKE $${params.length}
        OR COALESCE(status, '') ILIKE $${params.length}
      )`)
    }

    const serviceResult = await query(
      `
        SELECT
          'Service_Order' AS order_type,
          'Service Orders' AS order_group,
          service_order_no AS order_no,
          status,
          item_code,
          COALESCE(NULLIF(item_description, ''), NULLIF(description, ''), item_code) AS item_description,
          serial_number,
          COALESCE(NULLIF(item_description, ''), NULLIF(description, ''), service_order_no) AS description
        FROM service_orders
        WHERE ${serviceClauses.join('\n          AND ')}
        ORDER BY service_order_no ASC
      `,
      params,
    )

    const rentalResult = await query(
      `
        SELECT
          'Rental_Order' AS order_type,
          'Rental Orders' AS order_group,
          rental_order AS order_no,
          status,
          item_code,
          COALESCE(NULLIF(item_description, ''), item_code) AS item_description,
          NULL::text AS serial_number,
          COALESCE(NULLIF(rental_description, ''), NULLIF(item_description, ''), rental_order) AS description
        FROM rental_order_master
        WHERE ${rentalClauses.join('\n          AND ')}
        ORDER BY rental_order ASC
      `,
      params,
    )

    const rows = [...serviceResult.rows, ...rentalResult.rows].sort((left, right) =>
      String(left.order_no).localeCompare(String(right.order_no)),
    )
    const data = rows.slice(offset, offset + limit)

    return res.json({
      data,
      hasMore: offset + data.length < rows.length,
      nextOffset: offset + data.length,
    })
  } catch (error) {
    return next(error)
  }
}

export async function listIndentDeliveryPointOptions(req, res, next) {
  try {
    const projectCode = String(req.query?.projectCode ?? '').trim()
    const addressCode = String(req.query?.addressCode ?? '').trim()
    const search = String(req.query?.search ?? '').trim()
    const limit = normalizeOptionLimit(req.query?.limit)
    const offset = normalizeOptionOffset(req.query?.offset)

    if (!projectCode) {
      return res.status(400).json({ message: 'projectCode is required' })
    }

    const params = [projectCode.toLowerCase()]
    const clauses = [
      'lower(btrim(project_code)) = $1',
      'delivery_point IS NOT NULL',
      "btrim(delivery_point) <> ''",
    ]

    if (addressCode) {
      params.push(addressCode.toLowerCase())
      clauses.push(`lower(btrim(address_code)) = $${params.length}`)
    }

    if (search.length >= 2) {
      params.push(`%${search}%`)
      clauses.push(`(
        address_code ILIKE $${params.length}
        OR address_description ILIKE $${params.length}
        OR delivery_point ILIKE $${params.length}
        OR COALESCE(description_1, '') ILIKE $${params.length}
      )`)
    }

    params.push(limit + 1)
    const limitParam = params.length
    params.push(offset)
    const offsetParam = params.length

    const result = await query(
      `
        SELECT DISTINCT ON (address_code, delivery_point)
          address_code,
          COALESCE(NULLIF(address_description, ''), address_code) AS address_description,
          delivery_point,
          COALESCE(NULLIF(description_1, ''), delivery_point) AS description_1
        FROM delivery_master
        WHERE ${clauses.join('\n          AND ')}
        ORDER BY address_code ASC, delivery_point ASC
        LIMIT $${limitParam}
        OFFSET $${offsetParam}
      `,
      params,
    )

    const rows = result.rows.slice(0, limit)

    return res.json({
      data: rows,
      hasMore: result.rows.length > limit,
      nextOffset: offset + rows.length,
    })
  } catch (error) {
    return next(error)
  }
}

export async function listIndentItemOptions(req, res, next) {
  try {
    const projectCode = String(req.query?.projectCode ?? '').trim()
    const warehouseCode = String(req.query?.warehouseCode ?? '').trim()
    const search = String(req.query?.search ?? '').trim()
    const scope = String(req.query?.scope ?? '').trim().toLowerCase()
    const limit = normalizeOptionLimit(req.query?.limit)
    const offset = normalizeOptionOffset(req.query?.offset)

    if (!projectCode && scope !== 'all') {
      return res.status(400).json({ message: 'projectCode is required' })
    }

    const params = []
    const clauses = [
      'item_code IS NOT NULL',
      "btrim(item_code) <> ''",
    ]

    if (scope !== 'all') {
      params.push(projectCode.toLowerCase())
      clauses.push(`lower(btrim(COALESCE(project_site, ''))) = $${params.length}`)
    }

    if (warehouseCode && scope !== 'all') {
      params.push(warehouseCode.toLowerCase())
      clauses.push(`
        (
          warehouse_code IS NULL
          OR btrim(warehouse_code) = ''
          OR lower(btrim(warehouse_code)) = $${params.length}
        )
      `)
    }

    if (search.length >= 2) {
      params.push(`%${search}%`)
      clauses.push(`(
        item_code ILIKE $${params.length}
        OR item_description ILIKE $${params.length}
        OR COALESCE(item_type, '') ILIKE $${params.length}
        OR CONCAT(COALESCE(item_type, ''), ' - ', item_description) ILIKE $${params.length}
        OR CONCAT(item_code, ' - ', COALESCE(item_type, ''), ' - ', item_description) ILIKE $${params.length}
      )`)
    }

    params.push(limit + 1)
    const limitParam = params.length
    params.push(offset)
    const offsetParam = params.length

    const result = await query(
      `
        SELECT DISTINCT ON (item_code)
          item_code,
          COALESCE(NULLIF(item_description, ''), item_code) AS item_description,
          COALESCE(NULLIF(purchase_unit, ''), 'NOS') AS purchase_unit,
          COALESCE(NULLIF(purchase_unit, ''), 'NOS') AS uom,
          COALESCE(NULLIF(item_type, ''), 'Product') AS item_type,
          COALESCE(on_hand_qty, 0) AS on_hand_qty,
          COALESCE(NULLIF(project_site, ''), '') AS project_site,
          COALESCE(NULLIF(site_description, ''), '') AS site_description,
          COALESCE(NULLIF(warehouse_code, ''), '') AS warehouse_code,
          COALESCE(NULLIF(warehouse_description, ''), '') AS warehouse_description
        FROM item_master
        WHERE ${clauses.join('\n          AND ')}
        ORDER BY item_code ASC, warehouse_code NULLS LAST
        LIMIT $${limitParam}
        OFFSET $${offsetParam}
      `,
      params,
    )

    const rows = result.rows.slice(0, limit)
    const hasMore = result.rows.length > limit

    return res.json({
      data: rows,
      hasMore,
      nextOffset: offset + rows.length,
    })
  } catch (error) {
    return next(error)
  }
}

export async function listIndentActivityOptions(req, res, next) {
  try {
    const projectCode = String(req.query?.projectCode ?? '').trim()
    const search = String(req.query?.search ?? '').trim()
    const limit = normalizeOptionLimit(req.query?.limit)
    const offset = normalizeOptionOffset(req.query?.offset)

    if (!projectCode) {
      return res.status(400).json({ message: 'projectCode is required' })
    }

    const params = [projectCode.toLowerCase()]
    const clauses = [
      "lower(btrim(project_code)) = $1",
      'activity_code IS NOT NULL',
      "btrim(activity_code) <> ''",
    ]

    if (search.length >= 2) {
      params.push(`%${search}%`)
      clauses.push(`(
        activity_code ILIKE $${params.length}
        OR description ILIKE $${params.length}
      )`)
    }

    params.push(limit + 1)
    const limitParam = params.length
    params.push(offset)
    const offsetParam = params.length

    const result = await query(
      `
        SELECT
          project_code,
          activity_code,
          COALESCE(NULLIF(description, ''), activity_code) AS description,
          COALESCE(NULLIF(activity_type, ''), '') AS activity_type,
          COALESCE(NULLIF(critical_capacity_type, ''), '') AS critical_capacity_type,
          COALESCE(NULLIF(work_auth_status, ''), 'Released') AS work_auth_status
        FROM activity_master
        WHERE ${clauses.join('\n          AND ')}
        ORDER BY activity_code ASC, description ASC
        LIMIT $${limitParam}
        OFFSET $${offsetParam}
      `,
      params,
    )

    const rows = result.rows.slice(0, limit)
    const hasMore = result.rows.length > limit

    return res.json({
      data: rows,
      hasMore,
      nextOffset: offset + rows.length,
    })
  } catch (error) {
    return next(error)
  }
}

export async function createIndent(req, res, next) {
  const client = await pool.connect()

  try {
    const createdBy = req.user?.login_name

    if (!createdBy) {
      return res.status(401).json({ message: 'Authenticated user is required' })
    }

    const indentValues = normalizeIndentPayload(req.validated.body)
    assertUniqueIndentItems(indentValues)

    await client.query('BEGIN')
    await client.query('LOCK TABLE indent_headers IN EXCLUSIVE MODE')

    if (indentValues.source === 'mobile') {
      await ensureMobileIndentReferences(client, indentValues)
    }

    if (indentValues.app_request_id) {
      const existingResult = await client.query(
        `
          SELECT id, indent_no
          FROM indent_headers
          WHERE app_request_id = $1
          LIMIT 1
        `,
        [indentValues.app_request_id],
      )

      if (existingResult.rows[0]) {
        await client.query('COMMIT')
        const existingIndent = await fetchIndentById(existingResult.rows[0].id)

        return res.status(200).json({
          message: `Indent ${existingResult.rows[0].indent_no} already synced`,
          app_request_id: indentValues.app_request_id,
          indent_no: existingResult.rows[0].indent_no,
          data: existingIndent,
        })
      }
    }

    const indentNo = await generateNextIndentNo(client)
    const headerResult = await client.query(
      `
        INSERT INTO indent_headers (
          app_request_id,
          indent_no,
          created_by,
          project_code,
          source_warehouse,
          source_location,
          delivery_location,
          requirement_type,
          indent_type,
          to_entity_type,
          to_entity_id,
          status,
          synced_at,
          remarks,
          attachments
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, $13, $14::jsonb)
        RETURNING id
      `,
      [
        indentValues.app_request_id,
        indentNo,
        createdBy,
        indentValues.project_code,
        indentValues.source_warehouse,
        indentValues.source_location,
        indentValues.delivery_location,
        indentValues.requirement_type,
        indentValues.indent_type,
        indentValues.to_entity_type,
        indentValues.to_entity_id,
        indentValues.status,
        indentValues.remarks,
        JSON.stringify(indentValues.attachments),
      ],
    )

    const headerId = headerResult.rows[0].id

    for (const [index, item] of indentValues.items.entries()) {
      await client.query(
        `
          INSERT INTO indent_lines (
            indent_header_id,
            line_number,
            item_code,
            item_description,
            make,
            uom,
            required_qty,
            issued_qty,
            work_type,
            activity_code,
            location_code,
            remarks,
            attachment_url
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `,
        [
          headerId,
          index + 1,
          item.item_code,
          item.item_description,
          item.make,
          item.uom,
          item.required_qty,
          item.issued_qty,
          item.work_type,
          item.activity_code,
          item.location_code,
          item.remarks,
          item.attachment_url,
        ],
      )
    }

    await notifyIndentReviewRecipients(client, {
      createdBy,
      headerId,
      indentNo,
      requestTitle: indentValues.app_request_id || indentNo,
    })

    await insertLegacyIndent(client, {
      ...indentValues,
      indent_no: indentNo,
      created_by: createdBy,
      first_item: indentValues.items[0],
    })

    await client.query('COMMIT')

    const indent = await fetchIndentById(headerId)

    return res.status(201).json({
      message: `Indent ${indentNo} submitted successfully`,
      app_request_id: indentValues.app_request_id,
      indent_no: indentNo,
      data: indent,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    return handleIndentError(error, res, next)
  } finally {
    client.release()
  }
}

function normalizeOptionLimit(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return 50
  return Math.min(parsed, 500)
}

function normalizeOptionOffset(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return parsed
}

function normalizeFieldRole(role) {
  const normalizedRole = String(role ?? '').trim().toUpperCase()

  if (
    normalizedRole === 'SIE' ||
    normalizedRole === 'STE' ||
    normalizedRole.includes('(SIE)') ||
    normalizedRole.includes('(STE)') ||
    normalizedRole.includes('SITE ENGINEER')
    || normalizedRole.includes('STE ENGINEER')
    || normalizedRole.includes('SITE INCHARGE ENGINEER')
    || normalizedRole.includes('SITE IN-CHARGE ENGINEER')
    || normalizedRole.includes('SITE IN CHARGE ENGINEER')
  ) {
    return 'SIE'
  }

  if (
    normalizedRole === 'SRE' ||
    normalizedRole === 'SER' ||
    normalizedRole.includes('(SRE)') ||
    normalizedRole.includes('(SER)') ||
    normalizedRole.includes('SITE RECEIVING') ||
    normalizedRole.includes('SERVICE ENGINEER')
  ) {
    return 'SER'
  }

  return null
}

export async function updateIndentStatus(req, res, next) {
  const client = await pool.connect()

  try {
    const { id } = req.validated.params
    const { status } = req.validated.body

    await client.query('BEGIN')

    const result = await client.query(
      `
        UPDATE indent_headers
        SET status = $2::varchar,
            approved_by = $3,
            approved_at = CASE WHEN $2::text = 'Approved' THEN COALESCE(approved_at, CURRENT_TIMESTAMP) ELSE approved_at END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, indent_no, created_by
      `,
      [id, status, req.user?.login_name ?? null],
    )

    if (!result.rows[0]) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Indent not found' })
    }

    await client.query(
      `
        UPDATE indents
        SET status = CASE
              WHEN $2::text IN ('Pending', 'Approved', 'Rejected', 'Issued') THEN ($2::text)::indent_status
              WHEN $2::text IN ('Issue', 'PartiallyIssued', 'Completed') THEN 'Issued'::indent_status
              ELSE status
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE indent_no = $1
      `,
      [result.rows[0].indent_no, status],
    )

    await notifyIndentRequester(client, {
      actorLogin: req.user?.login_name,
      indentId: result.rows[0].id,
      indentNo: result.rows[0].indent_no,
      recipientLogin: result.rows[0].created_by,
      status,
    })

    await client.query('COMMIT')

    const indent = await fetchIndentById(id)

    return res.json({
      message: 'Indent status updated successfully',
      data: indent,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    return handleIndentError(error, res, next)
  } finally {
    client.release()
  }
}

export async function deleteIndent(req, res, next) {
  const client = await pool.connect()

  try {
    const { id } = req.validated.params

    await client.query('BEGIN')

    const result = await client.query(
      `
        DELETE FROM indent_headers
        WHERE id = $1
        RETURNING id, indent_no
      `,
      [id],
    )

    if (!result.rows[0]) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Indent not found' })
    }

    await client.query('DELETE FROM indents WHERE indent_no = $1', [result.rows[0].indent_no])
    await client.query('COMMIT')

    return res.json({
      message: 'Indent deleted successfully',
      data: result.rows[0],
    })
  } catch (error) {
    await client.query('ROLLBACK')
    return next(error)
  } finally {
    client.release()
  }
}

async function generateNextIndentNo(client) {
  const year = new Date().getFullYear()
  const prefix = `IND-${year}-`
  const result = await client.query(
    `
      SELECT indent_no
      FROM indent_headers
      WHERE indent_no LIKE $1
      ORDER BY indent_no DESC
      LIMIT 1
    `,
    [`${prefix}%`],
  )

  const latestIndentNo = result.rows[0]?.indent_no
  const latestSequence = latestIndentNo ? Number.parseInt(latestIndentNo.slice(prefix.length), 10) : 0
  const nextSequence = Number.isFinite(latestSequence) ? latestSequence + 1 : 1

  return `${prefix}${String(nextSequence).padStart(4, '0')}`
}

function normalizeIndentPayload(body) {
  if ('project_code' in body && Array.isArray(body.items)) {
    const attachments = body.items
      .map((item) => item.attachmentUrl)
      .filter(Boolean)

    return {
      source: 'mobile',
      app_request_id: body.app_request_id,
      project_code: body.project_code,
      source_warehouse: body.source_warehouse ?? null,
      source_location: body.source_location ?? body.source_warehouse ?? null,
      delivery_location: body.delivery_location,
      requirement_type: body.requirement_type,
      indent_type: body.indent_type ?? body.requirement_type ?? 'Issue',
      to_entity_type: inferDestinationType(body),
      to_entity_id: body.to_entity_id || body.orderNo || body.equipmentDisplay || null,
      status: normalizeIncomingStatus(body.status),
      remarks: body.app_request_id,
      attachments,
      items: body.items.map((item) => ({
        item_code: item.item_code || item.materialCode,
        item_description: item.materialDesc || item.item_code || item.materialCode,
        make: item.make || body.equipmentDisplay || null,
        required_qty: item.required_qty ?? item.requestedQty,
        issued_qty: item.issuedQty ?? 0,
        uom: normalizeLineUom(item.uom),
        work_type: item.workType ?? null,
        activity_code: item.activityId ?? null,
        location_code: item.locationId ?? body.delivery_location ?? null,
        to_entity_id: item.to_entity_id || item.toBusinessPartner || null,
        remarks: item.remarks ?? null,
        attachment_url: item.attachmentUrl ?? null,
      })),
    }
  }

  if ('project_code' in body) {
    return {
      source: 'admin',
      app_request_id: body.app_request_id ?? null,
      project_code: body.project_code,
      source_warehouse: body.source_warehouse ?? null,
      source_location: body.source_location ?? null,
      delivery_location: body.delivery_location,
      requirement_type: body.requirement_type,
      indent_type: body.indent_type ?? 'Issue',
      to_entity_type: body.to_entity_type ?? null,
      to_entity_id: body.to_entity_id ?? null,
      status: 'Pending',
      remarks: body.remarks ?? null,
      attachments: [],
      items: [{
        item_code: body.item_code,
        item_description: body.item_description ?? null,
        make: body.make ?? null,
        required_qty: body.required_qty,
        issued_qty: body.issued_qty ?? 0,
        uom: body.uom,
        work_type: body.work_type ?? null,
        activity_code: body.activity_code ?? null,
        location_code: body.delivery_location,
        remarks: body.remarks ?? null,
        attachment_url: null,
      }],
    }
  }

  const firstItem = body.items[0]
  const attachments = body.items
    .map((item) => item.attachmentUrl)
    .filter(Boolean)

  return {
    source: 'mobile',
    app_request_id: body.requestNo ?? null,
    project_code: body.projectId,
    source_warehouse: body.warehouseId ?? null,
    source_location: body.warehouseId ?? null,
    delivery_location: firstItem.locationId || body.warehouseId || body.projectId,
    requirement_type: body.indentType || firstItem.workType || body.engineerType || 'General',
    indent_type: body.indentType || 'Issue',
    to_entity_type: inferDestinationType(body),
    to_entity_id: body.orderNo || body.equipmentDisplay || null,
    status: normalizeIncomingStatus(body.status),
    remarks: body.requestNo ?? null,
    attachments,
    items: body.items.map((item) => ({
      item_code: item.materialCode,
      item_description: item.materialDesc || item.materialCode,
      make: body.equipmentDisplay || null,
      required_qty: item.requestedQty,
      issued_qty: item.issuedQty ?? 0,
      uom: normalizeLineUom(item.uom),
      work_type: item.workType ?? null,
      activity_code: item.activityId ?? null,
      location_code: item.locationId ?? null,
      remarks: item.remarks ?? null,
      attachment_url: item.attachmentUrl ?? null,
    })),
  }
}

function assertUniqueIndentItems(indentValues) {
  const seenItems = new Map()
  const projectCode = normalizeDuplicateKey(indentValues.project_code)

  for (const item of indentValues.items) {
    const itemCode = normalizeDuplicateKey(item.item_code)
    const locationCode = normalizeDuplicateKey(item.location_code)
    const activityCode = normalizeDuplicateKey(item.activity_code)
    const businessPartner = normalizeDuplicateKey(item.to_entity_id || indentValues.to_entity_id)
    const duplicateKey = [projectCode, itemCode, locationCode, activityCode, businessPartner].join('|')

    if (seenItems.has(duplicateKey)) {
      const error = new Error(`Material ${item.item_code} is already there for the same project, location, activity, and business partner.`)
      error.statusCode = 400
      throw error
    }

    seenItems.set(duplicateKey, true)
  }
}

function normalizeDuplicateKey(value) {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeLineUom(value) {
  const normalizedValue = String(value ?? '').trim()
  return normalizedValue || 'NOS'
}

function inferDestinationType(body) {
  if (body.orderType) return body.orderType
  if (body.equipmentDisplay) return 'Equipment'
  return body.engineerType === 'SER' ? 'Service_Order' : 'Project_Location'
}

function normalizeIncomingStatus(status) {
  if (!status) return 'Created'
  if (status === 'PendingApproval') return 'Pending'
  return status
}

async function notifyIndentReviewRecipients(client, { createdBy, headerId, indentNo, requestTitle }) {
  const recipients = await resolveIndentReviewRecipients(client, createdBy)

  await createIndentNotifications(client, recipients, {
    indentHeaderId: headerId,
    indentNo,
    title: 'New indent request',
    message: `${requestTitle} is waiting for approval.`,
    status: 'Pending',
    targetPath: `/transactions/${headerId}`,
  })
}

async function notifyIndentRequester(client, { actorLogin, indentId, indentNo, recipientLogin, status }) {
  if (!recipientLogin || recipientLogin === actorLogin) {
    return
  }

  const normalizedStatus = normalizeIndentStatusForNotification(status)
  await createIndentNotifications(client, [recipientLogin], {
    indentHeaderId: indentId,
    indentNo,
    title: `Indent ${normalizedStatus}`,
    message: `${indentNo} has been ${normalizedStatus.toLowerCase()}.`,
    status: normalizedStatus,
    targetPath: `/indent-workspace/indents/${indentId}`,
  })
}

async function resolveIndentReviewRecipients(client, createdBy) {
  const result = await client.query(
    `
      SELECT DISTINCT login_name
      FROM (
        SELECT u.login_name
        FROM users u
        WHERE COALESCE(u.is_deleted, FALSE) = FALSE
          AND COALESCE(u.is_active, TRUE) = TRUE
          AND (
            upper(btrim(COALESCE(u.primary_role, ''))) IN ('SUPER ADMIN', 'ADMINISTRATOR', 'ADMIN')
            OR upper(btrim(COALESCE(u.primary_role, ''))) LIKE '%SUPER ADMIN%'
          )

        UNION

        SELECT rm.employee_id AS login_name
        FROM responsibility_master rm
        LEFT JOIN users u ON u.login_name = rm.employee_id
        WHERE lower(COALESCE(NULLIF(btrim(rm.manual_status), ''), 'active')) <> 'inactive'
          AND (rm.valid_from IS NULL OR rm.valid_from <= CURRENT_DATE)
          AND (rm.valid_to IS NULL OR rm.valid_to >= CURRENT_DATE)
          AND COALESCE(u.is_deleted, FALSE) = FALSE
          AND COALESCE(u.is_active, TRUE) = TRUE
          AND (
            upper(btrim(COALESCE(rm.responsibility, ''))) IN ('SUPER ADMIN', 'ADMINISTRATOR', 'ADMIN')
            OR upper(btrim(COALESCE(rm.responsibility, ''))) LIKE '%SUPER ADMIN%'
          )
      ) admins
      WHERE login_name IS NOT NULL
        AND btrim(login_name) <> ''
    `,
  )

  return [...new Set(result.rows
    .map((row) => row.login_name)
    .filter((recipient) => recipient && recipient !== createdBy))]
}

async function createIndentNotifications(client, recipients, { indentHeaderId, indentNo, title, message, status, targetPath }) {
  const uniqueRecipients = [...new Set(recipients)].filter(Boolean)

  for (const recipient of uniqueRecipients) {
    await client.query(
      `
        INSERT INTO notifications (
          recipient_login,
          indent_header_id,
          indent_no,
          title,
          message,
          status,
          target_path
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING
      `,
      [recipient, indentHeaderId, indentNo, title, message, status, targetPath],
    )
  }
}

function normalizeIndentStatusForNotification(status) {
  const normalized = String(status ?? '').trim()
  if (normalized === 'Issue') {
    return 'Issued'
  }
  return normalized || 'Updated'
}

async function ensureMobileIndentReferences(client, indentValues) {
  await client.query(
    `
      INSERT INTO project_master (
        project_code,
        project_description,
        dpr_engineer_control,
        multi_location_activity,
        project_location_linked_activities
      )
      VALUES ($1, $2, 'LOCATION', 'NO', 'NO')
      ON CONFLICT (project_code) DO NOTHING
    `,
    [indentValues.project_code, indentValues.project_code],
  )

  await client.query(
    `
      INSERT INTO delivery_master (
        address_code,
        address_description,
        project_code,
        project_description,
        delivery_point,
        description_1
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (project_code, address_code, delivery_point) DO NOTHING
    `,
    [
      indentValues.delivery_location,
      indentValues.delivery_location,
      indentValues.project_code,
      indentValues.project_code,
      indentValues.delivery_location,
      indentValues.delivery_location,
    ],
  )

  for (const item of indentValues.items) {
    await client.query(
      `
        INSERT INTO item_master (
          project_site,
          site_description,
          warehouse_code,
          warehouse_description,
          on_hand_qty,
          item_code,
          item_description,
          purchase_unit,
          item_type
        )
        VALUES ($1, $2, NULL, NULL, 0, $3, $4, $5, 'Product')
        ON CONFLICT (project_site, warehouse_code, item_code) DO NOTHING
      `,
      [
        indentValues.project_code,
        indentValues.project_code,
        item.item_code,
        item.item_description,
        item.uom,
      ],
    )
  }
}

async function insertLegacyIndent(client, indentValues) {
  await client.query(
    `
      INSERT INTO indents (
        indent_no,
        created_by,
        project_code,
        delivery_location,
        requirement_type,
        item_code,
        make,
        required_qty,
        uom,
        remarks,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::indent_status)
      ON CONFLICT (indent_no) DO NOTHING
    `,
    [
      indentValues.indent_no,
      indentValues.created_by,
      indentValues.project_code,
      indentValues.delivery_location,
      indentValues.requirement_type,
      indentValues.first_item.item_code,
      indentValues.first_item.make,
      indentValues.first_item.required_qty,
      indentValues.first_item.uom,
      indentValues.first_item.remarks ?? indentValues.remarks,
      toLegacyStatus(indentValues.status),
    ],
  )
}

function toLegacyStatus(status) {
  if (['Pending', 'Approved', 'Rejected', 'Issued'].includes(status)) return status
  if (['Issue', 'PartiallyIssued', 'Completed'].includes(status)) return 'Issued'
  return 'Pending'
}

async function fetchIndentById(id) {
  const result = await query(
    `
      ${INDENT_SELECT_SQL}
      WHERE h.id = $1
      LIMIT 1
    `,
    [id],
  )

  return result.rows[0]
}

async function fetchIndentByIdForUser(id, createdBy) {
  const result = await query(
    `
      ${INDENT_SELECT_SQL}
      WHERE h.id = $1
        AND h.created_by = $2
      LIMIT 1
    `,
    [id, createdBy],
  )

  return result.rows[0]
}

function handleIndentError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message })
  }

  if (error.code === '23505') {
    return res.status(409).json({ message: 'An indent with this number already exists' })
  }

  if (error.code === '23503') {
    return res.status(400).json({
      message: 'User, project, delivery location, or item was not found',
    })
  }

  return next(error)
}
