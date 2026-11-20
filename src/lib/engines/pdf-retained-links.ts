import type { PDFDocument, PDFPage } from "pdf-lib";

/**
 * copyPages gives a copied link a detached copy of its target page, not the
 * reference in the new page tree. Repair only explicit local page destinations.
 * Named destinations and form catalog reconstruction are separate work.
 */
export async function repairRetainedPageLinks(source: PDFDocument, output: PDFDocument, sourceIndices: readonly number[], copied: readonly PDFPage[]) {
  const { PDFArray, PDFDict, PDFName, PDFRef } = await import("pdf-lib");
  const name = PDFName.of;
  const sourcePages = source.getPages();
  const pageRefs = new Set(sourcePages.map(page => page.ref));
  const targets = new Map<PDFPage["ref"], PDFPage["ref"]>();
  sourceIndices.forEach((index, i) => {
    const ref = sourcePages[index].ref;
    if (!targets.has(ref)) targets.set(ref, copied[i].ref);
  });

  for (let i = 0; i < copied.length; i++) {
    const origin = sourcePages[sourceIndices[i]];
    const originalAnnotations = origin.node.Annots();
    const annotations = copied[i].node.Annots();
    if (!originalAnnotations || !annotations || originalAnnotations.size() !== annotations.size()) continue;
    // Duplicated extracted pages may share copied annotation objects. Never
    // mutate those objects in place; a self-link must target its own occurrence.
    const patched = annotations.clone(output.context);
    let changed = false;
    for (let j = originalAnnotations.size() - 1; j >= 0; j--) {
      const annot = source.context.lookup(originalAnnotations.get(j));
      if (!(annot instanceof PDFDict) || annot.get(name("Subtype")) !== name("Link")) continue;
      const action = source.context.lookup(annot.get(name("A")));
      const direct = annot.get(name("Dest"));
      const isLocalGoTo = !direct && action instanceof PDFDict && action.get(name("S")) === name("GoTo");
      const dest = source.context.lookup(direct ?? (isLocalGoTo ? action.get(name("D")) : undefined));
      if (!(dest instanceof PDFArray)) continue;
      const ref = dest.get(0);
      if (!(ref instanceof PDFRef) || !pageRefs.has(ref)) continue;
      const target = ref === origin.ref ? copied[i].ref : targets.get(ref);
      if (!target) {
        patched.remove(j);
        changed = true;
        continue;
      }
      const copiedAnnot = output.context.lookup(annotations.get(j));
      if (!(copiedAnnot instanceof PDFDict)) continue;
      const copiedAction = output.context.lookup(copiedAnnot.get(name("A")));
      if (isLocalGoTo && !(copiedAction instanceof PDFDict)) continue;
      const copiedDest = output.context.lookup(isLocalGoTo && copiedAction instanceof PDFDict ? copiedAction.get(name("D")) : copiedAnnot.get(name("Dest")));
      if (!(copiedDest instanceof PDFArray)) continue;
      const newDest = copiedDest.clone(output.context);
      newDest.set(0, target);
      const newAnnot = copiedAnnot.clone(output.context);
      if (isLocalGoTo && copiedAction instanceof PDFDict) {
        const newAction = copiedAction.clone(output.context);
        newAction.set(name("D"), newDest);
        newAnnot.set(name("A"), newAction);
      } else {
        newAnnot.set(name("Dest"), newDest);
      }
      if (newAnnot.has(name("P"))) newAnnot.set(name("P"), copied[i].ref);
      patched.set(j, output.context.register(newAnnot));
      changed = true;
    }
    if (changed) copied[i].node.set(name("Annots"), patched);
  }
}
