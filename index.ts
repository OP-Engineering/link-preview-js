import { load, type Cheerio, type CheerioAPI, type Element } from "cheerio";
import { BlockList, isIP } from "node:net";
import { Agent, type Dispatcher } from "undici";
import { CONSTANTS } from "./constants";

interface ILinkPreviewResponse {
  url: string;
  title: string;
  siteName: string | undefined;
  author: string | undefined;
  description: string | undefined;
  mediaType: string;
  contentType: string | undefined;
  images: string[];
  videos: IVideoType[];
  favicons: string[];
}

interface IVideoType {
  url: string | undefined;
  secureUrl: string | null | undefined;
  type: string | null | undefined;
  width: string | undefined;
  height: string | undefined;
}

interface ILinkPreviewOptions {
  headers?: Record<string, string>;
  imagesPropertyType?: string;
  proxyUrl?: string;
  timeout?: number;
  followRedirects?: `follow` | `error` | `manual`;
  resolveDNSHost?: (url: string) => Promise<string>;
  handleRedirects?: (baseURL: string, forwardedURL: string) => boolean;
  onResponse?: (response: ILinkPreviewResponse, doc: CheerioAPI, url?: URL) => ILinkPreviewResponse;
}

interface IPreFetchedResource {
  headers: Record<string, string>;
  status?: number;
  imagesPropertyType?: string;
  proxyUrl?: string;
  url: string;
  data: string;
}

const BLOCKED_ADDRESSES = new BlockList();

BLOCKED_ADDRESSES.addSubnet("0.0.0.0", 8, "ipv4");
BLOCKED_ADDRESSES.addSubnet("10.0.0.0", 8, "ipv4");
BLOCKED_ADDRESSES.addSubnet("100.64.0.0", 10, "ipv4");
BLOCKED_ADDRESSES.addSubnet("127.0.0.0", 8, "ipv4");
BLOCKED_ADDRESSES.addSubnet("169.254.0.0", 16, "ipv4");
BLOCKED_ADDRESSES.addSubnet("172.16.0.0", 12, "ipv4");
BLOCKED_ADDRESSES.addSubnet("192.0.2.0", 24, "ipv4");
BLOCKED_ADDRESSES.addSubnet("192.168.0.0", 16, "ipv4");
BLOCKED_ADDRESSES.addSubnet("198.51.100.0", 24, "ipv4");
BLOCKED_ADDRESSES.addSubnet("203.0.113.0", 24, "ipv4");
BLOCKED_ADDRESSES.addSubnet("224.0.0.0", 4, "ipv4");
BLOCKED_ADDRESSES.addSubnet("240.0.0.0", 4, "ipv4");
BLOCKED_ADDRESSES.addAddress("::", "ipv6");
BLOCKED_ADDRESSES.addAddress("::1", "ipv6");
BLOCKED_ADDRESSES.addSubnet("fc00::", 7, "ipv6");
BLOCKED_ADDRESSES.addSubnet("fe80::", 10, "ipv6");

type FetchOptions = RequestInit & {
  dispatcher?: Dispatcher;
};

function parseIPv4Address(address: string) {
  const parts = address.split(".");

  if (parts.length !== 4) {
    return undefined;
  }

  const octets = parts.map((part) => Number(part));

  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return undefined;
  }

  return octets;
}

