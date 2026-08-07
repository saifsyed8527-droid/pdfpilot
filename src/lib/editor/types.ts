/**
 * Edit PDF's object model - every element a user places on a page (text,
 * shapes, images, freehand strokes, notes) shares one uniform bounding-box
 * shape: {x, y, width, height, rotation}, all in canvas-pixel space at the
 * editor's fixed render scale (top-left origin, Y increases downward,
 * rotation in degrees clockwise - i.e. plain CSS/screen conventions
 * throughout the UI layer). This is what lets one generic selection/
 * move/resize/rotate system (EditorCanvas) work for every object type
 * instead of special-casing each one - the same reasoning that led the
 * rest of this codebase to centralize PDF-loading behind pdf-engine.ts
 * and pdf-render-engine.ts rather than repeating it per tool.
 *
 * Conversion from this canvas-pixel model to pdf-lib's bottom-left-origin,
 * Y-up, point-based coordinate system happens in exactly one place -
 * pdf-export.ts - so the geometry math is verified and owned once.
 */

export type ObjectType = "text" | "rectangle" | "ellipse" | "line" | "image" | "draw" | "note";

export interface Point {
  x: number;
  y: number;
}

interface BaseObject {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, clockwise, screen convention - 0 for types that don't support
   *  rotation in this milestone (note). */
  rotation: number;
  /** Paint order within the page - higher draws on top. */
  zIndex: number;
}

export interface TextObject extends BaseObject {
  type: "text";
  text: string;
  /** Points - matches the size the user sees in the property panel and the
   *  size actually embedded in the saved PDF (no separate "screen size"). */
  fontSize: number;
  color: string;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
}

export interface ShapeObject extends BaseObject {
  type: "rectangle" | "ellipse";
  fillColor: string | null;
  strokeColor: string | null;
  strokeWidth: number;
  opacity: number;
}

export interface LineObject extends BaseObject {
  type: "line";
  strokeColor: string;
  strokeWidth: number;
}

export interface ImageObject extends BaseObject {
  type: "image";
  dataUrl: string;
  format: "png" | "jpeg";
}

export interface DrawObject extends BaseObject {
  type: "draw";
  /** Relative to (x, y) - the object's own top-left - in canvas px. */
  points: Point[];
  strokeColor: string;
  strokeWidth: number;
  /** Distinguishes a signature from a plain pencil stroke for the layer
   *  list and FAQ copy; rendering is identical - both are just a stroked
   *  path, which is the same thing a hand-drawn signature is. */
  kind: "draw" | "signature";
}

export interface NoteObject extends BaseObject {
  type: "note";
  text: string;
  color: string;
}

export type EditorObject =
  | TextObject
  | ShapeObject
  | LineObject
  | ImageObject
  | DrawObject
  | NoteObject;

/** Objects for one page, keyed by 0-based page index. */
export type PagesObjects = Record<number, EditorObject[]>;

export function hexToRgb01(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b];
}

let idCounter = 0;
export function nextObjectId(): string {
  idCounter += 1;
  return `obj-${Date.now().toString(36)}-${idCounter}`;
}

/** Rotates (px, py) by angleDeg (clockwise, screen convention) around
 *  (cx, cy). Used both for hit-testing/handle placement in the UI and for
 *  computing the exact points baked into the saved PDF - one formula,
 *  two consumers, so they can never visually disagree with each other. */
export function rotatePoint(px: number, py: number, cx: number, cy: number, angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

/** The four corners of an object's bounding box, rotated around its own
 *  center - in the object's local top-left-relative space (i.e. as if
 *  x=0, y=0), still in screen/canvas convention (Y down). */
export function rotatedLocalCorners(width: number, height: number, rotationDeg: number): Point[] {
  const cx = width / 2;
  const cy = height / 2;
  return [
    rotatePoint(0, 0, cx, cy, rotationDeg),
    rotatePoint(width, 0, cx, cy, rotationDeg),
    rotatePoint(width, height, cx, cy, rotationDeg),
    rotatePoint(0, height, cx, cy, rotationDeg),
  ];
}
