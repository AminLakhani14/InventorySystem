// Printable documents for the vendor commission sheet: a per-vendor invoice, a day summary
// report and a full detail report. Each one is produced in three shapes from the same data —
// a PDF blob for download/share, print markup, and a plain-text version for share sheets
// that cannot carry a file.

import { buildDocumentPdfBlob, pdfSafeText, type PdfTable } from '../../utils/documentPdf';
import { escapeHtml } from '../../utils/documentShare';

export interface CommissionRow {
    vendorId: string;
    vendorName: string;
    vendorPhone: string;
    productId: string;
    productName: string;
    broughtQuantity: number;
    soldQuantity: number;
    salesValue: number;
    availableQuantity: number;
    totalAmount: number;
    commission: number;
    note: string;
    updatedByName: string;
    isSaved: boolean;
}

export interface SaleLine {
    saleId: string;
    time: string;
    vendorId: string;
    vendorName: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    customerName: string;
    paymentMethod: string;
    soldByName: string;
}

/** A sheet row plus whatever is currently typed into its inputs. */
export interface VendorGroupRow extends CommissionRow {
    liveTotalAmount: number;
    liveCommission: number;
}

export interface VendorGroup {
    vendorId: string;
    vendorName: string;
    vendorPhone: string;
    rows: VendorGroupRow[];
    sales: SaleLine[];
    broughtQuantity: number;
    soldQuantity: number;
    salesValue: number;
    totalAmount: number;
    commission: number;
}

export interface DocumentContext {
    sheetDate: string;
    money: (value: number) => string;
    accentHex: string;
}

export interface DocumentBundle {
    title: string;
    fileName: string;
    html: string;
    shareText: string;
    buildPdf: () => Blob;
}

const ANONYMOUS_CUSTOMER = 'Walk-in customer';

const formatQuantity = (value: number) => Number(value.toFixed(2)).toLocaleString();

const displayDate = (sheetDate: string) =>
    new Date(`${sheetDate}T00:00:00`).toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

const displayTime = (value: string) =>
    new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const rateOf = (salesValue: number, quantity: number) => (quantity > 0 ? salesValue / quantity : 0);

const invoiceNumber = (sheetDate: string, vendorId: string) =>
    `VC-${sheetDate.replace(/-/g, '')}-${vendorId.slice(-5).toUpperCase()}`;

const paymentLabel = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Cash');

// ── Shared print chrome ────────────────────────────────────────────────────────────────

const printShell = (title: string, heading: string, subheading: string, dateLabel: string, body: string) => `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4; margin: 12mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
      .sheet { max-width: 800px; margin: 0 auto; }
      .banner { background: #0ea5a5; color: #fff; padding: 18px 22px; border-radius: 10px; display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
      .banner h1 { margin: 4px 0 0; font-size: 22px; }
      .brand { font-size: 13px; font-weight: 800; letter-spacing: .12em; }
      .muted { color: #6b7280; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
      .banner .muted { color: rgba(255,255,255,.82); }
      .right { text-align: right; }
      .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 18px; border: 1px solid #d5f2f0; border-radius: 10px; padding: 14px 16px; margin: 16px 0; }
      .strong { font-weight: 800; font-size: 12px; }
      h2 { font-size: 13px; margin: 22px 0 8px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
      th { background: #e8f8f7; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; }
      th, td { border: 1px solid #e5e7eb; padding: 7px 8px; }
      tbody tr:nth-child(even) { background: #fafafa; }
      tfoot td, .subtotal td { background: #e8f8f7; font-weight: 800; }
      .totals { width: 320px; margin-left: auto; border: 1px solid #d5f2f0; border-radius: 10px; padding: 6px 14px; margin-top: 14px; }
      .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eef2f2; }
      .total-row:last-child { border-bottom: 0; }
      .total-row.grand { font-size: 14px; font-weight: 900; color: #0f766e; }
      .foot { margin-top: 26px; padding-top: 10px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; color: #6b7280; font-size: 10px; }
      .empty { padding: 14px; color: #6b7280; font-style: italic; }
    </style>
  </head>
  <body>
    <section class="sheet">
      <div class="banner">
        <div>
          <div class="brand">ITEMHIVE</div>
          <div class="muted">${escapeHtml(heading)}</div>
          <h1>${escapeHtml(subheading)}</h1>
        </div>
        <div class="right">
          <div class="muted">Sheet Date</div>
          <div class="strong">${escapeHtml(dateLabel)}</div>
        </div>
      </div>
      ${body}
      <div class="foot"><span>Generated by ItemHive</span><span>${escapeHtml(new Date().toLocaleString())}</span></div>
    </section>
  </body>
</html>`;

