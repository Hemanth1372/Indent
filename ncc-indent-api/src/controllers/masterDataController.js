import { query } from '../db/pool.js'

const MASTER_DEFINITIONS = {
  'project-master': {
    table: 'project_master',
    select: 'id, project_code, project_description, dpr_engineer_control, multi_location_activity, project_location_linked_activities, created_at, updated_at',
    orderBy: 'project_code ASC',
    primaryKey: 'id',
    fields: ['project_code', 'project_description', 'dpr_engineer_control', 'multi_location_activity', 'project_location_linked_activities'],
    required: ['project_code', 'project_description', 'dpr_engineer_control', 'multi_location_activity', 'project_location_linked_activities'],
    searchableFields: ['project_code', 'project_description', 'dpr_engineer_control', 'multi_location_activity', 'project_location_linked_activities'],
  },
  'activity-master': {
    table: 'activity_master',
    select: 'id, activity_code, project_code, description, activity_type, critical_capacity_type, work_auth_status, resource_required, scheduled_start_date, scheduled_finish_date, created_at, updated_at',
    orderBy: 'project_code ASC, activity_code ASC',
    primaryKey: 'id',
    fields: ['activity_code', 'project_code', 'description', 'activity_type', 'critical_capacity_type', 'work_auth_status', 'resource_required', 'scheduled_start_date', 'scheduled_finish_date'],
    required: ['activity_code', 'project_code', 'description', 'activity_type', 'critical_capacity_type', 'work_auth_status', 'resource_required'],
    searchableFields: ['activity_code', 'project_code', 'description', 'activity_type', 'critical_capacity_type', 'work_auth_status', 'resource_required'],
  },
  'location-master': {
    table: 'location_master',
    select: 'id, project_code, project_name, location_code, description, status, created_at, updated_at',
    orderBy: 'project_code ASC, location_code ASC',
    primaryKey: 'id',
    fields: ['project_code', 'project_name', 'location_code', 'description', 'status'],
    required: ['project_code', 'project_name', 'location_code', 'description'],
    searchableFields: ['project_code', 'project_name', 'location_code', 'description'],
  },
  'item-master': {
    table: 'item_master',
    select: 'id, project_site, site_description, warehouse_code, warehouse_description, on_hand_qty, item_code, item_description, purchase_unit, item_type, created_at, updated_at',
    orderBy: 'project_site ASC, item_code ASC',
    primaryKey: 'id',
    fields: ['project_site', 'site_description', 'warehouse_code', 'warehouse_description', 'on_hand_qty', 'item_code', 'item_description', 'purchase_unit', 'item_type'],
    required: ['project_site', 'site_description', 'item_code', 'item_description', 'purchase_unit', 'item_type'],
    searchableFields: ['project_site', 'site_description', 'warehouse_code', 'warehouse_description', 'item_code', 'item_description', 'purchase_unit', 'item_type'],
  },
  'business-partner-master': {
    table: 'bp_activity_master',
    select: 'id, project_code, project_description, location_code, location_description, activity_code, activity_description, business_partner_code, business_partner_name, created_at, updated_at',
    orderBy: 'project_code ASC, location_code ASC, business_partner_code ASC',
    primaryKey: 'id',
    fields: ['project_code', 'project_description', 'location_code', 'location_description', 'activity_code', 'activity_description', 'business_partner_code', 'business_partner_name'],
    required: ['project_code', 'project_description', 'location_code', 'location_description', 'business_partner_code', 'business_partner_name'],
    searchableFields: ['project_code', 'project_description', 'location_code', 'location_description', 'activity_code', 'activity_description', 'business_partner_code', 'business_partner_name'],
  },
  'warehouse-master': {
    table: 'warehouse_master',
    select: 'id, warehouse_code, warehouse_description, project_site, site_description, is_material_warehouse, is_virtual_warehouse, created_at, updated_at',
    orderBy: 'project_site ASC, warehouse_code ASC',
    primaryKey: 'id',
    fields: ['warehouse_code', 'warehouse_description', 'project_site', 'site_description', 'is_material_warehouse', 'is_virtual_warehouse'],
    required: ['warehouse_code', 'warehouse_description', 'project_site', 'site_description', 'is_material_warehouse', 'is_virtual_warehouse'],
    searchableFields: ['warehouse_code', 'warehouse_description', 'project_site', 'site_description'],
  },
  'warehouse-bin-master': {
    table: 'warehouse_location_master',
    select: 'id, project_code, warehouse_code, warehouse_name, location_code, location_description, location_category, created_at, updated_at',
    orderBy: 'project_code ASC, warehouse_code ASC, location_code ASC',
    primaryKey: 'id',
    fields: ['project_code', 'warehouse_code', 'warehouse_name', 'location_code', 'location_description', 'location_category'],
    required: ['project_code', 'warehouse_code', 'warehouse_name', 'location_code', 'location_description', 'location_category'],
    searchableFields: ['project_code', 'warehouse_code', 'warehouse_name', 'location_code', 'location_description', 'location_category'],
  },
  'delivery-point-master': {
    table: 'delivery_master',
    select: 'id, address_code, address_description, project_code, project_description, delivery_point, description_1, created_at, updated_at',
    orderBy: 'project_code ASC, delivery_point ASC',
    primaryKey: 'id',
    fields: ['address_code', 'address_description', 'project_code', 'project_description', 'delivery_point', 'description_1'],
    required: ['address_code', 'address_description', 'project_code', 'project_description', 'delivery_point'],
    searchableFields: ['address_code', 'address_description', 'project_code', 'project_description', 'delivery_point', 'description_1'],
  },
}