function parseIPv6Hextets(address: string) {
  const addressWithoutZone = address.split("%")[0];
  const ipv4Match = addressWithoutZone.match(/(.+:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  let normalizedAddress = addressWithoutZone;

  if (ipv4Match) {
    const octets = parseIPv4Address(ipv4Match[2]);

    if (!octets) {
      return undefined;
    }

    normalizedAddress =
      ipv4Match[1] +
      [
        ((octets[0] << 8) | octets[1]).toString(16),
        ((octets[2] << 8) | octets[3]).toString(16),
      ].join(":");
  }

  const compressedParts = normalizedAddress.toLowerCase().split("::");

  if (compressedParts.length > 2) {
    return undefined;
  }

  const left = compressedParts[0] ? compressedParts[0].split(":") : [];
  const right = compressedParts[1] ? compressedParts[1].split(":") : [];
  const missing = 8 - left.length - right.length;

  if (missing < 0 || (compressedParts.length === 1 && missing !== 0)) {
    return undefined;
  }

  const hextets = [...left, ...Array(missing).fill("0"), ...right].map((part) => {
    if (!/^[\da-f]{1,4}$/i.test(part)) {
      return undefined;
    }

    return Number.parseInt(part, 16);
  });

  if (hextets.some((part) => part === undefined)) {
    return undefined;
  }

  return hextets as number[];
}

function ipv4FromHextets(high: number, low: number) {
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

function getEmbeddedIPv4Address(address: string) {
  const hextets = parseIPv6Hextets(address);

  if (!hextets) {
    return undefined;
  }

  const firstFiveAreZero = hextets.slice(0, 5).every((part) => part === 0);
  const firstSixAreZero = firstFiveAreZero && hextets[5] === 0;
  const isIPv4Mapped = firstFiveAreZero && hextets[5] === 0xffff;
  const isNat64WellKnownPrefix =
    hextets[0] === 0x64 && hextets[1] === 0xff9b && hextets.slice(2, 6).every((part) => part === 0);

  if (firstSixAreZero || isIPv4Mapped || isNat64WellKnownPrefix) {
    return ipv4FromHextets(hextets[6], hextets[7]);
  }

  if (hextets[0] === 0x2002) {
    return ipv4FromHextets(hextets[1], hextets[2]);
  }

  return undefined;
}

function throwOnLoopback(address: string) {
  const normalizedAddress = address.trim();
  const ipVersion = isIP(normalizedAddress);

  if (ipVersion) {
    const family = ipVersion === 4 ? "ipv4" : "ipv6";

    const embeddedIPv4Address =
      ipVersion === 6 ? getEmbeddedIPv4Address(normalizedAddress) : undefined;

    if (
      BLOCKED_ADDRESSES.check(normalizedAddress, family) ||
      (embeddedIPv4Address && BLOCKED_ADDRESSES.check(embeddedIPv4Address, "ipv4"))
    ) {
      throw new Error("SSRF request detected, trying to query host");
    }

    return;
  }

  if (CONSTANTS.REGEX_LOOPBACK.test(normalizedAddress)) {
    throw new Error("SSRF request detected, trying to query host");
  }
}

function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/\.$/, "");
}

function createPinnedDispatcher(url: string, resolvedAddress?: string) {
  if (!resolvedAddress) {
    return undefined;
  }

  const address = resolvedAddress.trim();
  const family = isIP(address);

  if (!family) {
    throw new Error("resolveDNSHost must resolve to an IP address");
  }

  const expectedHostname = normalizeHostname(new URL(url).hostname);

  return new Agent({
    connect: {
      lookup(
        hostname: string,
        lookupOptions: { all?: boolean },
        callback: (...args: any[]) => void,
      ) {
        if (normalizeHostname(hostname) !== expectedHostname) {
          callback(new Error("SSRF request detected, hostname changed after DNS validation"));
          return;
        }

        if (lookupOptions?.all) {
          callback(null, [{ address, family }]);
          return;
        }

        callback(null, address, family);
      },
    },
  });
}

function getFetchOptions(fetchOptions: RequestInit, dispatcher?: Dispatcher): FetchOptions {
  if (!dispatcher) {
    return fetchOptions;
  }

  return {
    ...fetchOptions,
    dispatcher,
  };
}

async function destroyDispatchers(dispatchers: Dispatcher[]) {
  await Promise.all(
    dispatchers.map(async (dispatcher) => {
      const disposableDispatcher = dispatcher as Dispatcher & {
        close?: () => Promise<void> | void;
        destroy?: () => Promise<void> | void;
      };

      try {
        if (typeof disposableDispatcher.destroy === "function") {
          await disposableDispatcher.destroy();
          return;
        }

        await disposableDispatcher.close?.();
      } catch {
        // Ignore dispatcher disposal errors; the request result has already been handled.
      }
    }),
  );
}

function metaTag(doc: CheerioAPI, type: string, attr: string) {
  const nodes = doc(`meta[${attr}='${type}']`);
  return nodes.length ? nodes : null;
}

function metaTagContent(doc: CheerioAPI, type: string, attr: string) {
  return doc(`meta[${attr}='${type}']`).attr(`content`);
}

function getTitle(doc: CheerioAPI) {
  let title =
    metaTagContent(doc, `og:title`, `property`) || metaTagContent(doc, `og:title`, `name`);
  if (!title) {
    title = doc(`head > title`).text();
  }
  return title;
}

function getSiteName(doc: CheerioAPI) {
  const siteName =
    metaTagContent(doc, `og:site_name`, `property`) || metaTagContent(doc, `og:site_name`, `name`);
  return siteName;
}

function getAuthor(doc: CheerioAPI) {
  const author =
    metaTagContent(doc, `author`, `name`) || metaTagContent(doc, `article:author`, `property`);
  return author;
}

function getDescription(doc: CheerioAPI) {
  const description =
    metaTagContent(doc, `description`, `name`) ||
    metaTagContent(doc, `Description`, `name`) ||
    metaTagContent(doc, `og:description`, `property`);
  return description;
}

function getMediaType(doc: CheerioAPI) {
  const node = metaTag(doc, `medium`, `name`);
  if (node) {
    const content = node.attr(`content`);
    return content === `image` ? `photo` : content;
  }
  return metaTagContent(doc, `og:type`, `property`) || metaTagContent(doc, `og:type`, `name`);
}

function getImages(doc: CheerioAPI, rootUrl: string, imagesPropertyType?: string) {
  let images: string[] = [];
  let nodes: Cheerio<Element> | null;
  let src: string | undefined;
  let dic: Record<string, boolean> = {};

  const imagePropertyType = imagesPropertyType ?? `og`;
  nodes =
    metaTag(doc, `${imagePropertyType}:image`, `property`) ||
    metaTag(doc, `${imagePropertyType}:image`, `name`);

  if (nodes) {
    nodes.each((_: number, node: Element) => {
      if (node.type === `tag`) {
        src = node.attribs.content;
        if (src) {
          src = new URL(src, rootUrl).href;
          images.push(src);
        }
      }
    });
  }

  if (images.length <= 0 && !imagesPropertyType) {
    src = doc(`link[rel=image_src]`).attr(`href`);
    if (src) {
      src = new URL(src, rootUrl).href;
      images = [src];
    } else {
      nodes = doc(`img`);

      if (nodes?.length) {
        dic = {};
        images = [];
        nodes.each((_: number, node: Element) => {
          if (node.type === `tag`) src = node.attribs.src;
          if (src && !dic[src]) {
            dic[src] = true;
            // width = node.attribs.width;
            // height = node.attribs.height;
            images.push(new URL(src, rootUrl).href);
          }
        });
      }
    }
  }

  return images;
}

function getVideos(doc: CheerioAPI) {
  const videos = [];
  let nodeTypes;
  let nodeSecureUrls;
  let nodeType;
  let nodeSecureUrl;
  let video;
  let videoType;
  let videoSecureUrl;
  let width;
  let height;
  let videoObj;
  let index;

  const nodes = metaTag(doc, `og:video`, `property`) || metaTag(doc, `og:video`, `name`);

  if (nodes?.length) {
    nodeTypes = metaTag(doc, `og:video:type`, `property`) || metaTag(doc, `og:video:type`, `name`);
    nodeSecureUrls =
      metaTag(doc, `og:video:secure_url`, `property`) ||
      metaTag(doc, `og:video:secure_url`, `name`);
    width =
      metaTagContent(doc, `og:video:width`, `property`) ||
      metaTagContent(doc, `og:video:width`, `name`);
    height =
      metaTagContent(doc, `og:video:height`, `property`) ||
      metaTagContent(doc, `og:video:height`, `name`);

    for (index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      if (node.type === `tag`) video = node.attribs.content;

      nodeType = nodeTypes?.[index];
      if (nodeType?.type === `tag`) {
        videoType = nodeType ? nodeType.attribs.content : null;
      }

      nodeSecureUrl = nodeSecureUrls?.[index];
      if (nodeSecureUrl?.type === `tag`) {
        videoSecureUrl = nodeSecureUrl ? nodeSecureUrl.attribs.content : null;
      }

      videoObj = {
        url: video,
        secureUrl: videoSecureUrl,
        type: videoType,
        width,
        height,
      };
      if (videoType && videoType.indexOf(`video/`) === 0) {
        videos.splice(0, 0, videoObj);
      } else {
        videos.push(videoObj);
      }
    }
  }

  return videos;
}

// returns default favicon (//hostname/favicon.ico) for a url
function getDefaultFavicon(rootUrl: string): string {
  return new URL(`/favicon.ico`, rootUrl).href;
}

// returns an array of URLs to favicon images
function getFavicons(doc: CheerioAPI, rootUrl: string): string[] {
  const images = [];
  let nodes: Cheerio<Element>;
  let src: string | undefined;

  const relSelectors = [`rel=icon`, `rel="shortcut icon"`, `rel=apple-touch-icon`];

  relSelectors.forEach((relSelector) => {
    // look for all icon tags
    nodes = doc(`link[${relSelector}]`);

    // collect all images from icon tags
    if (nodes.length) {
      nodes.each((_: number, node: Element) => {
        if (node.type === `tag`) src = node.attribs.href;
        if (src) {
          src = new URL(src, rootUrl).href;
          images.push(src);
        }
      });
    }
  });

  // if no icon images, use default favicon location
  if (images.length <= 0) {
    images.push(getDefaultFavicon(rootUrl));
  }

  return images;
}

function parseImageResponse(url: string, contentType: string) {
  return {
    url,
    mediaType: `image`,
    contentType,
    favicons: [getDefaultFavicon(url)],
  };
}

function parseAudioResponse(url: string, contentType: string) {
  return {
    url,
    mediaType: `audio`,
    contentType,
    favicons: [getDefaultFavicon(url)],
  };
}

function parseVideoResponse(url: string, contentType: string) {
  return {
    url,
    mediaType: `video`,
    contentType,
    favicons: [getDefaultFavicon(url)],
  };
}

function parseApplicationResponse(url: string, contentType: string) {
  return {
    url,
    mediaType: `application`,
    contentType,
    favicons: [getDefaultFavicon(url)],
  };
}

function parseTextResponse(
  body: string,
  url: string,
  options: ILinkPreviewOptions = {},
  contentType?: string,
): ILinkPreviewResponse {
  const doc = load(body);

  let response = {
    url,
    title: getTitle(doc),
    siteName: getSiteName(doc),
    description: getDescription(doc),
    author: getAuthor(doc),
    mediaType: getMediaType(doc) || `website`,
    contentType,
    images: getImages(doc, url, options.imagesPropertyType),
    videos: getVideos(doc),
    favicons: getFavicons(doc, url),
  };

  if (options?.onResponse && typeof options.onResponse !== `function`) {
    throw new Error(`link-preview-js onResponse option must be a function`);
  }

  if (options?.onResponse) {
    // send in a cloned response (to avoid mutation of original response reference)
    const clonedResponse = structuredClone(response);
    const urlObject = new URL(url);
    response = options.onResponse(clonedResponse, doc, urlObject);
  }

  return response;
}

function parseUnknownResponse(
  body: string,
  url: string,
  options: ILinkPreviewOptions = {},
  contentType?: string,
) {
  return parseTextResponse(body, url, options, contentType);
}

function parseResponse(response: IPreFetchedResource, options?: ILinkPreviewOptions) {
  try {
    // console.log("[link-preview-js] response", response);
    let contentType = response.headers[`content-type`];
    let contentTypeTokens: string[] = [];
    let charset = null;

    if (!contentType) {
      return parseUnknownResponse(response.data, response.url, options);
    }

    if (contentType.includes(`;`)) {
      contentTypeTokens = contentType.split(`;`);
      contentType = contentTypeTokens[0];

      for (let token of contentTypeTokens) {
        if (token.indexOf("charset=") !== -1) {
          charset = token.split("=")[1];
        }
      }
    }

    // parse response depending on content type
    if (CONSTANTS.REGEX_CONTENT_TYPE_IMAGE.test(contentType)) {
      return { ...parseImageResponse(response.url, contentType), charset };
    }

    if (CONSTANTS.REGEX_CONTENT_TYPE_AUDIO.test(contentType)) {
      return { ...parseAudioResponse(response.url, contentType), charset };
    }

    if (CONSTANTS.REGEX_CONTENT_TYPE_VIDEO.test(contentType)) {
      return { ...parseVideoResponse(response.url, contentType), charset };
    }

    if (CONSTANTS.REGEX_CONTENT_TYPE_TEXT.test(contentType)) {
      return {
        ...parseTextResponse(response.data, response.url, options, contentType),
        charset,
      };
    }

    if (CONSTANTS.REGEX_CONTENT_TYPE_APPLICATION.test(contentType)) {
      return {
        ...parseApplicationResponse(response.url, contentType),
        charset,
      };
    }

    const htmlString = response.data;

    return {
      ...parseUnknownResponse(htmlString, response.url, options),
      charset,
    };
  } catch (e) {
    throw new Error(`link-preview-js could not fetch link information ${(e as any).toString()}`);
  }
}

/**
 * Parses the text, extracts the first link it finds and does a HTTP request
 * to fetch the website content, afterwards it tries to parse the internal HTML
 * and extract the information via meta tags
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

  let resolvedUrl: string | undefined;

  if (options?.resolveDNSHost) {
    resolvedUrl = await options.resolveDNSHost(detectedUrl);

    throwOnLoopback(resolvedUrl);
  } else {
    console.error(
      "[link-preview-js] You are not resolving DNS addresses (resolveDNSHost option) before fetching a link. This can cause loopback attacks. Always try to resolve DNS addresses",
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
  const dispatchers: Dispatcher[] = [];

  try {
    const dispatcher = options?.proxyUrl
      ? undefined
      : createPinnedDispatcher(fetchUrl, resolvedUrl);

    if (dispatcher) {
      dispatchers.push(dispatcher);
    }

    let response = await fetch(fetchUrl, getFetchOptions(fetchOptions, dispatcher)).catch((e) => {
      if (e.name === `AbortError`) {
        throw new Error(`Request timeout`);
      }

      clearTimeout(timeoutCounter);
      throw e;
    });

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

      let forwardedResolvedUrl: string | undefined;

      if (options?.resolveDNSHost) {
        forwardedResolvedUrl = await options.resolveDNSHost(forwardedUrl);

        throwOnLoopback(forwardedResolvedUrl);
      }

      const forwardedDispatcher = createPinnedDispatcher(forwardedUrl, forwardedResolvedUrl);

      if (forwardedDispatcher) {
        dispatchers.push(forwardedDispatcher);
      }

      response = await fetch(forwardedUrl, getFetchOptions(fetchOptions, forwardedDispatcher));
    }

    clearTimeout(timeoutCounter);

    const headers: Record<string, string> = {};
    response.headers.forEach((header, key) => {
      headers[key] = header;
    });

    const normalizedResponse: IPreFetchedResource = {
      url: options?.proxyUrl ? response.url.replace(options.proxyUrl, ``) : response.url,
      headers,
      data: await response.text(),
    };

    return parseResponse(normalizedResponse, options);
  } finally {
    clearTimeout(timeoutCounter);
    await destroyDispatchers(dispatchers);
  }
}

/**
 * Skip the library fetching the website for you, instead pass a response object
 * from whatever source you get and use the internal parsing of the HTML to return
 * the necessary information
 * @param response Preview Response
 * @param options IPreviewLinkOptions
 */
export async function getPreviewFromContent(
  response: IPreFetchedResource,
  options?: ILinkPreviewOptions,
) {
  if (!response || typeof response !== `object`) {
    throw new Error(`link-preview-js did not receive a valid response object`);
  }

  if (!response.url) {
    throw new Error(`link-preview-js did not receive a valid response object`);
  }

  return parseResponse(response, options);
}
