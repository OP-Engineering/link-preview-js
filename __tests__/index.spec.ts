import { describe, it, expect, spyOn } from "bun:test";
import { getLinkPreview, getPreviewFromContent } from "../index";
import { CONSTANTS } from "../constants";
import prefetchedResponse from "./sampleResponse.json";
import dns from "node:dns/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

/**
 * GitHub Actions' network egress to youtube.com is unreliable (bot detection, rate
 * limiting, or just YouTube's markup drifting), which makes these otherwise-real
 * requests flaky in CI specifically. Mock the response only there so local runs keep
 * exercising the real integration.
 */
function mockYoutubeFetchOnCI() {
  if (!process.env.CI) {
    return undefined;
  }

  const fetchResponse = new Response(
    `<html><head>
        <meta charset="utf-8">
        <meta property="og:site_name" content="YouTube">
        <meta property="og:title" content="Geography Now! Germany">
        <meta property="og:description" content="Mocked description for CI">
        <meta property="og:type" content="video.other">
        <meta property="og:image" content="https://i.ytimg.com/vi/wuClZjOdT30/maxresdefault.jpg">
        <link rel="icon" href="https://www.youtube.com/favicon.ico">
      </head></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
  Object.defineProperty(fetchResponse, "url", {
    value: "https://www.youtube.com/watch?v=wuClZjOdT30",
  });

  return spyOn(globalThis, "fetch").mockResolvedValue(fetchResponse);
}

describe(`#REGEX_LOOPBACK`, () => {
  it(`matches IPv6 loopback and local ranges`, () => {
    expect(CONSTANTS.REGEX_LOOPBACK.test(`::1`)).toBe(true);
    expect(CONSTANTS.REGEX_LOOPBACK.test(`::ffff:127.0.0.1`)).toBe(true);
    expect(CONSTANTS.REGEX_LOOPBACK.test(`fc00::1`)).toBe(true);
    expect(CONSTANTS.REGEX_LOOPBACK.test(`fd12:3456:789a::1`)).toBe(true);
    expect(CONSTANTS.REGEX_LOOPBACK.test(`fe80::abcd`)).toBe(true);
    expect(CONSTANTS.REGEX_LOOPBACK.test(`febf::abcd`)).toBe(true);
  });

  it(`does not match non-local IPv6 addresses`, () => {
    expect(CONSTANTS.REGEX_LOOPBACK.test(`2001:4860:4860::8888`)).toBe(false);
  });
});

