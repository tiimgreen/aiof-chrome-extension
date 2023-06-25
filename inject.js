(function (xhr) {
  const XHR = XMLHttpRequest.prototype;
  const open = XHR.open;
  const send = XHR.send;
  const setRequestHeader = XHR.setRequestHeader;

  const MESSAGES_ENDPOINT_REGEX = /https:\/\/onlyfans.com\/api2\/v2\/chats\/([0-9]+)\/messages/;

  XHR.open = function (method, url) {
    this._method = method;
    this._url = url;
    this._requestHeaders = {};
    this._startTime = (new Date()).toISOString();
    return open.apply(this, arguments);
  };

  XHR.setRequestHeader = function (header, value) {
    this._requestHeaders[header] = value;
    return setRequestHeader.apply(this, arguments);
  };

  XHR.send = function (postData) {
    this.addEventListener("load", function () {
      const endTime = (new Date()).toISOString();
      const myUrl = this._url ? this._url.toLowerCase() : this._url;

      if (myUrl && myUrl.match(MESSAGES_ENDPOINT_REGEX)) {
        console.log(myUrl);
        document.dispatchEvent(new CustomEvent("of_messages_received", { url: myUrl, detail: this.response }));
      }
    });

    return send.apply(this, arguments);
  };

})(XMLHttpRequest);
