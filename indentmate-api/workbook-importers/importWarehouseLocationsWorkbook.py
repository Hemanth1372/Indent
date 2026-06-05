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

        sheet_root = ET.fromstring(archive.read(workbook_target(archive, "Warehouse Locations")))
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
                row.get("Warehouse", "").strip(),
                row.get("Warehouse Location", "").strip(),
                row.get("Location", "").strip(),
                row.get("Location Description", "").strip(),
                row.get("Location Category", "").strip(),
            ]
        )

    return f"""
\\set ON_ERROR_STOP on
BEGIN;

DROP TABLE IF EXISTS warehouse_bin CASCADE;
DROP TABLE IF EXISTS warehouse_location_master CASCADE;

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

CREATE INDEX idx_warehouse_location_master_project ON warehouse_location_master(project_code);
CREATE INDEX idx_warehouse_location_master_warehouse ON warehouse_location_master(warehouse_code);
CREATE INDEX idx_warehouse_location_master_location ON warehouse_location_master(location_code);

CREATE TEMP TABLE warehouse_location_import (
  project_code TEXT,
  warehouse_code TEXT,
  warehouse_name TEXT,
  location_code TEXT,
  location_description TEXT,
  location_category TEXT
) ON COMMIT DROP;

COPY warehouse_location_import (
  project_code,
  warehouse_code,
  warehouse_name,
  location_code,
  location_description,
  location_category
) FROM STDIN WITH CSV;
{csv_buffer.getvalue()}\\.

INSERT INTO warehouse_location_master (
  project_code,
  warehouse_code,
  warehouse_name,
  location_code,
  location_description,
  location_category
)
SELECT DISTINCT ON (warehouse_code, location_code)
  project_code,
  warehouse_code,
  warehouse_name,
  location_code,
  location_description,
  location_category
FROM warehouse_location_import
WHERE project_code <> ''
  AND warehouse_code <> ''
  AND warehouse_name <> ''
  AND location_code <> ''
  AND location_description <> ''
  AND location_category <> ''
ORDER BY warehouse_code, location_code, project_code;

SELECT
  (SELECT COUNT(*) FROM warehouse_location_import) AS workbook_rows,
  (SELECT COUNT(*) FROM warehouse_location_master) AS imported_rows,
  (SELECT COUNT(DISTINCT project_code) FROM warehouse_location_master) AS project_count,
  (SELECT COUNT(DISTINCT warehouse_code) FROM warehouse_location_master) AS warehouse_count,
  (SELECT COUNT(DISTINCT location_category) FROM warehouse_location_master) AS category_count;

COMMIT;
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Import Warehouse_Location.xlsx into warehouse_location_master.")
    parser.add_argument(
        "workbook",
        nargs="?",
        default=r"c:\Users\Hemanth\Downloads\Warehouse_Location.xlsx",
        help="Path to Warehouse_Location.xlsx",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    database_url = os.environ.get("DATABASE_URL") or read_dotenv(root / ".env").get("DATABASE_URL")

    if not database_url:
        print("DATABASE_URL was not found in the environment or indentmate-api/.env.", file=sys.stderr)
        return 1

    rows = read_workbook_rows(Path(args.workbook))
    if not rows:
        print("No warehouse location rows found.", file=sys.stderr)
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
