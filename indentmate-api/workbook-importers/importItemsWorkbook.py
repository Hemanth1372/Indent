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
                row.get("SITE", "").strip(),
                row.get("SITE Description", "").strip(),
                row.get("Warehouse", "").strip(),
                row.get("Warehouse Description", "").strip(),
                row.get("On Hand", "").strip() or "0",
                row.get("ITEM CODE", "").strip(),
                row.get("Item Description", "").strip(),
                row.get("Purchase Unit", "").strip(),
                row.get("Item Type", "").strip(),
            ]
        )

    return f"""
\\set ON_ERROR_STOP on
BEGIN;

DROP TABLE IF EXISTS item_master CASCADE;

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

CREATE INDEX idx_item_master_site ON item_master(project_site);
CREATE INDEX idx_item_master_code ON item_master(item_code);
CREATE INDEX idx_item_master_type ON item_master(item_type);

CREATE TEMP TABLE item_import (
  project_site TEXT,
  site_description TEXT,
  warehouse_code TEXT,
  warehouse_description TEXT,
  on_hand_qty TEXT,
  item_code TEXT,
  item_description TEXT,
  purchase_unit TEXT,
  item_type TEXT
) ON COMMIT DROP;

COPY item_import (
  project_site,
  site_description,
  warehouse_code,
  warehouse_description,
  on_hand_qty,
  item_code,
  item_description,
  purchase_unit,
  item_type
) FROM STDIN WITH CSV;
{csv_buffer.getvalue()}\\.

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
)
SELECT DISTINCT ON (project_site, COALESCE(warehouse_code, ''), item_code)
  project_site,
  site_description,
  NULLIF(warehouse_code, ''),
  NULLIF(warehouse_description, ''),
  COALESCE(NULLIF(on_hand_qty, '')::decimal, 0),
  item_code,
  item_description,
  purchase_unit,
  item_type
FROM item_import
WHERE project_site <> ''
  AND site_description <> ''
  AND item_code <> ''
  AND item_description <> ''
  AND purchase_unit <> ''
  AND item_type <> ''
ORDER BY project_site, COALESCE(warehouse_code, ''), item_code;

SELECT
  (SELECT COUNT(*) FROM item_import) AS workbook_rows,
  (SELECT COUNT(*) FROM item_master) AS imported_rows,
  (SELECT COUNT(*) FROM item_master WHERE warehouse_code IS NULL) AS rows_without_warehouse,
  (SELECT COUNT(DISTINCT project_site) FROM item_master) AS project_sites,
  (SELECT SUM(on_hand_qty) FROM item_master) AS total_on_hand_qty;

COMMIT;
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Import Items.xlsx into item_master.")
    parser.add_argument(
        "workbook",
        nargs="?",
        default=r"c:\Users\Hemanth\Downloads\Items.xlsx",
        help="Path to Items.xlsx",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    database_url = os.environ.get("DATABASE_URL") or read_dotenv(root / ".env").get("DATABASE_URL")

    if not database_url:
        print("DATABASE_URL was not found in the environment or indentmate-api/.env.", file=sys.stderr)
        return 1

    rows = read_workbook_rows(Path(args.workbook))
    if not rows:
        print("No item rows found.", file=sys.stderr)
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
