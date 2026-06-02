from __future__ import annotations

import argparse
import csv
import os
import subprocess
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from io import StringIO
from pathlib import Path
from zipfile import ZipFile


SPREADSHEET_NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def read_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def column_index(cell_ref: str) -> int:
    letters = "".join(character for character in cell_ref if character.isalpha())
    index = 0
    for character in letters:
        index = index * 26 + ord(character.upper()) - 64
    return index - 1


def parse_excel_date(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return ""

    try:
        serial = float(text)
    except ValueError:
        pass
    else:
        if serial > 0:
            return (datetime(1899, 12, 30) + timedelta(days=serial)).date().isoformat()

    for date_format in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(text, date_format).date().isoformat()
        except ValueError:
            continue

    return ""


def cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    value_node = cell.find("a:v", SPREADSHEET_NS)
    inline_node = cell.find("a:is", SPREADSHEET_NS)

    if inline_node is not None:
        return "".join(text.text or "" for text in inline_node.findall(".//a:t", SPREADSHEET_NS)).strip()

    value = "" if value_node is None else value_node.text or ""
    if cell.attrib.get("t") == "s" and value:
        return shared_strings[int(value)].strip()
    return value.strip()


def read_workbook_rows(path: Path) -> list[dict[str, str]]:
    with ZipFile(path) as archive:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for shared_item in shared_root.findall("a:si", SPREADSHEET_NS):
                shared_strings.append(
                    "".join(text.text or "" for text in shared_item.findall(".//a:t", SPREADSHEET_NS))
                )

        sheet_root = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        parsed_rows: list[list[str]] = []

        for row in sheet_root.findall("a:sheetData/a:row", SPREADSHEET_NS):
            values: list[str] = []
            for cell in row.findall("a:c", SPREADSHEET_NS):
                index = column_index(cell.attrib["r"])
                while len(values) <= index:
                    values.append("")
                values[index] = cell_value(cell, shared_strings)
            parsed_rows.append(values)

    if not parsed_rows:
        return []

    headers = parsed_rows[0]
    rows: list[dict[str, str]] = []
    for parsed_row in parsed_rows[1:]:
        if not any(value.strip() for value in parsed_row):
            continue
        padded_row = parsed_row + [""] * (len(headers) - len(parsed_row))
        rows.append(dict(zip(headers, padded_row)))
    return rows


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def build_sql(rows: list[dict[str, str]], default_pin: str) -> str:
    csv_buffer = StringIO()
    writer = csv.writer(csv_buffer, lineterminator="\n")

    for row in rows:
        writer.writerow(
            [
                row.get("Company Code", "").strip(),
                row.get("Employee ID", "").strip(),
                row.get("Employee Name", "").strip(),
                row.get("Project ID", "").strip(),
                row.get("Project Description", "").strip(),
                row.get("Responsibility", "").strip(),
                parse_excel_date(row.get("Valid From", "")),
                parse_excel_date(row.get("Valid To", "")),
            ]
        )

    default_pin_sql = sql_literal(default_pin)

    return f"""
\\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS user_master (
  id SERIAL PRIMARY KEY,
  company_code VARCHAR(20),
  employee_id VARCHAR(50) NOT NULL,
  employee_name VARCHAR(150) NOT NULL,
  project_id VARCHAR(50) NOT NULL,
  project_description VARCHAR(255),
  responsibility VARCHAR(150) NOT NULL,
  valid_from DATE NULL,
  valid_to DATE NULL,
  manual_status VARCHAR(20) DEFAULT 'Active',
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE user_master ADD COLUMN IF NOT EXISTS company_code VARCHAR(20);
ALTER TABLE user_master ADD COLUMN IF NOT EXISTS project_id VARCHAR(50);
ALTER TABLE user_master ADD COLUMN IF NOT EXISTS project_description VARCHAR(255);
ALTER TABLE user_master ADD COLUMN IF NOT EXISTS responsibility VARCHAR(150);
ALTER TABLE user_master ADD COLUMN IF NOT EXISTS valid_from DATE NULL;
ALTER TABLE user_master ADD COLUMN IF NOT EXISTS valid_to DATE NULL;
ALTER TABLE user_master ADD COLUMN IF NOT EXISTS manual_status VARCHAR(20) DEFAULT 'Active';
ALTER TABLE user_master ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE user_master ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_master_assignment_key
  ON user_master (employee_id, project_id, responsibility);

CREATE TEMP TABLE responsibility_import (
  company_code TEXT,
  employee_id TEXT,
  employee_name TEXT,
  project_id TEXT,
  project_description TEXT,
  responsibility TEXT,
  valid_from DATE,
  valid_to DATE
) ON COMMIT DROP;

COPY responsibility_import (
  company_code,
  employee_id,
  employee_name,
  project_id,
  project_description,
  responsibility,
  valid_from,
  valid_to
) FROM STDIN WITH CSV;
{csv_buffer.getvalue()}\\.

WITH deduped_import AS (
  SELECT DISTINCT ON (employee_id, project_id, responsibility)
    company_code,
    employee_id,
    employee_name,
    project_id,
    project_description,
    responsibility,
    valid_from,
    valid_to
  FROM responsibility_import
  WHERE employee_id <> '' AND employee_name <> '' AND project_id <> '' AND responsibility <> ''
  ORDER BY employee_id, project_id, responsibility
)
INSERT INTO user_master (
  company_code,
  employee_id,
  employee_name,
  project_id,
  project_description,
  responsibility,
  valid_from,
  valid_to,
  manual_status,
  password_hash,
  updated_at
)
SELECT
  NULLIF(company_code, ''),
  employee_id,
  employee_name,
  project_id,
  NULLIF(project_description, ''),
  responsibility,
  valid_from,
  valid_to,
  'Active',
  {default_pin_sql},
  CURRENT_TIMESTAMP
FROM deduped_import
ON CONFLICT (employee_id, project_id, responsibility)
DO UPDATE SET
  company_code = EXCLUDED.company_code,
  employee_name = EXCLUDED.employee_name,
  project_description = EXCLUDED.project_description,
  valid_from = EXCLUDED.valid_from,
  valid_to = EXCLUDED.valid_to,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO users (
  login_name,
  employee_name,
  primary_role,
  password_hash,
  is_active,
  current_pin
)
SELECT DISTINCT ON (employee_id)
  employee_id,
  employee_name,
  responsibility,
  crypt({default_pin_sql}, gen_salt('bf')),
  TRUE,
  {default_pin_sql}
FROM responsibility_import
WHERE employee_id <> '' AND employee_name <> ''
ORDER BY employee_id, project_id, responsibility
ON CONFLICT (login_name)
DO UPDATE SET
  employee_name = EXCLUDED.employee_name,
  current_pin = EXCLUDED.current_pin;

SELECT
  (SELECT COUNT(*) FROM user_master) AS total_user_master_rows,
  (SELECT COUNT(*) FROM responsibility_import) AS workbook_rows,
  (SELECT COUNT(DISTINCT employee_id) FROM responsibility_import) AS unique_employees;

COMMIT;
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Import Responsibility.xlsx into User Master tables.")
    parser.add_argument(
        "workbook",
        nargs="?",
        default=r"c:\Users\Hemanth\Downloads\Responsibility.xlsx",
        help="Path to Responsibility.xlsx",
    )
    parser.add_argument("--default-pin", default="123456", help="Default 6-digit PIN for imported users")
    args = parser.parse_args()

    if not args.default_pin.isdigit() or len(args.default_pin) != 6:
        print("Default PIN must be exactly 6 digits.", file=sys.stderr)
        return 1

    root = Path(__file__).resolve().parent
    dotenv = read_dotenv(root / ".env")
    database_url = os.environ.get("DATABASE_URL") or dotenv.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL was not found in the environment or ncc-indent-api/.env.", file=sys.stderr)
        return 1

    workbook_path = Path(args.workbook)
    rows = read_workbook_rows(workbook_path)
    if not rows:
        print(f"No rows found in {workbook_path}.", file=sys.stderr)
        return 1

    sql = build_sql(rows, args.default_pin)
    result = subprocess.run(
        ["psql", database_url],
        input=sql,
        text=True,
        capture_output=True,
        cwd=root,
    )

    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
