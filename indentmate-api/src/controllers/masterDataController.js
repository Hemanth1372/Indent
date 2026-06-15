import ExcelJS from 'exceljs'
import xlsx from 'xlsx'
import { pool, query } from '../db/pool.js'

export const MASTER_DEFINITIONS = {
  'role-master': {
    table: 'role_master',
    select: 'id, role_name, description, created_at, updated_at',
    orderBy: 'role_name ASC',
    primaryKey: 'id',
    fields: ['role_name', 'description'],
    required: ['role_name'],
    searchableFields: ['role_name', 'description'],
  },
  'responsibility-master': {
    table: 'user_project_assignment_master',
    select: 'id, employee_id, employee_name, project_id, project_description, responsibility, valid_from, valid_to, manual_status, created_at, updated_at',
    orderBy: 'employee_id ASC, project_id ASC, responsibility ASC',
    primaryKey: 'id',
    fields: ['employee_id', 'employee_name', 'project_id', 'project_description', 'responsibility', 'valid_from', 'valid_to', 'manual_status'],
    required: ['employee_id', 'employee_name', 'project_id', 'project_description', 'responsibility'],
    searchableFields: ['employee_id', 'employee_name', 'project_id', 'project_description', 'responsibility', 'manual_status'],
  },
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
    select: "id, project_code, (SELECT project_description FROM project_master WHERE project_code = activity_master.project_code LIMIT 1) AS project_description, activity_code, description, activity_type, critical_capacity_type, work_auth_status, resource_required, scheduled_start_date, scheduled_finish_date, created_at, updated_at",
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
  'service-order-master': {
    table: 'service_orders',
    select: "id, service_order_no, project_site, COALESCE(NULLIF(project_description, ''), (SELECT project_description FROM project_master WHERE project_code = service_orders.project_site LIMIT 1)) AS project_description, item_code, COALESCE(NULLIF(item_description, ''), description) AS item_description, serial_number, status, description, created_at, updated_at",
    orderBy: 'service_order_no ASC',
    primaryKey: 'id',
    fields: ['service_order_no', 'project_site', 'project_description', 'item_code', 'item_description', 'serial_number', 'status', 'description'],
    required: ['service_order_no', 'project_site', 'project_description', 'item_code', 'item_description', 'status'],
    searchableFields: ['service_order_no', 'project_site', 'project_description', 'item_code', 'item_description', 'serial_number', 'status', 'description'],
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
  'business-partner-code-master': {
    table: 'business_partner_master',
    select: 'id, business_partner_code, business_partner_name, created_at, updated_at',
    orderBy: 'business_partner_code ASC',
    primaryKey: 'id',
    fields: ['business_partner_code', 'business_partner_name'],
    required: ['business_partner_code', 'business_partner_name'],
    searchableFields: ['business_partner_code', 'business_partner_name'],
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
    select: "id, project_code, COALESCE(NULLIF(project_description, ''), (SELECT project_description FROM project_master WHERE project_code = warehouse_location_master.project_code LIMIT 1)) AS project_description, warehouse_code, warehouse_name, location_code, location_description, location_category, created_at, updated_at",
    orderBy: 'project_code ASC, warehouse_code ASC, location_code ASC',
    primaryKey: 'id',
    fields: ['project_code', 'project_description', 'warehouse_code', 'warehouse_name', 'location_code', 'location_description', 'location_category'],
    required: ['project_code', 'project_description', 'warehouse_code', 'warehouse_name', 'location_code', 'location_description', 'location_category'],
    searchableFields: ['project_code', 'project_description', 'warehouse_code', 'warehouse_name', 'location_code', 'location_description', 'location_category'],
  },
  'delivery-point-master': {
    table: 'delivery_master',
    select: 'id, project_code, project_description, address_code, address_description, delivery_point, description_1, created_at, updated_at',
    orderBy: 'project_code ASC, delivery_point ASC',
    primaryKey: 'id',
    fields: ['project_code', 'project_description', 'address_code', 'address_description', 'delivery_point', 'description_1'],
    required: ['address_code', 'address_description', 'project_code', 'project_description', 'delivery_point'],
    searchableFields: ['project_code', 'project_description', 'address_code', 'address_description', 'delivery_point', 'description_1'],
  },
  'engineer-activity-master': {
    table: 'engineer_activity_master',
    select: 'id, project_code, project_description, location_code, location_description, activity_code, activity_description, employee_id, employee_name, created_at, updated_at',
    orderBy: 'project_code ASC, location_code ASC, activity_code ASC, employee_id ASC',
    primaryKey: 'id',
    fields: ['project_code', 'project_description', 'location_code', 'location_description', 'activity_code', 'activity_description', 'employee_id', 'employee_name'],
    required: ['project_code', 'project_description', 'location_code', 'location_description', 'employee_id', 'employee_name'],
    searchableFields: ['project_code', 'project_description', 'location_code', 'location_description', 'activity_code', 'activity_description', 'employee_id', 'employee_name'],
  },
  'rental-order-master': {
    table: 'rental_order_master',
    select: 'id, rental_order, rental_description, status, project_code, project_description, item_type_in_transaction, item_code, item_description, created_at, updated_at',
    orderBy: 'rental_order ASC',
    primaryKey: 'id',
    fields: ['rental_order', 'rental_description', 'status', 'project_code', 'project_description', 'item_type_in_transaction', 'item_code', 'item_description'],
    required: ['rental_order', 'rental_description', 'status', 'project_code', 'project_description', 'item_type_in_transaction'],
    searchableFields: ['rental_order', 'rental_description', 'status', 'project_code', 'project_description', 'item_type_in_transaction', 'item_code', 'item_description'],
  },
  'purchase-office-master': {
    table: 'purchase_office_master',
    select: 'id, purchase_order, buy_from_business_partner, bp_description, status, purchase_office, purchase_office_description, created_at, updated_at',
    orderBy: 'purchase_order ASC',
    primaryKey: 'id',
    fields: ['purchase_order', 'buy_from_business_partner', 'bp_description', 'status', 'purchase_office', 'purchase_office_description'],
    required: ['purchase_order', 'buy_from_business_partner', 'bp_description', 'status', 'purchase_office', 'purchase_office_description'],
    searchableFields: ['purchase_order', 'buy_from_business_partner', 'bp_description', 'status', 'purchase_office', 'purchase_office_description'],
  },
  'purchase-office-code-master': {
    table: 'purchase_office_code_master',
    select: 'id, purchase_office, purchase_office_description, created_at, updated_at',
    orderBy: 'purchase_office ASC',
    primaryKey: 'id',
    fields: ['purchase_office', 'purchase_office_description'],
    required: ['purchase_office', 'purchase_office_description'],
    searchableFields: ['purchase_office', 'purchase_office_description'],
  },
}

export const MASTER_IMPORT_CONFIGS = {
  'role-master': {
    tableName: 'role_master',
    lookupDbColumn: 'role_name',
    keyDbColumns: ['role_name'],
    excelLookupKey: 'Role Name',
    orderBy: 'role_name ASC',
    defaults: {
      description: null,
    },
    columns: [
      { label: 'Role Name', excelHeader: 'Role Name', dbColumn: 'role_name', type: 'string', isReadOnly: true },
      { label: 'Description', excelHeader: 'Description', dbColumn: 'description', type: 'text', nullable: true },
    ],
  },
  'responsibility-master': {
    tableName: 'user_project_assignment_master',
    lookupDbColumn: 'employee_id',
    keyDbColumns: ['employee_id', 'project_id', 'responsibility'],
    excelLookupKey: 'Employee ID',
    orderBy: 'employee_id ASC, project_id ASC, responsibility ASC',
    defaults: {
      manual_status: 'Active',
    },
    columns: [
      { label: 'Employee Id', excelHeader: 'Employee ID', dbColumn: 'employee_id', type: 'string', isReadOnly: true },
      { label: 'Employee Name', excelHeader: 'Employee Name', dbColumn: 'employee_name', type: 'string' },
      { label: 'Project Id', excelHeader: 'Project ID', dbColumn: 'project_id', type: 'string' },
      { label: 'Project Desc', excelHeader: 'Project Description', dbColumn: 'project_description', type: 'text' },
      { label: 'Responsibility', excelHeader: 'Responsibility', dbColumn: 'responsibility', type: 'string' },
      { label: 'Valid From', excelHeader: 'Valid From', dbColumn: 'valid_from', type: 'date' },
      { label: 'Valid To', excelHeader: 'Valid To', dbColumn: 'valid_to', type: 'date' },
    ],
  },
  'project-master': {
    tableName: 'project_master',
    lookupDbColumn: 'project_code',
    keyDbColumns: ['project_code'],
    excelLookupKey: 'Project',
    orderBy: 'project_code ASC',
    defaults: {
      project_description: '',
      dpr_engineer_control: 'LOCATION',
      multi_location_activity: 'NO',
      project_location_linked_activities: 'NO',
    },
    columns: [
      { label: 'Project Code', excelHeader: 'Project', dbColumn: 'project_code', type: 'string', isReadOnly: true },
      { label: 'Project Description', excelHeader: 'Project Description', dbColumn: 'project_description', type: 'text' },
      { label: 'Dpr Engineer Control', excelHeader: 'DPR Engineer Control', dbColumn: 'dpr_engineer_control', type: 'string' },
      { label: 'Multi Location Act.', excelHeader: 'Multi Location Activity', dbColumn: 'multi_location_activity', type: 'string' },
      { label: 'Loc. Linked To Act.', excelHeader: 'Project Location Linked to Activities', dbColumn: 'project_location_linked_activities', type: 'string' },
    ],
  },
  'activity-master': {
    tableName: 'activity_master',
    lookupDbColumn: 'activity_code',
    keyDbColumns: ['project_code', 'activity_code'],
    excelLookupKey: 'Activity',
    orderBy: 'project_code ASC, activity_code ASC',
    defaults: {
      project_code: '',
      description: '',
      activity_type: '',
      critical_capacity_type: '',
      work_auth_status: '',
      resource_required: '',
      scheduled_start_date: null,
      scheduled_finish_date: null,
    },
    columns: [
      { label: 'Activity Code', excelHeader: 'Activity', dbColumn: 'activity_code', isReadOnly: true },
      { label: 'Project Code', excelHeader: 'Project', dbColumn: 'project_code' },
      { label: 'Description', excelHeader: 'Description', dbColumn: 'description' },
      { label: 'Activity Type', excelHeader: 'Activity Type', dbColumn: 'activity_type' },
      { label: 'Critical Capacity', excelHeader: 'Critical Capacity Type', dbColumn: 'critical_capacity_type' },
      { label: 'Auth Status', excelHeader: 'Work Auth Status', dbColumn: 'work_auth_status' },
      { label: 'Resource Required', excelHeader: 'Resource Required', dbColumn: 'resource_required' },
      { label: 'Start Date', excelHeader: 'Scheduled Start Date', dbColumn: 'scheduled_start_date', type: 'date' },
      { label: 'Finish Date', excelHeader: 'Scheduled Finish Date', dbColumn: 'scheduled_finish_date', type: 'date' },
    ],
    exportColumns: [
      { excelHeader: 'Project Code', dbColumn: 'project_code' },
      { excelHeader: 'Project Description', dbColumn: 'project_description' },
      { excelHeader: 'Activity Code', dbColumn: 'activity_code' },
      { excelHeader: 'Description', dbColumn: 'description' },
      { excelHeader: 'Activity Type', dbColumn: 'activity_type' },
      { excelHeader: 'Critical Capacity', dbColumn: 'critical_capacity_type' },
      { excelHeader: 'Auth Status', dbColumn: 'work_auth_status' },
      { excelHeader: 'Resource Required', dbColumn: 'resource_required' },
      { excelHeader: 'Start Date', dbColumn: 'scheduled_start_date' },
      { excelHeader: 'Finish Date', dbColumn: 'scheduled_finish_date' },
    ],
  },
  'location-master': {
    tableName: 'location_master',
    lookupDbColumn: 'location_code',
    keyDbColumns: ['project_code', 'location_code'],
    excelLookupKey: 'Location',
    orderBy: 'project_code ASC, location_code ASC',
    defaults: { project_code: '', project_name: '', description: '', status: 'Active' },
    columns: [
      { label: 'Project Code', excelHeader: 'Project', dbColumn: 'project_code' },
      { label: 'Project Name', excelHeader: 'Project Name', dbColumn: 'project_name' },
      { label: 'Location Code', excelHeader: 'Location', dbColumn: 'location_code', isReadOnly: true },
      { label: 'Description', excelHeader: 'Description', dbColumn: 'description' },
      { label: 'Status', excelHeader: 'Status', dbColumn: 'status' },
    ],
  },
  'item-master': {
    tableName: 'item_master',
    lookupDbColumn: 'item_code',
    keyDbColumns: ['project_site', 'warehouse_code', 'item_code'],
    excelLookupKey: 'ITEM CODE',
    orderBy: 'project_site ASC, item_code ASC',
    defaults: {
      project_site: '',
      site_description: '',
      warehouse_code: null,
      warehouse_description: null,
      on_hand_qty: null,
      item_description: '',
      purchase_unit: '',
      item_type: '',
    },
    columns: [
      { label: 'Project Code', excelHeader: 'Project Code', aliases: ['SITE'], dbColumn: 'project_site' },
      { label: 'Project Description', excelHeader: 'Project Description', aliases: ['SITE Description'], dbColumn: 'site_description' },
      { label: 'Warehouse Code', excelHeader: 'Warehouse', dbColumn: 'warehouse_code' },
      { label: 'Warehouse Description', excelHeader: 'Warehouse Description', dbColumn: 'warehouse_description' },
      { label: 'On Hand Qty', excelHeader: 'On Hand', dbColumn: 'on_hand_qty' },
      { label: 'Item Code', excelHeader: 'ITEM CODE', dbColumn: 'item_code', isReadOnly: true },
      { label: 'Item Description', excelHeader: 'Item Description', dbColumn: 'item_description' },
      { label: 'Purchase Unit', excelHeader: 'Purchase Unit', dbColumn: 'purchase_unit' },
      { label: 'Item Type', excelHeader: 'Item Type', dbColumn: 'item_type' },
    ],
  },
  'service-order-master': {
    tableName: 'service_orders',
    lookupDbColumn: 'service_order_no',
    keyDbColumns: ['service_order_no'],
    excelLookupKey: 'Service Order',
    orderBy: 'service_order_no ASC',
    defaults: {
      status: 'Released',
      project_description: null,
      item_code: null,
      item_description: null,
      serial_number: null,
      project_site: '',
      description: null,
    },
    columns: [
      { label: 'Service Order', excelHeader: 'Service Order', dbColumn: 'service_order_no', isReadOnly: true },
      { label: 'Project Code', excelHeader: 'Project Code', aliases: ['Project Site', 'Site'], dbColumn: 'project_site' },
      { label: 'Project Description', excelHeader: 'Project Description', dbColumn: 'project_description', nullable: true },
      { label: 'Item Code', excelHeader: 'Item Code', dbColumn: 'item_code', nullable: true },
      { label: 'Item Description', excelHeader: 'Item Description', dbColumn: 'item_description', nullable: true },
      { label: 'Serial Number', excelHeader: 'Serial Number', dbColumn: 'serial_number', nullable: true },
      { label: 'Status', excelHeader: 'Status', dbColumn: 'status' },
      { label: 'Description', excelHeader: 'Description', dbColumn: 'description', nullable: true },
    ],
  },
  'business-partner-master': {
    tableName: 'bp_activity_master',
    lookupDbColumn: 'business_partner_code',
    keyDbColumns: ['project_code', 'location_code', 'activity_code', 'business_partner_code'],
    excelLookupKey: 'Business Partner',
    orderBy: 'project_code ASC, location_code ASC, business_partner_code ASC',
    defaults: {
      project_code: '',
      project_description: '',
      location_code: '',
      location_description: '',
      activity_code: null,
      activity_description: null,
      business_partner_name: '',
    },
    columns: [
      { label: 'Project Code', excelHeader: 'Project', dbColumn: 'project_code' },
      { label: 'Project Description', excelHeader: 'Project Description', dbColumn: 'project_description' },
      { label: 'Location Code', excelHeader: 'Location', dbColumn: 'location_code' },
      { label: 'Location Description', excelHeader: 'Location Description', dbColumn: 'location_description' },
      { label: 'Activity Code', excelHeader: 'Activity', dbColumn: 'activity_code', nullable: true },
      { label: 'Activity Description', excelHeader: 'Activity Description', dbColumn: 'activity_description', nullable: true },
      { label: 'Business Partner Code', excelHeader: 'Business Partner', dbColumn: 'business_partner_code', isReadOnly: true },
      { label: 'Business Partner Name', excelHeader: 'BP Name', dbColumn: 'business_partner_name' },
    ],
  },
  'business-partner-code-master': {
    tableName: 'business_partner_master',
    lookupDbColumn: 'business_partner_code',
    keyDbColumns: ['business_partner_code'],
    excelLookupKey: 'Business Partner',
    orderBy: 'business_partner_code ASC',
    defaults: {
      business_partner_name: '',
    },
    columns: [
      { label: 'Business Partner Code', excelHeader: 'Business Partner', dbColumn: 'business_partner_code', isReadOnly: true },
      { label: 'Business Partner Name', excelHeader: 'BP Name', dbColumn: 'business_partner_name' },
    ],
  },
  'warehouse-master': {
    tableName: 'warehouse_master',
    lookupDbColumn: 'warehouse_code',
    keyDbColumns: ['warehouse_code'],
    excelLookupKey: 'Warehouse',
    orderBy: 'project_site ASC, warehouse_code ASC',
    defaults: {
      warehouse_description: '',
      project_site: '',
      site_description: '',
      is_material_warehouse: 'No',
      is_virtual_warehouse: 'No',
    },
    columns: [
      { label: 'Warehouse Code', excelHeader: 'Warehouse', dbColumn: 'warehouse_code', isReadOnly: true },
      { label: 'Warehouse Description', excelHeader: 'Warehouse Description', dbColumn: 'warehouse_description' },
      { label: 'Project Code', excelHeader: 'Project Code', aliases: ['Site'], dbColumn: 'project_site' },
      { label: 'Project Description', excelHeader: 'Project Description', aliases: ['Site Description'], dbColumn: 'site_description' },
      { label: 'Material Warehouse', excelHeader: 'Material Warehouse (Yes/No)', dbColumn: 'is_material_warehouse' },
      { label: 'Virtual Warehouse', excelHeader: 'Virtual Warehouse (Yes/No)', dbColumn: 'is_virtual_warehouse' },
    ],
  },
  'warehouse-bin-master': {
    tableName: 'warehouse_location_master',
    lookupDbColumn: 'location_code',
    keyDbColumns: ['warehouse_code', 'location_code'],
    excelLookupKey: 'Location',
    orderBy: 'project_code ASC, warehouse_code ASC, location_code ASC',
    defaults: {
      project_code: '',
      project_description: '',
      warehouse_code: '',
      warehouse_name: '',
      location_description: '',
      location_category: '',
    },
    columns: [
      { label: 'Project Code', excelHeader: 'Project', dbColumn: 'project_code' },
      { label: 'Project Description', excelHeader: 'Project Description', dbColumn: 'project_description' },
      { label: 'Warehouse Code', excelHeader: 'Warehouse', dbColumn: 'warehouse_code' },
      { label: 'Warehouse Description', excelHeader: 'Warehouse Description', aliases: ['Warehouse Location', 'Warehouse Name'], dbColumn: 'warehouse_name' },
      { label: 'Location Code', excelHeader: 'Location', dbColumn: 'location_code', isReadOnly: true },
      { label: 'Location Description', excelHeader: 'Location Description', dbColumn: 'location_description' },
      { label: 'Location Category', excelHeader: 'Location Category', dbColumn: 'location_category' },
    ],
  },
  'delivery-point-master': {
    tableName: 'delivery_master',
    lookupDbColumn: 'address_code',
    keyDbColumns: ['project_code', 'address_code', 'delivery_point'],
    excelLookupKey: 'Address Code',
    orderBy: 'project_code ASC, delivery_point ASC',
    defaults: {
      address_description: '',
      project_code: '',
      project_description: '',
      delivery_point: '',
      description_1: null,
    },
    columns: [
      { label: 'Project Code', excelHeader: 'Project Code', dbColumn: 'project_code' },
      { label: 'Project Description', excelHeader: 'Project Description', dbColumn: 'project_description' },
      { label: 'Address Code', excelHeader: 'Address Code', dbColumn: 'address_code', isReadOnly: true },
      { label: 'Address Description', excelHeader: 'Address Code Description', dbColumn: 'address_description' },
      { label: 'Delivery Point', excelHeader: 'Delivery Point', dbColumn: 'delivery_point' },
      { label: 'Description I', excelHeader: 'Description I', dbColumn: 'description_1' },
    ],
  },
  'engineer-activity-master': {
    tableName: 'engineer_activity_master',
    lookupDbColumn: 'employee_id',
    keyDbColumns: ['project_code', 'location_code', 'activity_code', 'employee_id'],
    excelLookupKey: 'Employee ID',
    orderBy: 'project_code ASC, location_code ASC, activity_code ASC, employee_id ASC',
    defaults: {
      activity_code: null,
      activity_description: null,
    },
    columns: [
      { label: 'Project Code', excelHeader: 'Project', dbColumn: 'project_code' },
      { label: 'Project Description', excelHeader: 'Project Description', dbColumn: 'project_description' },
      { label: 'Location Code', excelHeader: 'Location', dbColumn: 'location_code' },
      { label: 'Location Description', excelHeader: 'Location Description', dbColumn: 'location_description' },
      { label: 'Activity Code', excelHeader: 'Activity', dbColumn: 'activity_code' },
      { label: 'Activity Description', excelHeader: 'Activity Description', dbColumn: 'activity_description' },
      { label: 'Employee ID', excelHeader: 'Employee ID', dbColumn: 'employee_id' },
      { label: 'Employee Name', excelHeader: 'Employee Name', dbColumn: 'employee_name' },
    ],
  },
  'rental-order-master': {
    tableName: 'rental_order_master',
    lookupDbColumn: 'rental_order',
    keyDbColumns: ['rental_order'],
    excelLookupKey: 'Rental Order',
    orderBy: 'rental_order ASC',
    defaults: {
      item_code: null,
      item_description: null,
    },
    columns: [
      { label: 'Rental Order', excelHeader: 'Rental Order', dbColumn: 'rental_order', isReadOnly: true },
      { label: 'Rental Description', excelHeader: 'Rental Description', dbColumn: 'rental_description' },
      { label: 'Status', excelHeader: 'Status', dbColumn: 'status' },
      { label: 'Project Code', excelHeader: 'Project', dbColumn: 'project_code' },
      { label: 'Project Description', excelHeader: 'Project Description', dbColumn: 'project_description' },
      { label: 'Item Type', excelHeader: 'Item Type in Transaction', dbColumn: 'item_type_in_transaction' },
      { label: 'Item Code', excelHeader: 'Item', dbColumn: 'item_code', nullable: true },
      { label: 'Item Description', excelHeader: 'Item Description', dbColumn: 'item_description', nullable: true },
    ],
  },
  'purchase-office-master': {
    tableName: 'purchase_office_master',
    lookupDbColumn: 'purchase_order',
    keyDbColumns: ['purchase_order'],
    excelLookupKey: 'Purchase Order',
    orderBy: 'purchase_order ASC',
    columns: [
      { label: 'Purchase Order', excelHeader: 'Purchase Order', aliases: ['Order'], dbColumn: 'purchase_order', isReadOnly: true },
      { label: 'Buy-from BP', excelHeader: 'Buy-from Business Partner', dbColumn: 'buy_from_business_partner' },
      { label: 'BP Description', excelHeader: 'BP Description', dbColumn: 'bp_description' },
      { label: 'Status', excelHeader: 'Status', dbColumn: 'status' },
      { label: 'Purchase Office', excelHeader: 'Purchase Office', dbColumn: 'purchase_office' },
      { label: 'Purchase Office Description', excelHeader: 'Purchase Office Description', dbColumn: 'purchase_office_description' },
    ],
  },
  'purchase-office-code-master': {
    tableName: 'purchase_office_code_master',
    lookupDbColumn: 'purchase_office',
    keyDbColumns: ['purchase_office'],
    excelLookupKey: 'Purchase Office',
    orderBy: 'purchase_office ASC',
    defaults: {
      purchase_office_description: '',
    },
    columns: [
      { label: 'Purchase Office', excelHeader: 'Purchase Office', dbColumn: 'purchase_office', isReadOnly: true },
      { label: 'Purchase Office Description', excelHeader: 'Purchase Office Description', dbColumn: 'purchase_office_description' },
    ],
  },
}

const MASTER_EXPORT_TITLES = {
  'role-master': 'Role Master',
  'responsibility-master': 'User Project Assignment Master',
  'project-master': 'Project Master',
  'activity-master': 'Activity Master',
  'location-master': 'Location Master',
  'item-master': 'Item Master',
  'service-order-master': 'Service Order Master',
  'business-partner-master': 'Business Partner Activity Master',
  'business-partner-code-master': 'Business Partner Master',
  'warehouse-master': 'Warehouse Master',
  'warehouse-bin-master': 'Warehouse Location Master',
  'delivery-point-master': 'Delivery Master',
  'engineer-activity-master': 'Engineer by Activity Master',
  'rental-order-master': 'Rental Order Master',
  'purchase-office-master': 'Purchase Order Master',
  'purchase-office-code-master': 'Purchase Office Master',
}

export function getMasterDefinition(masterKey) {
  return MASTER_DEFINITIONS[masterKey]
}

function parseFilterQuery(rawFilters) {
  if (!rawFilters) {
    return []
  }

  try {
    const parsedFilters = typeof rawFilters === 'string' ? JSON.parse(rawFilters) : rawFilters

    if (!Array.isArray(parsedFilters)) {
      return []
    }

    return parsedFilters
      .map((filter) => ({
        field: String(filter?.field ?? '').trim(),
        value: String(filter?.value ?? '').trim(),
      }))
      .filter((filter) => filter.field && filter.value)
  } catch {
    return null
  }
}

function buildFilterClause(filters, searchableFields, aliasMap = {}) {
  if (!filters.length) {
    return { whereClause: '', params: [] }
  }

  const whereConditions = []
  const params = []

  for (const filter of filters) {
    const dbField = aliasMap[filter.field] ?? filter.field

    if (!searchableFields.includes(filter.field)) {
      const error = new Error('Invalid filter field')
      error.statusCode = 400
      throw error
    }

    params.push(`%${filter.value}%`)
    whereConditions.push(`${dbField}::TEXT ILIKE $${params.length}`)
  }

  return {
    whereClause: `WHERE ${whereConditions.join(' AND ')}`,
    params,
  }
}

function descriptionExpressionForFilter(definition, field) {
  const pairings = {
    project_code: definition.table === 'activity_master'
      ? `(SELECT project_description FROM project_master WHERE project_code = ${definition.table}.project_code LIMIT 1)`
      : 'project_description',
    project_id: 'project_description',
    project_site: 'site_description',
    warehouse_code: definition.table === 'warehouse_location_master' ? 'warehouse_name' : 'warehouse_description',
    location_code: definition.table === 'location_master' ? 'description' : 'location_description',
    business_partner_code: definition.table === 'purchase_office_master' ? 'bp_description' : 'business_partner_name',
    buy_from_business_partner: 'bp_description',
    activity_code: definition.table === 'activity_master' ? 'description' : 'activity_description',
    item_code: 'item_description',
    address_code: 'address_description',
    delivery_point: 'description_1',
    employee_id: 'employee_name',
    purchase_office: 'purchase_office_description',
    rental_order: 'rental_description',
    service_order_no: 'description',
  }
  const expression = pairings[field]

  if (!expression) {
    return null
  }

  const availableFields = new Set([...(definition.fields ?? []), ...(definition.searchableFields ?? [])])
  if (expression.includes('SELECT') || availableFields.has(expression)) {
    return expression
  }

  return null
}

export async function listMasterData(req, res, next) {
  try {
    const definition = getMasterDefinition(req.params.masterKey)

    if (!definition) {
      return res.status(404).json({ message: 'Master not found' })
    }

    const parsedFilters = parseFilterQuery(req.query?.filters)
    const searchField = String(req.query?.field ?? '').trim()
    const searchValue = String(req.query?.value ?? '').trim()
    const searchableFields = definition.searchableFields ?? []

    if (parsedFilters === null) {
      return res.status(400).json({ message: 'Invalid filter payload' })
    }

    if (searchField || searchValue) {
      if (!searchField || !searchValue) {
        return res.status(400).json({ message: 'Both filter field and value are required' })
      }

      if (!searchableFields.includes(searchField)) {
        return res.status(400).json({ message: 'Invalid filter field' })
      }
    }

    const activeFilters = parsedFilters.length > 0
      ? parsedFilters
      : searchField && searchValue
        ? [{ field: searchField, value: searchValue }]
        : []
    const { whereClause, params } = buildFilterClause(activeFilters, searchableFields)

    if (['role-master', 'responsibility-master', 'project-master', 'activity-master', 'item-master', 'service-order-master', 'delivery-point-master', 'location-master', 'warehouse-master', 'warehouse-bin-master', 'business-partner-master', 'business-partner-code-master', 'engineer-activity-master', 'rental-order-master', 'purchase-office-master', 'purchase-office-code-master'].includes(req.params.masterKey)) {
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

export async function listMasterFilterOptions(req, res, next) {
  try {
    const definition = getMasterDefinition(req.params.masterKey)

    if (!definition) {
      return res.status(404).json({ message: 'Master not found' })
    }

    const field = String(req.query?.field ?? '').trim()
    const searchableFields = definition.searchableFields ?? []

    if (!field || !searchableFields.includes(field)) {
      return res.status(400).json({ message: 'Invalid filter field' })
    }

    const filterOptionsQuery = buildFilterOptionsQuery(definition, field)
    const result = await query(filterOptionsQuery)

    return res.json({
      data: result.rows.map((row) => ({
        value: row.value,
        label: row.description && row.description !== row.value ? `${row.value} (${row.description})` : row.value,
      })),
    })
  } catch (error) {
    return next(error)
  }
}

function buildFilterOptionsQuery(definition, field) {
  const projectFieldMap = {
    project_code: 'project_code',
    project_id: 'project_code',
    project_site: 'project_code',
  }

  if (projectFieldMap[field]) {
    return `
      SELECT DISTINCT
        project_code::TEXT AS value,
        project_description::TEXT AS description
      FROM project_master
      WHERE project_code IS NOT NULL AND TRIM(project_code::TEXT) <> ''
      ORDER BY value ASC
      LIMIT 1000
    `
  }

  const descriptionExpression = descriptionExpressionForFilter(definition, field)

  return `
    SELECT DISTINCT ${field}::TEXT AS value${descriptionExpression ? `, ${descriptionExpression}::TEXT AS description` : ''}
    FROM ${definition.table}
    WHERE ${field} IS NOT NULL AND TRIM(${field}::TEXT) <> ''
    ORDER BY value ASC
    LIMIT 1000
  `
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

export async function deleteMasterData(req, res, next) {
  try {
    const definition = getMasterDefinition(req.params.masterKey)

    if (!definition) {
      return res.status(404).json({ message: 'Master not found' })
    }

    const result = await query(
      `
        DELETE FROM ${definition.table}
        WHERE ${definition.primaryKey} = $1
        RETURNING ${definition.primaryKey}
      `,
      [req.params.id],
    )

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Record not found' })
    }

    return res.json({ message: 'Record deleted successfully' })
  } catch (error) {
    return handleMasterError(error, res, next)
  }
}

export async function importMasterData(req, res, next) {
  const definition = getMasterDefinition(req.params.masterKey)
  const importConfig = MASTER_IMPORT_CONFIGS[req.params.masterKey]

  if (!definition || !importConfig) {
    return res.status(404).json({ message: 'Import is not available for this master' })
  }

  if (!req.file) {
    return res.status(400).json({ message: 'Import file is required' })
  }

  try {
    const fieldsMapping = parseImportFieldsMapping(req.body?.fieldsMapping, importConfig)
    const sheetRows = parseWorkbookRows(req.file, importConfig)
    const excelLookupKey = importConfig.excelLookupKey

    if (!fieldsMapping[excelLookupKey]) {
      return res.status(400).json({ message: `${excelLookupKey} must be selected for import` })
    }

    const keyDbColumns = getImportKeyColumns(importConfig)
    const missingKeyColumn = keyDbColumns.find((dbColumn) => {
      const column = importConfig.columns.find((candidate) => candidate.dbColumn === dbColumn)
      return !column || !fieldsMapping[column.excelHeader]
    })

    if (missingKeyColumn) {
      return res.status(400).json({ message: `${missingKeyColumn} must be selected for import` })
    }

    const lookupColumn = importConfig.columns.find((column) => column.dbColumn === importConfig.lookupDbColumn)
    const primaryLookupValues = [
      ...new Set(
        sheetRows
          .map((row) => normalizeCell(lookupColumn ? readImportColumnValue(row, lookupColumn) : row[excelLookupKey]))
          .filter(Boolean),
      ),
    ]

    if (!primaryLookupValues.length) {
      return res.status(400).json({ message: 'Uploaded sheet contains no importable lookup keys' })
    }

    const existingResult = await query(
      `
        SELECT ${definition.select}
        FROM ${importConfig.tableName}
        WHERE ${importConfig.lookupDbColumn} = ANY($1)
      `,
      [primaryLookupValues],
    )
    const existingRecords = new Map(
      existingResult.rows.map((record) => [buildDbCompositeKey(record, keyDbColumns), record]),
    )
    const inserts = []
    const updates = []
    const summary = {
      insertedCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      updatedRecordsLog: [],
    }

    const processedLookupValues = new Set()

    for (const row of sheetRows) {
      const lookupValue = normalizeCell(lookupColumn ? readImportColumnValue(row, lookupColumn) : row[excelLookupKey])
      const compositeKey = buildRowCompositeKey(row, importConfig, keyDbColumns)

      if (!lookupValue || !compositeKey || processedLookupValues.has(compositeKey)) {
        continue
      }

      processedLookupValues.add(compositeKey)
      const existingRecord = existingRecords.get(compositeKey)

      if (!existingRecord) {
        inserts.push(buildGenericInsertRow(row, importConfig, fieldsMapping, lookupValue))
        continue
      }

      const update = buildGenericUpdate(row, existingRecord, importConfig, fieldsMapping, lookupValue, keyDbColumns)
      if (update) {
        updates.push(update)
      } else {
        summary.unchangedCount += 1
      }
    }

    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      if (inserts.length) {
        await bulkInsertMasterRows(client, importConfig.tableName, inserts)
      }

      if (updates.length) {
        await bulkUpdateMasterRows(client, importConfig, updates)
      }

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    summary.insertedCount = inserts.length
    summary.updatedCount = updates.length
    summary.updatedRecordsLog = updates.map((update) => update.lookupValue)

    return res.json({
      message: 'File processing tracking evaluations concluded successfully.',
      processedRows: sheetRows.length,
      summary,
    })
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message })
    }

    return handleMasterError(error, res, next)
  }
}

export async function exportMasterData(req, res, next) {
  const definition = getMasterDefinition(req.params.masterKey)
  const importConfig = MASTER_IMPORT_CONFIGS[req.params.masterKey]

  if (!definition || !importConfig) {
    return res.status(404).json({ message: 'Export is not available for this master' })
  }

  try {
    const parsedFilters = parseFilterQuery(req.query?.filters)
    const searchField = String(req.query?.field ?? '').trim()
    const searchValue = String(req.query?.value ?? '').trim()
    const selectedKeys = String(req.query?.selectedKeys ?? '')
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean)
    const searchableFields = definition.searchableFields ?? []

    if (parsedFilters === null) {
      return res.status(400).json({ message: 'Invalid filter payload' })
    }

    if (selectedKeys.length === 0 && (searchField || searchValue)) {
      if (!searchField || !searchValue) {
        return res.status(400).json({ message: 'Both filter field and value are required' })
      }

      if (!searchableFields.includes(searchField)) {
        return res.status(400).json({ message: 'Invalid filter field' })
      }
    }

    let whereClause = ''
    let params = []

    if (selectedKeys.length > 0) {
      whereClause = `WHERE ${definition.primaryKey}::TEXT = ANY($1::text[])`
      params = [selectedKeys]
    } else {
      const activeFilters = parsedFilters.length > 0
        ? parsedFilters
        : searchField && searchValue
          ? [{ field: searchField, value: searchValue }]
          : []
      const builtFilters = buildFilterClause(activeFilters, searchableFields)
      whereClause = builtFilters.whereClause
      params = builtFilters.params
    }

    const exportColumns = importConfig.exportColumns ?? importConfig.columns
    const result = await query(
      `
        SELECT ${exportColumns.map((column) => column.dbColumn).join(', ')}
        FROM (
          SELECT ${definition.select}
          FROM ${definition.table}
        ) export_source
        ${whereClause}
        ORDER BY ${importConfig.orderBy}
      `,
      params,
    )

    const workbook = new ExcelJS.Workbook()
    const masterTitle = MASTER_EXPORT_TITLES[req.params.masterKey] ?? req.params.masterKey
    const worksheet = workbook.addWorksheet(masterTitle.slice(0, 31))
    worksheet.columns = exportColumns.map((column) => ({
      header: column.excelHeader,
      key: column.dbColumn,
      width: Math.max(18, Math.min(44, column.excelHeader.length + 8)),
    }))
    worksheet.getRow(1).font = { bold: true }
    worksheet.addRows(result.rows)

    const filename = `${masterTitle.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')}_Export.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`)
    await workbook.xlsx.write(res)
    return res.end()
  } catch (error) {
    return next(error)
  }
}

