
# react-native-link-preview

Allows to extract information from an URL or parse a text and retrieve information from the first available link.

## NodeJS support
Library should now work on node environments, thanks to @uriva and @itaibs, I will not rename the library because it may cause confusion for people who try to run in a CORS protected environment (ex. google chrome), since this does not happen for RN that was the original intention of the package.

## Getting started

`$ npm install -S react-native-link-preview`

## Usage
Library exposes just one method: getPreview, you have to pass a string (doesn't matter if it is just an URL or a piece of text that contains an URL), the library will take care of parsing it and returning the info of first valid URL info it finds.

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


```
LinkPreview.getPreview(
  'https://www.youtube.com/watch?v=MejbOFk7H6c', 
  {
    imagesPropertyType: 'og', // fetches only open-graph images
  })
  .then(data => console.debug(data));
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
