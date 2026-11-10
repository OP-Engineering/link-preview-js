import dns from "node:dns/promises";
import { Agent, fetch as undiciFetch, type Dispatcher } from "undici";
import { CONSTANTS } from "./constants";
import { parseResponse, type ILinkPreviewBaseOptions } from "./shared";

export type { ILinkPreviewResponse, IVideoType, IPreFetchedResource } from "./shared";
export { getPreviewFromContent } from "./shared";

export interface ILinkPreviewOptions extends ILinkPreviewBaseOptions {
  /**
   * Controls how the host of every URL about to be requested (the initial link and each
   * redirect hop) is resolved and checked against loopback/private/link-local ranges.
   *
   * - `undefined` (default): resolved with `dns.lookup`. The request is rejected if any
   *   returned address is blocked, and the connection is pinned to the validated addresses.
   * - a function: your own resolver, returning an IP address (validated and pinned) or a URL
   *   (trusted verbatim).
   * - `false`: no resolution. Only URLs that literally contain a blocked address or a known
   *   internal hostname are rejected, so hostnames pointing at internal addresses are fetched.
   */
  resolveDNSHost?: ((url: string) => Promise<string>) | false;
}

interface ResolvedAddress {
  address: string;
  family: 4 | 6;
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

function isAddressBlocked(address: string) {
  return isIPv4AddressBlocked(address) || isIPv6AddressBlocked(address);
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
    if (isAddressBlocked(normalizedAddress)) {
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
 * Bun swaps the "undici" package for its own native implementation, which accepts a
 * dispatcher but ignores its `connect.lookup` override, so pinning can't be enforced
 * there. On Bun the pre-fetch address validation is the only protection.
 */
const RUNTIME_HONORS_PINNED_LOOKUP = typeof process === "undefined" || !process.versions?.bun;

/**
 * An undici dispatcher whose DNS lookup always answers with the already-validated
 * addresses, so the connection can't land on a different address than the one that was
 * checked, even if a second DNS query would answer differently (DNS rebinding). The
 * request keeps its hostname, so the Host header, SNI and certificate validation are
 * unaffected.
 */
function createPinnedDispatcher(url: string, addresses: ResolvedAddress[]) {
  if (!RUNTIME_HONORS_PINNED_LOOKUP) {
    return undefined;
  }

  const expectedHostname = normalizeHostnameForComparison(new URL(url).hostname);

  return new Agent({
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
          callback(null, addresses);
          return;
        }

        callback(null, addresses[0].address, addresses[0].family);
      },
    },
  });
}

/**
 * Turns a URL about to be fetched plus its validated resolution into what to actually
 * fetch. This is the single place that decides how a validated address gets used, so
 * there's exactly one path through this logic and no way to end up with a
 * hostname-preserving request that has no pin.
 *
 * - No resolution (`resolveDNSHost: false`): fetch the URL as-is.
 * - Built-in resolution: keep the URL, pin the connection to the validated addresses.
 * - resolveDNSHost returned a URL: trust it verbatim, nothing to pin to.
 * - resolveDNSHost returned an address, plain HTTP: rewrite the hostname to that
 *   address. The rewrite is itself the pin, since the request can't land anywhere else.
 * - resolveDNSHost returned an address, HTTPS: rewriting the hostname to a bare IP
 *   breaks TLS (the IP would be sent as the SNI server name, and certificates are issued
 *   for hostnames). Keep the hostname and pin the connection with a dispatcher instead.
 */