function parseWorkbookRows(file, importConfig) {
  const workbook = xlsx.read(file.buffer, {
    type: 'buffer',
    raw: false,
    cellDates: false,
  })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    throwBadRequest('Import file does not contain a worksheet')
  }

  const sheetRows = xlsx.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    defval: '',
    blankrows: false,
  })

  if (!sheetRows.length) {
    throwBadRequest('Uploaded sheet contains no raw data rows')
  }

  const headers = new Set(Object.keys(sheetRows[0] ?? {}).map((header) => String(header).trim()))
  const lookupColumn = importConfig.columns.find((column) => column.dbColumn === importConfig.lookupDbColumn)
  const lookupHeaders = [importConfig.excelLookupKey, ...(lookupColumn?.aliases ?? [])]

  if (!lookupHeaders.some((header) => headers.has(header))) {
    throwBadRequest(`Invalid template. Required column: ${importConfig.excelLookupKey}`)
  }

  return sheetRows
}

function parseImportFieldsMapping(value, importConfig) {
  if (!value) {
    return Object.fromEntries(importConfig.columns.map((column) => [column.excelHeader, true]))
  }

  try {
    const parsed = JSON.parse(value)
    return Object.fromEntries(
      importConfig.columns.map((column) => [
        column.excelHeader,
        column.excelHeader === importConfig.excelLookupKey ||
          Boolean(parsed[column.excelHeader]) ||
          (column.aliases ?? []).some((alias) => Boolean(parsed[alias])),
      ]),
    )
  } catch {
    throwBadRequest('Invalid fieldsMapping payload')
  }
}

