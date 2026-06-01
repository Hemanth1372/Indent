import { query } from '../db/pool.js'

const MASTER_DEFINITIONS = {
  'project-master': {
    table: 'projects',
    select: 'project_id, site_code, project_name, address_code, address_description, location, status',
    orderBy: 'project_name ASC',
    primaryKey: 'project_id',
    fields: ['site_code', 'project_name', 'address_code', 'address_description', 'location', 'status'],
    required: ['site_code', 'project_name'],
  },
  'activity-master': {
    table: 'activity_master',
    select: 'id, activity_code, description, activity_type, critical_capacity_type, work_auth_status, resource_required',
    orderBy: 'activity_code ASC',
    primaryKey: 'id',
    fields: ['activity_code', 'description', 'activity_type', 'critical_capacity_type', 'work_auth_status', 'resource_required'],
    required: ['activity_code', 'description'],
  },
  'location-master': {
    table: 'location_master',
    select: 'location_code, description',
    orderBy: 'location_code ASC',
    primaryKey: 'location_code',
    fields: ['location_code', 'description'],
    required: ['location_code', 'description'],
  },
  'item-master': {
    table: 'item_master',
    select: 'item_code, site_code, item_name, description, purchase_unit, item_type',
    orderBy: 'item_code ASC',
    primaryKey: 'item_code',
    fields: ['site_code', 'item_code', 'item_name', 'description', 'purchase_unit', 'item_type'],
    required: ['item_code', 'item_name'],
  },
  'business-partner-master': {
    table: 'business_partner_master',
    select: 'id, project_code, location_code, location_description, activity_code, activity_description, business_partner_code, bp_name',
    orderBy: 'business_partner_code ASC',
    primaryKey: 'id',
    fields: ['project_code', 'location_code', 'location_description', 'activity_code', 'activity_description', 'business_partner_code', 'bp_name'],
    required: ['business_partner_code', 'bp_name'],
  },
  'warehouse-master': {
    table: 'warehouse_master',
    select: 'warehouse_code, description, site_code, site_description, material_warehouse, virtual_warehouse, is_virtual',
    orderBy: 'warehouse_code ASC',
    primaryKey: 'warehouse_code',
    fields: ['warehouse_code', 'description', 'site_code', 'site_description', 'material_warehouse', 'virtual_warehouse', 'is_virtual'],
    required: ['warehouse_code', 'description'],
  },
  'warehouse-bin-master': {
    table: 'warehouse_bin_master',
    select: 'id, warehouse_code, description',
    orderBy: 'warehouse_code ASC',
    primaryKey: 'id',
    fields: ['warehouse_code', 'description'],
    required: ['warehouse_code', 'description'],
  },
  'delivery-point-master': {
    table: 'delivery_point_master',
    select: 'delivery_point_code, address_code, address_description, description',
    orderBy: 'delivery_point_code ASC',
    primaryKey: 'delivery_point_code',
    fields: ['delivery_point_code', 'address_code', 'address_description', 'description'],
    required: ['delivery_point_code', 'address_code', 'description'],
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

    const result = await query(`
      SELECT ${definition.select}
      FROM ${definition.table}
      ORDER BY ${definition.orderBy}
    `)

    return res.json({ data: result.rows })
  } catch (error) {
    return next(error)
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

        if (typeof value === 'string') {
          return [field, value.trim()]
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
