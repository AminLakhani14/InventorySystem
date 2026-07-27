// A single customer sale is stored as one transaction per product line, with ids shaped
// `<SALE-ID>-L<n>`. Order Desk sales use the `ORD-` prefix and Quick Credit Sales use `QSO-`,
// where a separate `QSO-` id is issued per vendor — so lines from the same vendor group into
// one entry while a second vendor stays a separate one.

const SALE_ID_PREFIX = /^(ORD|QSO)-/;
const LINE_SUFFIX = /-L\d+$/;

export const getSaleGroupId = (transactionId: string) => {
    if (!SALE_ID_PREFIX.test(transactionId)) return transactionId;
    const withoutLine = transactionId.replace(LINE_SUFFIX, '');
    // Order Desk ids are displayed without their prefix; quick sales keep theirs.
    return withoutLine.startsWith('ORD-') ? withoutLine.slice(4) : withoutLine;
};

export interface SaleSummaryLine {
    productName: string;
    quantity: number;
}

/** "10 × Garlic (Lehsan), 50 × Tomato (Tamatar)" — trimmed with "+N more" when long. */
export const buildSaleItemsSummary = (lines: SaleSummaryLine[], maxNamed = 3) => {
    if (!lines.length) return '';
    const named = lines
        .slice(0, maxNamed)
        .map((line) => `${line.quantity} × ${line.productName}`)
        .join(', ');
    const remaining = lines.length - maxNamed;
    return remaining > 0 ? `${named} + ${remaining} more` : named;
};

/** Distinct vendor names on a sale, for the "from <vendor>" caption. */
export const buildVendorLabel = (vendorNames: Array<string | undefined>) =>
    Array.from(new Set(vendorNames.map((name) => (name || '').trim()).filter(Boolean))).join(', ');
