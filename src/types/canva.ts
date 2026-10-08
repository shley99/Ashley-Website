export interface CanvaNodeLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface CanvaContinuousMotion {
  duration: number;
  interval: number;
  frames: [number, number, number][];
}

export interface CanvaNodeBase {
  id: string;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  mobile: CanvaNodeLayout;
  entrance?: 'spring';
  continuousMotion?: CanvaContinuousMotion;
}

export interface CanvaCrop {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface CanvaImageNode extends CanvaNodeBase {
  type: 'image' | 'animation';
  role?: string;
  src: string;
  animated?: string;
  crop: CanvaCrop;
  mobileCrop: CanvaCrop;
}

export interface CanvaVideoNode extends CanvaNodeBase {
  type: 'video';
  role: string;
  video: string;
  crop: CanvaCrop;
  mobileCrop: CanvaCrop;
  playback: { start: number; end: number; volume: number };
  desktopPoster?: string;
}

export interface CanvaTextNode extends CanvaNodeBase {
  type: 'text';
  text: string;
  lines: string[];
  lineRuns: { text: string; color: string; weight: number; style: 'normal' | 'italic' }[][];
  fitted: boolean;
  linkedTo?: string;
  effect?: 'typewriter';
  duration?: number;
  mobileTextSize?: number;
  mobileLineHeight?: number;
  style: {
    family: 'Partita 1990' | 'Montserrat' | 'DM Sans' | 'Roboto';
    size: number;
    color: string;
    align: 'left' | 'center' | 'right';
    lineHeight: number;
    letterSpacing: string;
    weight: number;
    style: 'normal' | 'italic';
    desktopScaleX: number;
    desktopScaleY: number;
    desktopOffsetX: number;
    desktopOffsetY: number;
    mobileScaleX: number;
    mobileScaleY: number;
  };
}

export interface CanvaVectorNode extends CanvaNodeBase {
  type: 'vector';
  viewBox: [number, number, number, number];
  href?: string;
  linkLabel?: string;
  paths: Array<{
    kind: 'path' | 'rect';
    d: string;
    fill:
      | {
        type: 'solid';
        color: string;
        opacity: number;
      }
      | {
        type: 'image';
        src: string;
        crop: CanvaCrop;
        opacity: number;
      }
      | {
        type: 'none';
      };
    legacyFill: string;
    fillOpacity: number;
    legacyFillOpacity: number;
    stroke: string;
    strokeWidth: number;
    dash: number[];
    cornerRadius: number;
  }>;
}

export interface CanvaLineNode extends CanvaNodeBase {
  type: 'line';
  color: string;
  thickness: number;
  arrowEnd: boolean;
  curve: number;
  reveal?: { distance: number; duration: number; frames: [number, number][] };
}

export interface CanvaNewsletterNode extends CanvaNodeBase {
  type: 'newsletter';
}

export type CanvaNode =
  | CanvaImageNode
  | CanvaVideoNode
  | CanvaTextNode
  | CanvaVectorNode
  | CanvaLineNode
  | CanvaNewsletterNode;

export interface CanvaPage {
  id: 'home' | 'about' | 'digital' | 'physical' | 'contact';
  label: string;
  width: number;
  height: number;
  mobileWidth: number;
  mobileHeight: number;
  background: string;
  nodes: CanvaNode[];
}

export interface CanvaHomeModel {
  source: string;
  displayFont: {
    source: string;
    family: 'Partita 1990';
    format: 'woff2';
    file: string;
    selection: string;
  };
  pages: CanvaPage[];
}
