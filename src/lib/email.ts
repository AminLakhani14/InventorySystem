export const sendInventoryCsv = async (csv: string) => {
    const endpoint = import.meta.env.VITE_EMAIL_FUNCTION_URL as string | undefined;
    if (!endpoint) {
        throw new Error('Missing VITE_EMAIL_FUNCTION_URL');
    }

    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to send email');
    }
};
