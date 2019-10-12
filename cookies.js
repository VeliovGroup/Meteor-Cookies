import { Meteor } from 'meteor/meteor';

let HTTP;
let WebApp;

if (Meteor.isServer) {
  WebApp = require('meteor/webapp').WebApp;
} else {
  HTTP = require('meteor/http').HTTP;
}

const NoOp  = () => {};
const urlRE = /\/___cookie___\/set/;
const rootUrl = Meteor.isServer ? process.env.ROOT_URL : (window.__meteor_runtime_config__.ROOT_URL || window.__meteor_runtime_config__.meteorEnv.ROOT_URL || false);
const mobileRootUrl = Meteor.isServer ? process.env.MOBILE_ROOT_URL : (window.__meteor_runtime_config__.MOBILE_ROOT_URL || window.__meteor_runtime_config__.meteorEnv.MOBILE_ROOT_URL || false);
const originRE = new RegExp(`^https?:\/\/(localhost:12\\d\\d\\d${rootUrl ? ('|' + rootUrl) : ''}${mobileRootUrl ? ('|' + mobileRootUrl) : ''})$`);

const helpers = {
  isUndefined(obj) {
    return obj === void 0;
  },
  isArray(obj) {
    return Array.isArray(obj);
  },
  clone(obj) {
    if (!this.isObject(obj)) return obj;
    return this.isArray(obj) ? obj.slice() : Object.assign({}, obj);
  }
};
const _helpers = ['Number', 'Object', 'Function'];
for (let i = 0; i < _helpers.length; i++) {
  helpers['is' + _helpers[i]] = function (obj) {
    return Object.prototype.toString.call(obj) === '[object ' + _helpers[i] + ']';
  };
}

/*
 * @url https://github.com/jshttp/cookie/blob/master/index.js
 * @name cookie
 * @author jshttp
 * @license
 * (The MIT License)
 *
 * Copyright (c) 2012-2014 Roman Shtylman <shtylman@gmail.com>
 * Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * 'Software'), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
const decode = decodeURIComponent;
const encode = encodeURIComponent;
const pairSplitRegExp = /; */;

/*
 * RegExp to match field-content in RFC 7230 sec 3.2
 *
 * field-content = field-vchar [ 1*( SP / HTAB ) field-vchar ]
 * field-vchar   = VCHAR / obs-text
 * obs-text      = %x80-FF
 */
const fieldContentRegExp = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;

/*
 * @function
 * @name tryDecode
 * @param {String} str
 * @param {Function} d
 * @summary Try decoding a string using a decoding function.
 * @private
 */
const tryDecode = (str, d) => {
  try {
    return d(str);
  } catch (e) {
    return str;
  }
};

/*
 * @function
 * @name parse
 * @param {String} str
 * @param {Object} [options]
 * @return {Object}
 * @summary
 * Parse a cookie header.
 * Parse the given cookie header string into an object
 * The object has the various cookies as keys(names) => values
 * @private
 */
const parse = (str, options) => {
  if (typeof str !== 'string') {
    throw new Meteor.Error(404, 'argument str must be a string');
  }
  const obj = {};
  const opt = options || {};
  let val;
  let key;
  let eqIndx;

  str.split(pairSplitRegExp).forEach((pair) => {
    eqIndx = pair.indexOf('=');
    if (eqIndx < 0) {
      return;
    }
    key = pair.substr(0, eqIndx).trim();
    key = tryDecode(unescape(key), (opt.decode || decode));
    val = pair.substr(++eqIndx, pair.length).trim();
    if (val[0] === '"') {
      val = val.slice(1, -1);
    }
    if (void 0 === obj[key]) {
      obj[key] = tryDecode(val, (opt.decode || decode));
    }
  });
  return obj;
};

/*
 * @function
 * @name antiCircular
 * @param data {Object} - Circular or any other object which needs to be non-circular
 */
const antiCircular = (_obj) => {
  const object = helpers.clone(_obj);
  const cache  = new Map();
  return JSON.stringify(object, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.get(value)) {
        return void 0;
      }
      cache.set(value, true);
    }
    return value;
  });
};

