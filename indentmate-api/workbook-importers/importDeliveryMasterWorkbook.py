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
                row.get("Address Code", "").strip(),
                row.get("Address Code Description", "").strip(),
                row.get("Project Code", "").strip(),
                row.get("Project Description", "").strip(),
                row.get("Delivery Point", "").strip(),
                row.get("Description I", "").strip(),
            ]
        )

    return f"""
\\set ON_ERROR_STOP on
BEGIN;

DROP TABLE IF EXISTS delivery_master CASCADE;

CREATE TABLE delivery_master (
  id SERIAL PRIMARY KEY,
  address_code VARCHAR(100) NOT NULL,
  address_description TEXT NOT NULL,
  project_code VARCHAR(50) NOT NULL,
  project_description VARCHAR(255) NOT NULL,
  delivery_point VARCHAR(100) NOT NULL,
  description_1 TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_project_delivery UNIQUE (project_code, address_code, delivery_point)
);

CREATE INDEX idx_delivery_master_project ON delivery_master(project_code);
CREATE INDEX idx_delivery_master_address ON delivery_master(address_code);
CREATE INDEX idx_delivery_master_point ON delivery_master(delivery_point);

CREATE TEMP TABLE delivery_import (
  address_code TEXT,
  address_description TEXT,
  project_code TEXT,
  project_description TEXT,
  delivery_point TEXT,
  description_1 TEXT
) ON COMMIT DROP;

COPY delivery_import (
  address_code,
  address_description,
  project_code,
  project_description,
  delivery_point,
  description_1
) FROM STDIN WITH CSV;
{csv_buffer.getvalue()}\\.

INSERT INTO delivery_master (
  address_code,
  address_description,
  project_code,
  project_description,
  delivery_point,
  description_1
)
SELECT DISTINCT ON (project_code, address_code, delivery_point)
  address_code,
  address_description,
  project_code,
  project_description,
  delivery_point,
  NULLIF(description_1, '')
FROM delivery_import
WHERE address_code <> ''
  AND address_description <> ''
  AND project_code <> ''
  AND project_description <> ''
  AND delivery_point <> ''
ORDER BY project_code, address_code, delivery_point;

SELECT
  (SELECT COUNT(*) FROM delivery_import) AS workbook_rows,
  (SELECT COUNT(*) FROM delivery_master) AS imported_rows,
  (SELECT COUNT(*) FROM delivery_master WHERE description_1 IS NULL) AS rows_without_description_1,
  (SELECT COUNT(DISTINCT project_code) FROM delivery_master) AS projects;

COMMIT;
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Import Delivery_Master.xlsx into delivery_master.")
    parser.add_argument(
        "workbook",
        nargs="?",
        default=r"c:\Users\Hemanth\Downloads\Delivery_Master.xlsx",
        help="Path to Delivery_Master.xlsx",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    database_url = os.environ.get("DATABASE_URL") or read_dotenv(root / ".env").get("DATABASE_URL")

    if not database_url:
        print("DATABASE_URL was not found in the environment or indentmate-api/.env.", file=sys.stderr)
        return 1

    rows = read_workbook_rows(Path(args.workbook))
    if not rows:
        print("No delivery master rows found.", file=sys.stderr)
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
