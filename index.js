const _ = require('lodash')
const Youtube = require('youtube-api')
const fs = require('fs');
const Lien = require('lien');
const opn = require('opn');
 
// I downloaded the file from OAuth2 -> Download JSON 
const CREDENTIALS = require('./credentials.json');
 
// Init lien server 
let server = new Lien({
    host: 'localhost',
    port: 5000
});
 
// Authenticate 
// You can access the Youtube resources via OAuth2 only. 
// https://developers.google.com/youtube/v3/guides/moving_to_oauth#service_accounts 
let oauth = Youtube.authenticate({
    type: 'oauth',
   client_id: CREDENTIALS.web.client_id,
   client_secret: CREDENTIALS.web.client_secret,
   redirect_url: CREDENTIALS.web.redirect_uris[0]
});
 
opn(oauth.generateAuthUrl({
    access_type: 'offline',
    //youtube, youtube.force-ssl, youtube.readonly, youtubepartner
    scope: [
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.force-ssl',
    'https://www.googleapis.com/auth/youtube.readonly',
  ]
}));
 
// Handle oauth2 callback 
server.addPage('/oauth2callback', lien => {
  console.log('Trying to get the token using the following code: ', lien.query.code);
  oauth.getToken(lien.query.code, (err, tokens) => {
    if (err) {
      lien.end('Error' + error)
      return console.log(err);
    }

    console.log('Got the tokens.');

    oauth.setCredentials(tokens);

    const knownChannels = [];
    getAllPages(Youtube.subscriptions.list, { mine: true })
    .then(subscriptions => {
      return _(subscriptions).flatten().reduce((result, sub) => {
        const channelId = sub.snippet.resourceId.channelId;

        knownChannels.push(channelId);
        result[channelId] = sub;

        return result;
      }, {});
    })
    .then(subscriptions => {
      //Get for each subscription the featuredChannels
      return Promise.all(_.map(subscriptions, (sub, id) => {
        return getAllPages(Youtube.channels.list, { 
          id: id, 
          part: 'brandingSettings', 
          fields: 'items/brandingSettings/channel/featuredChannelsUrls' 
        }).then(data => {
          //Only return featuredChannels and nothing more
          const featuredChannels = _.get(data, '[0].[0].brandingSettings.channel.featuredChannelsUrls');
          return featuredChannels;
        })
      }));
    })
    .then(channelList => _.flatten(channelList))
    .then(channels => _.difference(channels, knownChannels)) // Remove known channels
    .then(channels => _.difference(channels, [undefined])) // Workaround: Sometimes a channel does not have featuredChannels
    .then(channels => {
      //Count occurrences
      return _.reduce(channels, (result, channel) => {
        result[channel] = (result[channel] || 0) + 1
        return result;
      }, {});
    })
    .then(counted => {
      //Map for usage in orderBy
      return _.map(counted, (count, id) => {
        return { id: id, count: count }
      });
    })
    .then(collection => _.orderBy(collection, ['count'], ['desc']))
    .then(channels => _.take(channels, 30))
    .then(channels => {
      return Promise.all(_.map(channels, channel => {
        return getAllPages(Youtube.channels.list, { 
          id: channel.id, 
          part: 'snippet', 
          fields: 'items(snippet(description,title))' // Maybe replace with: 'items(snippet(description,thumbnails,title))' 
        }).then(data => {
          const snippet = _.get(data, '[0].[0].snippet');
          return _.merge({}, channel, { snippet: snippet });
        })
      }))
    })
    .then((channels) => {
      const stringified = JSON.stringify(channels, null, 4);
      fs.writeFile('channels.json', stringified, (err) => {
        if (err) return console.log(err);
        lien.end('<pre>' + stringified + '</pre>');
        process.exit();
      });
    });

  });
});

function _getSinglePage(func, paramOptions) {
  const defaultOptions = {
    part: 'snippet',
    maxResults: 50
  };

  const options = _.merge({}, defaultOptions, paramOptions)

  return new Promise((res, rej) => {
    func(options, (err, data) => {
      if (err) return rej(err);
      res(data);
    });
  });
}

function getAllPages(func, options, data) {
  if (!data) {
    data = [];
  }

  return _getSinglePage(func, options).then(page => {
    data.push(page.items);

    if (page.nextPageToken) {
      return getAllPages(func, _.merge({}, options, { pageToken: page.nextPageToken }), data)
    }
    
    return data;
  })
}