import * as ExcelJS from 'exceljs';
import type { Response } from 'express';

export type ExportRow = Record<string, string | number | boolean | null | undefined>;

/**
 * CSV generation with explicit formula-injection protection.
 *
 * A cell beginning with = + - @ (or tab/CR) is interpreted as a formula
 * by Excel and Sheets. Candidate-supplied text lands in these exports,
 * so each such value is prefixed with a single quote to neutralise it.
 */
function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';

  let text = String(value);

  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  if (/[",\n\r]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function toCsv(rows: ExportRow[]): string {
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(',')),
  ];

  // BOM so Excel on Windows opens UTF-8 correctly.
  return `﻿${lines.join('\r\n')}`;
}

export async function toExcelBuffer(
  rows: ExportRow[],
  sheetName = 'Export',
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'HR ATS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));

  if (rows.length > 0) {
    const headers = Object.keys(rows[0]);
    sheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: Math.min(Math.max(header.length + 4, 14), 50),
    }));

    for (const row of rows) {
      const safe: ExportRow = {};
      for (const [key, value] of Object.entries(row)) {
        // Same formula-injection guard as the CSV path.
        safe[key] =
          typeof value === 'string' && /^[=+\-@]/.test(value) ? `'${value}` : value;
      }
      sheet.addRow(safe);
    }

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** Strips anything that could break out of the Content-Disposition header. */
function safeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100);
}

export function sendCsv(res: Response, rows: ExportRow[], filename: string): void {
  const safe = safeFilename(filename.endsWith('.csv') ? filename : `${filename}.csv`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
  res.send(toCsv(rows));
}

export async function sendExcel(
  res: Response,
  rows: ExportRow[],
  filename: string,
  sheetName = 'Export',
): Promise<void> {
  const safe = safeFilename(filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
  const buffer = await toExcelBuffer(rows, sheetName);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
  res.send(buffer);
}
