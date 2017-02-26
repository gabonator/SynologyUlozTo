var url = require('url');
var http = require('http');    
var Readable = require('stream').Readable;
var util = require('util');
var fs = require('fs');

var ReadStream = function(source, offset, size, redirectionHandler) 
{
  Readable.call(this, {});

  this.source = source;

  this.options = url.parse(this.source);
  this.options.method = "GET";
  this.range = {begin:offset, end:offset+size};
  this.headers = {connection:"keep-alive", host:this.options.host, "Range":"bytes="+offset+"-"+(offset+size-1)};
  this.options.headers = this.headers;

  this.checkRedirect = function(serverResponse) 
  {
    //console.log(serverResponse.statusCode);
    if (serverResponse.statusCode == 302)
    {
      // TODO : duplicty
      redirectionHandler.redirection(source, serverResponse.headers.location);

      this.options = url.parse(serverResponse.headers.location);
      this.options.headers = this.headers;
      this.options.headers.host = this.options.host;

      this.connector = http.request(this.options, this.checkRedirect.bind(this));
      this.connector.end();

      this.connector.on('error', (function ()
      {
        this.push(null);
      }).bind(this));

      return;
    } else
    if ( serverResponse.statusCode == 206 )
    {
      this.process.bind(this)(serverResponse);
    } else
    {
      console.log("Bad response code " + serverResponse.statusCode);    
      this.emit("fail");
      this.connector.abort();
    }
  };

  this.process = function (serverResponse)
  {
    if ( typeof(serverResponse.headers["content-range"]) == "undefined" )
    {
      console.log("Error: content-range in response not found");
      console.log(serverResponse.headers);
      this.emit("fail");
      this.connector.abort();
      return;
    }

    serverResponse.on('data', (function (chunk)
    {
      this.push(chunk);
    }).bind(this));

    serverResponse.on('end', (function ()
    {
      this.push(null);
    }).bind(this));
  };

  this.connector = http.request(this.options, this.checkRedirect.bind(this));
  this.connector.end();

  this.connector.on('error', (function ()
  {
    this.push(null);
  }).bind(this));
};

util.inherits(ReadStream, Readable);

ReadStream.prototype._read = function() 
{
};

var Nitro = function(urls, info)
{
  this.urls = urls;
  this.blocksize = 1000 * 1000 * 2; // 2 millon bytes, 4MB caused chrome to incorrectly calculate transfer speed
  this.segments = [];
  this.readoffset = 0;
  this.readbytes = -1;
  this.filesize = info.filesize;
  this.filename = "";
  this.statsTransferred = 0;
  this.statsStarted = 0;
  this.output = null;
  this.uid = 0;
}

Nitro.prototype.redirection = function(from, to)
{
  // TODO: check code
  console.log("Redirection " + from + " -> " + to);
  for (var i in this.segments) 
    if (this.segments[i].url == from)
    {
      this.segments[i].url = to;
      console.log("Redirected!");
    }

  return;
  console.log("Redirection " + from + " -> " + to);
  for (var i in this.urls)
    if (this.urls[i] == from)
    {
      this.urls[i] = to;
      return;
    }
  console.log("Redirection not applied!");
}

Nitro.prototype.download = function(output)
{
  this.downloadRange(0, -1, output);
}

Nitro.prototype.downloadRange = function(first, last, output)
{
//  console.log("dr1");
  this.stop();

  this.output = output;
  this.statsStarted = new Date().getTime();
  this.statsTransferred = 0;

  this.readoffset = first;
  this.readbytes = (last == -1) ? (this.filesize-first) : (last - first + 1);

  var first = true;
  for (var i in this.urls)
  {
    this.addStream(this.urls[i], first);
    if ( this.readbytes == 0 )
      break;

    first = false;
  }
}

Nitro.prototype.stop = function()
{
//  console.log("Nitro.prototype.stop");

  for (var i in this.segments)
    this.segments[i].stream.connector.abort();

  if (this.statsTransferred != 0)
  {
    console.log("Transferred "+this.statsTransferred);
    this.statsTransferred = 0;
  }

  this.segments = [];
}

Nitro.prototype.retryStream = function(segment)
{
  segment.stream = new ReadStream(segment.url, segment.targetoffset, segment.targetsize);
  segment.offset = 0;
  segment.finished = false;
  segment.failed = false;

  var _this = this;

  // TODO: duplicity
  segment.stream.on('data', (function(record) {
    if (typeof(record.length) == "undefined")
    {
      console.log("unknown data packet:");
      console.log(record);
    }
    if ( this.echo )
    {
      this.target.write(record);
      _this.statsTransferred += record.length;
    }
    else
      record.copy(this.target, this.offset);
    this.offset += record.length;
  }).bind(segment));

  segment.stream.on('end', (function() {
    this.finished = true;
    //console.log("Done " + this.targetoffset + "..." + (this.targetoffset+this.targetsize));
  }).bind(segment));

  segment.stream.on('end', (function() {
    this.maintenance();
  }).bind(this));

  segment.stream.on('error', function(error) {
    console.log("Error!!!!: "+error);
  });

  segment.stream.on('fail', (function() {
    this.failed = true;
    console.log("Invalid response");
  }).bind(segment));

}

