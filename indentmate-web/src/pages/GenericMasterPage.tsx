import { Alert, Button, Checkbox, Dropdown, Form, Input, Modal, Select, Spin, Switch, message } from 'antd'
import { Download, Filter, MoreVertical, Pencil, Plus, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { NumberedPagination } from '../components/NumberedPagination'
import { isPortalAdminRole } from '../utils/roles'

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
  'responsibility-master': {
    excelLookupKey: 'Employee ID',
    columns: [
      { label: 'Employee ID', excelHeader: 'Employee ID', dbColumn: 'employee_id', isReadOnly: true },
      { label: 'Employee Name', excelHeader: 'Employee Name', dbColumn: 'employee_name' },
      { label: 'Project ID', excelHeader: 'Project ID', dbColumn: 'project_id' },
      { label: 'Project Description', excelHeader: 'Project Description', dbColumn: 'project_description' },
      { label: 'Role', excelHeader: 'Responsibility', dbColumn: 'responsibility' },
      { label: 'Valid From', excelHeader: 'Valid From', dbColumn: 'valid_from' },
      { label: 'Valid To', excelHeader: 'Valid To', dbColumn: 'valid_to' },
    ],
  },
  'role-master': {
    excelLookupKey: 'Role Name',
    columns: [
      { label: 'Role Name', excelHeader: 'Role Name', dbColumn: 'role_name', isReadOnly: true },
      { label: 'Description', excelHeader: 'Description', dbColumn: 'description' },
    ],
  },
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
    excelLookupKey: 'Service Order',
    columns: [
      { label: 'Service Order', excelHeader: 'Service Order', dbColumn: 'service_order_no', isReadOnly: true },
      { label: 'Project Code', excelHeader: 'Project Code', aliases: ['Project Site', 'Site'], dbColumn: 'project_site' },
      { label: 'Project Description', excelHeader: 'Project Description', dbColumn: 'project_description' },
      { label: 'Item Code', excelHeader: 'Item Code', dbColumn: 'item_code' },
      { label: 'Item Description', excelHeader: 'Item Description', dbColumn: 'item_description' },
      { label: 'Serial Number', excelHeader: 'Serial Number', dbColumn: 'serial_number' },
      { label: 'Status', excelHeader: 'Status', dbColumn: 'status' },
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
  'business-partner-code-master': {
    excelLookupKey: 'Business Partner',
    columns: [
      { label: 'Business Partner Code', excelHeader: 'Business Partner', dbColumn: 'business_partner_code', isReadOnly: true },
      { label: 'Business Partner Name', excelHeader: 'BP Name', dbColumn: 'business_partner_name' },
    ],
  },
  'warehouse-master': {
    excelLookupKey: 'Warehouse',
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
    excelLookupKey: 'Location',
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
    excelLookupKey: 'Address Code',
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
    excelLookupKey: 'Employee ID',
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
    excelLookupKey: 'Rental Order',
    columns: [
      { label: 'Rental Order', excelHeader: 'Rental Order', dbColumn: 'rental_order', isReadOnly: true },
      { label: 'Rental Description', excelHeader: 'Rental Description', dbColumn: 'rental_description' },
      { label: 'Status', excelHeader: 'Status', dbColumn: 'status' },
      { label: 'Project Code', excelHeader: 'Project', dbColumn: 'project_code' },
      { label: 'Project Description', excelHeader: 'Project Description', dbColumn: 'project_description' },
      { label: 'Item Type', excelHeader: 'Item Type in Transaction', dbColumn: 'item_type_in_transaction' },
      { label: 'Item Code', excelHeader: 'Item', dbColumn: 'item_code' },
      { label: 'Item Description', excelHeader: 'Item Description', dbColumn: 'item_description' },
    ],
  },
  'purchase-office-master': {
    excelLookupKey: 'Purchase Order',
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
    excelLookupKey: 'Purchase Office',
    columns: [
      { label: 'Purchase Office', excelHeader: 'Purchase Office', dbColumn: 'purchase_office', isReadOnly: true },
      { label: 'Purchase Office Description', excelHeader: 'Purchase Office Description', dbColumn: 'purchase_office_description' },
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

function exportFilename(masterTitle: string) {
  return `${masterTitle.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')}_Export.xlsx`
}

type FieldType = 'text' | 'textarea' | 'boolean' | 'checkboxText' | 'datetime' | 'date' | 'number'

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
  'responsibility-master': {
    title: 'User Assignment Master',
    subtitle: 'Project-wise user role assignments and validity periods',
    countLabel: 'Assignments',
    addButtonLabel: 'Add Assignment',
    addModalTitle: 'Add User Project Assignment',
    editModalTitle: 'Edit User Project Assignment',
    fields: [
      { key: 'project_id', label: 'Project ID', required: true },
      { key: 'project_description', label: 'Project Description', required: true },
      { key: 'employee_id', label: 'User ID', required: true },
      { key: 'employee_name', label: 'Username', required: true },
      { key: 'responsibility', label: 'Role', required: true },
      { key: 'valid_from', label: 'Valid From', type: 'date' },
      { key: 'valid_to', label: 'Valid To', type: 'date' },
    ],
    columns: [
      { key: 'project_id', label: 'Project ID' },
      { key: 'project_description', label: 'Project Description', minWidth: '220px' },
      { key: 'employee_id', label: 'User ID' },
      { key: 'employee_name', label: 'Username' },
      { key: 'responsibility', label: 'Role', minWidth: '190px' },
      { key: 'valid_from', label: 'Valid From', type: 'date' },
      { key: 'valid_to', label: 'Valid To', type: 'date' },
    ],
    searchFields: [
      { label: 'Project ID', value: 'project_id', placeholder: 'Enter Project ID...' },
      { label: 'Project Description', value: 'project_description', placeholder: 'Enter Project Description...' },
      { label: 'User ID', value: 'employee_id', placeholder: 'Enter User ID...' },
      { label: 'Username', value: 'employee_name', placeholder: 'Enter Username...' },
      { label: 'Role', value: 'responsibility', placeholder: 'Enter Role...' },
    ],
  },
  'role-master': {
    title: 'Role Master',
    subtitle: 'Portal role catalog used for User Master assignments',
    countLabel: 'Roles',
    addButtonLabel: 'Add Role',
    addModalTitle: 'Add Role Master',
    editModalTitle: 'Edit Role Master',
    fields: [
      { key: 'role_name', label: 'Role Name', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
    columns: [
      { key: 'role_name', label: 'Role Name' },
      { key: 'description', label: 'Description', minWidth: '220px' },
    ],
    searchFields: [
      { label: 'Role Name', value: 'role_name', placeholder: 'Enter Role Name...' },
      { label: 'Description', value: 'description', placeholder: 'Enter Description...' },
    ],
  },
  'project-master': {
    title: 'Project Master',
    subtitle: 'Enterprise project catalogs, engineering controls, and coordination flags',
    countLabel: 'Records',
    fields: [
      { key: 'project_code', label: 'Project Code', required: true },
      { key: 'project_description', label: 'Project Description', required: true },
      {
        key: 'dpr_engineer_control',
        label: 'Dpr Engineer Control',
        required: true,
        options: [{ label: 'Location', value: 'LOCATION' }, { label: 'Activity', value: 'ACTIVITY' }, { label: 'Loc/Activity', value: 'LOC/ACTIVITY' }],
      },
      {
        key: 'multi_location_activity',
        label: 'Multi Location Activity',
        required: true,
        options: [{ label: 'Yes', value: 'YES' }, { label: 'No', value: 'NO' }],
      },
      {
        key: 'project_location_linked_activities',
        label: 'Project Location Linked to Activities',
        required: true,
        options: [{ label: 'Yes', value: 'YES' }, { label: 'No', value: 'NO' }],
      },
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
      { key: 'project_code', label: 'Project Code', required: true },
      { key: 'activity_code', label: 'Activity Code', required: true },
      { key: 'description', label: 'Description', required: true, type: 'textarea' },
      { key: 'activity_type', label: 'Activity Type', required: true },
      { key: 'critical_capacity_type', label: 'Critical Capacity Type', required: true },
      { key: 'work_auth_status', label: 'Work Auth Status', required: true },
      { key: 'resource_required', label: 'Resource Required', required: true },
      { key: 'scheduled_start_date', label: 'Scheduled Start Date', type: 'date' },
      { key: 'scheduled_finish_date', label: 'Scheduled Finish Date', type: 'date' },
    ],
    columns: [
      { key: 'project_code', label: 'Project Code' },
      { key: 'project_description', label: 'Project Description' },
      { key: 'activity_code', label: 'Activity Code' },
      { key: 'description', label: 'Description' },
      { key: 'activity_type', label: 'Activity Type' },
      { key: 'critical_capacity_type', label: 'Critical Capacity' },
      { key: 'work_auth_status', label: 'Auth Status' },
      { key: 'resource_required', label: 'Resource Required' },
      { key: 'scheduled_start_date', label: 'Start Date', type: 'date' },
      { key: 'scheduled_finish_date', label: 'Finish Date', type: 'date' },
    ],
    searchFields: [
      { label: 'Activity Code', value: 'activity_code', placeholder: 'Enter Activity Code...' },
      { label: 'Project Code', value: 'project_code', placeholder: 'Enter Project Code (e.g. NUPEDS014)...' },
      { label: 'Activity Type', value: 'activity_type', placeholder: 'Enter Activity Type (e.g. Work Package)...' },
      { label: 'Critical Capacity Type', value: 'critical_capacity_type', placeholder: 'Enter Critical Capacity Type...' },
      { label: 'Work Auth Status', value: 'work_auth_status', placeholder: 'Enter Work Auth Status...' },
      { label: 'Resource Required', value: 'resource_required', placeholder: 'Enter Resource Required (Yes or No)...' },
      { label: 'Start Date', value: 'scheduled_start_date', placeholder: 'Enter Start Date (YYYY-MM-DD)...' },
      { label: 'Finish Date', value: 'scheduled_finish_date', placeholder: 'Enter Finish Date (YYYY-MM-DD)...' },
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
      { key: 'project_site', label: 'Project Code', required: true },
      { key: 'site_description', label: 'Project Description', required: true },
      { key: 'warehouse_code', label: 'Warehouse Code' },
      { key: 'warehouse_description', label: 'Warehouse Description' },
      { key: 'on_hand_qty', label: 'On Hand Qty', type: 'number' },
      { key: 'item_code', label: 'Item Code', required: true },
      { key: 'item_description', label: 'Item Description', required: true, type: 'textarea' },
      { key: 'purchase_unit', label: 'Purchase Unit (UOM)', required: true },
      { key: 'item_type', label: 'Item Type', required: true },
    ],
    columns: [
      { key: 'project_site', label: 'Project Code' },
      { key: 'site_description', label: 'Project Description' },
      { key: 'warehouse_code', label: 'Warehouse Code' },
      { key: 'warehouse_description', label: 'Warehouse Description' },
      { key: 'on_hand_qty', label: 'On Hand Qty', type: 'number' },
      { key: 'item_code', label: 'Item Code' },
      { key: 'item_description', label: 'Item Description' },
      { key: 'purchase_unit', label: 'Purchase Unit' },
      { key: 'item_type', label: 'Item Type' },
    ],
    searchFields: [
      { label: 'Project Code', value: 'project_site', placeholder: 'Enter Project Code (e.g. EODBHS001)...' },
      { label: 'Project Description', value: 'site_description', placeholder: 'Enter Project Description...' },
      { label: 'Warehouse Code', value: 'warehouse_code', placeholder: 'Enter Warehouse Code (e.g. B80039)...' },
      { label: 'On Hand Qty', value: 'on_hand_qty', placeholder: 'Enter On Hand Qty...' },
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
      { key: 'project_site', label: 'Project Code', required: true },
      { key: 'project_description', label: 'Project Description', required: true },
      { key: 'item_code', label: 'Item Code', required: true },
      { key: 'item_description', label: 'Item Description', required: true, type: 'textarea' },
      { key: 'serial_number', label: 'Serial Number' },
      { key: 'status', label: 'Status', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
    columns: [
      { key: 'service_order_no', label: 'Service Order' },
      { key: 'project_site', label: 'Project Code' },
      { key: 'project_description', label: 'Project Description' },
      { key: 'item_code', label: 'Item Code' },
      { key: 'item_description', label: 'Item Description', minWidth: '220px' },
      { key: 'serial_number', label: 'Serial Number' },
      { key: 'status', label: 'Status' },
    ],
    searchFields: [
      { label: 'Service Order', value: 'service_order_no', placeholder: 'Enter Service Order (e.g. BDSR00001)...' },
      { label: 'Project Code', value: 'project_site', placeholder: 'Enter Project Code (e.g. EODBHS001)...' },
      { label: 'Project Description', value: 'project_description', placeholder: 'Enter Project Description...' },
      { label: 'Item Code', value: 'item_code', placeholder: 'Enter Item Code...' },
      { label: 'Serial Number', value: 'serial_number', placeholder: 'Enter Serial Number...' },
      { label: 'Status', value: 'status', placeholder: 'Enter Status (e.g. Released)...' },
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
      { key: 'project_description', label: 'Project Description' },
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
  'business-partner-code-master': {
    title: 'Business Partner Master',
    subtitle: 'Business partner code and name catalog used by BP activity assignments',
    countLabel: 'Partners',
    addButtonLabel: 'Add Business Partner',
    addModalTitle: 'Add Business Partner',
    editModalTitle: 'Edit Business Partner',
    fields: [
      { key: 'business_partner_code', label: 'Business Partner Code', required: true },
      { key: 'business_partner_name', label: 'Business Partner Name', required: true },
    ],
    columns: [
      { key: 'business_partner_code', label: 'Business Partner Code' },
      { key: 'business_partner_name', label: 'Business Partner Name', minWidth: '240px' },
    ],
    searchFields: [
      { label: 'Business Partner Code', value: 'business_partner_code', placeholder: 'Enter Business Partner Code...' },
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
      { key: 'project_site', label: 'Project Code', required: true },
      { key: 'site_description', label: 'Project Description', required: true },
      { key: 'is_material_warehouse', label: 'Material Warehouse', required: true, type: 'checkboxText' },
      { key: 'is_virtual_warehouse', label: 'Virtual Warehouse', required: true, type: 'checkboxText' },
    ],
    columns: [
      { key: 'warehouse_code', label: 'Warehouse Code' },
      { key: 'warehouse_description', label: 'Warehouse Description' },
      { key: 'project_site', label: 'Project Code' },
      { key: 'site_description', label: 'Project Description' },
      { key: 'is_material_warehouse', label: 'Material Warehouse', type: 'checkboxText' },
      { key: 'is_virtual_warehouse', label: 'Virtual Warehouse', type: 'checkboxText' },
    ],
    searchFields: [
      { label: 'Warehouse Code', value: 'warehouse_code', placeholder: 'Enter Warehouse Code (e.g. B80002)...' },
      { label: 'Warehouse Description', value: 'warehouse_description', placeholder: 'Enter Warehouse Description...' },
      { label: 'Project Code', value: 'project_site', placeholder: 'Enter Project Code (e.g. NHRBGB001)...' },
      { label: 'Project Description', value: 'site_description', placeholder: 'Enter Project Description...' },
    ],
  },
  'warehouse-bin-master': {
    title: 'Warehouse Location Master',
    subtitle: 'Granular storage bins, physical sub-locations, and sub-contractor yards',
    countLabel: 'Records',
    fields: [
      { key: 'project_code', label: 'Project Code', required: true },
      { key: 'project_description', label: 'Project Description', required: true },
      { key: 'warehouse_code', label: 'Warehouse Code', required: true },
      { key: 'warehouse_name', label: 'Warehouse Description', required: true },
      { key: 'location_code', label: 'Location Code', required: true },
      { key: 'location_description', label: 'Location Description', required: true, type: 'textarea' },
      { key: 'location_category', label: 'Location Category', required: true },
    ],
    columns: [
      { key: 'project_code', label: 'Project Code' },
      { key: 'project_description', label: 'Project Description' },
      { key: 'warehouse_code', label: 'Warehouse Code' },
      { key: 'warehouse_name', label: 'Warehouse Description' },
      { key: 'location_code', label: 'Location Code' },
      { key: 'location_description', label: 'Location Description' },
      { key: 'location_category', label: 'Category' },
    ],
    searchFields: [
      { label: 'Project Code', value: 'project_code', placeholder: 'Enter Project Code (e.g. NUPEDS014)...' },
      { label: 'Project Description', value: 'project_description', placeholder: 'Enter Project Description...' },
      { label: 'Warehouse Code', value: 'warehouse_code', placeholder: 'Enter Warehouse Code (e.g. E8V001)...' },
      { label: 'Warehouse Description', value: 'warehouse_name', placeholder: 'Enter Warehouse Description...' },
      { label: 'Location Code', value: 'location_code', placeholder: 'Enter Location Code (e.g. SC0000101)...' },
      { label: 'Location Category', value: 'location_category', placeholder: 'Enter Location Category (Storage, Consumption, Subcon/Prw, Employee)...' },
    ],
  },
  'delivery-point-master': {
    title: 'Delivery Master',
    subtitle: 'Enterprise site delivery points, logistics coordinates, and project addresses',
    countLabel: 'Records',
    fields: [
      { key: 'project_code', label: 'Project Code', required: true },
      { key: 'project_description', label: 'Project Description', required: true },
      { key: 'address_code', label: 'Address Code', required: true },
      { key: 'address_description', label: 'Address Description', required: true, type: 'textarea' },
      { key: 'delivery_point', label: 'Delivery Point', required: true },
      { key: 'description_1', label: 'Description I', type: 'textarea' },
    ],
    columns: [
      { key: 'project_code', label: 'Project Code' },
      { key: 'project_description', label: 'Project Description' },
      { key: 'address_code', label: 'Address Code' },
      { key: 'address_description', label: 'Address Description' },
      { key: 'delivery_point', label: 'Delivery Point' },
      { key: 'description_1', label: 'Description I' },
    ],
    searchFields: [
      { label: 'Project Code', value: 'project_code', placeholder: 'Enter Project Code (e.g. NHRBGB001)...' },
      { label: 'Project Description', value: 'project_description', placeholder: 'Enter Project Description...' },
      { label: 'Address Code', value: 'address_code', placeholder: 'Enter Address Code (e.g. AD0000072)...' },
      { label: 'Address Description', value: 'address_description', placeholder: 'Enter Address Description...' },
      { label: 'Delivery Point', value: 'delivery_point', placeholder: 'Enter Delivery Point (e.g. 0148)...' },
      { label: 'Description I', value: 'description_1', placeholder: 'Enter Description I...' },
    ],
  },
  'engineer-activity-master': {
    title: 'Engineer by Activity Master',
    subtitle: 'Engineer assignment matrix by project, location, and activity',
    countLabel: 'Records',
    addButtonLabel: 'Add Engineer Assignment',
    addModalTitle: 'Add Engineer Assignment',
    editModalTitle: 'Edit Engineer Assignment',
    fields: [
      { key: 'project_code', label: 'Project Code', required: true },
      { key: 'project_description', label: 'Project Description', required: true },
      { key: 'location_code', label: 'Location Code', required: true },
      { key: 'location_description', label: 'Location Description', required: true, type: 'textarea' },
      { key: 'activity_code', label: 'Activity Code' },
      { key: 'activity_description', label: 'Activity Description', type: 'textarea' },
      { key: 'employee_id', label: 'Employee ID', required: true },
      { key: 'employee_name', label: 'Employee Name', required: true },
    ],
    columns: [
      { key: 'project_code', label: 'Project Code' },
      { key: 'project_description', label: 'Project Description' },
      { key: 'location_code', label: 'Location Code' },
      { key: 'location_description', label: 'Location Description' },
      { key: 'activity_code', label: 'Activity Code' },
      { key: 'activity_description', label: 'Activity Description' },
      { key: 'employee_id', label: 'Employee ID' },
      { key: 'employee_name', label: 'Employee Name' },
    ],
    searchFields: [
      { label: 'Project Code', value: 'project_code', placeholder: 'Enter Project Code...' },
      { label: 'Project Description', value: 'project_description', placeholder: 'Enter Project Description...' },
      { label: 'Location Code', value: 'location_code', placeholder: 'Enter Location Code...' },
      { label: 'Location Description', value: 'location_description', placeholder: 'Enter Location Description...' },
      { label: 'Activity Code', value: 'activity_code', placeholder: 'Enter Activity Code...' },
      { label: 'Employee ID', value: 'employee_id', placeholder: 'Enter Employee ID...' },
      { label: 'Employee Name', value: 'employee_name', placeholder: 'Enter Employee Name...' },
    ],
  },
  'rental-order-master': {
    title: 'Rental Order Master',
    subtitle: 'Rental orders, project assignment, and item transaction details',
    countLabel: 'Records',
    addButtonLabel: 'Add Rental Order',
    addModalTitle: 'Add Rental Order',
    editModalTitle: 'Edit Rental Order',
    fields: [
      { key: 'rental_order', label: 'Rental Order', required: true },
      { key: 'rental_description', label: 'Rental Description', required: true, type: 'textarea' },
      { key: 'status', label: 'Status', required: true },
      { key: 'project_code', label: 'Project Code', required: true },
      { key: 'project_description', label: 'Project Description', required: true },
      { key: 'item_type_in_transaction', label: 'Item Type in Transaction', required: true },
      { key: 'item_code', label: 'Item Code' },
      { key: 'item_description', label: 'Item Description', type: 'textarea' },
    ],
    columns: [
      { key: 'rental_order', label: 'Rental Order' },
      { key: 'rental_description', label: 'Rental Description' },
      { key: 'status', label: 'Status' },
      { key: 'project_code', label: 'Project Code' },
      { key: 'project_description', label: 'Project Description' },
      { key: 'item_type_in_transaction', label: 'Item Type' },
      { key: 'item_code', label: 'Item Code' },
      { key: 'item_description', label: 'Item Description' },
    ],
    searchFields: [
      { label: 'Rental Order', value: 'rental_order', placeholder: 'Enter Rental Order...' },
      { label: 'Rental Description', value: 'rental_description', placeholder: 'Enter Rental Description...' },
      { label: 'Status', value: 'status', placeholder: 'Enter Status...' },
      { label: 'Project Code', value: 'project_code', placeholder: 'Enter Project Code...' },
      { label: 'Project Description', value: 'project_description', placeholder: 'Enter Project Description...' },
      { label: 'Item Type', value: 'item_type_in_transaction', placeholder: 'Enter Item Type...' },
      { label: 'Item Code', value: 'item_code', placeholder: 'Enter Item Code...' },
    ],
  },
  'purchase-office-master': {
    title: 'Purchase Order Master',
    subtitle: 'Purchase order office ownership and buy-from business partner details',
    countLabel: 'Records',
    addButtonLabel: 'Add Purchase Order',
    addModalTitle: 'Add Purchase Order',
    editModalTitle: 'Edit Purchase Order',
    fields: [
      { key: 'purchase_order', label: 'Purchase Order', required: true },
      { key: 'buy_from_business_partner', label: 'BP Code', required: true },
      { key: 'bp_description', label: 'BP Description', required: true, type: 'textarea' },
      { key: 'status', label: 'Status', required: true },
      { key: 'purchase_office', label: 'Purchase Office', required: true },
      { key: 'purchase_office_description', label: 'Purchase Office Description', required: true, type: 'textarea' },
    ],
    columns: [
      { key: 'purchase_order', label: 'Purchase Order' },
      { key: 'buy_from_business_partner', label: 'BP Code' },
      { key: 'bp_description', label: 'BP Description' },
      { key: 'status', label: 'Status' },
      { key: 'purchase_office', label: 'Purchase Office' },
      { key: 'purchase_office_description', label: 'Purchase Office Description' },
    ],
    searchFields: [
      { label: 'Purchase Order', value: 'purchase_order', placeholder: 'Enter Purchase Order...' },
      { label: 'BP Code', value: 'buy_from_business_partner', placeholder: 'Enter BP Code...' },
      { label: 'BP Description', value: 'bp_description', placeholder: 'Enter BP Description...' },
      { label: 'Status', value: 'status', placeholder: 'Enter Status...' },
      { label: 'Purchase Office', value: 'purchase_office', placeholder: 'Enter Purchase Office...' },
      { label: 'Purchase Office Description', value: 'purchase_office_description', placeholder: 'Enter Purchase Office Description...' },
    ],
  },
  'purchase-office-code-master': {
    title: 'Purchase Office Master',
    subtitle: 'Purchase office code and description catalog used by purchase orders',
    countLabel: 'Purchase Offices',
    addButtonLabel: 'Add Purchase Office',
    addModalTitle: 'Add Purchase Office',
    editModalTitle: 'Edit Purchase Office',
    fields: [
      { key: 'purchase_office', label: 'Purchase Office', required: true },
      { key: 'purchase_office_description', label: 'Purchase Office Description', required: true, type: 'textarea' },
    ],
    columns: [
      { key: 'purchase_office', label: 'Purchase Office' },
      { key: 'purchase_office_description', label: 'Purchase Office Description', minWidth: '260px' },
    ],
    searchFields: [
      { label: 'Purchase Office', value: 'purchase_office', placeholder: 'Enter Purchase Office...' },
      { label: 'Purchase Office Description', value: 'purchase_office_description', placeholder: 'Enter Purchase Office Description...' },
    ],
  },
}

type MasterRecord = Record<string, unknown>

type ProjectOption = {
  code: string
  description: string
}

type LocationOption = {
  project_code: string
  project_name: string
  location_code: string
  description: string
}

type BusinessPartnerOption = {
  business_partner_code: string
  business_partner_name: string
}

type ItemOption = {
  project_site: string
  site_description: string
  item_code: string
  item_description: string
  purchase_unit: string
  item_type: string
}

type PurchaseOfficeOption = {
  purchase_office: string
  purchase_office_description: string
}

type WarehouseOption = {
  warehouse_code: string
  warehouse_description: string
  project_site: string
  site_description: string
}

type UserOption = {
  employee_id: string
  employee_name: string
}

type RoleOption = {
  role_name: string
  responsibility: string
}

type SelectOption = {
  label: string
  value: string
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

type FilterValueOptionsResponse = {
  data: Array<string | { label: string; value: string }>
}

function normalizeFilterValueOptions(options: FilterValueOptionsResponse['data']) {
  const seen = new Set<string>()
  const uniqueOptions: SelectOption[] = []

  options.forEach((option) => {
    const mappedOption = typeof option === 'string'
      ? { label: option, value: option }
      : { label: option.label, value: option.value }
    const label = String(mappedOption.label ?? '').trim()
    const value = String(mappedOption.value ?? '').trim()

    if (!label || !value) {
      return
    }

    const key = `${value.toLowerCase()}::${label.toLowerCase()}`
    if (seen.has(key)) {
      return
    }

    seen.add(key)
    uniqueOptions.push({ label, value })
  })

  return uniqueOptions
}

const PROJECT_CODE_FIELD_KEYS = ['project_code', 'project_id', 'project_site']
const PROJECT_DESCRIPTION_FIELD_KEYS = ['project_description', 'project_name', 'site_description']

type LoadParams = {
  field?: string
  value?: string
  filters?: MasterFilter[]
  page?: number
}

type MasterFilter = {
  id: string
  field: string
  operator?: string
  value: string
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

  if (field.type === 'date') {
    return formatDisplayDate(value)
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

function formatDisplayDate(value: unknown) {
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

  return `${day}/${month}/${year}`
}

function buildRoleSelectOptions(roles: RoleOption[]): SelectOption[] {
  const bestByRole = new Map<string, RoleOption>()

  roles
    .map((role) => ({
      role_name: String(role.role_name || role.responsibility || '').trim(),
      responsibility: String(role.responsibility || role.role_name || '').trim(),
    }))
    .filter((role) => role.role_name)
    .forEach((role) => {
      const key = roleSelectKey(role)
      const current = bestByRole.get(key)

      if (!current || roleSelectScore(role) > roleSelectScore(current)) {
        bestByRole.set(key, role)
      }
    })

  return [...bestByRole.values()]
    .sort((left, right) => (left.responsibility || left.role_name).localeCompare(right.responsibility || right.role_name))
    .map((role) => {
      const label = role.responsibility && role.responsibility !== role.role_name
        ? `${role.responsibility} (${role.role_name})`
        : role.role_name

      return {
        label,
        value: role.role_name,
      }
    })
}

function roleSelectKey(role: RoleOption) {
  const text = `${role.role_name ?? ''} ${role.responsibility ?? ''}`.toLowerCase()

  if (/\bsie\b/.test(text) || text.includes('site engineer')) return 'sie'
  if (/\bser\b/.test(text) || /\bsre\b/.test(text) || text.includes('service engineer') || text.includes('site receiving')) return 'ser'
  if (/\bspl\b/.test(text) || text.includes('site procurement')) return 'spl'

  return String(role.responsibility || role.role_name || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function roleSelectScore(role: RoleOption) {
  const label = String(role.responsibility || role.role_name || '')
  return label.length
    + (role.responsibility && role.responsibility !== role.role_name ? 20 : 0)
    + (/site engineer|service engineer|site procurement/i.test(label) ? 30 : 0)
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
  return ['responsibility-master', 'role-master', 'project-master', 'location-master', 'activity-master', 'item-master', 'service-order-master', 'delivery-point-master', 'warehouse-master', 'warehouse-bin-master', 'business-partner-master', 'business-partner-code-master', 'engineer-activity-master', 'rental-order-master', 'purchase-office-master', 'purchase-office-code-master'].includes(masterKey)
}

function toDateInputValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  const textValue = String(value)
  const isoMatch = textValue.match(/^(\d{4}-\d{2}-\d{2})/)

  if (isoMatch) {
    return isoMatch[1]
  }

  const date = new Date(textValue)

  if (Number.isNaN(date.getTime())) {
    return textValue.slice(0, 10)
  }

  return date.toISOString().slice(0, 10)
}

function isPaginatedMaster(masterKey: string) {
  return ['responsibility-master', 'role-master', 'project-master', 'activity-master', 'item-master', 'service-order-master', 'delivery-point-master', 'location-master', 'warehouse-master', 'warehouse-bin-master', 'business-partner-master', 'business-partner-code-master', 'engineer-activity-master', 'rental-order-master', 'purchase-office-master', 'purchase-office-code-master'].includes(masterKey)
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
  const isSuperAdmin = isPortalAdminRole(currentUser?.role ?? currentUser?.primary_role)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [records, setRecords] = useState<MasterRecord[]>([])
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([])
  const [projectOptionsLoading, setProjectOptionsLoading] = useState(false)
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([])
  const [locationOptionsLoading, setLocationOptionsLoading] = useState(false)
  const [businessPartnerOptions, setBusinessPartnerOptions] = useState<BusinessPartnerOption[]>([])
  const [businessPartnerOptionsLoading, setBusinessPartnerOptionsLoading] = useState(false)
  const [itemOptions, setItemOptions] = useState<ItemOption[]>([])
  const [itemOptionsLoading, setItemOptionsLoading] = useState(false)
  const [serviceStatusOptions, setServiceStatusOptions] = useState<Array<{ label: string; value: string }>>([])
  const [serviceStatusOptionsLoading, setServiceStatusOptionsLoading] = useState(false)
  const [serviceSerialByItemCode, setServiceSerialByItemCode] = useState<Record<string, string>>({})
  const [rentalStatusOptions, setRentalStatusOptions] = useState<Array<{ label: string; value: string }>>([])
  const [rentalStatusOptionsLoading, setRentalStatusOptionsLoading] = useState(false)
  const [activityAuthStatusOptions, setActivityAuthStatusOptions] = useState<Array<{ label: string; value: string }>>([])
  const [activityResourceRequiredOptions, setActivityResourceRequiredOptions] = useState<Array<{ label: string; value: string }>>([])
  const [activityOptionValuesLoading, setActivityOptionValuesLoading] = useState(false)
  const [purchaseOfficeOptions, setPurchaseOfficeOptions] = useState<PurchaseOfficeOption[]>([])
  const [purchaseOfficeOptionsLoading, setPurchaseOfficeOptionsLoading] = useState(false)
  const [purchaseOrderStatusOptions, setPurchaseOrderStatusOptions] = useState<Array<{ label: string; value: string }>>([])
  const [purchaseOrderStatusOptionsLoading, setPurchaseOrderStatusOptionsLoading] = useState(false)
  const [warehouseOptions, setWarehouseOptions] = useState<WarehouseOption[]>([])
  const [warehouseOptionsLoading, setWarehouseOptionsLoading] = useState(false)
  const [userOptions, setUserOptions] = useState<UserOption[]>([])
  const [userOptionsLoading, setUserOptionsLoading] = useState(false)
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([])
  const [roleOptionsLoading, setRoleOptionsLoading] = useState(false)
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
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [draftFilters, setDraftFilters] = useState<MasterFilter[]>([])
  const [activeFilters, setActiveFilters] = useState<MasterFilter[]>([])
  const [filterValueOptions, setFilterValueOptions] = useState<Record<string, Array<{ label: string; value: string }>>>({})
  const [filterValueOptionsLoading, setFilterValueOptionsLoading] = useState<Record<string, boolean>>({})
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
  const locationCodeSelectOptions = useMemo(
    () => locationOptions.map((location) => ({
      label: location.description ? `${location.location_code} - ${location.description}` : location.location_code,
      value: location.location_code,
    })),
    [locationOptions],
  )
  const locationDescriptionSelectOptions = useMemo(
    () => locationOptions.map((location) => ({
      label: location.location_code ? `${location.description} - ${location.location_code}` : location.description,
      value: location.description,
    })),
    [locationOptions],
  )
  const businessPartnerCodeSelectOptions = useMemo(
    () => businessPartnerOptions.map((partner) => ({
      label: partner.business_partner_name
        ? `${partner.business_partner_code} - ${partner.business_partner_name}`
        : partner.business_partner_code,
      value: partner.business_partner_code,
    })),
    [businessPartnerOptions],
  )
  const businessPartnerNameSelectOptions = useMemo(
    () => businessPartnerOptions.map((partner) => ({
      label: partner.business_partner_code
        ? `${partner.business_partner_name} - ${partner.business_partner_code}`
        : partner.business_partner_name,
      value: partner.business_partner_name,
    })),
    [businessPartnerOptions],
  )
  const itemCodeSelectOptions = useMemo(
    () => itemOptions.map((item) => ({
      label: item.item_description ? `${item.item_code} - ${item.item_description}` : item.item_code,
      value: item.item_code,
    })),
    [itemOptions],
  )
  const itemDescriptionSelectOptions = useMemo(
    () => itemOptions.map((item) => ({
      label: item.item_code ? `${item.item_description} - ${item.item_code}` : item.item_description,
      value: item.item_description,
    })),
    [itemOptions],
  )
  const purchaseOfficeCodeSelectOptions = useMemo(
    () => purchaseOfficeOptions.map((office) => ({
      label: office.purchase_office_description
        ? `${office.purchase_office} - ${office.purchase_office_description}`
        : office.purchase_office,
      value: office.purchase_office,
    })),
    [purchaseOfficeOptions],
  )
  const purchaseOfficeDescriptionSelectOptions = useMemo(
    () => purchaseOfficeOptions.map((office) => ({
      label: office.purchase_office
        ? `${office.purchase_office_description} - ${office.purchase_office}`
        : office.purchase_office_description,
      value: office.purchase_office_description,
    })),
    [purchaseOfficeOptions],
  )
  const warehouseCodeSelectOptions = useMemo(
    () => warehouseOptions.map((warehouse) => ({
      label: warehouse.warehouse_description
        ? `${warehouse.warehouse_code} - ${warehouse.warehouse_description}`
        : warehouse.warehouse_code,
      value: warehouse.warehouse_code,
    })),
    [warehouseOptions],
  )
  const warehouseDescriptionSelectOptions = useMemo(
    () => warehouseOptions.map((warehouse) => ({
      label: warehouse.warehouse_code
        ? `${warehouse.warehouse_description} - ${warehouse.warehouse_code}`
        : warehouse.warehouse_description,
      value: warehouse.warehouse_description,
    })),
    [warehouseOptions],
  )
  const purchaseUnitSelectOptions = useMemo(
    () => [...new Set(itemOptions.map((item) => String(item.purchase_unit ?? '').trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right))
      .map((value) => ({ label: value, value })),
    [itemOptions],
  )
  const userSelectOptions = useMemo(
    () => userOptions.map((user) => ({
      label: user.employee_name ? `${user.employee_id} - ${user.employee_name}` : user.employee_id,
      value: user.employee_id,
    })),
    [userOptions],
  )
  const roleSelectOptions = useMemo(
    () => buildRoleSelectOptions(roleOptions),
    [roleOptions],
  )

  async function loadProjectOptions() {
    setProjectOptionsLoading(true)

    try {
      const { data } = await api.get<MasterListResponse>('/api/master-data/project-master', {
        params: { limit: 500 },
      })
      const options = dedupeProjectOptions(data.data
        .map((project) => ({
          code: String(project.project_code ?? '').trim(),
          description: String(project.project_description ?? '').trim(),
        }))
        .filter((project) => project.code || project.description))

      setProjectOptions(options)
    } catch (requestError) {
      console.error(requestError)
      message.error('Could not load project options')
    } finally {
      setProjectOptionsLoading(false)
    }
  }

  function dedupeProjectOptions(options: ProjectOption[]) {
    const byCode = new Map<string, ProjectOption>()
    const codeLessOptions: ProjectOption[] = []

    for (const option of options) {
      if (!option.code) {
        codeLessOptions.push(option)
        continue
      }

      const existing = byCode.get(option.code)
      if (!existing || (!existing.description && option.description)) {
        byCode.set(option.code, option)
      }
    }

    return [...byCode.values(), ...codeLessOptions]
      .sort((left, right) => left.code.localeCompare(right.code))
  }

  async function loadLocationOptions(projectCode?: string) {
    const normalizedProjectCode = String(projectCode ?? '').trim()

    if (!normalizedProjectCode) {
      setLocationOptions([])
      return
    }

    setLocationOptionsLoading(true)

    try {
      const { data } = await api.get<{ data: MasterRecord[] }>('/api/locations/options', {
        params: { projectCode: normalizedProjectCode },
      })
      const options = data.data
        .map((location) => ({
          project_code: String(location.project_code ?? '').trim(),
          project_name: String(location.project_name ?? '').trim(),
          location_code: String(location.location_code ?? '').trim(),
          description: String(location.description ?? '').trim(),
        }))
        .filter((location) => location.location_code || location.description)

      setLocationOptions(options)
    } catch (requestError) {
      console.error(requestError)
      message.error('Could not load location options')
    } finally {
      setLocationOptionsLoading(false)
    }
  }

  async function loadBusinessPartnerOptions() {
    setBusinessPartnerOptionsLoading(true)

    try {
      const { data } = await api.get<{ data: MasterRecord[] }>('/api/business-partners/options')
      const options = data.data
        .map((partner) => ({
          business_partner_code: String(partner.business_partner_code ?? '').trim(),
          business_partner_name: String(partner.business_partner_name ?? '').trim(),
        }))
        .filter((partner) => partner.business_partner_code || partner.business_partner_name)

      setBusinessPartnerOptions(options)
    } catch (requestError) {
      console.error(requestError)
      message.error('Could not load business partner options')
    } finally {
      setBusinessPartnerOptionsLoading(false)
    }
  }

  async function loadItemOptions() {
    setItemOptionsLoading(true)

    try {
      const firstPage = await api.get<MasterListResponse>('/api/master-data/item-master', {
        params: { page: 1, limit: 500 },
      })
      const allRows = [...firstPage.data.data]
      const totalPages = firstPage.data.metadata?.totalPages ?? 1

      for (let page = 2; page <= totalPages; page += 1) {
        const { data } = await api.get<MasterListResponse>('/api/master-data/item-master', {
          params: { page, limit: 500 },
        })
        allRows.push(...data.data)
      }

      const options = allRows
        .map((item) => ({
          project_site: String(item.project_site ?? '').trim(),
          site_description: String(item.site_description ?? '').trim(),
          item_code: String(item.item_code ?? '').trim(),
          item_description: String(item.item_description ?? '').trim(),
          purchase_unit: String(item.purchase_unit ?? '').trim(),
          item_type: String(item.item_type ?? '').trim(),
        }))
        .filter((item) => item.item_code || item.item_description)

      setItemOptions(options)
    } catch (requestError) {
      console.error(requestError)
      message.error('Could not load item options')
    } finally {
      setItemOptionsLoading(false)
    }
  }

  async function loadServiceStatusOptions() {
    setServiceStatusOptionsLoading(true)

    try {
      const firstPage = await api.get<MasterListResponse>('/api/master-data/service-order-master', {
        params: { page: 1, limit: 500 },
      })
      const allRows = [...firstPage.data.data]
      const totalPages = firstPage.data.metadata?.totalPages ?? 1

      for (let page = 2; page <= totalPages; page += 1) {
        const { data } = await api.get<MasterListResponse>('/api/master-data/service-order-master', {
          params: { page, limit: 500 },
        })
        allRows.push(...data.data)
      }

      const values = [...new Set(
        allRows
          .map((record) => String(record.status ?? '').trim())
          .filter(Boolean),
      )].sort((left, right) => left.localeCompare(right))
      const serialByItem = Object.fromEntries(
        allRows
          .map((record) => [
            String(record.item_code ?? '').trim(),
            String(record.serial_number ?? '').trim(),
          ])
          .filter(([itemCode, serialNumber]) => itemCode && serialNumber),
      )

      setServiceStatusOptions(values.map((value) => ({ label: value, value })))
      setServiceSerialByItemCode(serialByItem)
    } catch (requestError) {
      console.error(requestError)
      message.error('Could not load service status options')
    } finally {
      setServiceStatusOptionsLoading(false)
    }
  }

  async function loadActivityOptionValues() {
    setActivityOptionValuesLoading(true)

    try {
      const firstPage = await api.get<MasterListResponse>('/api/master-data/activity-master', {
        params: { page: 1, limit: 500 },
      })
      const allRows = [...firstPage.data.data]
      const totalPages = firstPage.data.metadata?.totalPages ?? 1

      for (let page = 2; page <= totalPages; page += 1) {
        const { data } = await api.get<MasterListResponse>('/api/master-data/activity-master', {
          params: { page, limit: 500 },
        })
        allRows.push(...data.data)
      }

      const toOptions = (key: string) => [...new Set(
        allRows
          .map((record) => String(record[key] ?? '').trim())
          .filter(Boolean),
      )]
        .sort((left, right) => left.localeCompare(right))
        .map((value) => ({ label: value, value }))

      setActivityAuthStatusOptions(toOptions('work_auth_status'))
      setActivityResourceRequiredOptions(toOptions('resource_required'))
    } catch (requestError) {
      console.error(requestError)
      message.error('Could not load activity dropdown options')
    } finally {
      setActivityOptionValuesLoading(false)
    }
  }

  async function loadRentalStatusOptions() {
    setRentalStatusOptionsLoading(true)

    try {
      const firstPage = await api.get<MasterListResponse>('/api/master-data/rental-order-master', {
        params: { page: 1, limit: 500 },
      })
      const allRows = [...firstPage.data.data]
      const totalPages = firstPage.data.metadata?.totalPages ?? 1

      for (let page = 2; page <= totalPages; page += 1) {
        const { data } = await api.get<MasterListResponse>('/api/master-data/rental-order-master', {
          params: { page, limit: 500 },
        })
        allRows.push(...data.data)
      }

      const values = [...new Set(
        allRows
          .map((record) => String(record.status ?? '').trim())
          .filter(Boolean),
      )].sort((left, right) => left.localeCompare(right))

      setRentalStatusOptions(values.map((value) => ({ label: value, value })))
    } catch (requestError) {
      console.error(requestError)
      message.error('Could not load rental status options')
    } finally {
      setRentalStatusOptionsLoading(false)
    }
  }

  async function loadPurchaseOfficeOptions() {
    setPurchaseOfficeOptionsLoading(true)

    try {
      const { data } = await api.get<MasterListResponse>('/api/master-data/purchase-office-code-master', {
        params: { page: 1, limit: 500 },
      })
      const options = data.data
        .map((office) => ({
          purchase_office: String(office.purchase_office ?? '').trim(),
          purchase_office_description: String(office.purchase_office_description ?? '').trim(),
        }))
        .filter((office) => office.purchase_office || office.purchase_office_description)

      setPurchaseOfficeOptions(options)
    } catch (requestError) {
      console.error(requestError)
      message.error('Could not load purchase office options')
    } finally {
      setPurchaseOfficeOptionsLoading(false)
    }
  }

  async function loadPurchaseOrderStatusOptions() {
    setPurchaseOrderStatusOptionsLoading(true)

    try {
      const firstPage = await api.get<MasterListResponse>('/api/master-data/purchase-office-master', {
        params: { page: 1, limit: 500 },
      })
      const allRows = [...firstPage.data.data]
      const totalPages = firstPage.data.metadata?.totalPages ?? 1

      for (let page = 2; page <= totalPages; page += 1) {
        const { data } = await api.get<MasterListResponse>('/api/master-data/purchase-office-master', {
          params: { page, limit: 500 },
        })
        allRows.push(...data.data)
      }

      const values = [...new Set(
        allRows
          .map((record) => String(record.status ?? '').trim())
          .filter(Boolean),
      )].sort((left, right) => left.localeCompare(right))

      setPurchaseOrderStatusOptions(values.map((value) => ({ label: value, value })))
    } catch (requestError) {
      console.error(requestError)
      message.error('Could not load purchase order status options')
    } finally {
      setPurchaseOrderStatusOptionsLoading(false)
    }
  }

  async function loadWarehouseOptions() {
    setWarehouseOptionsLoading(true)

    try {
      const firstPage = await api.get<MasterListResponse>('/api/master-data/warehouse-master', {
        params: { page: 1, limit: 500 },
      })
      const allRows = [...firstPage.data.data]
      const totalPages = firstPage.data.metadata?.totalPages ?? 1

      for (let page = 2; page <= totalPages; page += 1) {
        const { data } = await api.get<MasterListResponse>('/api/master-data/warehouse-master', {
          params: { page, limit: 500 },
        })
        allRows.push(...data.data)
      }

      const options = allRows
        .map((warehouse) => ({
          warehouse_code: String(warehouse.warehouse_code ?? '').trim(),
          warehouse_description: String(warehouse.warehouse_description ?? '').trim(),
          project_site: String(warehouse.project_site ?? '').trim(),
          site_description: String(warehouse.site_description ?? '').trim(),
        }))
        .filter((warehouse) => warehouse.warehouse_code || warehouse.warehouse_description)

      setWarehouseOptions(options)
    } catch (requestError) {
      console.error(requestError)
      message.error('Could not load warehouse options')
    } finally {
      setWarehouseOptionsLoading(false)
    }
  }

  async function loadUserOptions() {
    setUserOptionsLoading(true)

    try {
      const { data } = await api.get<MasterListResponse>('/api/responsibilities', {
        params: { limit: 500 },
      })
      const options = data.data
        .map((user) => ({
          employee_id: String(user.employee_id ?? '').trim(),
          employee_name: String(user.employee_name ?? '').trim(),
        }))
        .filter((user) => user.employee_id)

      setUserOptions(options)
    } catch (requestError) {
      console.error(requestError)
      message.error('Could not load user options')
    } finally {
      setUserOptionsLoading(false)
    }
  }

  async function loadRoleOptions() {
    setRoleOptionsLoading(true)

    try {
      const { data } = await api.get<{ responsibilities?: string[], roles?: RoleOption[] }>('/api/responsibilities/options')
      const options = (data.roles?.length
        ? data.roles
        : (data.responsibilities ?? []).map((responsibility) => ({ role_name: responsibility, responsibility })))
        .map((role) => ({ 
          role_name: String(role.role_name ?? role.responsibility ?? '').trim(),
          responsibility: String(role.responsibility ?? role.role_name ?? '').trim(),
        }))
        .filter((role) => role.role_name || role.responsibility)

      setRoleOptions(options)
    } catch (requestError) {
      console.error(requestError)
      message.error('Could not load role options')
    } finally {
      setRoleOptionsLoading(false)
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

      if (masterKey === 'business-partner-master') {
        targetForm.setFieldValue('location_code', undefined)
        targetForm.setFieldValue('location_description', undefined)
        setLocationOptions([])
      }

      if (masterKey === 'engineer-activity-master') {
        targetForm.setFieldValue('location_code', undefined)
        targetForm.setFieldValue('location_description', undefined)
        setLocationOptions([])
      }

      return
    }

    let nextProjectCode = isProjectCodeField(field) ? value : undefined

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
        nextProjectCode = selectedProject.code
      }
    }

    if (masterKey === 'business-partner-master') {
      targetForm.setFieldValue('location_code', undefined)
      targetForm.setFieldValue('location_description', undefined)
      void loadLocationOptions(nextProjectCode ?? String(targetForm.getFieldValue('project_code') ?? '').trim())
    }

    if (masterKey === 'engineer-activity-master') {
      targetForm.setFieldValue('location_code', undefined)
      targetForm.setFieldValue('location_description', undefined)
      void loadLocationOptions(nextProjectCode ?? String(targetForm.getFieldValue('project_code') ?? '').trim())
    }
  }

  function handleLocationFieldChange(targetForm: ReturnType<typeof Form.useForm>[0], field: MasterField, value?: string) {
    targetForm.setFieldValue(field.key, value)

    if (!value) {
      if (field.key === 'location_code') {
        targetForm.setFieldValue('location_description', undefined)
      }

      if (field.key === 'location_description') {
        targetForm.setFieldValue('location_code', undefined)
      }

      return
    }

    if (field.key === 'location_code') {
      const selectedLocation = locationOptions.find((location) => location.location_code === value)

      if (selectedLocation?.description) {
        targetForm.setFieldValue('location_description', selectedLocation.description)
      }
    }

    if (field.key === 'location_description') {
      const selectedLocation = locationOptions.find((location) => location.description === value)

      if (selectedLocation?.location_code) {
        targetForm.setFieldValue('location_code', selectedLocation.location_code)
      }
    }
  }

  function ensureBusinessPartnerLocationOptions(targetForm: ReturnType<typeof Form.useForm>[0]) {
    const projectCode = String(targetForm.getFieldValue('project_code') ?? '').trim()

    if (projectCode) {
      void loadLocationOptions(projectCode)
    }
  }

  function handleEngineerLocationFieldChange(targetForm: ReturnType<typeof Form.useForm>[0], field: MasterField, value?: string) {
    handleLocationFieldChange(targetForm, field, value)
  }

  function ensureEngineerLocationOptions(targetForm: ReturnType<typeof Form.useForm>[0]) {
    const projectCode = String(targetForm.getFieldValue('project_code') ?? '').trim()

    if (projectCode) {
      void loadLocationOptions(projectCode)
    }
  }

  function handleBusinessPartnerFieldChange(targetForm: ReturnType<typeof Form.useForm>[0], field: MasterField, value?: string) {
    targetForm.setFieldValue(field.key, value)

    if (!value) {
      if (field.key === 'business_partner_code') {
        targetForm.setFieldValue('business_partner_name', undefined)
      }

      if (field.key === 'business_partner_name') {
        targetForm.setFieldValue('business_partner_code', undefined)
      }

      return
    }

    if (field.key === 'business_partner_code') {
      const selectedPartner = businessPartnerOptions.find((partner) => partner.business_partner_code === value)

      if (selectedPartner?.business_partner_name) {
        targetForm.setFieldValue('business_partner_name', selectedPartner.business_partner_name)
      }
    }

    if (field.key === 'business_partner_name') {
      const selectedPartner = businessPartnerOptions.find((partner) => partner.business_partner_name === value)

      if (selectedPartner?.business_partner_code) {
        targetForm.setFieldValue('business_partner_code', selectedPartner.business_partner_code)
      }
    }
  }

  function handlePurchaseOrderBpFieldChange(targetForm: ReturnType<typeof Form.useForm>[0], field: MasterField, value?: string) {
    targetForm.setFieldValue(field.key, value)

    if (!value) {
      if (field.key === 'buy_from_business_partner') {
        targetForm.setFieldValue('bp_description', undefined)
      }

      if (field.key === 'bp_description') {
        targetForm.setFieldValue('buy_from_business_partner', undefined)
      }

      return
    }

    if (field.key === 'buy_from_business_partner') {
      const selectedPartner = businessPartnerOptions.find((partner) => partner.business_partner_code === value)

      if (selectedPartner?.business_partner_name) {
        targetForm.setFieldValue('bp_description', selectedPartner.business_partner_name)
      }
    }

    if (field.key === 'bp_description') {
      const selectedPartner = businessPartnerOptions.find((partner) => partner.business_partner_name === value)

      if (selectedPartner?.business_partner_code) {
        targetForm.setFieldValue('buy_from_business_partner', selectedPartner.business_partner_code)
      }
    }
  }

  function handlePurchaseOfficeFieldChange(targetForm: ReturnType<typeof Form.useForm>[0], field: MasterField, value?: string) {
    targetForm.setFieldValue(field.key, value)

    if (!value) {
      if (field.key === 'purchase_office') {
        targetForm.setFieldValue('purchase_office_description', undefined)
      }

      if (field.key === 'purchase_office_description') {
        targetForm.setFieldValue('purchase_office', undefined)
      }

      return
    }

    if (field.key === 'purchase_office') {
      const selectedOffice = purchaseOfficeOptions.find((office) => office.purchase_office === value)

      if (selectedOffice?.purchase_office_description) {
        targetForm.setFieldValue('purchase_office_description', selectedOffice.purchase_office_description)
      }
    }

    if (field.key === 'purchase_office_description') {
      const selectedOffice = purchaseOfficeOptions.find((office) => office.purchase_office_description === value)

      if (selectedOffice?.purchase_office) {
        targetForm.setFieldValue('purchase_office', selectedOffice.purchase_office)
      }
    }
  }

  function handleItemMasterWarehouseFieldChange(targetForm: ReturnType<typeof Form.useForm>[0], field: MasterField, value?: string) {
    targetForm.setFieldValue(field.key, value)

    if (!value) {
      if (field.key === 'warehouse_code') {
        targetForm.setFieldValue('warehouse_description', undefined)
      }

      if (field.key === 'warehouse_description') {
        targetForm.setFieldValue('warehouse_code', undefined)
      }

      return
    }

    const selectedWarehouse = field.key === 'warehouse_code'
      ? warehouseOptions.find((warehouse) => warehouse.warehouse_code === value)
      : warehouseOptions.find((warehouse) => warehouse.warehouse_description === value)

    if (!selectedWarehouse) {
      return
    }

    targetForm.setFieldValue('warehouse_code', selectedWarehouse.warehouse_code)
    targetForm.setFieldValue('warehouse_description', selectedWarehouse.warehouse_description)

    if (selectedWarehouse.project_site) {
      targetForm.setFieldValue('project_site', selectedWarehouse.project_site)
    }

    if (selectedWarehouse.site_description) {
      targetForm.setFieldValue('site_description', selectedWarehouse.site_description)
    }
  }

  function handleWarehouseLocationWarehouseFieldChange(targetForm: ReturnType<typeof Form.useForm>[0], field: MasterField, value?: string) {
    targetForm.setFieldValue(field.key, value)

    if (!value) {
      if (field.key === 'warehouse_code') {
        targetForm.setFieldValue('warehouse_name', undefined)
      }

      if (field.key === 'warehouse_name') {
        targetForm.setFieldValue('warehouse_code', undefined)
      }

      return
    }

    const selectedWarehouse = field.key === 'warehouse_code'
      ? warehouseOptions.find((warehouse) => warehouse.warehouse_code === value)
      : warehouseOptions.find((warehouse) => warehouse.warehouse_description === value)

    if (!selectedWarehouse) {
      return
    }

    targetForm.setFieldValue('warehouse_code', selectedWarehouse.warehouse_code)
    targetForm.setFieldValue('warehouse_name', selectedWarehouse.warehouse_description)

    if (selectedWarehouse.project_site) {
      targetForm.setFieldValue('project_code', selectedWarehouse.project_site)
      const selectedProject = projectOptions.find((project) => project.code === selectedWarehouse.project_site)
      targetForm.setFieldValue('project_description', selectedProject?.description ?? selectedWarehouse.site_description)
    }
  }

  function handleItemMasterItemFieldChange(targetForm: ReturnType<typeof Form.useForm>[0], field: MasterField, value?: string) {
    targetForm.setFieldValue(field.key, value)

    if (!value) {
      if (field.key === 'item_code') {
        targetForm.setFieldValue('item_description', undefined)
        targetForm.setFieldValue('serial_number', undefined)
      }

      if (field.key === 'item_description') {
        targetForm.setFieldValue('item_code', undefined)
        targetForm.setFieldValue('serial_number', undefined)
      }

      return
    }

    const selectedItem = field.key === 'item_code'
      ? itemOptions.find((item) => item.item_code === value)
      : itemOptions.find((item) => item.item_description === value)

    if (!selectedItem) {
      return
    }

    targetForm.setFieldValue('item_code', selectedItem.item_code)
    targetForm.setFieldValue('item_description', selectedItem.item_description)

    if (selectedItem.purchase_unit) {
      targetForm.setFieldValue('purchase_unit', selectedItem.purchase_unit)
    }

    if (selectedItem.item_type) {
      targetForm.setFieldValue('item_type', selectedItem.item_type)
    }
  }

  function handleServiceItemFieldChange(targetForm: ReturnType<typeof Form.useForm>[0], field: MasterField, value?: string) {
    targetForm.setFieldValue(field.key, value)

    if (!value) {
      if (field.key === 'item_code') {
        targetForm.setFieldValue('item_description', undefined)
      }

      if (field.key === 'item_description') {
        targetForm.setFieldValue('item_code', undefined)
      }

      return
    }

    if (field.key === 'item_code') {
      const selectedItem = itemOptions.find((item) => item.item_code === value)

      if (selectedItem?.item_description) {
        targetForm.setFieldValue('item_description', selectedItem.item_description)
      }

      if (selectedItem?.project_site) {
        targetForm.setFieldValue('project_site', selectedItem.project_site)
        const selectedProject = projectOptions.find((project) => project.code === selectedItem.project_site)
        targetForm.setFieldValue('project_description', selectedProject?.description ?? undefined)
      }

      const serialNumber = selectedItem?.item_code ? serviceSerialByItemCode[selectedItem.item_code] : ''
      targetForm.setFieldValue('serial_number', serialNumber || undefined)
    }

    if (field.key === 'item_description') {
      const selectedItem = itemOptions.find((item) => item.item_description === value)

      if (selectedItem?.item_code) {
        targetForm.setFieldValue('item_code', selectedItem.item_code)
      }

      if (selectedItem?.project_site) {
        targetForm.setFieldValue('project_site', selectedItem.project_site)
        const selectedProject = projectOptions.find((project) => project.code === selectedItem.project_site)
        targetForm.setFieldValue('project_description', selectedProject?.description ?? undefined)
      }

      const serialNumber = selectedItem?.item_code ? serviceSerialByItemCode[selectedItem.item_code] : ''
      targetForm.setFieldValue('serial_number', serialNumber || undefined)
    }
  }

  function handleRentalItemFieldChange(targetForm: ReturnType<typeof Form.useForm>[0], field: MasterField, value?: string) {
    targetForm.setFieldValue(field.key, value)

    if (!value) {
      if (field.key === 'item_code') {
        targetForm.setFieldValue('item_description', undefined)
      }

      if (field.key === 'item_description') {
        targetForm.setFieldValue('item_code', undefined)
      }

      return
    }

    if (field.key === 'item_code') {
      const selectedItem = itemOptions.find((item) => item.item_code === value)

      if (selectedItem?.item_description) {
        targetForm.setFieldValue('item_description', selectedItem.item_description)
      }

      if (selectedItem?.item_type) {
        targetForm.setFieldValue('item_type_in_transaction', selectedItem.item_type)
      }
    }

    if (field.key === 'item_description') {
      const selectedItem = itemOptions.find((item) => item.item_description === value)

      if (selectedItem?.item_code) {
        targetForm.setFieldValue('item_code', selectedItem.item_code)
      }

      if (selectedItem?.item_type) {
        targetForm.setFieldValue('item_type_in_transaction', selectedItem.item_type)
      }
    }
  }

  function handleUserFieldChange(targetForm: ReturnType<typeof Form.useForm>[0], value?: string) {
    targetForm.setFieldValue('employee_id', value)

    if (!value) {
      targetForm.setFieldValue('employee_name', undefined)
      return
    }

    const selectedUser = userOptions.find((user) => user.employee_id === value)
    if (selectedUser) {
      targetForm.setFieldValue('employee_name', selectedUser.employee_name)
    }
  }

  function renderFieldInput(field: MasterField, targetForm: ReturnType<typeof Form.useForm>[0]) {
    if (masterKey === 'responsibility-master' && field.key === 'employee_id') {
      return (
        <Select
          allowClear
          loading={userOptionsLoading}
          onChange={(value) => handleUserFieldChange(targetForm, value)}
          optionFilterProp="label"
          options={userSelectOptions}
          placeholder="Select User ID"
          showSearch
        />
      )
    }

    if (masterKey === 'responsibility-master' && field.key === 'employee_name') {
      return <Input readOnly />
    }

    if (masterKey === 'responsibility-master' && field.key === 'responsibility') {
      return (
        <Select
          allowClear
          loading={roleOptionsLoading}
          optionFilterProp="label"
          options={roleSelectOptions}
          placeholder="Select Role"
          showSearch
        />
      )
    }

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

    if (masterKey === 'business-partner-master' && field.key === 'location_code') {
      return (
        <Select
          allowClear
          loading={locationOptionsLoading}
          onChange={(value) => handleLocationFieldChange(targetForm, field, value)}
          onDropdownVisibleChange={(open) => {
            if (open) {
              ensureBusinessPartnerLocationOptions(targetForm)
            }
          }}
          optionFilterProp="label"
          options={locationCodeSelectOptions}
          placeholder="Select Location Code"
          showSearch
        />
      )
    }

    if (masterKey === 'business-partner-master' && field.key === 'location_description') {
      return (
        <Select
          allowClear
          loading={locationOptionsLoading}
          onChange={(value) => handleLocationFieldChange(targetForm, field, value)}
          onDropdownVisibleChange={(open) => {
            if (open) {
              ensureBusinessPartnerLocationOptions(targetForm)
            }
          }}
          optionFilterProp="label"
          options={locationDescriptionSelectOptions}
          placeholder="Select Location Description"
          showSearch
        />
      )
    }

    if (masterKey === 'business-partner-master' && field.key === 'business_partner_code') {
      return (
        <Select
          allowClear
          loading={businessPartnerOptionsLoading}
          onChange={(value) => handleBusinessPartnerFieldChange(targetForm, field, value)}
          optionFilterProp="label"
          options={businessPartnerCodeSelectOptions}
          placeholder="Select Business Partner Code"
          showSearch
        />
      )
    }

    if (masterKey === 'business-partner-master' && field.key === 'business_partner_name') {
      return (
        <Select
          allowClear
          loading={businessPartnerOptionsLoading}
          onChange={(value) => handleBusinessPartnerFieldChange(targetForm, field, value)}
          optionFilterProp="label"
          options={businessPartnerNameSelectOptions}
          placeholder="Select Business Partner Name"
          showSearch
        />
      )
    }

    if (masterKey === 'engineer-activity-master' && field.key === 'location_code') {
      return (
        <Select
          allowClear
          loading={locationOptionsLoading}
          onChange={(value) => handleEngineerLocationFieldChange(targetForm, field, value)}
          onDropdownVisibleChange={(open) => {
            if (open) {
              ensureEngineerLocationOptions(targetForm)
            }
          }}
          optionFilterProp="label"
          options={locationCodeSelectOptions}
          placeholder="Select Location Code"
          showSearch
        />
      )
    }

    if (masterKey === 'engineer-activity-master' && field.key === 'location_description') {
      return (
        <Select
          allowClear
          loading={locationOptionsLoading}
          onChange={(value) => handleEngineerLocationFieldChange(targetForm, field, value)}
          onDropdownVisibleChange={(open) => {
            if (open) {
              ensureEngineerLocationOptions(targetForm)
            }
          }}
          optionFilterProp="label"
          options={locationDescriptionSelectOptions}
          placeholder="Select Location Description"
          showSearch
        />
      )
    }

    if (masterKey === 'engineer-activity-master' && field.key === 'employee_id') {
      return (
        <Select
          allowClear
          loading={userOptionsLoading}
          onChange={(value) => handleUserFieldChange(targetForm, value)}
          optionFilterProp="label"
          options={userSelectOptions}
          placeholder="Select Employee ID"
          showSearch
        />
      )
    }

    if (masterKey === 'engineer-activity-master' && field.key === 'employee_name') {
      return (
        <Select
          allowClear
          loading={userOptionsLoading}
          onChange={(value) => {
            targetForm.setFieldValue('employee_name', value)
            const selectedUser = userOptions.find((user) => user.employee_name === value)
            targetForm.setFieldValue('employee_id', selectedUser?.employee_id)
          }}
          optionFilterProp="label"
          options={userOptions.map((user) => ({
            label: user.employee_id ? `${user.employee_name} - ${user.employee_id}` : user.employee_name,
            value: user.employee_name,
          }))}
          placeholder="Select Employee Name"
          showSearch
        />
      )
    }

    if (masterKey === 'service-order-master' && field.key === 'status') {
      return (
        <Select
          allowClear
          loading={serviceStatusOptionsLoading}
          optionFilterProp="label"
          options={serviceStatusOptions}
          placeholder="Select Status"
          showSearch
        />
      )
    }

    if (masterKey === 'item-master' && field.key === 'warehouse_code') {
      return (
        <Select
          allowClear
          loading={warehouseOptionsLoading}
          onChange={(value) => handleItemMasterWarehouseFieldChange(targetForm, field, value)}
          optionFilterProp="label"
          options={warehouseCodeSelectOptions}
          placeholder="Select Warehouse Code"
          showSearch
        />
      )
    }

    if (masterKey === 'item-master' && field.key === 'warehouse_description') {
      return (
        <Select
          allowClear
          loading={warehouseOptionsLoading}
          onChange={(value) => handleItemMasterWarehouseFieldChange(targetForm, field, value)}
          optionFilterProp="label"
          options={warehouseDescriptionSelectOptions}
          placeholder="Select Warehouse Description"
          showSearch
        />
      )
    }

    if (masterKey === 'warehouse-bin-master' && field.key === 'warehouse_code') {
      return (
        <Select
          allowClear
          loading={warehouseOptionsLoading}
          onChange={(value) => handleWarehouseLocationWarehouseFieldChange(targetForm, field, value)}
          optionFilterProp="label"
          options={warehouseCodeSelectOptions}
          placeholder="Select Warehouse Code"
          showSearch
        />
      )
    }

    if (masterKey === 'warehouse-bin-master' && field.key === 'warehouse_name') {
      return (
        <Select
          allowClear
          loading={warehouseOptionsLoading}
          onChange={(value) => handleWarehouseLocationWarehouseFieldChange(targetForm, field, value)}
          optionFilterProp="label"
          options={warehouseDescriptionSelectOptions}
          placeholder="Select Warehouse Description"
          showSearch
        />
      )
    }

    if (masterKey === 'item-master' && field.key === 'item_code') {
      return (
        <Select
          allowClear
          loading={itemOptionsLoading}
          onChange={(value) => handleItemMasterItemFieldChange(targetForm, field, value)}
          optionFilterProp="label"
          options={itemCodeSelectOptions}
          placeholder="Select Item Code"
          showSearch
        />
      )
    }

    if (masterKey === 'item-master' && field.key === 'item_description') {
      return (
        <Select
          allowClear
          loading={itemOptionsLoading}
          onChange={(value) => handleItemMasterItemFieldChange(targetForm, field, value)}
          optionFilterProp="label"
          options={itemDescriptionSelectOptions}
          placeholder="Select Item Description"
          showSearch
        />
      )
    }

    if (masterKey === 'item-master' && field.key === 'purchase_unit') {
      return (
        <Select
          allowClear
          loading={itemOptionsLoading}
          optionFilterProp="label"
          options={purchaseUnitSelectOptions}
          placeholder="Select UOM"
          showSearch
        />
      )
    }

    if (masterKey === 'service-order-master' && field.key === 'item_code') {
      return (
        <Select
          allowClear
          loading={itemOptionsLoading}
          onChange={(value) => handleServiceItemFieldChange(targetForm, field, value)}
          optionFilterProp="label"
          options={itemCodeSelectOptions}
          placeholder="Select Item Code"
          showSearch
        />
      )
    }

    if (masterKey === 'activity-master' && field.key === 'work_auth_status') {
      return (
        <Select
          allowClear
          loading={activityOptionValuesLoading}
          optionFilterProp="label"
          options={activityAuthStatusOptions}
          placeholder="Select Auth Status"
          showSearch
        />
      )
    }

    if (masterKey === 'activity-master' && field.key === 'resource_required') {
      return (
        <Select
          allowClear
          loading={activityOptionValuesLoading}
          optionFilterProp="label"
          options={activityResourceRequiredOptions}
          placeholder="Select Resource Required"
          showSearch
        />
      )
    }

    if (masterKey === 'service-order-master' && field.key === 'item_description') {
      return (
        <Select
          allowClear
          loading={itemOptionsLoading}
          onChange={(value) => handleServiceItemFieldChange(targetForm, field, value)}
          optionFilterProp="label"
          options={itemDescriptionSelectOptions}
          placeholder="Select Item Description"
          showSearch
        />
      )
    }

    if (masterKey === 'rental-order-master' && field.key === 'status') {
      return (
        <Select
          allowClear
          loading={rentalStatusOptionsLoading}
          optionFilterProp="label"
          options={rentalStatusOptions}
          placeholder="Select Status"
          showSearch
        />
      )
    }

    if (masterKey === 'rental-order-master' && field.key === 'item_code') {
      return (
        <Select
          allowClear
          loading={itemOptionsLoading}
          onChange={(value) => handleRentalItemFieldChange(targetForm, field, value)}
          optionFilterProp="label"
          options={itemCodeSelectOptions}
          placeholder="Select Item Code"
          showSearch
        />
      )
    }

    if (masterKey === 'rental-order-master' && field.key === 'item_description') {
      return (
        <Select
          allowClear
          loading={itemOptionsLoading}
          onChange={(value) => handleRentalItemFieldChange(targetForm, field, value)}
          optionFilterProp="label"
          options={itemDescriptionSelectOptions}
          placeholder="Select Item Description"
          showSearch
        />
      )
    }

    if (masterKey === 'purchase-office-master' && field.key === 'buy_from_business_partner') {
      return (
        <Select
          allowClear
          loading={businessPartnerOptionsLoading}
          onChange={(value) => handlePurchaseOrderBpFieldChange(targetForm, field, value)}
          optionFilterProp="label"
          options={businessPartnerCodeSelectOptions}
          placeholder="Select BP Code"
          showSearch
        />
      )
    }

    if (masterKey === 'purchase-office-master' && field.key === 'bp_description') {
      return (
        <Select
          allowClear
          loading={businessPartnerOptionsLoading}
          onChange={(value) => handlePurchaseOrderBpFieldChange(targetForm, field, value)}
          optionFilterProp="label"
          options={businessPartnerNameSelectOptions}
          placeholder="Select BP Description"
          showSearch
        />
      )
    }

    if (masterKey === 'purchase-office-master' && field.key === 'status') {
      return (
        <Select
          allowClear
          loading={purchaseOrderStatusOptionsLoading}
          optionFilterProp="label"
          options={purchaseOrderStatusOptions}
          placeholder="Select Status"
          showSearch
        />
      )
    }

    if (masterKey === 'purchase-office-master' && field.key === 'purchase_office') {
      return (
        <Select
          allowClear
          loading={purchaseOfficeOptionsLoading}
          onChange={(value) => handlePurchaseOfficeFieldChange(targetForm, field, value)}
          optionFilterProp="label"
          options={purchaseOfficeCodeSelectOptions}
          placeholder="Select Purchase Office"
          showSearch
        />
      )
    }

    if (masterKey === 'purchase-office-master' && field.key === 'purchase_office_description') {
      return (
        <Select
          allowClear
          loading={purchaseOfficeOptionsLoading}
          onChange={(value) => handlePurchaseOfficeFieldChange(targetForm, field, value)}
          optionFilterProp="label"
          options={purchaseOfficeDescriptionSelectOptions}
          placeholder="Select Purchase Office Description"
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

    if (field.type === 'date') {
      return <Input type="date" />
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

  function normalizedFilters(filters = activeFilters) {
    return filters
      .map((filter) => ({
        ...filter,
        field: filter.field.trim(),
        operator: filter.operator?.trim() || 'contains',
        value: filter.value.trim(),
      }))
      .filter((filter) => filter.field && filter.value)
  }

  function filterRequestParams(page?: number) {
    const filters = normalizedFilters()

    return filters.length > 0
      ? { filters, page }
      : { page }
  }

  async function loadRecords(params?: LoadParams) {
    if (!config) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const filters = normalizedFilters(params?.filters)
      const filterParams = filters.length > 0
        ? { filters: JSON.stringify(filters.map(({ field, operator, value }) => ({ field, operator, value }))) }
        : params?.field && params?.value
          ? { field: params.field, value: params.value }
          : {}
      const requestParams = isPaginated
        ? {
          page: params?.page ?? currentPage,
          limit: PAGE_SIZE,
          ...filterParams,
        }
        : Object.keys(filterParams).length > 0
          ? filterParams
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
    setFilterModalOpen(false)
    setDraftFilters([])
    setActiveFilters([])
    setFilterValueOptions({})
    setFilterValueOptionsLoading({})
    setIsFilterActive(false)
    setCurrentPage(1)
    setImportFile(null)
    setDetectedHeaders([])
    setFieldsMapping(defaultFieldsMapping(MASTER_IMPORT_METADATA[masterKey]))
    setShowMappingModal(false)
    setSyncResults(null)
    setShowResultsModal(false)
    clearSelectionBuffer()
    loadRecords({ filters: [], page: 1 })
    if (config?.fields.some((field) => isProjectCodeField(field) || isProjectDescriptionField(field))) {
      loadProjectOptions()
    }
    if (masterKey === 'business-partner-master') {
      loadBusinessPartnerOptions()
      setLocationOptions([])
    }
    if (masterKey === 'service-order-master') {
      loadItemOptions()
      loadServiceStatusOptions()
    }
    if (masterKey === 'rental-order-master') {
      loadItemOptions()
      loadRentalStatusOptions()
    }
    if (masterKey === 'purchase-office-master') {
      loadBusinessPartnerOptions()
      loadPurchaseOfficeOptions()
      loadPurchaseOrderStatusOptions()
    }
    if (masterKey === 'item-master') {
      loadWarehouseOptions()
      loadItemOptions()
    }
    if (masterKey === 'warehouse-bin-master') {
      loadWarehouseOptions()
    }
    if (masterKey === 'activity-master') {
      loadActivityOptionValues()
    }
    if (masterKey === 'engineer-activity-master') {
      loadUserOptions()
      setLocationOptions([])
    }
    if (masterKey === 'responsibility-master') {
      loadUserOptions()
      loadRoleOptions()
    }
  }, [masterKey])

  useEffect(() => {
    if (!isPaginated || !config) {
      return
    }

    loadRecords(isFilterActive ? filterRequestParams(currentPage) : { filters: [], page: currentPage })
  }, [currentPage])

  function handleOpenFilterModal() {
    const filters = normalizedFilters().map((filter) => ({ ...filter }))
    setDraftFilters(filters)
    filters.forEach((filter) => {
      void loadFilterValueOptions(filter.field)
    })
    setFilterModalOpen(true)
  }

  function handleCloseFilterModal() {
    setDraftFilters([])
    setFilterModalOpen(false)
  }

  async function loadFilterValueOptions(field: string) {
    if (!field || filterValueOptions[field] || filterValueOptionsLoading[field]) {
      return
    }

    setFilterValueOptionsLoading((currentLoading) => ({ ...currentLoading, [field]: true }))

    try {
      const { data } = await api.get<FilterValueOptionsResponse>(`/api/master-data/${masterKey}/filter-options`, {
        params: { field },
      })
      setFilterValueOptions((currentOptions) => ({
        ...currentOptions,
        [field]: normalizeFilterValueOptions(data.data),
      }))
    } catch (requestError) {
      console.error(requestError)
      message.error('Could not load filter values.')
    } finally {
      setFilterValueOptionsLoading((currentLoading) => ({ ...currentLoading, [field]: false }))
    }
  }

  function availableFilterOptions(currentFilterId?: string) {
    const selectedFields = new Set(
      draftFilters
        .filter((filter) => filter.id !== currentFilterId)
        .map((filter) => filter.field)
        .filter(Boolean),
    )

    return (config.searchFields ?? [])
      .filter((field) => !selectedFields.has(field.value))
      .map((field) => ({
        label: field.label,
        value: field.value,
      }))
  }

  function handleAppendDraftFilter(field?: string) {
    if (!field) {
      return
    }

    void loadFilterValueOptions(field)
    setDraftFilters((currentFilters) => [
      ...currentFilters,
      { id: `${field}-${Date.now()}-${currentFilters.length}`, field, operator: field === 'on_hand_qty' ? 'eq' : 'contains', value: '' },
    ])
  }

  function updateDraftFilter(id: string, patch: Partial<MasterFilter>) {
    if (patch.field) {
      void loadFilterValueOptions(patch.field)
    }

    setDraftFilters((currentFilters) =>
      currentFilters.map((filter) => filter.id === id ? { ...filter, ...patch } : filter),
    )
  }

  function removeDraftFilter(id: string) {
    setDraftFilters((currentFilters) => currentFilters.filter((filter) => filter.id !== id))
  }

  async function handleApplyFilters() {
    const filters = normalizedFilters(draftFilters)

    if (draftFilters.some((filter) => filter.field && !filter.value.trim())) {
      message.warning('Enter a value for each selected filter field.')
      return
    }

    if (filters.length === 0) {
      message.warning('Select at least one filter field and enter a value.')
      return
    }

    setActiveFilters(filters)
    setIsFilterActive(true)
    setCurrentPage(1)
    setFilterModalOpen(false)
    clearSelectionBuffer()
    await loadRecords({ filters, page: 1 })
  }

  async function handleClearSearch() {
    setDraftFilters([])
    setActiveFilters([])
    setIsFilterActive(false)
    setCurrentPage(1)
    setFilterModalOpen(false)
    clearSelectionBuffer()
    await loadRecords({ filters: [], page: 1 })
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

        const initialMapping = {
          ...defaultFieldsMapping(importMetadata),
          ...Object.fromEntries(headers.map((header) => [header, true])),
        }
        for (const column of importMetadata.columns) {
          if (headers.some((header) => header === column.excelHeader || (column.aliases ?? []).includes(header))) {
            initialMapping[column.excelHeader] = true
          }
        }
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
      await loadRecords(isFilterActive ? filterRequestParams(1) : { filters: [], page: 1 })
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
      const exportColumns = visibleColumns.map((column) => column.key).join(',')
      const exportParams = selectedKeys.length > 0
        ? { selectedKeys: selectedKeys.join(','), columns: exportColumns }
        : isFilterActive
          ? { filters: JSON.stringify(normalizedFilters().map(({ field, operator, value }) => ({ field, operator, value }))), columns: exportColumns }
          : { columns: exportColumns }
      const { data } = await api.get<Blob>(`/api/master-data/${masterKey}/export`, {
        params: exportParams,
        responseType: 'blob',
      })
      const downloadUrl = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = exportFilename(config.title)
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
      await loadRecords(isFilterActive ? filterRequestParams(1) : { filters: [], page: 1 })
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
            : field.type === 'date'
              ? toDateInputValue(record[field.key])
              : field.type === 'checkboxText'
                ? String(record[field.key]).toLowerCase() === 'yes'
                : record[field.key] ?? '',
        ]),
      ),
    )
    if (masterKey === 'business-partner-master') {
      void loadLocationOptions(String(record.project_code ?? '').trim())
      void loadBusinessPartnerOptions()
    }
    if (masterKey === 'engineer-activity-master') {
      void loadLocationOptions(String(record.project_code ?? '').trim())
      void loadUserOptions()
    }
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
      await loadRecords(isFilterActive ? filterRequestParams(currentPage) : { filters: [], page: currentPage })
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
            {config.searchFields && (
              <>
                <Button
                  className="relative"
                  icon={<Filter size={16} />}
                  onClick={handleOpenFilterModal}
                  title="Filter records"
                >
                  Filter
                  {activeFilters.length > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                      {activeFilters.length}
                    </span>
                  )}
                </Button>
                {isFilterActive && (
                  <Button onClick={handleClearSearch} type="text">
                    Clear
                  </Button>
                )}
              </>
            )}
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
                              dropdownRender={() => (
                                <div className="w-52 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                                  <button
                                    className="flex w-full items-center gap-3 rounded-md bg-slate-50 px-2 py-2 text-left text-slate-800 transition hover:bg-slate-100"
                                    onClick={() => handleOpenEdit(record)}
                                    type="button"
                                  >
                                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                                      <Pencil size={18} />
                                    </span>
                                    <span className="text-sm font-semibold">Edit</span>
                                  </button>
                                </div>
                              )}
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
              <NumberedPagination
                currentPage={currentPage}
                loading={loading}
                onPageChange={setCurrentPage}
                totalPages={totalPages}
              />
            </div>
          )}
        </>
      )}

      {config.searchFields && (
        <Modal
          okText="Apply Filters"
          onCancel={handleCloseFilterModal}
          onOk={handleApplyFilters}
          open={filterModalOpen}
          title="Filter Records"
          width={680}
        >
          <div className="space-y-3">
            {availableFilterOptions().length > 0 && (
              <Select
                className="w-full"
                onChange={handleAppendDraftFilter}
                options={availableFilterOptions()}
                placeholder="Select Field"
                value={undefined}
              />
            )}

            {draftFilters.map((filter) => {
              const selectedField = config.searchFields?.find((field) => field.value === filter.field)

              const isOnHandQtyFilter = filter.field === 'on_hand_qty'

              return (
                <div className="grid grid-cols-[minmax(170px,0.9fr)_minmax(220px,1.25fr)_36px] items-center gap-3" key={filter.id}>
                  <Select
                    onChange={(value) => updateDraftFilter(filter.id, { field: value, operator: value === 'on_hand_qty' ? 'eq' : 'contains', value: '' })}
                    options={availableFilterOptions(filter.id)}
                    placeholder="Select Field"
                    value={filter.field || undefined}
                  />
                  {isOnHandQtyFilter ? (
                    <div className="grid grid-cols-[130px_1fr] gap-2">
                      <Select
                        onChange={(value) => updateDraftFilter(filter.id, { operator: value })}
                        options={[
                          { label: 'Equals to', value: 'eq' },
                          { label: 'Greater than', value: 'gt' },
                          { label: 'Less than', value: 'lt' },
                          { label: 'Greater or equal', value: 'gte' },
                          { label: 'Less or equal', value: 'lte' },
                        ]}
                        value={filter.operator || 'eq'}
                      />
                      <Input
                        onChange={(event) => updateDraftFilter(filter.id, { value: event.target.value })}
                        placeholder="Enter qty"
                        type="number"
                        value={filter.value}
                      />
                    </div>
                  ) : (
                    <Select
                      allowClear
                      loading={filterValueOptionsLoading[filter.field]}
                      onChange={(value) => updateDraftFilter(filter.id, { value: value ?? '' })}
                      onDropdownVisibleChange={(open) => {
                        if (open) {
                          void loadFilterValueOptions(filter.field)
                        }
                      }}
                      optionFilterProp="label"
                      options={filterValueOptions[filter.field] ?? []}
                      placeholder={selectedField?.placeholder ?? 'Enter filter value'}
                      showSearch
                      value={filter.value || undefined}
                      virtual={false}
                    />
                  )}
                  <button
                    className="grid h-9 w-9 place-items-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    onClick={() => removeDraftFilter(filter.id)}
                    title="Remove filter"
                    type="button"
                  >
                    <X size={16} />
                  </button>
                </div>
              )
            })}

            {draftFilters.length === 0 && (
              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Select a field to start filtering records.
              </div>
            )}

            {isFilterActive && (
              <Button onClick={handleClearSearch} type="text">
                Clear all filters
              </Button>
            )}
          </div>
        </Modal>
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
              Select supported fields to sync and keep visible in {config.title}. Fields not present in the file stay visible if selected, but are not updated by this import.
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {importMetadata.columns.map((column) => {
                const matchingHeader = [column.excelHeader, ...(column.aliases ?? [])].find((header) => detectedHeaders.includes(header))
                const mappingKey = matchingHeader ?? column.excelHeader
                const isLookupColumn = column.excelHeader === importMetadata.excelLookupKey || (column.aliases ?? []).includes(importMetadata.excelLookupKey)

                return (
                  <label
                    className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm"
                    key={column.dbColumn}
                  >
                    <Checkbox
                      checked={fieldsMapping[mappingKey] ?? fieldsMapping[column.excelHeader] ?? false}
                      disabled={isLookupColumn}
                      onChange={(event) =>
                        setFieldsMapping((currentMapping) => ({
                          ...currentMapping,
                          [mappingKey]: event.target.checked,
                          [column.excelHeader]: event.target.checked,
                        }))
                      }
                    />
                    <span className="font-medium text-slate-700">
                      {isLookupColumn ? `${column.label} (Required)` : column.label}
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        {matchingHeader ? `File: ${matchingHeader}` : 'Not in file'}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
            {detectedHeaders.some((header) => !importMetadata.columns.some((column) => column.excelHeader === header || (column.aliases ?? []).includes(header))) ? (
              <div className="mt-4 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Extra file fields: {detectedHeaders.filter((header) => !importMetadata.columns.some((column) => column.excelHeader === header || (column.aliases ?? []).includes(header))).join(', ')}
              </div>
            ) : null}
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
