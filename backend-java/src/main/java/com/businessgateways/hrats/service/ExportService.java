package com.businessgateways.hrats.service;

import com.businessgateways.hrats.common.ApiException;
import com.businessgateways.hrats.common.dto.PaginationQuery.ExportFormat;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.WorkbookUtil;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * CSV and Excel generation with explicit formula-injection protection.
 *
 * A cell whose text begins with {@code = + - @} or a control character
 * is interpreted as a formula by Excel and Google Sheets. These exports
 * carry candidate-supplied text — names, cover letters, notes — so a
 * malicious applicant could otherwise land a formula in a recruiter's
 * spreadsheet. Every such value is prefixed with a single quote, which
 * renders it inert without changing what the reader sees.
 */
@Service
public class ExportService {

    private static final int EXCEL_SHEET_NAME_LIMIT = 31;

    /**
     * Builds a downloadable response in the requested format.
     *
     * @param rows      ordered maps; the first row's keys become the header
     * @param baseName  file name without extension or date
     * @param sheetName Excel sheet name (truncated and sanitised)
     */
    public ResponseEntity<ByteArrayResource> download(
            List<Map<String, Object>> rows,
            ExportFormat format,
            String baseName,
            String sheetName) {

        String fileName = baseName + "-" + LocalDate.now() + (format == ExportFormat.xlsx ? ".xlsx" : ".csv");
        byte[] payload = format == ExportFormat.xlsx ? toExcel(rows, sheetName) : toCsv(rows);

        MediaType contentType = format == ExportFormat.xlsx
                ? MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                : MediaType.parseMediaType("text/csv; charset=UTF-8");

        return ResponseEntity.ok()
                .contentType(contentType)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(fileName).build().toString())
                // Exports can contain personal data; nothing may cache them.
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .contentLength(payload.length)
                .body(new ByteArrayResource(payload));
    }

    public byte[] toCsv(List<Map<String, Object>> rows) {
        if (rows.isEmpty()) {
            return new byte[0];
        }

        List<String> headers = List.copyOf(rows.get(0).keySet());
        StringBuilder out = new StringBuilder();

        // Byte-order mark, so Excel on Windows opens UTF-8 correctly
        // instead of mangling every accented name.
        out.append('﻿');
        out.append(String.join(",", headers.stream().map(this::escapeCsvCell).toList()));

        for (Map<String, Object> row : rows) {
            out.append("\r\n");
            out.append(String.join(",", headers.stream()
                    .map(header -> escapeCsvCell(row.get(header)))
                    .toList()));
        }

        return out.toString().getBytes(StandardCharsets.UTF_8);
    }

    public byte[] toExcel(List<Map<String, Object>> rows, String sheetName) {
        // SXSSF streams rows to a temp file instead of holding the whole
        // workbook in memory, so a 50,000-row candidate export does not
        // put the container under memory pressure.
        try (SXSSFWorkbook workbook = new SXSSFWorkbook(200);
             ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet(
                    WorkbookUtil.createSafeSheetName(
                            sheetName.length() > EXCEL_SHEET_NAME_LIMIT
                                    ? sheetName.substring(0, EXCEL_SHEET_NAME_LIMIT)
                                    : sheetName));

            if (!rows.isEmpty()) {
                List<String> headers = List.copyOf(rows.get(0).keySet());

                Row headerRow = sheet.createRow(0);
                CellStyle headerStyle = boldStyle(workbook);
                for (int i = 0; i < headers.size(); i++) {
                    var cell = headerRow.createCell(i);
                    cell.setCellValue(headers.get(i));
                    cell.setCellStyle(headerStyle);
                }

                int rowIndex = 1;
                for (Map<String, Object> row : rows) {
                    Row sheetRow = sheet.createRow(rowIndex++);
                    for (int i = 0; i < headers.size(); i++) {
                        writeCell(sheetRow, i, row.get(headers.get(i)));
                    }
                }

                sheet.createFreezePane(0, 1);
            }

            workbook.write(buffer);
            workbook.dispose();
            return buffer.toByteArray();

        } catch (IOException ex) {
            throw new ApiException(
                    org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR,
                    "The export could not be generated.", ex);
        }
    }

    /** Numbers and booleans stay typed; everything else is neutralised text. */
    private void writeCell(Row row, int index, Object value) {
        var cell = row.createCell(index);
        if (value == null) {
            cell.setBlank();
        } else if (value instanceof Number number) {
            cell.setCellValue(number.doubleValue());
        } else if (value instanceof Boolean flag) {
            cell.setCellValue(flag);
        } else {
            cell.setCellValue(neutraliseFormula(String.valueOf(value)));
        }
    }

    private CellStyle boldStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        style.setFont(font);
        return style;
    }

    private String neutraliseFormula(String text) {
        if (text.isEmpty()) {
            return text;
        }
        char first = text.charAt(0);
        if (first == '=' || first == '+' || first == '-' || first == '@'
                || first == '\t' || first == '\r') {
            return "'" + text;
        }
        return text;
    }

    private String escapeCsvCell(Object value) {
        if (value == null) {
            return "";
        }

        String text = neutraliseFormula(String.valueOf(value));

        if (text.indexOf('"') >= 0 || text.indexOf(',') >= 0
                || text.indexOf('\n') >= 0 || text.indexOf('\r') >= 0) {
            text = '"' + text.replace("\"", "\"\"") + '"';
        }

        return text;
    }
}
