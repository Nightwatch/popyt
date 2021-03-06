import YouTube, { Video, Channel, Playlist, YTComment, VideoAbuseReportReason, Subscription, VideoCategory } from '..'
import { Cache, Parser } from '../util'

/**
 * @ignore
 */
export class GenericService {
  /* istanbul ignore next */
  public static async getItem (youtube: YouTube, type: typeof Video | typeof Channel | typeof Playlist | typeof YTComment | typeof Subscription | typeof VideoCategory,
    mine: boolean, id?: string): Promise<Video | Channel | Playlist | YTComment | Subscription | VideoCategory> {
    if (!([ Video, Channel, Playlist, YTComment, Subscription, VideoCategory, VideoAbuseReportReason ].includes(type))) {
      return Promise.reject('Type must be a video, channel, playlist, comment, subscription, or video category.')
    }

    if (!mine && (id === undefined || id === null)) {
      return Promise.reject('Items must either specify an ID or the \'mine\' parameter.')
    }

    if (mine && (type === YTComment || type === Video)) {
      return Promise.reject(`${type.endpoint} cannot be filtered by the 'mine' parameter.`)
    }

    const cached = Cache.get(`get://${type.endpoint}/${id ? id : 'mine'}`)

    if (youtube._shouldCache && cached) {
      return cached
    }

    const result = await youtube._request.api(type.endpoint, {
      [id ? 'id' : 'mine']: id ? id : mine,
      fields: encodeURIComponent(type.fields),
      part: type === YTComment ? !type.part.includes('snippet') ? type.part + ',snippet' : type.part : type.part
    }, youtube.token, youtube.accessToken)

    if (result.items.length === 0) {
      return Promise.reject('Item not found')
    }

    let endResult: Video | Playlist | Channel | YTComment | Subscription | VideoCategory

    if (type === YTComment) {
      endResult = new type(youtube, result.items[0], result.items[0].snippet.channelId ? 'channel' : 'video')
    } else {
      endResult = new (type as typeof Video | typeof Channel | typeof Playlist | typeof Subscription | typeof VideoCategory)(youtube, result.items[0])
    }

    youtube._cache(`get://${type.endpoint}/${id ? id : 'mine'}`, endResult)

    return endResult
  }

  /* istanbul ignore next */
  public static async getPaginatedItems (youtube: YouTube, endpoint: 'playlistItems' | 'playlists' | 'playlists:channel' | 'commentThreads' |
    'commentThreads:video' | 'commentThreads:channel' | 'comments' | 'subscriptions' | 'videoCategories' | 'videoAbuseReportReasons',
    mine: boolean, id?: string, maxResults: number = -1): Promise<Video[] | YTComment[] | Playlist[] | Subscription[] | VideoCategory[] | VideoAbuseReportReason[]> {
    if (!mine && (id === undefined || id === null) && endpoint !== 'videoAbuseReportReasons') {
      return Promise.reject(`${endpoint} must either specify an ID or the 'mine' parameter.`)
    }

    if (mine && (endpoint.startsWith('comment') || [ 'playlistItems', 'videoCategories' ].includes(endpoint))) {
      return Promise.reject(`${endpoint} cannot be filtered by the 'mine' parameter.`)
    }

    const cached = Cache.get(`get://${endpoint}/${id ? id : 'mine'}/${maxResults}`)

    if (youtube._shouldCache && cached) {
      return cached
    }

    let items = []

    const full = maxResults <= 0
    const options: {
      part: string,
      maxResults?: number,
      videoId?: string,
      parentId?: string,
      textFormat?: string,
      playlistId?: string,
      channelId?: string,
      regionCode?: string
      pageToken?: string,
      mine?: boolean
    } = {
      part: 'snippet'
    }

    let max: number
    let clazz: typeof Video | typeof YTComment | typeof Playlist | typeof Subscription | typeof VideoCategory | typeof VideoAbuseReportReason
    let commentType: 'video' | 'channel'

    if (endpoint === 'playlistItems') {
      max = 50
      clazz = Video
      options.playlistId = id
    } else if (endpoint.startsWith('commentThreads')) {
      max = 100
      clazz = YTComment

      const [, type ] = endpoint.split(':') as ('video' | 'channel')[]

      commentType = type ? type : 'video'
      endpoint = 'commentThreads'
      options[`${type}Id`] = id
      options.textFormat = 'plainText'
    } else if (endpoint === 'comments') {
      max = 100
      clazz = YTComment
      options.parentId = id
    } else if (endpoint === 'playlists:channel') {
      max = 50
      clazz = Playlist
      endpoint = 'playlists'
      if (mine) options.mine = mine; else options.channelId = id
    } else if (endpoint === 'subscriptions') {
      max = 50
      clazz = Subscription
      if (mine) options.mine = mine; else options.channelId = id
    } else if (endpoint === 'videoCategories') {
      clazz = VideoCategory
      options.regionCode = id
    } else if (endpoint === 'videoAbuseReportReasons') {
      clazz = VideoAbuseReportReason
    } else {
      return Promise.reject('Unknown item type ' + endpoint)
    }

    if (max && maxResults > max) {
      return Promise.reject(`Max results must be ${max} or below for ${endpoint}`)
    }

    if (max) {
      options.maxResults = full ? max : maxResults
    }

    let results
    let pages = null
    let shouldReturn = !full

    for (let i = 1; i < pages ? pages : 3; i++) {
      results = await youtube._request.api(endpoint, options, youtube.token, youtube.accessToken)

      if (results.items.length === 0) {
        return Promise.reject(`${endpoint} not found`)
      }

      if (!pages) {
        pages = results.pageInfo ? results.pageInfo.totalResults / results.pageInfo.resultsPerPage : 0

        if (pages <= 1) {
          shouldReturn = true
        }

        pages = Math.floor(pages)
      }

      results.items.forEach(item => {
        let comment: YTComment

        if (item.snippet.topLevelComment) {
          comment = new YTComment(youtube, item.snippet.topLevelComment, commentType)
          items.push(comment)
        } else {
          items.push(new clazz(youtube, item, commentType))
        }

        if (item.replies) {
          item.replies.comments.forEach(reply => {
            const created = new YTComment(youtube, reply, commentType)
            comment.replies.push(created)
          })
        }
      })

      if (results.nextPageToken && !shouldReturn) {
        options.pageToken = results.nextPageToken
      } else {
        return items
      }
    }

    youtube._cache(`get://${endpoint}/${id ? id : 'mine'}/${maxResults}`, items)

    return items
  }

