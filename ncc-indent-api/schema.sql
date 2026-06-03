CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  login_name VARCHAR(50) UNIQUE NOT NULL,
  employee_name VARCHAR(100) NOT NULL,
  employee_id_str VARCHAR(50),
  primary_role VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  password_hash VARCHAR(255) NOT NULL,
  current_pin VARCHAR(6),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_code VARCHAR(50) UNIQUE,
  project_name VARCHAR(200) NOT NULL,
  location VARCHAR(200) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Active',
  CONSTRAINT projects_status_chk CHECK (status IN ('Active', 'Inactive', 'Completed', 'On Hold'))
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
  serial_number VARCHAR(100),
  project_site VARCHAR(50) NOT NULL,
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
  password_hash VARCHAR(255) NOT NULL,
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

CREATE TABLE IF NOT EXISTS delivery_point_master (
  delivery_point_code VARCHAR(80) PRIMARY KEY,
  address_code VARCHAR(80) NOT NULL,
  address_description TEXT,
  description TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
  project_code VARCHAR(50) NOT NULL REFERENCES projects(site_code),
  delivery_location VARCHAR(80) NOT NULL REFERENCES delivery_point_master(delivery_point_code),
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

CREATE TABLE IF NOT EXISTS activities (
  activity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Not Started',
  CONSTRAINT activities_status_chk CHECK (status IN ('Not Started', 'In Progress', 'Completed', 'Blocked'))
);

CREATE TABLE IF NOT EXISTS user_project_roles (
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  role_name VARCHAR(80) NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_users_login_name ON users(login_name);
CREATE INDEX IF NOT EXISTS idx_projects_site_code ON projects(site_code);
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
CREATE INDEX IF NOT EXISTS idx_bp_activity_master_project ON bp_activity_master(project_code);
CREATE INDEX IF NOT EXISTS idx_bp_activity_master_location ON bp_activity_master(location_code);
CREATE INDEX IF NOT EXISTS idx_bp_activity_master_bp ON bp_activity_master(business_partner_code);
CREATE INDEX IF NOT EXISTS idx_delivery_point_master_address ON delivery_point_master(address_code);
CREATE INDEX IF NOT EXISTS idx_delivery_master_project ON delivery_master(project_code);
CREATE INDEX IF NOT EXISTS idx_delivery_master_address ON delivery_master(address_code);
CREATE INDEX IF NOT EXISTS idx_indents_status ON indents(status);
CREATE INDEX IF NOT EXISTS idx_indents_created_by ON indents(created_by);
CREATE INDEX IF NOT EXISTS idx_indents_project_code ON indents(project_code);
CREATE INDEX IF NOT EXISTS idx_indents_created_at ON indents(created_at);
CREATE INDEX IF NOT EXISTS idx_activities_project_id ON activities(project_id);
CREATE INDEX IF NOT EXISTS idx_user_project_roles_project_id ON user_project_roles(project_id);
