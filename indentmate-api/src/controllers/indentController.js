import { env } from '../config/env.js'
import { pool, query } from '../db/pool.js'
import { sendMail } from '../services/mailService.js'

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
    approved_user.employee_name AS approved_by_name,
    h.approved_at,
    h.approver_email,
    h.approver_name,
    h.attachments,
    h.created_at,
    h.updated_at,
    COALESCE(lines.items, '[]'::json) AS items
  FROM indent_headers h
  LEFT JOIN users u ON u.login_name = h.created_by
  LEFT JOIN users approved_user ON approved_user.login_name = h.approved_by
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

const TEMP_INDENT_APPROVER_EMAIL = 'hemanthguntuku18@gmail.com'

export async function listIndents(req, res, next) {
  try {
    const { whereClause, params } = buildIndentDateFilter(req.query)
    const result = await query(
      `
        ${INDENT_SELECT_SQL}
        ${whereClause}
        ORDER BY h.created_at DESC, h.indent_no DESC
      `,
      params,
    )

    return res.json({ data: result.rows })
  } catch (error) {
    return next(error)
  }
}

export async function listMyIndents(req, res, next) {
  try {
    const createdByValues = normalizeIdentityValues(req.user)

    if (!createdByValues.length) {
      return res.status(401).json({ message: 'Authenticated user is required' })
    }

    const { whereClause, params } = buildMyIndentDateFilter(req.query)
    params.push(createdByValues)
    const ownerClause = `i.created_by = ANY($${params.length}::text[])`
    const scopedWhereClause = whereClause
      ? `${whereClause} AND ${ownerClause}`
      : `WHERE ${ownerClause}`
    const result = await query(
      `
        SELECT
          COALESCE(h.id, i.id) AS id,
          h.app_request_id,
          i.indent_no,
          i.created_by,
          u.employee_name AS created_by_name,
          i.project_code,
          pm.project_description AS project_name,
          h.source_warehouse,
          wm.warehouse_description AS source_warehouse_name,
          h.source_location,
          COALESCE(h.delivery_location, i.delivery_location) AS delivery_location,
          COALESCE(dm.description_1, dm.delivery_point) AS delivery_location_name,
          COALESCE(h.requirement_type, i.requirement_type) AS requirement_type,
          COALESCE(h.indent_type, i.requirement_type, 'Issue') AS indent_type,
          h.to_entity_type,
          h.to_entity_id,
          COALESCE(h.status, i.status::text) AS status,
          h.synced_at,
          h.approved_by,
          approved_user.employee_name AS approved_by_name,
          h.approved_at,
          h.approver_email,
          h.approver_name,
          COALESCE(h.attachments, '[]'::jsonb) AS attachments,
          COALESCE(h.created_at, i.created_at) AS created_at,
          COALESCE(h.updated_at, i.updated_at) AS updated_at,
          COALESCE(lines.items, json_build_array(
            json_build_object(
              'id', i.id,
              'line_number', 1,
              'item_code', i.item_code,
              'item_name', im.item_description,
              'make', i.make,
              'uom', i.uom,
              'required_qty', i.required_qty,
              'issued_qty', 0,
              'work_type', i.requirement_type,
              'activity_code', NULL,
              'location_code', i.delivery_location,
              'remarks', i.remarks,
              'attachment_url', NULL
            )
          )) AS items
        FROM indents i
        LEFT JOIN indent_headers h ON h.indent_no = i.indent_no
        LEFT JOIN users u ON u.login_name = i.created_by
        LEFT JOIN users approved_user ON approved_user.login_name = h.approved_by
        LEFT JOIN project_master pm ON pm.project_code = i.project_code
        LEFT JOIN warehouse_master wm ON wm.warehouse_code = h.source_warehouse
        LEFT JOIN delivery_master dm ON dm.project_code = i.project_code AND dm.delivery_point = COALESCE(h.delivery_location, i.delivery_location)
        LEFT JOIN LATERAL (
          SELECT item_description
          FROM item_master item_lookup
          WHERE item_lookup.project_site = i.project_code
            AND item_lookup.item_code = i.item_code
          ORDER BY item_lookup.id
          LIMIT 1
        ) im ON TRUE
        LEFT JOIN LATERAL (
          SELECT json_agg(
            json_build_object(
              'id', l.id,
              'line_number', l.line_number,
              'item_code', l.item_code,
              'item_name', COALESCE(l.item_description, line_item.item_description),
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
            FROM item_master item_lookup
            WHERE item_lookup.project_site = i.project_code
              AND item_lookup.item_code = l.item_code
            ORDER BY item_lookup.id
            LIMIT 1
          ) line_item ON TRUE
          WHERE l.indent_header_id = h.id
        ) lines ON TRUE
        ${scopedWhereClause}
        ORDER BY COALESCE(h.created_at, i.created_at) DESC, i.indent_no DESC
      `,
      params,
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
    const createdByValues = normalizeIdentityValues(req.user)
    const indent = await fetchIndentByIdentifier(req.params.id)

    if (!indent) {
      return res.status(404).json({ message: 'Indent not found' })
    }

    if (!createdByValues.includes(normalizeIdentityValue(indent.created_by))) {
      return res.status(403).json({ message: 'This indent is not available for the current user' })
    }

    return res.json({ data: indent })
  } catch (error) {
    return next(error)
  }
}

export async function listIndentProjectOptions(req, res, next) {
  try {
    const loginName = req.user?.login_name
    const role = normalizeFieldAssignmentRole(req.query?.role ?? req.user?.role ?? req.user?.primary_role)

    if (!loginName) {
      return res.status(401).json({ message: 'Authenticated user is required' })
    }

    if (!role) {
      return res.json({ data: [] })
    }

    const result = await query(
      `
        SELECT DISTINCT
          assignment.project_id AS project_code,
          COALESCE(pm.project_description, assignment.project_description, assignment.project_id) AS project_description
        FROM user_project_assignment_master assignment
        LEFT JOIN project_master pm ON pm.project_code = assignment.project_id
        WHERE assignment.employee_id = $1
          AND COALESCE(assignment.manual_status, 'Active') = 'Active'
          AND (assignment.valid_from IS NULL OR assignment.valid_from <= CURRENT_DATE)
          AND (assignment.valid_to IS NULL OR assignment.valid_to >= CURRENT_DATE)
          AND (
            ($2 = 'SIE' AND (
              UPPER(TRIM(COALESCE(assignment.responsibility, ''))) = 'SIE'
              OR UPPER(TRIM(COALESCE(assignment.responsibility, ''))) = 'STE'
              OR UPPER(TRIM(COALESCE(assignment.responsibility, ''))) LIKE '%(SIE)%'
              OR UPPER(TRIM(COALESCE(assignment.responsibility, ''))) LIKE '%(STE)%'
              OR UPPER(TRIM(COALESCE(assignment.responsibility, ''))) LIKE '%SITE ENGINEER%'
              OR UPPER(TRIM(COALESCE(assignment.responsibility, ''))) LIKE '%STE ENGINEER%'
              OR UPPER(TRIM(COALESCE(assignment.responsibility, ''))) LIKE '%SITE INCHARGE ENGINEER%'
              OR UPPER(TRIM(COALESCE(assignment.responsibility, ''))) LIKE '%SITE IN-CHARGE ENGINEER%'
              OR UPPER(TRIM(COALESCE(assignment.responsibility, ''))) LIKE '%SITE IN CHARGE ENGINEER%'
            ))
            OR ($2 = 'SER' AND (
              UPPER(TRIM(COALESCE(assignment.responsibility, ''))) IN ('SER', 'SRE')
              OR UPPER(TRIM(COALESCE(assignment.responsibility, ''))) LIKE '%(SER)%'
              OR UPPER(TRIM(COALESCE(assignment.responsibility, ''))) LIKE '%(SRE)%'
              OR UPPER(TRIM(COALESCE(assignment.responsibility, ''))) LIKE '%SITE RECEIVING%'
            ))
          )
        ORDER BY assignment.project_id ASC
      `,
      [loginName, role],
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

    if (!projectCode || !warehouseCode) {
      return res.status(400).json({ message: 'projectCode and warehouseCode are required' })
    }

    const result = await query(
      `
        SELECT
          project_code,
          warehouse_code,
          location_code,
          location_description AS description,
          location_category
        FROM warehouse_location_master
        WHERE project_code = $1
          AND warehouse_code = $2
        ORDER BY location_code ASC
      `,
      [projectCode, warehouseCode],
    )

    return res.json({ data: result.rows })
  } catch (error) {
    return next(error)
  }
}

export async function listIndentItemOptions(req, res, next) {
  try {
    const projectCode = String(req.query?.projectCode ?? '').trim()
    const warehouseCode = String(req.query?.warehouseCode ?? '').trim()
    const search = String(req.query?.search ?? '').trim()
    const limit = normalizeOptionLimit(req.query?.limit)
    const offset = normalizeOptionOffset(req.query?.offset)

    if (!projectCode) {
      return res.status(400).json({ message: 'projectCode is required' })
    }

    const params = [projectCode]
    const filters = ['project_site = $1']

    if (warehouseCode) {
      params.push(warehouseCode)
      filters.push(`(warehouse_code = $${params.length} OR warehouse_code IS NULL)`)
    }

    if (search) {
      params.push(`%${search}%`)
      filters.push(`(item_code ILIKE $${params.length} OR item_description ILIKE $${params.length})`)
    }

    params.push(limit + 1)
    const limitParam = params.length
    params.push(offset)
    const offsetParam = params.length

    const result = await query(
      `
        SELECT
          item_code,
          item_description,
          purchase_unit AS uom,
          warehouse_code,
          warehouse_description,
          on_hand_qty
        FROM item_master
        WHERE ${filters.join(' AND ')}
        ORDER BY item_code ASC
        LIMIT $${limitParam}
        OFFSET $${offsetParam}
      `,
      params,
    )

    return res.json(formatOptionRows(result.rows, limit, offset))
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

    const params = [projectCode]
    const filters = ['project_code = $1']

    if (search) {
      params.push(`%${search}%`)
      filters.push(`(activity_code ILIKE $${params.length} OR description ILIKE $${params.length})`)
    }

    params.push(limit + 1)
    const limitParam = params.length
    params.push(offset)
    const offsetParam = params.length

    const result = await query(
      `
        SELECT
          activity_code,
          description,
          activity_type
        FROM activity_master
        WHERE ${filters.join(' AND ')}
        ORDER BY activity_code ASC
        LIMIT $${limitParam}
        OFFSET $${offsetParam}
      `,
      params,
    )

    return res.json(formatOptionRows(result.rows, limit, offset))
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

    const params = [projectCode]
    const filters = ['project_code = $1']

    if (locationCode) {
      params.push(locationCode)
      filters.push(`location_code = $${params.length}`)
    }

    if (activityCode) {
      params.push(activityCode)
      filters.push(`(activity_code = $${params.length} OR activity_code IS NULL)`)
    }

    if (search) {
      params.push(`%${search}%`)
      filters.push(`(business_partner_code ILIKE $${params.length} OR business_partner_name ILIKE $${params.length})`)
    }

    params.push(limit + 1)
    const limitParam = params.length
    params.push(offset)
    const offsetParam = params.length

    const result = await query(
      `
        SELECT DISTINCT
          business_partner_code,
          business_partner_name
        FROM bp_activity_master
        WHERE ${filters.join(' AND ')}
          AND LOWER(TRIM(COALESCE(business_partner_code, ''))) <> LOWER(TRIM(COALESCE(location_code, '')))
          AND LOWER(TRIM(COALESCE(business_partner_name, ''))) <> LOWER(TRIM(COALESCE(location_description, '')))
        ORDER BY business_partner_code ASC
        LIMIT $${limitParam}
        OFFSET $${offsetParam}
      `,
      params,
    )

    return res.json(formatOptionRows(result.rows, limit, offset))
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

    const params = [projectCode]
    const filters = ['project_code = $1']

    if (addressCode) {
      params.push(addressCode)
      filters.push(`address_code = $${params.length}`)
    }

    if (search) {
      params.push(`%${search}%`)
      filters.push(`(address_code ILIKE $${params.length} OR address_description ILIKE $${params.length} OR delivery_point ILIKE $${params.length} OR description_1 ILIKE $${params.length})`)
    }

    params.push(limit + 1)
    const limitParam = params.length
    params.push(offset)
    const offsetParam = params.length

    const result = await query(
      `
        SELECT DISTINCT
          address_code,
          address_description,
          delivery_point,
          description_1
        FROM delivery_master
        WHERE ${filters.join(' AND ')}
        ORDER BY address_code ASC, delivery_point ASC
        LIMIT $${limitParam}
        OFFSET $${offsetParam}
      `,
      params,
    )

    return res.json(formatOptionRows(result.rows, limit, offset))
  } catch (error) {
    return next(error)
  }
}

export async function listIndentOrderOptions(req, res, next) {
  try {
    const projectCode = String(req.query?.projectCode ?? '').trim()

    if (!projectCode) {
      return res.status(400).json({ message: 'projectCode is required' })
    }

    const serviceOrders = await query(
      `
        SELECT
          service_order_no AS order_no,
          'Service_Order' AS order_type,
          COALESCE(NULLIF(description, ''), item_description, service_order_no) AS description,
          item_code,
          item_description,
          serial_number,
          status
        FROM service_orders
        WHERE project_site = $1
        ORDER BY service_order_no ASC
        LIMIT 300
      `,
      [projectCode],
    )
    const rentalOrders = await query(
      `
        SELECT
          rental_order AS order_no,
          'Rental_Order' AS order_type,
          rental_description AS description,
          item_code,
          item_description,
          NULL AS serial_number,
          status
        FROM rental_order_master
        WHERE project_code = $1
        ORDER BY rental_order ASC
        LIMIT 300
      `,
      [projectCode],
    )

    return res.json({ data: [...serviceOrders.rows, ...rentalOrders.rows] })
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
    const approver = await resolveIndentApprover(indentValues)
    indentValues.approver_email = approver.email
    indentValues.approver_name = approver.name

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
          approver_email,
          approver_name,
          remarks,
          attachments
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, $13, $14, $15, $16::jsonb)
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
        indentValues.approver_email,
        indentValues.approver_name,
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
    let notification = null
    const shouldWaitForEmail = req.validated?.query?.wait_for_email === 'true'

    if (shouldWaitForEmail) {
      notification = await notifyApprover(indent)
    } else {
      notifyApprover(indent)
        .then((result) => {
          if (result?.skipped) {
            console.warn('Indent approver notification skipped', result)
            return
          }

          console.info('Indent approver notification sent', {
            indent_no: indent.indent_no,
            to: indent.approver_email,
            messageId: result?.messageId,
          })
        })
        .catch((error) => {
          console.error('Unable to send indent approver notification', error)
        })
    }

    return res.status(201).json({
      message: `Indent ${indentNo} submitted successfully`,
      app_request_id: indentValues.app_request_id,
      indent_no: indentNo,
      notification,
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

    const existingStatusResult = await client.query(
      `
        SELECT status
        FROM indent_headers
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    )

    if (!existingStatusResult.rows[0]) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Indent not found' })
    }

    if (isFinalIndentStatus(existingStatusResult.rows[0].status)) {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'This request is already finalized and cannot be modified.' })
    }

    const result = await client.query(
      `
        UPDATE indent_headers
        SET status = $2::varchar,
            approved_by = $3,
            approved_at = CASE WHEN $2::text IN ('Approved', 'Rejected', 'Issue', 'Issued') THEN CURRENT_TIMESTAMP ELSE approved_at END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, indent_no
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
      approver_email: pickFirstValue(body.approver_email, body.approverEmail, env.indentApproverEmail),
      approver_name: pickFirstValue(body.approver_name, body.approverName, env.indentApproverName),
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
        activity_code: pickFirstValue(item.activity_code, item.activityId, item.activityCode),
        location_code: pickFirstValue(item.location_code, item.locationId, item.locationCode, body.delivery_location),
        to_entity_id: pickFirstValue(item.to_entity_id, item.toEntityId, item.toBusinessPartner, item.businessPartnerCode),
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
      approver_email: pickFirstValue(body.approver_email, env.indentApproverEmail),
      approver_name: pickFirstValue(body.approver_name, env.indentApproverName),
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
        to_entity_id: body.to_entity_id ?? null,
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
    approver_email: pickFirstValue(body.approver_email, body.approverEmail, env.indentApproverEmail),
    approver_name: pickFirstValue(body.approver_name, body.approverName, env.indentApproverName),
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
      activity_code: pickFirstValue(item.activity_code, item.activityId, item.activityCode),
      location_code: pickFirstValue(item.location_code, item.locationId, item.locationCode),
      to_entity_id: pickFirstValue(item.to_entity_id, item.toEntityId, item.toBusinessPartner, item.businessPartnerCode),
      remarks: item.remarks ?? null,
      attachment_url: item.attachmentUrl ?? null,
    })),
  }
}

function assertUniqueIndentItems(indentValues) {
  const seenItems = new Map()

  for (const item of indentValues.items) {
    const itemCode = normalizeDuplicateKey(item.item_code)
    const locationCode = normalizeDuplicateKey(item.location_code)
    const activityCode = normalizeDuplicateKey(item.activity_code)
    const businessPartner = normalizeDuplicateKey(item.to_entity_id ?? indentValues.to_entity_id)
    const duplicateKey = [itemCode, locationCode, activityCode, businessPartner].join('|')

    if (seenItems.has(duplicateKey)) {
      const error = new Error(`Item already present: ${item.item_code} is already added for the same location, activity, and business partner.`)
      error.statusCode = 400
      throw error
    }

    seenItems.set(duplicateKey, true)
  }
}

function normalizeDuplicateKey(value) {
  const normalizedValue = String(value ?? '').trim()

  if (!normalizedValue || normalizedValue === '-') {
    return ''
  }

  return normalizedValue.toLowerCase()
}

function pickFirstValue(...values) {
  for (const value of values) {
    if (value === undefined || value === null) {
      continue
    }

    const normalizedValue = String(value).trim()

    if (normalizedValue && normalizedValue !== '-') {
      return normalizedValue
    }
  }

  return null
}

function normalizeIdentityValues(user = {}) {
  return [...new Set([
    user.login_name,
    user.employeeId,
    user.employee_id,
    user.user_id,
    user.userId,
  ]
    .map(normalizeIdentityValue)
    .filter(Boolean))]
}

function normalizeIdentityValue(value) {
  return String(value ?? '').trim().toLowerCase()
}

function inferDestinationType(body) {
  if (body.orderType) return body.orderType
  if (body.equipmentDisplay) return 'Equipment'
  return body.engineerType === 'SER' ? 'Service_Order' : 'Project_Location'
}

function normalizeFieldAssignmentRole(role) {
  const normalizedRole = String(role ?? '').trim().toUpperCase()

  if (
    normalizedRole === 'SIE' ||
    normalizedRole === 'STE' ||
    normalizedRole.includes('(SIE)') ||
    normalizedRole.includes('(STE)') ||
    normalizedRole.includes('SITE ENGINEER') ||
    normalizedRole.includes('STE ENGINEER') ||
    normalizedRole.includes('SITE INCHARGE ENGINEER') ||
    normalizedRole.includes('SITE IN-CHARGE ENGINEER') ||
    normalizedRole.includes('SITE IN CHARGE ENGINEER')
  ) {
    return 'SIE'
  }

  if (
    normalizedRole === 'SER' ||
    normalizedRole === 'SRE' ||
    normalizedRole.includes('(SER)') ||
    normalizedRole.includes('(SRE)') ||
    normalizedRole.includes('SITE RECEIVING')
  ) {
    return 'SER'
  }

  return null
}

function normalizeIncomingStatus(status) {
  if (!status) return 'Created'
  if (status === 'PendingApproval') return 'Pending'
  return status
}

function normalizeOptionLimit(value) {
  const parsed = Number.parseInt(String(value ?? '500'), 10)
  if (!Number.isFinite(parsed)) return 500
  return Math.max(1, Math.min(parsed, 500))
}

function normalizeOptionOffset(value) {
  const parsed = Number.parseInt(String(value ?? '0'), 10)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, parsed)
}

