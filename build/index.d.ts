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
export declare function getLinkPreview(text: string, options?: ILinkPreviewOptions): Promise<ILinkPreviewResponse>;
export {};
