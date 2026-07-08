import React from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Grid,
    Snackbar,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { CheckCircle2, ClipboardCheck, Plus, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import api from '../../api/axios';

interface InventoryRequest {
    _id: string;
    requestedByName: string;
    requestedByEmail: string;
    status: 'pending' | 'approved' | 'rejected';
    decisionNote?: string;
    approvedProductId?: string;
    createdAt: string;
    reviewedByName?: string;
    productData: {
        sku: string;
        name: string;
        category: string;
        purchasePrice: number;
        salePrice: number;
        stock: number;
        minStock: number;
        description?: string;
    };
}

const InventoryRequestsPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useSelector((state: RootState) => state.auth);
    const isManager = user?.role === 'super_admin' || user?.role === 'admin';
    const [requests, setRequests] = React.useState<InventoryRequest[]>([]);
    const [notes, setNotes] = React.useState<Record<string, string>>({});
    const [loading, setLoading] = React.useState(true);
    const [busyId, setBusyId] = React.useState('');
    const [error, setError] = React.useState('');
    const [snack, setSnack] = React.useState('');

    const loadRequests = React.useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const response = await api.get('/inventory-requests');
            setRequests(response.data as InventoryRequest[]);
        } catch (requestError: any) {
            setError(requestError?.response?.data?.message || 'Unable to load inventory requests right now.');
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    const handleReview = async (requestId: string, status: 'approved' | 'rejected') => {
        setBusyId(requestId);

        try {
            await api.patch(`/inventory-requests/${requestId}/review`, {
                status,
                decisionNote: notes[requestId] || '',
            });
            await loadRequests();
            setSnack(`Request ${status} successfully.`);
        } catch (requestError: any) {
            setError(requestError?.response?.data?.message || 'Unable to review this request.');
        } finally {
            setBusyId('');
        }
    };

    const pendingCount = requests.filter((request) => request.status === 'pending').length;

    return (
        <Box>
            <Snackbar
                open={Boolean(snack)}
                autoHideDuration={2600}
                onClose={() => setSnack('')}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <Alert onClose={() => setSnack('')} severity="success" sx={{ width: '100%' }}>
                    {snack}
                </Alert>
            </Snackbar>

            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h4" fontWeight={800}>Inventory Requests</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {isManager
                            ? `${pendingCount} request${pendingCount === 1 ? '' : 's'} waiting for review.`
                            : 'Track the inventory requests you have sent for approval.'}
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<Plus size={18} />}
                    onClick={() => navigate('/inventory/add')}
                    sx={{ borderRadius: 2, fontWeight: 800 }}
                >
                    {isManager ? 'Add Product Directly' : 'New Inventory Request'}
                </Button>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                    {error}
                </Alert>
            )}

            {loading ? (
                <Box sx={{ minHeight: 240, display: 'grid', placeItems: 'center' }}>
                    <CircularProgress />
                </Box>
            ) : (
                <Grid container spacing={3}>
                    {requests.map((request) => {
                        const isBusy = busyId === request._id;

                        return (
                            <Grid key={request._id} size={{ xs: 12, md: 6 }}>
                                <Card sx={{ borderRadius: 4, height: '100%' }}>
                                    <CardContent sx={{ p: 3 }}>
                                        <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start">
                                            <Box>
                                                <Typography variant="h6" fontWeight={800}>{request.productData.name}</Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    SKU {request.productData.sku} • {request.productData.category}
                                                </Typography>
                                            </Box>
                                            <Chip
                                                label={request.status}
                                                color={request.status === 'approved' ? 'success' : request.status === 'rejected' ? 'error' : 'warning'}
                                                sx={{ textTransform: 'capitalize', fontWeight: 700 }}
                                            />
                                        </Stack>

                                        <Grid container spacing={1.5} sx={{ mt: 2 }}>
                                            <Grid size={{ xs: 6 }}>
                                                <Typography variant="caption" color="text.secondary">Purchase Price</Typography>
                                                <Typography variant="body2" fontWeight={700}>{request.productData.purchasePrice}</Typography>
                                            </Grid>
                                            <Grid size={{ xs: 6 }}>
                                                <Typography variant="caption" color="text.secondary">Sale Price</Typography>
                                                <Typography variant="body2" fontWeight={700}>{request.productData.salePrice}</Typography>
                                            </Grid>
                                            <Grid size={{ xs: 6 }}>
                                                <Typography variant="caption" color="text.secondary">Requested Stock</Typography>
                                                <Typography variant="body2" fontWeight={700}>{request.productData.stock}</Typography>
                                            </Grid>
                                            <Grid size={{ xs: 6 }}>
                                                <Typography variant="caption" color="text.secondary">Min Stock</Typography>
                                                <Typography variant="body2" fontWeight={700}>{request.productData.minStock}</Typography>
                                            </Grid>
                                        </Grid>

                                        <Box sx={{ mt: 2 }}>
                                            <Typography variant="caption" color="text.secondary">Requested By</Typography>
                                            <Typography variant="body2" fontWeight={700}>
                                                {request.requestedByName} • {request.requestedByEmail}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {new Date(request.createdAt).toLocaleString()}
                                            </Typography>
                                        </Box>

                                        {request.productData.description && (
                                            <Box sx={{ mt: 2, p: 2, borderRadius: 3, bgcolor: 'action.hover' }}>
                                                <Typography variant="caption" color="text.secondary">Description</Typography>
                                                <Typography variant="body2">{request.productData.description}</Typography>
                                            </Box>
                                        )}

                                        {isManager && request.status === 'pending' && (
                                            <Stack spacing={1.5} sx={{ mt: 2.5 }}>
                                                <TextField
                                                    label="Decision note"
                                                    size="small"
                                                    value={notes[request._id] || ''}
                                                    onChange={(event) => setNotes((current) => ({
                                                        ...current,
                                                        [request._id]: event.target.value,
                                                    }))}
                                                />
                                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                                    <Button
                                                        fullWidth
                                                        variant="contained"
                                                        color="success"
                                                        startIcon={<CheckCircle2 size={16} />}
                                                        onClick={() => handleReview(request._id, 'approved')}
                                                        disabled={isBusy}
                                                    >
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        fullWidth
                                                        variant="outlined"
                                                        color="error"
                                                        startIcon={<XCircle size={16} />}
                                                        onClick={() => handleReview(request._id, 'rejected')}
                                                        disabled={isBusy}
                                                    >
                                                        Reject
                                                    </Button>
                                                </Stack>
                                            </Stack>
                                        )}

                                        {request.status !== 'pending' && (
                                            <Box sx={{ mt: 2.5, p: 2, borderRadius: 3, bgcolor: 'action.hover' }}>
                                                <Typography variant="subtitle2" fontWeight={700}>
                                                    Reviewed by {request.reviewedByName || 'Admin'}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {request.decisionNote || 'No review note was added.'}
                                                </Typography>
                                            </Box>
                                        )}
                                    </CardContent>
                                </Card>
                            </Grid>
                        );
                    })}

                    {!requests.length && (
                        <Grid size={12}>
                            <Card sx={{ borderRadius: 4 }}>
                                <CardContent sx={{ p: 4, textAlign: 'center' }}>
                                    <ClipboardCheck size={38} style={{ opacity: 0.45, marginBottom: 12 }} />
                                    <Typography variant="h6" fontWeight={800}>No inventory requests yet</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {isManager
                                            ? 'Requests from users will appear here as soon as they are submitted.'
                                            : 'Create your first inventory request from the button above.'}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    )}
                </Grid>
            )}
        </Box>
    );
};

export default InventoryRequestsPage;
