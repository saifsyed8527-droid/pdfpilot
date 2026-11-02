# Local qpdf runtime

The unchanged `qpdf-core.js` and `qpdf-core.wasm` are vendored from the unofficial npm distribution `@wasm-zoo/qpdf@0.1.1`, which builds upstream **qpdf 12.4.2**. Package SHA-512: `smxfhQPwUYJtvfze69TXyYK4otc9femdxf+jxTf7seuuAbbbYsbVSftK9vL1m2Xfgk6PwmZmWdvlbyyz5fzfOA==`. Core hashes are recorded in `manifest.json` and checked by tests. Source/build information, upstream notices and licenses are included here. No installer scripts ran and no shared dependencies changed.

`password-core.js` and `worker.js` are PDFPilot's adapter. They call qpdf's original CLI in memory; they do not implement encryption primitives. Randomness is supplied by `crypto.getRandomValues`. Input, passwords, temporary files and output remain in worker memory. Only these local runtime assets are fetched. Each worker has a timeout and is destroyed on cancellation/completion. Raw CLI diagnostics and recovered passwords are not posted back or logged.

Core build memory maximum: 512MiB. Adapter input/output limits: 50/100MiB; 1,000 pages; no signature fields/certification or XFA. The output is AES-256 revision 6 for protection, or a native decrypted PDF for unlock. User/owner passwords are separate; default owner passwords are generated locally and are not persisted.

Sources: <https://github.com/ttomohisa/wasm-zoo/tree/a1b4f60ee4e96adaf3e86a7a02be2a724d2dba40/builders/qpdf>, <https://github.com/qpdf/qpdf/tree/v12.4.2>, <https://qpdf.readthedocs.io/en/stable/cli.html>.