  /* istanbul ignore next */
  public static async getId (youtube: YouTube, input: string, type: typeof Video | typeof Channel | typeof Playlist): Promise<string> {
    let id: string = null

    const cached = Cache.get(`get_id://${type.endpoint}/${input}`)

    if (cached) {
      return cached
    }

    const cachedEntity: Video | Channel | Playlist | YTComment = Cache.get(`get://${type.endpoint}/${input}`)

    if (cachedEntity && cachedEntity.id) {
      return cachedEntity.id
    }

    if (input.includes('youtube.com') || input.includes('youtu.be')) {
      const idFromUrl = Parser.parseUrl(input)[type.name.toLowerCase()]

      // Custom channel URLs don't work that well
      if (type === Channel && idFromUrl && !idFromUrl.startsWith('UC')) {
        id = await youtube._request.api('search', {
          q: encodeURIComponent(idFromUrl),
          type: 'channel',
          part: 'id'
        }, youtube.token, youtube.accessToken).then(r => r.items[0] ? r.items[0].id.channelId : undefined)
      }

      id = idFromUrl
    }

    if (id !== null && id !== undefined && id !== '') {
      return id
    }

    if (type === Channel && (!input.startsWith('UC') || input.includes(' '))) {
      id = await youtube._request.api('search', {
        q: encodeURIComponent(input),
        type: 'channel',
        part: 'id', maxResults: 1
      }, youtube.token, youtube.accessToken).then(r => r.items.length > 0 ? r.items[0].id.channelId : undefined)
    } else if (type === Playlist && input.includes(' ')) {
      id = await youtube._request.api('search', {
        q: encodeURIComponent(input),
        type: 'playlist',
        part: 'id',
        maxResults: 1
      }, youtube.token, youtube.accessToken).then(r => r.items.length > 0 ? r.items[0].id.playlistId : undefined)
    } else if (type === Video && (input.length < 11 || input.includes(' '))) {
      id = await youtube._request.api('search', {
        q: encodeURIComponent(input),
        type: 'video',
        part: 'id',
        maxResults: 1
      }, youtube.token, youtube.accessToken).then(r => r.items.length > 0 ? r.items[0].id.videoId : undefined)
    }

    if (id === null || id === undefined || id === '') {
      id = input
    }

    youtube._cache(`get_id://${type.endpoint}/${input}`, id)

    return id
  }
}
