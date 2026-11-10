<h1 align="center">Link Preview JS</h1>

<div align="center">
<img src="https://user-images.githubusercontent.com/1634213/127743288-9f8a99f3-75d8-42c5-9a69-b47c661b7e18.jpg" height="500"/>

<pre align="center">
npm i link-preview-js
</pre>

<a align="center" href="https://github.com/ospfranco?tab=followers">
    <img src="https://img.shields.io/github/followers/ospfranco?label=Follow%20%40ospfranco&style=social" />
  </a>
  <br />
  <a align="center" href="https://twitter.com/ospfranco">
    <img src="https://img.shields.io/twitter/follow/ospfranco?label=Follow%20%40ospfranco&style=social" />
  </a>
</div>

**Before creating an issue**

It's more than likely there is nothing wrong with the library:

- It's very simple; fetch HTML, parse HTML, and search for OpenGraph HTML tags.
- Unless HTML or the OpenGraph standard change, the library will not break
- If the target website you are trying to preview redirects you to a login page **the preview will fail**, because it will parse the login page
- If the target website does not have OpenGraph tags **the preview will most likely fail**, there are some fallbacks but in general, it will not work
- **You cannot preview (fetch) another web page from YOUR web page. This is an intentional security feature of browsers called CORS**

<h1>DO NOT FETCH CONTENT DIRECTLY FROM A USERS DEVICE. ONLY RUN THIS IN YOUR SERVER AND SANDBOX IT IF YOU CAN</h1>
Browsers block this via cors, but you might be clever like a fox and run this in React Native. This is a bad idea, you are exposing the device user to potentially malicious links

