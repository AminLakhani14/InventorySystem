// Minimal PDF writer for printable business documents.
//
// The app ships no PDF dependency, so documents are emitted as raw PDF 1.4 syntax the same
// way the order invoice does. This module generalises that approach: it paginates tables,
// so a detail report with a hundred sale lines flows onto as many pages as it needs.
//
// Only the Helvetica standard fonts are used, which are WinAnsi — non-ASCII text (Urdu
// vegetable names) cannot be encoded and is stripped by `pdfSafeText`. Callers that carry
// bilingual labels should pass the ASCII half.

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_LEFT = 40;
const MARGIN_RIGHT = PAGE_WIDTH - 40;
const CONTENT_WIDTH = MARGIN_RIGHT - MARGIN_LEFT;
const BOTTOM_LIMIT = 74;

const INK = '0.06 0.09 0.16 rg';
const MUTED = '0.42 0.45 0.5 rg';
const WHITE = '1 1 1 rg';
const HAIRLINE = '0.88 0.9 0.94 RG';

export interface PdfColumn {
    label: string;
    width: number;
    align?: 'left' | 'right';
}

export interface PdfTable {
    heading?: string;
    columns: PdfColumn[];
    rows: string[][];
    /** Emphasised line drawn under the rows, e.g. a vendor subtotal. */
    summary?: string[];
}

export interface PdfMetaField {
    label: string;
    value: string;
}

export interface PdfTotal {
    label: string;
    value: string;
    strong?: boolean;
}

export interface PdfDocumentInput {
    title: string;
    subtitle?: string;
    documentNo?: string;
    dateLabel?: string;
    meta?: PdfMetaField[];
    tables: PdfTable[];
    totals?: PdfTotal[];
    note?: string;
    accentHex?: string;
}

// Intl currency output carries non-breaking spaces and symbols outside ASCII; blindly
// stripping them would turn "€ 1,200.00" into "1,200.00" and lose the currency entirely.
const currencySymbolFallbacks: Array<[RegExp, string]> = [
    [/[\u00A0\u202F\u2009]/g, ' '],
    [/€/g, 'EUR '],
    [/£/g, 'GBP '],
    [/₹/g, 'INR '],
    [/[؋]|د\.إ/g, 'AED '],
    [/[‘’]/g, "'"],
    [/[“”]/g, '"'],
    [/[–—]/g, '-'],
];

/** Drops anything the Helvetica WinAnsi encoding cannot represent. */
export const pdfSafeText = (value: unknown) => {
    let result = String(value ?? '');
    currencySymbolFallbacks.forEach(([pattern, replacement]) => {
        result = result.replace(pattern, replacement);
    });
    return result
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/\s*\/\s*$/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
};

const escapePdfText = (value: unknown) =>
    pdfSafeText(value)
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');

const hexToPdfRgb = (hex: string) => {
    const normalized = hex.replace('#', '');
    const fullHex = normalized.length === 3
        ? normalized.split('').map((char) => `${char}${char}`).join('')
        : normalized.padEnd(6, '0').slice(0, 6);
    return [0, 2, 4]
        .map((index) => parseInt(fullHex.slice(index, index + 2), 16))
        .map((channel) => (Number.isFinite(channel) ? channel / 255 : 0).toFixed(3))
        .join(' ');
};

// Helvetica averages a little over half the point size per glyph; this estimate is what the
// right-aligned columns and the truncation budget are built on.
const approxWidth = (value: string, size: number) => value.length * size * 0.52;

const text = (value: unknown, x: number, y: number, size = 10, bold = false, color = INK) =>
    `BT ${color} /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${escapePdfText(value)}) Tj ET`;

const rightText = (value: unknown, rightX: number, y: number, size = 10, bold = false, color = INK) => {
    const clean = pdfSafeText(value);
    return text(clean, Math.max(MARGIN_LEFT, rightX - approxWidth(clean, size)), y, size, bold, color);
};

const rect = (x: number, y: number, width: number, height: number, fill: string, stroke?: string) =>
    ['q', fill, stroke || '', `${x} ${y} ${width} ${height} re`, stroke ? 'B' : 'f', 'Q']
        .filter(Boolean)
        .join('\n');

const hLine = (x1: number, y1: number, x2: number, color = HAIRLINE) =>
    `q ${color} ${x1} ${y1} m ${x2} ${y1} l S Q`;

const fitText = (value: unknown, width: number, size: number) => {
    const clean = pdfSafeText(value);
    const maxChars = Math.max(1, Math.floor((width - 10) / (size * 0.52)));
    return clean.length > maxChars ? `${clean.slice(0, maxChars - 1)}.` : clean;
};

