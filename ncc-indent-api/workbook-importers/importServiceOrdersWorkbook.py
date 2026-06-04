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


def workbook_sheet_target(archive: ZipFile) -> str:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    target_by_id = {relationship.attrib["Id"]: relationship.attrib["Target"] for relationship in relationships}
    first_sheet = workbook.find("a:sheets/a:sheet", NS)

    if first_sheet is None:
        raise ValueError("Workbook does not contain any sheets.")

    relationship_id = first_sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
    target = target_by_id[relationship_id]

    if target.startswith("/"):
        return target.lstrip("/")

    return f"xl/{target}" if not target.startswith("xl/") else target


def read_workbook_rows(path: Path) -> list[dict[str, str]]:
    with ZipFile(path) as archive:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("a:si", NS):
                shared_strings.append("".join(text.text or "" for text in item.findall(".//a:t", NS)))

        sheet_root = ET.fromstring(archive.read(workbook_sheet_target(archive)))
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
                row.get("Service Order", "").strip(),
                row.get("Status", "").strip(),
                row.get("Item Code", "").strip(),
                row.get("Serial Number", "").strip(),
                row.get("Site", "").strip(),
                row.get("Description", "").strip(),
            ]
        )

    return f"""
\\set ON_ERROR_STOP on
BEGIN;

DROP TABLE IF EXISTS service_orders CASCADE;

CREATE TABLE service_orders (
  id SERIAL PRIMARY KEY,
  service_order_no VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(100) NOT NULL,
  item_code VARCHAR(100) NULL,
  serial_number VARCHAR(100) NULL,
  project_site VARCHAR(50) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_service_orders_item_code ON service_orders(item_code);
CREATE INDEX idx_service_orders_project_site ON service_orders(project_site);
CREATE INDEX idx_service_orders_status ON service_orders(status);

CREATE TEMP TABLE service_order_import (
  service_order_no TEXT,
  status TEXT,
  item_code TEXT,
  serial_number TEXT,
  project_site TEXT,
  description TEXT
) ON COMMIT DROP;

COPY service_order_import (
  service_order_no,
  status,
  item_code,
  serial_number,
  project_site,
  description
) FROM STDIN WITH CSV;
{csv_buffer.getvalue()}\\.

INSERT INTO service_orders (
  service_order_no,
  status,
  item_code,
  serial_number,
  project_site,
  description
)
SELECT DISTINCT ON (service_order_no)
  service_order_no,
  status,
  NULLIF(item_code, ''),
  NULLIF(serial_number, ''),
  project_site,
  NULLIF(description, '')
FROM service_order_import
WHERE service_order_no <> ''
  AND status <> ''
  AND project_site <> ''
ORDER BY service_order_no;

SELECT
  (SELECT COUNT(*) FROM service_order_import) AS workbook_rows,
  (SELECT COUNT(*) FROM service_orders) AS imported_rows,
  (SELECT COUNT(*) FROM service_orders WHERE item_code IS NULL) AS rows_without_item_code,
  (SELECT COUNT(*) FROM service_orders WHERE serial_number IS NULL) AS rows_without_serial_number,
  (SELECT COUNT(DISTINCT project_site) FROM service_orders) AS project_sites;

COMMIT;
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Import Service_Orders_Serials_Filled.xlsx into service_orders.")
    parser.add_argument(
        "workbook",
        nargs="?",
        default=r"c:\Users\Hemanth\Downloads\Service_Orders_Serials_Filled.xlsx",
        help="Path to Service_Orders_Serials_Filled.xlsx",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    database_url = os.environ.get("DATABASE_URL") or read_dotenv(root / ".env").get("DATABASE_URL")

    if not database_url:
        print("DATABASE_URL was not found in the environment or ncc-indent-api/.env.", file=sys.stderr)
        return 1

    rows = read_workbook_rows(Path(args.workbook))
    if not rows:
        print("No service order rows found.", file=sys.stderr)
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
