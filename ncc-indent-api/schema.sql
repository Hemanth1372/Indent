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

CREATE TABLE IF NOT EXISTS item_master (
  item_code VARCHAR(50) PRIMARY KEY,
  item_name VARCHAR(200) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
);

CREATE TABLE IF NOT EXISTS responsibility_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code VARCHAR(50) NOT NULL REFERENCES projects(site_code),
  responsibility_code VARCHAR(50) NOT NULL,
  description VARCHAR(200) NOT NULL,
  valid_to DATE NOT NULL,
  end_date DATE NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_service_orders_item_code ON service_orders(item_code);
CREATE INDEX IF NOT EXISTS idx_service_orders_project_site ON service_orders(project_site);
CREATE INDEX IF NOT EXISTS idx_responsibility_master_project_code ON responsibility_master(project_code);
CREATE INDEX IF NOT EXISTS idx_responsibility_master_code ON responsibility_master(responsibility_code);
CREATE INDEX IF NOT EXISTS idx_indents_status ON indents(status);
CREATE INDEX IF NOT EXISTS idx_indents_created_by ON indents(created_by);
CREATE INDEX IF NOT EXISTS idx_indents_project_code ON indents(project_code);
CREATE INDEX IF NOT EXISTS idx_indents_created_at ON indents(created_at);
CREATE INDEX IF NOT EXISTS idx_activities_project_id ON activities(project_id);
CREATE INDEX IF NOT EXISTS idx_user_project_roles_project_id ON user_project_roles(project_id);
