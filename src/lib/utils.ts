export function convertModelToFormData(
  model: any,
  form: FormData | null = null,
  namespace = ""
): FormData {
  let formData = form || new FormData();
  let formKey;

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
