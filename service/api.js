'option strict';

module.exports = {getDownloadLink:getDownloadLink, getSuggestions:getSuggestions, getSearchResults:getSearchResults, translateUrl:translateUrl};

// Globals
var request = require("./literequest.js").request;
var decoderClass = require('./blowfish.js').blowfish;

function _ASSERT(cond, message)
{
    if (!cond)
    {
        console.log("Assertion failed: " + message);
        //process.exit(); // TODO: remove in production
    }
}

function getDownloadLink(link, captcha, handler)
{
   
    var uloztoApi = new UloztoDownloadApi()
    uloztoApi.setCaptchaEngine(captcha);
    uloztoApi.getDownloadLink(link, function (response)
    {
        if (response)
        {
            lastRequest = link;
            lastResponse = response;
            handler(response);
        }
    });
}

function translateUrl(query, handler)
{
    return (new UloztoDownloadApi).translateUrl(query, handler);
}

function getSuggestions(query, handler)
{
    return (new UloztoGeneralApi).getSuggestions(query, handler);
}

function getSearchResults(query, handler)
{
    return (new UloztoGeneralApi).getSearchResults(query, handler);
}

// Ulozto download api
var UloztoDownloadApi = function()
{
    this.cookieSession = null;
    this.cookieId = null;
    this._formId = "frm-download-freeDownloadTab-freeDownloadForm";
    this._formDo = "download-freeDownloadTab-freeDownloadForm-submit";
    this.formData = {};
    this.captchaEngine = null;
    this.currentUrl = null;
    this.tries = 5;
};

UloztoDownloadApi.prototype.setCaptchaEngine = function(captchaEngine)
{
    this.captchaEngine = captchaEngine;
}

UloztoDownloadApi.prototype._getCookie = function(res, key)
{
  var cookies = res.headers["set-cookie"];
  for (var i in cookies)
  {        
    var result = cookies[i].match("^(.+?)=(.+?);");
    
    if (result == null || typeof(result) != "object")
      continue;

    if (result.length == 3 && result[1] == key)
      return result[2];
  }
}

UloztoDownloadApi.prototype._getCookies = function()
{
    return this.cookieSession + "; " + this.cookieId; // + "; maturity=adult";
}

UloztoDownloadApi.prototype._getFormData = function()
{
  var q = "";
  for ( var i in this.formData )
  {
      if ( q != "" ) 
        q += "&";
      q += i + "=" + encodeURIComponent(this.formData[i]);
  } 
  return q;
}

UloztoDownloadApi.prototype._getCaptchaUrl = function()
{
    return "https://ulozto.cz/reloadXapca.php?rnd=" + (new Date).getTime();
}

UloztoDownloadApi.prototype.getDownloadLink = function(link, handler)
{
    this.downloadLinkHandler = handler;
    this.currentUrl = "https://ulozto.cz" + link;
    
    request(this.currentUrl, this.processDownloadLink.bind(this));
}

UloztoDownloadApi.prototype.translateUrl = function(link, handler)
{
    this.currentUrl = "https://ulozto.cz" + link;
    request(this.currentUrl, (function(err, resp, body)
    {
       var newLocation = res.headers["location"];
       if (newLocation) 
            this.currentUrl = newLocation;
                                                
        handler(this.currentUrl);
    }).bind(this));
}

UloztoDownloadApi.prototype.processDownloadLink = function(err, res, body)
{
    this.cookieSession = "ULOSESSID="+this._getCookie(res, "ULOSESSID");
    this.cookieId = "uloztoid="+this._getCookie(res, "uloztoid");

    _ASSERT(this.cookieSession, "cannot determine session id!");
    _ASSERT(this.cookieId, "cannot determine file id!");

    if (body.indexOf(this._formId) != -1)
    {
        this.processRequest(err, res, body);
        return;
    }

    var newLocation = res.headers["location"];
    if (newLocation) 
    {
        this.currentUrl = newLocation;
                       
        request(
          { url:this.currentUrl, 
            headers:{"Cookie":this._getCookies()} }, 
          this.processRequest.bind(this));
         
        this.addFavourite(this.currentUrl);
        return;
    }
                       
    _ASSERT(0, "incorrect server response, could not identify redirection address, URL not valid anymore");
    this.downloadLinkHandler();
}

