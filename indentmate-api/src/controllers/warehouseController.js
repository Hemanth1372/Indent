import { query } from '../db/pool.js'

export async function listWarehouseOptions(req, res, next) {
  try {
    const projectCodes = normalizeProjectCodes(req.query?.projectCode)

    if (!projectCodes.length) {
      return res.status(400).json({ message: 'projectCode is required' })
    }

    const result = await query(
      `
        SELECT
          warehouse_code,
          warehouse_description,
          project_site,
          is_material_warehouse,
          is_virtual_warehouse
        FROM warehouse_master
        WHERE project_site = ANY($1)
          AND (
            LOWER(COALESCE(is_material_warehouse, '')) = 'yes'
            OR LOWER(COALESCE(is_virtual_warehouse, '')) = 'yes'
          )
        ORDER BY warehouse_code ASC
      `,
      [projectCodes],
    )

    return res.json({ data: result.rows })
  } catch (error) {
    return next(error)
  }
}

function normalizeProjectCodes(value) {
  const values = Array.isArray(value) ? value : [value]

  return [...new Set(
    values
      .flatMap((entry) => String(entry ?? '').split(','))
      .map((entry) => entry.trim())
      .filter(Boolean),
  )]
}
