import { getLinkPreview, getPreviewFromContent } from "../index";
import prefetchedResponse from "./sampleResponse.json";

describe(`#getLinkPreview()`, () => {
  it(`should extract link info from just URL`, async () => {
    const linkInfo: any = await getLinkPreview(
      `https://www.youtube.com/watch?v=wuClZjOdT30`,
      { headers: { "Accept-Language": `en-US` } }
    );

    expect(linkInfo.url).toEqual(`https://www.youtube.com/watch?v=wuClZjOdT30`);
    expect(linkInfo.siteName).toEqual(`YouTube`);
    expect(linkInfo.title).toEqual(`Geography Now! Germany`);
    expect(linkInfo.description).toBeTruthy();
    expect(linkInfo.mediaType).toEqual(`video.other`);
    expect(linkInfo.images.length).toEqual(1);
    expect(linkInfo.images[0]).toEqual(
      `https://i.ytimg.com/vi/wuClZjOdT30/maxresdefault.jpg`
    );
    expect(linkInfo.videos.length).toEqual(0);
    expect(linkInfo.favicons[0]).not.toBe(``);
    expect(linkInfo.contentType.toLowerCase()).toEqual(`text/html`);
  });

  it(`should extract link info from a URL with a newline`, async () => {
    const linkInfo: any = await getLinkPreview(
      `
      https://www.youtube.com/watch?v=wuClZjOdT30
    `,
      { headers: { "Accept-Language": `en-US` } }
    );

    expect(linkInfo.url).toEqual(`https://www.youtube.com/watch?v=wuClZjOdT30`);
    expect(linkInfo.title).toEqual(`Geography Now! Germany`);
    expect(linkInfo.siteName).toBeTruthy();
    expect(linkInfo.description).toBeTruthy();
    expect(linkInfo.mediaType).toEqual(`video.other`);
    expect(linkInfo.images.length).toEqual(1);
    expect(linkInfo.images[0]).toEqual(
      `https://i.ytimg.com/vi/wuClZjOdT30/maxresdefault.jpg`
    );
    expect(linkInfo.videos.length).toEqual(0);
    expect(linkInfo.favicons[0]).not.toBe(``);
    expect(linkInfo.contentType.toLowerCase()).toEqual(`text/html`);
  });

  it(`should extract link info from just text with a URL`, async () => {
    const linkInfo: any = await getLinkPreview(
      `This is some text blah blah https://www.youtube.com/watch?v=wuClZjOdT30 and more text`,
      { headers: { "Accept-Language": `en-US` } }
    );

    expect(linkInfo.url).toEqual(`https://www.youtube.com/watch?v=wuClZjOdT30`);
    expect(linkInfo.title).toEqual(`Geography Now! Germany`);
    expect(linkInfo.siteName).toEqual(`YouTube`);
    expect(linkInfo.description).toBeTruthy();
    expect(linkInfo.mediaType).toEqual(`video.other`);
    expect(linkInfo.images.length).toEqual(1);
    expect(linkInfo.images[0]).toEqual(
      `https://i.ytimg.com/vi/wuClZjOdT30/maxresdefault.jpg`
    );
    expect(linkInfo.videos.length).toEqual(0);
    expect(linkInfo.favicons[0]).toBeTruthy();
    expect(linkInfo.contentType.toLowerCase()).toEqual(`text/html`);
  });

  it(`should make request with different languages`, async () => {
    let linkInfo: any = await getLinkPreview(`https://www.hsbc.ca/`, {
      headers: { "Accept-Language": `fr` },
      followRedirects: `follow`,
    });
    expect(linkInfo.title).toEqual(`Particuliers | HSBC Canada`);

    linkInfo = await getLinkPreview(`https://www.hsbc.ca/`);
    expect(linkInfo.title).toEqual(`HSBC Personal Banking | HSBC Canada`);
  });

  it(`should handle audio urls`, async () => {
    const linkInfo = await getLinkPreview(
      `https://ondemand.npr.org/anon.npr-mp3/npr/atc/2007/12/20071231_atc_13.mp3`
    );
    expect(linkInfo.url).toEqual(
      `https://ondemand.npr.org/anon.npr-mp3/npr/atc/2007/12/20071231_atc_13.mp3`
    );
    expect(linkInfo.mediaType).toEqual(`audio`);
    expect(linkInfo.contentType?.toLowerCase()).toEqual(`audio/mpeg`);
    expect(linkInfo.favicons[0]).toBeTruthy();
  });

  it(`should handle video urls`, async () => {
    const linkInfo = await getLinkPreview(
      `https://www.w3schools.com/html/mov_bbb.mp4`
    );

    expect(linkInfo.url).toEqual(`https://www.w3schools.com/html/mov_bbb.mp4`);
    expect(linkInfo.mediaType).toEqual(`video`);
    expect(linkInfo.contentType?.toLowerCase()).toEqual(`video/mp4`);
    expect(linkInfo.favicons[0]).toBeTruthy();
  });

  it(`should handle image urls`, async () => {
    const linkInfo = await getLinkPreview(
      `https://media.npr.org/assets/img/2018/04/27/gettyimages-656523922nunes-4bb9a194ab2986834622983bb2f8fe57728a9e5f-s1100-c15.jpg`
    );

    expect(linkInfo.url).toEqual(
      `https://media.npr.org/assets/img/2018/04/27/gettyimages-656523922nunes-4bb9a194ab2986834622983bb2f8fe57728a9e5f-s1100-c15.jpg`
    );
    expect(linkInfo.mediaType).toEqual(`image`);
    expect(linkInfo.contentType?.toLowerCase()).toEqual(`image/jpeg`);
    expect(linkInfo.favicons[0]).toBeTruthy();
  });

  it(`should handle unknown content type urls`, async () => {
    const linkInfo = await getLinkPreview(`https://mjml.io/try-it-live`);

    expect(linkInfo.url).toEqual(`https://mjml.io/try-it-live`);
    expect(linkInfo.mediaType).toEqual(`website`);
  });

  // This site changed? it is not returning application any more but rather website
  it.skip(`should handle application urls`, async () => {
    const linkInfo = await getLinkPreview(
      `https://assets.curtmfg.com/masterlibrary/56282/installsheet/CME_56282_INS.pdf`
    );

    expect(linkInfo.url).toEqual(
      `https://assets.curtmfg.com/masterlibrary/56282/installsheet/CME_56282_INS.pdf`
    );
    expect(linkInfo.mediaType).toEqual(`application`);
    expect(linkInfo.contentType?.toLowerCase()).toEqual(`application/pdf`);
    expect(linkInfo.favicons[0]).toBeTruthy();
  });

  it(`no link in text should fail gracefully`, async () => {
    await expect(
      getLinkPreview(`no link`)
    ).rejects.toThrowErrorMatchingSnapshot();
  });

  it(`should handle malformed urls gracefully`, async () => {
    await expect(
      getLinkPreview(
        `this is a malformed link: ahttps://www.youtube.com/watch?v=wuClZjOdT30`
      )
    ).rejects.toThrowErrorMatchingSnapshot();
  });

  it(`should handle empty strings gracefully`, async () => {
    await expect(getLinkPreview(``)).rejects.toThrowErrorMatchingSnapshot();
  });

  it.skip(`should handle a proxy url option`, async () => {
    // origin header is required by cors-anywhere
    const linkInfo: any = await getLinkPreview(
      `https://www.youtube.com/watch?v=wuClZjOdT30`,
      {
        proxyUrl: `https://cors-anywhere.herokuapp.com/`,
        headers: {
          Origin: `http://localhost:8000`,
          "Accept-Language": `en-US`,
        },
      }
    );

    expect(linkInfo.url).toEqual(`https://www.youtube.com/watch?v=wuClZjOdT30`);
    expect(linkInfo.siteName).toEqual(`YouTube`);
    expect(linkInfo.title).toEqual(`Geography Now! Germany`);
    expect(linkInfo.description).toBeTruthy();
    expect(linkInfo.mediaType).toEqual(`video.other`);
    expect(linkInfo.images.length).toEqual(1);
    expect(linkInfo.images[0]).toEqual(
      `https://i.ytimg.com/vi/wuClZjOdT30/maxresdefault.jpg`
    );
    expect(linkInfo.videos.length).toEqual(0);
    expect(linkInfo.favicons[0]).not.toBe(``);
    expect(linkInfo.contentType.toLowerCase()).toEqual(`text/html`);
  });

  it("should timeout (default 3s) with infinite loading link", async () => {
    try {
      await getLinkPreview(
        `https://www.gamestop.com/video-games/pc-gaming/components/cooling/products/hyper-212-rgb-black-edition-fan/185243.html?gclid=Cj0KCQjwraqHBhDsARIsAKuGZeECDlqkF2cxpcuS0xRxQmrv5BxFawWS_B51kiqehPf64_KlO0oyunsaAhn5EALw_wcB&gclsrc=aw.ds`
      );
    } catch (e) {
      expect(e.message).toEqual("Request timeout");
    }
  });

  it("should timeout (custom 1s) with infinite loading link", async () => {
    try {
      await getLinkPreview(
        `https://www.gamestop.com/video-games/pc-gaming/components/cooling/products/hyper-212-rgb-black-edition-fan/185243.html?gclid=Cj0KCQjwraqHBhDsARIsAKuGZeECDlqkF2cxpcuS0xRxQmrv5BxFawWS_B51kiqehPf64_KlO0oyunsaAhn5EALw_wcB&gclsrc=aw.ds`,
        {
          timeout: 1000,
        }
      );
    } catch (e) {
      expect(e.message).toEqual("Request timeout");
    }
  });
  
  it(`should handle followRedirects option is error`, async () => {
    try {
      await getLinkPreview(`http://google.com/`, { followRedirects: `error` });
    } catch (e) {
      expect(e.message).toEqual(
        `uri requested responds with a redirect, redirect mode is set to error: http://google.com/`,
      );
    }
  });

  it(`should handle followRedirects option is manual but handleRedirects was not provided`, async () => {
    try {
      await getLinkPreview(`http://google.com/`, { followRedirects: `manual` });
    } catch (e) {
      expect(e.message).toEqual(
        `link-preview-js followRedirects is set to manual, but no handleRedirects function was provided`
      );
    }
  });

  it(`should handle followRedirects option is manual with handleRedirects function`, async () => {
    const response = await getLinkPreview(`http://google.com/`, {
      followRedirects: `manual`,
      handleRedirects: (forwardedURL: string) => {
        if (forwardedURL !== `http://www.google.com/`) {
          return false;
        } 
        return true;
      },
    });

    expect(response.contentType).toEqual(`text/html`);
    expect(response.url).toEqual(`http://www.google.com/`);
    expect(response.mediaType).toEqual(`website`);
  });

});

describe(`#getPreviewFromContent`, () => {
  it(`Basic parsing`, async () => {
    const linkInfo: any = await getPreviewFromContent(prefetchedResponse);

    expect(linkInfo.url).toEqual(`https://www.youtube.com/watch?v=wuClZjOdT30`);
    expect(linkInfo.siteName).toEqual(`YouTube`);
    expect(linkInfo.title).toEqual(`Geography Now! Germany`);
    expect(linkInfo.description).toBeTruthy();
    expect(linkInfo.mediaType).toEqual(`video.other`);
    expect(linkInfo.images.length).toEqual(1);
    expect(linkInfo.images[0]).toEqual(
      `https://i.ytimg.com/vi/wuClZjOdT30/maxresdefault.jpg`
    );
    expect(linkInfo.videos.length).toEqual(0);
    expect(linkInfo.favicons[0]).not.toBe(``);
    expect(linkInfo.contentType.toLowerCase()).toEqual(`text/html`);
  });
});

// describe(`simple test`, () => {
//   it("fetch my repo", async () => {
//     const linkInfo: any = await getLinkPreview(
//       "https://github.com/ospfranco/link-preview-js"
//     );
//     console.warn({ linkInfo });

//     expect(1).toEqual(2);
//   });
// });
