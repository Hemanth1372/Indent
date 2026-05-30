import { query } from '../db/pool.js'

const PROJECTS_SELECT_SQL = `
  SELECT project_id, project_name, location, status
  FROM projects
  ORDER BY project_name ASC
`

export async function listProjects(_req, res, next) {
  try {
    const result = await query(PROJECTS_SELECT_SQL)
    return res.json({ data: result.rows })
  } catch (error) {
    return next(error)
  }
}
