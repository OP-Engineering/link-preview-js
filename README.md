
# link-preview-js

[![CircleCI](https://circleci.com/gh/ospfranco/link-preview-js/tree/master.svg?style=svg)](https://circleci.com/gh/ospfranco/link-preview-js/tree/master) [![npm version](https://badge.fury.io/js/link-preview-js.svg)](https://badge.fury.io/js/link-preview-js)

Pure js library that allows you to extract information from a URL or parse text and retrieve information from the first available link.

# WARNING: THIS LIBRARY DOES NOT WORK ON CORS PROTECTED ENVIRONEMNTS, RUNNING IT ON BROWSERS WON'T WORK

Chrome, Firefox, Safari, etc DO NOT ALLOW YOU TO DO CROSS SITE REQUESTS therefore you cannot use this library or even manually request another domain from your web application, read more about [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS).

## Known issues for React-Native
Apparently the fetch especification breaks on some older samsung devices, this is not patchable on this library.

## Usage
Install the library by

`$ yarn add link-preview-js`

Library exposes just one method: getPreview, you have to pass a string (doesn't matter if it is just a URL or a piece of text that contains a URL), the library will take care of parsing it and returning the info of first valid URL info it finds.

URL parsing is done via: https://gist.github.com/dperini/729294

```javascript
import LinkPreview from 'link-preview-js';

...

LinkPreview.getPreview('https://www.youtube.com/watch?v=MejbOFk7H6c')
  .then(data => console.debug(data));

LinkPreview.getPreview('This is a text supposed to be parsed and the first link displayed https://www.youtube.com/watch?v=MejbOFk7H6c')
  .then(data => console.debug(data));
```

## Options
Additionally you can pass an options object which should add more functionality to the parsing of the link

| Property Name | Result        |
| ------------- |:-------------:|
| imagesPropertyType  (**optional**) (ex: 'og')     | Fetches images only with the specified property, `meta[property='${imagesPropertyType}:image']` |
| language  (**optional**) (ex: 'de', 'en-US')     | Fetch content with specific language |


```javascript
LinkPreview.getPreview(
  'https://www.youtube.com/watch?v=MejbOFk7H6c',
  {
    imagesPropertyType: 'og', // fetches only open-graph images
    language: 'fr-CA', // fetches site for French language
  })
  .then(data => console.debug(data));
```


## Returns
Returns a Promise that resolves with an object describing the provided link.
The info object returned varies depending on the content type (MIME type) returned
in the HTTP response (see below for variations of response).  Rejects with an error if response can not be parsed or if there was no URL in the text provided.

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