function formatOptionRows(rows, limit, offset) {
  const data = rows.slice(0, limit)
  return {
    data,
    hasMore: rows.length > limit,
    nextOffset: offset + data.length,
  }
}

function buildIndentDateFilter(queryParams = {}) {
  const dateFrom = normalizeDateFilter(queryParams.date_from)
  const dateTo = normalizeDateFilter(queryParams.date_to)

  if (dateFrom && dateTo && dateFrom > dateTo) {
    const error = new Error('From date cannot be after To date.')
    error.statusCode = 400
    throw error
  }

  const filters = []
  const params = []

  if (dateFrom) {
    params.push(dateFrom)
    filters.push(`h.created_at >= $${params.length}::date`)
  }

  if (dateTo) {
    params.push(dateTo)
    filters.push(`h.created_at < ($${params.length}::date + INTERVAL '1 day')`)
  }

  return {
    whereClause: filters.length ? `WHERE ${filters.join(' AND ')}` : '',
    params,
  }
}

function buildMyIndentDateFilter(queryParams = {}) {
  const dateFrom = normalizeDateFilter(queryParams.date_from)
  const dateTo = normalizeDateFilter(queryParams.date_to)

  if (dateFrom && dateTo && dateFrom > dateTo) {
    const error = new Error('From date cannot be after To date.')
    error.statusCode = 400
    throw error
  }

  const filters = []
  const params = []

  if (dateFrom) {
    params.push(dateFrom)
    filters.push(`COALESCE(h.created_at, i.created_at) >= $${params.length}::date`)
  }

  if (dateTo) {
    params.push(dateTo)
    filters.push(`COALESCE(h.created_at, i.created_at) < ($${params.length}::date + INTERVAL '1 day')`)
  }

  return {
    whereClause: filters.length ? `WHERE ${filters.join(' AND ')}` : '',
    params,
  }
}

