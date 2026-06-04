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


NS = {
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
        return r"\N"

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

    return r"\N"


def cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    value_node = cell.find("a:v", NS)
    inline_node = cell.find("a:is", NS)

    if inline_node is not None:
        return "".join(text.text or "" for text in inline_node.findall(".//a:t", NS)).strip()

    value = "" if value_node is None else value_node.text or ""
    if cell.attrib.get("t") == "s" and value:
        return shared_strings[int(value)].strip()
    return value.strip()


def workbook_target(archive: ZipFile, sheet_name: str) -> str:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    target_by_id = {relationship.attrib["Id"]: relationship.attrib["Target"] for relationship in relationships}

    for sheet in workbook.findall("a:sheets/a:sheet", NS):
        if sheet.attrib["name"] != sheet_name:
            continue

        relationship_id = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
        target = target_by_id[relationship_id]

        if target.startswith("/"):
            return target.lstrip("/")

        return f"xl/{target}" if not target.startswith("xl/") else target

    raise ValueError(f"Sheet not found: {sheet_name}")


def read_workbook_rows(path: Path) -> list[dict[str, str]]:
    with ZipFile(path) as archive:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("a:si", NS):
                shared_strings.append("".join(text.text or "" for text in item.findall(".//a:t", NS)))

        sheet_root = ET.fromstring(archive.read(workbook_target(archive, "Responsibility")))
        parsed_rows: list[list[str]] = []

        for row in sheet_root.findall("a:sheetData/a:row", NS):
            values: list[str] = []
            for cell in row.findall("a:c", NS):
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
        rows.append(dict(zip(headers, parsed_row + [""] * (len(headers) - len(parsed_row)))))
    return rows


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def build_sql(rows: list[dict[str, str]], default_pin: str) -> str:
    csv_buffer = StringIO()
    writer = csv.writer(csv_buffer, lineterminator="\n")

    for row in rows:
        writer.writerow(
            [
                row.get("Employee ID", "").strip(),
                row.get("Employee Name", "").strip(),
                row.get("Project ID", "").strip(),
                row.get("Project Description", "").strip(),
                row.get("Responsibility", "").strip(),
                parse_excel_date(row.get("Valid From", "")),
                parse_excel_date(row.get("Valid To", "")),
                default_pin,
            ]
        )

    default_pin_sql = sql_literal(default_pin)

    return f"""
\\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS responsibility_master CASCADE;

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

CREATE INDEX idx_responsibility_master_project_id ON responsibility_master(project_id);
CREATE INDEX idx_responsibility_master_employee_id ON responsibility_master(employee_id);

CREATE TABLE IF NOT EXISTS user_master (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(50) NOT NULL,
  employee_name VARCHAR(150) NOT NULL,
  project_id VARCHAR(50) NOT NULL,
  project_description VARCHAR(255) NOT NULL,
  responsibility VARCHAR(255) NOT NULL,
  valid_from DATE NULL,
  valid_to DATE NULL,
  manual_status VARCHAR(20) DEFAULT 'Active',
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE user_master DROP COLUMN IF EXISTS company_code;
ALTER TABLE user_master ALTER COLUMN responsibility TYPE VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_master_assignment_key
  ON user_master (employee_id, project_id, responsibility);

CREATE TEMP TABLE responsibility_import (
  employee_id TEXT,
  employee_name TEXT,
  project_id TEXT,
  project_description TEXT,
  responsibility TEXT,
  valid_from DATE,
  valid_to DATE,
  password_hash TEXT
) ON COMMIT DROP;

COPY responsibility_import (
  employee_id,
  employee_name,
  project_id,
  project_description,
  responsibility,
  valid_from,
  valid_to,
  password_hash
) FROM STDIN WITH CSV NULL '\\N';
{csv_buffer.getvalue()}\\.

INSERT INTO responsibility_master (
  employee_id,
  employee_name,
  project_id,
  project_description,
  responsibility,
  valid_from,
  valid_to,
  manual_status,
  password_hash
)
SELECT
  employee_id,
  employee_name,
  project_id,
  project_description,
  responsibility,
  valid_from,
  valid_to,
  'Active',
  password_hash
FROM responsibility_import
WHERE employee_id <> ''
  AND employee_name <> ''
  AND project_id <> ''
  AND project_description <> ''
  AND responsibility <> '';

TRUNCATE TABLE user_master RESTART IDENTITY CASCADE;

INSERT INTO user_master (
  employee_id,
  employee_name,
  project_id,
  project_description,
  responsibility,
  valid_from,
  valid_to,
  manual_status,
  password_hash
)
SELECT
  employee_id,
  employee_name,
  project_id,
  project_description,
  responsibility,
  valid_from,
  valid_to,
  manual_status,
  password_hash
FROM (
  SELECT DISTINCT ON (employee_id, project_id, responsibility)
    employee_id,
    employee_name,
    project_id,
    project_description,
    responsibility,
    valid_from,
    valid_to,
    manual_status,
    password_hash
  FROM responsibility_master
  ORDER BY employee_id, project_id, responsibility, id
) deduped_user_master
ORDER BY employee_id, project_id, responsibility;

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
FROM responsibility_master
ORDER BY employee_id, project_id, responsibility
ON CONFLICT (login_name)
DO UPDATE SET
  employee_name = EXCLUDED.employee_name,
  primary_role = EXCLUDED.primary_role,
  password_hash = EXCLUDED.password_hash,
  is_active = TRUE,
  current_pin = EXCLUDED.current_pin;

SELECT
  (SELECT COUNT(*) FROM responsibility_import) AS workbook_rows,
  (SELECT COUNT(*) FROM responsibility_master) AS imported_rows,
  (SELECT COUNT(DISTINCT employee_id) FROM responsibility_master) AS unique_employees,
  (SELECT COUNT(DISTINCT responsibility) FROM responsibility_master) AS unique_responsibilities,
  (SELECT COUNT(*) FROM user_master) AS mirrored_user_master_rows;

COMMIT;
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Import Responsibility.xlsx into responsibility_master.")
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

    root = Path(__file__).resolve().parents[1]
    database_url = os.environ.get("DATABASE_URL") or read_dotenv(root / ".env").get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL was not found in the environment or ncc-indent-api/.env.", file=sys.stderr)
        return 1

    rows = read_workbook_rows(Path(args.workbook))
    if not rows:
        print("No Responsibility rows found.", file=sys.stderr)
        return 1

    env = os.environ.copy()
    env["PGCLIENTENCODING"] = "UTF8"

    result = subprocess.run(
        ["psql", database_url],
        input=build_sql(rows, args.default_pin),
        text=True,
        encoding="utf-8",
        env=env,
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
