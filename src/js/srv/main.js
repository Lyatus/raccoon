'use strict';

process.title = 'raccoon-server';

const fs = require('fs');
const http = require('http');
const https = require('https');

const config = JSON.parse(fs.readFileSync('config.json'));

const ext_to_mime = {
  css: 'text/css',
  html: 'text/html',
  js: 'application/javascript',
  md: 'text/plain',
  png: 'image/png',
  svg: 'image/svg+xml',
};

async function read_body(msg) {
  return new Promise((resolve, reject) => {
    let body = '';
    msg.on('data', chunk => body += chunk.toString());
    msg.on('end', () => resolve(body));
    msg.on('error', e => reject(e));
  });
}

async function http_callback(request, response) {
  console.log(`Request: ${request.method} ${request.url}`);

  response.setHeader('Access-Control-Allow-Origin', config.allow_origin);
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if(request.method == 'OPTIONS') { // Asking for permission
    response.writeHead(200);
    response.end();
    return;
  }

  if(request.url == '/oauth/github') {
    const params = JSON.parse(await read_body(request));
    const gh_req = https.request({
      hostname: 'github.com',
      path: '/login/oauth/access_token',
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    }, async (gh_res) => {
      response.setHeader('Content-Type', 'application/json');
      response.writeHead(200);
      response.end(await read_body(gh_res));
    });
    gh_req.end(JSON.stringify({
      client_id: 'b5fd66cdee41f04ff6d3',
      client_secret: config.gh_client_secret,
      code: params.code,
      state: params.state,
    }));
  } else if(config.serve_static_files) {
    let filepath = request.url.split('?')[0];

    if(filepath == '/') {
      filepath = '/index.html';
    }
    filepath = filepath.substr(1);

    const content = fs.readFileSync(filepath);
    const ext = filepath.substring(filepath.lastIndexOf(".") + 1);
    const mime_type = ext_to_mime[ext];
    if(mime_type) {
      response.setHeader('Content-Type', mime_type);
    }
    response.writeHead(200);
    response.end(content);
  } else {
    response.writeHead(404);
    response.end();
  }
}

console.log(`Creating HTTP server on port ${config.port}`);
http.createServer(http_callback).listen(config.port);