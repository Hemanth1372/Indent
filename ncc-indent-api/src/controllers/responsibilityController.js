import { query } from '../db/pool.js'

const RESPONSIBILITY_SELECT_SQL = `
  SELECT
    r.id,
    r.project_code,
    p.project_name AS project_description,
    r.responsibility_code,
    r.description,
    r.valid_to,
    r.end_date,
    r.created_at,
    r.updated_at
  FROM responsibility_master r
  LEFT JOIN projects p ON p.site_code = r.project_code
`

export async function listResponsibilities(_req, res, next) {
  try {
    const result = await query(`
      ${RESPONSIBILITY_SELECT_SQL}
      ORDER BY r.created_at DESC, r.project_code ASC, r.responsibility_code ASC
    `)

    return res.json({ data: result.rows })
  } catch (error) {
    return next(error)
  }
}

export async function listResponsibilityOptions(_req, res, next) {
  try {
    const result = await query(`
      SELECT site_code AS project_code, project_name AS project_description
      FROM projects
      WHERE site_code IS NOT NULL AND site_code <> ''
      ORDER BY site_code ASC
    `)

    return res.json({ projects: result.rows })
  } catch (error) {
    return next(error)
  }
}

export async function createResponsibility(req, res, next) {
  try {
    const {
      project_code,
      responsibility_code,
      description,
      valid_to,
      end_date,
    } = req.validated.body

    const result = await query(
      `
        INSERT INTO responsibility_master (
          project_code,
          responsibility_code,
          description,
          valid_to,
          end_date
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [project_code, responsibility_code, description, valid_to, end_date],
    )

    const responsibility = await fetchResponsibilityById(result.rows[0].id)

    return res.status(201).json({
      message: 'Responsibility created successfully',
      data: responsibility,
    })
  } catch (error) {
    return handleResponsibilityError(error, res, next)
  }
}

export async function updateResponsibility(req, res, next) {
  try {
    const { id } = req.validated.params
    const allowedFields = [
      'project_code',
      'responsibility_code',
      'description',
      'valid_to',
      'end_date',
    ]
    const updates = Object.entries(req.validated.body).filter(([key]) => allowedFields.includes(key))
    const assignments = updates.map(([key], index) => `${key} = $${index + 2}`)
    const values = updates.map(([, value]) => value)

    const result = await query(
      `
        UPDATE responsibility_master
        SET ${assignments.join(', ')},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id
      `,
      [id, ...values],
    )

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Responsibility not found' })
    }

    const responsibility = await fetchResponsibilityById(id)

    return res.json({
      message: 'Responsibility updated successfully',
      data: responsibility,
    })
  } catch (error) {
    return handleResponsibilityError(error, res, next)
  }
}

export async function deleteResponsibility(req, res, next) {
  try {
    const { id } = req.validated.params
    const result = await query(
      `
        DELETE FROM responsibility_master
        WHERE id = $1
        RETURNING id, responsibility_code
      `,
      [id],
    )

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Responsibility not found' })
    }

    return res.json({
      message: 'Responsibility deleted successfully',
      data: result.rows[0],
    })
  } catch (error) {
    return next(error)
  }
}

async function fetchResponsibilityById(id) {
  const result = await query(
    `
      ${RESPONSIBILITY_SELECT_SQL}
      WHERE r.id = $1
      LIMIT 1
    `,
    [id],
  )

  return result.rows[0]
}

function handleResponsibilityError(error, res, next) {
  if (error.code === '23503') {
    return res.status(400).json({ message: 'Project code was not found' })
  }

  return next(error)
}
