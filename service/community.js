'option strict';

module.exports = {add:addMovie, getRating:getRating};

var request = require('request');
var verbose = false;

function myLog(msg)
{
  if (verbose)
  {
    console.log("COMMUNITY-"+msg);
  }
}

function myMatch(src, regex)
{
    var t = src.match(regex);
    if (!t)
        return "";
    return t[1];
}

function titleByUrl(url)
{
    var extensions = ["iso"];
    var stopper = ["dabing", "dub", "cz", "sk", "3d", "hdtv", "1080i", "1080p", "webrip",
                   "rar", "mkv", "avi", "mp4", "iso", "zip", "dvd", "rip", "h264"]
    
    var title = url;
    var file = title.substr(title.lastIndexOf("/")+1);
    var tokens = file.split("-");
    var i;
    
    if ( extensions.indexOf(tokens[tokens.length-1]) != -1 )
        return false;
    
    var year = false;

    for (i=0; i<tokens.length-1; i++)
    {
        var token = tokens[i];
        if (parseInt(token) >= 1900)
        {
            year = token;
            break;
        }
    }

    for (i=0; i<tokens.length; i++)
    {
        var token = tokens[i];
        
        if (i > 0 && parseInt(token) >= 1900)
            break;
        
        if ( token[token.length-1] == "m" && parseInt(token)+"m" == token ) // 90m
            break;
        
        if ( token.length == 6 && "s" + token.substr(1, 2) + "e" + token.substr(4, 2) == token ) // s01e01
            break;

        if ( token.length >= 5 && token.substr(0, 4) == "part" ) // part00
            break;
        
        if (stopper.indexOf(token) != -1)
            break;
    }
    
    tokens.splice(i, tokens.length-i);
    
    if ( year )
        tokens.push(year);

    return tokens.join(" ");
}

function googleSearch(query, filter, handler)
{
    var req = "http://www.google.com/search?hl=en&q="+escape(query)+"&start=0&sa=N&num=20&ie=UTF-8&oe=UTF-8&gws_rd=ssl";
    myLog("GOOGLE search: '"+req+"'");

    request(req,
        function (error, response, body)
        {
            if ( body &&body.indexOf("CAPTCHA") != -1)
            {
                console.log("GOOGLE Search blocked");
                handler();
                return;
            }
            
            if (!error && response.statusCode == 200)
            {
                var offset = 0;
                var current;
                var response = [];

                while ((current = body.indexOf(filter, offset)) != -1)
                {
                    var end1 = body.indexOf("&", current);
                    var end2 = body.indexOf("%", current);
                    if ( end2 != -1 && end2 < end1 )
                        end1 = end2;
            
                    if (end1 != -1 && current-end1 < 100)
                    {
                        var url = body.substr(current, end1-current);
                        myLog("GOOGLE entry: '"+url+"'");
                        response.push("http://"+url);
                    }
                    offset = current + 1;
                }
                handler(response);
                return;
            }
            myLog("GOOGLE error '"+error+"'");
            handler();
        });
};

function bingSearch(query, filter, handler)
{
    var req = "http://www.bing.com/search?q="+escape(query);
    myLog("BING search: '"+req+"'");

    request(req,
        function (error, response, body)
        {
            if (!error && response.statusCode == 200)
            {
                var offset = 0;
                var current;
                var response = [];

                while ((current = body.indexOf(filter, offset)) != -1)
                {
                    var end = body.indexOf("\"", current);
            
                    if (end != -1 && current-end < 100)
                    {
                        var url = body.substr(current, end-current);
                        myLog("BING entry: '"+url+"'");
 
                        response.push("http://"+url);
                    }
                    offset = current + 1;
                }

                handler(response);
                return;
            }
            myLog("BING error '"+error+"'");
            handler();
        });
}

function getRatingCsfd(query, handler)
{   
    var getCsfdReport = function(url, handler)
    {
        request(url + "?" + Math.random().toString().substr(-8),
            function (error, response, body)
            {
                if (!error && response.statusCode == 200)
                {
                    if ( body.indexOf("DOCTYPE html PUBLIC") == -1)
                    {
                        console.log("Compressed body");
                        handler();
                        return;
                    }

                    var fullName = myMatch(body, "<meta property=\"og:title\" content=\"(.*?)\">");
                    var title = "", titleEng = "", release = "";
                
                    if (fullName.indexOf(" / ") == -1)
                    {
                        title = titleEng = myMatch(fullName, "^(.*) \\(");
                        release = myMatch(fullName, "\\(([0-9]+)\\)$");
                        if ( titleEng.indexOf(" (TV") != -1 )
                        {
                            titleEng = titleEng.substr(0, titleEng.indexOf(" (TV"));
                        }
                    } else
                    {
                        title = myMatch(fullName, "^(.*) / ");
                        titleEng = myMatch(fullName, "^.* / (.*)\\(");
                        release = myMatch(fullName, "\\(([0-9]+)\\)$");
                    }
                
                    handler({
                        url: url,
                        rating: myMatch(body, "<meta itemprop=\"ratingValue\" content=\"([0-9]*)\">"),
                        reviews: myMatch(body, "<meta itemprop=\"reviewCount\" content=\"([0-9]*)\">"),
                        title: title,
                        titleEng: toLatin(titleEng),
                        release: release
                    });
                    return;
                }
                handler();
            });

    };
    
    doSearch(query + " csfd", "www.csfd.cz/", function(urls)
    {
        var _url = false;

        for (var i in urls)
        {
          var url = urls[i];

          if (url.indexOf("/prehled/") != -1 || url.indexOf("/komentare/") != -1 || url.indexOf("/galerie/") != -1 || url.indexOf("/diskuze/") != -1)
          {
            _url = url;
            break;
          }
        }
 
        myLog("CSFD url: " + _url);

        if (_url)
        {
            getCsfdReport(_url, handler);
        } else
        {
            handler();
        }
    });
}

