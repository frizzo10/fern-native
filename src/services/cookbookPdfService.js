// Print-ready cookbook PDF. The server (web repo: cookbook-pdf-background) reads the cookbook from the share link the
// caller just made, builds the PDF and saves it; we poll scan-circular-status (same job table as the flyer scan).
// -> { url, pages, trim, color, photos, recipes, bytes }
const FUNCTIONS_BASE = 'https://app.clickpickandcook.com/.netlify/functions';

function newUuid() {
    // scan_jobs.job_id is a Postgres uuid column.
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.floor(Math.random() * 16);
        return (c === 'x' ? r : (r % 4) + 8).toString(16);
    });
}

export async function buildCookbookPdf({ shareId, token, author, trim = '8x10' }) {
    const jobId = newUuid();
    const started = await fetch(`${FUNCTIONS_BASE}/cookbook-pdf-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
        body: JSON.stringify({ jobId, shareId, token, author: String(author || ''), trim }),
    });
    if (!started.ok && started.status !== 202) throw new Error(`pdf start failed (${started.status})`);

    const t0 = Date.now();
    let misses = 0;
    while (Date.now() - t0 < 160000) {
        await new Promise((r) => setTimeout(r, 3000));
        let st;
        try {
            const r = await fetch(`${FUNCTIONS_BASE}/scan-circular-status?jobId=${encodeURIComponent(jobId)}`);
            if (!r.ok) continue;
            st = await r.json();
        } catch (e) {
            continue;
        }
        if (st?.status === 'done' && st.result?.url) return st.result;
        if (st?.status === 'error') throw new Error(st.error || 'pdf failed');
        if (st?.status === 'not_found' && ++misses > 15) throw new Error('pdf job never started');
    }
    throw new Error('pdf took too long');
}
