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

export type ObjectType = "text" | "rectangle" | "ellipse" | "line" | "image" | "draw" | "note" | "link" | "form-field" | "existing-text-edit";

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
  underline: boolean;
  strikethrough: boolean;
  align: "left" | "center" | "right";
  /** Optional clickable URL covering this text box's full bounding box -
   *  exported as a real Link annotation, not just visual styling. */
  linkUrl: string | null;
}

export interface LinkObject extends BaseObject {
  type: "link";
  url: string;
}

export type FormFieldType = "text" | "checkbox" | "radio" | "dropdown";

export interface FormFieldObject extends BaseObject {
  type: "form-field";
  fieldType: FormFieldType;
  /** AcroForm field name - must be unique per exported document; radio
   *  buttons additionally share a `groupName` so multiple placed objects
   *  become mutually-exclusive options of one PDFRadioGroup. */
  name: string;
  groupName?: string;
  /** The value this specific widget represents, for radio/dropdown options. */
  optionLabel?: string;
  options?: string[];
  required: boolean;
  fontSize: number;
}

export interface Bookmark {
  id: string;
  title: string;
  pageIndex: number;
}

export interface Attachment {
  id: string;
  name: string;
  file: File;
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

/**
 * A user-edited run of PRE-EXISTING PDF text (Advanced Edit mode), not new
 * content. pdf-lib cannot parse or rewrite an arbitrary page's existing
 * content-stream operators - no PDF library that runs entirely client-side
 * can, reliably, across the full range of real-world PDF producers - so
 * this is a genuine content-stream-level "cover the original run, draw
 * a replacement at the same position" edit, not the original text object
 * mutated in place. This is disclosed to the user in the editor UI and in
 * the migration report; it is the same fundamental technique most
 * consumer-grade PDF editors use for this feature on non-programmatically-
 * generated PDFs. `originalX/Y/Width/Height/FontSize` are PDF POINTS (not
 * canvas px like every other object here) taken directly from pdfjs's
 * TextItem.transform/width/height for the run being replaced - kept
 * separate from the canvas-px x/y/width/height (BaseObject) used for the
 * on-canvas selection box, since the two spaces can diverge slightly after
 * the user resizes the replacement box.
 */
export interface ExistingTextEditObject extends BaseObject {
  type: "existing-text-edit";
  /** The extracted run's id on its page, so re-clicking the same run edits
   *  the existing object instead of creating a duplicate on top of it. */
  runId: string;
  originalText: string;
  newText: string;
  originalXPt: number;
  originalYPt: number;
  originalWidthPt: number;
  originalHeightPt: number;
  fontSizePt: number;
  color: string;
  /** Sampled from the rendered page canvas under the original run, so the
   *  cover rectangle blends with the real page background instead of
   *  assuming white. */
  coverColor: string;
}

export type EditorObject =
  | TextObject
  | ShapeObject
  | LineObject
  | ImageObject
  | DrawObject
  | NoteObject
  | LinkObject
  | FormFieldObject
  | ExistingTextEditObject;

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
