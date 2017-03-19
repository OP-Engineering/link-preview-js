
# react-native-link-preview

Allows to extract information from an URL or parse a text and retrieve information from the first available link.

## Getting started

`$ npm install -S react-native-link-preview`

## Usage
Library exposes just one method: getPreview, you have to pass a string (doesn't matter if it is just an URL or a piece of text that contains an URL), the library will take care of parsing it and returning the info of first valid URL info it finds.

The parsing is done automatically via [Autolinker](https://github.com/gregjacobs/Autolinker.js/), if you have problems getting your URL recognized you can dig their documentation for a valid regex.

```javascript
import LinkPreview from 'react-native-link-preview';

LinkPreview.getPreview('https://www.youtube.com/watch?v=MejbOFk7H6c')
.then(data => console.warn(data))
.catch(err => console.warn(err))

LinkPreview.getPreview('This is a text supposed to be parsed and the first link displayed https://www.youtube.com/watch?v=MejbOFk7H6c')
.then(data => console.warn(data))
.catch(err => console.warn(err))
```

Returns
```
{
  url: "https://www.youtube.com/watch?v=MejbOFk7H6c",
  title: "OK Go - Needing/Getting - Official Video - YouTube",
  description: "Buy the video on iTunes: https://itunes.apple.com/us/album/needing-getting-bundle-ep/id508124847 See more about the guitars at: http://www.gretschguitars.com...",
  images: ["https://i.ytimg.com/vi/MejbOFk7H6c/maxresdefault.jpg"],
  mediaType: "video",
  videos: []
}
```

## License

MIT license
