import 'mocha'
import { expect } from 'chai'
import { YouTube, Video, YTComment, Playlist } from '../src'
import { apiKey } from './config'
import { parseUrl } from '../src/util'

describe('Creation of the YouTube instance', () => {
  it('should work with an invalid token', () => {
    expect(new YouTube('')).to.be.instanceOf(YouTube)
  })
})

describe('Searching', () => {
  it('should default to 10 results', async () => {
    const youtube = new YouTube(apiKey)
    expect((await youtube.searchVideos('never gonna give you up')).length).to.equal(10)
  })

  it('should return an array', async () => {
    const youtube = new YouTube(apiKey)
    expect(await youtube.searchPlaylists('music')).to.be.instanceOf(Array)
  })

  it('should reject if maxResults is < 1', async () => {
    const youtube = new YouTube(apiKey)
    expect(await youtube.searchChannels('rick astley', 0).catch(error => { return error })).to.equal('Max results must be greater than 0 and less than or equal to 50')
  })

  it('should reject if maxResults is > 50', async () => {
    const youtube = new YouTube(apiKey)
    expect(await youtube.searchVideos('never gonna give you up', 51).catch(error => { return error })).to.equal('Max results must be greater than 0 and less than or equal to 50')
  })

  it('should reject if api key is wrong', async () => {
    const youtube = new YouTube('')
    expect(await youtube.searchVideos('never gonna give you up').catch(error => { return error })).to.be.instanceOf(Error)
  })
})

describe('Getting', () => {
  it('should work with ids', async () => {
    const youtube = new YouTube(apiKey)
    expect(await youtube.getVideo('dQw4w9WgXcQ')).to.be.instanceOf(Video)
  })

  it('should work with urls', async () => {
    expect(parseUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ').video).to.equal('dQw4w9WgXcQ')
    expect(parseUrl('https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw').channel).to.equal('UCuAXFkgsw1L7xaCfnd5JJOw')
    expect(parseUrl('https://www.youtube.com/playlist?list=PLMC9KNkIncKvYin_USF1qoJQnIyMAfRxl').playlist).to.equal('PLMC9KNkIncKvYin_USF1qoJQnIyMAfRxl')
  })

  it('should reject if the item isn\'t found', async () => {
    const youtube = new YouTube(apiKey)
    expect(await youtube.getChannel('dQw4w9WgXcQ').catch(error => { return error })).to.equal('Item not found')
  })

  it('should work with comments', async () => {
    const youtube = new YouTube(apiKey)
    expect(await youtube.getComment('UgyNb5InfceN2n5WhG94AaABAg')).to.be.instanceOf(YTComment)
  })

  it('should work with replies', async () => {
    const youtube = new YouTube(apiKey)
    expect((await (await youtube.getComment('UgyNb5InfceN2n5WhG94AaABAg')).fetchReplies()).length).to.be.greaterThan(0)
  })

  it('should work with playlists', async () => {
    const youtube = new YouTube(apiKey)
    expect(await youtube.getPlaylist('PLMC9KNkIncKvYin_USF1qoJQnIyMAfRxl')).to.be.instanceOf(Playlist)
  })

  describe('Playlist items', () => {
    it('should reject if the playlist isn\'t found', async () => {
      const youtube = new YouTube(apiKey)
      expect(await youtube.getPlaylistItems('').catch(error => { return error })).to.equal('Playlist not found')
    })

    it('should reject if maxResults is > 50', async () => {
      const youtube = new YouTube(apiKey)
      expect(await youtube.getPlaylistItems('PLMC9KNkIncKvYin_USF1qoJQnIyMAfRxl', 51).catch(error => { return error })).to.equal('Max results must be 50 or below')
    })

    it('should return an array with a length of <= maxResults', async () => {
      const youtube = new YouTube(apiKey)
      expect((await youtube.getPlaylistItems('PLMC9KNkIncKvYin_USF1qoJQnIyMAfRxl', 2)).length).to.be.lessThan(3)
    })

    it('should return an array the size of the playlist is maxResults isn\'t defined or is < 1', async () => {
      const youtube = new YouTube(apiKey)
      expect((await youtube.getPlaylistItems('PLMC9KNkIncKvYin_USF1qoJQnIyMAfRxl', 0)).length).to.be.greaterThan(50)
    }).timeout(8000)
  })

  describe('Video comments', () => {
    it('should work with valid videos with comments and replies', async () => {
      const youtube = new YouTube(apiKey)
      const comments = await youtube.getVideoComments('Lq1D8PFnjWY')

      expect(comments.find(comment => comment.text.displayed.startsWith('comment'))).to.be.instanceOf(YTComment)
      expect(comments.find(comment => comment.text.displayed.startsWith('comment')).replies[0]).to.be.instanceOf(YTComment)
    })

    it('should not work with valid videos with comments disabled', async () => {
      const youtube = new YouTube(apiKey)
      expect(await youtube.getVideoComments('24EWkH5ipdw').catch(error => { return error })).to.equal('Comment thread not found')
    })

    it('should not work with invalid videos', async () => {
      const youtube = new YouTube(apiKey)
      expect(await youtube.getVideoComments('0').catch(error => { return error })).to.equal('Comment thread not found')
    })

    it('should return an array with a length of <= maxResults', async () => {
      const youtube = new YouTube(apiKey)
      expect((await youtube.getVideoComments('Lq1D8PFnjWY', 1)).length).to.be.lessThan(2)
    })
  })
})
