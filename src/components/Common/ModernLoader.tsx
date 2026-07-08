import React from 'react';
import { Box, CircularProgress, Typography, alpha } from '@mui/material';

const ModernLoader: React.FC = () => {
    return (
        <Box
            sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                bgcolor: (theme) => alpha(theme.palette.background.default, 0.8),
                backdropFilter: 'blur(12px)',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3
            }}
        >
            <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress
                    size={70}
                    thickness={2.5}
                    sx={{
                        color: 'primary.main',
                        '& .MuiCircularProgress-circle': {
                            strokeLinecap: 'round',
                        }
                    }}
                />
                <Box
                    sx={{
                        position: 'absolute',
                        width: 32,
                        height: 32,
                        bgcolor: 'primary.main',
                        borderRadius: 1.5,
                        transform: 'rotate(45deg)',
                        animation: 'spin 3s infinite linear',
                        boxShadow: (theme) => `0 0 20px -5px ${alpha(theme.palette.primary.main, 0.5)}`,
                        '@keyframes spin': {
                            '0%': { transform: 'rotate(0deg) scale(0.8)' },
                            '50%': { transform: 'rotate(180deg) scale(1.1)' },
                            '100%': { transform: 'rotate(360deg) scale(0.8)' },
                        }
                    }}
                />
            </Box>
            <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" fontWeight={800} color="primary.main" sx={{ letterSpacing: 4, mb: 0.5 }}>
                    ITEMHIVE
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 1.5, opacity: 0.7 }}>
                    SYNCHRONIZING SECURELY
                </Typography>
            </Box>
        </Box>
    );
};

export default ModernLoader;