function normalizeDateFilter(value) {
  const candidate = Array.isArray(value) ? value[0] : value
  const normalized = String(candidate ?? '').trim()

  if (!normalized) {
    return ''
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const error = new Error('Date filters must be in YYYY-MM-DD format.')
    error.statusCode = 400
    throw error
  }

  return normalized
}

async function resolveIndentApprover(indentValues) {
  const result = await query(
    `
      SELECT
        u.login_name,
        u.employee_name,
        COALESCE(u.email_id, '') AS email_id,
        assignment.responsibility
      FROM user_project_assignment_master assignment
      LEFT JOIN users u ON u.login_name = assignment.employee_id
      WHERE assignment.project_id = $1
        AND COALESCE(assignment.manual_status, 'Active') = 'Active'
        AND (assignment.valid_from IS NULL OR assignment.valid_from <= CURRENT_DATE)
        AND (assignment.valid_to IS NULL OR assignment.valid_to >= CURRENT_DATE)
        AND (
          UPPER(TRIM(COALESCE(assignment.responsibility, ''))) LIKE '%PROJECT%INCHARGE%'
          OR UPPER(TRIM(COALESCE(assignment.responsibility, ''))) LIKE '%PROJECT%IN-CHARGE%'
          OR UPPER(TRIM(COALESCE(assignment.responsibility, ''))) LIKE '%PROJECT%IN CHARGE%'
          OR UPPER(TRIM(COALESCE(assignment.responsibility, ''))) LIKE '%PROJECT%CHARGE%'
          OR UPPER(TRIM(COALESCE(assignment.responsibility, ''))) LIKE '%INCHARGE%'
          OR UPPER(TRIM(COALESCE(assignment.responsibility, ''))) LIKE '%IN-CHARGE%'
          OR UPPER(TRIM(COALESCE(assignment.responsibility, ''))) LIKE '%IN CHARGE%'
        )
        AND COALESCE(u.is_deleted, FALSE) = FALSE
        AND COALESCE(u.is_active, TRUE) = TRUE
      ORDER BY assignment.id ASC
      LIMIT 1
    `,
    [indentValues.project_code],
  )
  const projectIncharge = result.rows[0]

  return {
    email: TEMP_INDENT_APPROVER_EMAIL,
    name: projectIncharge?.employee_name || pickFirstValue(indentValues.approver_name, env.indentApproverName) || 'Project Incharge',
  }
}

