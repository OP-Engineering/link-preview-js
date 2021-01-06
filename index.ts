import cheerio from "cheerio";
import { fetch } from "cross-fetch";
import urlObj from "url";
import { CONSTANTS } from "./constants";

interface ILinkPreviewOptions {
  headers?: Record<string, string>;
  imagesPropertyType?: string;
  proxyUrl?: string;
}

interface IPrefetchedResource {
  headers: Record<string, string>;
  status?: number;
  imagesPropertyType?: string;
  proxyUrl?: string;
  url: string;
  data: string;
}

const metaTag = (doc: any, type: string, attr: string) => {
  const nodes = doc(`meta[${attr}='${type}']`);
  return nodes.length ? nodes : null;
};

const metaTagContent = (doc: any, type: string, attr: string) => doc(`meta[${attr}='${type}']`).attr(`content`);

function getTitle(doc: any) {
  let title = metaTagContent(doc, `og:title`, `property`) || metaTagContent(doc, `og:title`, `name`);
  if (!title) {
    title = doc(`title`).text();
  }
  return title;
}

function getSiteName(doc: any) {
  const siteName = metaTagContent(doc, `og:site_name`, `property`) || metaTagContent(doc, `og:site_name`, `name`);
  return siteName;
}

function getDescription(doc: any) {
  const description = metaTagContent(doc, `description`, `name`) || metaTagContent(doc, `Description`, `name`) || metaTagContent(doc, `og:description`, `property`);
  return description;
}

function getMediaType(doc: any) {
  const node = metaTag(doc, `medium`, `name`);
  if (node) {
    const content = node.attr(`content`);
    return content === `image` ? `photo` : content;
  }
  return (metaTagContent(doc, `og:type`, `property`) || metaTagContent(doc, `og:type`, `name`));
}

