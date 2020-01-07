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
// const cheerio = require('cheerio-without-node-native');
var cheerio_without_node_native_1 = __importDefault(require("cheerio-without-node-native"));
var cross_fetch_1 = require("cross-fetch");
var constants_1 = require("./constants");
var url_1 = __importDefault(require("url"));
function getLinkPreview(text, options) {
    var _this = this;
    return new Promise(function (resolve, reject) { return __awaiter(_this, void 0, void 0, function () {
        var detectedUrl, fetchOptions, response, finalUrl, contentType, htmlString, e_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!text) {
                        reject(new Error("link-preview-js did not receive either a url or text"));
                    }
                    text
                        .replace(/\n/g, " ")
                        .split(" ")
                        .some(function (token) {
                        if (constants_1.CONSTANTS.REGEX_VALID_URL.test(token)) {
                            detectedUrl = token;
                        }
                    });
                    if (!detectedUrl) {
                        reject(new Error("link-preview-js did not receive either a url or text"));
                    }
                    fetchOptions = { headers: (_b = (_a = options) === null || _a === void 0 ? void 0 : _a.headers, (_b !== null && _b !== void 0 ? _b : {})) };
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 9, , 10]);
                    return [4 /*yield*/, cross_fetch_1.fetch(detectedUrl, fetchOptions)];
                case 2:
                    response = _c.sent();
                    finalUrl = response.url;
                    contentType = response.headers.get("content-type");
                    if (!contentType) {
                        return [2 /*return*/, reject(new Error("link-preview-js could not determine content-type for link"))];
                    }
                    if (contentType instanceof Array) {
                        contentType = contentType[0];
                    }
                    if (!constants_1.CONSTANTS.REGEX_CONTENT_TYPE_IMAGE.test(contentType)) return [3 /*break*/, 3];
                    return [2 /*return*/, resolve(parseImageResponse(finalUrl, contentType))];
                case 3:
                    if (!constants_1.CONSTANTS.REGEX_CONTENT_TYPE_AUDIO.test(contentType)) return [3 /*break*/, 4];
                    return [2 /*return*/, resolve(parseAudioResponse(finalUrl, contentType))];
                case 4:
                    if (!constants_1.CONSTANTS.REGEX_CONTENT_TYPE_VIDEO.test(contentType)) return [3 /*break*/, 5];
                    return [2 /*return*/, resolve(parseVideoResponse(finalUrl, contentType))];
                case 5:
                    if (!constants_1.CONSTANTS.REGEX_CONTENT_TYPE_TEXT.test(contentType)) return [3 /*break*/, 7];
                    return [4 /*yield*/, response.text()];
                case 6:
                    htmlString = _c.sent();
                    resolve(parseTextResponse(htmlString, finalUrl, options, contentType));
                    return [3 /*break*/, 8];
                case 7:
                    if (constants_1.CONSTANTS.REGEX_CONTENT_TYPE_APPLICATION.test(contentType)) {
                        return [2 /*return*/, resolve(parseApplicationResponse(finalUrl, contentType))];
                    }
                    else {
                        return [2 /*return*/, reject({
                                error: "link-preview-js Unknown content type for URL."
                            })];
                    }
                    _c.label = 8;
                case 8: return [3 /*break*/, 10];
                case 9:
                    e_1 = _c.sent();
                    reject(new Error("link-preview-js could not fetch link information" + e_1.toString()));
                    return [3 /*break*/, 10];
                case 10: return [2 /*return*/];
            }
        });
    }); });
}
exports.getLinkPreview = getLinkPreview;
function parseImageResponse(url, contentType) {
    return {
        url: url,
        mediaType: "image",
        contentType: contentType,
        favicons: [getDefaultFavicon(url)]
    };
}
function parseAudioResponse(url, contentType) {
    return {
        url: url,
        mediaType: "audio",
        contentType: contentType,
        favicons: [getDefaultFavicon(url)]
    };
}
function parseVideoResponse(url, contentType) {
    return {
        url: url,
        mediaType: "video",
        contentType: contentType,
        favicons: [getDefaultFavicon(url)]
    };
}
function parseApplicationResponse(url, contentType) {
    return {
        url: url,
        mediaType: "application",
        contentType: contentType,
        favicons: [getDefaultFavicon(url)]
    };
}
var parseTextResponse = function (body, url, options, contentType) {
    if (options === void 0) { options = {}; }
    var doc = cheerio_without_node_native_1.default.load(body);
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
function getTitle(doc) {
    var title = doc("meta[property='og:title']").attr("content");
    if (!title) {
        title = doc("title").text();
    }
    return title;
}
function getSiteName(doc) {
    var siteName = doc("meta[property='og:site_name']").attr("content");
    return siteName;
}
function getDescription(doc) {
    var description = doc("meta[name=description]").attr("content");
    if (description === undefined) {
        description = doc("meta[name=Description]").attr("content");
    }
    if (description === undefined) {
        description = doc("meta[property='og:description']").attr("content");
    }
    return description;
}
function getMediaType(doc) {
    var node = doc("meta[name=medium]");
    if (node.length) {
        var content = node.attr("content");
        return content === "image" ? "photo" : content;
    }
    else {
        return doc("meta[property='og:type']").attr("content");
    }
}
function getImages(doc, rootUrl, imagesPropertyType) {
    var images = [], nodes, src, dic = {};
    var imagePropertyType = (imagesPropertyType !== null && imagesPropertyType !== void 0 ? imagesPropertyType : "og");
    nodes = doc("meta[property='" + imagePropertyType + ":image']");
    if (nodes.length) {
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
            if (nodes.length) {
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
    var nodes = doc("meta[property='og:video']");
    var length = nodes.length;
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
            }
            else {
                videos.push(videoObj);
            }
        }
    }
    return videos;
}
// returns an array of URL's to favicon images
function getFavicons(doc, rootUrl) {
    var images = [], nodes = [], src;
    var relSelectors = [
        "rel=icon",
        'rel="shortcut icon"',
        "rel=apple-touch-icon"
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
// returns default favicon (//hostname/favicon.ico) for a url
function getDefaultFavicon(rootUrl) {
    return url_1.default.resolve(rootUrl, "/favicon.ico");
}
