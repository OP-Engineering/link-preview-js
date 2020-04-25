# link-preview-js

[![CircleCI](https://circleci.com/gh/ospfranco/link-preview-js/tree/master.svg?style=svg)](https://circleci.com/gh/ospfranco/link-preview-js/tree/master) [![npm version](https://badge.fury.io/js/link-preview-js.svg)](https://badge.fury.io/js/link-preview-js)

Typescript library that allows you to extract information from a URL or parse text and retrieve information from the first available link.

## This library does not work on CORS protected environments, i.e: all the major browsers

Chrome, Firefox, Safari, etc DO NOT ALLOW YOU TO DO CROSS SITE REQUESTS therefore you cannot request another domain from your web application, read more about [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS).

## This library uses [cheerio-without-native](https://github.com/oyyd/cheerio-without-node-native), github is now warning me that there are security vunerabilities because the package has been abandonded, I'm not responsible for any security implications this might carry, I could use cheerio but that means loosing compatibility with RN, which actually might not be a bad idea...

As of 23 of April of 2020: Do not use https://google.com it does not return the appropiate tags to be parsed

# Migration to 2.X.X

The api for version 2.X.X changed slightly, there is no longer a default unnamed export, only a named method export `getLinkPreview`

## Install

`$ yarn add link-preview-js`

## Usage

Library exposes just one method `getLinkPreview`, you have to pass a string, doesn't matter if it is just a URL or a piece of text that contains a URL, the library will take care of parsing it and returning the info of first valid HTTP(S) URL info it finds.

URL parsing is done via: https://gist.github.com/dperini/729294

```typescript
import {getLinkPreview} from 'link-preview-js';

getLinkPreview('https://www.youtube.com/watch?v=MejbOFk7H6c')
  .then((data) => console.debug(data));

getLinkPreview('This is a text supposed to be parsed and the first link displayed https://www.youtube.com/watch?v=MejbOFk7H6c')
  .then((data) => console.debug(data));
```

## Options

Additionally you can pass an options object which should add more functionality to the parsing of the link

| Property Name                                                                          |                                             Result                                              |
| -------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------: |
| imagesPropertyType (**optional**) (ex: 'og')                                           | Fetches images only with the specified property, `meta[property='${imagesPropertyType}:image']` |
| headers (**optional**) (ex: { 'user-agent': 'googlebot', 'Accept-Language': 'en-US' }) |                                Add request headers to fetch call                                |

```javascript
getLinkPreview("https://www.youtube.com/watch?v=MejbOFk7H6c", {
  imagesPropertyType: "og", // fetches only open-graph images
  headers: {
    "user-agent": "googlebot" // fetches with googlebot crawler user agent
    "Accept-Language": "fr-CA", // fetches site for French language
    // ...other optional HTTP request headers
  }
}).then(data => console.debug(data));
```

## Response

Returns a Promise that resolves with an object describing the provided link.
The info object returned varies depending on the content type (MIME type) returned
in the HTTP response (see below for variations of response). Rejects with an error if response can not be parsed or if there was no URL in the text provided.

### Text/HTML URL

```
{
  url: "https://www.youtube.com/watch?v=MejbOFk7H6c",
  title: "OK Go - Needing/Getting - Official Video - YouTube",
  siteName: "YouTube",
  description: "Buy the video on iTunes: https://itunes.apple.com/us/album/needing-getting-bundle-ep/id508124847 See more about the guitars at: http://www.gretschguitars.com...",
  images: ["https://i.ytimg.com/vi/MejbOFk7H6c/maxresdefault.jpg"],
  mediaType: "video.other",
  contentType: "text/html; charset=utf-8"
  videos: [],
  favicons:["https://www.youtube.com/yts/img/favicon_32-vflOogEID.png","https://www.youtube.com/yts/img/favicon_48-vflVjB_Qk.png","https://www.youtube.com/yts/img/favicon_96-vflW9Ec0w.png","https://www.youtube.com/yts/img/favicon_144-vfliLAfaB.png","https://s.ytimg.com/yts/img/favicon-vfl8qSV2F.ico"]
}
```

### Image URL

```
{
  url: "https://media.npr.org/assets/img/2018/04/27/gettyimages-656523922nunes-4bb9a194ab2986834622983bb2f8fe57728a9e5f-s1100-c15.jpg",
  mediaType: "image",
  contentType: "image/jpeg",
  favicons: [ "https://media.npr.org/favicon.ico" ]
}
```

### Audio URL

```
{
  url: "https://ondemand.npr.org/anon.npr-mp3/npr/atc/2007/12/20071231_atc_13.mp3",
  mediaType: "audio",
  contentType: "audio/mpeg",
  favicons: [ "https://ondemand.npr.org/favicon.ico" ]
}
```

### Video URL

```
{
  url: "https://www.w3schools.com/html/mov_bbb.mp4",
  mediaType: "video",
  contentType: "video/mp4",
  favicons: [ "https://www.w3schools.com/favicon.ico" ]
}
```

### Application URL

```
{
  url: "https://assets.curtmfg.com/masterlibrary/56282/installsheet/CME_56282_INS.pdf",
  mediaType: "application",
  contentType: "application/pdf",
  favicons: [ "https://assets.curtmfg.com/favicon.ico" ]
}
```

## Tests

```
yarn test
```

## License

MIT license

## Sponsor

If you find this package useful, please considering [sponsoring](https://github.com/sponsors/ospfranco), buying a coffee is enough, thanks!
