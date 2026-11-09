const YT_API_KEY = process.env.YOUTUBE_API_KEY;
const YT_BASE = 'https://www.googleapis.com/youtube/v3';

if (!YT_API_KEY) {
    console.warn('YOUTUBE_API_KEY is not set — video metadata fetches will fail.');
}

// Accepts watch, youtu.be, embed, shorts, and bare-ID forms
function extractVideoId(input) {
    if (!input) return null;
    const trimmed = input.trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;

    const patterns = [
        /(?:youtube\.com\/watch\?.*v=)([A-Za-z0-9_-]{11})/,
        /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
        /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
        /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    ];
    for (const p of patterns) {
        const m = trimmed.match(p);
        if (m) return m[1];
    }
    return null;
}

// ISO 8601 duration → seconds  (PT1H2M3S → 3723)
function parseDuration(iso) {
    if (!iso) return null;
    const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    if (!m) return null;
    const [, h = 0, min = 0, s = 0] = m;
    return Number(h) * 3600 + Number(min) * 60 + Number(s);
}

async function fetchVideoMetadata(videoId) {
    const url = `${YT_BASE}/videos?part=snippet,contentDetails&id=${videoId}&key=${YT_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`YouTube API ${res.status}: ${body}`);
    }
    const json = await res.json();
    if (!json.items || json.items.length === 0) {
        throw new Error('Video not found or unavailable on YouTube');
    }

    const item = json.items[0];
    const sn = item.snippet;
    const cd = item.contentDetails;

    return {
        youtube_id: item.id,
        channel_id: sn.channelId || null,
        channel_name: sn.channelTitle || 'Unknown channel',
        title: sn.title || 'Untitled',
        thumbnail_url:
            sn.thumbnails?.maxres?.url ||
            sn.thumbnails?.high?.url ||
            sn.thumbnails?.medium?.url ||
            sn.thumbnails?.default?.url ||
            null,
        duration_seconds: parseDuration(cd?.duration),
        published_at: sn.publishedAt || null,
    };
}

module.exports = { extractVideoId, fetchVideoMetadata, parseDuration };