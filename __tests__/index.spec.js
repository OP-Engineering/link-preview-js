const LinkPreview = require('../index.js');
const expect = require('expect.js');

describe('link preview', () => {
  it('should extract link info from just URL', async () => {
    const linkInfo = await LinkPreview.getPreview('https://www.youtube.com/watch?v=wuClZjOdT30');

    // { url: 'https://www.youtube.com/watch?v=wuClZjOdT30',
    //   title: 'Geography Now! Germany - YouTube',
    //   description: 'Gluten free vegetarians beware. Watch at your own risk. We now have a Public mailbox! Feel free to send anything via mail! Our public mailbox address is: 190...',
    //   mediaType: 'video',
    //   images: [ 'https://i.ytimg.com/vi/wuClZjOdT30/maxresdefault.jpg' ],
    //   videos: undefined }

    expect(linkInfo.url).to.be.equal('https://www.youtube.com/watch?v=wuClZjOdT30');
    expect(linkInfo.title).to.be.equal('Geography Now! Germany');
    expect(linkInfo.description).to.be.ok();
    expect(linkInfo.mediaType).to.be.equal('video.other');
    expect(linkInfo.images.length).to.be.equal(1);
    expect(linkInfo.images[0]).to.be.equal('https://i.ytimg.com/vi/wuClZjOdT30/maxresdefault.jpg');
    expect(linkInfo.videos.length).to.be.equal(0);
    expect(linkInfo.favicons[0]).to.be.equal('https://www.youtube.com/yts/img/favicon_32-vflOogEID.png');
    expect(linkInfo.contentType.toLowerCase()).to.be.equal('text/html; charset=utf-8');
  });

  it('should extract link info from a URL with a newline', async () => {
    const linkInfo = await LinkPreview.getPreview(`
      https://www.youtube.com/watch?v=wuClZjOdT30
    `);
    // { url: 'https://www.youtube.com/watch?v=wuClZjOdT30',
    //   title: 'Geography Now! Germany - YouTube',
    //   description: 'Gluten free vegetarians beware. Watch at your own risk. We now have a Public mailbox! Feel free to send anything via mail! Our public mailbox address is: 190...',
    //   mediaType: 'video',
    //   images: [ 'https://i.ytimg.com/vi/wuClZjOdT30/maxresdefault.jpg' ],
    //   videos: undefined }

    expect(linkInfo.url).to.be.equal('https://www.youtube.com/watch?v=wuClZjOdT30');
    expect(linkInfo.title).to.be.equal('Geography Now! Germany');
    expect(linkInfo.description).to.be.ok();
    expect(linkInfo.mediaType).to.be.equal('video.other');
    expect(linkInfo.images.length).to.be.equal(1);
    expect(linkInfo.images[0]).to.be.equal('https://i.ytimg.com/vi/wuClZjOdT30/maxresdefault.jpg');
    expect(linkInfo.videos.length).to.be.equal(0);
    expect(linkInfo.favicons[0]).to.be.equal('https://www.youtube.com/yts/img/favicon_32-vflOogEID.png');
    expect(linkInfo.contentType.toLowerCase()).to.be.equal('text/html; charset=utf-8');
  });

  it('should extract link info from just text with a URL', async () => {
    const linkInfo = await LinkPreview.getPreview('This is some text blah blah https://www.youtube.com/watch?v=wuClZjOdT30 and more text');
    // { url: 'https://www.youtube.com/watch?v=wuClZjOdT30',
    //   title: 'Geography Now! Germany - YouTube',
    //   description: 'Gluten free vegetarians beware. Watch at your own risk. We now have a Public mailbox! Feel free to send anything via mail! Our public mailbox address is: 190...',
    //   mediaType: 'video',
    //   images: [ 'https://i.ytimg.com/vi/wuClZjOdT30/maxresdefault.jpg' ],
    //   videos: undefined }

    expect(linkInfo.url).to.be.equal('https://www.youtube.com/watch?v=wuClZjOdT30');
    expect(linkInfo.title).to.be.equal('Geography Now! Germany');
    expect(linkInfo.description).to.be.ok();
    expect(linkInfo.mediaType).to.be.equal('video.other');
    expect(linkInfo.images.length).to.be.equal(1);
    expect(linkInfo.images[0]).to.be.equal('https://i.ytimg.com/vi/wuClZjOdT30/maxresdefault.jpg');
    expect(linkInfo.videos.length).to.be.equal(0);
    expect(linkInfo.favicons[0]).to.be.equal('https://www.youtube.com/yts/img/favicon_32-vflOogEID.png');
    expect(linkInfo.contentType.toLowerCase()).to.be.equal('text/html; charset=utf-8');
  });

  it('should handle audio urls', async () => {
    const linkInfo = await LinkPreview.getPreview('https://ondemand.npr.org/anon.npr-mp3/npr/atc/2007/12/20071231_atc_13.mp3');

    // { url: 'https://ondemand.npr.org/anon.npr-mp3/npr/atc/2007/12/20071231_atc_13.mp3',
    //   mediaType: 'audio',
    //   contentType: 'audio/mpeg',
    //   favicons: [ 'https://ondemand.npr.org/favicon.ico' ] }

    expect(linkInfo.url).to.be.equal('https://ondemand.npr.org/anon.npr-mp3/npr/atc/2007/12/20071231_atc_13.mp3');
    expect(linkInfo.mediaType).to.be.equal('audio');
    expect(linkInfo.contentType.toLowerCase()).to.be.equal('audio/mpeg');
    expect(linkInfo.favicons[0]).to.be.ok();
  });

  it('should handle video urls', async () => {
    const linkInfo = await LinkPreview.getPreview('https://www.w3schools.com/html/mov_bbb.mp4');

    // { url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    //   mediaType: 'video',
    //   contentType: 'video/mp4',
    //   favicons: [ 'https://www.w3schools.com/favicon.ico' ] }

    expect(linkInfo.url).to.be.equal('https://www.w3schools.com/html/mov_bbb.mp4');
    expect(linkInfo.mediaType).to.be.equal('video');
    expect(linkInfo.contentType.toLowerCase()).to.be.equal('video/mp4');
    expect(linkInfo.favicons[0]).to.be.ok();
  });

  it('should handle image urls', async () => {
    const linkInfo = await LinkPreview.getPreview('https://media.npr.org/assets/img/2018/04/27/gettyimages-656523922nunes-4bb9a194ab2986834622983bb2f8fe57728a9e5f-s1100-c15.jpg');

    // { url: 'https://media.npr.org/assets/img/2018/04/27/gettyimages-656523922nunes-4bb9a194ab2986834622983bb2f8fe57728a9e5f-s1100-c15.jpg',
    //   mediaType: 'image',
    //   contentType: 'image/jpeg',
    //   favicons: [ 'https://media.npr.org/favicon.ico' ] }

    expect(linkInfo.url).to.be.equal('https://media.npr.org/assets/img/2018/04/27/gettyimages-656523922nunes-4bb9a194ab2986834622983bb2f8fe57728a9e5f-s1100-c15.jpg');
    expect(linkInfo.mediaType).to.be.equal('image');
    expect(linkInfo.contentType.toLowerCase()).to.be.equal('image/jpeg');
    expect(linkInfo.favicons[0]).to.be.ok();
  });

  it('should handle application urls', async () => {
    const linkInfo = await LinkPreview.getPreview('https://assets.curtmfg.com/masterlibrary/56282/installsheet/CME_56282_INS.pdf');

    // { url: 'https://assets.curtmfg.com/masterlibrary/56282/installsheet/CME_56282_INS.pdf',
    //  mediaType: 'application',
    //  contentType: 'application/pdf',
    //  favicons: [ 'https://assets.curtmfg.com/favicon.ico' ] }

    expect(linkInfo.url).to.be.equal('https://assets.curtmfg.com/masterlibrary/56282/installsheet/CME_56282_INS.pdf');
    expect(linkInfo.mediaType).to.be.equal('application');
    expect(linkInfo.contentType.toLowerCase()).to.be.equal('application/pdf');
    expect(linkInfo.favicons[0]).to.be.ok();
  });

  it('no link in text should fail gracefully', async () => {
    try {
      await LinkPreview.getPreview('there is no link here');
    } catch (e) {
      expect(e.error).to.be('React-Native-Link-Preview did not find a link in the text');
    }
  });

  it('should handle malformed urls gracefully', async () => {
    try {
      await LinkPreview.getPreview('this is a malformed link: ahttps://www.youtube.com/watch?v=wuClZjOdT30');
    } catch (e) {
      expect(e.error).to.be('React-Native-Link-Preview did not find a link in the text');
    }
  });
});
