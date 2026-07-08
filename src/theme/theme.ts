import { createTheme, type PaletteMode, alpha } from '@mui/material';

export const getAppTheme = (mode: PaletteMode) => createTheme({
    palette: {
        mode,
        primary: {
            main: '#0ea5a5',
            light: '#2dd4bf',
            dark: '#0f766e',
            contrastText: '#ffffff',
        },
        secondary: {
            main: '#f59e0b',
            light: '#fbbf24',
            dark: '#d97706',
            contrastText: '#0b1220',
        },
        success: {
            main: '#16a34a',
            light: '#4ade80',
            dark: '#15803d',
        },
        warning: {
            main: '#f59e0b',
            light: '#fbbf24',
            dark: '#d97706',
        },
        error: {
            main: '#dc2626',
            light: '#f87171',
            dark: '#b91c1c',
        },
        background: {
            default: mode === 'light' ? '#f5f7fb' : '#0a0f1c',
            paper: mode === 'light' ? '#ffffff' : '#111827',
        },
        text: {
            primary: mode === 'light' ? '#0f172a' : '#f1f5f9',
            secondary: mode === 'light' ? '#5b6475' : '#cbd5f5',
        },
        divider: mode === 'light' ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.14)',
        action: {
            hover: mode === 'light' ? 'rgba(15, 23, 42, 0.04)' : 'rgba(148, 163, 184, 0.16)',
            selected: mode === 'light' ? 'rgba(14, 165, 165, 0.12)' : 'rgba(45, 212, 191, 0.18)',
        },
    },
    typography: {
        fontFamily: '"Manrope", "Segoe UI", "Helvetica", "Arial", sans-serif',
        h1: { fontWeight: 800, fontSize: '2.6rem', letterSpacing: '-0.02em', fontFamily: '"Sora", "Manrope", sans-serif' },
        h2: { fontWeight: 800, fontSize: '2.2rem', letterSpacing: '-0.02em', fontFamily: '"Sora", "Manrope", sans-serif' },
        h3: { fontWeight: 700, fontSize: '1.85rem', letterSpacing: '-0.01em', fontFamily: '"Sora", "Manrope", sans-serif' },
        h4: { fontWeight: 700, fontSize: '1.55rem', letterSpacing: '-0.01em', fontFamily: '"Sora", "Manrope", sans-serif' },
        h5: { fontWeight: 700, fontSize: '1.25rem', fontFamily: '"Sora", "Manrope", sans-serif' },
        h6: { fontWeight: 700, fontSize: '1.05rem', fontFamily: '"Sora", "Manrope", sans-serif' },
        button: { textTransform: 'none', fontWeight: 700 },
    },
    shape: {
        borderRadius: 6,
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    boxShadow: 'none',
                    borderRadius: 6,
                    '&:hover': {
                        boxShadow: '0 8px 16px -10px rgba(15, 23, 42, 0.4)',
                    },
                },
                contained: { padding: '10px 22px' },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    boxShadow: mode === 'light'
                        ? '0 12px 30px -20px rgba(15, 23, 42, 0.35)'
                        : '0 16px 32px -24px rgba(0, 0, 0, 0.7)',
                    border: mode === 'light'
                        ? '1px solid rgba(15, 23, 42, 0.08)'
                        : '1px solid rgba(148, 163, 184, 0.28)',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    borderRadius: 8,
                    boxShadow: mode === 'light'
                        ? '0 8px 24px -12px rgba(15, 23, 42, 0.12)'
                        : '0 12px 24px -16px rgba(0, 0, 0, 0.5)',
                },
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    borderRadius: 6,
                    backgroundColor: mode === 'light' ? '#f8fafc' : alpha('#1e293b', 0.4),
                },
            },
        },
        MuiTextField: {
            defaultProps: {
                size: 'small',
            },
        },
        MuiInputBase: {
            styleOverrides: {
                root: {
                    borderRadius: 6,
                },
            },
        },
        MuiAutocomplete: {
            styleOverrides: {
                paper: {
                    borderRadius: 6,
                },
            },
        },
        MuiTableContainer: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    overflowX: 'auto',
                    maxWidth: '100%',
                    WebkitOverflowScrolling: 'touch',
                },
            },
        },
        MuiTableHead: {
            styleOverrides: {
                root: {
                    backgroundColor: mode === 'light' ? 'rgba(14, 165, 165, 0.06)' : 'rgba(14, 165, 165, 0.12)',
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    fontWeight: 700,
                    borderRadius: 6,
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    borderBottom: mode === 'light'
                        ? '1px solid rgba(15, 23, 42, 0.08)'
                        : '1px solid rgba(148, 163, 184, 0.2)',
                    '@media (max-width:600px)': {
                        padding: '10px 12px',
                        fontSize: '0.78rem',
                    },
                },
            },
        },
        MuiTooltip: {
            styleOverrides: {
                tooltip: {
                    backgroundColor: mode === 'light' ? '#0f172a' : '#111827',
                    color: mode === 'light' ? '#f8fafc' : '#e2e8f0',
                    border: mode === 'light' ? '1px solid rgba(15, 23, 42, 0.2)' : '1px solid rgba(148, 163, 184, 0.3)',
                },
            },
        },
        MuiDialog: {
            defaultProps: {
                transitionDuration: { enter: 220, exit: 170 },
            },
            styleOverrides: {
                paper: {
                    transition: 'transform 220ms ease, opacity 180ms ease',
                },
            },
        },
        MuiPopover: {
            defaultProps: {
                transitionDuration: { enter: 180, exit: 140 },
            },
        },
    },
});

export default getAppTheme;