Nitro.prototype.prepareStream = function(segment)
{
  var size = this.readbytes;

  size = Math.min(size, this.blocksize);

  segment.targetoffset = this.readoffset;
  segment.targetsize = size;

  console.log("Reading " + segment.targetoffset + "..." + (segment.targetoffset+segment.targetsize));
  segment.stream = new ReadStream(segment.url, segment.targetoffset, segment.targetsize, this);

  segment.offset = 0;
  segment.finished = false;
  segment.failed = false;

  this.readoffset += size;
  this.readbytes -= size;

  var _this = this;

  segment.stream.on('data', (function(record) {
    if ( this.echo )
    {
      this.target.write(record);
      _this.statsTransferred += record.length;
    }
    else
      record.copy(this.target, this.offset);
    this.offset += record.length;
  }).bind(segment));

  segment.stream.on('end', (function() {
    this.finished = true;
    if ( this.failed )
      console.log("Cancelled " + this.targetoffset + "..." + (this.targetoffset+this.targetsize));
    else
      console.log("Done " + this.targetoffset + "..." + (this.targetoffset+this.targetsize));
  }).bind(segment));

  segment.stream.on('end', (function() {
    this.maintenance();
  }).bind(this));

  segment.stream.on('error', function(error) {
    console.log("Error!!!!: "+error);
  });

  segment.stream.on('fail', (function() {
    this.failed = true;
    console.log("Invalid response");
  }).bind(segment));
}

Nitro.prototype.addStream = function(url, echo)
{
  var segment = {};
  segment.id = this.uid++;
  segment.url = url;
  this.prepareStream(segment);
  segment.echo = echo;
  if (echo)
    segment.target = this.output;
  else
    segment.target = new Buffer(this.blocksize, "binary");

  this.segments.push(segment);
}

Nitro.prototype.maintenance = function()
{
  for (var i in this.segments)
    if (this.segments[i].failed)
      this.retryStream(this.segments[i]);

  while (this.segments.length && this.segments[0].finished)
  {
    if ( this.segments[0].offset != this.segments[0].targetsize )
    {
      console.log("Unfinished block !!!" + this.segments[0].targetoffset + " / " + this.segments[0].targetsize + " ("+this.segments[0].offset+")");
      return;
    }
    var segment = this.segments.shift();

    if (!segment.echo)
    {
      this.statsTransferred += segment.targetsize;
    }

    var passed = ((new Date).getTime() - this.statsStarted) / 1000;
    var speed = (this.statsTransferred/1024/passed).toFixed(1);
    var percent = (this.statsTransferred/this.filesize*100).toFixed(1);

    if (!segment.echo)
    {
      if ( segment.targetsize != segment.target.length )
      {                                                                                                                                         
        console.log("Writing part " + segment.targetoffset + "..." + (segment.targetoffset+segment.targetsize) + " speed = " + speed + " kBps " + percent + "%");
        var subBuf = new Buffer(segment.targetsize);
        segment.target.copy(subBuf, 0, 0, segment.targetsize);
        this.output.write(subBuf); 
      } else
      {
        console.log(segment.id + "> Writing all " + segment.targetoffset + "..." + (segment.targetoffset+segment.targetsize) + " speed = " + speed + " kBps " + percent + "%");
        this.output.write(segment.target); 
      }
    } else
    {
      console.log("Streamed all " + segment.targetoffset + "..." + (segment.targetoffset+segment.targetsize) + " speed = " + speed + " kBps " + percent + "%");
    }

    if (this.readbytes > 0)
    {
      if (segment.echo)
      {
        console.log("Switching piped segment to buffered");
        segment.echo = false;
        segment.target = new Buffer(this.blocksize, "binary");
      }

      this.prepareStream(segment);
      this.segments.push(segment);
    }
  }
  if (this.segments.length == 0)
  {
    this.output.end();
//console.log("dr2");
    this.stop();
    return;
  }
}

var Probe = function(links, handler)
{
  this.sourcelinks = links;
  this.updatedlinks = [];
  this.updatedinfo = {};
  this.handler = handler;

  this.process();
}

Probe.prototype.process = function()
{
  console.log("Probing " + this.sourcelinks.length + " urls...");
  for (var i in this.sourcelinks)
  {
    this.followUrl(this.sourcelinks[i], (function(lnk, info)
    {
      this.updatedlinks.push(lnk);
      this.updatedinfo = info;
      if (this.updatedlinks.length == this.sourcelinks.length)
      {         
        console.log("Probing done.");
        this.handler(this.updatedlinks, this.updatedinfo);
      }
    }).bind(this));
  }
}

