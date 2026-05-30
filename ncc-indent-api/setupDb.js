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
                project_name VARCHAR(255) NOT NULL,
                location VARCHAR(100),
                status VARCHAR(50) DEFAULT 'Ongoing'
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
            INSERT INTO projects (project_name, location, status) VALUES 
            ('Alpha Substation Upgrade', 'Hyderabad', 'Ongoing'),
            ('Metro Electrification Line B', 'Bangalore', 'Planning');
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