function buildGenericInsertRow(row, importConfig, fieldsMapping, lookupValue) {
  const insertRow = {
    [importConfig.lookupDbColumn]: lookupValue,
  }

  for (const column of importConfig.columns) {
    if (column.dbColumn === importConfig.lookupDbColumn) {
      continue
    }

    if (fieldsMapping[column.excelHeader] && hasImportColumnValue(row, column)) {
      insertRow[column.dbColumn] = normalizeDbValue(readImportColumnValue(row, column), column)
      continue
    }

    if (Object.prototype.hasOwnProperty.call(importConfig.defaults ?? {}, column.dbColumn)) {
      insertRow[column.dbColumn] = importConfig.defaults[column.dbColumn]
    }
  }

  return insertRow
}

function buildGenericUpdate(row, existingRecord, importConfig, fieldsMapping, lookupValue, keyDbColumns) {
  const assignments = []
  const values = []
  const fields = []
  const keySet = new Set(keyDbColumns)

  for (const column of importConfig.columns) {
    if (keySet.has(column.dbColumn) || !fieldsMapping[column.excelHeader] || !hasImportColumnValue(row, column)) {
      continue
    }

    const nextValue = normalizeDbValue(readImportColumnValue(row, column), column)
    const nextComparable = normalizeComparableValue(nextValue)
    const currentComparable = column.type === 'date'
      ? normalizeComparableValue(normalizeDateValue(existingRecord[column.dbColumn]))
      : normalizeComparableValue(existingRecord[column.dbColumn])

    if (nextComparable !== currentComparable) {
      values.push(nextValue)
      fields.push(column.dbColumn)
      assignments.push(`${column.dbColumn} = $${values.length}`)
    }
  }

  if (!assignments.length) {
    return null
  }

  return {
    lookupValue,
    assignments,
    fields,
    keyValues: keyDbColumns.map((dbColumn) => normalizeComparableValue(existingRecord[dbColumn])),
    values,
  }
}

