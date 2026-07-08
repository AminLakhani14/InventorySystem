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
    IconButton,
    InputAdornment,
    MenuItem,
    Snackbar,
    Stack,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { Edit3, Eye, EyeOff, Search, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import type { User, UserRole } from '../../features/auth/authSlice';
import api from '../../api/axios';

interface UsersPage {
    users: User[];
    total: number;
}

type UsersResponse = UsersPage | User[];

interface ApiErrorResponse {
    message?: string;
    details?: string;
}

interface AccountDraft {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    businessId: string;
    userCreationLimit: string;
}

interface CreateAccountDraft {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    businessId: string;
    businessName: string;
}

interface BusinessOption {
    id: string;
    name: string;
    isLegacy?: boolean;
}

const roleLabel = (role: User['role']) =>
    role === 'super_admin' ? 'Super Admin' : role === 'admin' ? 'Admin' : 'User';

const getApiErrorMessage = (error: unknown, fallback: string) => {
    if (!axios.isAxiosError<ApiErrorResponse>(error)) return fallback;
    return error.response?.data?.message || error.response?.data?.details || fallback;
};

const TeamManagementPage: React.FC = () => {
    const { user: currentUser } = useSelector((state: RootState) => state.auth);
    const isSuperAdmin = currentUser?.role === 'super_admin';
    const [users, setUsers] = React.useState<User[]>([]);
    const [businesses, setBusinesses] = React.useState<BusinessOption[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [savingId, setSavingId] = React.useState('');
    const [search, setSearch] = React.useState('');
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(20);
    const [total, setTotal] = React.useState(0);
    const [editingUser, setEditingUser] = React.useState<User | null>(null);
    const [deletingUser, setDeletingUser] = React.useState<User | null>(null);
    const [draft, setDraft] = React.useState<AccountDraft>({ name: '', email: '', password: '', role: 'user', businessId: '', userCreationLimit: '0' });
    const [showPassword, setShowPassword] = React.useState(false);
    const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
    const [createSaving, setCreateSaving] = React.useState(false);
    const [deleteSaving, setDeleteSaving] = React.useState(false);
    const [showCreatePassword, setShowCreatePassword] = React.useState(false);
    const [createDraft, setCreateDraft] = React.useState<CreateAccountDraft>({
        name: '',
        email: '',
        password: '',
        role: isSuperAdmin ? 'admin' : 'user',
        businessId: '',
        businessName: '',
    });
    const [snack, setSnack] = React.useState('');
    const [error, setError] = React.useState('');

    const loadUsers = React.useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const response = await api.get<UsersResponse>('/users', {
                params: { page: page + 1, limit: rowsPerPage, search: search.trim() || undefined },
            });
            const nextUsers = Array.isArray(response.data) ? response.data : response.data.users || [];
            setUsers(nextUsers);
            setTotal(Array.isArray(response.data) ? nextUsers.length : response.data.total || 0);
        } catch (requestError: unknown) {
            setError(getApiErrorMessage(requestError, 'Unable to load team members right now.'));
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, search]);

    React.useEffect(() => {
        const timeoutId = window.setTimeout(loadUsers, 250);
        return () => window.clearTimeout(timeoutId);
    }, [loadUsers]);

    const loadBusinesses = React.useCallback(async () => {
        if (!isSuperAdmin) {
            setBusinesses([]);
            return;
        }

        try {
            const response = await api.get<BusinessOption[]>('/users/businesses');
            setBusinesses(response.data || []);
        } catch {
            setBusinesses([]);
        }
    }, [isSuperAdmin]);

    React.useEffect(() => {
        loadBusinesses();
    }, [loadBusinesses]);

    const handleStatusChange = async (target: User, updates: { isActive?: boolean; isVisible?: boolean; installmentAccess?: boolean }) => {
        setSavingId(target.id);
        try {
            await api.patch(`/users/${target.id}/status`, updates);
            await loadUsers();
            setSnack('Account updated successfully.');
        } catch (requestError: unknown) {
            setError(getApiErrorMessage(requestError, 'Unable to update this account.'));
        } finally {
            setSavingId('');
        }
    };

    const openEditDialog = (target: User) => {
        setShowPassword(false);
        setEditingUser(target);
        setDraft({
            name: target.name,
            email: target.email,
            password: target.visiblePassword || '',
            role: target.role,
            businessId: target.businessId || '',
            userCreationLimit: String(target.userCreationLimit ?? 0),
        });
    };

    const openCreateDialog = () => {
        setShowCreatePassword(false);
        setCreateDraft({
            name: '',
            email: '',
            password: '',
            role: isSuperAdmin ? 'admin' : 'user',
            businessId: '',
            businessName: '',
        });
        setCreateDialogOpen(true);
    };

    const createAccount = async (event: React.FormEvent) => {
        event.preventDefault();
        setCreateSaving(true);
        setError('');

        try {
            await api.post('/auth/register', {
                name: createDraft.name,
                email: createDraft.email,
                password: createDraft.password,
                role: createDraft.role,
                businessId: isSuperAdmin && createDraft.businessId !== '__new__' ? createDraft.businessId : undefined,
                businessName: isSuperAdmin && createDraft.businessId === '__new__' ? createDraft.businessName : undefined,
            });
            setCreateDialogOpen(false);
            await loadUsers();
            await loadBusinesses();
            window.dispatchEvent(new Event('itemhive-team-updated'));
            setSnack('Account created successfully.');
        } catch (requestError: unknown) {
            setError(getApiErrorMessage(requestError, 'Unable to create this account.'));
        } finally {
            setCreateSaving(false);
        }
    };

    const saveAccount = async () => {
        if (!editingUser) return;

        setSavingId(editingUser.id);
        try {
            await api.patch(`/users/${editingUser.id}/account`, {
                name: draft.name,
                email: draft.email,
                password: draft.password,
                role: draft.role,
                businessId: draft.businessId,
            });
            if (draft.role === 'admin') {
                await api.patch(`/users/${editingUser.id}/limit`, {
                    userCreationLimit: Number(draft.userCreationLimit || 0),
                });
            }
            setEditingUser(null);
            await loadUsers();
            window.dispatchEvent(new Event('itemhive-team-updated'));
            setSnack('Account details updated successfully.');
        } catch (requestError: unknown) {
            setError(getApiErrorMessage(requestError, 'Unable to update this account.'));
        } finally {
            setSavingId('');
        }
    };

    const deleteAccount = async () => {
        if (!deletingUser) return;

        setDeleteSaving(true);
        setError('');

        try {
            await api.delete(`/users/${deletingUser.id}`);
            setDeletingUser(null);
            await loadUsers();
            window.dispatchEvent(new Event('itemhive-team-updated'));
            setSnack('Account deleted successfully.');
        } catch (requestError: unknown) {
            setError(getApiErrorMessage(requestError, 'Unable to delete this account.'));
        } finally {
            setDeleteSaving(false);
        }
    };

    return (
        <Box>
            <Snackbar open={Boolean(snack)} autoHideDuration={2600} onClose={() => setSnack('')} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
                <Alert onClose={() => setSnack('')} severity="success" sx={{ width: '100%' }}>{snack}</Alert>
            </Snackbar>

            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h4" fontWeight={800}>Team Management</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {isSuperAdmin
                            ? 'Search and manage shop accounts from one scalable grid.'
                            : `You can create users up to your assigned limit of ${currentUser?.userCreationLimit ?? 0}.`}
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<UserPlus size={18} />} onClick={openCreateDialog} sx={{ borderRadius: 2, fontWeight: 800 }}>
                    {isSuperAdmin ? 'Create Account' : 'Add User'}
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

            <TextField
                fullWidth
                size="small"
                type="search"
                name="team-account-search"
                autoComplete="off"
                value={search}
                onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(0);
                }}
                placeholder="Search by name, login email, or role"
                InputProps={{ startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> }}
                sx={{ mb: 2, maxWidth: 560 }}
            />

            <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                <Table size="small" sx={{ minWidth: 1060 }}>
                    <TableHead>
                        <TableRow>
                            <TableCell>Account</TableCell>
                            <TableCell>Business</TableCell>
                            <TableCell>Role</TableCell>
                            <TableCell align="center">Active</TableCell>
                            <TableCell align="center">Visible</TableCell>
                            <TableCell align="center">Installments</TableCell>
                            <TableCell align="center">User Limit</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={8} align="center" sx={{ py: 8 }}><CircularProgress size={30} /></TableCell>
                            </TableRow>
                        )}
                        {!loading && users.map((teamUser) => {
                            const isBusy = savingId === teamUser.id;
                            const isManageable = isSuperAdmin && teamUser.role !== 'super_admin';
                            const canDelete = teamUser.id !== currentUser?.id && (
                                isSuperAdmin
                                    ? teamUser.role !== 'super_admin'
                                    : teamUser.role === 'user'
                            );
                            return (
                                <TableRow key={teamUser.id} hover>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={800}>{teamUser.name}</Typography>
                                        <Typography variant="caption" color="text.secondary">{teamUser.email}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={800}>{teamUser.businessName || '-'}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip icon={<ShieldCheck size={14} />} label={roleLabel(teamUser.role)} color={teamUser.role === 'user' ? 'default' : 'primary'} size="small" />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Switch size="small" checked={Boolean(teamUser.isActive)} disabled={!isManageable || isBusy} onChange={(_, checked) => handleStatusChange(teamUser, { isActive: checked })} />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Switch size="small" checked={Boolean(teamUser.isVisible)} disabled={!isManageable || isBusy} onChange={(_, checked) => handleStatusChange(teamUser, { isVisible: checked })} />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Switch size="small" checked={Boolean(teamUser.installmentAccess)} disabled={!isManageable || isBusy} onChange={(_, checked) => handleStatusChange(teamUser, { installmentAccess: checked })} />
                                    </TableCell>
                                    <TableCell align="center">{teamUser.role === 'admin' ? teamUser.userCreationLimit ?? 0 : '-'}</TableCell>
                                    <TableCell align="right">
                                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                                            {isManageable && (
                                                <Button size="small" variant="outlined" startIcon={<Edit3 size={15} />} onClick={() => openEditDialog(teamUser)} disabled={isBusy}>
                                                    Edit
                                                </Button>
                                            )}
                                            {canDelete && (
                                                <Button
                                                    size="small"
                                                    color="error"
                                                    variant="outlined"
                                                    startIcon={<Trash2 size={15} />}
                                                    onClick={() => setDeletingUser(teamUser)}
                                                    disabled={deleteSaving}
                                                >
                                                    Delete
                                                </Button>
                                            )}
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {!loading && !users.length && (
                            <TableRow>
                                <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                                    <Users size={34} style={{ opacity: 0.45, marginBottom: 8 }} />
                                    <Typography variant="body2" color="text.secondary">No matching accounts found.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
                <TablePagination
                    component="div"
                    count={total}
                    page={page}
                    onPageChange={(_, nextPage) => setPage(nextPage)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(event) => {
                        setRowsPerPage(Number(event.target.value));
                        setPage(0);
                    }}
                    rowsPerPageOptions={[10, 20, 50, 100]}
                />
            </TableContainer>

            <Dialog open={createDialogOpen} onClose={() => !createSaving && setCreateDialogOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>{isSuperAdmin ? 'Create Account' : 'Add User'}</DialogTitle>
                <Box component="form" onSubmit={createAccount}>
                    <DialogContent>
                        <Stack spacing={2} sx={{ pt: 1 }}>
                            <TextField
                                label="Full Name"
                                name="new-account-name"
                                autoComplete="off"
                                value={createDraft.name}
                                onChange={(event) => setCreateDraft({ ...createDraft, name: event.target.value })}
                                required
                                disabled={createSaving}
                            />
                            <TextField
                                label="Login Email / ID"
                                name="new-account-email"
                                type="email"
                                autoComplete="off"
                                value={createDraft.email}
                                onChange={(event) => setCreateDraft({ ...createDraft, email: event.target.value })}
                                required
                                disabled={createSaving}
                            />
                            <TextField
                                select
                                label="Role"
                                value={createDraft.role}
                                onChange={(event) => setCreateDraft({ ...createDraft, role: event.target.value as UserRole, businessId: '' })}
                                required
                                disabled={createSaving || !isSuperAdmin}
                            >
                                {isSuperAdmin && <MenuItem value="admin">Administrator</MenuItem>}
                                {isSuperAdmin && <MenuItem value="super_admin">Super Admin</MenuItem>}
                                <MenuItem value="user">User</MenuItem>
                            </TextField>
                            {isSuperAdmin && createDraft.role !== 'super_admin' && (
                                <TextField
                                    select
                                    label="Business"
                                    value={createDraft.businessId}
                                    onChange={(event) => setCreateDraft({ ...createDraft, businessId: event.target.value })}
                                    helperText="Choose which shop/workspace this account belongs to."
                                    required
                                    disabled={createSaving}
                                >
                                    {createDraft.role === 'admin' && <MenuItem value="__new__">Create new business</MenuItem>}
                                    {businesses.map((business) => (
                                        <MenuItem key={business.id} value={business.id}>
                                            {business.name}{business.isLegacy ? ' (Default)' : ''}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            )}
                            {isSuperAdmin && createDraft.businessId === '__new__' && (
                                <TextField
                                    label="Shop Name"
                                    name="new-account-shop"
                                    autoComplete="off"
                                    value={createDraft.businessName}
                                    onChange={(event) => setCreateDraft({ ...createDraft, businessName: event.target.value })}
                                    helperText="A separate workspace will be created for this shop."
                                    required
                                    disabled={createSaving}
                                />
                            )}
                            <TextField
                                label="Password"
                                name="new-account-password"
                                type={showCreatePassword ? 'text' : 'password'}
                                autoComplete="new-password"
                                value={createDraft.password}
                                onChange={(event) => setCreateDraft({ ...createDraft, password: event.target.value })}
                                required
                                disabled={createSaving}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                onClick={() => setShowCreatePassword((visible) => !visible)}
                                                edge="end"
                                                size="small"
                                                aria-label={showCreatePassword ? 'Hide password' : 'Show password'}
                                            >
                                                {showCreatePassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setCreateDialogOpen(false)} disabled={createSaving}>Cancel</Button>
                        <Button type="submit" variant="contained" disabled={createSaving}>
                            {createSaving ? 'Creating...' : 'Create Account'}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            <Dialog open={Boolean(editingUser)} onClose={() => setEditingUser(null)} fullWidth maxWidth="sm">
                <DialogTitle>Edit Account</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        <TextField label="Full Name" name="account-name" autoComplete="off" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
                        <TextField label="Login Email / ID" name="account-email" type="email" autoComplete="off" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} required />
                        <TextField
                            select
                            label="Role"
                            value={draft.role}
                            onChange={(event) => setDraft({ ...draft, role: event.target.value as UserRole })}
                            required
                        >
                            <MenuItem value="super_admin">Super Admin</MenuItem>
                            <MenuItem value="admin">Administrator</MenuItem>
                            <MenuItem value="user">User</MenuItem>
                        </TextField>
                        {draft.role !== 'super_admin' && (
                            <TextField
                                select
                                label="Business"
                                value={draft.businessId}
                                onChange={(event) => setDraft({ ...draft, businessId: event.target.value })}
                                helperText="Move this account to an existing shop/workspace."
                                required
                            >
                                {businesses.map((business) => (
                                    <MenuItem key={business.id} value={business.id}>
                                        {business.name}{business.isLegacy ? ' (Default)' : ''}
                                    </MenuItem>
                                ))}
                            </TextField>
                        )}
                        <TextField
                            label="Password"
                            name="new-password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            value={draft.password}
                            onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                            helperText={editingUser?.visiblePassword ? 'Use the eye icon to view or update this password.' : 'Old password is not available. Enter a new password to reset it.'}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={() => setShowPassword((visible) => !visible)}
                                            edge="end"
                                            size="small"
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                        {draft.role === 'admin' && (
                            <TextField label="User Creation Limit" type="number" value={draft.userCreationLimit} onChange={(event) => setDraft({ ...draft, userCreationLimit: event.target.value })} inputProps={{ min: 0 }} />
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditingUser(null)}>Cancel</Button>
                    <Button variant="contained" onClick={saveAccount} disabled={savingId === editingUser?.id}>Save Changes</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(deletingUser)} onClose={() => !deleteSaving && setDeletingUser(null)} fullWidth maxWidth="xs">
                <DialogTitle>Delete Account</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary">
                        Delete {deletingUser?.name}? This account will no longer be able to log in.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeletingUser(null)} disabled={deleteSaving}>Cancel</Button>
                    <Button color="error" variant="contained" onClick={deleteAccount} disabled={deleteSaving}>
                        {deleteSaving ? 'Deleting...' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default TeamManagementPage;
