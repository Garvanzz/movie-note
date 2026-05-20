import { invoke } from "./invoke";
import type { MovieCover, MovieScreenshot, ActorImage } from "@/types/image";

// ── Movie Covers ──

export function getMovieCovers(code: string): Promise<MovieCover[]> {
  return invoke("get_movie_covers", { code });
}

export function addMovieCover(
  code: string,
  filePath: string,
  setPrimary?: boolean,
): Promise<MovieCover> {
  return invoke("add_movie_cover", { code, filePath, setPrimary });
}

export function addMovieCoverFromUrl(
  code: string,
  url: string,
  setPrimary?: boolean,
): Promise<MovieCover> {
  return invoke("add_movie_cover_from_url", { code, url, setPrimary });
}

export function removeMovieCover(code: string, coverId: number): Promise<void> {
  return invoke("remove_movie_cover", { code, coverId });
}

export function setMoviePrimaryCover(code: string, coverId: number): Promise<void> {
  return invoke("set_movie_primary_cover", { code, coverId });
}

// ── Movie Screenshots ──

export function getMovieScreenshots(code: string): Promise<MovieScreenshot[]> {
  return invoke("get_movie_screenshots", { code });
}

export function addMovieScreenshot(code: string, filePath: string): Promise<MovieScreenshot> {
  return invoke("add_movie_screenshot", { code, filePath });
}

export function addMovieScreenshotFromUrl(code: string, url: string): Promise<MovieScreenshot> {
  return invoke("add_movie_screenshot_from_url", { code, url });
}

export function removeMovieScreenshot(screenshotId: number): Promise<void> {
  return invoke("remove_movie_screenshot", { screenshotId });
}

// ── Actor Avatar ──

export function setActorAvatar(actorId: number, filePath: string): Promise<string> {
  return invoke("set_actor_avatar", { actorId, filePath });
}

export function setActorAvatarFromUrl(actorId: number, url: string): Promise<string> {
  return invoke("set_actor_avatar_from_url", { actorId, url });
}

export function setActorAvatarFromImage(actorId: number, imageId: number): Promise<string> {
  return invoke("set_actor_avatar_from_image", { actorId, imageId });
}

export function removeActorAvatar(actorId: number): Promise<void> {
  return invoke("remove_actor_avatar", { actorId });
}

// ── Actor Images ──

export function getActorImages(actorId: number): Promise<ActorImage[]> {
  return invoke("get_actor_images", { actorId });
}

export function addActorImage(actorId: number, filePath: string): Promise<ActorImage> {
  return invoke("add_actor_image", { actorId, filePath });
}

export function addActorImageFromUrl(actorId: number, url: string): Promise<ActorImage> {
  return invoke("add_actor_image_from_url", { actorId, url });
}

export function removeActorImage(imageId: number): Promise<void> {
  return invoke("remove_actor_image", { imageId });
}

// ── Paste / bytes ──

export interface SavedImage {
  id: number;
  image_path: string;
}

export function saveImageBytes(
  imageType: "movie_screenshot" | "actor_image" | "movie_cover" | "actor_avatar",
  owner: string,
  bytes: number[],
  filename: string,
): Promise<SavedImage> {
  return invoke("save_image_bytes", { imageType, owner, bytes, filename });
}

// ── Scraper ──

export function scraperDownloadImages(
  code: string,
  coverUrl: string | null,
  screenshots: string[],
): Promise<void> {
  return invoke("scraper_download_images", { code, coverUrl, screenshots });
}