/*
 * @function
 * @name serialize
 * @param {String} name
 * @param {String} val
 * @param {Object} [options]
 * @return String
 * @summary
 * Serialize data into a cookie header.
 * Serialize the a name value pair into a cookie string suitable for
 * http headers. An optional options object specified cookie parameters.
 * serialize('foo', 'bar', { httpOnly: true }) => "foo=bar; httpOnly"
 * @private
 */
const serialize = (key, val, opt = {}) => {
  let name;

  if (!fieldContentRegExp.test(key)) {
    name = escape(key);
  } else {
    name = key;
  }

  let value = val;
  if (!helpers.isUndefined(value)) {
    if (helpers.isObject(value) || helpers.isArray(value)) {
      const stringified = antiCircular(value);
      value = encode(`JSON.parse(${stringified})`);
    } else {
      value = encode(value);
      if (value && !fieldContentRegExp.test(value)) {
        value = escape(value);
      }
    }
  } else {
    value = '';
  }

  const pairs = [`${name}=${value}`];

  if (helpers.isNumber(opt.maxAge)) {
    pairs.push(`Max-Age=${opt.maxAge}`);
  }

  if (opt.domain && typeof opt.domain === 'string') {
    if (!fieldContentRegExp.test(opt.domain)) {
      throw new Meteor.Error(404, 'option domain is invalid');
    }
    pairs.push(`Domain=${opt.domain}`);
  }

  if (opt.path && typeof opt.path === 'string') {
    if (!fieldContentRegExp.test(opt.path)) {
      throw new Meteor.Error(404, 'option path is invalid');
    }
    pairs.push(`Path=${opt.path}`);
  } else {
    pairs.push('Path=/');
  }

  opt.expires = opt.expires || opt.expire || false;
  if (opt.expires === Infinity) {
    pairs.push('Expires=Fri, 31 Dec 9999 23:59:59 GMT');
  } else if (opt.expires instanceof Date) {
    pairs.push(`Expires=${opt.expires.toUTCString()}`);
  } else if (opt.expires === 0) {
    pairs.push('Expires=0');
  } else if (helpers.isNumber(opt.expires)) {
    pairs.push(`Expires=${(new Date(opt.expires)).toUTCString()}`);
  }

  if (opt.httpOnly) {
    pairs.push('HttpOnly');
  }

  if (opt.secure) {
    pairs.push('Secure');
  }

  if (opt.firstPartyOnly) {
    pairs.push('First-Party-Only');
  }

  if (opt.sameSite) {
    pairs.push('SameSite');
  }

  return pairs.join('; ');
};

const isStringifiedRegEx = /JSON\.parse\((.*)\)/;
const isTypedRegEx = /false|true|null|undefined/;
const deserialize = (string) => {
  if (typeof string !== 'string') {
    return decode(string);
  }

  if (isStringifiedRegEx.test(string)) {
    let obj = string.match(isStringifiedRegEx)[1];
    if (obj) {
      try {
        return JSON.parse(decode(obj));
      } catch (e) {
        console.error('[ostrio:cookies] [.get()] [deserialize()] Exception:', e, string, obj);
        return string;
      }
    }
    return string;
  } else if (isTypedRegEx.test(string)) {
    return JSON.parse(string);
  }
  return string;
};

/*
 * @locus Anywhere
 * @class __cookies
 * @param _cookies {Object|String} - Current cookies as String or Object
 * @param TTL {Number} - Default cookies expiration time (max-age) in milliseconds, by default - session (false)
 * @param runOnServer {Boolean} - Expose Cookies class to Server
 * @param response {http.ServerResponse|Object} - This object is created internally by a HTTP server
 * @summary Internal Class
 */
class __cookies {
  constructor(_cookies, TTL, runOnServer, response) {
    this.TTL         = TTL;
    this.response    = response;
    this.runOnServer = runOnServer;

    if (helpers.isObject(_cookies)) {
      this.cookies = _cookies;
    } else {
      this.cookies = parse(_cookies);
    }
  }

  /*
   * @locus Anywhere
   * @memberOf __cookies
   * @name get
   * @param {String} key  - The name of the cookie to read
   * @param {String} _tmp - Unparsed string instead of user's cookies
   * @summary Read a cookie. If the cookie doesn't exist a null value will be returned.
   * @returns {String|void}
   */
  get(key, _tmp) {
    const cookieString = _tmp ? parse(_tmp) : this.cookies;
    if (!key || !cookieString) {
      return void 0;
    }

    if (cookieString.hasOwnProperty(key)) {
      return deserialize(cookieString[key]);
    }

    return void 0;
  }

