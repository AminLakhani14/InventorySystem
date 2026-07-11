import React from 'react';
import { TextField } from '@mui/material';

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

const AppDatePicker: React.FC<AppDatePickerProps> = ({ label, value, onChange, minDate, maxDate, size = 'medium', fullWidth, required }) => (
    <TextField
        type="date"
        label={label}
        value={value}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        size={size}
        fullWidth={fullWidth}
        required={required}
        slotProps={{
            inputLabel: { shrink: true },
            htmlInput: {
                min: minDate,
                max: maxDate,
            },
        }}
    />
);

export default AppDatePicker;
