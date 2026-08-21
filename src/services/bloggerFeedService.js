import { logApiResponse } from '../utils/apiLogger';

// How many posts to ask the backend for per blogger. The backend example
// response returned exactly this many items for a single blogger, so it
// appears to double as a per-blogger limit.
const ITEMS_PER_BLOGGER = 5;

function normalizeFeedItem(item) {
  return {
    title: item?.title || '',
    url: item?.url || '',
    description: item?.description || '',
    pubDate: item?.pubDate || '',
    thumbnail: item?.thumbnail || '',
  };
}

function normalizeFeed(feed) {
  return {
    bloggerId: feed?.bloggerId || '',
    bloggerName: feed?.bloggerName || '',
    bloggerEmoji: feed?.bloggerEmoji || '',
    bloggerColor: feed?.bloggerColor || '',
    items: Array.isArray(feed?.items) ? feed.items.map(normalizeFeedItem) : [],
  };
}

// `bloggers` is an array of the same { id, url, name, color, emoji, specialty }
// shape used throughout SearchScreen.js's followed-blogger state.
export async function fetchBloggerFeeds(bloggers) {
  const payload = {
    bloggers: (Array.isArray(bloggers) ? bloggers : []).map((b) => ({
      id: b.id,
      url: b.url,
      name: b.name,
      color: b.color,
      emoji: b.emoji,
      specialty: b.specialty,
    })),
    count: ITEMS_PER_BLOGGER,
  };

  const res = await fetch('https://app.clickpickandcook.com/.netlify/functions/blogger-feed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'FernApp/1.0 (myaifern.com)',
    },
    body: JSON.stringify(payload),
  });

  const responseJson = await res.json();
  logApiResponse('blogger-feed', responseJson);

  const feeds = Array.isArray(responseJson?.feeds) ? responseJson.feeds.map(normalizeFeed) : [];
  return feeds;
}