function getRatingImdb(query, handler)
{
    var getImdbReport = function(url, handler)
    {
        request(url + "?" + Math.random().toString().substr(-8),
            function (error, response, body)
            {
                if (!error && response.statusCode == 200)
                {
                    if ( body.indexOf("<!DOCTYPE html>") == -1)
                    {
                        console.log("Compressed body");
                        handler();
                        return;
                    }

                    handler({
                        url: url,
                        title: myMatch(body, "<title>(.*?)[ ]?\\("),
                        release: myMatch(body, "<title>.*?\\(([0-9]{4})"),
                        rating: myMatch(body, "<strong title=\"([0-9.]+) based on [0-9,]+ user ratings\">")*10,
                        reviews: myMatch(body, "<strong title=\"[0-9.]+ based on ([0-9,]+) user ratings\">").replace(",", ""),
                    });
                    return;
                }
            handler();
        });
        
    };
    
    doSearch(query + " imdb", "www.imdb.com/", function(urls)
        {
            var url = (urls && urls.length >= 1) ? urls[0] : false;

            myLog("IMDB url: " + url);

            if (url)
            {
                 getImdbReport(url, handler);
            } else
            {
                 handler();
            }
        });
}

function process(url, handler)
{
    myLog("URL Request: "+url);

    var title = titleByUrl(url);
    var response = {url:url, rawTitle:title};

    myLog("Title: "+title);

    getRatingCsfd(title, function(json)
    {
      myLog("CSFD: "+JSON.stringify(json));

      if (!json)
      {
        handler(response);
        return;
      }

      response.csfdRating = json.rating;
      response.csfdTitle = json.title;
      response.csfdUrl = json.url;
      response.release = json.release;

      if (json.titleEng)
      {
         getRatingImdb(json.titleEng + " " + json.release, function(json)
         {
           myLog("IMDB: "+JSON.stringify(json));

           if (json)
           {
             response.imdbRating = json.rating;
             response.imdbTitle = json.title;
             response.imdbUrl = json.url;
           }
           handler(response);
         });
        } else
        {
          handler(response);
        }
    });
}

function toLatin(source)
{
  source = source.replace(/&amp;/g, '&');
  source = source.replace(/#039;/g, '\'');

  // http://stackoverflow.com/questions/990904/remove-accents-diacritics-in-a-string-in-javascript
  var TAB_00C0 = "AAAAAAACEEEEIIII" +
    "DNOOOOO*OUUUUYIs" +
    "aaaaaaaceeeeiiii" +
    "?nooooo/ouuuuy?y" +
    "AaAaAaCcCcCcCcDd" +
    "DdEeEeEeEeEeGgGg" +
    "GgGgHhHhIiIiIiIi" +
    "IiJjJjKkkLlLlLlL" +
    "lLlNnNnNnnNnOoOo" +
    "OoOoRrRrRrSsSsSs" +
    "SsTtTtTtUuUuUuUu" +
    "UuUuWwYyYZzZzZzF";

    var result = source.split('');
    for (var i = 0; i < result.length; i++) {
        var c = source.charCodeAt(i);
        if (c >= 0x00c0 && c <= 0x017f) {
            result[i] = String.fromCharCode(TAB_00C0.charCodeAt(c - 0x00c0));
        } else if (c > 127) {
            result[i] = '';
        }
    }
    return result.join('');
}

function toUrl(json)
{
  if (!json)
    return "";

  var q = "";
  for (var i in json)
  {
    if (q != "")
      q += "&";
    q += i + "=" + encodeURIComponent(json[i]);
  }
  return q;
}

function doSearch(query, filter, handler)
{
  bingSearch(query, filter, function(response)
  {
    if (response && response.length > 0)
      handler(response);
    else
      googleSearch(query, filter, handler);
  });
}

function addMovie(url)
{
  process(url, 
    function(json) 
    { 
      request("http://api.gabo.guru/ulozto/?"+toUrl(json));
    }
  );
}

function getRating(url, handler)
{
    process(url, handler);
}
