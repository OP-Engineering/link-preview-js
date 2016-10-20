
# react-native-link-preview

Allows to extract information from an URL or parse a text and retrieve information from the first available link.

## Getting started

`$ npm install -S react-native-link-preview`

## Usage
You have to pass an object argument with either a valid URL (no validation on library side yet) or a text that can be parsed

```javascript
import LinkPreview from 'react-native-react-native-link-preview';

LinkPreview.getPreview({uri: 'https://www.youtube.com/watch?v=MejbOFk7H6c'})
.then(data => console.warn(data))
.catch(err => console.warn(err))

LinkPreview.getPreview({text: 'This is a text supposed to be parsed and the first link displayed https://www.youtube.com/watch?v=MejbOFk7H6c'})
.then(data => console.warn(data))
.catch(err => console.warn(err))
```

Returns
```
{
  description: "Buy the video on iTunes: https://itunes.apple.com/us/album/needing-getting-bundle-ep/id508124847 See more about the guitars at: http://www.gretschguitars.com...",
  images: ["https://i.ytimg.com/vi/MejbOFk7H6c/maxresdefault.jpg"],
  mediaType: "video",
  title: "OK Go - Needing/Getting - Official Video - YouTube",
  url: "https://www.youtube.com/watch?v=MejbOFk7H6c",
  videos: undefined
}```

## Dependencies
This library depends on:
- [Autolinker](https://github.com/gregjacobs/Autolinker.js/)
- [cheerio-without-node-native](https://github.com/oyyd/cheerio-without-node-native)

Check them out, both pretty cool

## License

MIT license
