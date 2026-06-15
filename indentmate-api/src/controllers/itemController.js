import { query } from '../db/pool.js'

export async function listItemOptions(req, res, next) {
  try {
    const projectSites = normalizeQueryValues(req.query?.projectSite)
    const warehouseCodes = normalizeQueryValues(req.query?.warehouseCode)

    if (!projectSites.length) {
      return res.status(400).json({ message: 'projectSite is required' })
    }

    const params = [projectSites.map((site) => site.toLowerCase())]
    const warehouseClause = warehouseCodes.length
      ? `
          AND (
            warehouse_code IS NULL
            OR btrim(warehouse_code) = ''
            OR lower(btrim(warehouse_code)) = ANY($2)
          )
        `
      : ''

    if (warehouseCodes.length) {
      params.push(warehouseCodes.map((code) => code.toLowerCase()))
    }

    const result = await query(
      `
        SELECT DISTINCT ON (item_code)
          item_code,
          COALESCE(NULLIF(item_description, ''), NULLIF(item_name, ''), NULLIF(description, ''), item_code) AS item_description,
          COALESCE(NULLIF(purchase_unit, ''), 'NOS') AS purchase_unit,
          COALESCE(NULLIF(item_type, ''), 'Product') AS item_type,
          COALESCE(NULLIF(item_group, ''), '') AS item_group,
          COALESCE(on_hand_qty, 0) AS on_hand_qty,
          COALESCE(NULLIF(project_site, ''), NULLIF(site_code, '')) AS project_site,
          COALESCE(NULLIF(site_description, ''), NULLIF(site_code, ''), NULLIF(project_site, '')) AS site_description,
          COALESCE(NULLIF(warehouse_code, ''), '') AS warehouse_code,
          COALESCE(NULLIF(warehouse_description, ''), '') AS warehouse_description
        FROM item_master
        WHERE item_code IS NOT NULL
          AND btrim(item_code) <> ''
          AND (
            lower(btrim(COALESCE(project_site, ''))) = ANY($1)
            OR lower(btrim(COALESCE(site_code, ''))) = ANY($1)
          )
          AND COALESCE(NULLIF(btrim(item_group), ''), '0') NOT IN ('99', '35')
          ${warehouseClause}
        ORDER BY item_code ASC, warehouse_code NULLS LAST
      `,
      params,
    )

    return res.json({ data: result.rows })
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
