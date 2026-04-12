<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Verifying the build

Run from the repo root:

```
PATH="/opt/homebrew/bin:$PATH" /opt/homebrew/bin/node node_modules/next/dist/bin/next build
```

Plain `npm run build` / `next build` may fail because Turbopack can't find `node` on the sandboxed PATH. Prefixing PATH and invoking node directly fixes it.
