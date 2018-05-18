/**
* @providesModule react-native-link-preview
*/

const cheerio = require('cheerio-without-node-native');
const urlObj = require('url');
const { fetch } = require('cross-fetch');

const {
  REGEX_VALID_URL,
  REGEX_CONTENT_TYPE_IMAGE,
  REGEX_CONTENT_TYPE_AUDIO,
  REGEX_CONTENT_TYPE_VIDEO,
  REGEX_CONTENT_TYPE_TEXT,
  REGEX_CONTENT_TYPE_APPLICATION
} = require('./constants');

exports.getPreview = function(text, options) {
  return new Promise((resolve, reject) => {
    if (!text) {
      reject({
        error: 'React-Native-Link-Preview did not receive either a url or text'
      });
    }

    let detectedUrl = null;

    text.split(' ').forEach(token => {
      if (REGEX_VALID_URL.test(token) && !detectedUrl) {
        detectedUrl = token;
      }
    });

    if (detectedUrl) {
      var request = new XMLHttpRequest();
      request.onreadystatechange = (e) => {
        if (request.readyState !== 4) {
          return;
        }

        if (request.status === 200) {
          // get final URL (after any redirects)
          const finalUrl = request.responseURL;

          // get content type of response
          let contentType = findById(request.responseHeaders, 'content-type');
          if (!contentType) {
            return reject({ error: 'React-Native-Link-Preview: Could not extract content type for URL.' });
          }
          if (contentType instanceof Array) {
            contentType = contentType[0];
          }

          // parse response depending on content type
          if (contentType && REGEX_CONTENT_TYPE_IMAGE.test(contentType)) {
            resolve(parseImageResponse(finalUrl, contentType));
          } else if (contentType && REGEX_CONTENT_TYPE_AUDIO.test(contentType)) {
            resolve(parseAudioResponse(finalUrl, contentType));
          } else if (contentType && REGEX_CONTENT_TYPE_VIDEO.test(contentType)) {
            resolve(parseVideoResponse(finalUrl, contentType));
          } else if (contentType && REGEX_CONTENT_TYPE_TEXT.test(contentType)) {
            resolve(parseTextResponse(request._response, finalUrl, options || {}, contentType));
          } else if (contentType && REGEX_CONTENT_TYPE_APPLICATION.test(contentType)) {
            resolve(parseApplicationResponse(finalUrl, contentType));
          } else {
            reject({ error: 'React-Native-Link-Preview: Unknown content type for URL.' });
          }
        } else {
          console.warn('error');
        }
      };

      request.open('GET', detectedUrl);
      request.send();
    } else {
      reject({
        error: 'React-Native-Link-Preview did not find a link in the text'
      });
    }
  });
};

// recursively search through object to find property with given id
// returns value if found, undefined if not found
const findById = function (object, key) {
  let value;

  Object.keys(object).some(k => {
    if (k.toLowerCase() === key) {
      value = object[k];
      return true;
    }
    if (object[k] && typeof object[k] === 'object') {
      value = findById(object[k], key);
      return value !== undefined;
    }
    return false;
  });
  return value;
};

const parseImageResponse = function (url, contentType) {
  return {
    url,
    mediaType: 'image',
    contentType,
    favicons: [getDefaultFavicon(url)]
  };
};

const parseAudioResponse = function (url, contentType) {
  return {
    url,
    mediaType: 'audio',
    contentType,
    favicons: [getDefaultFavicon(url)]
  };
};

const parseVideoResponse = function (url, contentType) {
  return {
    url,
    mediaType: 'video',
    contentType,
    favicons: [getDefaultFavicon(url)]
  };
};

const parseApplicationResponse = function (url, contentType) {
  return {
    url,
    mediaType: 'application',
    contentType,
    favicons: [getDefaultFavicon(url)]
  };
};

const parseTextResponse = function (body, url, options, contentType) {
  const doc = cheerio.load(body);

  return {
    url,
    title: getTitle(doc),
    description: getDescription(doc),
    mediaType: getMediaType(doc) || 'website',
    contentType,
    images: getImages(doc, url, options.imagesPropertyType),
    videos: getVideos(doc),
    favicons: getFavicons(doc, url)
  };
};

const getTitle = function(doc) {
  let title = doc("meta[property='og:title']").attr('content');

  if (!title) {
    title = doc('title').text();
  }

  return title;
};

const getDescription = function(doc) {
  let description = doc('meta[name=description]').attr('content');

  if (description === undefined) {
    description = doc('meta[name=Description]').attr('content');
  }

  if (description === undefined) {
    description = doc("meta[property='og:description']").attr('content');
  }

  return description;
};

const getMediaType = function(doc) {
  const node = doc('meta[name=medium]');

  if (node.length) {
    const content = node.attr('content');
    return content === 'image' ? 'photo' : content;
  } else {
    return doc("meta[property='og:type']").attr('content');
  }
};

const getImages = function(doc, rootUrl, imagesPropertyType) {
  let images = [],
    nodes,
    src,
    dic;

  nodes = doc(`meta[property='${imagesPropertyType || 'og'}:image']`);

  if (nodes.length) {
    nodes.each((index, node) => {
      src = node.attribs.content;
      if (src) {
        src = urlObj.resolve(rootUrl, src);
        images.push(src);
      }
    });
  }

  if (images.length <= 0 && !imagesPropertyType) {
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
};

const getVideos = function(doc) {
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

  const nodes = doc("meta[property='og:video']");
  const length = nodes.length;

  if (length) {
    nodeTypes = doc("meta[property='og:video:type']");
    nodeSecureUrls = doc("meta[property='og:video:secure_url']");
    width = doc("meta[property='og:video:width']").attr('content');
    height = doc("meta[property='og:video:height']").attr('content');

    for (index = 0; index < length; index++) {
      video = nodes[index].attribs.content;

      nodeType = nodeTypes[index];
      videoType = nodeType ? nodeType.attribs.content : null;

      nodeSecureUrl = nodeSecureUrls[index];
      videoSecureUrl = nodeSecureUrl ? nodeSecureUrl.attribs.content : null;

      videoObj = {
        url: video,
        secureUrl: videoSecureUrl,
        type: videoType,
        width,
        height
      };
      if (videoType.indexOf('video/') === 0) {
        videos.splice(0, 0, videoObj);
      } else {
        videos.push(videoObj);
      }
    }
  }

  return videos;
};

// returns an array of URL's to favicon images
const getFavicons = function(doc, rootUrl) {
  let images = [],
    nodes = [],
    src;

  const relSelectors = ['rel=icon', 'rel="shortcut icon"', 'rel=apple-touch-icon'];

  relSelectors.forEach((relSelector) => {
    // look for all icon tags
    nodes = doc(`link[${relSelector}]`);

    // collect all images from icon tags
    if (nodes.length) {
      nodes.each((index, node) => {
        src = node.attribs.href;
        if (src) {
          src = urlObj.resolve(rootUrl, src);
          images.push(src);
        }
      });
    }
  });

  // if no icon images, use default favicon location
  if (images.length <= 0) {
    images.push(getDefaultFavicon(rootUrl));
  }

  return images;
};

// returns default favicon (//hostname/favicon.ico) for a url
const getDefaultFavicon = function (rootUrl) {
  return urlObj.resolve(rootUrl, '/favicon.ico');
};