UloztoDownloadApi.prototype._getFormVariable = function(html, key)
{
    var result = this._match(html, "name=\""+key+"\".*?value=\"(.*?)\"");
    _ASSERT(result !== null, "WARNING: Cannot find form field '"+key+"'!");
    return result;
}

UloztoDownloadApi.prototype.processRequest = function(err, resp, body)
{
    body = body.split("\r").join("").split("\n").join("");
                               
    var formhtml = this._match(body, "id=\""+this._formId+"\"(.*)</form>");
    if ( !formhtml)
    {
        _ASSERT(0, "ERROR: FORM DATA not found: body='"+body+"'");
        this.downloadLinkHandler();
        return;
    }
                            
    this.formData._token_ = this._getFormVariable(formhtml, "_token_");
    this.formData.ts = this._getFormVariable(formhtml, "ts");
    this.formData.cid = this._getFormVariable(formhtml, "cid");
    this.formData.adi = this._getFormVariable(formhtml, "adi"); // ="f" for reloaded captcha
    this.formData.sign_a = this._getFormVariable(formhtml, "sign_a");
    this.formData.sign = this._getFormVariable(formhtml, "sign");
    this.formData.captcha_type = "xapca";
    this.formData._do = this._formDo;
                               
    this.requestCaptcha();
}

UloztoDownloadApi.prototype.requestCaptcha = function ()
{
    request(
      {
        url:this._getCaptchaUrl(), 
        method:"POST",
        headers:{
          "Cookie":this._getCookies(),
          "X-Requested-With": "XMLHttpRequest",
          "Content-Type": "application/x-www-form-urlencoded"}, 
        data:this._getFormData()
      },
      (function(err, resp, body)
      {
          var json = JSON.parse(body);
                     
          _ASSERT(json, "ERROR: invalid captcha json reply");
                     
          var image = json.image;
          this.formData.timestamp = json.timestamp;
          this.formData.hash = json.hash;
          this.formData.salt = json.salt;
       
          this.processCaptcha({image:"http:"+json.image, sound:"http:"+json.sound});
      }).bind(this));
}

UloztoDownloadApi.prototype.processCaptcha = function (json)
{
    this.captchaEngine(json,
        (function(code)
        {
            this.formData.captcha_value = code;
            this.requestDownload();
        }).bind(this));
}

UloztoDownloadApi.prototype.requestDownload = function (json)
{
    request(
      {
        url:this.currentUrl, 
        method:"POST",
        headers:{
          "Cookie":this._getCookies(),
          "X-Requested-With": "XMLHttpRequest",
          "Content-Type": "application/x-www-form-urlencoded"}, 
        data:this._getFormData()
      },
      this.processResponse.bind(this));
}

UloztoDownloadApi.prototype.processResponse = function (err, resp, body)
{
    var json = JSON.parse(body);
    
    _ASSERT(json, "Invalid response json");
    
    if ( json.status == "error" )
    {
        console.log(json.errors);
        
        if ( --this.tries <= 0 )
        {
            // prevention of recursive loop
            console.log("Too many errors, exiting");
            this.downloadLinkHandler();
        }
        
        this.formData.ts = json.new_form_values.ts;
        this.formData.cid = json.new_form_values.cid;
        this.formData.sign = json.new_form_values.sign;
        this.formData._token_ = json.new_form_values._token_;
        
        this.formData.hash = json.new_form_values.xapca_hash;
        this.formData.salt = json.new_form_values.xapca_salt;
        this.formData.timestamp = json.new_form_values.xapca_timestamp;
        
        this.processCaptcha({image:"http:"+json.new_captcha_data.image, sound:"http:"+json.new_captcha_data.sound});
        return;
    }
    
    if ( json.status == "ok" )
    {
        this.downloadLinkHandler(json.url);
        return;
    }

    _ASSERT(json, "Invalid response json status '"+json.status+"'");
    this.downloadLinkHandler();
}

UloztoDownloadApi.prototype._match = function (string, regexp)
{
    var result = string.match(regexp);
    
    if (result == null || typeof(result) != "object")
        return null;
    
    if (result.length != 2)
        return null;
    
    return result[1];
}

UloztoDownloadApi.prototype.addFavourite = function(url)
{
    require('./community.js').add(url);
}

