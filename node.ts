import { Agent, fetch as undiciFetch, type Dispatcher } from "undici";
import { CONSTANTS } from "./constants";
import { parseResponse, type ILinkPreviewBaseOptions } from "./shared";

export type { ILinkPreviewResponse, IVideoType, IPreFetchedResource } from "./shared";
export { getPreviewFromContent } from "./shared";

export interface ILinkPreviewOptions extends ILinkPreviewBaseOptions {
  resolveDNSHost?: (url: string) => Promise<string>;
}

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

function isIPv4AddressBlocked(address: string) {
  const octets = parseIPv4Address(address);

  if (!octets) {
    return false;
  }

  const [first, second, third] = octets;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  );
}

function isIPv6AddressBlocked(address: string) {
  const hextets = parseIPv6Hextets(address);

  if (!hextets) {
    return false;
  }

  const embeddedIPv4Address = getEmbeddedIPv4Address(address);

  return (
    hextets.every((part) => part === 0) ||
    (hextets.slice(0, 7).every((part) => part === 0) && hextets[7] === 1) ||
    (hextets[0] & 0xfe00) === 0xfc00 ||
    (hextets[0] & 0xffc0) === 0xfe80 ||
    Boolean(embeddedIPv4Address && isIPv4AddressBlocked(embeddedIPv4Address))
  );
}

function stripIPv6Brackets(address: string) {
  if (address.startsWith("[") && address.endsWith("]")) {
    return address.slice(1, -1);
  }

  return address;
}

function normalizeIPAddress(address: string) {
  const normalizedAddress = stripIPv6Brackets(address.trim()).split("%")[0];

  if (parseIPv4Address(normalizedAddress)) {
    return normalizedAddress;
  }

  if (parseIPv6Hextets(normalizedAddress)) {
    return normalizedAddress.toLowerCase();
  }

  return undefined;
}

function getResolvedAddress(addressOrUrl: string) {
  const trimmedAddress = addressOrUrl.trim();

  if (trimmedAddress.startsWith("http://") || trimmedAddress.startsWith("https://")) {
    return normalizeIPAddress(new URL(trimmedAddress).hostname);
  }

  return normalizeIPAddress(trimmedAddress);
}

function throwOnLoopback(addressOrUrl: string) {
  const normalizedAddress = getResolvedAddress(addressOrUrl);

  if (normalizedAddress) {
    if (isIPv4AddressBlocked(normalizedAddress) || isIPv6AddressBlocked(normalizedAddress)) {
      throw new Error("SSRF request detected, trying to query host");
    }

    return;
  }

  if (CONSTANTS.REGEX_LOOPBACK.test(addressOrUrl.trim())) {
    throw new Error("SSRF request detected, trying to query host");
  }
}

function formatHostnameForUrl(address: string) {
  return parseIPv6Hextets(address) ? `[${address}]` : address;
}

function normalizeHostnameForComparison(hostname: string) {
  return hostname.toLowerCase().replace(/\.$/, "");
}

interface PreparedFetch {
  url: string;
  dispatcher?: Dispatcher;
}

/**
 * Turns a detected URL plus its resolveDNSHost result into what to actually fetch.
 * This is the single place that decides how a validated address gets used, so there
 * is exactly one path through this logic - not two independently-maintained ones that
 * could quietly drift apart and produce a hostname-preserving request with no pin.
 *
 * - No resolved address: nothing to enforce, fetch the URL as-is.
 * - resolveDNSHost returned a URL: trust it verbatim, nothing to pin to.
 * - Plain HTTP: rewriting the hostname to the resolved IP is itself the pin (the
 *   request can't land anywhere else), so no dispatcher is needed.
 * - HTTPS: rewriting the hostname to a bare IP breaks TLS (the handshake would send
 *   the IP as the SNI server name, and certificate validation fails since
 *   certificates are issued for hostnames, not IPs). The hostname is kept for SNI and
 *   the Host header, and the connection itself is pinned to the validated address
 *   instead via a dispatcher, so a DNS resolver returning something else on the real
 *   request (DNS rebinding) can't route the request anywhere else.
 */
