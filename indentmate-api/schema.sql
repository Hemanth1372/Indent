CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  login_name VARCHAR(50) UNIQUE NOT NULL,
  employee_name VARCHAR(100) NOT NULL,
  employee_id_str VARCHAR(50),
  primary_role VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  password_hash VARCHAR(255) NOT NULL,
  current_pin VARCHAR(6),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_master (
  id SERIAL PRIMARY KEY,
  project_code VARCHAR(50) UNIQUE NOT NULL,
  project_description VARCHAR(255) NOT NULL,
  dpr_engineer_control VARCHAR(50) NOT NULL,
  multi_location_activity VARCHAR(20) NOT NULL,
  project_location_linked_activities VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS item_master (
  id SERIAL PRIMARY KEY,
  project_site VARCHAR(50) NOT NULL,
  site_description VARCHAR(255) NOT NULL,
  warehouse_code VARCHAR(50) NULL,
  warehouse_description VARCHAR(255) NULL,
  on_hand_qty DECIMAL(12, 4) DEFAULT 0.0000,
  item_code VARCHAR(100) NOT NULL,
  item_description TEXT NOT NULL,
  purchase_unit VARCHAR(50) NOT NULL,
  item_type VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_site_warehouse_item UNIQUE (project_site, warehouse_code, item_code)
);

CREATE TABLE IF NOT EXISTS service_orders (
  id SERIAL PRIMARY KEY,
  service_order_no VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(100) NOT NULL,
  item_code VARCHAR(100) NULL,
  item_description TEXT NULL,
  serial_number VARCHAR(100),
  project_site VARCHAR(50) NOT NULL,
  project_description VARCHAR(255) NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouse_master (
  id SERIAL PRIMARY KEY,
  warehouse_code VARCHAR(50) UNIQUE NOT NULL,
  warehouse_description VARCHAR(255) NOT NULL,
  project_site VARCHAR(50) NOT NULL,
  site_description VARCHAR(255) NOT NULL,
  is_material_warehouse VARCHAR(10) NOT NULL,
  is_virtual_warehouse VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouse_location_master (
  id SERIAL PRIMARY KEY,
  project_code VARCHAR(50) NOT NULL,
  project_description VARCHAR(255) NOT NULL DEFAULT '',
  warehouse_code VARCHAR(50) NOT NULL,
  warehouse_name VARCHAR(255) NOT NULL,
  location_code VARCHAR(100) NOT NULL,
  location_description TEXT NOT NULL,
  location_category VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_wh_location_bin UNIQUE (warehouse_code, location_code)
);

CREATE TABLE IF NOT EXISTS responsibility_master (
  id SERIAL PRIMARY KEY,
  project_id VARCHAR(50) NOT NULL,
  project_description VARCHAR(255) NOT NULL,
  responsibility TEXT NOT NULL,
  employee_id VARCHAR(50) NOT NULL,
  employee_name VARCHAR(150) NOT NULL,
  valid_from DATE NULL,
  valid_to DATE NULL,
  manual_status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_master (
  id SERIAL PRIMARY KEY,
  role_name VARCHAR(150) UNIQUE NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS business_partner_master (
  id SERIAL PRIMARY KEY,
  business_partner_code VARCHAR(100) UNIQUE NOT NULL,
  business_partner_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bp_activity_master (
  id SERIAL PRIMARY KEY,
  project_code VARCHAR(50) NOT NULL,
  project_description VARCHAR(255) NOT NULL,
  location_code VARCHAR(100) NOT NULL,
  location_description TEXT NOT NULL,
  activity_code VARCHAR(100) NULL,
  activity_description TEXT NULL,
  business_partner_code VARCHAR(100) NOT NULL,
  business_partner_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_bp_activity_assignment UNIQUE (project_code, location_code, activity_code, business_partner_code)
);

CREATE TABLE IF NOT EXISTS delivery_master (
  id SERIAL PRIMARY KEY,
  address_code VARCHAR(100) NOT NULL,
  address_description TEXT NOT NULL,
  project_code VARCHAR(50) NOT NULL,
  project_description VARCHAR(255) NOT NULL,
  delivery_point VARCHAR(100) NOT NULL,
  description_1 TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_project_delivery UNIQUE (project_code, address_code, delivery_point)
);

CREATE TABLE IF NOT EXISTS engineer_activity_master (
  id SERIAL PRIMARY KEY,
  company VARCHAR(50) NOT NULL DEFAULT '',
  project_code VARCHAR(50) NOT NULL,
  project_description VARCHAR(255) NOT NULL,
  location_code VARCHAR(100) NOT NULL,
  location_description TEXT NOT NULL,
  activity_code VARCHAR(100) NULL,
  activity_description TEXT NULL,
  employee_id VARCHAR(50) NOT NULL,
  employee_name VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_engineer_activity_assignment
ON engineer_activity_master (
  company,
  project_code,
  location_code,
  (COALESCE(activity_code, '')),
  employee_id
);

CREATE TABLE IF NOT EXISTS rental_order_master (
  id SERIAL PRIMARY KEY,
  rental_order VARCHAR(50) UNIQUE NOT NULL,
  rental_description TEXT NOT NULL,
  status VARCHAR(100) NOT NULL,
  project_code VARCHAR(50) NOT NULL,
  project_description VARCHAR(255) NOT NULL,
  item_type_in_transaction VARCHAR(100) NOT NULL,
  item_code VARCHAR(100) NULL,
  item_description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_office_master (
  id SERIAL PRIMARY KEY,
  purchase_order VARCHAR(50) UNIQUE NOT NULL,
  buy_from_business_partner VARCHAR(100) NOT NULL,
  bp_description TEXT NOT NULL,
  status VARCHAR(100) NOT NULL,
  purchase_office VARCHAR(100) NOT NULL,
  purchase_office_description TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_office_code_master (
  id SERIAL PRIMARY KEY,
  purchase_office VARCHAR(100) UNIQUE NOT NULL,
  purchase_office_description TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'indent_status'
  ) THEN
    CREATE TYPE indent_status AS ENUM ('Pending', 'Approved', 'Rejected', 'Issued');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS indents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indent_no VARCHAR(50) UNIQUE NOT NULL,
  created_by VARCHAR(50) NOT NULL REFERENCES users(login_name),
  project_code VARCHAR(50) NOT NULL,
  delivery_location VARCHAR(80) NOT NULL,
  requirement_type VARCHAR(80) NOT NULL,
  item_code VARCHAR(50) NOT NULL,
  make VARCHAR(120),
  required_qty NUMERIC(14, 3) NOT NULL,
  uom VARCHAR(50) NOT NULL,
  remarks TEXT,
  status indent_status NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_login_name ON users(login_name);
CREATE INDEX IF NOT EXISTS idx_project_master_code ON project_master(project_code);
CREATE INDEX IF NOT EXISTS idx_service_orders_item_code ON service_orders(item_code);
CREATE INDEX IF NOT EXISTS idx_service_orders_project_site ON service_orders(project_site);
CREATE INDEX IF NOT EXISTS idx_warehouse_master_site ON warehouse_master(project_site);
CREATE INDEX IF NOT EXISTS idx_warehouse_master_code ON warehouse_master(warehouse_code);
CREATE INDEX IF NOT EXISTS idx_warehouse_location_master_project ON warehouse_location_master(project_code);
CREATE INDEX IF NOT EXISTS idx_warehouse_location_master_warehouse ON warehouse_location_master(warehouse_code);
CREATE INDEX IF NOT EXISTS idx_warehouse_location_master_location ON warehouse_location_master(location_code);
CREATE INDEX IF NOT EXISTS idx_responsibility_master_project_id ON responsibility_master(project_id);
CREATE INDEX IF NOT EXISTS idx_responsibility_master_employee_id ON responsibility_master(employee_id);
CREATE INDEX IF NOT EXISTS idx_role_master_role_name ON role_master(role_name);
CREATE INDEX IF NOT EXISTS idx_business_partner_master_code ON business_partner_master(business_partner_code);
CREATE INDEX IF NOT EXISTS idx_business_partner_master_name ON business_partner_master(business_partner_name);
CREATE INDEX IF NOT EXISTS idx_bp_activity_master_project ON bp_activity_master(project_code);
CREATE INDEX IF NOT EXISTS idx_bp_activity_master_location ON bp_activity_master(location_code);
CREATE INDEX IF NOT EXISTS idx_bp_activity_master_bp ON bp_activity_master(business_partner_code);
CREATE INDEX IF NOT EXISTS idx_delivery_master_project ON delivery_master(project_code);
CREATE INDEX IF NOT EXISTS idx_delivery_master_address ON delivery_master(address_code);
CREATE INDEX IF NOT EXISTS idx_engineer_activity_master_project ON engineer_activity_master(project_code);
CREATE INDEX IF NOT EXISTS idx_engineer_activity_master_location ON engineer_activity_master(location_code);
CREATE INDEX IF NOT EXISTS idx_engineer_activity_master_employee ON engineer_activity_master(employee_id);
CREATE INDEX IF NOT EXISTS idx_rental_order_master_project ON rental_order_master(project_code);
CREATE INDEX IF NOT EXISTS idx_rental_order_master_status ON rental_order_master(status);
CREATE INDEX IF NOT EXISTS idx_purchase_office_master_bp ON purchase_office_master(buy_from_business_partner);
CREATE INDEX IF NOT EXISTS idx_purchase_office_master_office ON purchase_office_master(purchase_office);
CREATE INDEX IF NOT EXISTS idx_purchase_office_code_master_office ON purchase_office_code_master(purchase_office);
CREATE INDEX IF NOT EXISTS idx_indents_status ON indents(status);
CREATE INDEX IF NOT EXISTS idx_indents_created_by ON indents(created_by);
CREATE INDEX IF NOT EXISTS idx_indents_project_code ON indents(project_code);
CREATE INDEX IF NOT EXISTS idx_indents_created_at ON indents(created_at);

CREATE TABLE IF NOT EXISTS indent_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_request_id VARCHAR(80),
  indent_no VARCHAR(50) UNIQUE NOT NULL,
  project_code VARCHAR(50) NOT NULL,
  source_warehouse VARCHAR(100),
  source_location VARCHAR(100),
  delivery_location VARCHAR(100),
  requirement_type VARCHAR(80),
  indent_type VARCHAR(80) NOT NULL DEFAULT 'Issue',
  to_entity_type VARCHAR(80),
  to_entity_id VARCHAR(120),
  status VARCHAR(50) NOT NULL DEFAULT 'Created',
  created_by VARCHAR(50) NOT NULL REFERENCES users(login_name),
  synced_at TIMESTAMP,
  approved_by VARCHAR(50),
  approved_at TIMESTAMP,
  remarks TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS indent_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indent_header_id UUID NOT NULL REFERENCES indent_headers(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  item_code VARCHAR(100) NOT NULL,
  item_description TEXT,
  make VARCHAR(120),
  uom VARCHAR(50) NOT NULL,
  required_qty NUMERIC(14, 3) NOT NULL,
  issued_qty NUMERIC(14, 3) NOT NULL DEFAULT 0,
  work_type VARCHAR(80),
  activity_code VARCHAR(100),
  location_code VARCHAR(100),
  remarks TEXT,
  attachment_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_indent_line_number UNIQUE (indent_header_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_indent_headers_indent_no ON indent_headers(indent_no);
DROP INDEX IF EXISTS idx_indent_headers_app_request_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_indent_headers_app_request_id_unique
ON indent_headers (app_request_id)
WHERE app_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_indent_headers_status ON indent_headers(status);
CREATE INDEX IF NOT EXISTS idx_indent_headers_created_by ON indent_headers(created_by);
CREATE INDEX IF NOT EXISTS idx_indent_headers_project_code ON indent_headers(project_code);
CREATE INDEX IF NOT EXISTS idx_indent_headers_created_at ON indent_headers(created_at);
CREATE INDEX IF NOT EXISTS idx_indent_lines_header_id ON indent_lines(indent_header_id);
CREATE INDEX IF NOT EXISTS idx_indent_lines_item_code ON indent_lines(item_code);

INSERT INTO indent_headers (
  id,
  indent_no,
  project_code,
  delivery_location,
  requirement_type,
  indent_type,
  status,
  created_by,
  remarks,
  created_at,
  updated_at
)
SELECT
  i.id,
  i.indent_no,
  i.project_code,
  i.delivery_location,
  i.requirement_type,
  'Issue',
  i.status::text,
  i.created_by,
  i.remarks,
  i.created_at,
  i.updated_at
FROM indents i
ON CONFLICT (indent_no) DO NOTHING;

INSERT INTO indent_lines (
  indent_header_id,
  line_number,
  item_code,
  make,
  uom,
  required_qty,
  issued_qty,
  remarks,
  created_at,
  updated_at
)
SELECT
  h.id,
  1,
  i.item_code,
  i.make,
  i.uom,
  i.required_qty,
  0,
  i.remarks,
  i.created_at,
  i.updated_at
FROM indents i
JOIN indent_headers h ON h.indent_no = i.indent_no
ON CONFLICT (indent_header_id, line_number) DO NOTHING;
