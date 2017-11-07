var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var oauth2Client = new OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://a5bb9b3d.ngrok.io/callback'
);
var calendar = google.calendar('v3');
function createGoogleCalendar(tokens, title, date, attendees) {
  var oauth2Client = new OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://a5bb9b3d.ngrok.io/createCalendar/callback'
  );
  oauth2Client.setCredentials(tokens);
  // date = date.setHours(date.getHours() + 8);
  var endDate = new Date(date);
  endDate.setMinutes(endDate.getMinutes() + 30);
  date = new Date(date);
  var events = {
    summary: title,
    start: {
      'dateTime': date,
      'timeZone': 'America/Los_Angeles'
    },
    end: {
      'dateTime': date,
      'timeZone': 'America/Los_Angeles'
    }
  }
  if(attendees) {
    events = {
              summary: title,
              start: {
                'dateTime': date,
                'timeZone': 'America/Los_Angeles'
              },
              end: {
                'dateTime': endDate,
                'timeZone': 'America/Los_Angeles'
              },
              'attendees': attendees

            }

  }
  return new Promise(function(resolve, reject) {
    calendar.events.insert({
      auth: oauth2Client,
      calendarId: 'primary',
      sendNotifications: true,
      resource: events

    }, function(err, res) {
      if(err) {
        console.log("ERR creating", err);
        reject(err);
      } else{
        console.log("RES", res);
        resolve(tokens);
      }
    })
  })
}

module.exports = {createGoogleCalendar};