export const buildDocumentPdfBlob = (doc: PdfDocumentInput): Blob => {
    const accent = hexToPdfRgb(doc.accentHex || '#0ea5a5');
    const accentFill = `${accent} rg`;
    const accentStroke = `${accent} RG`;

    const pages: string[][] = [];
    let commands: string[] = [];
    let cursorY = 0;

    const startPage = (isFirst: boolean) => {
        commands = [rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, '0.98 0.99 1 rg')];
        pages.push(commands);
        if (isFirst) {
            commands.push(rect(MARGIN_LEFT, 726, CONTENT_WIDTH, 80, accentFill));
            commands.push(text('ITEMHIVE', 62, 780, 16, true, WHITE));
            commands.push(text(doc.title, 62, 762, 10, false, WHITE));
            if (doc.subtitle) commands.push(text(doc.subtitle, 62, 740, 14, true, WHITE));
            if (doc.documentNo) commands.push(rightText(doc.documentNo, 533, 780, 13, true, WHITE));
            if (doc.dateLabel) commands.push(rightText(doc.dateLabel, 533, 760, 10, false, WHITE));
            cursorY = 702;
        } else {
            commands.push(text(`${doc.title} (continued)`, MARGIN_LEFT, 796, 10, true, MUTED));
            commands.push(hLine(MARGIN_LEFT, 788, MARGIN_RIGHT));
            cursorY = 762;
        }
    };

    const ensureSpace = (needed: number) => {
        if (cursorY - needed < BOTTOM_LIMIT) startPage(false);
    };

    startPage(true);

    if (doc.meta?.length) {
        const rowCount = Math.ceil(doc.meta.length / 2);
        const boxHeight = rowCount * 36 + 10;
        ensureSpace(boxHeight);
        commands.push(rect(MARGIN_LEFT, cursorY - boxHeight, CONTENT_WIDTH, boxHeight, '1 1 1 rg', accentStroke));
        doc.meta.forEach((field, index) => {
            const x = 62 + (index % 2) * 252;
            const y = cursorY - 20 - Math.floor(index / 2) * 36;
            commands.push(text(field.label.toUpperCase(), x, y, 8, true, MUTED));
            commands.push(text(fitText(field.value, 240, 11), x, y - 15, 11, true));
        });
        cursorY -= boxHeight + 20;
    }

    doc.tables.forEach((table) => {
        const drawColumnHeader = () => {
            commands.push(rect(MARGIN_LEFT, cursorY - 20, CONTENT_WIDTH, 24, '0.91 0.98 0.98 rg'));
            let x = MARGIN_LEFT + 8;
            table.columns.forEach((column) => {
                if (column.align === 'right') {
                    commands.push(rightText(column.label, x + column.width - 16, cursorY - 13, 8.5, true));
                } else {
                    commands.push(text(fitText(column.label, column.width, 8.5), x, cursorY - 13, 8.5, true));
                }
                x += column.width;
            });
            cursorY -= 28;
        };

        const drawCells = (cells: string[], size: number, bold: boolean) => {
            let x = MARGIN_LEFT + 8;
            table.columns.forEach((column, index) => {
                const value = cells[index] ?? '';
                if (column.align === 'right') {
                    commands.push(rightText(value, x + column.width - 16, cursorY, size, bold));
                } else {
                    commands.push(text(fitText(value, column.width, size), x, cursorY, size, bold));
                }
                x += column.width;
            });
        };

        if (table.heading) {
            ensureSpace(76);
            commands.push(text(table.heading, MARGIN_LEFT, cursorY, 11, true));
            cursorY -= 20;
        }

        ensureSpace(56);
        drawColumnHeader();

        table.rows.forEach((row, index) => {
            if (cursorY - 22 < BOTTOM_LIMIT) {
                startPage(false);
                drawColumnHeader();
            }
            commands.push(rect(MARGIN_LEFT, cursorY - 7, CONTENT_WIDTH, 22, index % 2 === 0 ? '1 1 1 rg' : '0.985 0.987 0.992 rg'));
            commands.push(hLine(MARGIN_LEFT, cursorY - 7, MARGIN_RIGHT));
            drawCells(row, 9, false);
            cursorY -= 22;
        });

        if (table.summary) {
            if (cursorY - 26 < BOTTOM_LIMIT) startPage(false);
            commands.push(rect(MARGIN_LEFT, cursorY - 8, CONTENT_WIDTH, 26, '0.91 0.98 0.98 rg'));
            drawCells(table.summary, 9.5, true);
            cursorY -= 26;
        }

        cursorY -= 22;
    });

    if (doc.totals?.length) {
        const boxHeight = doc.totals.length * 24 + 16;
        ensureSpace(boxHeight + 10);
        commands.push(rect(315, cursorY - boxHeight, 240, boxHeight, '1 1 1 rg', accentStroke));
        doc.totals.forEach((total, index) => {
            const y = cursorY - 22 - index * 24;
            commands.push(text(total.label, 332, y, total.strong ? 10 : 9.5, Boolean(total.strong)));
            commands.push(rightText(total.value, 538, y, total.strong ? 12 : 10, true));
            if (index < doc.totals!.length - 1) commands.push(hLine(332, y - 9, 538));
        });
        cursorY -= boxHeight + 18;
    }

    if (doc.note) {
        ensureSpace(58);
        commands.push(rect(MARGIN_LEFT, cursorY - 46, 260, 52, '0.91 0.98 0.98 rg', accentStroke));
        commands.push(text('NOTE', 58, cursorY - 14, 8, true, MUTED));
        commands.push(text(fitText(doc.note, 240, 9.5), 58, cursorY - 30, 9.5));
        cursorY -= 62;
    }

    pages.forEach((pageCommands, index) => {
        pageCommands.push(hLine(MARGIN_LEFT, 62, MARGIN_RIGHT));
        pageCommands.push(text('Generated by ItemHive', MARGIN_LEFT, 48, 9, false, MUTED));
        pageCommands.push(rightText(`Page ${index + 1} of ${pages.length}`, MARGIN_RIGHT, 48, 9, false, MUTED));
    });

    // Objects 1..4 are fixed (catalog, page tree, two fonts); every page then contributes a
    // page object followed by its content stream, so the kids list is built from those ids.
    const pageObjectIds = pages.map((_, index) => 5 + index * 2);
    const objects: string[] = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    ];

    pages.forEach((pageCommands, index) => {
        const stream = pageCommands.join('\n');
        objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + index * 2} 0 R >>`);
        objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    });

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];
    objects.forEach((object, index) => {
        offsets.push(pdf.length);
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((offset) => {
        pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return new Blob([pdf], { type: 'application/pdf' });
};

export const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
