/* PDFPilot's bounded adapter for the pinned upstream qpdf CLI.
 * Browser worker and Node regression tests run this same adapter. */
(function (scope) {
  "use strict";
  const LIMITS = {
    input: 50 * 1024 * 1024,
    output: 100 * 1024 * 1024,
    pages: 1000,
    report: 16 * 1024 * 1024,
  };
  function password(value, creating = false) {
    if (
      typeof value !== "string" ||
      value.length > 1024 ||
      /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(
        value,
      )
    )
      throw new Error(
        "Use a valid password without null characters, up to 1,024 characters.",
      );
    if (
      creating &&
      (!value ||
        /[\u0000-\u001f\u007f]/.test(value) ||
        new TextEncoder().encode(value).length > 127)
    )
      throw new Error(
        "New passwords must contain 1–127 UTF-8 bytes and no control characters. Shorten the password and try again.",
      );
    return value;
  }
  function validate(bytes, options) {
    if (
      !(bytes instanceof Uint8Array) ||
      !bytes.length ||
      bytes.length > LIMITS.input
    )
      throw new Error("Choose a non-empty PDF up to 50MB.");
    if (
      !new TextDecoder("latin1")
        .decode(bytes.subarray(0, 1024))
        .includes("%PDF-")
    )
      throw new Error("This is not a readable PDF. Choose a valid PDF file.");
    if (!["lock", "unlock"].includes(options?.operation))
      throw new Error("Choose Protect or Unlock PDF.");
    password(options.currentPassword || "");
    if (options.operation === "lock") {
      password(options.openPassword, true);
      if (options.ownerPassword) {
        password(options.ownerPassword, true);
        if (options.ownerPassword === options.openPassword)
          throw new Error(
            "Use a different owner password, or leave it empty for an automatically generated one.",
          );
      }
      if (
        !["full", "low", "none"].includes(options.print || "full") ||
        !["all", "form", "none"].includes(options.modify || "all")
      )
        throw new Error("Choose supported print and edit permissions.");
    }
  }
  async function transform(
    createCore,
    wasmBinary,
    bytes,
    options,
    onProgress = () => {},
  ) {
    validate(bytes, options);
    let output = [],
      errors = [],
      textSize = 0;
    const collect = (list, line) => {
      const text = String(line);
      textSize += text.length;
      if (textSize > LIMITS.report)
        throw new Error(
          "This PDF is too complex to inspect safely. Choose a smaller document.",
        );
      list.push(text);
    };
    const core = await createCore({
      wasmBinary,
      thisProgram: "qpdf",
      print: (line) => collect(output, line),
      printErr: (line) => collect(errors, line),
    });
    core.FS.writeFile("/input.pdf", bytes);
    const inputPassword = options.currentPassword || "";
    const run = (args) => {
      output = [];
      errors = [];
      textSize = 0;
      let code;
      try {
        code = core.callMain([...args]);
      } catch (error) {
        if (typeof error?.status === "number") code = error.status;
        else throw error;
      }
      if (code !== 0) {
        // Never return qpdf's raw diagnostic text: inspection output can contain
        // recovered legacy passwords, and diagnostics must not expose secrets.
        const detail = errors.join("\n");
        if (/invalid password|password required/i.test(detail))
          throw new Error(
            "The password is missing or incorrect. Enter the current open or owner password and try again.",
          );
        if (
          /unsupported.*encrypt|encryption.*not supported|unsupported.*security/i.test(
            detail,
          )
        )
          throw new Error(
            "This PDF uses an unsupported encryption method. Use a standard password-protected PDF.",
          );
        throw new Error(
          "This PDF could not be processed cleanly. Try Repair PDF or use a readable, unsigned copy.",
        );
      }
      return output.join("\n");
    };
    const json = (path, pass, args) =>
      JSON.parse(run([path, `--password=${pass}`, "--json", ...args]));
    const details = (path, pass) =>
      json(path, pass, [
        "--json-key=pages",
        "--json-key=acroform",
        "--json-key=encrypt",
        "--json-key=qpdf",
        "--json-object=trailer",
      ]);
    const object = (value, path, pass) => {
      if (value && typeof value === "object") return value;
      const match = /^(\d+) (\d+) R$/.exec(value || "");
      if (!match) return null;
      return (
        json(path, pass, [
          "--json-key=qpdf",
          `--json-object=${match[1]},${match[2]}`,
        ]).qpdf?.[1]?.[`obj:${value}`]?.value || null
      );
    };
    try {
      onProgress(12, "Checking PDF and password…");
      const before = details("/input.pdf", inputPassword);
      const pages = before.pages?.length || 0;
      if (!pages || pages > LIMITS.pages)
        throw new Error("Choose a PDF with 1–1,000 pages.");
      if ((before.qpdf?.[0]?.maxobjectid || 0) > 500000)
        throw new Error(
          "This PDF has too many objects. Choose a smaller document.",
        );
      const catalog = object(
        before.qpdf?.[1]?.trailer?.value?.["/Root"],
        "/input.pdf",
        inputPassword,
      );
      if (!catalog || catalog["/Type"] !== "/Catalog")
        throw new Error("This PDF has no readable document catalog.");
      const form = object(catalog["/AcroForm"], "/input.pdf", inputPassword);
      if (
        catalog["/Perms"] ||
        before.acroform?.fields?.some((field) => field.fieldtype === "/Sig")
      )
        throw new Error(
          "This PDF contains signature fields or certification. Changing encryption would invalidate digital signatures; use an unsigned copy.",
        );
      if (form?.["/XFA"])
        throw new Error(
          "XFA forms are not supported. Save a standard PDF form first.",
        );
      // qpdf's friendly AcroForm list covers page widgets. Walk the actual
      // field tree too: a signature may have no widget on a visible page.
      const pending = form ? [form] : [],
        seen = new Set();
      let inspected = 0;
      while (pending.length) {
        const batch = pending.splice(0, 128),
          references = [];
        for (const item of batch)
          if (
            typeof item === "string" &&
            /^(\d+) (\d+) R$/.test(item) &&
            !seen.has(item)
          ) {
            seen.add(item);
            references.push(item);
          }
        const resolved = references.length
          ? json("/input.pdf", inputPassword, [
              "--json-key=qpdf",
              ...references.map(
                (ref) =>
                  "--json-object=" + ref.replace(/ R$/, "").replace(" ", ","),
              ),
            ]).qpdf?.[1]
          : {};
        const values = [
          ...batch.filter((item) => typeof item !== "string"),
          ...references.map((ref) => resolved?.[`obj:${ref}`]?.value),
        ];
        for (const value of values) {
          if (++inspected > 10000)
            throw new Error(
              "This PDF form is too complex. Choose a document with fewer form fields.",
            );
          if (Array.isArray(value)) {
            if (value.length + pending.length > 10000)
              throw new Error(
                "This PDF form is too complex. Choose a document with fewer form fields.",
              );
            for (const item of value) pending.push(item);
            continue;
          }
          if (!value || typeof value !== "object") continue;
          if (value["/FT"] === "/Sig" || value["/Type"] === "/Sig")
            throw new Error(
              "This PDF contains signature fields or certification. Changing encryption would invalidate digital signatures; use an unsigned copy.",
            );
          for (const key of ["/Fields", "/Kids"])
            if (value[key]) pending.push(value[key]);
        }
        if (pending.length > 10000)
          throw new Error(
            "This PDF form is too complex. Choose a document with fewer form fields.",
          );
      }
      const encrypted = before.encrypt?.encrypted === true;
      if (options.operation === "unlock" && !encrypted) {
        run(["/input.pdf", `--password=${inputPassword}`, "--check"]);
        return {
          bytes: bytes.slice(),
          pageCount: pages,
          fieldCount: before.acroform?.fields?.length || 0,
          wasEncrypted: false,
          unchanged: true,
          encryption: "none",
        };
      }
      onProgress(
        35,
        options.operation === "lock"
          ? "Encrypting PDF…"
          : "Removing PDF encryption…",
      );
      const args = [
        "/input.pdf",
        "/output.pdf",
        `--password=${inputPassword}`,
        "--object-streams=preserve",
        "--stream-data=preserve",
      ];
      if (options.operation === "lock") {
        const random = new Uint8Array(32);
        crypto.getRandomValues(random);
        const owner =
          options.ownerPassword ||
          Array.from(random, (b) => b.toString(16).padStart(2, "0")).join("");
        args.push(
          "--encrypt",
          `--user-password=${options.openPassword}`,
          `--owner-password=${owner}`,
          "--bits=256",
          `--print=${options.print || "full"}`,
          `--modify=${options.modify || "all"}`,
          `--extract=${options.copy === false ? "n" : "y"}`,
          "--",
        );
      } else args.push("--decrypt");
      run(args);
      const size = core.FS.stat("/output.pdf").size;
      if (!size || size > LIMITS.output)
        throw new Error("The result exceeds 100MB. Choose a smaller document.");
      onProgress(80, "Checking the resulting PDF…");
      const outputPassword =
        options.operation === "lock" ? options.openPassword : "";
      const after = details("/output.pdf", outputPassword);
      if (
        after.pages?.length !== pages ||
        (after.acroform?.fields?.length || 0) !==
          (before.acroform?.fields?.length || 0)
      )
        throw new Error(
          "The result did not preserve every page and form field. No output was returned.",
        );
      if (
        options.operation === "lock"
          ? after.encrypt?.parameters?.bits !== 256 ||
            after.encrypt?.parameters?.R !== 6 ||
            after.encrypt?.parameters?.method !== "AESv3"
          : after.encrypt?.encrypted !== false
      )
        throw new Error(
          "The output encryption could not be verified. No output was returned.",
        );
      run(["/output.pdf", `--password=${outputPassword}`, "--check"]);
      const result = core.FS.readFile("/output.pdf").slice();
      onProgress(100, "PDF ready");
      return {
        bytes: result,
        pageCount: pages,
        fieldCount: after.acroform?.fields?.length || 0,
        wasEncrypted: encrypted,
        unchanged: false,
        encryption: options.operation === "lock" ? "AES-256" : "none",
      };
    } finally {
      for (const path of ["/input.pdf", "/output.pdf"])
        try {
          core.FS.unlink(path);
        } catch {}
      output = [];
      errors = [];
    }
  }
  const api = { transform, validate, limits: LIMITS };
  if (typeof module === "object" && module.exports) module.exports = api;
  else scope.PdfPilotPasswordCore = api;
})(typeof self === "undefined" ? globalThis : self);
