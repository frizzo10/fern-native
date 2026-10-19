// Asks the backend for this user's private calendar subscription link (activities + planned meals as an
// iCalendar feed that Apple / Google / Outlook calendars can subscribe to). Read-only, one way.
const URL_ = 'https://app.clickpickandcook.com/.netlify/functions/calendar-link';

export async function fetchCalendarLink(token) {
    const res = await fetch(URL_, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
        body: JSON.stringify({ token }),
    });
    if (!res.ok) throw new Error(`calendar link failed: ${res.status}`);
    const d = await res.json();
    if (!d?.url) throw new Error('calendar link missing');
    return { url: d.url, webcal: d.webcal || d.url.replace(/^https?:/, 'webcal:') };
}
