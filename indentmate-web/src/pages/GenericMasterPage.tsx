import { Alert, Button, Checkbox, Dropdown, Form, Input, Modal, Select, Spin, Switch, message } from 'antd'
import { Download, MoreVertical, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

const PAGE_SIZE = 100
const TABLE_HEADER_CELL_CLASS = 'bg-[#1b2e4b] px-3 py-[14px] text-[13px] font-semibold text-white tracking-[0.5px] normal-case border-b-2 border-[#0f1c30]'
const TABLE_HEADER_SELECTION_CLASS = 'bg-[#1b2e4b] px-3 py-[14px] text-center align-middle border-b-2 border-[#0f1c30] w-[44px]'
const TABLE_HEADER_ACTIONS_CLASS = `${TABLE_HEADER_CELL_CLASS} w-[88px] text-center`

type MasterImportColumn = {
  dbColumn: string
  excelHeader: string
  label: string
  aliases?: string[]
  isReadOnly?: boolean
}

type MasterImportMetadata = {
  excelLookupKey: string
  columns: MasterImportColumn[]
}

const MASTER_IMPORT_METADATA: Record<string, MasterImportMetadata> = {
  'project-master': {
    excelLookupKey: 'Project',
    columns: [
      { label: 'Project Code', excelHeader: 'Project', dbColumn: 'project_code', isReadOnly: true },
      { label: 'Project Description', excelHeader: 'Project Description', dbColumn: 'project_description' },
      { label: 'Dpr Engineer Control', excelHeader: 'DPR Engineer Control', dbColumn: 'dpr_engineer_control' },
      { label: 'Multi Location Act.', excelHeader: 'Multi Location Activity', dbColumn: 'multi_location_activity' },
      { label: 'Loc. Linked To Act.', excelHeader: 'Project Location Linked to Activities', dbColumn: 'project_location_linked_activities' },
    ],
  },
  'activity-master': {
    excelLookupKey: 'Activity',
    columns: [
      { label: 'Activity Code', excelHeader: 'Activity', dbColumn: 'activity_code', isReadOnly: true },
      { label: 'Project Code', excelHeader: 'Project', dbColumn: 'project_code' },
      { label: 'Description', excelHeader: 'Description', dbColumn: 'description' },
      { label: 'Activity Type', excelHeader: 'Activity Type', dbColumn: 'activity_type' },
      { label: 'Critical Capacity', excelHeader: 'Critical Capacity Type', dbColumn: 'critical_capacity_type' },
      { label: 'Auth Status', excelHeader: 'Work Auth Status', dbColumn: 'work_auth_status' },
      { label: 'Resource Required', excelHeader: 'Resource Required', dbColumn: 'resource_required' },
      { label: 'Start Date', excelHeader: 'Scheduled Start Date', dbColumn: 'scheduled_start_date' },
      { label: 'Finish Date', excelHeader: 'Scheduled Finish Date', dbColumn: 'scheduled_finish_date' },
    ],
  },
  'location-master': {
    excelLookupKey: 'Location',
    columns: [
      { label: 'Project Code', excelHeader: 'Project', dbColumn: 'project_code' },
      { label: 'Project Name', excelHeader: 'Project Name', dbColumn: 'project_name' },
      { label: 'Location Code', excelHeader: 'Location', dbColumn: 'location_code', isReadOnly: true },
      { label: 'Description', excelHeader: 'Description', dbColumn: 'description' },
      { label: 'Status', excelHeader: 'Status', dbColumn: 'status' },
    ],
  },
  'item-master': {
    excelLookupKey: 'ITEM CODE',
    columns: [
      { label: 'Site Code', excelHeader: 'SITE', dbColumn: 'project_site' },
      { label: 'Site Description', excelHeader: 'SITE Description', dbColumn: 'site_description' },
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
    excelLookupKey: 'Service Order',
    columns: [
      { label: 'Service Order', excelHeader: 'Service Order', dbColumn: 'service_order_no', isReadOnly: true },
      { label: 'Status', excelHeader: 'Status', dbColumn: 'status' },
      { label: 'Item Code', excelHeader: 'Item Code', dbColumn: 'item_code' },
      { label: 'Serial Number', excelHeader: 'Serial Number', dbColumn: 'serial_number' },
      { label: 'Project Site', excelHeader: 'Project Site', aliases: ['Site'], dbColumn: 'project_site' },
      { label: 'Description', excelHeader: 'Description', dbColumn: 'description' },
    ],
  },
  'business-partner-master': {
    excelLookupKey: 'Business Partner',
    columns: [
      { label: 'Project Code', excelHeader: 'Project', dbColumn: 'project_code' },
      { label: 'Project Description', excelHeader: 'Project Description', dbColumn: 'project_description' },
      { label: 'Location Code', excelHeader: 'Location', dbColumn: 'location_code' },
      { label: 'Location Description', excelHeader: 'Location Description', dbColumn: 'location_description' },
      { label: 'Activity Code', excelHeader: 'Activity', dbColumn: 'activity_code' },
      { label: 'Activity Description', excelHeader: 'Activity Description', dbColumn: 'activity_description' },
      { label: 'Business Partner Code', excelHeader: 'Business Partner', dbColumn: 'business_partner_code', isReadOnly: true },
      { label: 'Business Partner Name', excelHeader: 'BP Name', dbColumn: 'business_partner_name' },
    ],
  },
  'warehouse-master': {
    excelLookupKey: 'Warehouse',
    columns: [
      { label: 'Warehouse Code', excelHeader: 'Warehouse', dbColumn: 'warehouse_code', isReadOnly: true },
      { label: 'Warehouse Description', excelHeader: 'Warehouse Description', dbColumn: 'warehouse_description' },
      { label: 'Site Code', excelHeader: 'Site', dbColumn: 'project_site' },
      { label: 'Site Description', excelHeader: 'Site Description', dbColumn: 'site_description' },
      { label: 'Material Warehouse', excelHeader: 'Material Warehouse (Yes/No)', dbColumn: 'is_material_warehouse' },
      { label: 'Virtual Warehouse', excelHeader: 'Virtual Warehouse (Yes/No)', dbColumn: 'is_virtual_warehouse' },
    ],
  },
  'warehouse-bin-master': {
    excelLookupKey: 'Location',
    columns: [
      { label: 'Project Code', excelHeader: 'Project', dbColumn: 'project_code' },
      { label: 'Warehouse Code', excelHeader: 'Warehouse', dbColumn: 'warehouse_code' },
      { label: 'Warehouse Name', excelHeader: 'Warehouse Location', dbColumn: 'warehouse_name' },
      { label: 'Location Code', excelHeader: 'Location', dbColumn: 'location_code', isReadOnly: true },
      { label: 'Location Description', excelHeader: 'Location Description', dbColumn: 'location_description' },
      { label: 'Location Category', excelHeader: 'Location Category', dbColumn: 'location_category' },
    ],
  },
  'delivery-point-master': {
    excelLookupKey: 'Address Code',
    columns: [
      { label: 'Address Code', excelHeader: 'Address Code', dbColumn: 'address_code', isReadOnly: true },
      { label: 'Address Description', excelHeader: 'Address Code Description', dbColumn: 'address_description' },
      { label: 'Project Code', excelHeader: 'Project Code', dbColumn: 'project_code' },
      { label: 'Project Description', excelHeader: 'Project Description', dbColumn: 'project_description' },
      { label: 'Delivery Point', excelHeader: 'Delivery Point', dbColumn: 'delivery_point' },
      { label: 'Description I', excelHeader: 'Description I', dbColumn: 'description_1' },
    ],
  },
}

function defaultFieldsMapping(metadata?: MasterImportMetadata) {
  return Object.fromEntries(
    (metadata?.columns ?? []).flatMap((column) => [
      [column.excelHeader, true],
      ...(column.aliases ?? []).map((alias) => [alias, true]),
    ]),
  )
}

type FieldType = 'text' | 'textarea' | 'boolean' | 'checkboxText' | 'datetime' | 'number'

type MasterField = {
  key: string
  label: string
  required?: boolean
  type?: FieldType
  options?: Array<{ label: string; value: string }>
  minWidth?: string
}

type MasterConfig = {
  title: string
  subtitle: string
  countLabel: string
  addButtonLabel?: string
  addModalTitle?: string
  editModalTitle?: string
  fields: MasterField[]
  columns: MasterField[]
  searchFields?: Array<{ label: string; value: string; placeholder: string }>
}

const masterConfigs: Record<string, MasterConfig> = {
  'project-master': {
    title: 'Project Master',
    subtitle: 'Enterprise project catalogs, engineering controls, and coordination flags',
    countLabel: 'Records',
    fields: [
      { key: 'project_code', label: 'Project Code', required: true },
      { key: 'project_description', label: 'Project Description', required: true },
      { key: 'dpr_engineer_control', label: 'Dpr Engineer Control', required: true },
      { key: 'multi_location_activity', label: 'Multi Location Activity', required: true },
      { key: 'project_location_linked_activities', label: 'Project Location Linked to Activities', required: true },
    ],
    columns: [
      { key: 'project_code', label: 'Project Code' },
      { key: 'project_description', label: 'Project Description' },
      { key: 'dpr_engineer_control', label: 'Dpr Engineer Control' },
      { key: 'multi_location_activity', label: 'Multi Location Act.' },
      { key: 'project_location_linked_activities', label: 'Loc. Linked To Act.' },
    ],
    searchFields: [
      { label: 'Project Code', value: 'project_code', placeholder: 'Enter Project Code (e.g. NHRBGB001)...' },
      { label: 'Project Description', value: 'project_description', placeholder: 'Enter Project Description...' },
      { label: 'Dpr Engineer Control', value: 'dpr_engineer_control', placeholder: 'Enter DPR Engineer Control (LOCATION or ACTIVITY)...' },
      { label: 'Multi Location Activity', value: 'multi_location_activity', placeholder: 'Enter Multi Location Activity (YES or NO)...' },
      { label: 'Location Linked to Activities', value: 'project_location_linked_activities', placeholder: 'Enter Linked to Activities (YES or NO)...' },
    ],
  },
  'activity-master': {
    title: 'Activity Master',
    subtitle: 'Enterprise task schedules, critical dependencies, and resource tracking',
    countLabel: 'Records',
    fields: [
      { key: 'activity_code', label: 'Activity Code', required: true },
      { key: 'project_code', label: 'Project Code', required: true },
      { key: 'description', label: 'Description', required: true, type: 'textarea' },
      { key: 'activity_type', label: 'Activity Type', required: true },
      { key: 'critical_capacity_type', label: 'Critical Capacity Type', required: true },
      { key: 'work_auth_status', label: 'Work Auth Status', required: true },
      { key: 'resource_required', label: 'Resource Required', required: true },
      { key: 'scheduled_start_date', label: 'Scheduled Start Date', type: 'datetime' },
      { key: 'scheduled_finish_date', label: 'Scheduled Finish Date', type: 'datetime' },
    ],
    columns: [
      { key: 'activity_code', label: 'Activity Code' },
      { key: 'project_code', label: 'Project Code' },
      { key: 'description', label: 'Description' },
      { key: 'activity_type', label: 'Activity Type' },
      { key: 'critical_capacity_type', label: 'Critical Capacity' },
      { key: 'work_auth_status', label: 'Auth Status' },
      { key: 'resource_required', label: 'Resource Required' },
      { key: 'scheduled_start_date', label: 'Start Date', type: 'datetime' },
      { key: 'scheduled_finish_date', label: 'Finish Date', type: 'datetime' },
    ],
    searchFields: [
      { label: 'Activity Code', value: 'activity_code', placeholder: 'Enter Activity Code...' },
      { label: 'Project Code', value: 'project_code', placeholder: 'Enter Project Code (e.g. NUPEDS014)...' },
      { label: 'Description', value: 'description', placeholder: 'Enter Description...' },
      { label: 'Activity Type', value: 'activity_type', placeholder: 'Enter Activity Type (e.g. Work Package)...' },
      { label: 'Critical Capacity Type', value: 'critical_capacity_type', placeholder: 'Enter Critical Capacity Type...' },
      { label: 'Work Auth Status', value: 'work_auth_status', placeholder: 'Enter Work Auth Status...' },
      { label: 'Resource Required', value: 'resource_required', placeholder: 'Enter Resource Required (Yes or No)...' },
    ],
  },
  'location-master': {
    title: 'Location Master',
    subtitle: 'Enterprise site locations and project assignment metadata',
    countLabel: 'Records',
    fields: [
      { key: 'project_code', label: 'Project Code', required: true },
      { key: 'project_name', label: 'Project Name', required: true },
      { key: 'location_code', label: 'Location Code', required: true },
      { key: 'description', label: 'Description', required: true },
    ],
    columns: [
      { key: 'project_code', label: 'Project Code' },
      { key: 'project_name', label: 'Project Name' },
      { key: 'location_code', label: 'Location Code' },
      { key: 'description', label: 'Description' },
    ],
    searchFields: [
      { label: 'Project Code', value: 'project_code', placeholder: 'Enter Project Code (e.g. NHRBGB001)...' },
      { label: 'Project Name', value: 'project_name', placeholder: 'Enter Project Name...' },
      { label: 'Location Code', value: 'location_code', placeholder: 'Enter Location Code (e.g. CB)...' },
      { label: 'Description', value: 'description', placeholder: 'Enter Description...' },
    ],
  },
  'item-master': {
    title: 'Item Master',
    subtitle: 'Enterprise inventory ledger, material catalogs, and stock counts per site',
    countLabel: 'Records',
    fields: [
      { key: 'project_site', label: 'Site Code', required: true },
      { key: 'site_description', label: 'Site Description', required: true },
      { key: 'warehouse_code', label: 'Warehouse Code' },
      { key: 'warehouse_description', label: 'Warehouse Description' },
      { key: 'on_hand_qty', label: 'On Hand Qty', type: 'number' },
      { key: 'item_code', label: 'Item Code', required: true },
      { key: 'item_description', label: 'Item Description', required: true, type: 'textarea' },
      { key: 'purchase_unit', label: 'Purchase Unit (UOM)', required: true },
      { key: 'item_type', label: 'Item Type', required: true },
    ],
    columns: [
      { key: 'project_site', label: 'Site' },
      { key: 'site_description', label: 'Site Description' },
      { key: 'warehouse_code', label: 'Warehouse Code' },
      { key: 'warehouse_description', label: 'Warehouse Desc' },
      { key: 'on_hand_qty', label: 'On Hand Qty', type: 'number' },
      { key: 'item_code', label: 'Item Code' },
      { key: 'item_description', label: 'Item Description' },
      { key: 'purchase_unit', label: 'Purchase Unit' },
      { key: 'item_type', label: 'Item Type' },
    ],
    searchFields: [
      { label: 'Site Code', value: 'project_site', placeholder: 'Enter Site Code (e.g. EODBHS001)...' },
      { label: 'Site Description', value: 'site_description', placeholder: 'Enter Site Description...' },
      { label: 'Warehouse Code', value: 'warehouse_code', placeholder: 'Enter Warehouse Code (e.g. B80039)...' },
      { label: 'Item Code', value: 'item_code', placeholder: 'Enter Item Code (e.g. 1113131)...' },
      { label: 'Item Description', value: 'item_description', placeholder: 'Enter Item Description...' },
      { label: 'Item Type', value: 'item_type', placeholder: 'Enter Item Type (e.g. Product)...' },
    ],
  },
  'service-order-master': {
    title: 'Service Order Master',
    subtitle: 'Operational equipment deployment, maintenance logs, and task tracking',
    countLabel: 'Records',
    addButtonLabel: 'Add Service Order',
    addModalTitle: 'Add Service Order Master',
    editModalTitle: 'Edit Service Order Master',
    fields: [
      { key: 'service_order_no', label: 'Service Order', required: true },
      { key: 'status', label: 'Status', required: true },
      { key: 'item_code', label: 'Item Code' },
      { key: 'serial_number', label: 'Serial Number' },
      { key: 'project_site', label: 'Project Site', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
    columns: [
      { key: 'service_order_no', label: 'Service Order' },
      { key: 'status', label: 'Status' },
      { key: 'item_code', label: 'Item Code' },
      { key: 'serial_number', label: 'Serial Number' },
      { key: 'project_site', label: 'Project Site' },
      { key: 'description', label: 'Description', minWidth: '220px' },
    ],
    searchFields: [
      { label: 'Service Order', value: 'service_order_no', placeholder: 'Enter Service Order (e.g. BDSR00001)...' },
      { label: 'Status', value: 'status', placeholder: 'Enter Status (e.g. Released)...' },
      { label: 'Item Code', value: 'item_code', placeholder: 'Enter Item Code...' },
      { label: 'Serial Number', value: 'serial_number', placeholder: 'Enter Serial Number...' },
      { label: 'Project Site', value: 'project_site', placeholder: 'Enter Project Site (e.g. EODBHS001)...' },
      { label: 'Description', value: 'description', placeholder: 'Enter Description...' },
    ],
  },
  'business-partner-master': {
    title: 'Business Partner Activity Master',
    subtitle: 'Relational matrix linking projects, location boundaries, and subcontractors',
    countLabel: 'Records',
    addButtonLabel: 'Assign BP Act',
    addModalTitle: 'Add Business Partner Assignment',
    editModalTitle: 'Edit Business Partner Assignment',
    fields: [
      { key: 'project_code', label: 'Project Code', required: true },
      { key: 'project_description', label: 'Project Description', required: true },
      { key: 'location_code', label: 'Location Code', required: true },
      { key: 'location_description', label: 'Location Description' },
      { key: 'activity_code', label: 'Activity Code' },
      { key: 'activity_description', label: 'Activity Description' },
      { key: 'business_partner_code', label: 'Business Partner Code', required: true },
      { key: 'business_partner_name', label: 'Business Partner Name', required: true },
    ],
    columns: [
      { key: 'project_code', label: 'Project Code' },
      { key: 'location_code', label: 'Location Code' },
      { key: 'location_description', label: 'Location Description' },
      { key: 'activity_code', label: 'Activity Code' },
      { key: 'activity_description', label: 'Activity Description' },
      { key: 'business_partner_code', label: 'Partner Code' },
      { key: 'business_partner_name', label: 'Business Partner Name' },
    ],
    searchFields: [
      { label: 'Project Code', value: 'project_code', placeholder: 'Enter Project Code (e.g. WMHEDS002)...' },
      { label: 'Location Code', value: 'location_code', placeholder: 'Enter Location Code (e.g. AR1005)...' },
      { label: 'Location Description', value: 'location_description', placeholder: 'Enter Location Description...' },
      { label: 'Activity Code', value: 'activity_code', placeholder: 'Enter Activity Code...' },
      { label: 'Business Partner Code', value: 'business_partner_code', placeholder: 'Enter Partner Code (e.g. SC0000965)...' },
      { label: 'Business Partner Name', value: 'business_partner_name', placeholder: 'Enter Business Partner Name...' },
    ],
  },
  'warehouse-master': {
    title: 'Warehouse Master',
    subtitle: 'Corporate storage facilities, material yards, and virtual site boundaries',
    countLabel: 'Records',
    fields: [
      { key: 'warehouse_code', label: 'Warehouse Code', required: true },
      { key: 'warehouse_description', label: 'Warehouse Description', required: true },
      { key: 'project_site', label: 'Site Code', required: true },
      { key: 'site_description', label: 'Site Description', required: true },
      { key: 'is_material_warehouse', label: 'Material Warehouse', required: true, type: 'checkboxText' },
      { key: 'is_virtual_warehouse', label: 'Virtual Warehouse', required: true, type: 'checkboxText' },
    ],
    columns: [
      { key: 'warehouse_code', label: 'Warehouse Code' },
      { key: 'warehouse_description', label: 'Warehouse Description' },
      { key: 'project_site', label: 'Site Code' },
      { key: 'site_description', label: 'Site Description' },
      { key: 'is_material_warehouse', label: 'Material Warehouse', type: 'checkboxText' },
      { key: 'is_virtual_warehouse', label: 'Virtual Warehouse', type: 'checkboxText' },
    ],
    searchFields: [
      { label: 'Warehouse Code', value: 'warehouse_code', placeholder: 'Enter Warehouse Code (e.g. B80002)...' },
      { label: 'Warehouse Description', value: 'warehouse_description', placeholder: 'Enter Warehouse Description...' },
      { label: 'Site Code', value: 'project_site', placeholder: 'Enter Site Code (e.g. NHRBGB001)...' },
      { label: 'Site Description', value: 'site_description', placeholder: 'Enter Site Description...' },
    ],
  },
  'warehouse-bin-master': {
    title: 'Warehouse Location Master',
    subtitle: 'Granular storage bins, physical sub-locations, and sub-contractor yards',
    countLabel: 'Records',
    fields: [
      { key: 'project_code', label: 'Project Code', required: true },
      { key: 'warehouse_code', label: 'Warehouse Code', required: true },
      { key: 'warehouse_name', label: 'Warehouse Name', required: true },
      { key: 'location_code', label: 'Location Code', required: true },
      { key: 'location_description', label: 'Location Description', required: true, type: 'textarea' },
      {
        key: 'location_category',
        label: 'Location Category',
        required: true,
        options: [
          { label: 'Storage', value: 'Storage' },
          { label: 'Consumption', value: 'Consumption' },
          { label: 'Subcon/Prw', value: 'Subcon/Prw' },
          { label: 'Employee', value: 'Employee' },
        ],
      },
    ],
    columns: [
      { key: 'project_code', label: 'Project Code' },
      { key: 'warehouse_code', label: 'Warehouse Code' },
      { key: 'warehouse_name', label: 'Warehouse Name' },
      { key: 'location_code', label: 'Location Code' },
      { key: 'location_description', label: 'Location Description' },
      { key: 'location_category', label: 'Category' },
    ],
    searchFields: [
      { label: 'Project Code', value: 'project_code', placeholder: 'Enter Project Code (e.g. NUPEDS014)...' },
      { label: 'Warehouse Code', value: 'warehouse_code', placeholder: 'Enter Warehouse Code (e.g. E8V001)...' },
      { label: 'Warehouse Name', value: 'warehouse_name', placeholder: 'Enter Warehouse Name...' },
      { label: 'Location Code', value: 'location_code', placeholder: 'Enter Location Code (e.g. SC0000101)...' },
      { label: 'Location Category', value: 'location_category', placeholder: 'Enter Location Category (Storage, Consumption, Subcon/Prw, Employee)...' },
    ],
  },
  'delivery-point-master': {
    title: 'Delivery Master',
    subtitle: 'Enterprise site delivery points, logistics coordinates, and project addresses',
    countLabel: 'Records',
    fields: [
      { key: 'address_code', label: 'Address Code', required: true },
      { key: 'address_description', label: 'Address Description', required: true, type: 'textarea' },
      { key: 'project_code', label: 'Project Code', required: true },
      { key: 'project_description', label: 'Project Description', required: true },
      { key: 'delivery_point', label: 'Delivery Point', required: true },
      { key: 'description_1', label: 'Description I', type: 'textarea' },
    ],
    columns: [
      { key: 'address_code', label: 'Address Code' },
      { key: 'address_description', label: 'Address Description' },
      { key: 'project_code', label: 'Project Code' },
      { key: 'project_description', label: 'Project Description' },
      { key: 'delivery_point', label: 'Delivery Point' },
      { key: 'description_1', label: 'Description I' },
    ],
    searchFields: [
      { label: 'Address Code', value: 'address_code', placeholder: 'Enter Address Code (e.g. AD0000072)...' },
      { label: 'Address Description', value: 'address_description', placeholder: 'Enter Address Description...' },
      { label: 'Project Code', value: 'project_code', placeholder: 'Enter Project Code (e.g. NHRBGB001)...' },
      { label: 'Project Description', value: 'project_description', placeholder: 'Enter Project Description...' },
      { label: 'Delivery Point', value: 'delivery_point', placeholder: 'Enter Delivery Point (e.g. 0148)...' },
      { label: 'Description I', value: 'description_1', placeholder: 'Enter Description I...' },
    ],
  },
}

type MasterRecord = Record<string, unknown>

type ProjectOption = {
  code: string
  description: string
}

type MasterListResponse = {
  data: MasterRecord[]
  metadata?: {
    totalRecords: number
    totalPages: number
    currentPage: number
    limit: number
  }
}

const PROJECT_CODE_FIELD_KEYS = ['project_code', 'project_id', 'project_site']
const PROJECT_DESCRIPTION_FIELD_KEYS = ['project_description', 'project_name', 'site_description']

type LoadParams = {
  field?: string
  value?: string
  page?: number
}

type ProjectSyncSummary = {
  insertedCount: number
  updatedCount: number
  unchangedCount: number
  updatedRecordsLog: string[]
}

function displayValue(record: MasterRecord, field: MasterField) {
  const value = record[field.key]

  if (field.type === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  if (field.type === 'checkboxText') {
    return String(value).toLowerCase() === 'yes' ? 'Yes' : 'No'
  }

  if (field.type === 'datetime') {
    return formatDateTime(value)
  }

  if (field.type === 'number') {
    if (value === null || value === undefined || value === '') {
      return '-'
    }

    const numericValue = Number(value)
    if (Number.isNaN(numericValue)) {
      return String(value)
    }

    return numericValue.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    })
  }

  return value === null || value === undefined || value === '' ? '-' : String(value)
}

function formatDateTime(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  const date = new Date(String(value))

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${day}/${month}/${year} ${hours}:${minutes}`
}

function toDateTimeInputValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  const date = new Date(String(value))

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 16)
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function isStatusField(field: MasterField) {
  return field.key === 'status'
}

function isCodeField(field: MasterField) {
  return ['activity_code', 'project_code', 'project_site', 'location_code', 'site_code', 'item_code', 'warehouse_code', 'address_code', 'delivery_point', 'business_partner_code'].includes(field.key)
}

function isFlagField(field: MasterField) {
  return ['multi_location_activity', 'project_location_linked_activities'].includes(field.key)
}

function supportsInlineEdit(masterKey: string) {
  return ['project-master', 'location-master', 'activity-master', 'item-master', 'service-order-master', 'delivery-point-master', 'warehouse-master', 'warehouse-bin-master', 'business-partner-master'].includes(masterKey)
}

function isPaginatedMaster(masterKey: string) {
  return ['project-master', 'activity-master', 'item-master', 'service-order-master', 'delivery-point-master', 'location-master', 'warehouse-master', 'warehouse-bin-master', 'business-partner-master'].includes(masterKey)
}

function normalizeFormPayload(values: MasterRecord, fields: MasterField[]) {
  const fieldByKey = new Map(fields.map((field) => [field.key, field]))

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => {
      const field = fieldByKey.get(key)

      if (field?.type === 'checkboxText') {
        return [key, value ? 'Yes' : 'No']
      }

      return [key, typeof value === 'string' ? value.trim() : value]
    }),
  )
}

function getRecordSelectionKey(record: MasterRecord) {
  const rawKey = record.id
  return rawKey === null || rawKey === undefined ? '' : String(rawKey)
}

function isProjectCodeField(field: MasterField) {
  return PROJECT_CODE_FIELD_KEYS.includes(field.key)
}

function isProjectDescriptionField(field: MasterField) {
  return PROJECT_DESCRIPTION_FIELD_KEYS.includes(field.key)
}

function getProjectCodeFieldKey(fields: MasterField[]) {
  return fields.find((field) => isProjectCodeField(field))?.key
}

function getProjectDescriptionFieldKey(fields: MasterField[]) {
  return fields.find((field) => isProjectDescriptionField(field))?.key
}

function getColumnMinWidth(column: MasterField) {
  if (column.minWidth) {
    return column.minWidth
  }

  if (column.type === 'datetime') {
    return '130px'
  }

  if (column.type === 'number' || column.type === 'checkboxText') {
    return '110px'
  }

  if (column.key.includes('description')) {
    return '220px'
  }

  if (column.key.includes('name')) {
    return '170px'
  }

  if (isCodeField(column) || column.key.includes('id')) {
    return '120px'
  }

  return '150px'
}

export default function GenericMasterPage() {
  const { masterKey = '' } = useParams()
  const { user: currentUser } = useAuth()
  const config = useMemo(() => masterConfigs[masterKey], [masterKey])
  const isPaginated = isPaginatedMaster(masterKey)
  const importMetadata = MASTER_IMPORT_METADATA[masterKey]
  const supportsImportExport = Boolean(importMetadata)
  const isSuperAdmin = String(currentUser?.role ?? currentUser?.primary_role ?? '').trim() === 'Super Admin'
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [records, setRecords] = useState<MasterRecord[]>([])
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([])
  const [projectOptionsLoading, setProjectOptionsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([])
  const [fieldsMapping, setFieldsMapping] = useState<Record<string, boolean>>(
    () => defaultFieldsMapping(MASTER_IMPORT_METADATA['project-master']),
  )
  const [showMappingModal, setShowMappingModal] = useState(false)
  const [syncResults, setSyncResults] = useState<ProjectSyncSummary | null>(null)
  const [showResultsModal, setShowResultsModal] = useState(false)
  const visibleColumns = useMemo(() => {
    if (!config) {
      return []
    }

    return config.columns.filter((column) => {
      if (!supportsImportExport || !importMetadata) {
        return true
      }

      const importColumn = importMetadata.columns.find((metadataColumn) => metadataColumn.dbColumn === column.key)

      if (importColumn?.isReadOnly) {
        return true
      }

      return !importColumn || fieldsMapping[importColumn.excelHeader] === true
    })
  }, [config, fieldsMapping, importMetadata, supportsImportExport])
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedLocationId, setSelectedLocationId] = useState<string | number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchField, setSearchField] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isFilterActive, setIsFilterActive] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(() => new Set())
  const visibleRowKeys = useMemo(
    () => records.map(getRecordSelectionKey).filter(Boolean),
    [records],
  )
  const selectedVisibleCount = useMemo(
    () => visibleRowKeys.filter((rowKey) => selectedRowKeys.has(rowKey)).length,
    [selectedRowKeys, visibleRowKeys],
  )
  const allVisibleRowsSelected = visibleRowKeys.length > 0 && selectedVisibleCount === visibleRowKeys.length
  const someVisibleRowsSelected = selectedVisibleCount > 0 && selectedVisibleCount < visibleRowKeys.length
  const projectCodeSelectOptions = useMemo(
    () => projectOptions.map((project) => ({
      label: project.description ? `${project.code} - ${project.description}` : project.code,
      value: project.code,
    })),
    [projectOptions],
  )
  const projectDescriptionSelectOptions = useMemo(
    () => projectOptions.map((project) => ({
      label: project.code ? `${project.description} - ${project.code}` : project.description,
      value: project.description,
    })),
    [projectOptions],
  )

  async function loadProjectOptions() {
    setProjectOptionsLoading(true)

    try {
      const { data } = await api.get<MasterListResponse>('/api/master-data/project-master', {
        params: { limit: 500 },
      })
      const options = data.data
        .map((project) => ({
          code: String(project.project_code ?? '').trim(),
          description: String(project.project_description ?? '').trim(),
        }))
        .filter((project) => project.code || project.description)

      setProjectOptions(options)
    } catch (requestError) {
      console.error(requestError)
      message.error('Could not load project options')
    } finally {
      setProjectOptionsLoading(false)
    }
  }

  function handleProjectFieldChange(targetForm: ReturnType<typeof Form.useForm>[0], field: MasterField, value?: string) {
    targetForm.setFieldValue(field.key, value)

    if (!config) {
      return
    }

    const codeFieldKey = getProjectCodeFieldKey(config.fields)
    const descriptionFieldKey = getProjectDescriptionFieldKey(config.fields)

    if (!value) {
      if (isProjectCodeField(field) && descriptionFieldKey) {
        targetForm.setFieldValue(descriptionFieldKey, undefined)
      }

      if (isProjectDescriptionField(field) && codeFieldKey) {
        targetForm.setFieldValue(codeFieldKey, undefined)
      }

      return
    }

    if (isProjectCodeField(field) && descriptionFieldKey) {
      const selectedProject = projectOptions.find((project) => project.code === value)

      if (selectedProject?.description) {
        targetForm.setFieldValue(descriptionFieldKey, selectedProject.description)
      }
    }

    if (isProjectDescriptionField(field) && codeFieldKey) {
      const selectedProject = projectOptions.find((project) => project.description === value)

      if (selectedProject?.code) {
        targetForm.setFieldValue(codeFieldKey, selectedProject.code)
      }
    }
  }

  function renderFieldInput(field: MasterField, targetForm: ReturnType<typeof Form.useForm>[0]) {
    if (isProjectCodeField(field)) {
      return (
        <Select
          allowClear
          loading={projectOptionsLoading}
          onChange={(value) => handleProjectFieldChange(targetForm, field, value)}
          optionFilterProp="label"
          options={projectCodeSelectOptions}
          placeholder={`Select ${field.label}`}
          showSearch
        />
      )
    }

    if (isProjectDescriptionField(field)) {
      return (
        <Select
          allowClear
          loading={projectOptionsLoading}
          onChange={(value) => handleProjectFieldChange(targetForm, field, value)}
          optionFilterProp="label"
          options={projectDescriptionSelectOptions}
          placeholder={`Select ${field.label}`}
          showSearch
        />
      )
    }

    if (field.type === 'textarea') {
      return <Input.TextArea rows={3} />
    }

    if (['boolean', 'checkboxText'].includes(field.type ?? '')) {
      return <Switch />
    }

    if (field.options) {
      return <Select options={field.options} />
    }

    if (field.type === 'datetime') {
      return <Input type="datetime-local" />
    }

    if (field.type === 'number') {
      return <Input type="number" />
    }

    return <Input />
  }

  function clearSelectionBuffer() {
    setSelectedRowKeys(new Set())
  }

  function handleSelectRowToggle(rowKey: string) {
    if (!rowKey) {
      return
    }

    setSelectedRowKeys((currentSelection) => {
      const updatedSelection = new Set(currentSelection)

      if (updatedSelection.has(rowKey)) {
        updatedSelection.delete(rowKey)
      } else {
        updatedSelection.add(rowKey)
      }

      return updatedSelection
    })
  }

  function handleSelectAllVisibleToggle() {
    setSelectedRowKeys((currentSelection) => {
      const updatedSelection = new Set(currentSelection)
      const everyVisibleRowIsSelected = visibleRowKeys.every((rowKey) => updatedSelection.has(rowKey))

      if (everyVisibleRowIsSelected) {
        visibleRowKeys.forEach((rowKey) => updatedSelection.delete(rowKey))
      } else {
        visibleRowKeys.forEach((rowKey) => updatedSelection.add(rowKey))
      }

      return updatedSelection
    })
  }

  async function loadRecords(params?: LoadParams) {
    if (!config) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const requestParams = isPaginated
        ? {
          page: params?.page ?? currentPage,
          limit: PAGE_SIZE,
          ...(params?.field && params?.value ? { field: params.field, value: params.value } : {}),
        }
        : params?.field && params?.value
          ? { field: params.field, value: params.value }
          : undefined

      const { data } = await api.get<MasterListResponse>(`/api/master-data/${masterKey}`, {
        params: requestParams,
      })
      setRecords(data.data)

      if (isPaginated && data.metadata) {
        setCurrentPage(data.metadata.currentPage)
        setTotalPages(data.metadata.totalPages)
        setTotalRecords(data.metadata.totalRecords)
      } else {
        setTotalRecords(data.data.length)
        setTotalPages(1)
        setCurrentPage(1)
      }
    } catch (requestError) {
      console.error(requestError)
      setError(`Could not load ${config.title}. Check that the backend is running and you are logged in.`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setSearchField('')
    setSearchQuery('')
    setIsFilterActive(false)
    setCurrentPage(1)
    setImportFile(null)
    setDetectedHeaders([])
    setFieldsMapping(defaultFieldsMapping(MASTER_IMPORT_METADATA[masterKey]))
    setShowMappingModal(false)
    setSyncResults(null)
    setShowResultsModal(false)
    clearSelectionBuffer()
    loadRecords({ page: 1 })
    if (config?.fields.some((field) => isProjectCodeField(field) || isProjectDescriptionField(field))) {
      loadProjectOptions()
    }
  }, [masterKey])

  useEffect(() => {
    if (!isPaginated || !config) {
      return
    }

    loadRecords(isFilterActive && searchField && searchQuery.trim()
      ? { field: searchField, value: searchQuery.trim(), page: currentPage }
      : { page: currentPage })
  }, [currentPage])

  async function handleSearch() {
    const trimmedQuery = searchQuery.trim()

    if (!searchField || !trimmedQuery) {
      message.warning('Select a filter field and enter a search value.')
      return
    }

    setIsFilterActive(true)
    setCurrentPage(1)
    clearSelectionBuffer()
    await loadRecords({ field: searchField, value: trimmedQuery, page: 1 })
  }

  async function handleClearSearch() {
    setSearchField('')
    setSearchQuery('')
    setIsFilterActive(false)
    setCurrentPage(1)
    clearSelectionBuffer()
    await loadRecords({ page: 1 })
  }

  async function handleImportExecution(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !['xlsx', 'xls', 'csv'].includes(extension)) {
      message.error('Import file must be .xlsx, .xls, or .csv')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (readerEvent) => {
      try {
        const result = readerEvent.target?.result
        if (!result) {
          message.error('Could not read the selected file')
          return
        }

        const workbook = XLSX.read(new Uint8Array(result as ArrayBuffer), {
          type: 'array',
          sheetRows: 1,
        })
        const firstSheetName = workbook.SheetNames[0]
        const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : null
        const headerRows = firstSheet
          ? XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1, defval: '' })
          : []
        const headers = (headerRows[0] ?? [])
          .map((header) => String(header ?? '').trim())
          .filter(Boolean)

        if (!importMetadata) {
          message.error('Import is not available for this master')
          event.target.value = ''
          return
        }

        if (!headers.includes(importMetadata.excelLookupKey)) {
          message.error(`Import file must include the ${importMetadata.excelLookupKey} column`)
          event.target.value = ''
          return
        }

        const initialMapping = Object.fromEntries(
          headers.map((header) => [header, true]),
        )
        initialMapping[importMetadata.excelLookupKey] = true
        setDetectedHeaders(headers)
        setFieldsMapping(initialMapping)
        setImportFile(file)
        setShowMappingModal(true)
      } catch (error) {
        console.error(error)
        message.error('Could not parse the selected spreadsheet headers')
        event.target.value = ''
      }
    }
    reader.onerror = () => {
      message.error('Could not read the selected file')
      event.target.value = ''
    }
    reader.readAsArrayBuffer(file)
  }

  async function executeFinalImportPipeline() {
    if (!importMetadata) {
      message.error('Import is not available for this master')
      return
    }

    if (!importFile) {
      message.error('Choose a file before importing')
      return
    }

    const formData = new FormData()
    formData.append('file', importFile)
    formData.append('fieldsMapping', JSON.stringify(fieldsMapping))
    setImporting(true)

    try {
      const { data } = await api.post<{
        message?: string
        processedRows?: number
        summary?: ProjectSyncSummary
      }>(`/api/master-data/${masterKey}/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setShowMappingModal(false)
      setSyncResults(data.summary ?? null)
      setShowResultsModal(true)
      setImportFile(null)
      setDetectedHeaders([])
      clearSelectionBuffer()
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setCurrentPage(1)
      await loadRecords(isFilterActive && searchField && searchQuery.trim()
        ? { field: searchField, value: searchQuery.trim(), page: 1 }
        : { page: 1 })
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? 'Failed to import Project Master file')
    } finally {
      setImporting(false)
    }
  }

  async function handleExportExecution() {
    setExporting(true)

    try {
      const selectedKeys = Array.from(selectedRowKeys)
      const exportParams = selectedKeys.length > 0
        ? { selectedKeys: selectedKeys.join(',') }
        : isFilterActive && searchField && searchQuery.trim()
          ? { field: searchField, value: searchQuery.trim() }
          : undefined
      const { data } = await api.get<Blob>(`/api/master-data/${masterKey}/export`, {
        params: exportParams,
        responseType: 'blob',
      })
      const downloadUrl = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `${masterKey.replace(/-/g, '_')}_Export.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(downloadUrl)
      clearSelectionBuffer()
      message.success(selectedKeys.length > 0
        ? `${selectedKeys.length} selected record${selectedKeys.length === 1 ? '' : 's'} exported`
        : `${config.title} export started`)
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? `Failed to export ${config.title} data`)
    } finally {
      setExporting(false)
    }
  }

  async function handleCreate(values: MasterRecord) {
    setCreating(true)

    try {
      const payload = normalizeFormPayload(values, config.fields)
      await api.post<{ data: MasterRecord }>(`/api/master-data/${masterKey}`, payload)

      form.resetFields()
      setModalOpen(false)
      setCurrentPage(1)
      await loadRecords(isFilterActive && searchField && searchQuery.trim()
        ? { field: searchField, value: searchQuery.trim(), page: 1 }
        : { page: 1 })
      message.success(`${config.title} record created successfully`)
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? `Failed to create ${config.title} record`)
    } finally {
      setCreating(false)
    }
  }

  function handleOpenEdit(record: MasterRecord) {
    setSelectedLocationId(record.id as string | number)
    editForm.setFieldsValue(
      Object.fromEntries(
        (config?.fields ?? []).map((field) => [
          field.key,
          field.type === 'datetime'
            ? toDateTimeInputValue(record[field.key])
            : field.type === 'checkboxText'
              ? String(record[field.key]).toLowerCase() === 'yes'
              : record[field.key] ?? '',
        ]),
      ),
    )
    setIsEditModalOpen(true)
  }

  async function handleEdit(values: MasterRecord) {
    if (selectedLocationId === null) {
      return
    }

    setUpdating(true)

    try {
      const payload = normalizeFormPayload(values, config.fields)
      const { data } = await api.put<{ data: MasterRecord }>(
        `/api/master-data/${masterKey}/${selectedLocationId}`,
        payload,
      )

      setRecords((currentRecords) =>
        currentRecords.map((record) => record.id === selectedLocationId ? data.data : record),
      )
      setIsEditModalOpen(false)
      setSelectedLocationId(null)
      editForm.resetFields()
      await loadRecords(isFilterActive && searchField && searchQuery.trim()
        ? { field: searchField, value: searchQuery.trim(), page: currentPage }
        : { page: currentPage })
      message.success(`${config.title} record updated successfully`)
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? `Failed to update ${config.title} record`)
    } finally {
      setUpdating(false)
    }
  }

  const recordCount = isPaginated ? totalRecords : records.length
  const showingStart = recordCount === 0 ? 0 : ((currentPage - 1) * PAGE_SIZE) + 1
  const showingEnd = Math.min(currentPage * PAGE_SIZE, recordCount)

  if (!config) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800">Master Not Found</h3>
      </div>
    )
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">{config.title}</h3>
          <p className="mt-1 text-sm text-slate-500">{config.subtitle}</p>
        </div>

        {config.searchFields && (
          <div className="mt-4 flex flex-wrap items-center gap-[15px]">
            <Select
              allowClear
              className="min-w-[220px]"
              onChange={(value) => {
                setSearchField(value ?? '')
                setSearchQuery('')
              }}
              options={config.searchFields.map((field) => ({
                label: field.label,
                value: field.value,
              }))}
              placeholder="Select Field"
              value={searchField || undefined}
            />
            <Input
              className="max-w-[360px]"
              disabled={!searchField}
              onChange={(event) => setSearchQuery(event.target.value)}
              onPressEnter={handleSearch}
              placeholder={
                config.searchFields.find((field) => field.value === searchField)?.placeholder ??
                'Select a field first...'
              }
              value={searchQuery}
            />
          <Button onClick={handleSearch} type="primary">
              Search
            </Button>
            {isFilterActive && (
              <Button onClick={handleClearSearch} type="text">
                Clear
              </Button>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
            {recordCount} {config.countLabel}
          </span>
          {selectedRowKeys.size > 0 && (
            <span className="rounded-md bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
              {selectedRowKeys.size} row{selectedRowKeys.size === 1 ? '' : 's'} selected
            </span>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {supportsImportExport && (
              <>
                <input
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleImportExecution}
                  ref={fileInputRef}
                  type="file"
                />
                <Button
                  disabled={!isSuperAdmin || importing}
                  icon={<Upload size={16} />}
                  loading={importing}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Import
                </Button>
                <Button
                  disabled={!isSuperAdmin || exporting}
                  icon={<Download size={16} />}
                  loading={exporting}
                  onClick={handleExportExecution}
                >
                  Export
                </Button>
              </>
            )}
            <Button icon={<Plus size={16} />} onClick={() => setModalOpen(true)} type="primary">
              {masterKey === 'delivery-point-master'
                ? 'Add Delivery Pt'
                : masterKey === 'warehouse-bin-master'
                  ? 'Add Wh Location'
                  : config.addButtonLabel
                    ? config.addButtonLabel
                    : `Add ${config.title.replace(' Master', '')}`}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-5">
          <Alert message={error} type="error" showIcon />
        </div>
      )}

      {loading || importing ? (
        <div className="grid min-h-64 place-items-center">
          <Spin tip={importing ? `Importing ${config.title}...` : undefined} />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-full table-fixed divide-y divide-slate-200 text-left text-sm">
              <thead>
                <tr>
                  <th className={TABLE_HEADER_SELECTION_CLASS}>
                    <Checkbox
                      checked={allVisibleRowsSelected}
                      disabled={!records.length}
                      indeterminate={someVisibleRowsSelected}
                      onChange={handleSelectAllVisibleToggle}
                    />
                  </th>
                  {visibleColumns.map((column) => (
                    <th
                      className={TABLE_HEADER_CELL_CLASS}
                      key={column.key}
                      style={{ minWidth: getColumnMinWidth(column) }}
                    >
                      {column.label}
                    </th>
                  ))}
                  <th className={TABLE_HEADER_ACTIONS_CLASS}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {records.map((record, index) => {
                  const rowSelectionKey = getRecordSelectionKey(record)
                  const isRowSelected = selectedRowKeys.has(rowSelectionKey)

                  return (
                    <tr
                      className={`${isRowSelected ? 'bg-blue-50' : 'hover:bg-slate-50'} transition-colors`}
                      key={String(record.id ?? record[visibleColumns[0]?.key] ?? index)}
                    >
                      <td className="px-3 py-4 text-center align-middle">
                        <Checkbox
                          checked={isRowSelected}
                          disabled={!rowSelectionKey}
                          onChange={() => handleSelectRowToggle(rowSelectionKey)}
                        />
                      </td>
                      {visibleColumns.map((column) => (
                    <td
                      className={`whitespace-normal break-words px-3 py-4 align-middle text-slate-700 ${column.type === 'number' ? 'text-right' : ''}`}
                      style={{ minWidth: getColumnMinWidth(column) }}
                      key={column.key}
                    >
                        {isStatusField(column) ? (
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold text-white ${
                              record.status === 'Active' ? 'bg-green-600' : 'bg-red-600'
                            }`}
                          >
                            {displayValue(record, column)}
                          </span>
                        ) : column.type === 'checkboxText' ? (
                          <span className="flex justify-center">
                            <input
                              checked={displayValue(record, column) === 'Yes'}
                              className="h-4 w-4 cursor-not-allowed accent-blue-600"
                              disabled
                              readOnly
                              type="checkbox"
                            />
                          </span>
                        ) : (
                          <span
                            className={[
                              isCodeField(column) ? 'font-mono font-semibold text-slate-800' : '',
                              column.type === 'number' ? 'font-semibold text-slate-800' : '',
                              column.key === 'purchase_unit' ? 'inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700' : '',
                              column.key === 'business_partner_name' ? 'font-semibold text-slate-800' : '',
                              isFlagField(column) ? 'inline-flex rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700' : '',
                            ].filter(Boolean).join(' ') || undefined}
                          >
                            {displayValue(record, column)}
                          </span>
                        )}
                      </td>
                    ))}
                      <td className="w-[88px] px-3 py-4 text-center">
                        <div className="flex justify-center">
                          {supportsInlineEdit(masterKey) ? (
                            <Dropdown
                              menu={{
                                items: [
                                  {
                                    key: 'edit',
                                    icon: <Pencil size={16} />,
                                    label: 'Edit',
                                    onClick: () => handleOpenEdit(record),
                                  },
                                  {
                                    key: 'delete',
                                    icon: <Trash2 size={16} />,
                                    label: 'Delete',
                                    disabled: true,
                                  },
                                ],
                              }}
                              placement="bottomRight"
                              trigger={['click']}
                            >
                              <button
                                className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                                title={`${config.title} actions`}
                                type="button"
                              >
                                <MoreVertical size={20} />
                              </button>
                            </Dropdown>
                          ) : (
                            <button
                              className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                              title={`${config.title} actions`}
                              type="button"
                            >
                              <MoreVertical size={20} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {!records.length && (
              <div className="px-5 py-10 text-center text-sm text-slate-500">
                No records found.
              </div>
            )}
          </div>

          {isPaginated && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm text-slate-600">
              <span>
                Showing records {showingStart}-{showingEnd} of {recordCount}
              </span>
              <div className="flex items-center gap-3">
                <Button
                  disabled={currentPage === 1 || loading}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                >
                  Previous
                </Button>
                <span className="min-w-[110px] text-center font-semibold text-slate-700">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  disabled={currentPage === totalPages || loading}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {supportsImportExport && importMetadata && (
        <>
          <Modal
            confirmLoading={importing}
            okText="Confirm & Import"
            onCancel={() => {
              setShowMappingModal(false)
              setImportFile(null)
              setDetectedHeaders([])
              if (fileInputRef.current) {
                fileInputRef.current.value = ''
              }
            }}
            onOk={executeFinalImportPipeline}
            open={showMappingModal}
            title={`Configure ${config.title} Import`}
            width={760}
          >
            <p className="mb-4 text-sm text-slate-500">
              Select spreadsheet columns to sync into {config.title}.
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {detectedHeaders.map((header) => {
                const isLookupColumn = header === importMetadata.excelLookupKey
                const isSupported = importMetadata.columns.some((column) =>
                  column.excelHeader === header || (column.aliases ?? []).includes(header),
                )

                return (
                  <label
                    className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                      isSupported ? 'border-slate-200' : 'border-slate-100 bg-slate-50 text-slate-400'
                    }`}
                    key={header}
                  >
                    <Checkbox
                      checked={fieldsMapping[header] || false}
                      disabled={isLookupColumn}
                      onChange={(event) =>
                        setFieldsMapping((currentMapping) => ({
                          ...currentMapping,
                          [header]: event.target.checked,
                        }))
                      }
                    />
                    <span className="font-medium text-slate-700">
                      {isLookupColumn ? `${header} (Required)` : header}
                    </span>
                  </label>
                )
              })}
            </div>
          </Modal>

          <Modal
            footer={[
              <Button key="close" onClick={() => setShowResultsModal(false)} type="primary">
                Acknowledge & Close
              </Button>,
            ]}
            onCancel={() => setShowResultsModal(false)}
            open={showResultsModal}
            title="Spreadsheet Sync Audit Report"
            width={760}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-green-700">New Appended</p>
                <p className="mt-1 text-2xl font-bold text-green-800">{syncResults?.insertedCount ?? 0}</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-amber-700">Entries Modified</p>
                <p className="mt-1 text-2xl font-bold text-amber-800">{syncResults?.updatedCount ?? 0}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate-600">Records Unchanged</p>
                <p className="mt-1 text-2xl font-bold text-slate-800">{syncResults?.unchangedCount ?? 0}</p>
              </div>
            </div>

            {Boolean(syncResults?.updatedRecordsLog?.length) && (
              <div className="mt-5">
                <p className="mb-2 text-sm font-semibold text-slate-700">Modified Project Log</p>
                <div className="flex flex-wrap gap-2">
                  {syncResults?.updatedRecordsLog.map((projectCode) => (
                    <span
                      className="rounded-md bg-blue-50 px-2 py-1 font-mono text-xs font-semibold text-blue-700"
                      key={projectCode}
                    >
                      {projectCode}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Modal>
        </>
      )}

      <Modal
        confirmLoading={creating}
        okText="Create"
        onCancel={() => {
          setModalOpen(false)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        open={modalOpen}
        title={config.addModalTitle ?? `Add ${config.title}`}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} requiredMark={false}>
          {config.fields.map((field) => (
            <Form.Item
              key={field.key}
              label={field.label}
              name={field.key}
              rules={field.required ? [{ required: true, message: `${field.label} is required` }] : undefined}
              valuePropName={['boolean', 'checkboxText'].includes(field.type ?? '') ? 'checked' : undefined}
            >
              {renderFieldInput(field, form)}
            </Form.Item>
          ))}
        </Form>
      </Modal>

      {supportsInlineEdit(masterKey) && (
        <Modal
          confirmLoading={updating}
          okText="Save Changes"
          onCancel={() => {
            setIsEditModalOpen(false)
            setSelectedLocationId(null)
            editForm.resetFields()
          }}
          onOk={() => editForm.submit()}
          open={isEditModalOpen}
          title={config.editModalTitle ?? `Edit ${config.title}`}
          width={720}
        >
          <Form form={editForm} layout="vertical" onFinish={handleEdit} requiredMark={false}>
            <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
              {config.fields.map((field) => (
                <Form.Item
                  key={field.key}
                  label={field.label}
                  name={field.key}
                  rules={field.required ? [{ required: true, message: `${field.label} is required` }] : undefined}
                  valuePropName={['boolean', 'checkboxText'].includes(field.type ?? '') ? 'checked' : undefined}
                >
                  {renderFieldInput(field, editForm)}
                </Form.Item>
              ))}
            </div>
          </Form>
        </Modal>
      )}
    </section>
  )
}
