// Docker镜像仓库主机地址
let hub_host = 'registry-1.docker.io'
// Docker认证服务器地址
const auth_url = 'https://auth.docker.io'
// 自定义的工作服务器地址
let workers_url = 'https://do.xixuer.cn'

let 屏蔽爬虫UA = ['netcraft'];

// 根据主机名选择对应的上游地址
function routeByHosts(host) {
    // 定义路由表
  const routes = {
    // 生产环境
    "quay": "quay.io",
    "gcr": "gcr.io",
    "k8s-gcr": "k8s.gcr.io",
    "k8s": "registry.k8s.io",
    "ghcr": "ghcr.io",
    "cloudsmith": "docker.cloudsmith.io",

    // 测试环境
    "test": "registry-1.docker.io",
  };

  if (host in routes) return [ routes[host], false ];
  else return [ hub_host, true ];
}

/** @type {RequestInit} */
const PREFLIGHT_INIT = {
  // 预检请求配置
  headers: new Headers({
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,TRACE,DELETE,HEAD,OPTIONS',
    'access-control-max-age': '1728000',
  }),
}

function makeRes(body, status = 200, headers = {}) {
  headers['access-control-allow-origin'] = '*'
  return new Response(body, { status, headers })
}

function newUrl(urlStr) {
  try {
    return new URL(urlStr)
  } catch (err) {
    return null
  }
}

function isUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

async function nginx() {
  const text = `
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
  `
  return text;
}

// 修改为Vercel的API处理函数
export default async function handler(request) {
  try {
    const env = process.env; // 使用process.env替代Cloudflare的env
    const ctx = {};

    const getReqHeader = (key) => request.headers.get(key);

    // 修复 URL 构造问题
    let url;
    try {
      // 确保有完整的 URL
      const host = request.headers.get('host') || 'do.xixuer.cn';
      const protocol = request.headers.get('x-forwarded-proto') || 'https';
      const fullUrl = `${protocol}://${host}${request.url}`;
      url = new URL(fullUrl);
    } catch (e) {
      console.error('Error constructing URL:', e);
      return new Response('Invalid URL', { status: 400 });
    }

    const userAgentHeader = request.headers.get('User-Agent');
    const userAgent = userAgentHeader ? userAgentHeader.toLowerCase() : "null";
    
    // 安全地处理UA环境变量
    let additionalUA = [];
    if (env.UA) {
      try {
        additionalUA = JSON.parse(env.UA);
      } catch (e) {
        console.error('Error parsing UA env:', e);
      }
    }
    屏蔽爬虫UA = [...屏蔽爬虫UA, ...additionalUA];

    // 设置workers_url
    workers_url = `https://${request.headers.get('host') || 'do.xixuer.cn'}`;
    
    const pathname = url.pathname;
    const hostname = url.searchParams.get('hubhost') || url.hostname;
    const hostTop = hostname.split('.')[0];
    const checkHost = routeByHosts(hostTop);
    hub_host = checkHost[0];
    const fakePage = checkHost[1];
    console.log(`域名头部: ${hostTop}\n反代地址: ${hub_host}\n伪装首页: ${fakePage}`);
    const isUuid = pathname.split('/')[1] ? isUUID(pathname.split('/')[1].split('/')[0]) : false;

    if (屏蔽爬虫UA.some(fxxk => userAgent.includes(fxxk)) && 屏蔽爬虫UA.length > 0) {
      return new Response(await nginx(), {
        headers: {
          'Content-Type': 'text/html; charset=UTF-8',
        },
      });
    }

    const conditions = [
      isUuid,
      pathname.includes('/_'),
      pathname.includes('/r'),
      pathname.includes('/v2/user'),
      pathname.includes('/v2/orgs'),
      pathname.includes('/v2/_catalog'),
      pathname.includes('/v2/categories'),
      pathname.includes('/v2/feature-flags'),
      pathname.includes('search'),
      pathname.includes('source'),
      pathname === '/',
      pathname === '/favicon.ico',
      pathname === '/auth/profile',
    ];

    if (conditions.some(condition => condition) && (fakePage === true || hostTop == 'docker')) {
      if (env.URL302) {
        return Response.redirect(env.URL302, 302);
      } else if (env.URL) {
        if (env.URL.toLowerCase() == 'nginx') {
          return new Response(await nginx(), {
            headers: {
              'Content-Type': 'text/html; charset=UTF-8',
            },
          });
        } else return fetch(new Request(env.URL, request));
      }

      const newUrl = new URL("https://registry.hub.docker.com" + pathname + url.search);
      const headers = new Headers(request.headers);
      headers.set('Host', 'registry.hub.docker.com');

      const newRequest = new Request(newUrl, {
        method: request.method,
        headers: headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.blob() : null,
        redirect: 'follow'
      });

      return fetch(newRequest);
    }

    if (!/%2F/.test(url.search) && /%3A/.test(url.toString())) {
      let modifiedUrl = url.toString().replace(/%3A(?=.*?&)/, '%3Alibrary%2F');
      url = new URL(modifiedUrl);
      console.log(`handle_url: ${url}`)
    }

    if (url.pathname.includes('/token')) {
      let token_parameter = {
        headers: {
          'Host': 'auth.docker.io',
          'User-Agent': getReqHeader("User-Agent"),
          'Accept': getReqHeader("Accept"),
          'Accept-Language': getReqHeader("Accept-Language"),
          'Accept-Encoding': getReqHeader("Accept-Encoding"),
          'Connection': 'keep-alive',
          'Cache-Control': 'max-age=0'
        }
      };
      let token_url = auth_url + url.pathname + url.search
      return fetch(new Request(token_url, request), token_parameter)
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, PREFLIGHT_INIT)
    }

    const parameter = {
      headers: {
        'Host': hub_host,
        'User-Agent': getReqHeader('User-Agent'),
        'Accept': getReqHeader('Accept'),
        'Accept-Language': getReqHeader('Accept-Language'),
        'Accept-Encoding': getReqHeader('Accept-Encoding'),
        'Connection': 'keep-alive',
        'Cache-Control': 'max-age=0'
      }
    };

    url.host = hub_host;
    url.protocol = 'https';
    return fetch(new Request(url, request), parameter);
  } catch (e) {
    console.error('Error handling request:', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function ADD(envadd) {
  try {
    return JSON.parse(envadd);
  } catch (e) {
    return [];
  }
}