export function getMasterDefinition(masterKey) {
  return MASTER_DEFINITIONS[masterKey]
}

export async function listMasterData(req, res, next) {
  try {
    const definition = getMasterDefinition(req.params.masterKey)

    if (!definition) {
      return res.status(404).json({ message: 'Master not found' })
    }

    const searchField = String(req.query?.field ?? '').trim()
    const searchValue = String(req.query?.value ?? '').trim()
    const searchableFields = definition.searchableFields ?? []

    if (searchField || searchValue) {
      if (!searchField || !searchValue) {
        return res.status(400).json({ message: 'Both filter field and value are required' })
      }

      if (!searchableFields.includes(searchField)) {
        return res.status(400).json({ message: 'Invalid filter field' })
      }
    }

    const whereClause = searchField && searchValue ? `WHERE ${searchField} ILIKE $1` : ''
    const params = searchField && searchValue ? [`%${searchValue}%`] : []

    if (['project-master', 'activity-master', 'item-master', 'delivery-point-master', 'location-master', 'warehouse-master', 'warehouse-bin-master', 'business-partner-master'].includes(req.params.masterKey)) {
      const requestedPage = Number.parseInt(String(req.query?.page ?? ''), 10)
      const requestedLimit = Number.parseInt(String(req.query?.limit ?? ''), 10)
      const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 500)
        : 100
      const countResult = await query(
        `
          SELECT COUNT(*)::int AS total
          FROM ${definition.table}
          ${whereClause}
        `,
        params,
      )
      const totalRecords = Number(countResult.rows[0]?.total ?? 0)
      const totalPages = Math.max(1, Math.ceil(totalRecords / limit))
      const currentPage = Number.isFinite(requestedPage) && requestedPage > 0
        ? Math.min(requestedPage, totalPages)
        : 1
      const offset = (currentPage - 1) * limit
      const result = await query(
        `
          SELECT ${definition.select}
          FROM ${definition.table}
          ${whereClause}
          ORDER BY ${definition.orderBy}
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `,
        [...params, limit, offset],
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
    }

    const result = await query(
      `
        SELECT ${definition.select}
        FROM ${definition.table}
        ${whereClause}
        ORDER BY ${definition.orderBy}
      `,
      params,
    )

    return res.json({ data: result.rows })
  } catch (error) {
    return next(error)
  }
}

export async function updateMasterStatus(req, res, next) {
  try {
    const definition = getMasterDefinition(req.params.masterKey)

    if (!definition || !definition.fields.includes('status')) {
      return res.status(404).json({ message: 'Status toggle is not available for this master' })
    }

    const { status } = req.body

    if (!['Active', 'Inactive'].includes(status)) {
      return res.status(400).json({ message: 'Status must be Active or Inactive' })
    }

    const result = await query(
      `
        UPDATE ${definition.table}
        SET status = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE ${definition.primaryKey} = $2
        RETURNING ${definition.primaryKey}
      `,
      [status, req.params.id],
    )

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Record not found' })
    }

    const record = await fetchRecord(definition, result.rows[0][definition.primaryKey])

    return res.json({
      message: 'Status updated successfully',
      data: record,
    })
  } catch (error) {
    return next(error)
  }
}

