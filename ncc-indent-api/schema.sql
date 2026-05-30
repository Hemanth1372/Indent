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
  project_name VARCHAR(200) NOT NULL,
  location VARCHAR(200) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Active',
  CONSTRAINT projects_status_chk CHECK (status IN ('Active', 'Inactive', 'Completed', 'On Hold'))
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
CREATE INDEX IF NOT EXISTS idx_activities_project_id ON activities(project_id);
CREATE INDEX IF NOT EXISTS idx_user_project_roles_project_id ON user_project_roles(project_id);