function prepareFetch(url: string, resolution?: HostResolution): PreparedFetch {
  if (!resolution) {
    return { url };
  }

  if (Array.isArray(resolution)) {
    return { url, dispatcher: createPinnedDispatcher(url, resolution) };
  }

  const trimmedResolvedAddressOrUrl = resolution.trim();

  if (
    trimmedResolvedAddressOrUrl.startsWith("http://") ||
    trimmedResolvedAddressOrUrl.startsWith("https://")
  ) {
    // Trusted verbatim - there's no bare address here to validate or pin to.
    return { url: trimmedResolvedAddressOrUrl };
  }

  const resolvedAddress = getResolvedAddress(trimmedResolvedAddressOrUrl);

  if (!resolvedAddress) {
    throw new Error("resolveDNSHost must resolve to an IP address or URL");
  }

  const parsedUrl = new URL(url);

  if (parsedUrl.protocol !== "https:") {
    parsedUrl.hostname = formatHostnameForUrl(resolvedAddress);
    return { url: parsedUrl.href };
  }

  const family = parseIPv4Address(resolvedAddress) ? 4 : 6;

  return { url, dispatcher: createPinnedDispatcher(url, [{ address: resolvedAddress, family }]) };
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

const MAX_REDIRECTS = 20;

function isRedirectStatus(status: number) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function resolveRedirectLocation(locationHeader: string, baseUrl: string, proxyUrl?: string) {
  const location =
    proxyUrl && locationHeader.startsWith(proxyUrl)
      ? locationHeader.slice(proxyUrl.length)
      : locationHeader;

  return new URL(location, baseUrl).href;
}

/**
 * Validates a URL about to be requested, either the initial link or a redirect target.
 * The URL must be normalized first: `new URL()` rewrites hostnames (fullwidth digits to
 * ASCII, for example), so checking the raw text would validate a different host than
 * the one that gets fetched. The hostname (not the whole URL) is checked for literal
 * loopback/private addresses, since REGEX_LOOPBACK could otherwise match an IP-looking
 * path segment.
 */
function throwOnDisallowedUrl(url: string) {
  const normalizedUrl = new URL(url);

  if (!CONSTANTS.REGEX_VALID_URL.test(normalizedUrl.href)) {
    throw new Error("SSRF request detected, URL is not allowed");
  }

  throwOnLoopback(normalizedUrl.hostname);
}

/**
 * What a URL's host resolved to, after validation:
 * - `undefined`: not resolved (`resolveDNSHost: false`)
 * - `string`: what the caller's resolveDNSHost returned
 * - `ResolvedAddress[]`: what the built-in resolver returned
 */
type HostResolution = string | ResolvedAddress[] | undefined;

/**
 * The default SSRF protection: resolves the URL's host the same way the request
 * would, and rejects it if any returned address is blocked. Checking every address
 * (not just the first) matters because the connection may fall back to any of them.
 * An address that can't be parsed fails closed.
 */
async function lookupAndValidateHost(url: string): Promise<ResolvedAddress[]> {
  const hostname = stripIPv6Brackets(new URL(url).hostname);
  const literalAddress = normalizeIPAddress(hostname);
  const results = literalAddress
    ? [{ address: literalAddress, family: parseIPv4Address(literalAddress) ? 4 : 6 }]
    : await dns.lookup(hostname, { all: true });

  if (results.length === 0) {
    throw new Error(`link-preview-js could not resolve ${hostname}`);
  }

  return results.map(({ address, family }) => {
    const normalizedAddress = normalizeIPAddress(address);

    if (!normalizedAddress || isAddressBlocked(normalizedAddress)) {
      throw new Error("SSRF request detected, trying to query host");
    }

    return { address: normalizedAddress, family: family === 6 ? 6 : 4 };
  });
}

/**
 * Resolves and validates the host of a URL that's about to be fetched, with the
 * caller's resolveDNSHost or the built-in resolver. Applied to the initial link and
 * every redirect hop.
 */
async function resolveAndValidateHost(
  url: string,
  options?: ILinkPreviewOptions,
): Promise<HostResolution> {
  if (options?.resolveDNSHost === false) {
    return undefined;
  }

  if (!options?.resolveDNSHost) {
    return lookupAndValidateHost(url);
  }

  const resolvedUrl = await options.resolveDNSHost(url);

  throwOnLoopback(resolvedUrl);

  return resolvedUrl;
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

  throwOnDisallowedUrl(detectedUrl);

  if (options?.followRedirects === `manual` && !options?.handleRedirects) {
    throw new Error(
      `link-preview-js followRedirects is set to manual, but no handleRedirects function was provided`,
    );
  }

  const resolution = await resolveAndValidateHost(detectedUrl, options);

  const timeout = options?.timeout ?? 3000; // 3 second timeout default
  const controller = new AbortController();
  const timeoutCounter = setTimeout(() => controller.abort(), timeout);
  const redirectMode = options?.followRedirects ?? `error`;

  // Redirects are never handed to fetch to follow on its own: an internally followed
  // hop would skip the SSRF checks below (and, for plain HTTP, any pinning), letting a
  // public page redirect the request to a loopback/private address. Every hop is
  // instead fetched with `manual` and validated here before being requested.
  const fetchOptions: RequestInit = {
    headers: options?.headers ?? {},
    redirect: redirectMode === `error` ? `error` : `manual`,
    signal: controller.signal,
  };

  const dispatchers: Dispatcher[] = [];

  const fetchHop = (targetUrl: string, resolution: HostResolution) => {
    // A proxy already changes where the request is physically sent, so pinning the
    // connection to the resolved address would fight the proxy instead of the target -
    // in that case there's nothing for prepareFetch to decide, the proxy URL is it.
    const prepared: PreparedFetch = options?.proxyUrl
      ? { url: options.proxyUrl.concat(targetUrl) }
      : prepareFetch(targetUrl, resolution);

    if (prepared.dispatcher) {
      dispatchers.push(prepared.dispatcher);
    }

    return fetchWithDispatcher(prepared.url, fetchOptions, prepared.dispatcher).catch((e) => {
      if (e.name === `AbortError`) {
        throw new Error(`Request timeout`);
      }

      clearTimeout(timeoutCounter);
      throw e;
    });
  };

  try {
    // The URL as the caller/server sees it, used to resolve relative Location headers
    // (the fetched URL may have been rewritten to an IP or prefixed with a proxy).
    let currentUrl = detectedUrl;
    let response = await fetchHop(detectedUrl, resolution);
    let redirectCount = 0;

    // In `manual` mode handleRedirects approves every hop of the chain, not just the first.
    while (redirectMode !== `error` && isRedirectStatus(response.status)) {
      if (redirectCount >= MAX_REDIRECTS) {
        throw new Error(`link-preview-js exceeded the maximum number of redirects`);
      }

      redirectCount++;

      const locationHeader = response.headers.get(`location`);

      if (!locationHeader) {
        break;
      }

      await response.body?.cancel().catch(() => {});

      const forwardedUrl = resolveRedirectLocation(locationHeader, currentUrl, options?.proxyUrl);

      if (redirectMode === `manual` && !options?.handleRedirects?.(currentUrl, forwardedUrl)) {
        throw new Error(`link-preview-js could not handle redirect`);
      }

      throwOnDisallowedUrl(forwardedUrl);

      currentUrl = forwardedUrl;
      response = await fetchHop(forwardedUrl, await resolveAndValidateHost(forwardedUrl, options));
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
