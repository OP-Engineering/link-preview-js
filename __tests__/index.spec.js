import LinkPreview from '../index.js';
import expect from 'expect.js';

global.fetch = require('node-fetch');

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
    expect(linkInfo.title).to.be.equal('Geography Now! Germany - YouTube');
    expect(linkInfo.description).to.be.equal('Gluten free vegetarians beware. Watch at your own risk. We now have a Public mailbox! Feel free to send anything via mail! Our public mailbox address is: 190...');
    expect(linkInfo.mediaType).to.be.equal('video');
    expect(linkInfo.images.length).to.be.equal(1);
    expect(linkInfo.images[0]).to.be.equal('https://i.ytimg.com/vi/wuClZjOdT30/maxresdefault.jpg');
    expect(linkInfo.videos.length).to.be.equal(0);
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
    expect(linkInfo.title).to.be.equal('Geography Now! Germany - YouTube');
    expect(linkInfo.description).to.be.equal('Gluten free vegetarians beware. Watch at your own risk. We now have a Public mailbox! Feel free to send anything via mail! Our public mailbox address is: 190...');
    expect(linkInfo.mediaType).to.be.equal('video');
    expect(linkInfo.images.length).to.be.equal(1);
    expect(linkInfo.images[0]).to.be.equal('https://i.ytimg.com/vi/wuClZjOdT30/maxresdefault.jpg');
    expect(linkInfo.videos.length).to.be.equal(0);
  });

  it('no link in text should fail gracefully', async () => {
    try {
      await LinkPreview.getPreview('there is no link here');
    } catch (e) {
      expect(e.error).to.be('React-Native-Preview-Link did not find a link in the text');
    }
  });

  it('should handle malformed urls gracefully', async () => {
    try {
      await LinkPreview.getPreview('this is a malformed link: ahttps://www.youtube.com/watch?v=wuClZjOdT30');
    } catch (e) {
      expect(e.error).to.be('React-Native-Preview-Link did not find a link in the text');
    }
  });
});
