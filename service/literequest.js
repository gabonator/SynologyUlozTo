'option strict';

module.exports = {request:request};
var https = require("https");
var http = require("http");
var url = require("url");

function request(req, handler)
{
//  console.log("> "+(req.url || req));

  var secure = false;

  if (typeof(req) == "string")
    req = {url:req, method:"GET"};

  if (req.url)
  {
    var p = url.parse(req.url);
    delete req.url;
    req.hostname = p.hostname;
    req.path = p.path;
    secure = p.protocol == "https:";
  }

  var data;
  if (req.data)
  {
    data = req.data;
    delete req.data;
  }

  var chunks = [];

  var r = (secure ? https : http).request(req, function(res) {
    if (res.statusCode == 301 || res.statusCode == 302)
    {
      handler && handler(null, {headers:res.headers}, "");
      return;
    }

    if (res.statusCode != 200)
    {
      console.log("Request Error: " + res.statusCode);
      handler && handler("error");
      return;
    }

    res.on('data', function(chunk) {
      chunks.push(chunk);
    }).on('end', function() {

    var buffer = Buffer.concat(chunks);

    if (req.encoding == "binary")
      handler && handler(null, null, buffer);
    else
      handler && handler(null, {headers:res.headers}, buffer.toString());
    });
  });

  if (data)
    r.write(data);

  r.end();
}
