import bcrypt from "bcrypt";
import { pool } from "./src/db/pool.js";

const setupAndSeedDatabase = async () => {
  try {
    console.log("⏳ Starting Database Initialization & UI Data Seeding...");

    // --- 1. DROP EXISTING TABLES ---
    await pool.query(`
            DROP TABLE IF EXISTS activities CASCADE;
            DROP TABLE IF EXISTS user_project_roles CASCADE;
            DROP TABLE IF EXISTS projects CASCADE;
            DROP TABLE IF EXISTS users CASCADE;
        `);
    console.log("🧹 Cleaned up old tables.");

    // --- 2. CREATE NEW TABLES (MATCHING FRONTEND UI) ---
    await pool.query(`
            CREATE EXTENSION IF NOT EXISTS pgcrypto;

            CREATE TABLE users (
                user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                login_name VARCHAR(50) UNIQUE NOT NULL,   -- Matches "Login Name"
                employee_name VARCHAR(100) NOT NULL,      -- Matches "Employee Name"
                employee_id_str VARCHAR(50),              -- Matches "Employee ID" (string because of 'Jakka', '-')
                primary_role VARCHAR(50),                 -- Matches "Role"
                is_active BOOLEAN DEFAULT true,           -- Matches "Status" (Active/Inactive)
                password_hash VARCHAR(255) NOT NULL,
                current_pin VARCHAR(6),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE projects (
                project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                site_code VARCHAR(50) UNIQUE,
                project_name VARCHAR(255) NOT NULL,
                location VARCHAR(100),
                status VARCHAR(50) DEFAULT 'Ongoing'
            );

            CREATE TABLE project_master (
                id SERIAL PRIMARY KEY,
                project_code VARCHAR(50) UNIQUE NOT NULL,
                project_description VARCHAR(255) NOT NULL,
                dpr_engineer_control VARCHAR(50) NOT NULL,
                multi_location_activity VARCHAR(20) NOT NULL,
                project_location_linked_activities VARCHAR(20) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE item_master (
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

            CREATE TABLE service_orders (
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

            CREATE TABLE warehouse_master (
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

            CREATE TABLE warehouse_location_master (
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

            CREATE TABLE delivery_master (
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

            CREATE TABLE responsibility_master (
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

            CREATE TABLE bp_activity_master (
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

            CREATE TABLE user_project_roles (
                user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
                project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
                role_name VARCHAR(50) NOT NULL,
                PRIMARY KEY (user_id, project_id)
            );

            CREATE TABLE activities (
                activity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
                description TEXT NOT NULL,
                status VARCHAR(50) DEFAULT 'Pending'
            );
        `);
    console.log("✅ UI-Matched Tables created successfully.");

    // --- 3. SEED DUMMY DATA ---
    console.log("🌱 Injecting Exact Data from Screenshot...");

    const salt = await bcrypt.genSalt(10);
    // Universal password for testing
    const testPassword = await bcrypt.hash("test1234", salt);

    // Injecting the exact rows from your screenshot
    await pool.query(
      `
            INSERT INTO users (login_name, employee_name, employee_id_str, primary_role, is_active, password_hash, current_pin) VALUES 
            ('admin', 'System Administrator', 'ADMIN-01', 'Super Admin', true, $1, NULL);
        `,
      [testPassword],
    );

    // Add some dummy projects just to keep the relational data intact
    await pool.query(`
            INSERT INTO projects (site_code, project_name, location, status) VALUES 
            ('NUPEDS014', 'Alpha Substation Upgrade', 'Hyderabad', 'Ongoing'),
            ('NUPEDS015', 'Metro Electrification Line B', 'Bangalore', 'Planning');
        `);

    await pool.query(`
            INSERT INTO item_master (
              project_site,
              site_description,
              warehouse_code,
              warehouse_description,
              on_hand_qty,
              item_code,
              item_description,
              purchase_unit,
              item_type
            ) VALUES
            ('NUPEDS014', 'NUPEDS014', NULL, NULL, 0, 'ITM-003', '25 KVA Distribution Transformer', 'nos', 'Product'),
            ('NUPEDS014', 'NUPEDS014', NULL, NULL, 0, 'ITM-004', 'Service Cable Kit', 'nos', 'Product');
        `);

    await pool.query(`
            INSERT INTO service_orders (service_order_no, status, item_code, serial_number, description, project_site) VALUES
            ('SO-1001', 'Released', 'ITM-003', 'SN-DTR-25-001', '25 KVA Distribution Transformer - Installation', 'NUPEDS014');
        `);

    await pool.query(`
            INSERT INTO user_project_roles (user_id, project_id, role_name)
            SELECT u.user_id, p.project_id, 'Administrator'
            FROM users u
            CROSS JOIN projects p
            WHERE u.login_name = 'admin'
            ON CONFLICT (user_id, project_id) DO UPDATE
            SET role_name = EXCLUDED.role_name;
        `);

    await pool.query(`
            INSERT INTO user_project_roles (user_id, project_id, role_name)
            SELECT u.user_id, p.project_id, u.primary_role
            FROM users u
            JOIN projects p ON p.project_name = 'Alpha Substation Upgrade'
            WHERE u.login_name IN ('10075', '11518')
            ON CONFLICT (user_id, project_id) DO UPDATE
            SET role_name = EXCLUDED.role_name;
        `);

    console.log("🎉 Database fully seeded!");
    console.log("--------------------------------------------------");
    console.log("🧪 TEST ACCOUNTS (Password for all: test1234):");
    console.log("4. Login: admin (Sys Admin)");
    console.log("--------------------------------------------------");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error setting up database:", error);
    process.exit(1);
  }
};

setupAndSeedDatabase();