const htmlTable = (headers: Array<{ label: string; right?: boolean }>, rows: string[][], footer?: string[]) => {
    const head = headers
        .map((header) => `<th${header.right ? ' class="right"' : ''}>${escapeHtml(header.label)}</th>`)
        .join('');
    const body = rows.length
        ? rows
            .map((row) => `<tr>${row
                .map((cell, index) => `<td${headers[index]?.right ? ' class="right"' : ''}>${escapeHtml(cell)}</td>`)
                .join('')}</tr>`)
            .join('')
        : `<tr><td class="empty" colspan="${headers.length}">Nothing recorded.</td></tr>`;
    const foot = footer
        ? `<tfoot><tr>${footer
            .map((cell, index) => `<td${headers[index]?.right ? ' class="right"' : ''}>${escapeHtml(cell)}</td>`)
            .join('')}</tr></tfoot>`
        : '';
    return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table>`;
};

const htmlTotals = (entries: Array<{ label: string; value: string; grand?: boolean }>) =>
    `<div class="totals">${entries
        .map((entry) => `<div class="total-row${entry.grand ? ' grand' : ''}"><span>${escapeHtml(entry.label)}</span><span>${escapeHtml(entry.value)}</span></div>`)
        .join('')}</div>`;

const htmlMeta = (fields: Array<{ label: string; value: string }>) =>
    `<div class="grid">${fields
        .map((field) => `<div><div class="muted">${escapeHtml(field.label)}</div><div class="strong">${escapeHtml(field.value)}</div></div>`)
        .join('')}</div>`;

// ── Invoice (one vendor, one day) ──────────────────────────────────────────────────────

const INVOICE_COLUMNS = [
    { label: 'Vegetable', width: 120 },
    { label: 'Brought', width: 50, align: 'right' as const },
    { label: 'Sold', width: 45, align: 'right' as const },
    { label: 'Left', width: 50, align: 'right' as const },
    { label: 'Sales Value', width: 70, align: 'right' as const },
    { label: 'Amount', width: 70, align: 'right' as const },
    { label: 'Commission', width: 60, align: 'right' as const },
    { label: 'Net', width: 50, align: 'right' as const },
];

export const buildVendorInvoice = (group: VendorGroup, context: DocumentContext): DocumentBundle => {
    const { money, sheetDate } = context;
    const net = group.totalAmount - group.commission;
    const number = invoiceNumber(sheetDate, group.vendorId);
    const title = `Vendor Commission Invoice ${number} — ${displayDate(sheetDate)}`;

    const cells = group.rows.map((row) => [
        row.productName,
        formatQuantity(row.broughtQuantity),
        formatQuantity(row.soldQuantity),
        formatQuantity(row.broughtQuantity - row.soldQuantity),
        money(row.salesValue),
        money(row.liveTotalAmount),
        money(row.liveCommission),
        money(row.liveTotalAmount - row.liveCommission),
    ]);

    const summaryRow = [
        'Total',
        formatQuantity(group.broughtQuantity),
        formatQuantity(group.soldQuantity),
        formatQuantity(group.broughtQuantity - group.soldQuantity),
        money(group.salesValue),
        money(group.totalAmount),
        money(group.commission),
        money(net),
    ];

    const meta = [
        { label: 'Vendor', value: group.vendorName },
        { label: 'Phone', value: group.vendorPhone || '-' },
        { label: 'Invoice No.', value: number },
        { label: 'Vegetables', value: String(group.rows.length) },
    ];

    const totals = [
        { label: 'Total Sales Value', value: money(group.salesValue) },
        { label: 'Total Amount', value: money(group.totalAmount) },
        { label: 'Commission', value: money(group.commission) },
        { label: 'Net Payable To Vendor', value: money(net), strong: true },
    ];

    const html = printShell(
        title,
        'Vendor Commission Invoice',
        group.vendorName,
        displayDate(sheetDate),
        [
            htmlMeta(meta),
            htmlTable(
                INVOICE_COLUMNS.map((column) => ({ label: column.label, right: column.align === 'right' })),
                cells,
                summaryRow,
            ),
            htmlTotals([
                { label: 'Total Sales Value', value: money(group.salesValue) },
                { label: 'Total Amount', value: money(group.totalAmount) },
                { label: 'Commission', value: money(group.commission) },
                { label: 'Net Payable To Vendor', value: money(net), grand: true },
            ]),
        ].join(''),
    );

    const shareText = [
        `ItemHive — Vendor Commission Invoice ${number}`,
        `Vendor: ${group.vendorName}${group.vendorPhone ? ` (${group.vendorPhone})` : ''}`,
        `Date: ${displayDate(sheetDate)}`,
        '',
        ...group.rows.map((row) => `- ${row.productName}: sold ${formatQuantity(row.soldQuantity)} of ${formatQuantity(row.broughtQuantity)} = ${money(row.liveTotalAmount)} (commission ${money(row.liveCommission)})`),
        '',
        `Total Sales Value: ${money(group.salesValue)}`,
        `Total Amount: ${money(group.totalAmount)}`,
        `Commission: ${money(group.commission)}`,
        `Net Payable: ${money(net)}`,
    ].join('\n');

    return {
        title,
        fileName: `vendor_invoice_${number}.pdf`,
        html,
        shareText,
        buildPdf: () => buildDocumentPdfBlob({
            title: 'Vendor Commission Invoice',
            subtitle: pdfSafeText(group.vendorName),
            documentNo: number,
            dateLabel: displayDate(sheetDate),
            accentHex: context.accentHex,
            meta,
            tables: [{ columns: INVOICE_COLUMNS, rows: cells, summary: summaryRow }],
            totals,
            note: group.rows.find((row) => row.note)?.note,
        }),
    };
};

// ── Summary report (what sold, at what price) ──────────────────────────────────────────

// A single-vendor report drops the vendor column — the name is already in the banner — and
// gives the width back to the vegetable and money columns.
const SUMMARY_COLUMNS_ALL = [
    { label: 'Vendor', width: 120 },
    { label: 'Vegetable', width: 145 },
    { label: 'Sold Qty', width: 70, align: 'right' as const },
    { label: 'Rate', width: 85, align: 'right' as const },
    { label: 'Sales Value', width: 95, align: 'right' as const },
];

const SUMMARY_COLUMNS_ONE = [
    { label: 'Vegetable', width: 175 },
    { label: 'Sold Qty', width: 90, align: 'right' as const },
    { label: 'Rate', width: 120, align: 'right' as const },
    { label: 'Sales Value', width: 130, align: 'right' as const },
];

const slug = (value: string) =>
    pdfSafeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'all_vendors';

/** The one vendor a report covers, or null when it spans the whole sheet. */
const soleVendor = (groups: VendorGroup[]) => (groups.length === 1 ? groups[0] : null);

export const buildSummaryReport = (groups: VendorGroup[], context: DocumentContext): DocumentBundle => {
    const { money, sheetDate } = context;
    const single = soleVendor(groups);
    const scopeName = single ? single.vendorName : 'All vendors';
    const title = `Vendor Commission Summary — ${scopeName} — ${displayDate(sheetDate)}`;
    const columns = single ? SUMMARY_COLUMNS_ONE : SUMMARY_COLUMNS_ALL;

    const rows = groups.flatMap((group) => group.rows.map((row) => {
        const cells = [
            row.productName,
            formatQuantity(row.soldQuantity),
            money(rateOf(row.salesValue, row.soldQuantity)),
            money(row.salesValue),
        ];
        return single ? cells : [group.vendorName, ...cells];
    }));

    const totals = groups.reduce((acc, group) => ({
        soldQuantity: acc.soldQuantity + group.soldQuantity,
        salesValue: acc.salesValue + group.salesValue,
    }), { soldQuantity: 0, salesValue: 0 });

    const totalCells = [
        single ? 'Vendor Total' : 'Day Total',
        formatQuantity(totals.soldQuantity),
        '',
        money(totals.salesValue),
    ];
    const summaryRow = single ? totalCells : [totalCells[0], '', ...totalCells.slice(1)];

    const meta = [
        { label: 'Sheet Date', value: displayDate(sheetDate) },
        single
            ? { label: 'Vendor', value: single.vendorName }
            : { label: 'Vendors', value: String(groups.length) },
        { label: 'Vegetable Lines', value: String(rows.length) },
        { label: 'Total Sales Value', value: money(totals.salesValue) },
    ];

    const html = printShell(
        title,
        'Vendor Commission — Summary Report',
        scopeName,
        displayDate(sheetDate),
        [
            htmlMeta(meta),
            '<h2>Vegetables sold and their price</h2>',
            htmlTable(
                columns.map((column) => ({ label: column.label, right: column.align === 'right' })),
                rows,
                summaryRow,
            ),
        ].join(''),
    );

    const shareText = [
        'ItemHive — Vendor Commission Summary',
        `Vendor: ${scopeName}`,
        `Date: ${displayDate(sheetDate)}`,
        '',
        ...groups.flatMap((group) => group.rows.map((row) =>
            `- ${single ? '' : `${group.vendorName} / `}${row.productName}: ${formatQuantity(row.soldQuantity)} @ ${money(rateOf(row.salesValue, row.soldQuantity))} = ${money(row.salesValue)}`)),
        '',
        `Total Sales Value: ${money(totals.salesValue)}`,
    ].join('\n');

    return {
        title,
        fileName: `vendor_commission_summary_${slug(scopeName)}_${sheetDate}.pdf`,
        html,
        shareText,
        buildPdf: () => buildDocumentPdfBlob({
            title: 'Vendor Commission - Summary Report',
            subtitle: pdfSafeText(scopeName),
            dateLabel: displayDate(sheetDate),
            accentHex: context.accentHex,
            meta,
            tables: [{ columns, rows, summary: summaryRow }],
        }),
    };
};

// ── Detail report (every sale, every vendor, fully broken down) ────────────────────────

const DETAIL_SALE_COLUMNS = [
    { label: 'Time', width: 55 },
    { label: 'Vegetable', width: 115 },
    { label: 'Qty', width: 45, align: 'right' as const },
    { label: 'Unit Price', width: 70, align: 'right' as const },
    { label: 'Customer', width: 110 },
    { label: 'Payment', width: 55 },
    { label: 'Total', width: 65, align: 'right' as const },
];

const DETAIL_BREAKDOWN_COLUMNS = [
    { label: 'Vegetable', width: 120 },
    { label: 'Brought', width: 55, align: 'right' as const },
    { label: 'Sold', width: 50, align: 'right' as const },
    { label: 'Left', width: 50, align: 'right' as const },
    { label: 'Sales Value', width: 75, align: 'right' as const },
    { label: 'Amount', width: 70, align: 'right' as const },
    { label: 'Commission', width: 65, align: 'right' as const },
    { label: 'Net', width: 30, align: 'right' as const },
];

export const buildDetailReport = (groups: VendorGroup[], context: DocumentContext): DocumentBundle => {
    const { money, sheetDate } = context;
    const single = soleVendor(groups);
    const scopeName = single ? single.vendorName : 'All vendors';
    const title = `Vendor Commission Detail — ${scopeName} — ${displayDate(sheetDate)}`;

    const grand = groups.reduce((acc, group) => ({
        salesValue: acc.salesValue + group.salesValue,
        totalAmount: acc.totalAmount + group.totalAmount,
        commission: acc.commission + group.commission,
        sales: acc.sales + group.sales.length,
    }), { salesValue: 0, totalAmount: 0, commission: 0, sales: 0 });

    const meta = [
        { label: 'Sheet Date', value: displayDate(sheetDate) },
        single
            ? { label: 'Vendor', value: `${single.vendorName}${single.vendorPhone ? ` (${single.vendorPhone})` : ''}` }
            : { label: 'Vendors', value: String(groups.length) },
        { label: 'Sale Entries', value: String(grand.sales) },
        { label: 'Total Sales Value', value: money(grand.salesValue) },
    ];

    const tables: PdfTable[] = [];
    const htmlSections: string[] = [];

    groups.forEach((group) => {
        const saleRows = group.sales.map((sale) => [
            displayTime(sale.time),
            sale.productName,
            formatQuantity(sale.quantity),
            money(sale.unitPrice),
            sale.customerName || ANONYMOUS_CUSTOMER,
            paymentLabel(sale.paymentMethod),
            money(sale.totalPrice),
        ]);
        const saleSummary = ['', 'Sold total', formatQuantity(group.soldQuantity), '', '', '', money(group.salesValue)];

        const breakdownRows = group.rows.map((row) => [
            row.productName,
            formatQuantity(row.broughtQuantity),
            formatQuantity(row.soldQuantity),
            formatQuantity(row.broughtQuantity - row.soldQuantity),
            money(row.salesValue),
            money(row.liveTotalAmount),
            money(row.liveCommission),
            money(row.liveTotalAmount - row.liveCommission),
        ]);
        const breakdownSummary = [
            'Vendor total',
            formatQuantity(group.broughtQuantity),
            formatQuantity(group.soldQuantity),
            formatQuantity(group.broughtQuantity - group.soldQuantity),
            money(group.salesValue),
            money(group.totalAmount),
            money(group.commission),
            money(group.totalAmount - group.commission),
        ];

        // With one vendor the name is already in the banner, so the section headings drop it.
        const prefix = single ? '' : `${pdfSafeText(group.vendorName)} - `;
        const htmlPrefix = single ? '' : `${escapeHtml(group.vendorName)} — `;

        tables.push({
            heading: `${prefix}${single ? 'Sales' : 'sales'} (${group.sales.length})`,
            columns: DETAIL_SALE_COLUMNS,
            rows: saleRows,
            summary: saleSummary,
        });
        tables.push({
            heading: `${prefix}${single ? 'Commission breakdown' : 'commission breakdown'}`,
            columns: DETAIL_BREAKDOWN_COLUMNS,
            rows: breakdownRows,
            summary: breakdownSummary,
        });

        htmlSections.push(
            `<h2>${htmlPrefix}${single ? 'Sales' : 'sales'} (${group.sales.length})</h2>`,
            htmlTable(
                DETAIL_SALE_COLUMNS.map((column) => ({ label: column.label, right: column.align === 'right' })),
                saleRows,
                saleSummary,
            ),
            `<h2>${htmlPrefix}${single ? 'Commission breakdown' : 'commission breakdown'}</h2>`,
            htmlTable(
                DETAIL_BREAKDOWN_COLUMNS.map((column) => ({ label: column.label, right: column.align === 'right' })),
                breakdownRows,
                breakdownSummary,
            ),
        );
    });

    const totals = [
        { label: 'Total Sales Value', value: money(grand.salesValue) },
        { label: 'Total Amount', value: money(grand.totalAmount) },
        { label: 'Total Commission', value: money(grand.commission) },
        { label: 'Net After Commission', value: money(grand.totalAmount - grand.commission), strong: true },
    ];

    const html = printShell(
        title,
        'Vendor Commission — Detail Report',
        scopeName,
        displayDate(sheetDate),
        [
            htmlMeta(meta),
            ...htmlSections,
            htmlTotals(totals.map((total) => ({ label: total.label, value: total.value, grand: total.strong }))),
        ].join(''),
    );

    const shareText = [
        'ItemHive — Vendor Commission Detail Report',
        `Vendor: ${scopeName}`,
        `Date: ${displayDate(sheetDate)}`,
        '',
        ...groups.flatMap((group) => [
            `${group.vendorName}:`,
            ...group.sales.map((sale) =>
                `  ${displayTime(sale.time)} ${sale.productName} x${formatQuantity(sale.quantity)} @ ${money(sale.unitPrice)} -> ${sale.customerName || ANONYMOUS_CUSTOMER} = ${money(sale.totalPrice)}`),
            `  Sales ${money(group.salesValue)} | Amount ${money(group.totalAmount)} | Commission ${money(group.commission)} | Net ${money(group.totalAmount - group.commission)}`,
            '',
        ]),
        `Total Sales Value: ${money(grand.salesValue)}`,
        `Total Amount: ${money(grand.totalAmount)}`,
        `Total Commission: ${money(grand.commission)}`,
        `Net After Commission: ${money(grand.totalAmount - grand.commission)}`,
    ].join('\n');

    return {
        title,
        fileName: `vendor_commission_detail_${slug(scopeName)}_${sheetDate}.pdf`,
        html,
        shareText,
        buildPdf: () => buildDocumentPdfBlob({
            title: 'Vendor Commission - Detail Report',
            subtitle: pdfSafeText(scopeName),
            dateLabel: displayDate(sheetDate),
            accentHex: context.accentHex,
            meta,
            tables,
            totals,
        }),
    };
};

export { formatQuantity, displayDate, displayTime, rateOf, invoiceNumber, paymentLabel, ANONYMOUS_CUSTOMER };
