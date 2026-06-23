import { query } from './pool.js'

async function repairSerialSequence(tableName, columnName = 'id') {
  if (!/^[a-z_][a-z0-9_]*$/i.test(tableName) || !/^[a-z_][a-z0-9_]*$/i.test(columnName)) {
    throw new Error('Invalid sequence repair target')
  }

  const sequenceResult = await query('SELECT pg_get_serial_sequence($1, $2) AS sequence_name', [tableName, columnName])
  const sequenceName = sequenceResult.rows[0]?.sequence_name

  if (!sequenceName) {
    return
  }

  await query(
    `
      SELECT setval(
        $1::regclass,
        GREATEST((SELECT COALESCE(MAX("${columnName}"), 0) FROM "${tableName}"), 1),
        true
      )
    `,
    [sequenceName],
  )
}

export async function ensureSchema() {
  await query('CREATE EXTENSION IF NOT EXISTS pgcrypto')
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      login_name VARCHAR(50) UNIQUE NOT NULL,
      employee_name VARCHAR(100) NOT NULL,
      primary_role VARCHAR(50),
      is_active BOOLEAN DEFAULT TRUE,
      is_deleted BOOLEAN DEFAULT FALSE,
      password_hash VARCHAR(255) NOT NULL,
      current_pin VARCHAR(6),
      session_version INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await query('DROP TABLE IF EXISTS user_project_roles CASCADE')
  await query('DROP TABLE IF EXISTS activities CASCADE')
  await query('DROP TABLE IF EXISTS user_master CASCADE')
  await query('DROP TABLE IF EXISTS projects CASCADE')
  await query('DROP TABLE IF EXISTS delivery_point_master CASCADE')
  await query('ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS current_pin VARCHAR(6)')
  await query('ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS session_version INTEGER DEFAULT 0')
  await query('UPDATE users SET session_version = 0 WHERE session_version IS NULL')
  await query('ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE')
  await query('ALTER TABLE IF EXISTS users DROP COLUMN IF EXISTS employee_id_str')

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
    CREATE UNIQUE INDEX IF NOT EXISTS idx_project_master_project_code_unique
    ON project_master (project_code)
  `)

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
      item_description TEXT NULL,
      serial_number VARCHAR(100),
      project_site VARCHAR(50) NOT NULL,
      project_description VARCHAR(255) NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await query('ALTER TABLE IF EXISTS service_orders ADD COLUMN IF NOT EXISTS item_description TEXT NULL')
  await query('ALTER TABLE IF EXISTS service_orders ADD COLUMN IF NOT EXISTS project_description VARCHAR(255) NULL')
  await query(`
    UPDATE service_orders AS service
    SET
      item_description = COALESCE(NULLIF(service.item_description, ''), item.item_description, service.description),
      updated_at = CURRENT_TIMESTAMP
    FROM item_master AS item
    WHERE service.project_site = item.project_site
      AND service.item_code = item.item_code
      AND (
        service.item_description IS NULL
        OR service.item_description = ''
      )
  `)
  await query(`
    UPDATE service_orders AS service
    SET
      project_description = project.project_description,
      updated_at = CURRENT_TIMESTAMP
    FROM project_master AS project
    WHERE service.project_site = project.project_code
      AND (
        service.project_description IS NULL
        OR service.project_description = ''
        OR service.project_description IS DISTINCT FROM project.project_description
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await query('ALTER TABLE IF EXISTS responsibility_master ADD COLUMN IF NOT EXISTS project_id VARCHAR(50)')
  await query('ALTER TABLE IF EXISTS responsibility_master ADD COLUMN IF NOT EXISTS project_code VARCHAR(50)')
  await query(`
    UPDATE responsibility_master
    SET project_id = COALESCE(NULLIF(project_id, ''), NULLIF(project_code, ''))
    WHERE project_id IS NULL OR project_id = ''
  `)
  await query(`
    UPDATE responsibility_master
    SET project_code = COALESCE(NULLIF(project_code, ''), NULLIF(project_id, ''))
    WHERE project_code IS NULL OR project_code = ''
  `)
  await query('ALTER TABLE IF EXISTS responsibility_master ALTER COLUMN project_code DROP NOT NULL')
  await query('ALTER TABLE IF EXISTS responsibility_master ALTER COLUMN project_id SET NOT NULL')
  await query('ALTER TABLE IF EXISTS responsibility_master DROP COLUMN IF EXISTS password_hash')

  await query('CREATE INDEX IF NOT EXISTS idx_responsibility_master_project_id ON responsibility_master(project_id)')
  await query('CREATE INDEX IF NOT EXISTS idx_responsibility_master_employee_id ON responsibility_master(employee_id)')
  await repairSerialSequence('responsibility_master')

  await query(`
    CREATE TABLE IF NOT EXISTS role_master (
      id SERIAL PRIMARY KEY,
      role_name VARCHAR(150) UNIQUE NOT NULL,
      description TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await query('ALTER TABLE IF EXISTS role_master DROP COLUMN IF EXISTS status')
  await query('CREATE INDEX IF NOT EXISTS idx_role_master_role_name ON role_master(role_name)')
  await query(`
    INSERT INTO role_master (role_name, description)
    SELECT DISTINCT
      COALESCE(NULLIF(SUBSTRING(responsibility FROM '\\(([^()]*)\\)\\s*$'), ''), TRIM(responsibility)) AS role_name,
      NULLIF(TRIM(REGEXP_REPLACE(responsibility, '\\s*\\([^()]*\\)\\s*$', '')), '') AS description
    FROM responsibility_master
    WHERE responsibility IS NOT NULL AND TRIM(responsibility) <> ''
    ON CONFLICT (role_name) DO NOTHING
  `)
  await query(`
    DELETE FROM role_master AS stale
    WHERE stale.role_name ~ '\\([^()]+\\)\\s*$'
      AND EXISTS (
        SELECT 1
        FROM role_master AS parsed
        WHERE parsed.role_name = SUBSTRING(stale.role_name FROM '\\(([^()]*)\\)\\s*$')
      )
  `)
  await query(`
    UPDATE role_master
    SET description = COALESCE(
          NULLIF(TRIM(description), ''),
          NULLIF(TRIM(REGEXP_REPLACE(role_name, '\\s*\\([^()]*\\)\\s*$', '')), '')
        ),
        role_name = COALESCE(NULLIF(SUBSTRING(role_name FROM '\\(([^()]*)\\)\\s*$'), ''), role_name),
        updated_at = CURRENT_TIMESTAMP
    WHERE role_name ~ '\\([^()]+\\)\\s*$'
  `)
  await query(`
    DELETE FROM role_master AS plain_dup
    USING role_master AS coded
    WHERE plain_dup.id <> coded.id
      AND UPPER(TRIM(plain_dup.role_name)) = UPPER(TRIM(COALESCE(plain_dup.description, plain_dup.role_name)))
      AND (
        UPPER(TRIM(COALESCE(coded.description, ''))) = UPPER(TRIM(plain_dup.role_name))
        OR UPPER(TRIM(REGEXP_REPLACE(COALESCE(coded.description, ''), '\\s*\\([^()]*\\)\\s*$', ''))) = UPPER(TRIM(plain_dup.role_name))
      )
      AND UPPER(TRIM(coded.role_name)) <> UPPER(TRIM(COALESCE(coded.description, coded.role_name)))
  `)
  await query(`
    UPDATE responsibility_master
    SET responsibility = coded.canonical,
        updated_at = CURRENT_TIMESTAMP
    FROM (
      SELECT
        COALESCE(NULLIF(rm.description, ''), rm.role_name) AS canonical,
        UPPER(TRIM(REGEXP_REPLACE(COALESCE(rm.description, rm.role_name), '\\s*\\([^()]*\\)\\s*$', ''))) AS base_upper
      FROM role_master rm
      WHERE UPPER(TRIM(rm.role_name)) <> UPPER(TRIM(COALESCE(rm.description, rm.role_name)))
    ) coded
    WHERE UPPER(TRIM(responsibility_master.responsibility)) = coded.base_upper
      AND responsibility_master.responsibility IS DISTINCT FROM coded.canonical
  `)

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
      id SERIAL PRIMARY KEY,
      business_partner_code VARCHAR(100) UNIQUE NOT NULL,
      business_partner_name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await query('ALTER TABLE IF EXISTS business_partner_master ADD COLUMN IF NOT EXISTS business_partner_code VARCHAR(100)')
  await query('ALTER TABLE IF EXISTS business_partner_master ADD COLUMN IF NOT EXISTS business_partner_name VARCHAR(255)')
  await query('ALTER TABLE IF EXISTS business_partner_master ADD COLUMN IF NOT EXISTS bp_name VARCHAR(255)')
  await query('ALTER TABLE IF EXISTS business_partner_master ALTER COLUMN bp_name DROP NOT NULL')
  await query(`
    UPDATE business_partner_master
    SET business_partner_name = COALESCE(NULLIF(business_partner_name, ''), NULLIF(bp_name, ''), business_partner_code)
    WHERE business_partner_name IS NULL OR business_partner_name = ''
  `)
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_business_partner_master_code
    ON business_partner_master (business_partner_code)
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
    INSERT INTO business_partner_master (business_partner_code, business_partner_name)
    SELECT DISTINCT ON (business_partner_code)
      business_partner_code,
      business_partner_name
    FROM bp_activity_master
    WHERE business_partner_code IS NOT NULL
      AND btrim(business_partner_code) <> ''
      AND business_partner_name IS NOT NULL
      AND btrim(business_partner_name) <> ''
    ORDER BY business_partner_code, business_partner_name
    ON CONFLICT (business_partner_code) DO UPDATE
    SET business_partner_name = EXCLUDED.business_partner_name,
        updated_at = CURRENT_TIMESTAMP
    WHERE business_partner_master.business_partner_name IS DISTINCT FROM EXCLUDED.business_partner_name
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
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'warehouse_master' AND column_name = 'description'
      ) THEN
        UPDATE warehouse_master
        SET
          warehouse_description = COALESCE(NULLIF(warehouse_description, ''), NULLIF(description, ''), warehouse_code),
          project_site = COALESCE(NULLIF(project_site, ''), NULLIF(site_code, '')),
          is_material_warehouse = COALESCE(NULLIF(is_material_warehouse, ''), NULLIF(material_warehouse, ''), 'No'),
          is_virtual_warehouse = COALESCE(
            NULLIF(is_virtual_warehouse, ''),
            CASE WHEN is_virtual THEN 'Yes' ELSE NULL END,
            NULLIF(virtual_warehouse, ''),
            'No'
          ),
          updated_at = CURRENT_TIMESTAMP
        WHERE warehouse_description IS NULL
          OR warehouse_description = ''
          OR project_site IS NULL
          OR project_site = ''
          OR is_material_warehouse IS NULL
          OR is_material_warehouse = ''
          OR is_virtual_warehouse IS NULL
          OR is_virtual_warehouse = '';
      END IF;
    END $$;
  `)

  await query('DROP TABLE IF EXISTS warehouse_bin_master CASCADE')

  await query(`
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
    )
  `)
  await query("ALTER TABLE IF EXISTS warehouse_location_master ADD COLUMN IF NOT EXISTS project_description VARCHAR(255) NOT NULL DEFAULT ''")
  await query(`
    UPDATE warehouse_location_master AS location
    SET
      project_description = project.project_description,
      updated_at = CURRENT_TIMESTAMP
    FROM project_master AS project
    WHERE location.project_code = project.project_code
      AND (
        location.project_description IS NULL
        OR location.project_description = ''
        OR location.project_description IS DISTINCT FROM project.project_description
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

  await query(`
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
    )
  `)
  await query("ALTER TABLE IF EXISTS engineer_activity_master ALTER COLUMN company SET DEFAULT ''")

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_engineer_activity_assignment
    ON engineer_activity_master (
      company,
      project_code,
      location_code,
      (COALESCE(activity_code, '')),
      employee_id
    )
  `)

  await query(`
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
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS purchase_office_code_master (
      id SERIAL PRIMARY KEY,
      purchase_office VARCHAR(100) UNIQUE NOT NULL,
      purchase_office_description TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await query(`
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
    )
  `)
  await query(`
    INSERT INTO purchase_office_code_master (purchase_office, purchase_office_description)
    SELECT DISTINCT ON (purchase_office)
      purchase_office,
      purchase_office_description
    FROM purchase_office_master
    WHERE purchase_office IS NOT NULL
      AND btrim(purchase_office) <> ''
      AND purchase_office_description IS NOT NULL
      AND btrim(purchase_office_description) <> ''
    ORDER BY purchase_office, purchase_office_description
    ON CONFLICT (purchase_office) DO UPDATE
    SET purchase_office_description = EXCLUDED.purchase_office_description,
        updated_at = CURRENT_TIMESTAMP
    WHERE purchase_office_code_master.purchase_office_description IS DISTINCT FROM EXCLUDED.purchase_office_description
  `)

  await query('CREATE INDEX IF NOT EXISTS idx_activity_master_code ON activity_master(activity_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_activity_master_project ON activity_master(project_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_activity_master_project_code_search ON activity_master(project_code, activity_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_activity_master_project_lower ON activity_master(LOWER(btrim(project_code)))')
  await query('CREATE INDEX IF NOT EXISTS idx_activity_master_activity_code_lower ON activity_master(LOWER(activity_code))')
  await query('CREATE INDEX IF NOT EXISTS idx_activity_master_description_lower ON activity_master(LOWER(description))')
  await query('CREATE INDEX IF NOT EXISTS idx_item_master_project_warehouse_code ON item_master(project_site, warehouse_code, item_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_item_master_project_site_lower ON item_master(LOWER(btrim(project_site)))')
  await query('CREATE INDEX IF NOT EXISTS idx_item_master_warehouse_code_lower ON item_master(LOWER(btrim(warehouse_code)))')
  await query('CREATE INDEX IF NOT EXISTS idx_item_master_item_code_lower ON item_master(LOWER(item_code))')
  await query('CREATE INDEX IF NOT EXISTS idx_item_master_item_description_lower ON item_master(LOWER(item_description))')
  await query('CREATE INDEX IF NOT EXISTS idx_business_partner_master_code ON business_partner_master(business_partner_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_business_partner_master_name ON business_partner_master(business_partner_name)')
  await query('CREATE INDEX IF NOT EXISTS idx_bp_activity_master_project ON bp_activity_master(project_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_bp_activity_master_location ON bp_activity_master(location_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_bp_activity_master_bp ON bp_activity_master(business_partner_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_warehouse_master_site ON warehouse_master(project_site)')
  await query('CREATE INDEX IF NOT EXISTS idx_warehouse_location_master_project ON warehouse_location_master(project_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_warehouse_location_master_warehouse ON warehouse_location_master(warehouse_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_warehouse_location_master_location ON warehouse_location_master(location_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_delivery_master_project ON delivery_master(project_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_delivery_master_address ON delivery_master(address_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_engineer_activity_master_project ON engineer_activity_master(project_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_engineer_activity_master_location ON engineer_activity_master(location_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_engineer_activity_master_employee ON engineer_activity_master(employee_id)')
  await query('CREATE INDEX IF NOT EXISTS idx_rental_order_master_project ON rental_order_master(project_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_rental_order_master_status ON rental_order_master(status)')
  await query('CREATE INDEX IF NOT EXISTS idx_service_orders_project_status_order_lower ON service_orders(LOWER(btrim(project_site)), LOWER(COALESCE(NULLIF(btrim(status), \'\'), \'released\')), service_order_no)')
  await query('CREATE INDEX IF NOT EXISTS idx_rental_order_master_project_status_order_lower ON rental_order_master(LOWER(btrim(project_code)), LOWER(COALESCE(NULLIF(btrim(status), \'\'), \'released\')), rental_order)')
  await query('CREATE INDEX IF NOT EXISTS idx_bp_activity_master_project_location_lower ON bp_activity_master(LOWER(btrim(project_code)), LOWER(btrim(location_code)), business_partner_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_delivery_master_project_address_lower ON delivery_master(LOWER(btrim(project_code)), LOWER(btrim(address_code)), delivery_point)')
  await query('CREATE INDEX IF NOT EXISTS idx_purchase_office_master_bp ON purchase_office_master(buy_from_business_partner)')
  await query('CREATE INDEX IF NOT EXISTS idx_purchase_office_master_office ON purchase_office_master(purchase_office)')
  await query('CREATE INDEX IF NOT EXISTS idx_purchase_office_code_master_office ON purchase_office_code_master(purchase_office)')

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
    )
  `)

  await query('CREATE INDEX IF NOT EXISTS idx_indents_status ON indents(status)')
  await query('CREATE INDEX IF NOT EXISTS idx_indents_created_by ON indents(created_by)')
  await query('CREATE INDEX IF NOT EXISTS idx_indents_project_code ON indents(project_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_indents_created_at ON indents(created_at)')

  await query(`
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
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS indent_lines (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      indent_header_id UUID NOT NULL REFERENCES indent_headers(id) ON DELETE CASCADE,
      line_number INTEGER NOT NULL,
      item_code VARCHAR(100) NOT NULL,
      item_description TEXT,
      make VARCHAR(120),
      uom VARCHAR(50) NOT NULL,
      required_qty NUMERIC(14, 3) NOT NULL,
      approved_qty NUMERIC(14, 3),
      issued_qty NUMERIC(14, 3) NOT NULL DEFAULT 0,
      work_type VARCHAR(80),
      activity_code VARCHAR(100),
      location_code VARCHAR(100),
      remarks TEXT,
      attachment_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_indent_line_number UNIQUE (indent_header_id, line_number)
    )
  `)

  await query('CREATE INDEX IF NOT EXISTS idx_indent_headers_indent_no ON indent_headers(indent_no)')
  await query('DROP INDEX IF EXISTS idx_indent_headers_app_request_id')
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_indent_headers_app_request_id_unique
    ON indent_headers (app_request_id)
    WHERE app_request_id IS NOT NULL
  `)
  await query('CREATE INDEX IF NOT EXISTS idx_indent_headers_status ON indent_headers(status)')
  await query('CREATE INDEX IF NOT EXISTS idx_indent_headers_created_by ON indent_headers(created_by)')
  await query('CREATE INDEX IF NOT EXISTS idx_indent_headers_project_code ON indent_headers(project_code)')
  await query('CREATE INDEX IF NOT EXISTS idx_indent_headers_created_at ON indent_headers(created_at)')
  await query('ALTER TABLE IF EXISTS indent_lines ADD COLUMN IF NOT EXISTS approved_qty NUMERIC(14, 3)')
  await query('CREATE INDEX IF NOT EXISTS idx_indent_lines_header_id ON indent_lines(indent_header_id)')
  await query('CREATE INDEX IF NOT EXISTS idx_indent_lines_item_code ON indent_lines(item_code)')

  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      recipient_login VARCHAR(50) NOT NULL REFERENCES users(login_name) ON DELETE CASCADE,
      indent_header_id UUID REFERENCES indent_headers(id) ON DELETE CASCADE,
      indent_no VARCHAR(50),
      title VARCHAR(160) NOT NULL,
      message TEXT NOT NULL,
      status VARCHAR(50),
      target_path TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await query('CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_login, is_read, created_at DESC)')
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_event
    ON notifications (
      recipient_login,
      (COALESCE(indent_header_id, '00000000-0000-0000-0000-000000000000'::uuid)),
      title,
      (COALESCE(status, ''))
    )
  `)

  await query(`
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
    ON CONFLICT (indent_no) DO NOTHING
  `)

  await query(`
    INSERT INTO indent_lines (
      indent_header_id,
      line_number,
      item_code,
      make,
      uom,
      required_qty,
      approved_qty,
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
      i.required_qty,
      0,
      i.remarks,
      i.created_at,
      i.updated_at
    FROM indents i
    JOIN indent_headers h ON h.indent_no = i.indent_no
    ON CONFLICT (indent_header_id, line_number) DO NOTHING
  `)
}
