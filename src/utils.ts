export function secToHHMM(sec: number = 0) {
  var d = new Date();
  d.setHours(0);
  d.setMinutes(0);
  d.setSeconds(0);
  d = new Date(Math.round(d.getTime()) + sec * 1000);
  return d.toLocaleString('en-GB').split(' ')[1];
};

export function timestampToDateTime(timestamp: number) {
  var date = new Date(timestamp * 1000);
  var str = date.toLocaleDateString("en-GB") + " " + date.toLocaleTimeString("en-GB")
  return str;

}
