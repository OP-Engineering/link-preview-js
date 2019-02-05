
# react-native-link-preview

# I'm kinda done maintaining this project, looking for somebody to take over the repo and the npm package, message me if you are interested: ospfranco@protonmail.com
# MY ADVICE: CORS is there for a reason, it is a bad idea to directly fetch the response from an unkown server into the user device, if you really need this, you should pipe the request through your server, this library is able to do so because it works on node environments (for now, both xmlhttprequest and axios now do CORS requests), so if you need to fetch some sort of link preview do it through a server

# THIS LIBRARY DOES NOT WORK ON CORS PROTECTED ENVIRONMENTS: CHROME, FIREFOX, SAFARI, ETC

Pure js library that allows you to extract information from a URL or parse text and retrieve information from the first available link.

## On the naming and runnable environments
Library should work on node environments (thanks @uriva and @itaibs), library retains it's original name because it was originally created to work on react-native (and re-publishing on npm might break stuff), it is a generic js library so it should work wherever you can run JS, EXCEPT:

Chrome, Firefox, Safari, etc DO NOT ALLOW YOU TO DO CROSS SITE REQUESTS therefore you cannot use this library or even manually request another domain from your web browser application (read more about CORS https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS).

## Known issues
Apparently the fetch especification breaks on some older samsung devices, a patch was made trying to fix this by using XMLHttpRequest, however this brings other problems, including breaking compatibility with node.js, so this was reverted, and this is final.

If you face any problem on some older devices, my suggestion is to handle the error as gracefully as possible or roll your own implemntation on server-side (CORS is there for a reason), you can add pressure for the react-native to patch this issue here: https://github.com/facebook/react-native/issues/10756

## Getting started

`$ npm install -S react-native-link-preview`

or

`$ yarn add react-native-link-preview`

## Usage
Library exposes just one method: getPreview, you have to pass a string (doesn't matter if it is just a URL or a piece of text that contains a URL), the library will take care of parsing it and returning the info of first valid URL info it finds.

URL parsing is done via: https://gist.github.com/dperini/729294

```javascript
import LinkPreview from 'react-native-link-preview';

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


```javascript
LinkPreview.getPreview(
  'https://www.youtube.com/watch?v=MejbOFk7H6c',
  {
    imagesPropertyType: 'og', // fetches only open-graph images
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
npm test
```

## License

MIT license

## Donate
Help me continue the development of this package

[![paypal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=66WAVZ87HB34J)

