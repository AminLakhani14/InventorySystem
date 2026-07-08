import type { CountryCode } from '../features/settings/settingsSlice';

export const getRegionalIdLabel = (country: CountryCode) => {
    if (country === 'PK') return 'CNIC';
    if (country === 'US') return "Driver's License / State ID";
    return 'National Identity Card';
};