describe(`#getLinkPreview()`, () => {
  it(`should extract link info from just URL`, async () => {
    const fetchSpy = mockYoutubeFetchOnCI();

    try {
      const linkInfo: any = await getLinkPreview(
        `https://www.youtube.com/watch?v=wuClZjOdT30`,
        {
          headers: { "Accept-Language": `en-US` },
        },
      );

      expect(linkInfo.url).toEqual(
        `https://www.youtube.com/watch?v=wuClZjOdT30`,
      );
      expect(linkInfo.siteName).toEqual(`YouTube`);
      expect(linkInfo.title).toEqual(`Geography Now! Germany`);
      expect(linkInfo.description).toBeTruthy();
      expect(linkInfo.mediaType).toEqual(`video.other`);
      expect(linkInfo.images.length).toEqual(1);
      expect(linkInfo.images[0]).toEqual(
        `https://i.ytimg.com/vi/wuClZjOdT30/maxresdefault.jpg`,
      );
      expect(linkInfo.videos.length).toEqual(0);
      expect(linkInfo.favicons[0]).not.toBe(``);
      expect(linkInfo.contentType.toLowerCase()).toEqual(`text/html`);
      expect(linkInfo.charset?.toLowerCase()).toEqual(`utf-8`);
    } finally {
      fetchSpy?.mockRestore();
    }
  });

  it("returns charset of website", async () => {
    const linkInfo: any = await getLinkPreview(`https://www.pravda.com.ua`);

    expect(linkInfo.url).toEqual(`https://www.pravda.com.ua/`);
    expect(linkInfo.contentType.toLowerCase()).toEqual(`text/html`);
    expect(linkInfo.charset?.toLowerCase()).toEqual(`utf-8`);
  });

  it.skip("should extract author from news article", async () => {
    const linkInfo: any = await getLinkPreview(
      `https://www.usatoday.com/story/special/contributor-content/2025/10/15/why-chaos-engineering-is-more-important-than-ever-in-the-ai-era/86712877007/`,
    );

    expect(linkInfo.author).toEqual(`Matt Emma`);
  });

  it(`should extract link info from a URL with a newline`, async () => {
    const fetchSpy = mockYoutubeFetchOnCI();

    try {
      const linkInfo: any = await getLinkPreview(
        `
      https://www.youtube.com/watch?v=wuClZjOdT30
    `,
        { headers: { "Accept-Language": `en-US` } },
      );

      expect(linkInfo.url).toEqual(
        `https://www.youtube.com/watch?v=wuClZjOdT30`,
      );
      expect(linkInfo.title).toEqual(`Geography Now! Germany`);
      expect(linkInfo.siteName).toBeTruthy();
      expect(linkInfo.description).toBeTruthy();
      expect(linkInfo.mediaType).toEqual(`video.other`);
      expect(linkInfo.images.length).toEqual(1);
      expect(linkInfo.images[0]).toEqual(
        `https://i.ytimg.com/vi/wuClZjOdT30/maxresdefault.jpg`,
      );
      expect(linkInfo.videos.length).toEqual(0);
      expect(linkInfo.favicons[0]).not.toBe(``);
      expect(linkInfo.contentType.toLowerCase()).toEqual(`text/html`);
    } finally {
      fetchSpy?.mockRestore();
    }
  });

  it(`should extract link info from just text with a URL`, async () => {
    const fetchSpy = mockYoutubeFetchOnCI();

    try {
      const linkInfo: any = await getLinkPreview(
        `This is some text blah blah https://www.youtube.com/watch?v=wuClZjOdT30 and more text`,
        { headers: { "Accept-Language": `en-US` } },
      );

      expect(linkInfo.url).toEqual(
        `https://www.youtube.com/watch?v=wuClZjOdT30`,
      );
      expect(linkInfo.title).toEqual(`Geography Now! Germany`);
      expect(linkInfo.siteName).toEqual(`YouTube`);
      expect(linkInfo.description).toBeTruthy();
      expect(linkInfo.mediaType).toEqual(`video.other`);
      expect(linkInfo.images.length).toEqual(1);
      expect(linkInfo.images[0]).toEqual(
        `https://i.ytimg.com/vi/wuClZjOdT30/maxresdefault.jpg`,
      );
      expect(linkInfo.videos.length).toEqual(0);
      expect(linkInfo.favicons[0]).toBeTruthy();
      expect(linkInfo.contentType.toLowerCase()).toEqual(`text/html`);
    } finally {
      fetchSpy?.mockRestore();
    }
  });

  // it(`should make request with different languages`, async () => {
  //   let linkInfo: any = await getLinkPreview(`https://www.wikipedia.org/`, {
  //     headers: { "Accept-Language": `es` },
  //     followRedirects: `follow`,
  //   });
  //   expect(linkInfo.title).toContain(`Wikipedia, la enciclopedia libre`);

  //   linkInfo = await getLinkPreview(`https://www.wikipedia.org/`);
  //   expect(linkInfo.title).toContain(`Wikipedia`);
  // });

  it(`should handle audio urls`, async () => {
    const linkInfo = await getLinkPreview(
      `https://ondemand.npr.org/anon.npr-mp3/npr/atc/2007/12/20071231_atc_13.mp3`,
    );
    expect(linkInfo.url).toEqual(
      `https://ondemand.npr.org/anon.npr-mp3/npr/atc/2007/12/20071231_atc_13.mp3`,
    );
    expect(linkInfo.mediaType).toEqual(`audio`);
    expect(linkInfo.contentType?.toLowerCase()).toEqual(`audio/mpeg`);
    expect(linkInfo.favicons[0]).toBeTruthy();
  });

  it(`should handle video urls`, async () => {
    const linkInfo = await getLinkPreview(
      `https://www.w3schools.com/html/mov_bbb.mp4`,
    );

    expect(linkInfo.url).toEqual(`https://www.w3schools.com/html/mov_bbb.mp4`);
    expect(linkInfo.mediaType).toEqual(`video`);
    expect(linkInfo.contentType?.toLowerCase()).toEqual(`video/mp4`);
    expect(linkInfo.favicons[0]).toBeTruthy();
  });

  it(`should handle image urls`, async () => {
    const linkInfo = await getLinkPreview(
      `https://media.npr.org/assets/img/2018/04/27/gettyimages-656523922nunes-4bb9a194ab2986834622983bb2f8fe57728a9e5f-s1100-c15.jpg`,
    );

    expect(linkInfo.url).toEqual(
      `https://media.npr.org/assets/img/2018/04/27/gettyimages-656523922nunes-4bb9a194ab2986834622983bb2f8fe57728a9e5f-s1100-c15.jpg`,
    );
    expect(linkInfo.mediaType).toEqual(`image`);
    expect(linkInfo.contentType?.toLowerCase()).toEqual(`image/jpeg`);
    expect(linkInfo.favicons[0]).toBeTruthy();
  });

  it(`should handle unknown content type urls`, async () => {
    const linkInfo = await getLinkPreview(`https://mjml.io/try-it-live`);

    expect(linkInfo.url).toEqual(`https://mjml.io/try-it-live`);
    expect(linkInfo.mediaType).toEqual(`website`);
  });

  // This site changed? it is not returning application any more but rather website
  // it.skip(`should handle application urls`, async () => {
  //   const linkInfo = await getLinkPreview(
  //     `https://assets.curtmfg.com/masterlibrary/56282/installsheet/CME_56282_INS.pdf`
  //   );

  //   expect(linkInfo.url).toEqual(
  //     `https://assets.curtmfg.com/masterlibrary/56282/installsheet/CME_56282_INS.pdf`
  //   );
  //   expect(linkInfo.mediaType).toEqual(`application`);
  //   expect(linkInfo.contentType?.toLowerCase()).toEqual(`application/pdf`);
  //   expect(linkInfo.favicons[0]).toBeTruthy();
  // });

  it(`no link in text should fail gracefully`, async () => {
    expect(getLinkPreview(`no link`)).rejects.toThrow(
      `link-preview-js did not receive a valid a url or text`,
    );
  });

  it(`should handle malformed urls gracefully`, async () => {
    expect(
      getLinkPreview(
        `this is a malformed link: ahttps://www.youtube.com/watch?v=wuClZjOdT30`,
      ),
    ).rejects.toThrow(`link-preview-js did not receive a valid a url or text`);
  });

  it(`should block .internal hostnames`, async () => {
    expect(
      getLinkPreview(
        `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token`,
      ),
    ).rejects.toThrow(`link-preview-js did not receive a valid a url or text`);
  });

  it(`should block .local hostnames`, async () => {
    expect(getLinkPreview(`http://printer.local/status`)).rejects.toThrow(
      `link-preview-js did not receive a valid a url or text`,
    );
  });

  it(`should block nip.io wildcard hostnames`, async () => {
    expect(
      getLinkPreview(
        `http://169.254.169.254.nip.io/latest/meta-data/iam/security-credentials/`,
      ),
    ).rejects.toThrow(`link-preview-js did not receive a valid a url or text`);
  });

  it(`should block sslip.io wildcard hostnames`, async () => {
    expect(getLinkPreview(`http://127.0.0.1.sslip.io/`)).rejects.toThrow(
      `link-preview-js did not receive a valid a url or text`,
    );
  });

  it(`should handle empty strings gracefully`, async () => {
    expect(getLinkPreview(``)).rejects.toThrow(
      `link-preview-js did not receive a valid url or text`,
    );
  });

  it.skip(`should handle a proxy url option`, async () => {
    // origin header is required by cors-anywhere
    const linkInfo: any = await getLinkPreview(
      `https://www.youtube.com/watch?v=wuClZjOdT30`,
      {
        proxyUrl: `https://cors-anywhere.herokuapp.com/`,
        headers: {
          Origin: `http://localhost:8000`,
          "Accept-Language": `en-US`,
        },
      },
    );

    expect(linkInfo.url).toEqual(`https://www.youtube.com/watch?v=wuClZjOdT30`);
    expect(linkInfo.siteName).toEqual(`YouTube`);
    expect(linkInfo.title).toEqual(`Geography Now! Germany`);
    expect(linkInfo.description).toBeTruthy();
    expect(linkInfo.mediaType).toEqual(`video.other`);
    expect(linkInfo.images.length).toEqual(1);
    expect(linkInfo.images[0]).toEqual(
      `https://i.ytimg.com/vi/wuClZjOdT30/maxresdefault.jpg`,
    );
    expect(linkInfo.videos.length).toEqual(0);
    expect(linkInfo.favicons[0]).not.toBe(``);
    expect(linkInfo.contentType.toLowerCase()).toEqual(`text/html`);
  });

  // A mock that never settles on its own, only when the AbortSignal index.ts ties to
  // its timeout fires - the same way a real fetch against a server that never
  // responds would behave, without depending on an actual slow-loading website.
  function mockHangingFetch() {
    return spyOn(globalThis, "fetch").mockImplementation(
      ((_url: any, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const abortError = new Error("The operation was aborted.");
            abortError.name = "AbortError";
            reject(abortError);
          });
        })) as typeof fetch,
    );
  }

  it("should timeout (default 3s) with infinite loading link", async () => {
    const fetchSpy = mockHangingFetch();

    try {
      expect(
        getLinkPreview(`https://example.com/infinite-loading`),
      ).rejects.toThrow("Request timeout");
    } finally {
      fetchSpy.mockRestore();
    }
  }, 5000);

  it("should timeout (custom 1s) with infinite loading link", async () => {
    const fetchSpy = mockHangingFetch();

    try {
      expect(
        getLinkPreview(`https://example.com/infinite-loading`, {
          timeout: 1000,
        }),
      ).rejects.toThrow("Request timeout");
    } finally {
      fetchSpy.mockRestore();
    }
  }, 3000);

  it(`should handle followRedirects option is error`, async () => {
    try {
      await getLinkPreview(`http://google.com/`, { followRedirects: `error` });
    } catch (e: any) {
      expect(e.message).toContain(`UnexpectedRedirect`);
    }
  });

  it(`should handle followRedirects option is manual but handleRedirects was not provided`, async () => {
    try {
      await getLinkPreview(`http://google.com/`, { followRedirects: `manual` });
    } catch (e: any) {
      expect(e.message).toEqual(
        `link-preview-js followRedirects is set to manual, but no handleRedirects function was provided`,
      );
    }
  });

  it(`should handle followRedirects option is manual with handleRedirects function`, async () => {
    const response = await getLinkPreview(`http://google.com/`, {
      followRedirects: `manual`,
      handleRedirects: (_baseURL: string, forwardedURL: string) => {
        if (forwardedURL !== `http://www.google.com/`) {
          return false;
        }
        return true;
      },
    });

    expect(response.contentType).toEqual(`text/html`);
    expect(response.url).toEqual(`http://www.google.com/`);
    expect(response.mediaType).toEqual(`website`);
  });

  it(`should fetch the resolved DNS address after validation`, async () => {
    const fetchResponse = new Response(
      `<html><head>
          <meta property="og:title" content="Resolved host">
          <meta property="og:description" content="Resolved address test">
        </head></html>`,
      {
        headers: {
          "content-type": "text/html",
        },
      },
    );
    Object.defineProperty(fetchResponse, "url", {
      value: "http://example.com/",
    });
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      fetchResponse,
    );

    try {
      const response = await getLinkPreview(`http://example.com/`, {
        resolveDNSHost: async () => "93.184.216.34",
      });

      expect((response as any).title).toEqual("Resolved host");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][0]).toEqual("http://93.184.216.34/");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it(`should trust a resolveDNSHost result that is itself a URL with a hostname, not just a bare IP`, async () => {
    const fetchResponse = new Response(
      `<html><head>
          <meta property="og:title" content="Resolved host">
        </head></html>`,
      { headers: { "content-type": "text/html" } },
    );
    Object.defineProperty(fetchResponse, "url", {
      value: "http://replacement.example.com/",
    });
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      fetchResponse,
    );

    try {
      const response = await getLinkPreview(`http://example.com/`, {
        resolveDNSHost: async () => "http://replacement.example.com/",
      });

      expect((response as any).title).toEqual("Resolved host");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][0]).toEqual(
        "http://replacement.example.com/",
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it(`should keep the original hostname for HTTPS requests to preserve SNI/TLS`, async () => {
    // Real network, real DNS, no mocking: this is the exact scenario from the bug
    // report (issue #182) - resolveDNSHost validating a real address for an HTTPS URL
    // used to rewrite the request to that bare IP and break the TLS handshake (SNI /
    // certificate validation is done against the hostname, not an IP).
    const { address } = await dns.lookup("example.com");

    const response: any = await getLinkPreview(`https://example.com/`, {
      resolveDNSHost: async () => address,
    });

    expect(response.title).toBeTruthy();
    expect(response.url).toEqual("https://example.com/");
  });

  it(`should pin the HTTPS connection to the resolveDNSHost-validated address and reject DNS rebinding`, async () => {
    // Bun replaces the "undici" package with its own native implementation, which
    // doesn't honor undici's `connect.lookup` override that createPinnedDispatcher
    // (index.ts) relies on to pin the connection - so this can only be verified
    // against the real undici package, run under plain `node`.
    const fixture = path.join(
      __dirname,
      "fixtures",
      "verify-undici-pinning.node.cjs",
    );
    const result = spawnSync("node", [fixture], { encoding: "utf-8" });

    expect(result.stdout.trim()).toEqual("PASS");
    expect(result.status).toEqual(0);
  });

  it(`should block resolved local addresses in normalized IPv6 forms`, async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("fetch should not be called"),
    );
    const blockedAddresses = [
      "0.0.0.0",
      "0:0:0:0:0:0:0:1",
      "::a9fe:a9fe",
      "::ffff:a9fe:a9fe",
      "64:ff9b::a9fe:a9fe",
      "[::1]",
      "fe80::1%lo0",
      "http://127.0.0.1/",
      "http://[::1]/",
    ];

    try {
      for (const address of blockedAddresses) {
        expect(
          getLinkPreview(`http://example.com/`, {
            resolveDNSHost: async () => address,
          }),
        ).rejects.toThrow("SSRF request detected");
      }

      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("should handle override response body using onResponse option", async () => {
    let firstParagraphText;

    const res: any = await getLinkPreview(`https://www.example.com/`, {
      onResponse: (result, doc) => {
        firstParagraphText = doc("p")
          .first()
          .text()
          .split("\n")
          .map((x: any) => x.trim())
          .join(" ");
        result.siteName = `SiteName has been overridden`;
        result.description = firstParagraphText;

        return result;
      },
    });

    expect(res.siteName).toEqual("SiteName has been overridden");
    expect(res.description).toEqual(firstParagraphText);
  });

  // it("should handle video tags without type or secure_url tags", async () => {
  //   const res: any = await getLinkPreview(
  //     `https://newpathtitle.com/falling-markets-how-to-stop-buyer-from-getting-out/`,
  //     { followRedirects: `follow` },
  //   );

  //   expect(res.siteName).toEqual(`New Path Title`);
  //   expect(res.title).toEqual(
  //     `Falling Markets: How To Stop A Buyer From Getting Out | New Path Title`,
  //   );
  //   expect(res.description).toBeTruthy();
  //   expect(res.mediaType).toEqual(`article`);
  //   expect(res.images.length).toBeGreaterThan(0);
  //   expect(res.videos.length).toBeGreaterThan(0);
  //   expect(res.videos[0].url).toEqual(
  //     `https://www.youtube.com/embed/nqNXjxpAPkU`,
  //   );
  //   expect(res.favicons.length).toBeGreaterThan(0);
  //   expect(res.contentType.toLowerCase()).toEqual(`text/html`);
  // });
});

describe(`#getPreviewFromContent`, () => {
  it(`Basic parsing`, async () => {
    const linkInfo: any = await getPreviewFromContent(prefetchedResponse);

    expect(linkInfo.url).toEqual(`https://www.youtube.com/watch?v=wuClZjOdT30`);
    expect(linkInfo.siteName).toEqual(`YouTube`);
    expect(linkInfo.title).toEqual(`Geography Now! Germany`);
    expect(linkInfo.description).toBeTruthy();
    expect(linkInfo.mediaType).toEqual(`video.other`);
    expect(linkInfo.images.length).toEqual(1);
    expect(linkInfo.images[0]).toEqual(
      `https://i.ytimg.com/vi/wuClZjOdT30/maxresdefault.jpg`,
    );
    expect(linkInfo.videos.length).toEqual(0);
    expect(linkInfo.favicons[0]).not.toBe(``);
    expect(linkInfo.contentType.toLowerCase()).toEqual(`text/html`);
  });
});
