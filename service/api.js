'option strict';

module.exports = {getDownloadLink:getDownloadLink, getSuggestions:getSuggestions, getSearchResults:getSearchResults};

// Globals
var request = require("request");
var decoderClass = require('./blowfish.js').blowfish;

var lastRequest = "";
var lastResponse = "";

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
    if ( link == lastRequest )
    {
        handler(lastResponse);
        return;
    }
    
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

function getSuggestions(query, handler)
{
    return (new UloztoGeneralApi).getSuggestions(query, handler);
}

function getSearchResults(query, handler)
{
    return (new UloztoGeneralApi).getSearchResults(query, handler);
}

// Network helpers
var Network = function()
{
    this.headers = [];
    this.data = null;
}

Network.prototype.setCookies = function(cookies)
{
    this.headers.push("Cookie: " + cookies);
}

Network.prototype.setData = function(data)
{
    this.data = data;
}

Network.prototype.requestUrl = function(url, handler)
{
    var args = [url, "-s", "-D", "-"];
    for (var i in this.headers)
    {
        args.push("-H");
        args.push(this.headers[i]);
    }
    
    if ( this.data !== null )
    {
        args.push("-H");
        args.push("X-Requested-With: XMLHttpRequest");
        
        var q = "";
        for ( var i in this.data )
        {
            if ( q != "" ) q += "&"
                q += i + "=" + encodeURIComponent(this.data[i]);
        }
        args.push("--data");
        args.push(q);
    }
    
    this._spawn('curl', args,
        function(response)
        {
            var responseArr = response.split("\r\n\r\n");
            handler(responseArr[1], responseArr[0]);
        });
}

Network.prototype._spawn = function(command, args, handler)
{
    var cmdline = command;
    for (var i = 0; i < args.length; i++)
    {
        if ( args[i].indexOf(' ') != -1 || args[i].indexOf('?') != -1 || args[i].indexOf('&') != -1 )
            cmdline += " \"" + args[i] + "\"";
        else
            cmdline += " " + args[i];
    }
    
    const spawn = require('child_process').spawn;
    const proc = spawn('curl', args);
    
    var response = "";
    
    proc.stdout.on('data', function(data)
    {
        response += data;
    });
    
    proc.stderr.on('data', function (data)
    {
        console.log('stderr: ' + data);
    });
    
    proc.on('close', function(code)
    {
        _ASSERT(response != "", "curl invalid response: '"+cmdline+"' probably https protocol not supported?");
        handler(response);
    });
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

UloztoDownloadApi.prototype._getCookies = function()
{
    return this.cookieSession + "; " + this.cookieId; // + "; maturity=adult";
}

UloztoDownloadApi.prototype._getCaptchaUrl = function()
{
    return "https://ulozto.cz/reloadXapca.php?rnd=" + (new Date).getTime();
}

UloztoDownloadApi.prototype.getDownloadLink = function(link, handler)
{
    this.downloadLinkHandler = handler;
    this.currentUrl = "https://ulozto.cz" + link;
    
    (new Network()).requestUrl(this.currentUrl, this.processDownloadLink.bind(this));
}

UloztoDownloadApi.prototype.processDownloadLink = function(body, header)
{
    header = header.split("\r").join("").split("\n").join("#");

    this.cookieSession = this._match(header, "(ULOSESSID=.*?);");
    _ASSERT(this.cookieSession, "cannot determine session id!");

    this.cookieId = this._match(header, "(uloztoid=.*?);");
    _ASSERT(this.cookieId, "cannot determine file id!");

    if (body.indexOf(this._formId) != -1)
    {
        this.processRequest(body);
        return;
    }

    var newLocation = this._match(header, "#Location: (.*?)#");
    if (newLocation) 
    {
        this.currentUrl = newLocation;
                       
        var network = new Network();
        network.setCookies(this._getCookies());
        network.requestUrl(this.currentUrl, this.processRequest.bind(this));
         
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

UloztoDownloadApi.prototype.processRequest = function(body)
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
    var network = new Network();
    network.setCookies(this._getCookies());
    network.setData(this.formData);
    network.requestUrl(this._getCaptchaUrl(),
        (function(body, header)
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
    var network = new Network();
    network.setCookies(this._getCookies());
    network.setData(this.formData);
    network.requestUrl(this.currentUrl, this.processResponse.bind(this));
}

UloztoDownloadApi.prototype.processResponse = function (body)
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
    var suggestUrl = this.suggestionsUrl + escape(term);
    
    request(suggestUrl, function(error, response, body) {
        handler(body);
    });
}

UloztoGeneralApi.prototype.getSearchResults = function(term, handler)
{
    var searchUrl = this.searchUrl + escape(term);
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