If you use this library and find it useful please consider [sponsoring me](https://github.com/sponsors/ospfranco), open source takes a lot of time and effort.

# Link Preview

Allows you to extract information from an HTTP URL/link (or parse an HTML string) and retrieve meta information such as title, description, images, videos, etc. via **OpenGraph** tags.

## Discord

Join the Discord

https://discord.gg/W9XmqCQCKP

## GOTCHAs

- You cannot request a different domain from your web app (Browsers block cross-origin-requests). If you don't know how _same-origin-policy_ works, [here is a good intro](https://dev.to/lydiahallie/cs-visualized-cors-5b8h), therefore **this library works on Node.js and certain mobile run-times (Cordova or React-Native)**.
- **This library acts as if the user would visit the page, sites might re-direct you to sign-up pages, consent screens, etc.** You can try to change the user-agent header (try with `google-bot` or with `Twitterbot`), but you need to work around these issues yourself.

## Entrypoints

This package ships two variants:

- `link-preview-js` / `link-preview-js/node` - full-featured, for Node.js servers. Includes SSRF/DNS-rebinding protection, on by default (see [SSRF Concerns](#ssrf-concerns)), which pins connections at the TCP layer via `undici`.
- `link-preview-js/mobile` - for React Native, Cordova, or other non-Node/browser runtimes. Has no `undici` or `node:net` dependency, so it won't break bundlers that can't resolve Node-only modules. It has no `resolveDNSHost` option either: mobile apps don't sit in front of a private network of internal services the way a server does, so there's no loopback/localhost target worth protecting against on-device.

```typescript
// Node.js server (default import, same as "link-preview-js/node")
import { getLinkPreview } from "link-preview-js";

// React Native / browser / other non-Node runtimes
import { getLinkPreview } from "link-preview-js/mobile";
```

## API

`getLinkPreview`: you have to pass a string, doesn't matter if it is just a URL or a piece of text that contains a URL, the library will take care of parsing it and returning the info o the first valid HTTP(S) URL info it finds.

`getPreviewFromContent`: useful for passing a pre-fetched Response object from an existing async/etc. call. Refer to the example below for required object values.

```typescript
import { getLinkPreview, getPreviewFromContent } from "link-preview-js";

// pass the link directly
getLinkPreview("https://www.youtube.com/watch?v=MejbOFk7H6c").then((data) => console.debug(data));

////////////////////////// OR //////////////////////////

// pass a chunk of text
getLinkPreview(
  "This is a text supposed to be parsed and the first link displayed https://www.youtube.com/watch?v=MejbOFk7H6c",
).then((data) => console.debug(data));

////////////////////////// OR //////////////////////////

// pass a pre-fetched response object
// The passed response object should include, at minimum:
// {
//   data: '<!DOCTYPE...><html>...',     // response content
//   headers: {
//     ...
//     // should include content-type
//     content-type: "text/html; charset=ISO-8859-1",
//     ...
//   },
//   url: 'https://domain.com/'          // resolved url
// }
yourAjaxCall(url, (response) => {
  getPreviewFromContent(response).then((data) => console.debug(data));
});
```

## Options

Additionally, you can pass an options object which should add more functionality to the parsing of the link

| Property Name                                                                          |                                                                                                      Result                                                                                                       |
| -------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| imagesPropertyType (**optional**) (ex: 'og')                                           |                                                          Fetches images only with the specified property, `meta[property='${imagesPropertyType}:image']`                                                          |
| headers (**optional**) (ex: { 'user-agent': 'googlebot', 'Accept-Language': 'en-US' }) |                                                                                         Add request headers to fetch call                                                                                         |
| timeout (**optional**) (ex: 1000)                                                      |                                                                                          Timeout for the request to fail                                                                                          |
| followRedirects (**optional**) (default 'error')                                       |          For security reasons, the library does not automatically follow redirects ('error' value), a malicious agent can exploit redirects to steal data, posible values: ('error', 'follow', 'manual')          |
| handleRedirects (**optional**) (with followRedirects 'manual')                         |                                  When followRedirects is set to 'manual' you need to pass a function that validates if the redirectinon is secure, below you can find an example                                  |
| resolveDNSHost (**optional**) (default: built-in `dns.lookup` check)                   | How the host of each requested URL is resolved and checked for SSRF. Omit it for the built-in check, pass your own resolver function, or pass `false` to disable resolution (see [SSRF Concerns](#ssrf-concerns)) |
| onResponse (**optional**)                                                              |                                                                   Function that handles the response object to allow for managing special cases                                                                   |

```javascript
getLinkPreview("https://www.youtube.com/watch?v=MejbOFk7H6c", {
  imagesPropertyType: "og", // fetches only open-graph images
  headers: {
    "user-agent": "googlebot", // fetches with googlebot crawler user agent
    "Accept-Language": "fr-CA", // fetches site for French language
    // ...other optional HTTP request headers
  },
  timeout: 1000,
}).then((data) => console.debug(data));
```

## SSRF Concerns

Doing requests on behalf of your users or using user-provided URLs is dangerous. One such attack is passing a URL whose hostname resolves to an internal address (`localhost`, a private network, or a cloud metadata endpoint like `169.254.169.254`), so your server fetches its own internal resources and hands them back to the attacker. This doesn't affect mobile runtimes (see [Entrypoints](#entrypoints)).

**On the default/`link-preview-js/node` import this is blocked out of the box.** Before every request (the initial link and each redirect hop), the hostname is resolved with `dns.lookup`. If **any** returned address is loopback, private, link-local, CGNAT, unique-local or otherwise reserved, the request is rejected with an `SSRF request detected` error. The connection is then pinned to the addresses that were checked (via a Node `undici` dispatcher), so a DNS server answering differently on the real request (DNS rebinding) can't redirect it. The original hostname is kept, so the `Host` header, SNI and TLS certificate validation are unaffected.

You can replace the built-in check with your own resolver, for example to use a specific DNS server or to cache results:

```ts
const dns = require("node:dns");
getLinkPreview("http://maliciousLocalHostRedirection.com", {
  resolveDNSHost: async (url: string) => {
    return new Promise((resolve, reject) => {
      const hostname = new URL(url).hostname;
      dns.lookup(hostname, (err, address, family) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(address); // if address resolves to localhost or '127.0.0.1' library will throw an error
      });
    });
  },
}).catch((e) => {
  // will throw a detected redirection to localhost
});
```

A custom resolver may return an IP address, which is validated and then used for the request, or a URL, which is trusted and fetched as-is. With an IP address, `http://` requests are sent to that IP directly. `https://` requests keep the original hostname, since rewriting it to an IP would break TLS, and the connection is pinned to the address instead.

To fetch internal hosts on purpose (e.g. previews of intranet pages), pass `resolveDNSHost: false`. This skips resolution entirely: only URLs that literally contain a private or loopback address, or a known internal hostname, are rejected, and any hostname pointing at an internal address will be fetched. Don't use it with user-provided URLs.

Notes:

- Connection pinning is only enforced under Node.js. Bun's built-in `undici` replacement ignores it, so on Bun the pre-request check is the only protection, which leaves a small DNS-rebinding window.
- With `proxyUrl`, the target is still resolved and checked locally, but the connection isn't pinned: the proxy decides where the request actually goes.

## Redirections

Same to SSRF, following redirections is dangerous, the library errors by default when the response tries to redirect the user. There are however some simple redirections that are valid (e.g. HTTP to HTTPS) and you might want to allow them, you can do it via:

```ts
await getLinkPreview(`http://google.com/`, {
  followRedirects: `manual`,
  handleRedirects: (baseURL: string, forwardedURL: string) => {
    const urlObj = new URL(baseURL);
    const forwardedURLObj = new URL(forwardedURL);
    if (
      forwardedURLObj.hostname === urlObj.hostname ||
      forwardedURLObj.hostname === "www." + urlObj.hostname ||
      "www." + forwardedURLObj.hostname === urlObj.hostname
    ) {
      return true;
    } else {
      return false;
    }
  },
});
```

`handleRedirects` is called for every hop of a redirect chain (`baseURL` is the URL that redirected, `forwardedURL` where it points to), up to 20 redirects. Whether redirects are followed with `'follow'` or `'manual'`, every hop goes through the same SSRF checks as the original URL (including `resolveDNSHost`) before it's requested.

## onResponse

In some cases the website might be missing OpenGraph tags and you might want to provide your own custom logic to try to parse data. For example, if the library is unable to detect a description, you might want to use the text value of the first paragraph instead. This callback gives you access to the Cheerio (the library internally used to parse the HTML) instance, as well as the URL object so you could handle cases on a site-by-site basis, if you need to. This callback must return the modified response object

```javascript
await getLinkPreview(`https://example.com/`, {
  onResponse: (response, doc, URL) => {
    if (URL.hostname == "example.com") {
      response.siteName = "Example Website";
    }

    if (!response.description) {
      response.description = doc("p").first().text();
    }

    return response;
  },
});
```

## Response

Returns a Promise that resolves with an object describing the provided link.
The info object returned varies depending on the content type (MIME type) returned
in the HTTP response (see below for variations of response). Rejects with an error if the response can not be parsed or if there was no URL in the text provided.

### Text/HTML URL

```javascript
{
  url: "https://www.youtube.com/watch?v=MejbOFk7H6c",
  title: "OK Go - Needing/Getting - Official Video - YouTube",
  siteName: "YouTube",
  description: "Buy the video on iTunes: https://itunes.apple.com/us/album/needing-getting-bundle-ep/id508124847 See more about the guitars at: http://www.gretschguitars.com...",
  images: ["https://i.ytimg.com/vi/MejbOFk7H6c/maxresdefault.jpg"],
  mediaType: "video.other",
  contentType: "text/html",
  charset: "utf-8"
  videos: [],
  favicons:["https://www.youtube.com/yts/img/favicon_32-vflOogEID.png","https://www.youtube.com/yts/img/favicon_48-vflVjB_Qk.png","https://www.youtube.com/yts/img/favicon_96-vflW9Ec0w.png","https://www.youtube.com/yts/img/favicon_144-vfliLAfaB.png","https://s.ytimg.com/yts/img/favicon-vfl8qSV2F.ico"]
}
```

### Image URL

```javascript
{
  url: "https://media.npr.org/assets/img/2018/04/27/gettyimages-656523922nunes-4bb9a194ab2986834622983bb2f8fe57728a9e5f-s1100-c15.jpg",
  mediaType: "image",
  contentType: "image/jpeg",
  favicons: [ "https://media.npr.org/favicon.ico" ]
}
```

### Audio URL

```javascript
{
  url: "https://ondemand.npr.org/anon.npr-mp3/npr/atc/2007/12/20071231_atc_13.mp3",
  mediaType: "audio",
  contentType: "audio/mpeg",
  favicons: [ "https://ondemand.npr.org/favicon.ico" ]
}
```

### Video URL

```javascript
{
  url: "https://www.w3schools.com/html/mov_bbb.mp4",
  mediaType: "video",
  contentType: "video/mp4",
  favicons: [ "https://www.w3schools.com/favicon.ico" ]
}
```

### Application URL

```javascript
{
  url: "https://assets.curtmfg.com/masterlibrary/56282/installsheet/CME_56282_INS.pdf",
  mediaType: "application",
  contentType: "application/pdf",
  favicons: [ "https://assets.curtmfg.com/favicon.ico" ]
}
```

## License

MIT license