function getImages(doc: any, rootUrl: string, imagesPropertyType?: string) {
  let images: string[] = [];
  let nodes;
  let src;
  let dic: Record<string, boolean> = {};

  const imagePropertyType = imagesPropertyType ?? `og`;
  nodes = metaTag(doc, `${imagePropertyType}:image`, `property`) || metaTag(doc, `${imagePropertyType}:image`, `name`);

  if (nodes) {
    nodes.each((_: number, node: any) => {
      src = node.attribs.content;
      if (src) {
        src = urlObj.resolve(rootUrl, src);
        images.push(src);
      }
    });
  }

  if (images.length <= 0 && !imagesPropertyType) {
    src = doc(`link[rel=image_src]`).attr(`href`);
    if (src) {
      src = urlObj.resolve(rootUrl, src);
      images = [src];
    } else {
      nodes = doc(`img`);

      if (nodes?.length) {
        dic = {};
        images = [];
        nodes.each((_: number, node: any) => {
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

  const nodes = metaTag(doc, `og:video`, `property`) || metaTag(doc, `og:video`, `name`);

  if (nodes?.length) {
    nodeTypes = metaTag(doc, `og:video:type`, `property`) || metaTag(doc, `og:video:type`, `name`);
    nodeSecureUrls = metaTag(doc, `og:video:secure_url`, `property`) || metaTag(doc, `og:video:secure_url`, `name`);
    width = metaTagContent(doc, `og:video:width`, `property`) || metaTagContent(doc, `og:video:width`, `name`);
    height = metaTagContent(doc, `og:video:height`, `property`) || metaTagContent(doc, `og:video:height`, `name`);

    for (index = 0; index < nodes.length; index += 1) {
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
        height,
      };
      if (videoType && videoType.indexOf(`video/`) === 0) {
        videos.splice(0, 0, videoObj);
      } else {
        videos.push(videoObj);
      }
    }
  }

  return videos;
}

// returns default favicon (//hostname/favicon.ico) for a url
function getDefaultFavicon(rootUrl: string) {
  return urlObj.resolve(rootUrl, `/favicon.ico`);
}

// returns an array of URL's to favicon images
function getFavicons(doc: any, rootUrl: string) {
  const images = [];
  let nodes = [];
  let src;

  const relSelectors = [
    `rel=icon`,
    `rel="shortcut icon"`,
    `rel=apple-touch-icon`,
  ];

  relSelectors.forEach((relSelector) => {
    // look for all icon tags
    nodes = doc(`link[${relSelector}]`);

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

function parseImageResponse(url: string, contentType: string) {
  return {
    url,
    mediaType: `image`,
    contentType,
    favicons: [getDefaultFavicon(url)],
  };
}

function parseAudioResponse(url: string, contentType: string) {
  return {
    url,
    mediaType: `audio`,
    contentType,
    favicons: [getDefaultFavicon(url)],
  };
}

function parseVideoResponse(url: string, contentType: string) {
  return {
    url,
    mediaType: `video`,
    contentType,
    favicons: [getDefaultFavicon(url)],
  };
}

function parseApplicationResponse(url: string, contentType: string) {
  return {
    url,
    mediaType: `application`,
    contentType,
    favicons: [getDefaultFavicon(url)],
  };
}

function parseTextResponse(
  body: string,
  url: string,
  options: ILinkPreviewOptions = {},
  contentType?: string,
) {
  const doc = cheerio.load(body);

  return {
    url,
    title: getTitle(doc),
    siteName: getSiteName(doc),
    description: getDescription(doc),
    mediaType: getMediaType(doc) || `website`,
    contentType,
    images: getImages(doc, url, options.imagesPropertyType),
    videos: getVideos(doc),
    favicons: getFavicons(doc, url),
    channel_id : getChannelID(doc), /// youtube video channel id
  };
}

// get channel id of youtube video url
const getChannelID = function (doc: any) {
  var channel_id = null;
  // yt-uix-button yt-uix-button-size-default yt-uix-button-subscribe-branded yt-uix-button-has-icon no-icon-markup yt-uix-subscription-button yt-can-buffer yt-uix-servicelink vve-check - class name
  channel_id = doc('button[class="yt-uix-button yt-uix-button-size-default yt-uix-button-subscribe-branded yt-uix-button-has-icon no-icon-markup yt-uix-subscription-button yt-can-buffer yt-uix-servicelink vve-check"]').attr('data-channel-external-id');
  return channel_id;
};

function parseUnknownResponse(
  body: string,
  url: string,
  options: ILinkPreviewOptions = {},
  contentType?: string,
) {
  return parseTextResponse(body, url, options, contentType);
}

function parseResponse(
  response: IPrefetchedResource | any,
  options?: ILinkPreviewOptions,
) {
  try {
    let contentType = response.headers[`content-type`];
    // console.warn(`original content type`, contentType);
    if (contentType?.indexOf(`;`)) {
      // eslint-disable-next-line prefer-destructuring
      contentType = contentType.split(`;`)[0];
      // console.warn(`splitting content type`, contentType);
    }

    if (!contentType) {
      return parseUnknownResponse(response.data, response.url, options);
    }

    if ((contentType as any) instanceof Array) {
      // eslint-disable-next-line no-param-reassign, prefer-destructuring
      contentType = contentType[0];
    }

    // parse response depending on content type
    if (CONSTANTS.REGEX_CONTENT_TYPE_IMAGE.test(contentType)) {
      return parseImageResponse(response.url, contentType);
    }
    if (CONSTANTS.REGEX_CONTENT_TYPE_AUDIO.test(contentType)) {
      return parseAudioResponse(response.url, contentType);
    }
    if (CONSTANTS.REGEX_CONTENT_TYPE_VIDEO.test(contentType)) {
      return parseVideoResponse(response.url, contentType);
    }
    if (CONSTANTS.REGEX_CONTENT_TYPE_TEXT.test(contentType)) {
      const htmlString = response.data;
      return parseTextResponse(htmlString, response.url, options, contentType);
    }
    if (CONSTANTS.REGEX_CONTENT_TYPE_APPLICATION.test(contentType)) {
      return parseApplicationResponse(response.url, contentType);
    }
    const htmlString = response.data;
    return parseUnknownResponse(htmlString, response.url, options);
  } catch (e) {
    throw new Error(
      `link-preview-js could not fetch link information ${e.toString()}`,
    );
  }
}

/**
 * Parses the text, extracts the first link it finds and does a HTTP request
 * to fetch the website content, afterwards it tries to parse the internal HTML
 * and extract the information via meta tags
 * @param text string, text to be parsed
 * @param options ILinkPreviewOptions
 */
export async function getLinkPreview(
  text: string,
  options?: ILinkPreviewOptions,
) {
  if (!text || typeof text !== `string`) {
    throw new Error(`link-preview-js did not receive a valid url or text`);
  }

  const detectedUrl = text.replace(/\n/g, ` `).split(` `).find((token) => CONSTANTS.REGEX_VALID_URL.test(token));

  if (!detectedUrl) {
    throw new Error(`link-preview-js did not receive a valid a url or text`);
  }

  const fetchOptions = {
    headers: options?.headers ?? {},
    redirect: `follow` as `follow`,
  };

  const fetchUrl = options?.proxyUrl ? options.proxyUrl.concat(detectedUrl) : detectedUrl;


  const response = await fetch(fetchUrl, fetchOptions);

  const headers: Record<string, string> = {};
  response.headers.forEach((header, key) => {
    headers[key] = header;
  });

  const normalizedResponse: IPrefetchedResource = {
    url: options?.proxyUrl
      ? response.url.replace(options.proxyUrl, ``)
      : response.url,
    headers,
    data: await response.text(),
  };

  return parseResponse(normalizedResponse, options);
}

/**
 * Skip the library fetching the website for you, instead pass a response object
 * from whatever source you get and use the internal parsing of the HTML to return
 * the necessary information
 * @param response Preview Response
 * @param options IPreviewLinkOptions
 */
export async function getPreviewFromContent(
  response: IPrefetchedResource,
  options?: ILinkPreviewOptions,
) {
  if (!response || typeof response !== `object`) {
    throw new Error(`link-preview-js did not receive a valid response object`);
  }

  if (!response.url) {
    throw new Error(`link-preview-js did not receive a valid response object`);
  }

  return parseResponse(response, options);
}
