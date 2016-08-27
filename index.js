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
        lien.lien(err, 400);
        return console.log(err);
    }

    console.log('Got the tokens.');

    oauth.setCredentials(tokens);

    getSubscriptions({ mine: true }).then(data => console.log('Final', data))    
  });
});

function _getSingleSubscriptionPage(paramOptions) {
  const defaultOptions = {
    part: 'snippet',
    maxResults: 50
  };

  const options = _.merge({}, defaultOptions, paramOptions)

  return new Promise((res, rej) => {
    Youtube.subscriptions.list(options, (err, data) => {
      if (err) return rej(err);
      res(data);
    });
  });
}

function getSubscriptions(options, subscriptions) {
  if (!subscriptions) {
    subscriptions = [];
  }

  //TODO: Iteratively call getSubscriptions to get all Pages and join Data afterwards
  return _getSingleSubscriptionPage(options).then(data => {
    subscriptions.push(data.items);

    console.log(subscriptions);

    if (data.nextPageToken) {
      //TODO: Merge options with pageToken = data.nextPageToken
      return getSubscriptions(_.merge({}, options, { pageToken: data.nextPageToken }), subscriptions)
    }
    
    return subscriptions;
  })
}