// Ulozto general api
var UloztoGeneralApi = function()
{
    this.suggestionsUrl = "https://ulozto.cz/searchSuggest.php?term=";
    this.searchUrl = "https://ulozto.cz/hledej?password=unsecured&q=";
}

UloztoGeneralApi.prototype.getSuggestions = function(term, handler)
{
    var suggestUrl = this.suggestionsUrl + encodeURIComponent(term);
    console.log(suggestUrl);
    request(suggestUrl, function(error, response, body) {
        handler(body);
    });
}

UloztoGeneralApi.prototype.getSearchResults = function(term, handler)
{
    var searchUrl = this.searchUrl + encodeURIComponent(term);
    var _match = UloztoDownloadApi.prototype._match;
    
    request({
        url: searchUrl,
        method: "GET",
        headers: {"X-Requested-With": "XMLHttpRequest"}
    }, (function(error, response, body)
    {
        body = body.split("\n").join("").split("\\").join("");
        var dataraw = _match(body, "var kn = (\\{.*?\\})");
        _ASSERT(dataraw, "Failed to parse json response (contents)");
                    
        var data = JSON.parse(dataraw);
        _ASSERT(data, "Response json not valid");
            
        var keyraw = _match(body, "kn\\[\"(.*?)\"\\]");
        _ASSERT(keyraw, "Failed to parse json response (key)");

        var key = keyraw;
        var result = this._decode(data, data[key]);

        handler(result);
    }).bind(this));
}

UloztoGeneralApi.prototype._decode = function(data, key)
{
    var _match = UloztoDownloadApi.prototype._match;
    var decoder = new decoderClass(key);
    var result = [];
    var first = true;
    
    for (var i in data)
    {
        var item = this._trim(decoder.decrypt(data[i])).split("\n").join("");
        item = item.split("\t").join("");
        
        // last item is corrupted, first is always mtbr.avi
        if ( item.indexOf("title") == -1 || first )
        {
            first = false;
            continue;
        }
        
        var url = _match(item, "class=\"name\".*?href=\"(.*?)\"") || "";
        var imgurl = "https:" + _match(item, "class=\"img.*?src=\"(.*?)\"");
        var img = "<img src=\"" + imgurl + "\">";
        var rating = _match(item, "<abbr title=\"Hodno.*?\">(.*?)</abbr>") || "";
        var name = _match(item, "title=\"(.*?)\"") || "";
        var size = _match(item, "<span>Velikost</span>(.*?)</li>") || "";
        var time = _match(item, "<span>.?as</span>(.*?)</li>") || "";
        //var type = _match(item, "<span class=\"type\">(.*?)</span>") || "";
        var type = this.getTypeBySuffix(name);
        
        // skip locked files
        if ( img.indexOf("/lock.") != -1 )
            continue;
        
        result.push({url:url, img:img, imgurl:imgurl, rating:rating, name:name, size:size, time:time, type:type, data:item});
    }
    return result;
}

UloztoGeneralApi.prototype.getTypeBySuffix = function(url)
{
    var suffixes = {
        ".torrent"      : "Torrent",
    
        ".rar" 			: "Compressed archive",
        ".zip" 			: "Compressed archive",
        ".7z" 			: "Compressed archive",
    
    
        ".pdf" 			: "Document",
        ".txt" 			: "Document",
    
        ".srt"			: "Subtitles",
    
        ".avi"			: "Video",
        ".mpg"			: "Video",
        ".mkv"			: "Video",
        ".mp4"			: "Video",
        ".wmv"			: "Video",
        ".mov"			: "Video",
        ".vob"			: "Video",
        ".3gp"			: "Video",
        ".flv"			: "Video",
        ".m4v"			: "Video",
    
        ".mp3"			: "Audio",
        ".flac"			: "Audio",
        ".wav"			: "Audio",
    
        ".gif"			: "Image",
        ".jpg"			: "Image",
        ".jpeg"			: "Image",
    
        ".apk"			: "Android application",
    
        ".iso"			: "ISO Image"};
    
    for (var i in suffixes)
    {
        if (url.substr(-i.length) == i)
            return suffixes[i];
    }
    
    return "Unknown";
}

UloztoGeneralApi.prototype._trim = function (str)
{
    while ( str.length > 1 && str.charCodeAt(str.length-1) == 0 )
        str = str.substr(0, str.length-1);
    return new Buffer(str, "binary").toString("utf8");
}
