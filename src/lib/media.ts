import imageData from '../content/media.json';
import videoData from '../content/videos.json';

export type ImageKey = keyof typeof imageData;
export type VideoKey = keyof typeof videoData;
export interface Artwork {
  src: string;
  width: number;
  height: number;
  variants: { src: string; width: number }[];
  animated?: string;
}
export const images: Record<ImageKey, Artwork> = imageData;
export const videos = videoData;