function getImportKeyColumns(importConfig) {
  return importConfig.keyDbColumns?.length ? importConfig.keyDbColumns : [importConfig.lookupDbColumn]
}

function buildRowCompositeKey(row, importConfig, keyDbColumns) {
  const values = keyDbColumns.map((dbColumn) => {
    const column = importConfig.columns.find((candidate) => candidate.dbColumn === dbColumn)
    return column ? normalizeCell(readImportColumnValue(row, column)) : ''
  })

  return values.some(Boolean) ? values.join('\u001f') : ''
}

function buildDbCompositeKey(record, keyDbColumns) {
  return keyDbColumns.map((dbColumn) => normalizeComparableValue(record[dbColumn])).join('\u001f')
}

function hasImportColumnValue(row, column) {
  return [column.excelHeader, ...(column.aliases ?? [])].some((header) =>
    Object.prototype.hasOwnProperty.call(row, header),
  )
}

function readImportColumnValue(row, column) {
  for (const header of [column.excelHeader, ...(column.aliases ?? [])]) {
    if (Object.prototype.hasOwnProperty.call(row, header)) {
      return row[header]
    }
  }

  return undefined
}

async function bulkInsertMasterRows(client, tableName, rows) {
  const groups = new Map()

  for (const row of rows) {
    const fields = Object.keys(row)
    const groupKey = fields.join('|')
    const group = groups.get(groupKey) ?? { fields, rows: [] }
    group.rows.push(row)
    groups.set(groupKey, group)
  }

  for (const group of groups.values()) {
    const maxRowsPerChunk = Math.max(1, Math.floor(60000 / group.fields.length))

    for (let start = 0; start < group.rows.length; start += maxRowsPerChunk) {
      const chunk = group.rows.slice(start, start + maxRowsPerChunk)
      const values = []
      const placeholders = chunk.map((row, rowIndex) => {
        const base = rowIndex * group.fields.length
        values.push(...group.fields.map((field) => row[field]))
        return `(${group.fields.map((_, fieldIndex) => `$${base + fieldIndex + 1}`).join(', ')})`
      })

      await client.query(
        `
          INSERT INTO ${tableName} (${group.fields.join(', ')})
          VALUES ${placeholders.join(', ')}
        `,
        values,
      )
    }
  }
}

