from __future__ import annotations

import argparse
import csv
import os
import subprocess
import sys
import xml.etree.ElementTree as ET
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

        sheet_root = ET.fromstring(archive.read(workbook_target(archive, "Project Locations")))
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


def build_sql(rows: list[dict[str, str]]) -> str:
    csv_buffer = StringIO()
    writer = csv.writer(csv_buffer, lineterminator="\n")

    for row in rows:
        writer.writerow(
            [
                row.get("Project", "").strip(),
                row.get("Project Name", "").strip(),
                row.get("Location", "").strip(),
                row.get("Description", "").strip(),
            ]
        )

    return f"""
\\set ON_ERROR_STOP on
BEGIN;

CREATE TABLE IF NOT EXISTS location_master (
  id SERIAL PRIMARY KEY,
  project_code VARCHAR(50) NOT NULL,
  project_name VARCHAR(255) NOT NULL,
  location_code VARCHAR(50) NOT NULL,
  description VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE IF EXISTS location_master DROP CONSTRAINT IF EXISTS location_master_pkey;
ALTER TABLE IF EXISTS location_master ADD COLUMN IF NOT EXISTS id SERIAL;
ALTER TABLE IF EXISTS location_master ADD COLUMN IF NOT EXISTS project_code VARCHAR(50);
ALTER TABLE IF EXISTS location_master ADD COLUMN IF NOT EXISTS project_name VARCHAR(255);
ALTER TABLE IF EXISTS location_master ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active';
ALTER TABLE IF EXISTS location_master ALTER COLUMN location_code TYPE VARCHAR(50);
ALTER TABLE IF EXISTS location_master ALTER COLUMN description TYPE VARCHAR(255);

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

DROP INDEX IF EXISTS unique_project_location;
CREATE UNIQUE INDEX unique_project_location
  ON location_master (project_code, location_code);

TRUNCATE TABLE location_master RESTART IDENTITY CASCADE;

CREATE TEMP TABLE location_import (
  project_code TEXT,
  project_name TEXT,
  location_code TEXT,
  description TEXT
) ON COMMIT DROP;

COPY location_import (
  project_code,
  project_name,
  location_code,
  description
) FROM STDIN WITH CSV;
{csv_buffer.getvalue()}\\.

INSERT INTO location_master (
  project_code,
  project_name,
  location_code,
  description,
  status
)
SELECT DISTINCT ON (project_code, location_code)
  project_code,
  project_name,
  location_code,
  description,
  'Active'
FROM location_import
WHERE project_code <> '' AND project_name <> '' AND location_code <> '' AND description <> ''
ORDER BY project_code, location_code;

SELECT
  (SELECT COUNT(*) FROM location_import) AS workbook_rows,
  (SELECT COUNT(*) FROM location_master) AS imported_rows,
  (SELECT COUNT(DISTINCT project_code) FROM location_master) AS projects;

COMMIT;
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Import Project_Locations.xlsx into location_master.")
    parser.add_argument(
        "workbook",
        nargs="?",
        default=r"c:\Users\Hemanth\Downloads\Project_Locations.xlsx",
        help="Path to Project_Locations.xlsx",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    database_url = os.environ.get("DATABASE_URL") or read_dotenv(root / ".env").get("DATABASE_URL")

    if not database_url:
        print("DATABASE_URL was not found in the environment or indentmate-api/.env.", file=sys.stderr)
        return 1

    rows = read_workbook_rows(Path(args.workbook))
    if not rows:
        print("No project location rows found.", file=sys.stderr)
        return 1

    result = subprocess.run(
      ["psql", database_url],
      input=build_sql(rows),
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
