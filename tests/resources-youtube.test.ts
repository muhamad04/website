import { describe, expect, it } from "vitest";
import {
  buildYouTubeInfo,
  parseYouTubeInput,
  youtubeIdFromUrl,
} from "@/lib/resources/youtube";

const VIDEO_ID = "dQw4w9WgXcQ";

describe("YouTube links", () => {
  it("accepts a bare 11-character video id", () => {
    const info = parseYouTubeInput(VIDEO_ID);

    expect(info?.id).toBe(VIDEO_ID);
    expect(info?.url).toBe(`https://www.youtube.com/watch?v=${VIDEO_ID}`);
  });

  it("normalises a standard watch link and ignores extra parameters", () => {
    const info = parseYouTubeInput(
      `https://www.youtube.com/watch?v=${VIDEO_ID}&list=PL123&t=42s`,
    );

    expect(info).toEqual(buildYouTubeInfo(VIDEO_ID));
  });

  it("accepts short, mobile, music and nocookie hosts", () => {
    for (const url of [
      `https://youtu.be/${VIDEO_ID}`,
      `https://m.youtube.com/watch?v=${VIDEO_ID}`,
      `https://music.youtube.com/watch?v=${VIDEO_ID}`,
      `https://www.youtube-nocookie.com/embed/${VIDEO_ID}`,
    ]) {
      expect(parseYouTubeInput(url)?.id, url).toBe(VIDEO_ID);
    }
  });

  it("accepts embed, shorts, live and /v/ paths", () => {
    for (const path of [
      `embed/${VIDEO_ID}`,
      `shorts/${VIDEO_ID}`,
      `live/${VIDEO_ID}`,
      `v/${VIDEO_ID}`,
    ]) {
      expect(parseYouTubeInput(`https://www.youtube.com/${path}`)?.id).toBe(
        VIDEO_ID,
      );
    }
  });

  it("trims surrounding whitespace from pasted links", () => {
    expect(parseYouTubeInput(`  ${VIDEO_ID}  `)?.id).toBe(VIDEO_ID);
  });

  it("rejects playlists, channels, other hosts and empty input", () => {
    for (const value of [
      "",
      "   ",
      null,
      undefined,
      "https://www.youtube.com/playlist?list=PL123",
      "https://www.youtube.com/@somechannel",
      "https://vimeo.com/123456",
      `ftp://youtube.com/watch?v=${VIDEO_ID}`,
      `https://example.com/watch?v=${VIDEO_ID}`,
      "javascript:alert(1)",
    ]) {
      expect(parseYouTubeInput(value), String(value)).toBeNull();
    }
  });

  it("rejects ids that are not exactly 11 valid characters", () => {
    for (const value of [
      "short",
      "dQw4w9WgXc",
      "dQw4w9WgXcQQ",
      "dQw4w9WgXc!",
      "https://youtu.be/",
    ]) {
      expect(parseYouTubeInput(value), value).toBeNull();
    }
  });

  it("builds a privacy-enhanced embed and canonical thumbnail", () => {
    const info = buildYouTubeInfo(VIDEO_ID);

    expect(info.embedUrl).toBe(
      `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?rel=0&modestbranding=1`,
    );
    expect(info.thumbnailUrl).toBe(
      `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`,
    );
  });

  it("extracts the id from a stored canonical URL", () => {
    expect(youtubeIdFromUrl(`https://www.youtube.com/watch?v=${VIDEO_ID}`)).toBe(
      VIDEO_ID,
    );
    expect(youtubeIdFromUrl("https://vimeo.com/123")).toBeNull();
    expect(youtubeIdFromUrl(null)).toBeNull();
  });
});
