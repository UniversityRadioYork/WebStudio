import { format, fromUnixTime } from "date-fns";

export function convertModelToFormData(
  model: any,
  form: FormData | null = null,
  namespace = ""
): FormData {
  let formData = form || new FormData();

  for (let propertyName in model) {
    if (!model.hasOwnProperty(propertyName) || !model[propertyName]) continue;
    let formKey = namespace ? `${namespace}[${propertyName}]` : propertyName;
    if (model[propertyName] instanceof Date)
      formData.append(formKey, model[propertyName].toISOString());
    else if (model[propertyName] instanceof Array) {
      model[propertyName].forEach((element: any, index: number) => {
        const tempFormKey = `${formKey}[${index}]`;
        convertModelToFormData(element, formData, tempFormKey);
      });
    } else if (
      typeof model[propertyName] === "object" &&
      !(model[propertyName] instanceof File)
    )
      convertModelToFormData(model[propertyName], formData, formKey);
    else formData.append(formKey, model[propertyName].toString());
  }
  return formData;
}

export function urlEncode(element: any, key?: string, list?: any[]) {
  list = list || [];
  if (typeof element == "object") {
    for (var idx in element)
      urlEncode(element[idx], key ? key + "[" + idx + "]" : idx, list);
  } else {
    list.push(key + "=" + encodeURIComponent(element));
  }
  return list.join("&");
}

export function secToHHMM(sec: number = 0) {
  var d = new Date();
  d.setHours(0);
  d.setMinutes(0);
  d.setSeconds(0);
  d = new Date(d.getTime() + Math.ceil(sec) * 1000);
  return d.toLocaleString("en-GB").split(" ")[1];
}

export function HHMMTosec(timeString: string = "00:00:00") {
  var s: number = parseInt(timeString[7]);
  s += 10 * parseInt(timeString[6]);
  s += 60 * parseInt(timeString[4]);
  s += 600 * parseInt(timeString[3]);
  s += 3600 * parseInt(timeString[1]);
  s += 36000 * parseInt(timeString[0]);
  return s;
}

export function timestampToHHMM(sec: number = 0) {
  return format(fromUnixTime(sec), "HH:mm:ss");
}

export function timestampToDateTime(timestamp: number) {
  var date = new Date(timestamp * 1000);
  var str =
    date.toLocaleDateString("en-GB") + " " + date.toLocaleTimeString("en-GB");
  return str;
}
