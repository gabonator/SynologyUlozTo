"use strict";
process.title = 'Ulozto.cz interface';


// Web server ==============================================================
var request = require("request");
var http = require('http');
var url = require('url');
var fs = require('fs');
var webbase = ".";

var uloztoApi = require('./api.js');
var voiceCaptcha = require('./voice.js').captchaByVoice;
var nitro = require('./nitro.js').nitro;

var port = 8034;

console.log("Ulozto.cz interface webserver running at localhost:" + port);

var currentResponse;

http.createServer(function (request, response) {

  if (0 && request.headers.origin != "")
  {
    // CORS
    response.setHeader('Access-Control-Allow-Origin', request.headers.origin);
    response.setHeader('Access-Control-Request-Method', 'GET');
    response.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
    response.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  }
                  
  if ( request.method === 'OPTIONS' ) 
  {
    response.writeHead(200);
    response.end();
    return;
  }

  var parsedUrl = url.parse(request.url);
  var uri = parsedUrl.pathname;
  var query = parsedUrl.query;
  if ( !query )
  {
    if ( uri == "/" )
      uri = "/index.html";

    var file = webbase + uri;
    fs.exists( file, function(exists)
    { 
      if(!exists) 
      {
        response.writeHead(404, {"Content-Type": "text/plain"});
        response.write("404 Not Found\n");
        response.end();
        return;
      }

      if ( file.substr(-5) == ".html" )
        response.writeHead(200, {'Content-Type': 'text/html'}); 
      else if ( file.substr(-4) == ".css" )
        response.writeHead(200, {'Content-Type': 'text/css'});
      else if ( file.substr(-4) == ".ico" )
        response.writeHead(200, {'Content-Type': 'image/x-icon'});
      else
        response.writeHead(200, {'Content-Type': 'text/plain'}); 

      response.end(fs.readFileSync(file));
    });
  } else
  {
    query = unescape(query);
    new Session(response, query);
  }
}).listen(port);


var Session = function(response, query)
{
  this.response = response;

  var matches = query.match("^(do|get)(\\w+)\\('[^\\(\\)'\\\\]+'\\)$");
  if (matches === null || matches.length != 3)
  {
    console.log("invalid query='" +query+"'");

    response.writeHead(400, {"Content-Type": "text/plain"});
    response.write("400 Bad Request\n");
    response.end();
    return;
  }

  var func = matches[1] + matches[2];
  if (!this[func] || typeof(this[func]) != "function")
  {
    console.log("function not found='" +query+"'");

    response.writeHead(400, {"Content-Type": "text/plain"});
    response.write("400 Bad Request\n");
    response.end();
    return;
  }

  console.log("query='" +query+"'");
  eval("this." + query);
}

Session.prototype.getSuggestion = function(term)
{
  uloztoApi.getSuggestions(term, (function(data)
  { 
    this.response.end(data);
  }).bind(this));
}

Session.prototype.doSearch = function(term)
{
  uloztoApi.getSearchResults(term, (function(json)
  {
    this.response.end( JSON.stringify(json) );
  }).bind(this));
}

Session.prototype.getDownload = function(lnk)
{
  lnk = lnk.replace("http://ulozto.cz", "");
  lnk = lnk.replace("http://ulozto.sk", "");
  lnk = lnk.replace("https://ulozto.cz", "");
  lnk = lnk.replace("https://ulozto.sk", "");

  uloztoApi.getDownloadLink(lnk, captchaHelper, (function(url)
  { 
    var ind = url.lastIndexOf("-");
    if ( ind != -1 )
      url = url.substr(0, ind) + '.' + url.substr(ind+1);

    this.response.end(url);
  }).bind(this));
}

Session.prototype.getLink = function(lnk)
{
  uloztoApi.getDownloadLink(lnk, captchaHelper, (function(url)
  { 
    var ind = url.lastIndexOf("-");
    if ( ind != -1 )
      url = url.substr(0, ind) + '.' + url.substr(ind+1);

    this.response.end( "{\"url\":\""+url+"\"}" );
  }).bind(this));
}

Session.prototype.getVlcLink = function(url)
{
  var name = url.match(".*/(.*?)\\?")[1]
  var ind = name.lastIndexOf("-");
  if ( ind != -1 )
    name = name.substr(0, ind) + '.' + name.substr(ind+1);

  this.response.setHeader('Content-disposition', 'attachment; filename=' + name + ".m3u");
  this.response.setHeader('Content-type', "text/plain");
  this.response.end(
    '#EXTM3U\n' +
    '#EXTINF:-1,' + name + '\n' +
    url
  );
}

Session.prototype.getLocalVlcLink = function(url)
{
  var name = url.match(".*/(.*?)$")[1]

  url = url.replace("http://", "\\\\");
  url = url.replace(new RegExp("/", 'g'), '\\');

  var ind = name.lastIndexOf("-");
  if ( ind != -1 )
    name = name.substr(0, ind) + '.' + name.substr(ind+1);

  this.response.setHeader('Content-disposition', 'attachment; filename=' + name + ".m3u");
  this.response.setHeader('Content-type', "text/plain");
  this.response.end(
    '#EXTM3U\n' +
    '#EXTINF:-1,' + name + '\n' +
    url
  );
}

Session.prototype.getRating = function(lnk)
{
    if (lnk.indexOf("/file-tracking/") != -1)
    {
        uloztoApi.translateUrl(lnk, (function(lnk)
        {
            require("./community.js").getRating(lnk, (function(json)
            {
                this.response.end( JSON.stringify(json) );
            }).bind(this));
        }).bind(this));
    } else
    {
        require("./community.js").getRating(lnk, (function(json)
        {
            this.response.end( JSON.stringify(json) );
        }).bind(this));
    }
}

function captchaHelper(json, onResult)
{
  console.log("Cracking voice captcha: "+json.sound);
  request({
      url : json.sound,
      encoding : "binary"
  }, function(error, response, body) {
    var result = voiceCaptcha(body);
    console.log("Found captcha: "+result);
    onResult(result);
  }); 

/*
  console.log("Cracking visual captcha: "+json.image);
  request({
      url : json.image,
      encoding : "binary"
  }, function(error, response, body) {

var crypto = require('crypto');
    var md5sum = crypto.createHash('md5');
    md5sum.update(body.substr(body, body.length-16));
    var hash = md5sum.digest('hex');
    console.log("hash: " +hash);

    var result = imageCaptcha(hash);
    console.log("Found captcha: "+result);
    onResult(result);
  }); 
*/
}

Session.prototype.doNitro = function(urls)
{
  var port = nitro(urls.split("|"));
  this.response.writeHeader(302, {'Location': 'http://localhost:'+port+'/file'});
  this.response.end();  
}
