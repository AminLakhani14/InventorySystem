import React from 'react';
import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    TextField,
    Button,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Stack,
    Chip,
    Tooltip,
    Divider,
    Alert,
    CircularProgress
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Pin, Trash2, Edit3, Plus } from 'lucide-react';
import api from '../../api/axios';

type StickyNote = {
    _id: string;
    title: string;
    body: string;
    color: string;
    pinned: boolean;
    updatedAt: string;
    createdAt: string;
};

const COLOR_OPTIONS = [
    { label: 'Lemon', value: '#FDE68A' },
    { label: 'Mint', value: '#A7F3D0' },
    { label: 'Sky', value: '#BFDBFE' },
    { label: 'Peach', value: '#FBCFE8' },
    { label: 'Lavender', value: '#DDD6FE' },
];

const StickyNotes: React.FC = () => {
    const theme = useTheme();
    const [notes, setNotes] = React.useState<StickyNote[]>([]);
    const [title, setTitle] = React.useState('');
    const [body, setBody] = React.useState('');
    const [color, setColor] = React.useState(COLOR_OPTIONS[0].value);
    const [editing, setEditing] = React.useState<StickyNote | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState('');

    const loadNotes = React.useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await api.get('/notes');
            setNotes(response.data || []);
        } catch (fetchError: any) {
            setError(fetchError.response?.data?.message || 'Unable to load sticky notes.');
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadNotes();
    }, [loadNotes]);

    const sortedNotes = React.useMemo(() => {
        return [...notes].sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
    }, [notes]);

    const handleAdd = async () => {
        if (!title.trim() && !body.trim()) return;
        setSaving(true);
        setError('');
        try {
            const response = await api.post('/notes', {
                title: title.trim(),
                body: body.trim(),
                color,
            });
            setNotes(prev => [response.data, ...prev]);
            setTitle('');
            setBody('');
            setColor(COLOR_OPTIONS[0].value);
        } catch (saveError: any) {
            setError(saveError.response?.data?.message || 'Unable to save note.');
        } finally {
            setSaving(false);
        }
    };

    const handleTogglePin = async (note: StickyNote) => {
        setSaving(true);
        setError('');
        try {
            const response = await api.patch(`/notes/${note._id}`, { pinned: !note.pinned });
            setNotes(prev => prev.map(item => (item._id === note._id ? response.data : item)));
        } catch (saveError: any) {
            setError(saveError.response?.data?.message || 'Unable to update note.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        setSaving(true);
        setError('');
        try {
            await api.delete(`/notes/${id}`);
            setNotes(prev => prev.filter(note => note._id !== id));
        } catch (deleteError: any) {
            setError(deleteError.response?.data?.message || 'Unable to delete note.');
        } finally {
            setSaving(false);
        }
    };

    const handleEditSave = async () => {
        if (!editing) return;
        setSaving(true);
        setError('');
        try {
            const response = await api.patch(`/notes/${editing._id}`, {
                title: editing.title.trim(),
                body: editing.body.trim(),
                color: editing.color,
            });
            setNotes(prev => prev.map(note => (note._id === editing._id ? response.data : note)));
            setEditing(null);
        } catch (saveError: any) {
            setError(saveError.response?.data?.message || 'Unable to update note.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight={800}>Sticky Notes</Typography>
                <Typography variant="body2" color="text.secondary">
                    Quick notes for reminders, supplier calls, or urgent tasks.
                </Typography>
            </Box>

            <Card sx={{ borderRadius: 4, mb: 4, overflow: 'hidden' }}>
                <CardContent>
                    <Typography variant="h6" fontWeight={800} gutterBottom>
                        Add a Note
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <TextField
                                fullWidth
                                label="Title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 8 }}>
                            <TextField
                                fullWidth
                                label="Note"
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                multiline
                                rows={2}
                            />
                        </Grid>
                        <Grid size={12}>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                {COLOR_OPTIONS.map((option) => (
                                    <Chip
                                        key={option.value}
                                        label={option.label}
                                        onClick={() => setColor(option.value)}
                                        sx={{
                                            bgcolor: alpha(option.value, 0.7),
                                            border: color === option.value ? '2px solid' : '1px solid',
                                            borderColor: color === option.value ? theme.palette.primary.main : 'divider',
                                            fontWeight: 700
                                        }}
                                    />
                                ))}
                                <Box sx={{ flexGrow: 1 }} />
                                <Button
                                    variant="contained"
                                    startIcon={<Plus size={18} />}
                                    onClick={handleAdd}
                                    disabled={saving}
                                    sx={{ borderRadius: 2, fontWeight: 800 }}
                                >
                                    Add Note
                                </Button>
                            </Stack>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress />
                </Box>
            ) : sortedNotes.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                    No notes yet. Add your first sticky note above.
                </Box>
            ) : (
                <Grid container spacing={3}>
                    {sortedNotes.map((note) => (
                        <Grid key={note._id} size={{ xs: 12, sm: 6, md: 4 }}>
                            <Card
                                sx={{
                                    borderRadius: 4,
                                    height: '100%',
                                    bgcolor: alpha(note.color, 0.65),
                                    border: '1px solid',
                                    borderColor: alpha(note.color, 0.8),
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                            >
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                        <Typography variant="h6" fontWeight={900}>
                                            {note.title}
                                        </Typography>
                                        <Tooltip title={note.pinned ? 'Unpin' : 'Pin'}>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleTogglePin(note)}
                                                disabled={saving}
                                                sx={{
                                                    bgcolor: note.pinned ? alpha(theme.palette.primary.main, 0.2) : 'transparent',
                                                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) }
                                                }}
                                            >
                                                <Pin size={18} />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>
                                        {note.body || '-'}
                                    </Typography>
                                    <Divider sx={{ mb: 1.5, borderColor: alpha('#000', 0.08) }} />
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography variant="caption" color="text.secondary">
                                            Updated: {new Date(note.updatedAt).toLocaleString()}
                                        </Typography>
                                        <Box>
                                            <IconButton size="small" onClick={() => setEditing(note)} disabled={saving}>
                                                <Edit3 size={16} />
                                            </IconButton>
                                            <IconButton size="small" onClick={() => handleDelete(note._id)} disabled={saving}>
                                                <Trash2 size={16} />
                                            </IconButton>
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: 800 }}>Edit Note</DialogTitle>
                <DialogContent>
                    {editing && (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <TextField
                                fullWidth
                                label="Title"
                                value={editing.title}
                                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                            />
                            <TextField
                                fullWidth
                                label="Note"
                                value={editing.body}
                                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                                multiline
                                rows={4}
                            />
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                                {COLOR_OPTIONS.map((option) => (
                                    <Chip
                                        key={option.value}
                                        label={option.label}
                                        onClick={() => setEditing({ ...editing, color: option.value })}
                                        sx={{
                                            bgcolor: alpha(option.value, 0.7),
                                            border: editing.color === option.value ? '2px solid' : '1px solid',
                                            borderColor: editing.color === option.value ? theme.palette.primary.main : 'divider',
                                            fontWeight: 700
                                        }}
                                    />
                                ))}
                            </Stack>
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button variant="outlined" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
                    <Button variant="contained" onClick={handleEditSave} disabled={saving}>Save</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default StickyNotes;
