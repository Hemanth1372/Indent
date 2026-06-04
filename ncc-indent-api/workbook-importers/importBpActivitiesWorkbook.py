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

        sheet_root = ET.fromstring(archive.read(workbook_target(archive, "BP By Activity")))
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


def blank_to_null(value: str) -> str:
    return r"\N" if not value.strip() else value.strip()


def build_sql(rows: list[dict[str, str]]) -> str:
    csv_buffer = StringIO()
    writer = csv.writer(csv_buffer, lineterminator="\n")

    for row in rows:
        writer.writerow(
            [
                row.get("Project", "").strip(),
                row.get("Project Description", "").strip(),
                row.get("Location", "").strip(),
                row.get("Location Description", "").strip(),
                blank_to_null(row.get("Activity", "")),
                blank_to_null(row.get("Activity Description", "")),
                row.get("Business Partner", "").strip(),
                row.get("BP Name", "").strip(),
            ]
        )

    return f"""
\\set ON_ERROR_STOP on
BEGIN;

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
);

TRUNCATE TABLE bp_activity_master RESTART IDENTITY CASCADE;

CREATE INDEX IF NOT EXISTS idx_bp_activity_master_project ON bp_activity_master(project_code);
CREATE INDEX IF NOT EXISTS idx_bp_activity_master_location ON bp_activity_master(location_code);
CREATE INDEX IF NOT EXISTS idx_bp_activity_master_bp ON bp_activity_master(business_partner_code);

CREATE TEMP TABLE bp_activity_import (
  project_code TEXT,
  project_description TEXT,
  location_code TEXT,
  location_description TEXT,
  activity_code TEXT,
  activity_description TEXT,
  business_partner_code TEXT,
  business_partner_name TEXT
) ON COMMIT DROP;

COPY bp_activity_import (
  project_code,
  project_description,
  location_code,
  location_description,
  activity_code,
  activity_description,
  business_partner_code,
  business_partner_name
) FROM STDIN WITH CSV NULL '\\N';
{csv_buffer.getvalue()}\\.

INSERT INTO bp_activity_master (
  project_code,
  project_description,
  location_code,
  location_description,
  activity_code,
  activity_description,
  business_partner_code,
  business_partner_name
)
SELECT
  project_code,
  project_description,
  location_code,
  location_description,
  NULLIF(activity_code, ''),
  NULLIF(activity_description, ''),
  business_partner_code,
  business_partner_name
FROM bp_activity_import
WHERE project_code <> ''
  AND project_description <> ''
  AND location_code <> ''
  AND location_description <> ''
  AND business_partner_code <> ''
  AND business_partner_name <> '';

SELECT
  (SELECT COUNT(*) FROM bp_activity_import) AS workbook_rows,
  (SELECT COUNT(*) FROM bp_activity_master) AS imported_rows,
  (SELECT COUNT(DISTINCT project_code) FROM bp_activity_master) AS project_count,
  (SELECT COUNT(DISTINCT location_code) FROM bp_activity_master) AS location_count,
  (SELECT COUNT(DISTINCT business_partner_code) FROM bp_activity_master) AS partner_count,
  (SELECT COUNT(*) FROM bp_activity_master WHERE activity_code IS NULL) AS location_level_assignments;

COMMIT;
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Import BP_By_Activity.xlsx into bp_activity_master.")
    parser.add_argument(
        "workbook",
        nargs="?",
        default=r"c:\Users\Hemanth\Downloads\BP_By_Activity.xlsx",
        help="Path to BP_By_Activity.xlsx",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    database_url = os.environ.get("DATABASE_URL") or read_dotenv(root / ".env").get("DATABASE_URL")

    if not database_url:
        print("DATABASE_URL was not found in the environment or ncc-indent-api/.env.", file=sys.stderr)
        return 1

    rows = read_workbook_rows(Path(args.workbook))
    if not rows:
        print("No BP activity rows found.", file=sys.stderr)
        return 1

    env = os.environ.copy()
    env["PGCLIENTENCODING"] = "UTF8"

    result = subprocess.run(
        ["psql", database_url],
        input=build_sql(rows),
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