async function bulkUpdateMasterRows(client, importConfig, updates) {
  const groups = new Map()
  const keyDbColumns = getImportKeyColumns(importConfig)

  for (const update of updates) {
    const groupKey = update.fields.join('|')
    const group = groups.get(groupKey) ?? { fields: update.fields, updates: [] }
    group.updates.push(update)
    groups.set(groupKey, group)
  }

  for (const group of groups.values()) {
    const columnCount = keyDbColumns.length + group.fields.length
    const maxRowsPerChunk = Math.max(1, Math.floor(60000 / columnCount))

    for (let start = 0; start < group.updates.length; start += maxRowsPerChunk) {
      const chunk = group.updates.slice(start, start + maxRowsPerChunk)
      const values = []
      const valueRows = chunk.map((update, rowIndex) => {
        const base = rowIndex * columnCount
        values.push(...update.keyValues, ...update.values)
        return `(${Array.from({ length: columnCount }, (_, fieldIndex) => `$${base + fieldIndex + 1}`).join(', ')})`
      })
      const incomingColumns = [...keyDbColumns, ...group.fields]
      const assignments = group.fields.map((field) => `${field} = incoming.${field}`)
      const whereClause = keyDbColumns
        .map((field) => `target.${field} IS NOT DISTINCT FROM incoming.${field}`)
        .join(' AND ')

      await client.query(
        `
          UPDATE ${importConfig.tableName} AS target
          SET ${assignments.join(', ')},
              updated_at = CURRENT_TIMESTAMP
          FROM (
            VALUES ${valueRows.join(', ')}
          ) AS incoming(${incomingColumns.join(', ')})
          WHERE ${whereClause}
        `,
        values,
      )
    }
  }
}

