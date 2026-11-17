/**
 * YouTube URL parsing and normalisation. Keeping this pure means the same
 * rules run in the form, the server action and the unit tests.
 */

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export type YouTubeInfo = {
  id: string;
  /** Canonical watch URL stored in `resources.external_url`. */
  url: string;
  /** Canonical thumbnail stored in `resources.thumbnail_url`. */
  thumbnailUrl: string;
  /** Privacy-enhanced embed used by the viewers. */
  embedUrl: string;
};

function validId(value: string | null | undefined): string | null {
  const candidate = value?.trim();

  if (!candidate || !VIDEO_ID_PATTERN.test(candidate)) {
    return null;
  }

  return candidate;
}

/**
 * Accepts a bare 11-character ID or a youtube.com / youtu.be / nocookie link
 * (watch, embed, shorts, live). Playlists and channel links are rejected
 * because they do not identify a single video.
 */
export function parseYouTubeInput(raw: string | null | undefined): YouTubeInfo | null {
  const value = raw?.trim();

  if (!value) {
    return null;
  }

  const bareId = validId(value);

  if (bareId) {
    return buildYouTubeInfo(bareId);
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }

  const host = url.hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/^m\./, "");

  if (host === "youtu.be") {
    const id = validId(url.pathname.split("/").filter(Boolean)[0]);
    return id ? buildYouTubeInfo(id) : null;
  }

  const youtubeHosts = [
    "youtube.com",
    "music.youtube.com",
    "youtube-nocookie.com",
  ];

  if (!youtubeHosts.includes(host)) {
    return null;
  }

  if (url.pathname === "/watch") {
    const id = validId(url.searchParams.get("v"));
    return id ? buildYouTubeInfo(id) : null;
  }

  const match = url.pathname.match(
    /^\/(?:embed|shorts|live|v)\/([^/?#]+)/,
  );
  const id = validId(match?.[1]);

  return id ? buildYouTubeInfo(id) : null;
}

export function buildYouTubeInfo(id: string): YouTubeInfo {
  return {
    id,
    url: `https://www.youtube.com/watch?v=${id}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`,
  };
}

/** Extracts the ID from a stored canonical URL, if one is present. */
export function youtubeIdFromUrl(raw: string | null | undefined): string | null {
  return parseYouTubeInput(raw)?.id ?? null;
}