function prepareFetch(url: string, resolvedAddressOrUrl?: string): PreparedFetch {
  if (!resolvedAddressOrUrl) {
    return { url };
  }

  const trimmedResolvedAddressOrUrl = resolvedAddressOrUrl.trim();
  const resolvedAddress = getResolvedAddress(trimmedResolvedAddressOrUrl);

  if (!resolvedAddress) {
    throw new Error("resolveDNSHost must resolve to an IP address or URL");
  }

  if (
    trimmedResolvedAddressOrUrl.startsWith("http://") ||
    trimmedResolvedAddressOrUrl.startsWith("https://")
  ) {
    return { url: trimmedResolvedAddressOrUrl };
  }

  const parsedUrl = new URL(url);

  if (parsedUrl.protocol !== "https:") {
    parsedUrl.hostname = formatHostnameForUrl(resolvedAddress);
    return { url: parsedUrl.href };
  }

  const family = parseIPv4Address(resolvedAddress) ? 4 : 6;
  const expectedHostname = normalizeHostnameForComparison(parsedUrl.hostname);

  const dispatcher = new Agent({
    connect: {
      lookup(
        hostname: string,
        lookupOptions: { all?: boolean },
        callback: (...args: any[]) => void,
      ) {
        if (normalizeHostnameForComparison(hostname) !== expectedHostname) {
          callback(new Error("SSRF request detected, hostname changed after DNS validation"));
          return;
        }

        if (lookupOptions?.all) {
          callback(null, [{ address: resolvedAddress, family }]);
          return;
        }

        callback(null, resolvedAddress, family);
      },
    },
  });

  return { url, dispatcher };
}

/**
 * Node's global `fetch` is powered by its own internal, vendored copy of undici. A
 * `Dispatcher` built from the separately installed `undici` package is a different
 * class instance and isn't recognized by that internal copy, so pinning a connection
 * silently has no effect if it's handed to the global `fetch`. Requests that need a
 * pinned dispatcher are therefore made with undici's own `fetch` instead.
 */
function fetchWithDispatcher(url: string, fetchOptions: RequestInit, dispatcher?: Dispatcher) {
  if (!dispatcher) {
    return fetch(url, fetchOptions);
  }

  return undiciFetch(url, { ...fetchOptions, dispatcher } as Parameters<typeof undiciFetch>[1]);
}

async function destroyDispatchers(dispatchers: Dispatcher[]) {
  await Promise.all(
    dispatchers.map(async (dispatcher) => {
      try {
        await dispatcher.destroy();
      } catch {
        // Ignore dispatcher disposal errors; the request result has already been handled.
      }
    }),
  );
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

  // A proxy already changes where the request is physically sent, so pinning the
  // connection to the resolved address would fight the proxy instead of the target -
  // in that case there's nothing for prepareFetch to decide, the proxy URL is it.
  const initialFetch = options?.proxyUrl
    ? { url: options.proxyUrl.concat(detectedUrl) }
    : prepareFetch(detectedUrl, resolvedUrl);

  const fetchUrl = initialFetch.url;
  const dispatchers: Dispatcher[] = [];

  if (initialFetch.dispatcher) {
    dispatchers.push(initialFetch.dispatcher);
  }

  try {
    const fetchWithTimeout = async (url: string, requestDispatcher?: Dispatcher) =>
      fetchWithDispatcher(url, fetchOptions, requestDispatcher).catch((e) => {
        if (e.name === `AbortError`) {
          throw new Error(`Request timeout`);
        }

        clearTimeout(timeoutCounter);
        throw e;
      });

    let response = await fetchWithTimeout(fetchUrl, initialFetch.dispatcher);

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

      const forwardedFetch = options?.proxyUrl
        ? { url: forwardedUrl }
        : prepareFetch(forwardedUrl, forwardedResolvedUrl);

      if (forwardedFetch.dispatcher) {
        dispatchers.push(forwardedFetch.dispatcher);
      }

      response = await fetchWithTimeout(forwardedFetch.url, forwardedFetch.dispatcher);
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
    await destroyDispatchers(dispatchers);
  }
}
