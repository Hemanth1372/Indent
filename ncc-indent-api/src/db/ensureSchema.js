import { query } from './pool.js'

export async function ensureSchema() {
  await query('CREATE EXTENSION IF NOT EXISTS pgcrypto')
  await query('ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS current_pin VARCHAR(6)')
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
    CREATE TABLE IF NOT EXISTS item_master (
      item_code VARCHAR(50) PRIMARY KEY,
      site_code VARCHAR(50),
      item_name VARCHAR(200) NOT NULL,
      description TEXT,
      purchase_unit VARCHAR(50),
      item_type VARCHAR(80),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await query('ALTER TABLE IF EXISTS item_master ADD COLUMN IF NOT EXISTS site_code VARCHAR(50)')
  await query('ALTER TABLE IF EXISTS item_master ADD COLUMN IF NOT EXISTS purchase_unit VARCHAR(50)')
  await query('ALTER TABLE IF EXISTS item_master ADD COLUMN IF NOT EXISTS item_type VARCHAR(80)')

  await query(`
    CREATE TABLE IF NOT EXISTS service_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      service_order_no VARCHAR(50) UNIQUE NOT NULL,
      status VARCHAR(50) NOT NULL,
      item_code VARCHAR(50) NOT NULL REFERENCES item_master(item_code),
      serial_number VARCHAR(100),
      description TEXT,
      project_site VARCHAR(50) NOT NULL REFERENCES projects(site_code),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await query('CREATE INDEX IF NOT EXISTS idx_service_orders_item_code ON service_orders(item_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_service_orders_project_site ON service_orders(project_site)')

  await query(`
    CREATE TABLE IF NOT EXISTS responsibility_master (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_code VARCHAR(50) NOT NULL REFERENCES projects(site_code),
      responsibility_code VARCHAR(50) NOT NULL,
      description VARCHAR(200) NOT NULL,
      valid_to DATE NOT NULL,
      end_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await query('CREATE INDEX IF NOT EXISTS idx_responsibility_master_project_code ON responsibility_master(project_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_responsibility_master_code ON responsibility_master(responsibility_code)')

  await query(`
    CREATE TABLE IF NOT EXISTS activity_master (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      activity_code VARCHAR(80) NOT NULL,
      description TEXT NOT NULL,
      activity_type VARCHAR(100),
      critical_capacity_type VARCHAR(100),
      work_auth_status VARCHAR(80),
      resource_required VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS location_master (
      location_code VARCHAR(80) PRIMARY KEY,
      description TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
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
    CREATE TABLE IF NOT EXISTS warehouse_master (
      warehouse_code VARCHAR(80) PRIMARY KEY,
      description TEXT NOT NULL,
      site_code VARCHAR(50),
      site_description TEXT,
      material_warehouse VARCHAR(80),
      virtual_warehouse VARCHAR(80),
      is_virtual BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

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
    CREATE TABLE IF NOT EXISTS delivery_point_master (
      delivery_point_code VARCHAR(80) PRIMARY KEY,
      address_code VARCHAR(80) NOT NULL,
      address_description TEXT,
      description TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await query('CREATE INDEX IF NOT EXISTS idx_activity_master_code ON activity_master(activity_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_business_partner_master_project ON business_partner_master(project_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_business_partner_master_bp ON business_partner_master(business_partner_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_warehouse_master_site ON warehouse_master(site_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_warehouse_bin_master_warehouse ON warehouse_bin_master(warehouse_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_delivery_point_master_address ON delivery_point_master(address_code)')

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
      item_code VARCHAR(50) NOT NULL REFERENCES item_master(item_code),
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
