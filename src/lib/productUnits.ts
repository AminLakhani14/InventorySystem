export type ProductUnitCode =
    | 'piece'
    | 'bori'
    | 'carton'
    | 'kg'
    | 'gram'
    | 'litre'
    | 'crate'
    | 'dozen'
    | 'packet'
    | 'box'
    | 'bottle'
    | 'meter'
    | 'maund';

export interface ProductUnitOption {
    code: ProductUnitCode;
    english: string;
    urdu: string;
    shortLabel: string;
    example: string;
}

export const PRODUCT_UNITS: ProductUnitOption[] = [
    { code: 'piece', english: 'Piece', urdu: 'عدد', shortLabel: 'Pcs', example: 'Mobile accessories, single items' },
    { code: 'bori', english: 'Bori / Sack', urdu: 'بوری', shortLabel: 'Bori', example: 'Flour, rice, sugar, animal feed' },
    { code: 'carton', english: 'Carton', urdu: 'کارٹن', shortLabel: 'Carton', example: 'Milk packs, biscuits, packaged goods' },
    { code: 'kg', english: 'Kilogram', urdu: 'کلو', shortLabel: 'KG', example: 'Potato, onion, rice, pulses' },
    { code: 'gram', english: 'Gram', urdu: 'گرام', shortLabel: 'g', example: 'Spices, dry fruits, tea' },
    { code: 'litre', english: 'Litre', urdu: 'لیٹر', shortLabel: 'L', example: 'Oil, milk, drinks, petrol products' },
    { code: 'crate', english: 'Crate', urdu: 'کریٹ', shortLabel: 'Crate', example: 'Cold drinks, eggs, fruit crates' },
    { code: 'dozen', english: 'Dozen', urdu: 'درجن', shortLabel: 'Dozen', example: 'Eggs, small packs, stationery' },
    { code: 'packet', english: 'Packet', urdu: 'پیکٹ', shortLabel: 'Pkt', example: 'Snacks, chips, nimko, masala' },
    { code: 'box', english: 'Box', urdu: 'ڈبہ', shortLabel: 'Box', example: 'Shoes, medicines, hardware items' },
    { code: 'bottle', english: 'Bottle', urdu: 'بوتل', shortLabel: 'Bottle', example: 'Water, beverages, shampoo' },
    { code: 'meter', english: 'Meter', urdu: 'میٹر', shortLabel: 'm', example: 'Cloth, wire, pipe' },
    { code: 'maund', english: 'Maund', urdu: 'من', shortLabel: 'Maund', example: 'Wholesale grain and produce' },
];

export const DEFAULT_PRODUCT_UNIT = PRODUCT_UNITS[0];

export const getProductUnit = (code?: string) =>
    PRODUCT_UNITS.find((unit) => unit.code === code) || DEFAULT_PRODUCT_UNIT;

export const getProductUnitLabel = (code?: string, fallbackEnglish?: string, fallbackUrdu?: string) => {
    const unit = getProductUnit(code);
    return `${fallbackEnglish || unit.english} / ${fallbackUrdu || unit.urdu}`;
};
