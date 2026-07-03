// The default entrypoint keeps historical behavior: full Node support, including the
// `undici`-backed SSRF/DNS-rebinding protections in node.ts. If you're bundling for
// React Native or a browser, import from "link-preview-js/mobile" instead - it drops
// those Node-only dependencies (and the loopback protection that comes with them,
// which isn't relevant on-device).
export * from "./node";