export function normalizeDbValue(value, column) {
  const normalized = normalizeCell(value)

  if (normalized === '') {
    if (
      column.nullable ||
      column.type === 'date' ||
      ['warehouse_code', 'warehouse_description', 'on_hand_qty', 'description_1', 'activity_code', 'activity_description'].includes(column.dbColumn)
    ) {
      return null
    }

    return ''
  }

  if (column.type === 'date') {
    return normalizeDateValue(value)
  }

  if (column.dbColumn === 'on_hand_qty') {
    const numericValue = Number(normalized)
    return Number.isFinite(numericValue) ? numericValue : null
  }

  return normalized
}

export function normalizeCell(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function normalizeComparableValue(value) {
  if (value === null || value === undefined) {
    return ''
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return String(value).trim()
}

export function normalizeDateValue(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'number') {
    const parsedDate = xlsx.SSF.parse_date_code(value)
    if (parsedDate) {
      const month = String(parsedDate.m).padStart(2, '0')
      const day = String(parsedDate.d).padStart(2, '0')
      return `${parsedDate.y}-${month}-${day}`
    }
  }

  const textValue = String(value).trim()
  const isoMatch = textValue.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  }

  const slashMatch = textValue.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (slashMatch) {
    const first = Number(slashMatch[1])
    const second = Number(slashMatch[2])
    const year = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3]
    const day = first > 12 ? first : second
    const month = first > 12 ? second : first
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const parsed = new Date(textValue)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  return null
}

function throwBadRequest(message) {
  const error = new Error(message)
  error.statusCode = 400
  throw error
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

          if ((field.startsWith('scheduled_') || ['valid_from', 'valid_to'].includes(field)) && trimmedValue === '') {
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
