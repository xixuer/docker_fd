const http = require('http');
const https = require('https');
const { URL } = require('url');

// Docker镜像仓库主机地址
let hub_host = 'registry-1.docker.io';
// Docker认证服务器地址
const auth_url = 'https://auth.docker.io';
// 自定义的工作服务器地址
let workers_url = 'https://do.xixuer.cn';

let 屏蔽爬虫UA = ['netcraft'];

// 根据主机名选择对应的上游地址
function routeByHosts(host) {
  const routes = {
    "quay": "quay.io",
    "gcr": "gcr.io",
    "k8s-gcr": "k8s.gcr.io",
    "k8s": "registry.k8s.io",
    "ghcr": "ghcr.io",
    "cloudsmith": "docker.cloudsmith.io",
    "test": "registry-1.docker.io",
  };
  if (host in routes) return [routes[host], false];
  else return [hub_host, true];
}

// 构造响应
function makeRes(body, status = 200, headers = {}) {
  headers['access-control-allow-origin'] = '*';
  return { status, headers, body };
}

// 生成 nginx 欢迎页面
async function nginx() {
  return `
  <!DOCTYPE html>
  <html>
  <head>
  <title>Welcome to nginx!</title>
  <style>
    body {
      width: 35em;
      margin: 0 auto;
      font-family: Tahoma, Verdana, Arial, sans-serif;
    }
  </style>
  </head>
  <body>
  <h1>Welcome to nginx!</h1>
  <p>If you see this page, the nginx web server is successfully installed and
  working. Further configuration is required.</p>
  <p>For online documentation and support please refer to
  <a href="http://nginx.org/">nginx.org</a>.<br/>
  Commercial support is available at
  <a href="http://nginx.com/">nginx.com</a>.</p>
  <p><em>Thank you for using nginx.</em></p>
  </body>
  </html>
  `;
}

// 处理请求
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const userAgent = req.headers['user-agent'] || 'null';
  const pathname = url.pathname;
  const hostname = url.searchParams.get('hubhost') || url.hostname;
  const hostTop = hostname.split('.')[0];
  const checkHost = routeByHosts(hostTop);
  hub_host = checkHost[0];
  const fakePage = checkHost[1];

  if (屏蔽爬虫UA.some(ua => userAgent.includes(ua))) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
    res.end(await nginx());
    return;
  }

  // 其他逻辑处理...
  // 这里需要将 Cloudflare Workers 的 fetch 逻辑替换为 Node.js 的 http/https 模块逻辑
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello, World!');
}

// 启动服务器
const server = http.createServer((req, res) => {
  handleRequest(req, res).catch(err => {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});