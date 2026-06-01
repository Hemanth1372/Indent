import { pool, query } from '../db/pool.js'

const INDENT_SELECT_SQL = `
  SELECT
    i.id,
    i.indent_no,
    i.created_by,
    u.employee_name AS created_by_name,
    i.project_code,
    p.project_name,
    i.delivery_location,
    dpm.description AS delivery_location_name,
    i.requirement_type,
    i.item_code,
    im.item_name,
    i.make,
    i.required_qty,
    i.uom,
    i.remarks,
    i.status,
    i.created_at,
    i.updated_at
  FROM indents i
  LEFT JOIN users u ON u.login_name = i.created_by
  LEFT JOIN projects p ON p.site_code = i.project_code
  LEFT JOIN delivery_point_master dpm ON dpm.delivery_point_code = i.delivery_location
  LEFT JOIN item_master im ON im.item_code = i.item_code
`

export async function listIndents(_req, res, next) {
  try {
    const result = await query(`
      ${INDENT_SELECT_SQL}
      ORDER BY i.created_at DESC, i.indent_no DESC
    `)

    return res.json({ data: result.rows })
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

    const {
      project_code,
      delivery_location,
      requirement_type,
      item_code,
      make = null,
      required_qty,
      uom,
      remarks = null,
    } = req.validated.body

    await client.query('BEGIN')
    await client.query('LOCK TABLE indents IN EXCLUSIVE MODE')

    const indentNo = await generateNextIndentNo(client)
    const insertResult = await client.query(
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Pending')
        RETURNING id
      `,
      [
        indentNo,
        createdBy,
        project_code,
        delivery_location,
        requirement_type,
        item_code,
        make,
        required_qty,
        uom,
        remarks,
      ],
    )

    await client.query('COMMIT')

    const indent = await fetchIndentById(insertResult.rows[0].id)

    return res.status(201).json({
      message: `Indent ${indentNo} submitted successfully`,
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
  try {
    const { id } = req.validated.params
    const { status } = req.validated.body

    const result = await query(
      `
        UPDATE indents
        SET status = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id
      `,
      [id, status],
    )

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Indent not found' })
    }

    const indent = await fetchIndentById(id)

    return res.json({
      message: 'Indent status updated successfully',
      data: indent,
    })
  } catch (error) {
    return handleIndentError(error, res, next)
  }
}

export async function deleteIndent(req, res, next) {
  try {
    const { id } = req.validated.params
    const result = await query(
      `
        DELETE FROM indents
        WHERE id = $1
        RETURNING id, indent_no
      `,
      [id],
    )

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Indent not found' })
    }

    return res.json({
      message: 'Indent deleted successfully',
      data: result.rows[0],
    })
  } catch (error) {
    return next(error)
  }
}

async function generateNextIndentNo(client) {
  const year = new Date().getFullYear()
  const prefix = `IND-${year}-`
  const result = await client.query(
    `
      SELECT indent_no
      FROM indents
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

async function fetchIndentById(id) {
  const result = await query(
    `
      ${INDENT_SELECT_SQL}
      WHERE i.id = $1
      LIMIT 1
    `,
    [id],
  )

  return result.rows[0]
}

function handleIndentError(error, res, next) {
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
