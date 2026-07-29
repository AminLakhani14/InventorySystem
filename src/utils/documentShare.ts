// Print and share helpers shared by the printable business documents.

export const escapeHtml = (value: unknown) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

/**
 * Opens a throwaway window holding the document markup and sends it to the printer.
 * Returns false when the browser blocked the pop-up so the caller can tell the user why
 * nothing happened.
 */
export const printHtmlDocument = (html: string) => {
    const printWindow = window.open('', '_blank', 'width=980,height=760');
    if (!printWindow) return false;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 300);
    return true;
};

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * Shares the document as a real PDF attachment where the browser supports file sharing
 * (Android/iOS share sheets, WhatsApp included), and degrades to sharing the text, then to
 * copying it, on desktop browsers that do not.
 */
export const shareDocument = async (options: {
    title: string;
    text: string;
    file?: { blob: Blob; name: string };
}): Promise<ShareOutcome> => {
    const { title, text, file } = options;

    if (file && typeof navigator.canShare === 'function' && navigator.share) {
        const pdfFile = new File([file.blob], file.name, { type: 'application/pdf' });
        if (navigator.canShare({ files: [pdfFile] })) {
            try {
                await navigator.share({ title, text, files: [pdfFile] });
                return 'shared';
            } catch (error) {
                return (error as Error)?.name === 'AbortError' ? 'cancelled' : 'failed';
            }
        }
    }

    if (navigator.share) {
        try {
            await navigator.share({ title, text });
            return 'shared';
        } catch (error) {
            if ((error as Error)?.name === 'AbortError') return 'cancelled';
        }
    }

    try {
        await navigator.clipboard.writeText(text);
        return 'copied';
    } catch {
        return 'failed';
    }
};
