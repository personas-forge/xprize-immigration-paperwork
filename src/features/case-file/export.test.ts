import assert from "node:assert/strict";
import { test } from "node:test";

import { casesToCsv, checklistToCsv, csvCell } from "./export";
import { type CaseDocument, type PetitionCase } from "./types";

test("csvCell: leaves plain values untouched", () => {
  assert.equal(csvCell("Anya Krishnan"), "Anya Krishnan");
  assert.equal(csvCell(92), "92");
});

test("csvCell: quotes and escapes commas, quotes, and newlines", () => {
  assert.equal(csvCell("Park, J."), '"Park, J."');
  assert.equal(csvCell('a "quoted" name'), '"a ""quoted"" name"');
  assert.equal(csvCell("line1\nline2"), '"line1\nline2"');
});

test("casesToCsv: header row + one row per case, CRLF-delimited", () => {
  const cases: PetitionCase[] = [
    {
      id: "a",
      fileNumber: "O1-241",
      petitioner: "Anya Krishnan",
      classification: "O-1A",
      status: "Drafting",
      approvalLikelihood: 92,
      targetFileDate: "2026-06-12",
      attorney: "J. Park, Esq.",
    },
  ];
  const csv = casesToCsv(cases);
  const lines = csv.split("\r\n");
  assert.equal(lines.length, 2);
  assert.equal(
    lines[0],
    "File number,Petitioner,Classification,Status,Approval likelihood,Target file date,Attorney",
  );
  assert.equal(
    lines[1],
    'O1-241,Anya Krishnan,O-1A,Drafting,92%,2026-06-12,"J. Park, Esq."',
  );
});

test("casesToCsv: empty list still emits the header", () => {
  assert.equal(
    casesToCsv([]),
    "File number,Petitioner,Classification,Status,Approval likelihood,Target file date,Attorney",
  );
});

test("checklistToCsv: serializes evidence-vault documents", () => {
  const docs: CaseDocument[] = [
    { id: "d1", name: "Passport scan", exhibit: "Ex. 10", status: "Needs review", owner: "Anya" },
  ];
  const lines = checklistToCsv(docs).split("\r\n");
  assert.equal(lines[0], "Exhibit,Document,Status,Owner");
  assert.equal(lines[1], "Ex. 10,Passport scan,Needs review,Anya");
});
