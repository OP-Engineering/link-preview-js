// const cheerio = require('cheerio-without-node-native');
import cheerio from "cheerio-without-node-native";
import { fetch } from "cross-fetch";
import { CONSTANTS } from "./constants";
import urlObj from "url";

interface ILinkPreviewOptions {
  headers?: Record<string, string>;
  imagesPropertyType?: string;
}

interface ILinkPreviewResponse {
  url?: string;
  title?: string;
  siteName?: string;
  description?: string;
  mediaType?: string;
  contentType?: string;
  images?: string[];
  videos?: {
    url: string;
    secureUrl: string;
    type: string;
    width: number;
    height: number;
  }[];
  favicons?: string[];
}

export function getLinkPreview(
  text: string,
  options?: ILinkPreviewOptions
): Promise<ILinkPreviewResponse> {
  return new Promise(async (resolve, reject) => {
    if (!text) {
      reject(new Error("link-preview-js did not receive either a url or text"));
    }

    let detectedUrl: string | undefined;

    text
      .replace(/\n/g, " ")
      .split(" ")
      .some(function(token) {
        if (CONSTANTS.REGEX_VALID_URL.test(token)) {
          detectedUrl = token;
        }
      });

    if (!detectedUrl) {
      reject(new Error("link-preview-js did not receive either a url or text"));
    }

    const fetchOptions = { headers: options?.headers ?? {} };

    try {
      const response = await fetch(detectedUrl!, fetchOptions);

      // get final URL (after any redirects)
      const finalUrl = response.url;

      // get content type of response
      var contentType = response.headers.get("content-type");

      if (!contentType) {
        return reject(
          new Error("link-preview-js could not determine content-type for link")
        );
      }

      if ((contentType as any) instanceof Array) {
        contentType = contentType[0];
      }

      // parse response depending on content type
      if (CONSTANTS.REGEX_CONTENT_TYPE_IMAGE.test(contentType)) {
        return resolve(parseImageResponse(finalUrl, contentType));
      } else if (CONSTANTS.REGEX_CONTENT_TYPE_AUDIO.test(contentType)) {
        return resolve(parseAudioResponse(finalUrl, contentType));
      } else if (CONSTANTS.REGEX_CONTENT_TYPE_VIDEO.test(contentType)) {
        return resolve(parseVideoResponse(finalUrl, contentType));
      } else if (CONSTANTS.REGEX_CONTENT_TYPE_TEXT.test(contentType)) {
        const htmlString = await response.text();
        resolve(parseTextResponse(htmlString, finalUrl, options, contentType));
      } else if (CONSTANTS.REGEX_CONTENT_TYPE_APPLICATION.test(contentType)) {
        return resolve(parseApplicationResponse(finalUrl, contentType));
      } else {
        return reject({
          error: "link-preview-js Unknown content type for URL."
        });
      }
    } catch (e) {
      reject(
        new Error(
          "link-preview-js could not fetch link information" + e.toString()
        )
      );
    }
  });
}

function parseImageResponse(url: string, contentType: string) {
  return {
    url: url,
    mediaType: "image",
    contentType: contentType,
    favicons: [getDefaultFavicon(url)]
  };
}

function parseAudioResponse(url: string, contentType: string) {
  return {
    url: url,
    mediaType: "audio",
    contentType: contentType,
    favicons: [getDefaultFavicon(url)]
  };
}

function parseVideoResponse(url: string, contentType: string) {
  return {
    url: url,
    mediaType: "video",
    contentType: contentType,
    favicons: [getDefaultFavicon(url)]
  };
}

function parseApplicationResponse(url: string, contentType: string) {
  return {
    url: url,
    mediaType: "application",
    contentType: contentType,
    favicons: [getDefaultFavicon(url)]
  };
}

const parseTextResponse = function(
  body: string,
  url: string,
  options: ILinkPreviewOptions = {},
  contentType: string
) {
  const doc = cheerio.load(body);

  return {
    url: url,
    title: getTitle(doc),
    siteName: getSiteName(doc),
    description: getDescription(doc),
    mediaType: getMediaType(doc) || "website",
    contentType: contentType,
    images: getImages(doc, url, options.imagesPropertyType),
    videos: getVideos(doc),
    favicons: getFavicons(doc, url)
  };
};

function getTitle(doc: any) {
  var title = doc("meta[property='og:title']").attr("content");

  if (!title) {
    title = doc("title").text();
  }

  return title;
}

function getSiteName(doc: any) {
  var siteName = doc("meta[property='og:site_name']").attr("content");

  return siteName;
}

function getDescription(doc: any) {
  var description = doc("meta[name=description]").attr("content");

  if (description === undefined) {
    description = doc("meta[name=Description]").attr("content");
  }

  if (description === undefined) {
    description = doc("meta[property='og:description']").attr("content");
  }

  return description;
}

function getMediaType(doc: any) {
  const node = doc("meta[name=medium]");

  if (node.length) {
    const content = node.attr("content");
    return content === "image" ? "photo" : content;
  } else {
    return doc("meta[property='og:type']").attr("content");
  }
}

function getImages(doc: any, rootUrl: string, imagesPropertyType?: string) {
  let images: string[] = [],
    nodes,
    src,
    dic: Record<string, boolean> = {};

  var imagePropertyType = imagesPropertyType ?? "og";
  nodes = doc("meta[property='" + imagePropertyType + ":image']");

  if (nodes.length) {
    nodes.each(function(_: number, node: any) {
      src = node.attribs.content;
      if (src) {
        src = urlObj.resolve(rootUrl, src);
        images.push(src);
      }
    });
  }

  if (images.length <= 0 && !imagesPropertyType) {
    src = doc("link[rel=image_src]").attr("href");
    if (src) {
      src = urlObj.resolve(rootUrl, src);
      images = [src];
    } else {
      nodes = doc("img");

      if (nodes.length) {
        dic = {};
        images = [];
        nodes.each(function(_: number, node: any) {
          src = node.attribs.src;
          if (src && !dic[src]) {
            dic[src] = true;
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

function getVideos(doc: any) {
  const videos = [];
  var nodeTypes;
  var nodeSecureUrls;
  var nodeType;
  var nodeSecureUrl;
  var video;
  var videoType;
  var videoSecureUrl;
  var width;
  var height;
  var videoObj;
  var index;

  const nodes = doc("meta[property='og:video']");
  const length = nodes.length;

  if (length) {
    nodeTypes = doc("meta[property='og:video:type']");
    nodeSecureUrls = doc("meta[property='og:video:secure_url']");
    width = doc("meta[property='og:video:width']").attr("content");
    height = doc("meta[property='og:video:height']").attr("content");

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
        width: width,
        height: height
      };
      if (videoType && videoType.indexOf("video/") === 0) {
        videos.splice(0, 0, videoObj);
      } else {
        videos.push(videoObj);
      }
    }
  }

  return videos;
}

// returns an array of URL's to favicon images
function getFavicons(doc: any, rootUrl: string) {
  var images = [],
    nodes = [],
    src;

  const relSelectors = [
    "rel=icon",
    'rel="shortcut icon"',
    "rel=apple-touch-icon"
  ];

  relSelectors.forEach(function(relSelector) {
    // look for all icon tags
    nodes = doc("link[" + relSelector + "]");

    // collect all images from icon tags
    if (nodes.length) {
      nodes.each((_: number, node: any) => {
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
}

// returns default favicon (//hostname/favicon.ico) for a url
function getDefaultFavicon(rootUrl: string) {
  return urlObj.resolve(rootUrl, "/favicon.ico");
}
