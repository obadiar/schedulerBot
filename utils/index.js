function returnBestSlots(payload ,response) {
  var start = new Date(payload.name);
  var possibleDates = [new Date(payload.name)];
  for (var i = 0; i < 8; i ++){
    possibleDates.push(start.setDate(start.getDate() + 1))
  }

  possibleDates = possibleDates.filter( x => {
                                var day = new Date(x).getDay();
                                return day !== 6 && day
                              }).map( x => new Date(x))

  var possibleTimeSlots = [];

  for (var i = 9; i < 17; i ++){
    possibleTimeSlots.push({hours: i, minutes: 0})
    possibleTimeSlots.push({hours: i, minutes: 30})
  }

  var allSlots = [];

  possibleDates.forEach( (day, index) => {
    var newDateObj = {};
    newDateObj["dateArr"] = [];
    possibleTimeSlots.forEach( time => {
      var newDate = new Date(day);
      newDate.setHours(time.hours-7);
      newDate.setMinutes(time.minutes);
      newDate.setSeconds(0);
      newDateObj["dateArr"].push(newDate);
    });
    allSlots.push(newDateObj);
  });
  for(var i = 0; i < allSlots.length; i++) {
    allSlots[i]["dateArr"] = allSlots[i]["dateArr"].filter((slot) => {
      var boolean = true;
      response.items.forEach((item) => {
        var d = new Date(slot);
        var UTCconverted = d.getUTCFullYear() + '-' + z(d.getUTCMonth() + 1) + '-' +
        z(d.getUTCDate()) + 'T' + z(d.getUTCHours()) + ':' +
        z(d.getUTCMinutes()) + ':' + z(d.getUTCSeconds()) + '-07:00';

        if(UTCconverted === item.start.dateTime) {
          boolean= false;
        }
      });
      return boolean;
    })
  }
  var bestSlots = [];
  for(var i = 0; i < allSlots.length; i++) {
    var bestThree = [];
    var start = new Date(payload.name);
    start.setDate(start.getDate() + i);
    start.setHours(start.getHours() - 7);

    start = new Date(start);
    for(var j = 0; j < allSlots[i]["dateArr"].length; j++) {
      if(bestThree.length < 3) {
        const slotDate = new Date(allSlots[i]["dateArr"][j]);
        const diffMs = Math.abs(slotDate - start);
        bestThree.push({date: allSlots[i]["dateArr"][j], diff: diffMs});
      } else{
        //compare date
        const slotDate = new Date(allSlots[i]["dateArr"][j]);

        const diffMs = Math.abs(slotDate - start);
        for(var k = 0; k < bestThree.length; k++) {
          if(diffMs < bestThree[k].diff) {
            bestThree[k] = {date: slotDate, diff: diffMs};
            break;
          }
        }
      }
    }
    bestSlots.push(bestThree);
  }
  var finalBestSlots = [];
  for(var i =0; i < bestSlots.length; i++) {
    for(var j = 0; j < bestSlots[i].length; j++) {
      finalBestSlots.push({
        text: bestSlots[i][j].date,
        value: bestSlots[i][j].date
      })
    }
  }
  return finalBestSlots;
}

function z(n){return (n < 10? '0' : '') + n;};

module.exports = {returnBestSlots};
