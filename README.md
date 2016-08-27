# Youtube Channel Recommendations

Recommends youtube channels based on the subscriptions of your subscriptions.

## Setup
* Create a google project via console.developers.google.com
* Activate YouTube Data API v3
* Create new Web Client credentials and download them as json
* Rename them to credentials.json and place them into this dir.
* ```npm install```
* ```npm start```

Recommendations are saved to channels.json and displayed in browser.

## Show more recommendations
Change the number in ```.then(channels => _.take(channels, 30))``` (index.js) 