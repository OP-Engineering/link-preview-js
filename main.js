/**
* @providesModule react-native-link-preview
*/


require('import-export');


const cheerio = require('cheerio-without-node-native');
const urlObj = require('url');

import { REGEX_VALID_URL } from './constants';

export default class LinkPreview {
  static getPreview(text) {
    return new Promise((resolve, reject) => {
      if (!text) {
        reject({ error: 'React-Native-Link-Preview did not receive either a url or text' });
      }

      let detectedUrl = null;

      text.split(' ').forEach(token => {
        if (REGEX_VALID_URL.test(token) && !detectedUrl) {
          detectedUrl = token;
        }
      });

      if (detectedUrl) {
        fetch(detectedUrl)
        .then(response => response.text())
        .then(text => {
          resolve(this._parseResponse(text, detectedUrl));
        })
        .catch(error => reject({ error }));
      } else {
        reject({ error: 'React-Native-Preview-Link did not find a link in the text' });
      }
    });
  }


  static _parseResponse(body, url) {
    const doc = cheerio.load(body);

    return {
      url,
      title: this._getTitle(doc),
      description: this._getDescription(doc),
      mediaType: this._getMediaType(doc) || 'website',
      images: this._getImages(doc, url),
      videos: this._getVideos(doc)
    };
  }

  static _getTitle(doc) {
    let title = doc('meta[property=\'og:title\']').attr('content');

    if (!title) {
      title = doc('title').text();
    }

    return title;
  }

  static _getDescription(doc) {
    let description = doc('meta[name=description]').attr('content');

    if (description === undefined) {
      description = doc('meta[name=Description]').attr('content');
    }

    if (description === undefined) {
      description = doc('meta[property=\'og:description\']').attr('content');
    }

    return description;
  }

  static _getMediaType(doc) {
    const node = doc('meta[name=medium]');

    if (node.length) {
      const content = node.attr('content');
      return content === 'image' ? 'photo' : content;
    } else {
      return doc('meta[property=\'og:type\']').attr('content');
    }
  }

  static _getImages(doc, rootUrl) {
    let images = [],
      nodes,
      src,
      dic;

    nodes = doc('meta[property=\'og:image\']');

    if (nodes.length) {
      nodes.each((index, node) => {
        src = node.attribs.content;
        if (src) {
          src = urlObj.resolve(rootUrl, src);
          images.push(src);
        }
      });
    }

    if (images.length <= 0) {
      src = doc('link[rel=image_src]').attr('href');
      if (src) {
        src = urlObj.resolve(rootUrl, src);
        images = [src];
      } else {
        nodes = doc('img');

        if (nodes.length) {
          dic = {};
          images = [];
          nodes.each((index, node) => {
            src = node.attribs.src;
            if (src && !dic[src]) {
              dic[src] = 1;
              // width = node.attribs.width;
              // height = node.attribs.height;
              images.push(urlObj.resolve(rootUrl, src));
            }
          });
        }
      }
    }

    return images;
  }

  static _getVideos(doc) {
    const videos = [];
    let nodeTypes;
    let nodeSecureUrls;
    let nodeType;
    let nodeSecureUrl;
    let video;
    let videoType;
    let videoSecureUrl;
    let width;
    let height;
    let videoObj;
    let index;

    const nodes = doc('meta[property=\'og:video\']');
    const length = nodes.length;

    if (length) {
      nodeTypes = doc('meta[property=\'og:video:type\']');
      nodeSecureUrls = doc('meta[property=\'og:video:secure_url\']');
      width = doc('meta[property=\'og:video:width\']').attr('content');
      height = doc('meta[property=\'og:video:height\']').attr('content');

      for (index = 0; index < length; index++) {
        video = nodes[index].attribs.content;

        nodeType = nodeTypes[index];
        videoType = nodeType ? nodeType.attribs.content : null;

        nodeSecureUrl = nodeSecureUrls[index];
        videoSecureUrl = nodeSecureUrl ? nodeSecureUrl.attribs.content : null;

        videoObj = { url: video, secureUrl: videoSecureUrl, type: videoType, width, height };
        if (videoType.indexOf('video/') === 0) {
          videos.splice(0, 0, videoObj);
        } else {
          videos.push(videoObj);
        }
      }
    }

    return videos;
  }

  // static _parseMediaResponse(res, contentType, url) {
  //   if (contentType.indexOf('image/') === 0) {
  //     return createResponseData(url, false, '', '', contentType, 'photo', [url]);
  //   } else {
  //     return createResponseData(url, false, '', '', contentType);
  //   }
  // }

}
