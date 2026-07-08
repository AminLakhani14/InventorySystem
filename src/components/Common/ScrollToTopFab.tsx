import React, { useEffect, useState } from 'react';
import { Fab, Zoom } from '@mui/material';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

const ScrollToTopFab: React.FC = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const onScroll = () => {
            setVisible(window.scrollY > 320);
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const handleScrollTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <Zoom in={visible}>
            <Fab
                color="primary"
                size="medium"
                aria-label="scroll back to top"
                onClick={handleScrollTop}
                sx={{
                    position: 'fixed',
                    right: { xs: 16, sm: 24 },
                    bottom: { xs: 16, sm: 24 },
                    zIndex: (theme) => theme.zIndex.drawer + 2,
                    boxShadow: (theme) => `0 10px 22px -10px ${theme.palette.primary.main}`,
                }}
            >
                <KeyboardArrowUpIcon />
            </Fab>
        </Zoom>
    );
};

export default ScrollToTopFab;