  /*
   * @locus Anywhere
   * @memberOf __cookies
   * @name set
   * @param {String}  key   - The name of the cookie to create/overwrite
   * @param {String}  value - The value of the cookie
   * @param {Object}  opts  - [Optional] Cookie options (see readme docs)
   * @summary Create/overwrite a cookie.
   * @returns {Boolean}
   */
  set(key, value, opts = {}) {
    if (key && !helpers.isUndefined(value)) {
      if (helpers.isNumber(this.TTL) && opts.expires === undefined) {
        opts.expires = new Date(+new Date() + this.TTL);
      }
      const cookieString = serialize(key, value, opts);
      this.cookies[key] = cookieString;
      if (Meteor.isClient) {
        document.cookie = cookieString;
      } else {
        this.response.setHeader('Set-Cookie', cookieString);
      }
      return true;
    }
    return false;
  }

  /*
   * @locus Anywhere
   * @memberOf __cookies
   * @name remove
   * @param {String} key    - The name of the cookie to create/overwrite
   * @param {String} path   - [Optional] The path from where the cookie will be
   * readable. E.g., "/", "/mydir"; if not specified, defaults to the current
   * path of the current document location (string or null). The path must be
   * absolute (see RFC 2965). For more information on how to use relative paths
   * in this argument, see: https://developer.mozilla.org/en-US/docs/Web/API/document.cookie#Using_relative_URLs_in_the_path_parameter
   * @param {String} domain - [Optional] The domain from where the cookie will
   * be readable. E.g., "example.com", ".example.com" (includes all subdomains)
   * or "subdomain.example.com"; if not specified, defaults to the host portion
   * of the current document location (string or null).
   * @summary Remove a cookie(s).
   * @returns {Boolean}
   */
  remove(key, path = '/', domain = '') {
    if (key && this.cookies.hasOwnProperty(key)) {
      const cookieString = serialize(key, '', {
        domain,
        path,
        expires: new Date(0)
      });

      delete this.cookies[key];
      if (Meteor.isClient) {
        document.cookie = cookieString;
      } else {
        this.response.setHeader('Set-Cookie', cookieString);
      }
      return true;
    } else if (!key && this.keys().length > 0 && this.keys()[0] !== '') {
      const keys = Object.keys(this.cookies);
      for (let i = 0; i < keys.length; i++) {
        this.remove(keys[i]);
      }
      return true;
    }
    return false;
  }

  /*
   * @locus Anywhere
   * @memberOf __cookies
   * @name has
   * @param {String} key  - The name of the cookie to create/overwrite
   * @param {String} _tmp - Unparsed string instead of user's cookies
   * @summary Check whether a cookie exists in the current position.
   * @returns {Boolean}
   */
  has(key, _tmp) {
    const cookieString = _tmp ? parse(_tmp) : this.cookies;
    if (!key || !cookieString) {
      return false;
    }

    return cookieString.hasOwnProperty(key);
  }

  /*
   * @locus Anywhere
   * @memberOf __cookies
   * @name keys
   * @summary Returns an array of all readable cookies from this location.
   * @returns {[String]}
   */
  keys() {
    if (this.cookies) {
      return Object.keys(this.cookies);
    }
    return [];
  }

  /*
   * @locus Client
   * @memberOf __cookies
   * @name send
   * @param cb {Function} - Callback
   * @summary Send all cookies over XHR to server.
   * @returns {void}
   */
  send(cb = NoOp) {
    if (Meteor.isServer) {
      cb(new Meteor.Error(400, 'Can\'t run `.send()` on server, it\'s Client only method!'));
    }

    if (this.runOnServer) {
      let path = `${window.__meteor_runtime_config__.ROOT_URL_PATH_PREFIX || window.__meteor_runtime_config__.meteorEnv.ROOT_URL_PATH_PREFIX || ''}/___cookie___/set`;
      let query = '';

      if (Meteor.isCordova) {
        path = Meteor.absoluteUrl('___cookie___/set');
        const cookies = this.keys().map(key => `cookie=${encodeURIComponent(this.cookies[key])}`);
        query = `?${cookies.join('&')}`;
      }

      HTTP.get(`${path}${query}`, {
        beforeSend(xhr) {
          xhr.withCredentials = true;
          return true;
        }
      }, cb);
    } else {
      cb(new Meteor.Error(400, 'Can\'t send cookies on server when `runOnServer` is false.'));
    }
    return void 0;
  }
}

