import React from 'react';
import axios from 'axios';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { CheckCircle2, Mail, Store, UserPlus, XCircle } from 'lucide-react';
import api from '../../api/axios';

interface SignupRequest {
    _id: string;
    fullName: string;
    email: string;
    businessName: string;
    packageName?: string;
    country?: string;
    currency?: string;
    businessType?: string;
    phone?: string;
    employeeCount: number;
    address?: string;
    notes?: string;
    status: 'pending' | 'approved' | 'rejected';
    decisionNote?: string;
    createdAt: string;
}

const getErrorMessage = (error: unknown, fallback: string) => {
    if (!axios.isAxiosError<{ message?: string }>(error)) return fallback;
    if (!error.response) {
        return 'Unable to reach the server. Please check CORS/network or confirm the backend is redeployed.';
    }
    return error.response?.data?.message || `Request failed with status ${error.response.status}`;
};

const SignupRequestsPage: React.FC = () => {
    const [requests, setRequests] = React.useState<SignupRequest[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [snack, setSnack] = React.useState('');
    const [decisionTarget, setDecisionTarget] = React.useState<SignupRequest | null>(null);
    const [decision, setDecision] = React.useState<'approved' | 'rejected'>('approved');
    const [decisionNote, setDecisionNote] = React.useState('');
    const [saving, setSaving] = React.useState(false);

    const loadRequests = React.useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await api.get('/signup-requests');
            setRequests(response.data || []);
        } catch (requestError) {
            setError(getErrorMessage(requestError, 'Unable to load signup requests.'));
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    const openDecision = (request: SignupRequest, nextDecision: 'approved' | 'rejected') => {
        setDecisionTarget(request);
        setDecision(nextDecision);
        setDecisionNote('');
    };

    const submitDecision = async () => {
        if (!decisionTarget) return;

        setSaving(true);
        setError('');
        try {
            await api.patch(`/signup-requests/${decisionTarget._id}/decision`, {
                status: decision,
                decisionNote,
            });
            setDecisionTarget(null);
            await loadRequests();
            setSnack(`Request ${decision} successfully. Email notification was attempted.`);
            window.setTimeout(() => setSnack(''), 3200);
        } catch (requestError) {
            setError(getErrorMessage(requestError, 'Unable to update signup request.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" fontWeight={900}>Signup Requests</Typography>
                <Typography variant="body2" color="text.secondary">
                    Review new business account requests before creating their workspace.
                </Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {snack && <Alert severity="success" sx={{ mb: 2 }}>{snack}</Alert>}

            <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                <Table size="small" sx={{ minWidth: 980 }}>
                    <TableHead>
                        <TableRow>
                            <TableCell>Requester</TableCell>
                            <TableCell>Business</TableCell>
                            <TableCell>Details</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 8 }}><CircularProgress size={28} /></TableCell>
                            </TableRow>
                        )}
                        {!loading && requests.map((request) => (
                            <TableRow key={request._id} hover>
                                <TableCell>
                                    <Typography variant="body2" fontWeight={900}>{request.fullName}</Typography>
                                    <Stack direction="row" spacing={0.75} alignItems="center">
                                        <Mail size={13} />
                                        <Typography variant="caption" color="text.secondary">{request.email}</Typography>
                                    </Stack>
                                </TableCell>
                                <TableCell>
                                    <Stack direction="row" spacing={0.75} alignItems="center">
                                        <Store size={15} />
                                        <Typography variant="body2" fontWeight={800}>{request.businessName}</Typography>
                                    </Stack>
                                    <Typography variant="caption" color="text.secondary">{request.businessType || 'Business type not specified'}</Typography>
                                    <Typography variant="caption" color="primary.main" display="block" fontWeight={800}>
                                        {request.packageName || 'No package'}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" display="block">
                                        {request.country || 'No country'} {request.currency ? `- ${request.currency}` : ''}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="caption" display="block">Employees: {request.employeeCount}</Typography>
                                    <Typography variant="caption" color="text.secondary" display="block">{request.phone || 'No phone'}</Typography>
                                    <Typography variant="caption" color="text.secondary" display="block">{request.address || 'No address'}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        size="small"
                                        label={request.status}
                                        color={request.status === 'pending' ? 'warning' : request.status === 'approved' ? 'success' : 'error'}
                                        sx={{ fontWeight: 800, textTransform: 'capitalize' }}
                                    />
                                </TableCell>
                                <TableCell align="right">
                                    {request.status === 'pending' ? (
                                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                                            <Button size="small" variant="contained" startIcon={<CheckCircle2 size={15} />} onClick={() => openDecision(request, 'approved')}>
                                                Approve
                                            </Button>
                                            <Button size="small" color="error" variant="outlined" startIcon={<XCircle size={15} />} onClick={() => openDecision(request, 'rejected')}>
                                                Reject
                                            </Button>
                                        </Stack>
                                    ) : (
                                        <Typography variant="caption" color="text.secondary">{request.decisionNote || 'Reviewed'}</Typography>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {!loading && !requests.length && (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                                    <UserPlus size={34} opacity={0.45} />
                                    <Typography variant="body2" color="text.secondary">No signup requests yet.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={Boolean(decisionTarget)} onClose={() => !saving && setDecisionTarget(null)} fullWidth maxWidth="sm">
                <DialogTitle>{decision === 'approved' ? 'Approve Request' : 'Reject Request'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        <Typography variant="body2">
                            {decisionTarget?.fullName} requested access for <strong>{decisionTarget?.businessName}</strong>.
                        </Typography>
                        <TextField
                            label="Decision note"
                            multiline
                            minRows={3}
                            value={decisionNote}
                            onChange={(event) => setDecisionNote(event.target.value)}
                            placeholder={decision === 'approved' ? 'Optional welcome note...' : 'Reason for rejection...'}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDecisionTarget(null)} disabled={saving}>Cancel</Button>
                    <Button color={decision === 'approved' ? 'primary' : 'error'} variant="contained" onClick={submitDecision} disabled={saving}>
                        {saving ? 'Saving...' : decision === 'approved' ? 'Approve & Create Account' : 'Reject Request'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default SignupRequestsPage;
