var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import cheerio from "cheerio-without-node-native";
import { fetch } from "cross-fetch";
import urlObj from "url";
import { CONSTANTS } from "./constants";
const metaTag = (doc, type, attr) => {
    const nodes = doc(`meta[${attr}='${type}']`);
    return nodes.length ? nodes : null;
};
const metaTagContent = (doc, type, attr) => doc(`meta[${attr}='${type}']`).attr(`content`);
function getTitle(doc) {
    let title = metaTagContent(doc, `og:title`, `property`) || metaTagContent(doc, `og:title`, `name`);
    if (!title) {
        title = doc(`title`).text();
    }
    return title;
}
function getSiteName(doc) {
    const siteName = metaTagContent(doc, `og:site_name`, `property`) || metaTagContent(doc, `og:site_name`, `name`);
    return siteName;
}
function getDescription(doc) {
    const description = metaTagContent(doc, `description`, `name`) || metaTagContent(doc, `Description`, `name`) || metaTagContent(doc, `og:description`, `property`);
    return description;
}
function getMediaType(doc) {
    const node = metaTag(doc, `medium`, `name`);
    if (node) {
        const content = node.attr(`content`);
        return content === `image` ? `photo` : content;
    }
    return (metaTagContent(doc, `og:type`, `property`) || metaTagContent(doc, `og:type`, `name`));
}
function getImages(doc, rootUrl, imagesPropertyType) {
    let images = [];
    let nodes;
    let src;
    let dic = {};
    const imagePropertyType = imagesPropertyType !== null && imagesPropertyType !== void 0 ? imagesPropertyType : `og`;
    nodes = metaTag(doc, `${imagePropertyType}:image`, `property`) || metaTag(doc, `${imagePropertyType}:image`, `name`);
    if (nodes) {
        nodes.each((_, node) => {
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
        }
        else {
            nodes = doc(`img`);
            if (nodes === null || nodes === void 0 ? void 0 : nodes.length) {
                dic = {};
                images = [];
                nodes.each((_, node) => {
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
function getVideos(doc) {
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
    if (nodes === null || nodes === void 0 ? void 0 : nodes.length) {
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
            }
            else {
                videos.push(videoObj);
            }
        }
    }
    return videos;
}
// returns default favicon (//hostname/favicon.ico) for a url
function getDefaultFavicon(rootUrl) {
    return urlObj.resolve(rootUrl, `/favicon.ico`);
}
// returns an array of URL's to favicon images
function getFavicons(doc, rootUrl) {
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
            nodes.each((_, node) => {
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
function parseImageResponse(url, contentType) {
    return {
        url,
        mediaType: `image`,
        contentType,
        favicons: [getDefaultFavicon(url)],
    };
}
function parseAudioResponse(url, contentType) {
    return {
        url,
        mediaType: `audio`,
        contentType,
        favicons: [getDefaultFavicon(url)],
    };
}
function parseVideoResponse(url, contentType) {
    return {
        url,
        mediaType: `video`,
        contentType,
        favicons: [getDefaultFavicon(url)],
    };
}
function parseApplicationResponse(url, contentType) {
    return {
        url,
        mediaType: `application`,
        contentType,
        favicons: [getDefaultFavicon(url)],
    };
}
function parseTextResponse(body, url, options = {}, contentType) {
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
    };
}
function parseUnknownResponse(body, url, options = {}, contentType) {
    return parseTextResponse(body, url, options, contentType);
}
function parseResponse(response, options) {
    try {
        let contentType = response.headers[`content-type`];
        // console.warn(`original content type`, contentType);
        if (contentType === null || contentType === void 0 ? void 0 : contentType.indexOf(`;`)) {
            // eslint-disable-next-line prefer-destructuring
            contentType = contentType.split(`;`)[0];
            // console.warn(`splitting content type`, contentType);
        }
        if (!contentType) {
            return parseUnknownResponse(response.data, response.url, options);
        }
        if (contentType instanceof Array) {
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
    }
    catch (e) {
        throw new Error(`link-preview-js could not fetch link information ${e.toString()}`);
    }
}
/**
 * Parses the text, extracts the first link it finds and does a HTTP request
 * to fetch the website content, afterwards it tries to parse the internal HTML
 * and extract the information via meta tags
 * @param text string, text to be parsed
 * @param options ILinkPreviewOptions
 */
export function getLinkPreview(text, options) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        if (!text || typeof text !== `string`) {
            throw new Error(`link-preview-js did not receive a valid url or text`);
        }
        const detectedUrl = text.replace(/\n/g, ` `).split(` `).find((token) => CONSTANTS.REGEX_VALID_URL.test(token));
        if (!detectedUrl) {
            throw new Error(`link-preview-js did not receive a valid a url or text`);
        }
        const fetchOptions = { headers: (_a = options === null || options === void 0 ? void 0 : options.headers) !== null && _a !== void 0 ? _a : {} };
        const fetchUrl = (options === null || options === void 0 ? void 0 : options.proxyUrl) ? options.proxyUrl.concat(detectedUrl) : detectedUrl;
        const response = yield fetch(fetchUrl, fetchOptions);
        const headers = {};
        response.headers.forEach((header, key) => {
            headers[key] = header;
        });
        const normalizedResponse = {
            url: (options === null || options === void 0 ? void 0 : options.proxyUrl) ? response.url.replace(options.proxyUrl, ``)
                : response.url,
            headers,
            data: yield response.text(),
        };
        return parseResponse(normalizedResponse, options);
    });
}
/**
 * Skip the library fetching the website for you, instead pass a response object
 * from whatever source you get and use the internal parsing of the HTML to return
 * the necessary information
 * @param response Preview Response
 * @param options IPreviewLinkOptions
 */
export function getPreviewFromContent(response, options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!response || typeof response !== `object`) {
            throw new Error(`link-preview-js did not receive a valid response object`);
        }
        if (!response.url) {
            throw new Error(`link-preview-js did not receive a valid response object`);
        }
        return parseResponse(response, options);
    });
}