Probe.prototype.followUrl = function(lnk, handler)
{
  var target = url.parse(lnk);
  var options = {method: 'GET', host: target.host, port: target.port ? target.port : 80, path: target.path, headers:{"Range":"bytes=0-0"}};  
  var req = http.request(options, (function(res) {
    console.log(res.statusCode);
    if ( res.statusCode == 302 )
    {
      this.followUrl(res.headers.location, handler);
      return;
    } else
    if ( res.statusCode == 200 || res.statusCode == 206)
    {
      handler(lnk, res.headers);
    } else
    {
      this.followUrl(lnk, handler);
    }
    req.abort();
  }).bind(this));
  req.end();
}

var Session = function(links, port)
{
  this.nitro = null;
  this.info = {};
  this.server = null;
  this.port = port;

  new Probe(links, (function(links, info)
  {
    this.info = info;
    console.log("Probe finished with " + links.length + " urls");

    this.info.size = 0;
    if (typeof(info["content-length"]) != "undefined")
      this.info.size = parseInt(info["content-length"]);

    if (typeof(info["content-range"]) != "undefined")
      this.info.size = parseInt(info["content-range"].match("^bytes.*?\\/(\\d+)$")[1]);

    this.nitro = new Nitro(links, {filesize:this.info.size});
    
    this.startServer(this.port);
  }).bind(this));
}

Session.prototype.startServer = function(port)
{
  this.server = http.createServer().listen(port);
  this.sockets = {};
  this.socketId = 0;

  console.log("Starting sever at " + port);
  this.server.on('request', (function(request, response) {
    console.log("\n\n\n" + "request: " + request.url + " range:"+request.headers["range"] );

    if (request.url.indexOf("favicon") != -1)
    {
      response.writeHeader(404);
      response.end();
      return;
    }

    var header = {};

    if ( this.info["content-type"] )
      header["content-type"] = this.info["content-type"];

    if ( this.info["content-disposition"] )
      header["content-disposition"] = this.info["content-disposition"];

    if (typeof(this.info["content-disposition"]) != "undefined")
      header["content-disposition"] = this.info["content-disposition"];

    if (typeof(request.headers["range"]) != "undefined")
    {
      request.socket.nitro = this.nitro;
      var range = request.headers["range"].match("^bytes=(\\d+)\\-(\\d*)$");
      if (range[2] == "")
      {
        header["content-range"] = "bytes " + range[1] + "-" + (this.info.size-1) + "/" + this.info.size;
        header["content-length"] = this.info.size-parseInt(range[1]);
      }
      else
      {
        header["content-range"] = "bytes " + range[1] + "-" + range[2] + "/" + this.info.size;
        header["content-length"] = parseInt(range[2]) - parseInt(range[1]) + 1;
      }

      range = [parseInt(range[1]), range[2] == "" ? -1 : (parseInt(range[2])+1)];

//console.log(header);

      response.writeHeader(206, header);
      this.nitro.downloadRange(range[0], range[1], response);
    } else
    {
      header["content-length"] = this.info.size;
      request.socket.nitro = this.nitro;
      response.writeHeader(200, header);
      this.nitro.download(response);
    }
  }).bind(this));

  this.server.on('connection', (function(socket) {
    var _socketId = this.socketId++
    this.sockets[_socketId] = socket;

    console.log("Got socket");

    socket.on('close', (function() {
      delete this.sockets[_socketId];
//console.log("dr3");

      if (socket.nitro)
        socket.nitro.stop();
      else
        console.log("Not my socket");
    }).bind(this));
  }).bind(this));
}

Session.prototype.stopServer = function()
{
//console.log("dr4");

  this.server.close();
  this.server = null;

  for (var socketId in this.sockets) 
  {
    console.log('socket', socketId, 'destroyed');
    this.sockets[socketId].destroy();
  }
  this.sockets = [];

  this.nitro.stop();
  this.nitro = null;
}

var Manager = function()
{
  this.sessions = [];
  this.currentPort = 3100;
}

Manager.prototype.start = function(links)
{
  var port = this.getNextPort();
  this.sessions.push(new Session(links, port));

  setTimeout((function()
  {
    this.killSession(port);
  }).bind(this), 1000 * 60 * 60 * 8);
  return port;
}

Manager.prototype.getNextPort = function()
{
  return this.currentPort++;
}

Manager.prototype.killSession = function(port)
{
//console.log("dr6");

  for (var i=0; i<this.sessions.length; i++)
  {
    if ( this.sessions[i].port == port )
    {
      this.sessions[i].stopServer();
      this.sessions.splice(i, 1);
      return;
    }
  }
}

var manager = new Manager();

module.exports.nitro = function(links)
{
  var port = manager.start(links);
  console.log("new instance at port = " + port);
  return port;
}


// test
//manager.start(["http://pub.gabo.guru/video.mp4"]);