function isFinalIndentStatus(status) {
  return ['APPROVED', 'REJECTED', 'ISSUE', 'ISSUED', 'PARTIALLYISSUED', 'COMPLETED'].includes(String(status ?? '').trim().toUpperCase())
}

async function notifyApprover(indent) {
  const recipientEmail = pickFirstValue(indent.approver_email, env.indentApproverEmail)

  if (!recipientEmail) {
    return
  }

  const appBaseUrl = String(env.appBaseUrl || '').replace(/\/+$/, '')
  const requestUrl = `${appBaseUrl}/transactions/${indent.id}`
  const subject = `Indent approval needed: ${indent.app_request_id || indent.indent_no}`
  const approverName = pickFirstValue(indent.approver_name, env.indentApproverName) || 'Approver'
  const requestTitle = indent.app_request_id || indent.indent_no
  const project = formatEmailPair(indent.project_code, indent.project_name)
  const warehouse = formatEmailPair(indent.source_warehouse, indent.source_warehouse_name)

  return sendMail({
    to: recipientEmail,
    subject,
    text: [
      `Hello ${approverName},`,
      '',
      `A new indent request is waiting for your action: ${requestTitle}.`,
      `Indent: ${indent.indent_no}`,
      `Project: ${project}`,
      `Warehouse: ${warehouse}`,
      `Created by: ${formatEmailPair(indent.created_by, indent.created_by_name)}`,
      '',
      `Open request: ${requestUrl}`,
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
        <p>Hello ${escapeHtml(approverName)},</p>
        <p>A new indent request is waiting for your action.</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 12px 4px 0; font-weight: 700;">Request</td><td>${escapeHtml(requestTitle)}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; font-weight: 700;">Indent</td><td>${escapeHtml(indent.indent_no)}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; font-weight: 700;">Project</td><td>${escapeHtml(project)}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; font-weight: 700;">Warehouse</td><td>${escapeHtml(warehouse)}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; font-weight: 700;">Created by</td><td>${escapeHtml(formatEmailPair(indent.created_by, indent.created_by_name))}</td></tr>
        </table>
        <p>
          <a href="${escapeHtml(requestUrl)}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:700;">
            Open Indent Request
          </a>
        </p>
      </div>
    `,
  })
}

function formatEmailPair(code, description) {
  const cleanCode = String(code ?? '').trim()
  const cleanDescription = String(description ?? '').trim()

  if (cleanCode && cleanDescription) {
    return `${cleanCode} (${cleanDescription})`
  }

  return cleanCode || cleanDescription || '-'
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
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

async function fetchIndentByIdentifier(identifier) {
  if (isUuid(identifier)) {
    const indent = await fetchIndentById(identifier)

    if (indent) {
      return indent
    }
  }

  const headerResult = await query(
    `
      ${INDENT_SELECT_SQL}
      WHERE h.indent_no = $1
         OR h.app_request_id = $1
      LIMIT 1
    `,
    [identifier],
  )

  if (headerResult.rows[0]) {
    return headerResult.rows[0]
  }

  return fetchLegacyIndentByIdentifier(identifier)
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value ?? '').trim())
}

async function fetchLegacyIndentById(id) {
  return fetchLegacyIndentByIdentifier(id)
}

async function fetchLegacyIndentByIdentifier(identifier) {
  const result = await query(
    `
      SELECT
        i.id,
        NULL AS app_request_id,
        i.indent_no,
        i.created_by,
        u.employee_name AS created_by_name,
        i.project_code,
        pm.project_description AS project_name,
        NULL AS source_warehouse,
        NULL AS source_warehouse_name,
        NULL AS source_location,
        i.delivery_location,
        COALESCE(dm.description_1, dm.delivery_point) AS delivery_location_name,
        i.requirement_type,
        i.requirement_type AS indent_type,
        NULL AS to_entity_type,
        NULL AS to_entity_id,
        i.status::text AS status,
        NULL AS synced_at,
        NULL AS approved_by,
        NULL AS approved_by_name,
        NULL AS approved_at,
        NULL AS approver_email,
        NULL AS approver_name,
        '[]'::jsonb AS attachments,
        i.created_at,
        i.updated_at,
        json_build_array(
          json_build_object(
            'id', i.id,
            'line_number', 1,
            'item_code', i.item_code,
            'item_name', im.item_description,
            'make', i.make,
            'uom', i.uom,
            'required_qty', i.required_qty,
            'issued_qty', 0,
            'work_type', i.requirement_type,
            'activity_code', NULL,
            'location_code', i.delivery_location,
            'remarks', i.remarks,
            'attachment_url', NULL
          )
        ) AS items
      FROM indents i
      LEFT JOIN users u ON u.login_name = i.created_by
      LEFT JOIN project_master pm ON pm.project_code = i.project_code
      LEFT JOIN delivery_master dm ON dm.project_code = i.project_code AND dm.delivery_point = i.delivery_location
      LEFT JOIN LATERAL (
        SELECT item_description
        FROM item_master item_lookup
        WHERE item_lookup.project_site = i.project_code
          AND item_lookup.item_code = i.item_code
        ORDER BY item_lookup.id
        LIMIT 1
      ) im ON TRUE
      WHERE i.id::text = $1
         OR i.indent_no = $1
      LIMIT 1
    `,
    [String(identifier ?? '').trim()],
  )

  return result.rows[0]
}

function handleIndentError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message })
  }

  if (error.code === '23505') {
    if (error.constraint === 'idx_indent_lines_unique_item_context') {
      return res.status(400).json({
        message: 'Item already present for the same location and activity in this request.',
      })
    }

    return res.status(409).json({ message: 'An indent with this number already exists' })
  }

  if (error.code === '23503') {
    return res.status(400).json({
      message: 'User, project, delivery location, or item was not found',
    })
  }

  return next(error)
}