export async function updateMasterData(req, res, next) {
  try {
    const definition = getMasterDefinition(req.params.masterKey)

    if (!definition) {
      return res.status(404).json({ message: 'Master not found' })
    }

    const payload = normalizePayload(req.body, definition)
    const editableFields = definition.fields.filter((field) => field !== 'status')
    const missingField = definition.required.find((field) => payload[field] === undefined || payload[field] === '')

    if (missingField) {
      return res.status(400).json({ message: `${missingField} is required` })
    }

    const fields = editableFields.filter((field) => Object.prototype.hasOwnProperty.call(payload, field))

    if (!fields.length) {
      return res.status(400).json({ message: 'No editable fields were provided' })
    }

    const assignments = fields.map((field, index) => `${field} = $${index + 1}`)
    const values = fields.map((field) => payload[field])
    const result = await query(
      `
        UPDATE ${definition.table}
        SET ${assignments.join(', ')},
            updated_at = CURRENT_TIMESTAMP
        WHERE ${definition.primaryKey} = $${fields.length + 1}
        RETURNING ${definition.primaryKey}
      `,
      [...values, req.params.id],
    )

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Record not found' })
    }

    const record = await fetchRecord(definition, result.rows[0][definition.primaryKey])

    return res.json({
      message: 'Record updated successfully',
      data: record,
    })
  } catch (error) {
    return handleMasterError(error, res, next)
  }
}

export async function createMasterData(req, res, next) {
  try {
    const definition = getMasterDefinition(req.params.masterKey)

    if (!definition) {
      return res.status(404).json({ message: 'Master not found' })
    }

    const payload = normalizePayload(req.body, definition)
    const missingField = definition.required.find((field) => payload[field] === undefined || payload[field] === '')

    if (missingField) {
      return res.status(400).json({ message: `${missingField} is required` })
    }

    const fields = Object.keys(payload)
    const placeholders = fields.map((_, index) => `$${index + 1}`)
    const values = fields.map((field) => payload[field])
    const result = await query(
      `
        INSERT INTO ${definition.table} (${fields.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING ${definition.primaryKey}
      `,
      values,
    )

    const record = await fetchRecord(definition, result.rows[0][definition.primaryKey])

    return res.status(201).json({
      message: 'Record created successfully',
      data: record,
    })
  } catch (error) {
    return handleMasterError(error, res, next)
  }
}

function normalizePayload(body, definition) {
  return Object.fromEntries(
    definition.fields
      .filter((field) => Object.prototype.hasOwnProperty.call(body, field))
      .map((field) => {
        const value = body[field]

        if (typeof value === 'boolean' && ['is_material_warehouse', 'is_virtual_warehouse'].includes(field)) {
          return [field, value ? 'Yes' : 'No']
        }

        if (typeof value === 'string') {
          const trimmedValue = value.trim()
          if (definition.table === 'bp_activity_master' && ['activity_code', 'activity_description'].includes(field) && trimmedValue === '') {
            return [field, null]
          }

          if (field.startsWith('scheduled_') && trimmedValue === '') {
            return [field, null]
          }

          if (['warehouse_code', 'warehouse_description'].includes(field) && trimmedValue === '') {
            return [field, null]
          }

          if (field === 'on_hand_qty' && trimmedValue === '') {
            return [field, null]
          }

          if (field === 'description_1' && trimmedValue === '') {
            return [field, null]
          }

          if (['is_material_warehouse', 'is_virtual_warehouse'].includes(field)) {
            return [field, trimmedValue.toLowerCase() === 'yes' ? 'Yes' : 'No']
          }

          return [field, trimmedValue]
        }

        return [field, value]
      })
      .filter(([, value]) => value !== undefined),
  )
}

async function fetchRecord(definition, id) {
  const result = await query(
    `
      SELECT ${definition.select}
      FROM ${definition.table}
      WHERE ${definition.primaryKey} = $1
      LIMIT 1
    `,
    [id],
  )

  return result.rows[0]
}

function handleMasterError(error, res, next) {
  if (error.code === '23505') {
    return res.status(409).json({ message: 'A record with this key already exists' })
  }

  if (error.code === '23503') {
    return res.status(400).json({ message: 'Referenced record was not found' })
  }

  return next(error)
}
