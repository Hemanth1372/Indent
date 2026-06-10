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
    LEFT JOIN item_master im ON im.project_site = h.project_code AND im.item_code = l.item_code
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
    LEFT JOIN item_master im ON im.project_site = h.project_code AND im.item_code = l.item_code
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
            approved_at = CASE WHEN $2::text = 'Approved' THEN COALESCE(approved_at, CURRENT_TIMESTAMP) ELSE approved_at END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, indent_no
      `,
      [id, status],
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
      to_entity_id: body.orderNo || body.equipmentDisplay || null,
      status: normalizeIncomingStatus(body.status),
      remarks: body.app_request_id,
      attachments,
      items: body.items.map((item) => ({
        item_code: item.item_code || item.materialCode,
        item_description: item.materialDesc || item.item_code || item.materialCode,
        make: item.make || body.equipmentDisplay || null,
        required_qty: item.required_qty ?? item.requestedQty,
        issued_qty: item.issuedQty ?? 0,
        uom: item.uom,
        work_type: item.workType ?? null,
        activity_code: item.activityId ?? null,
        location_code: item.locationId ?? body.delivery_location ?? null,
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
      uom: item.uom,
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
  const businessPartner = normalizeDuplicateKey(indentValues.to_entity_id)

  for (const item of indentValues.items) {
    const itemCode = normalizeDuplicateKey(item.item_code)
    const locationCode = normalizeDuplicateKey(item.location_code)
    const activityCode = normalizeDuplicateKey(item.activity_code)
    const duplicateKey = [itemCode, locationCode, activityCode, businessPartner].join('|')

    if (seenItems.has(duplicateKey)) {
      const error = new Error(`Material ${item.item_code} is already there for the same location, activity, and business partner.`)
      error.statusCode = 400
      throw error
    }

    seenItems.set(duplicateKey, true)
  }
}

function normalizeDuplicateKey(value) {
  return String(value ?? '').trim().toLowerCase()
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
