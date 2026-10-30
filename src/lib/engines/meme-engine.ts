import { canvasToBlob, checkImageTask, validateImageDimensions } from "./image-engine";
import { initialPhotoState, newPhotoLayer, type PhotoState } from "./photo-editor-engine";

export const MEME_TEMPLATES = [
  { id: "two-moods", name: "Two moods", emoji: "😐 😎", description: "Two original reaction panels" },
  { id: "big-idea", name: "Big idea", emoji: "💡", description: "A bright idea on a blue backdrop" },
  { id: "celebration", name: "Celebration", emoji: "🎉", description: "A colorful confetti backdrop" },
] as const;
export type MemeTemplateId = typeof MEME_TEMPLATES[number]["id"];
export const MEME_TOP = "meme-top-caption", MEME_BOTTOM = "meme-bottom-caption";

export function initialMemeState(width: number, height: number): PhotoState {
  const state = initialPhotoState(width, height);
  state.layers = [MEME_TOP, MEME_BOTTOM].map((id, index) => ({ ...newPhotoLayer("text", id), name: index ? "Bottom caption" : "Top caption", text: index ? "YOUR BOTTOM TEXT" : "YOUR TOP TEXT", x: .04, y: index ? .78 : .02, width: .92, height: .2, color: "#ffffff", font: "impact", fontSize: .11, outlineColor: "#000000", outlineWidth: .008 }));
  return state;
}

/** Preserve photo-relative overlay positions when adding/removing caption bands. */
export function changeMemeLayout(state: PhotoState, outside: boolean): PhotoState {
  const oldSpace = state.settings.captionSpace ?? 0, nextSpace = outside ? 1 / 7 : 0;
  if (oldSpace === nextSpace) return state;
  const oldHeight = state.settings.height, photoHeight = oldHeight * (1 - oldSpace * 2), newHeight = Math.round(photoHeight / (1 - nextSpace * 2));
  validateImageDimensions(state.settings.width, newHeight);
  if (state.settings.width * newHeight > 20_000_000) throw new Error("Outside captions need more space. Reduce the output size below 14 megapixels first.");
  const layers = state.layers.map(layer => {
    if (layer.id === MEME_TOP || layer.id === MEME_BOTTOM) return { ...layer, x: .04, width: .92, y: layer.id === MEME_TOP ? .02 : outside ? 1 - nextSpace + .02 : .78, height: outside ? nextSpace - .04 : .2 };
    const yOnPhoto = (layer.y - oldSpace) / (1 - oldSpace * 2), heightOnPhoto = layer.height / (1 - oldSpace * 2);
    return { ...layer, y: Math.max(-1, Math.min(1, nextSpace + yOnPhoto * (1 - nextSpace * 2))), height: Math.min(2, heightOnPhoto * (1 - nextSpace * 2)) };
  });
  return { settings: { ...state.settings, height: newHeight, captionSpace: nextSpace, captionBackground: state.settings.captionBackground ?? "#ffffff" }, layers };
}

/** Original procedural artwork; no third-party meme image library or network request. */
export async function createMemeTemplate(id: MemeTemplateId, signal?: AbortSignal): Promise<File> {
  if (!MEME_TEMPLATES.some(t => t.id === id)) throw new Error("Choose an available template.");
  checkImageTask(signal);
  const canvas = document.createElement("canvas"); canvas.width = 900; canvas.height = 600;
  try {
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = id === "big-idea" ? "#172554" : id === "celebration" ? "#fdf2f8" : "#e2e8f0"; ctx.fillRect(0, 0, 900, 600);
    if (id === "two-moods") {
      ctx.fillStyle = "#ecfdf5"; ctx.fillRect(450, 0, 450, 600);
      ctx.fillStyle = "#111827"; ctx.font = "190px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("😐", 225, 310); ctx.fillText("😎", 675, 310);
    } else if (id === "big-idea") {
      ctx.fillStyle = "#1d4ed8"; ctx.beginPath(); ctx.arc(450, 300, 210, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffffff"; ctx.font = "240px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("💡", 450, 310);
    } else {
      const colors = ["#f97316", "#10b981", "#3b82f6", "#db2777", "#facc15"];
      for (let i = 0; i < 70; i++) { ctx.save(); ctx.translate((i * 137) % 900, (i * 83) % 600); ctx.rotate(i * .7); ctx.fillStyle = colors[i % colors.length]; ctx.fillRect(-5, -9, 10, 18); ctx.restore(); }
      ctx.fillStyle = "#111827"; ctx.font = "220px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🎉", 450, 310);
    }
    const blob = await canvasToBlob(canvas, "image/png", 1, signal); checkImageTask(signal);
    return new File([blob], `${id}.png`, { type: "image/png" });
  } finally { canvas.width = canvas.height = 0; }
}
