import { CONSTANTS } from "./constants";
import { parseResponse, type ILinkPreviewBaseOptions } from "./shared";

export type { ILinkPreviewResponse, IVideoType, IPreFetchedResource } from "./shared";
export { getPreviewFromContent } from "./shared";

/**
 * Same options as the Node entrypoint, minus `resolveDNSHost`: it exists there to
 * guard against SSRF/DNS-rebinding attacks that redirect a request to a server's own
 * loopback/private network, which requires Node's `undici` to pin connections at the
 * TCP layer (see node.ts). Mobile apps don't have a private network of internal
 * services sitting behind localhost to protect against in the first place, and
 * pulling in `undici`/`node:net` here would break bundling on React Native and other
 * non-Node runtimes for a protection that isn't needed on-device.
 */
export interface ILinkPreviewOptions extends ILinkPreviewBaseOptions {}

/**
 * Parses the text, extracts the first link it finds and does a HTTP request
 * to fetch the website content, afterwards it tries to parse the internal HTML
 * and extract the information via meta tags.
 *
 * This is the mobile/browser-safe entrypoint: no Node-only dependencies, and no
 * `resolveDNSHost` SSRF protection (see ILinkPreviewOptions above for why).
 * @param text string, text to be parsed
 * @param options ILinkPreviewOptions
 */
export async function getLinkPreview(text: string, options?: ILinkPreviewOptions) {
  if (!text || typeof text !== `string`) {
    throw new Error(`link-preview-js did not receive a valid url or text`);
  }

  const detectedUrl = text
    .replace(/\n/g, ` `)
    .split(` `)
    .find((token) => CONSTANTS.REGEX_VALID_URL.test(token));

  if (!detectedUrl) {
    throw new Error(`link-preview-js did not receive a valid a url or text`);
  }

  if (options?.followRedirects === `manual` && !options?.handleRedirects) {
    throw new Error(
      `link-preview-js followRedirects is set to manual, but no handleRedirects function was provided`,
    );
  }

  const timeout = options?.timeout ?? 3000; // 3 second timeout default
  const controller = new AbortController();
  const timeoutCounter = setTimeout(() => controller.abort(), timeout);

  const fetchOptions: RequestInit = {
    headers: options?.headers ?? {},
    redirect: options?.followRedirects ?? `error`,
    signal: controller.signal,
  };

  const fetchUrl = options?.proxyUrl ? options.proxyUrl.concat(detectedUrl) : detectedUrl;

  try {
    const fetchWithTimeout = async (url: string) =>
      fetch(url, fetchOptions).catch((e) => {
        if (e.name === `AbortError`) {
          throw new Error(`Request timeout`);
        }

        clearTimeout(timeoutCounter);
        throw e;
      });

    let response = await fetchWithTimeout(fetchUrl);

    if (
      response.status > 300 &&
      response.status < 309 &&
      fetchOptions.redirect === `manual` &&
      options?.handleRedirects
    ) {
      const locationHeader = response.headers.get(`location`) || ``;
      const isAbsoluteURI =
        locationHeader.startsWith("http://") || locationHeader.startsWith("https://");

      // Resolve the URL, handling both absolute and relative URLs
      const forwardedUrl = isAbsoluteURI ? locationHeader : new URL(locationHeader, fetchUrl).href;

      if (!options.handleRedirects(fetchUrl, forwardedUrl)) {
        throw new Error(`link-preview-js could not handle redirect`);
      }

      response = await fetchWithTimeout(forwardedUrl);
    }

    clearTimeout(timeoutCounter);

    const headers: Record<string, string> = {};
    response.headers.forEach((header, key) => {
      headers[key] = header;
    });

    const normalizedResponse = {
      url: options?.proxyUrl ? response.url.replace(options.proxyUrl, ``) : response.url,
      headers,
      data: await response.text(),
    };

    return parseResponse(normalizedResponse, options);
  } finally {
    clearTimeout(timeoutCounter);
  }
}
