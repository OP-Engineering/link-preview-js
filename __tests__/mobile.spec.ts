import { describe, it, expect, spyOn } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { getLinkPreview, getPreviewFromContent } from "../mobile";
import prefetchedResponse from "./sampleResponse.json";

describe(`mobile entrypoint`, () => {
  it(`does not statically import undici or node:net, so bundlers (React Native, browsers) never see them`, () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "mobile.ts"), "utf-8");
    const importsAndRequires = source.match(/^\s*(?:import|export)\b.*$|require\([^)]*\)/gm) ?? [];

    for (const statement of importsAndRequires) {
      expect(statement).not.toMatch(/undici|node:net\b/);
    }
  });

  it(`fetches and parses a link preview without resolveDNSHost`, async () => {
    const fetchResponse = new Response(
      `<html><head>
          <meta property="og:title" content="Mobile preview">
          <meta property="og:description" content="No SSRF pinning needed here">
        </head></html>`,
      { headers: { "content-type": "text/html" } },
    );
    Object.defineProperty(fetchResponse, "url", { value: "https://example.com/" });
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(fetchResponse);

    try {
      const response: any = await getLinkPreview(`https://example.com/`);

      expect(response.title).toEqual("Mobile preview");
      expect(response.description).toEqual("No SSRF pinning needed here");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][0]).toEqual("https://example.com/");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it(`getPreviewFromContent parses a pre-fetched response`, async () => {
    const linkInfo: any = await getPreviewFromContent(prefetchedResponse);

    expect(linkInfo.url).toEqual(`https://www.youtube.com/watch?v=wuClZjOdT30`);
    expect(linkInfo.siteName).toEqual(`YouTube`);
    expect(linkInfo.title).toEqual(`Geography Now! Germany`);
  });
});
