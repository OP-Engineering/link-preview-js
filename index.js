/**
 * @providesModule react-native-link-preview
 */

import { NativeModules } from 'react-native';

const cheerio = require('cheerio-without-node-native');
const Autolinker = require('autolinker');

export default class LinkPreview {
  static getPreview(text) {
    return new Promise((resolve, reject) => {
      if(!text) {
        reject({error: 'React-Native-Link-Preview did not receive either a url or text'});
      }

      let detectedUrl = null;

      Autolinker.link(text, {
        replaceFn: match => {
          switch( match.getType() ) {
          case 'url' :
            if(!detectedUrl)
              detectedUrl = match.getUrl();
            return true;
          default:
            break
          }
        },
      })

      if(detectedUrl) {
        fetch(detectedUrl)
        .then(response => response.text())
        .then(text => {
          resolve(this._parseResponse(text, detectedUrl))
        })
        .catch(error => reject({error}));
      } else {
        reject({error: 'Preview link did not find a link in the text'});
      }
    })
  }


  static _parseResponse(body, url) {
    const doc = cheerio.load(body);

    return {
      url,
      title: this._getTitle(doc),
      description: this._getDescription(doc),
      mediaType: this._getMediaType(doc) || 'website',
      images: this._getImages(doc, url),
      videos: this._getVideos(doc),
    };
  }

  static _getTitle(doc) {
    let title = doc('title').text();

    if(!title){
      title = doc('meta[property=\'og:title\']').attr('content');
    }

    return title;
  }

  static _getDescription(doc){
    let description = doc('meta[name=description]').attr('content');

    if(description === undefined) {
      description = doc('meta[name=Description]').attr('content');
    }

    if(description === undefined) {
      description = doc('meta[property=\'og:description\']').attr('content');
    }

    return description
  }

  static _getMediaType(doc) {
    let node = doc('meta[name=medium]');

    if(node.length) {
      const content = node.attr('content');
      return content == 'image' ? 'photo' : content;
    } else {
      return doc('meta[property=\'og:type\']').attr('content');
    }
  }

  static _getImages(doc, rootUrl) {
    let images = [], nodes, src;

    nodes = doc('meta[property=\'og:image\']')

    if(nodes.length > 0) {
      nodes.each((index, node) => { images.push(node.attribs['content']); })
    }

    return images
  }

  static _getVideos(doc) {
    let videos,
      nodes, nodeTypes, nodeSecureUrls,
      nodeType, nodeSecureUrl,
      video, videoType, videoSecureUrl,
      width, height,
      videoObj, index, length

    nodes = doc('meta[property=\'og:video\']')
    length =  nodes.length
    if(length) {
      videos = []
      nodeTypes = doc('meta[property=\'og:video:type\']')
      nodeSecureUrls = doc('meta[property=\'og:video:secure_url\']')
      width = doc('meta[property=\'og:video:width\']').attr('content')
      height = doc('meta[property=\'og:video:height\']').attr('content')

      for(index = 0; index < length; index++) {
        video = nodes[index].attribs['content']

        nodeType = nodeTypes[index]
        videoType = nodeType ? nodeType.attribs['content'] : null

        nodeSecureUrl = nodeSecureUrls[index]
        videoSecureUrl = nodeSecureUrl ? nodeSecureUrl.attribs['content'] : null

        videoObj = { url: video, secureUrl: videoSecureUrl, type: videoType, width, height }
        if(videoType.indexOf('video/') === 0) {
          videos.splice(0, 0, videoObj)
        } else {
          videos.push(videoObj)
        }
      }
    }

    return videos
  }

  static _parseMediaResponse(res, contentType, url) {
    if(contentType.indexOf('image/') === 0) {
      return createResponseData(url, false, '', '', contentType, 'photo', [url]);
    } else {
      return createResponseData(url, false, '', '', contentType);
    }
  }

}
