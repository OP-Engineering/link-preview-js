"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPreviewFromContent = exports.getLinkPreview = void 0;
var cheerio_1 = __importDefault(require("cheerio"));
var cross_fetch_1 = require("cross-fetch");
var url_1 = __importDefault(require("url"));
var constants_1 = require("./constants");
var metaTag = function (doc, type, attr) {
    var nodes = doc("meta[" + attr + "='" + type + "']");
    return nodes.length ? nodes : null;
};
var metaTagContent = function (doc, type, attr) { return doc("meta[" + attr + "='" + type + "']").attr("content"); };
function getTitle(doc) {
    var title = metaTagContent(doc, "og:title", "property") || metaTagContent(doc, "og:title", "name");
    if (!title) {
        title = doc("title").text();
    }
    return title;
}
function getSiteName(doc) {
    var siteName = metaTagContent(doc, "og:site_name", "property") || metaTagContent(doc, "og:site_name", "name");
    return siteName;
}
function getDescription(doc) {
    var description = metaTagContent(doc, "description", "name") || metaTagContent(doc, "Description", "name") || metaTagContent(doc, "og:description", "property");
    return description;
}
function getMediaType(doc) {
    var node = metaTag(doc, "medium", "name");
    if (node) {
        var content = node.attr("content");
        return content === "image" ? "photo" : content;
    }
    return (metaTagContent(doc, "og:type", "property") || metaTagContent(doc, "og:type", "name"));
}
function getImages(doc, rootUrl, imagesPropertyType) {
    var images = [];
    var nodes;
    var src;
    var dic = {};
    var imagePropertyType = imagesPropertyType !== null && imagesPropertyType !== void 0 ? imagesPropertyType : "og";
    nodes = metaTag(doc, imagePropertyType + ":image", "property") || metaTag(doc, imagePropertyType + ":image", "name");
    if (nodes) {
        nodes.each(function (_, node) {
            src = node.attribs.content;
            if (src) {
                src = url_1.default.resolve(rootUrl, src);
                images.push(src);
            }
        });
    }
    if (images.length <= 0 && !imagesPropertyType) {
        src = doc("link[rel=image_src]").attr("href");
        if (src) {
            src = url_1.default.resolve(rootUrl, src);
            images = [src];
        }
        else {
            nodes = doc("img");
            if (nodes === null || nodes === void 0 ? void 0 : nodes.length) {
                dic = {};
                images = [];
                nodes.each(function (_, node) {
                    src = node.attribs.src;
                    if (src && !dic[src]) {
                        dic[src] = true;
                        // width = node.attribs.width;
                        // height = node.attribs.height;
                        images.push(url_1.default.resolve(rootUrl, src));
                    }
                });
            }
        }
    }
    return images;
}
function getVideos(doc) {
    var videos = [];
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
    var nodes = metaTag(doc, "og:video", "property") || metaTag(doc, "og:video", "name");
    if (nodes === null || nodes === void 0 ? void 0 : nodes.length) {
        nodeTypes = metaTag(doc, "og:video:type", "property") || metaTag(doc, "og:video:type", "name");
        nodeSecureUrls = metaTag(doc, "og:video:secure_url", "property") || metaTag(doc, "og:video:secure_url", "name");
        width = metaTagContent(doc, "og:video:width", "property") || metaTagContent(doc, "og:video:width", "name");
        height = metaTagContent(doc, "og:video:height", "property") || metaTagContent(doc, "og:video:height", "name");
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
                width: width,
                height: height,
            };
            if (videoType && videoType.indexOf("video/") === 0) {
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
    return url_1.default.resolve(rootUrl, "/favicon.ico");
}
// returns an array of URL's to favicon images
function getFavicons(doc, rootUrl) {
    var images = [];
    var nodes = [];
    var src;
    var relSelectors = [
        "rel=icon",
        "rel=\"shortcut icon\"",
        "rel=apple-touch-icon",
    ];
    relSelectors.forEach(function (relSelector) {
        // look for all icon tags
        nodes = doc("link[" + relSelector + "]");
        // collect all images from icon tags
        if (nodes.length) {
            nodes.each(function (_, node) {
                src = node.attribs.href;
                if (src) {
                    src = url_1.default.resolve(rootUrl, src);
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
        url: url,
        mediaType: "image",
        contentType: contentType,
        favicons: [getDefaultFavicon(url)],
    };
}
function parseAudioResponse(url, contentType) {
    return {
        url: url,
        mediaType: "audio",
        contentType: contentType,
        favicons: [getDefaultFavicon(url)],
    };
}
function parseVideoResponse(url, contentType) {
    return {
        url: url,
        mediaType: "video",
        contentType: contentType,
        favicons: [getDefaultFavicon(url)],
    };
}
function parseApplicationResponse(url, contentType) {
    return {
        url: url,
        mediaType: "application",
        contentType: contentType,
        favicons: [getDefaultFavicon(url)],
    };
}
function parseTextResponse(body, url, options, contentType) {
    if (options === void 0) { options = {}; }
    var doc = cheerio_1.default.load(body);
    return {
        url: url,
        title: getTitle(doc),
        siteName: getSiteName(doc),
        description: getDescription(doc),
        mediaType: getMediaType(doc) || "website",
        contentType: contentType,
        images: getImages(doc, url, options.imagesPropertyType),
        videos: getVideos(doc),
        favicons: getFavicons(doc, url),
        channel_id: getChannelID(doc),
    };
}
// get channel id of youtube video url
var getChannelID = function (doc) {
    var channel_id = null;
    // yt-uix-button yt-uix-button-size-default yt-uix-button-subscribe-branded yt-uix-button-has-icon no-icon-markup yt-uix-subscription-button yt-can-buffer yt-uix-servicelink vve-check - class name
    channel_id = doc('button[class="yt-uix-button yt-uix-button-size-default yt-uix-button-subscribe-branded yt-uix-button-has-icon no-icon-markup yt-uix-subscription-button yt-can-buffer yt-uix-servicelink vve-check"]').attr('data-channel-external-id');
    return channel_id;
};
function parseUnknownResponse(body, url, options, contentType) {
    if (options === void 0) { options = {}; }
    return parseTextResponse(body, url, options, contentType);
}
function parseResponse(response, options) {
    try {
        var contentType = response.headers["content-type"];
        // console.warn(`original content type`, contentType);
        if (contentType === null || contentType === void 0 ? void 0 : contentType.indexOf(";")) {
            // eslint-disable-next-line prefer-destructuring
            contentType = contentType.split(";")[0];
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
        if (constants_1.CONSTANTS.REGEX_CONTENT_TYPE_IMAGE.test(contentType)) {
            return parseImageResponse(response.url, contentType);
        }
        if (constants_1.CONSTANTS.REGEX_CONTENT_TYPE_AUDIO.test(contentType)) {
            return parseAudioResponse(response.url, contentType);
        }
        if (constants_1.CONSTANTS.REGEX_CONTENT_TYPE_VIDEO.test(contentType)) {
            return parseVideoResponse(response.url, contentType);
        }
        if (constants_1.CONSTANTS.REGEX_CONTENT_TYPE_TEXT.test(contentType)) {
            var htmlString_1 = response.data;
            return parseTextResponse(htmlString_1, response.url, options, contentType);
        }
        if (constants_1.CONSTANTS.REGEX_CONTENT_TYPE_APPLICATION.test(contentType)) {
            return parseApplicationResponse(response.url, contentType);
        }
        var htmlString = response.data;
        return parseUnknownResponse(htmlString, response.url, options);
    }
    catch (e) {
        throw new Error("link-preview-js could not fetch link information " + e.toString());
    }
}
/**
 * Parses the text, extracts the first link it finds and does a HTTP request
 * to fetch the website content, afterwards it tries to parse the internal HTML
 * and extract the information via meta tags
 * @param text string, text to be parsed
 * @param options ILinkPreviewOptions
 */
function getLinkPreview(text, options) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var detectedUrl, fetchOptions, fetchUrl, response, headers, normalizedResponse;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!text || typeof text !== "string") {
                        throw new Error("link-preview-js did not receive a valid url or text");
                    }
                    detectedUrl = text.replace(/\n/g, " ").split(" ").find(function (token) { return constants_1.CONSTANTS.REGEX_VALID_URL.test(token); });
                    if (!detectedUrl) {
                        throw new Error("link-preview-js did not receive a valid a url or text");
                    }
                    fetchOptions = {
                        headers: (_a = options === null || options === void 0 ? void 0 : options.headers) !== null && _a !== void 0 ? _a : {},
                        redirect: "follow",
                    };
                    fetchUrl = (options === null || options === void 0 ? void 0 : options.proxyUrl) ? options.proxyUrl.concat(detectedUrl) : detectedUrl;
                    return [4 /*yield*/, cross_fetch_1.fetch(fetchUrl, fetchOptions)];
                case 1:
                    response = _c.sent();
                    headers = {};
                    response.headers.forEach(function (header, key) {
                        headers[key] = header;
                    });
                    _b = {
                        url: (options === null || options === void 0 ? void 0 : options.proxyUrl) ? response.url.replace(options.proxyUrl, "")
                            : response.url,
                        headers: headers
                    };
                    return [4 /*yield*/, response.text()];
                case 2:
                    normalizedResponse = (_b.data = _c.sent(),
                        _b);
                    return [2 /*return*/, parseResponse(normalizedResponse, options)];
            }
        });
    });
}
exports.getLinkPreview = getLinkPreview;
/**
 * Skip the library fetching the website for you, instead pass a response object
 * from whatever source you get and use the internal parsing of the HTML to return
 * the necessary information
 * @param response Preview Response
 * @param options IPreviewLinkOptions
 */
function getPreviewFromContent(response, options) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (!response || typeof response !== "object") {
                throw new Error("link-preview-js did not receive a valid response object");
            }
            if (!response.url) {
                throw new Error("link-preview-js did not receive a valid response object");
            }
            return [2 /*return*/, parseResponse(response, options)];
        });
    });
}
exports.getPreviewFromContent = getPreviewFromContent;
