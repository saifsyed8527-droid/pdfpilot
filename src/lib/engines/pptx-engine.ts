// One renderer for every English/localized PowerPoint workspace.
export {
  renderPptxToPdf as convertPptxToPdf,
  inspectPptxFile,
} from "./pptx-renderer";
export type { PptxInspection } from "./pptx-renderer";
