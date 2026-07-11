import React from 'react';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, isValid, parseISO } from 'date-fns';

interface AppDatePickerProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    minDate?: string;
    maxDate?: string;
    size?: 'small' | 'medium';
    fullWidth?: boolean;
    required?: boolean;
}

const toDate = (value?: string) => {
    if (!value) return null;
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : null;
};

const AppDatePicker: React.FC<AppDatePickerProps> = ({ label, value, onChange, minDate, maxDate, size = 'medium', fullWidth, required }) => (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DatePicker
            label={label}
            value={toDate(value)}
            onChange={(date) => onChange(date && isValid(date) ? format(date, 'yyyy-MM-dd') : '')}
            minDate={toDate(minDate) || undefined}
            maxDate={toDate(maxDate) || undefined}
            format="dd/MM/yyyy"
            slotProps={{ textField: { size, fullWidth, required } }}
        />
    </LocalizationProvider>
);

export default AppDatePicker;