/*
 * @function
 * @locus Server
 * @summary Middleware handler
 * @private
 */
const __middlewareHandler = (req, res, self) => {
  let _cookies = {};
  if (self.runOnServer) {
    if (req.headers && req.headers.cookie) {
      _cookies = parse(req.headers.cookie);
    }
    return new __cookies(_cookies, self.TTL, self.runOnServer, res);
  }

  throw new Meteor.Error(400, 'Can\'t use middleware when `runOnServer` is false.');
};

/*
 * @locus Anywhere
 * @class Cookies
 * @param opts {Object}
 * @param opts.TTL {Number} - Default cookies expiration time (max-age) in milliseconds, by default - session (false)
 * @param opts.auto {Boolean} - [Server] Auto-bind in middleware as `req.Cookies`, by default `true`
 * @param opts.handler {Function} - [Server] Middleware handler
 * @param opts.runOnServer {Boolean} - Expose Cookies class to Server
 * @summary Main Cookie class
 */
class Cookies extends __cookies {
  constructor(opts = {}) {
    opts.TTL = helpers.isNumber(opts.TTL) ? opts.TTL : false;
    opts.runOnServer = (opts.runOnServer !== false) ? true : false;

    if (Meteor.isClient) {
      super(document.cookie, opts.TTL, opts.runOnServer);
    } else {
      super({}, opts.TTL, opts.runOnServer);
      opts.auto        = opts.auto !== false ? true : false;
      this.handler     = helpers.isFunction(opts.handler) ? opts.handler : false;
      this.onCookies   = helpers.isFunction(opts.onCookies) ? opts.onCookies : false;
      this.runOnServer = opts.runOnServer;

      if (this.runOnServer) {
        if (!Cookies.isLoadedOnServer) {
          if (opts.auto) {
            WebApp.connectHandlers.use((req, res, next) => {
              if (urlRE.test(req._parsedUrl.path)) {
                if (originRE.test(req.headers.origin)) {
                  res.setHeader('Access-Control-Allow-Credentials', 'true');
                  res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
                }

                if (req.query.cookie) {
                  const cookies = helpers.isArray(req.query.cookie) ? req.query.cookie : [req.query.cookie];
                  res.setHeader('Set-Cookie', cookies);
                } else if (req.headers.cookie) {
                  const cookiesObject = parse(req.headers.cookie);
                  const cookiesKeys   = Object.keys(cookiesObject);
                  const cookiesArray  = [];

                  for (let i = 0; i < cookiesKeys.length; i++) {
                    const cookieString = serialize(cookiesKeys[i], cookiesObject[cookiesKeys[i]]);
                    if (!cookiesArray.includes(cookieString)) {
                      cookiesArray.push(cookieString);
                    }
                  }

                  res.setHeader('Set-Cookie', cookiesArray);
                }

                helpers.isFunction(this.onCookies) && this.onCookies(__middlewareHandler(req, res, this));

                res.writeHead(200);
                res.end('');
              } else {
                req.Cookies = __middlewareHandler(req, res, this);
                helpers.isFunction(this.handler) && this.handler(req.Cookies);
                next();
              }
            });
          }
          Cookies.isLoadedOnServer = true;
        }
      }
    }
  }

  /*
   * @locus Server
   * @memberOf Cookies
   * @name middleware
   * @summary Get Cookies instance into callback
   * @returns {void}
   */
  middleware() {
    if (!Meteor.isServer) {
      throw new Meteor.Error(500, '[ostrio:cookies] Can\'t use `.middleware()` on Client, it\'s Server only!');
    }

    return (req, res, next) => {
      helpers.isFunction(this.handler) && this.handler(__middlewareHandler(req, res, this));
      next();
    };
  }
}

if (Meteor.isServer) {
  Cookies.isLoadedOnServer = false;
}

/* Export the Cookies class */
export { Cookies };
