import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Card, CardContent, Chip, Grid, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Banknote, CalendarDays, CreditCard, HandCoins, ReceiptText, Users, WalletCards } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../../api/axios';
import useAppCurrency from '../../hooks/useAppCurrency';

interface CollectionData {
    summary: { todaysCollection: number; cashCollection: number; creditCollection: number; salesRevenue: number; totalOutstanding: number; customerCount: number; transactionCount: number };
    customers: Array<{ customerName: string; customerCnic: string; customerType: 'cash' | 'credit' | 'cash-and-credit'; cashCollection: number; creditCollection: number; totalCollection: number; salesAmount: number; transactions: number }>;
    last7Days: Array<{ _id: string; amount: number }>;
    last7Months: Array<{ _id: string; amount: number }>;
}

const today = () => new Date().toISOString().split('T')[0];

const TodaysCollectionPage: React.FC = () => {
    const { formatCurrency } = useAppCurrency();
    const [date, setDate] = useState(today());
    const [data, setData] = useState<CollectionData | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        setError('');
        api.get('/reports/collections-dashboard', { params: { date } })
            .then((response) => setData(response.data))
            .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load collection dashboard.'));
    }, [date]);

    const dayChart = useMemo(() => data?.last7Days.map((row) => ({ name: new Date(`${row._id}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), collection: row.amount })) || [], [data]);
    const monthChart = useMemo(() => data?.last7Months.map((row) => ({ name: new Date(`${row._id}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }), collection: row.amount })) || [], [data]);
    const cards = data ? [
        { label: "Today's Collection", value: data.summary.todaysCollection, icon: <HandCoins />, color: '#0f9d78' },
        { label: 'Total Outstanding', value: data.summary.totalOutstanding, icon: <WalletCards />, color: '#ef4444' },
        { label: 'Cash Collection', value: data.summary.cashCollection, icon: <Banknote />, color: '#16a34a' },
        { label: 'Credit Recovery', value: data.summary.creditCollection, icon: <CreditCard />, color: '#2563eb' },
        { label: 'Sales Revenue', value: data.summary.salesRevenue, icon: <ReceiptText />, color: '#7c3aed' },
        { label: 'Customers / Transactions', value: `${data.summary.customerCount} / ${data.summary.transactionCount}`, icon: <Users />, color: '#ea580c', plain: true },
    ] : [];

    return <Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
            <Box><Typography variant="h4" fontWeight={900}>Today's Collection</Typography><Typography color="text.secondary">Daily collection, customer recovery and outstanding overview.</Typography></Box>
            <TextField type="date" label="Collection Date" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} InputProps={{ startAdornment: <CalendarDays size={18} style={{ marginRight: 10 }} /> }} />
        </Stack>
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        {data && <Grid container spacing={3}>
            <Grid size={{ xs: 12, lg: 9 }}>
                <Card sx={{ borderRadius: 4 }}><CardContent>
                    <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>Customer Collection Summary</Typography>
                    <TableContainer><Table sx={{ minWidth: 850 }}>
                        <TableHead><TableRow><TableCell>CUSTOMER</TableCell><TableCell>TYPE</TableCell><TableCell>SALES</TableCell><TableCell>CASH</TableCell><TableCell>CREDIT RECOVERY</TableCell><TableCell align="right">TOTAL COLLECTION</TableCell></TableRow></TableHead>
                        <TableBody>{data.customers.length ? data.customers.map((row) => <TableRow key={`${row.customerName}-${row.customerCnic}`} hover>
                            <TableCell><Typography fontWeight={800}>{row.customerName}</Typography><Typography variant="caption" color="text.secondary">{row.customerCnic || 'No ID'} · {row.transactions} transaction(s)</Typography></TableCell>
                            <TableCell><Chip size="small" label={row.customerType === 'cash-and-credit' ? 'Cash & Credit' : row.customerType} color={row.customerType === 'credit' ? 'warning' : row.customerType === 'cash' ? 'success' : 'primary'} sx={{ textTransform: 'capitalize', fontWeight: 700 }} /></TableCell>
                            <TableCell>{formatCurrency(row.salesAmount)}</TableCell><TableCell>{formatCurrency(row.cashCollection)}</TableCell><TableCell>{formatCurrency(row.creditCollection)}</TableCell><TableCell align="right" sx={{ fontWeight: 900, color: 'success.main' }}>{formatCurrency(row.totalCollection)}</TableCell>
                        </TableRow>) : <TableRow><TableCell colSpan={6} align="center" sx={{ py: 7 }}>No collection records for this date.</TableCell></TableRow>}</TableBody>
                    </Table></TableContainer>
                </CardContent></Card>
            </Grid>
            <Grid size={{ xs: 12, lg: 3 }}><Stack spacing={2}>{cards.map((card) => <Card key={card.label} sx={{ borderRadius: 3, borderLeft: `5px solid ${card.color}` }}><CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '16px !important' }}><Box sx={{ color: card.color }}>{card.icon}</Box><Box><Typography variant="caption" color="text.secondary">{card.label}</Typography><Typography variant="h6" fontWeight={900} color={card.color}>{card.plain ? card.value : formatCurrency(Number(card.value))}</Typography></Box></CardContent></Card>)}</Stack></Grid>
            {[{ title: 'Last 7 Days Recovery', rows: dayChart }, { title: 'Last 7 Months Recovery', rows: monthChart }].map((chart) => <Grid key={chart.title} size={{ xs: 12, md: 6 }}><Card sx={{ borderRadius: 4 }}><CardContent><Typography variant="h6" fontWeight={800}>{chart.title}</Typography><Box sx={{ height: 280, mt: 2 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={chart.rows}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis /><Tooltip formatter={(value) => formatCurrency(Number(value || 0))} /><Bar dataKey="collection" fill="#22a06b" radius={[7, 7, 0, 0]} /></BarChart></ResponsiveContainer></Box></CardContent></Card></Grid>)}
        </Grid>}
    </Box>;
};

export default TodaysCollectionPage;
