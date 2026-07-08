import React from 'react';
import {
    Avatar,
    Box,
    Card,
    CardContent,
    Chip,
    Grid,
    Stack,
    TextField,
    Typography,
    InputAdornment,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Archive, Boxes, Languages, PackageCheck, Search, Scale } from 'lucide-react';
import { PRODUCT_UNITS } from '../../lib/productUnits';

const ProductUnitsPage: React.FC = () => {
    const theme = useTheme();
    const [searchTerm, setSearchTerm] = React.useState('');

    const filteredUnits = React.useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) return PRODUCT_UNITS;
        return PRODUCT_UNITS.filter((unit) =>
            unit.english.toLowerCase().includes(query) ||
            unit.shortLabel.toLowerCase().includes(query) ||
            unit.urdu.includes(searchTerm.trim()) ||
            unit.example.toLowerCase().includes(query)
        );
    }, [searchTerm]);

    return (
        <Box>
            <Box
                sx={{
                    mb: 3,
                    p: { xs: 2.5, md: 3 },
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: alpha(theme.palette.primary.main, 0.18),
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)}, ${alpha(theme.palette.success.main, 0.08)} 48%, ${alpha(theme.palette.warning.main, 0.1)})`,
                    boxShadow: `0 18px 45px ${alpha(theme.palette.common.black, 0.08)}`,
                }}
            >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Box>
                        <Typography variant="h4" fontWeight={900}>Product Units</Typography>
                        <Typography variant="body2" color="text.secondary">
                            English and Urdu selling units for Pakistani shops: Bori, Carton, KG, Litre, Crate, and more.
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        <Chip icon={<Languages size={16} />} label="English + اردو" sx={{ bgcolor: 'background.paper', fontWeight: 800 }} />
                        <Chip icon={<PackageCheck size={16} />} label={`${PRODUCT_UNITS.length} Units`} color="primary" sx={{ fontWeight: 800 }} />
                    </Stack>
                </Box>
            </Box>

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Card sx={{ borderRadius: '8px', height: '100%', border: '1px solid', borderColor: 'divider' }}>
                        <CardContent>
                            <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: 'primary.main', mb: 2 }}>
                                <Scale size={22} />
                            </Avatar>
                            <Typography variant="h6" fontWeight={900}>Use on Product Setup</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
                                When creating or editing a product, choose how it is sold. Inventory will display stock as “50 KG / کلو” or “10 Bori / بوری”.
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Card sx={{ borderRadius: '8px', height: '100%', border: '1px solid', borderColor: 'divider' }}>
                        <CardContent>
                            <Avatar sx={{ bgcolor: alpha(theme.palette.success.main, 0.12), color: 'success.main', mb: 2 }}>
                                <Boxes size={22} />
                            </Avatar>
                            <Typography variant="h6" fontWeight={900}>Wholesale Friendly</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
                                Supports common Pakistani trade terms like Bori / بوری, Carton / کارٹن, Crate / کریٹ, and Maund / من.
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Card sx={{ borderRadius: '8px', height: '100%', border: '1px solid', borderColor: 'divider' }}>
                        <CardContent>
                            <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.14), color: 'warning.main', mb: 2 }}>
                                <Archive size={22} />
                            </Avatar>
                            <Typography variant="h6" fontWeight={900}>Retail Friendly</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
                                Also supports Piece / عدد, Packet / پیکٹ, Bottle / بوتل, Box / ڈبہ, and Meter / میٹر for everyday retail.
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid size={12}>
                    <Card sx={{ borderRadius: '8px', border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                        <CardContent sx={{ p: 0 }}>
                            <Box sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                                <TextField
                                    fullWidth
                                    placeholder="Search unit by English, Urdu, or example..."
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <Search size={18} />
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Box>

                            <Grid container spacing={0}>
                                {filteredUnits.map((unit) => (
                                    <Grid key={unit.code} size={{ xs: 12, sm: 6, lg: 4 }}>
                                        <Box
                                            sx={{
                                                p: 2.5,
                                                height: '100%',
                                                borderRight: { sm: '1px solid' },
                                                borderBottom: '1px solid',
                                                borderColor: 'divider',
                                                display: 'flex',
                                                gap: 1.5,
                                            }}
                                        >
                                            <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', fontWeight: 900 }}>
                                                {unit.shortLabel.slice(0, 2).toUpperCase()}
                                            </Avatar>
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography variant="h6" fontWeight={900}>
                                                    {unit.english}
                                                </Typography>
                                                <Typography variant="h5" fontWeight={900} sx={{ direction: 'rtl', textAlign: 'left' }}>
                                                    {unit.urdu}
                                                </Typography>
                                                <Chip label={unit.shortLabel} size="small" sx={{ mt: 1, mb: 1, fontWeight: 800 }} />
                                                <Typography variant="body2" color="text.secondary">
                                                    {unit.example}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Grid>
                                ))}
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
};

export default ProductUnitsPage;
