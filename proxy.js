#!/usr/local/bin/node

/**
 * Code to run a SECURE (https) proxy server
 * NOTE: http-proxy CANNOT do both https and
 *       use a routing table at the same time
 *       so we have to do it the hard way
 * @author Julian Knight, http://it.knightnet.org.uk
 */

var http      = require('http'),
    https     = require('https'),
    fs        = require('fs'),
    url       = require('url'),
    httpProxy = require('http-proxy');

require('date-utils');

// define proxy routes - DOH! doesn't work with https options
var proxy_options = {
  router: {
    'totallyinformation.net': '127.0.0.1:3000',
    'serviceto.us': '127.0.0.1:3001'
  }
};

/* BAH - can't use this with a routing table
var options = {
  https: {
    key: fs.readFileSync('/var/nodejs/totallyinformation.key'),
    cert: fs.readFileSync('/var/nodejs/totallyinformation.crt')
  },
  target: {
    https: true // This could also be an Object with key and cert properties
  }
};
*/

// since we can't use the simple form, we need std certificate params
var options = {
  key: fs.readFileSync('/var/nodejs/totallyinformation.key'),
  cert: fs.readFileSync('/var/nodejs/totallyinformation.crt')
};


// start proxy - maybe not since we can't do routing table and https together
//httpProxy.createServer(proxy_options).listen(8000);

// Set up a proxy ready for manual routing
var proxy = new httpProxy.RoutingProxy();

var myNow; // for recording time

var auth  = require('http-auth'),
    basic = auth({
      authRealm : "Internal TI.net Term1",
      //authFile  : '/var/www/.htpasswd-users',
      authList  : ['julian:PASSWORD'],
      authType  : 'basic'
    });

// Manually create the https server
https.createServer(options, function (req, res) {

  // Put your custom server logic here, then proxy
  
  var reqHost = req.headers.host.split(':'),
      reqDom  = reqHost[0],
      reqPort = reqHost[1];


  myNow = new Date().toFormat('YYYY-MM-DD HH24:MI:SS ');
  console.dir({
    'Headers Host':reqHost, 'Domain': reqDom,
    'Port':reqPort, 'url':req.url
  });

  /**
   * /ajaxterm/ http://localhost:8022/
   *
   * s:st.us:8000/      -> -:lh:8022 :: ajaxterm - not reliable behind corp f/w
   * s:ti.net:8000/     -> s:lh:8002
   * s:ti.net:8000/3000 -> s:lh:3000 :: derby - test
   * debug console
   *
   */
  
  // --- Host routing --- //
  if (reqDom.toLowerCase() === "totallyinformation.net") {
    if (req.url === "/debug") {
        console.log("%s Direct output of debug page", myNow);
        // Hmm, since this is an http(s) server, we can also
        // write back directly instead of just forwarding
        // useful for debugging
        var parsedUrl = url.parse(req.url);
        res.writeHead(200, {"Content-Type": "text/plain"});
        res.write(require("util").inspect(parsedUrl));
        res.end();
    } else if (req.url.toLowerCase() === "/3000") {
        console.log("%s Proxying to https://localhost:3000", myNow);
        // Ready to proxy
        proxy.proxyRequest(req, res, {
          host: 'localhost',
          port: 3000
        });
    } else {
        console.log("%s Proxying to https://localhost:8002", myNow);
        // Ready to proxy
        proxy.proxyRequest(req, res, {
          host: 'localhost',
          port: 8002,
          target: { https: true }
        });
    }
  } else if (reqDom.toLowerCase() === "serviceto.us") {
    console.log("%s Proxying to http://localhost:8022", myNow);
    // Proxy ajaxterm
    // We need to wrap this in an http basic auth since ajaxterm
    // doesn't do this
    basic.apply(req, res, function() {
        proxy.proxyRequest(req, res, {
            host : 'localhost',
            port : 8022
        });
    });
  } else if (reqDom.toLowerCase() === "service-to.us") {
    console.log("%s Proxying to http://localhost:8010", myNow);
    // Proxy ajaxterm
    // We need to wrap this in an http basic auth since ajaxterm
    // doesn't do this
    basic.apply(req, res, function() {
        proxy.proxyRequest(req, res, {
            host : 'localhost',
            port : 8010
        });
    });
  } else {
    console.log("%s Not a known route - cannot proxy %s%s", myNow, req.headers.host, req.url);
    res.writeHead(404, {"Content-Type": "text/plain"});
    res.write(myNow + "Unknown route - cannot dispatch");
    res.end();
  }


  /* ??? Why doesn't this work ???
  switch(req.url) {
    case '/debug':
      var parsedUrl = url.parse(req.url);
      res.writeHead(200, {"Content-Type": "text/plain"});
      res.write(require("util").inspect(parsedUrl));
      res.end();
      break;
    case '/prox':
      // Ready to proxy
      proxy.proxyRequest(req, res, {
        host: 'localhost',
        port: 8022,
        target: { https: true }
      });
      break;
    default:
      // Ready to proxy
      proxy.proxyRequest(req, res, {
        host: 'localhost',
        port: 8002,
        target: { https: true }
      });
  }
  */
}).listen(8000, function() {
  // Tell the console if the server started OK & when
  myNow = new Date().toFormat('YYYY-MM-DD HH24:MI:SS ');
  return console.log("%s Proxy listening on port %d", myNow, 8000);
});

// Handle uncaught errors
process.on('uncaughtException', function(err) {
  myNow = new Date().toFormat('YYYY-MM-DD HH24:MI:SS ');
  console.log("%s ERROR: %s", myNow, err);
});