import { query } from './pool.js'

export async function ensureSchema() {
  await query('CREATE EXTENSION IF NOT EXISTS pgcrypto')
  await query(`
    CREATE TABLE IF NOT EXISTS user_master (
      id SERIAL PRIMARY KEY,
      employee_id VARCHAR(50) NOT NULL,
      employee_name VARCHAR(150) NOT NULL,
      project_id VARCHAR(50) NOT NULL,
      project_description VARCHAR(255) NOT NULL,
      responsibility VARCHAR(150) NOT NULL,
      valid_from DATE NULL,
      valid_to DATE NULL,
      manual_status VARCHAR(20) DEFAULT 'Active',
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await query('ALTER TABLE IF EXISTS user_master ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50)')
  await query('ALTER TABLE IF EXISTS user_master ADD COLUMN IF NOT EXISTS employee_name VARCHAR(150)')
  await query('ALTER TABLE IF EXISTS user_master ADD COLUMN IF NOT EXISTS project_id VARCHAR(50)')
  await query('ALTER TABLE IF EXISTS user_master ADD COLUMN IF NOT EXISTS project_description VARCHAR(255)')
  await query('ALTER TABLE IF EXISTS user_master ADD COLUMN IF NOT EXISTS responsibility VARCHAR(150)')
  await query('ALTER TABLE IF EXISTS user_master ADD COLUMN IF NOT EXISTS valid_from DATE NULL')
  await query('ALTER TABLE IF EXISTS user_master ADD COLUMN IF NOT EXISTS valid_to DATE NULL')
  await query("ALTER TABLE IF EXISTS user_master ADD COLUMN IF NOT EXISTS manual_status VARCHAR(20) DEFAULT 'Active'")
  await query('ALTER TABLE IF EXISTS user_master ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)')
  await query('ALTER TABLE IF EXISTS user_master ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_master_assignment_key
    ON user_master (employee_id, project_id, responsibility)
  `)
  await query('ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS current_pin VARCHAR(6)')
  await query('ALTER TABLE IF EXISTS users DROP COLUMN IF EXISTS employee_id_str')
  await query('ALTER TABLE IF EXISTS projects ADD COLUMN IF NOT EXISTS site_code VARCHAR(50)')
  await query('ALTER TABLE IF EXISTS projects ADD COLUMN IF NOT EXISTS address_code VARCHAR(50)')
  await query('ALTER TABLE IF EXISTS projects ADD COLUMN IF NOT EXISTS address_description TEXT')
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'projects_site_code_key'
      ) THEN
        ALTER TABLE projects ADD CONSTRAINT projects_site_code_key UNIQUE (site_code);
      END IF;
    END
    $$;
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS project_master (
      id SERIAL PRIMARY KEY,
      project_code VARCHAR(50) UNIQUE NOT NULL,
      project_description VARCHAR(255) NOT NULL,
      dpr_engineer_control VARCHAR(50) NOT NULL,
      multi_location_activity VARCHAR(20) NOT NULL,
      project_location_linked_activities VARCHAR(20) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await query('CREATE INDEX IF NOT EXISTS idx_project_master_code ON project_master(project_code)')

  await query(`
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
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await query('ALTER TABLE IF EXISTS item_master ADD COLUMN IF NOT EXISTS id SERIAL')
  await query('ALTER TABLE IF EXISTS item_master ADD COLUMN IF NOT EXISTS project_site VARCHAR(50)')
  await query('ALTER TABLE IF EXISTS item_master ADD COLUMN IF NOT EXISTS site_description VARCHAR(255)')
  await query('ALTER TABLE IF EXISTS item_master ADD COLUMN IF NOT EXISTS warehouse_code VARCHAR(50)')
  await query('ALTER TABLE IF EXISTS item_master ADD COLUMN IF NOT EXISTS warehouse_description VARCHAR(255)')
  await query('ALTER TABLE IF EXISTS item_master ADD COLUMN IF NOT EXISTS on_hand_qty DECIMAL(12, 4) DEFAULT 0.0000')
  await query('ALTER TABLE IF EXISTS item_master ADD COLUMN IF NOT EXISTS item_description TEXT')
  await query('ALTER TABLE IF EXISTS item_master ADD COLUMN IF NOT EXISTS purchase_unit VARCHAR(50)')
  await query('ALTER TABLE IF EXISTS item_master ADD COLUMN IF NOT EXISTS item_type VARCHAR(100)')
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_site_warehouse_item
    ON item_master (project_site, warehouse_code, item_code)
  `)

  await query(`
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
    )
  `)

  await query('CREATE INDEX IF NOT EXISTS idx_service_orders_item_code ON service_orders(item_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_service_orders_project_site ON service_orders(project_site)')

  await query(`
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
    )
  `)

  await query('CREATE INDEX IF NOT EXISTS idx_responsibility_master_project_id ON responsibility_master(project_id)')
  await query('CREATE INDEX IF NOT EXISTS idx_responsibility_master_employee_id ON responsibility_master(employee_id)')

  await query(`
    CREATE TABLE IF NOT EXISTS activity_master (
      id SERIAL PRIMARY KEY,
      activity_code VARCHAR(50) NOT NULL,
      project_code VARCHAR(50) NOT NULL,
      description TEXT NOT NULL,
      activity_type VARCHAR(100) NOT NULL,
      critical_capacity_type VARCHAR(100) NOT NULL,
      work_auth_status VARCHAR(100) NOT NULL,
      resource_required VARCHAR(20) NOT NULL,
      scheduled_start_date TIMESTAMP NULL,
      scheduled_finish_date TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await query('ALTER TABLE IF EXISTS activity_master ADD COLUMN IF NOT EXISTS project_code VARCHAR(50)')
  await query('ALTER TABLE IF EXISTS activity_master ADD COLUMN IF NOT EXISTS scheduled_start_date TIMESTAMP NULL')
  await query('ALTER TABLE IF EXISTS activity_master ADD COLUMN IF NOT EXISTS scheduled_finish_date TIMESTAMP NULL')
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_project_activity
    ON activity_master (project_code, activity_code)
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS location_master (
      id SERIAL PRIMARY KEY,
      project_code VARCHAR(50) NOT NULL,
      project_name VARCHAR(255) NOT NULL,
      location_code VARCHAR(50) NOT NULL,
      description VARCHAR(255) NOT NULL,
      status VARCHAR(20) DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await query('ALTER TABLE IF EXISTS location_master DROP CONSTRAINT IF EXISTS location_master_pkey')
  await query('ALTER TABLE IF EXISTS location_master ADD COLUMN IF NOT EXISTS id SERIAL')
  await query('ALTER TABLE IF EXISTS location_master ADD COLUMN IF NOT EXISTS project_code VARCHAR(50)')
  await query('ALTER TABLE IF EXISTS location_master ADD COLUMN IF NOT EXISTS project_name VARCHAR(255)')
  await query('ALTER TABLE IF EXISTS location_master ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT \'Active\'')
  await query('ALTER TABLE IF EXISTS location_master ALTER COLUMN location_code TYPE VARCHAR(50)')
  await query('ALTER TABLE IF EXISTS location_master ALTER COLUMN description TYPE VARCHAR(255)')
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'location_master_pkey'
      ) THEN
        ALTER TABLE location_master ADD CONSTRAINT location_master_pkey PRIMARY KEY (id);
      END IF;
    END
    $$;
  `)
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_project_location
    ON location_master (project_code, location_code)
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS business_partner_master (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_code VARCHAR(50),
      location_code VARCHAR(80),
      location_description TEXT,
      activity_code VARCHAR(80),
      activity_description TEXT,
      business_partner_code VARCHAR(80) NOT NULL,
      bp_name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await query(`
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
    )
  `)

  await query(`
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
    )
  `)
  await query('ALTER TABLE IF EXISTS warehouse_master ADD COLUMN IF NOT EXISTS id SERIAL')
  await query('ALTER TABLE IF EXISTS warehouse_master ADD COLUMN IF NOT EXISTS warehouse_description VARCHAR(255)')
  await query('ALTER TABLE IF EXISTS warehouse_master ADD COLUMN IF NOT EXISTS project_site VARCHAR(50)')
  await query('ALTER TABLE IF EXISTS warehouse_master ADD COLUMN IF NOT EXISTS is_material_warehouse VARCHAR(10)')
  await query('ALTER TABLE IF EXISTS warehouse_master ADD COLUMN IF NOT EXISTS is_virtual_warehouse VARCHAR(10)')

  await query(`
    CREATE TABLE IF NOT EXISTS warehouse_bin_master (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      warehouse_code VARCHAR(80) NOT NULL,
      description TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await query(`
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
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS delivery_point_master (
      delivery_point_code VARCHAR(80) PRIMARY KEY,
      address_code VARCHAR(80) NOT NULL,
      address_description TEXT,
      description TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await query(`
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
    )
  `)

  await query('CREATE INDEX IF NOT EXISTS idx_activity_master_code ON activity_master(activity_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_activity_master_project ON activity_master(project_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_business_partner_master_project ON business_partner_master(project_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_business_partner_master_bp ON business_partner_master(business_partner_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_bp_activity_master_project ON bp_activity_master(project_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_bp_activity_master_location ON bp_activity_master(location_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_bp_activity_master_bp ON bp_activity_master(business_partner_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_warehouse_master_site ON warehouse_master(project_site)')
  await query('CREATE INDEX IF NOT EXISTS idx_warehouse_bin_master_warehouse ON warehouse_bin_master(warehouse_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_warehouse_location_master_project ON warehouse_location_master(project_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_warehouse_location_master_warehouse ON warehouse_location_master(warehouse_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_warehouse_location_master_location ON warehouse_location_master(location_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_delivery_point_master_address ON delivery_point_master(address_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_delivery_master_project ON delivery_master(project_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_delivery_master_address ON delivery_master(address_code)')

  await query(`
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
  `)

  await query(`
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
    )
  `)

  await query('CREATE INDEX IF NOT EXISTS idx_indents_status ON indents(status)')
  await query('CREATE INDEX IF NOT EXISTS idx_indents_created_by ON indents(created_by)')
  await query('CREATE INDEX IF NOT EXISTS idx_indents_project_code ON indents(project_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_indents_created_at ON indents(created_at)')
}
