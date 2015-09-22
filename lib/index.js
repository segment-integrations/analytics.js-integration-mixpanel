
/**
 * Module dependencies.
 */

var alias = require('alias');
var dates = require('convert-dates');
var del = require('obj-case').del;
var includes = require('includes');
var integration = require('analytics.js-integration');
var iso = require('to-iso-string');
var pick = require('pick');
var is = require('is');

/**
 * Expose `Mixpanel` integration.
 */

var Mixpanel = module.exports = integration('Mixpanel')
  .global('mixpanel')
  .option('increments', [])
  .option('cookieName', '')
  .option('crossSubdomainCookie', false)
  .option('secureCookie', false)
  .option('nameTag', true)
  .option('pageview', false)
  .option('people', false)
  .option('token', '')
  .option('setAllTraitsByDefault', true)
  .option('trackAllPages', false)
  .option('trackNamedPages', true)
  .option('trackCategorizedPages', true)
  .tag('<script src="//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js">');

/**
 * Options aliases.
 */

var optionsAliases = {
  cookieName: 'cookie_name',
  crossSubdomainCookie: 'cross_subdomain_cookie',
  secureCookie: 'secure_cookie'
};

/**
 * Initialize.
 *
 * https://mixpanel.com/help/reference/javascript#installing
 * https://mixpanel.com/help/reference/javascript-full-api-reference#mixpanel.init
 *
 * @api public
 */

Mixpanel.prototype.initialize = function() {
  /* eslint-disable */
  (function(c, a){window.mixpanel = a; var b, d, h, e; a._i = []; a.init = function(b, c, f){function d(a, b){var c = b.split('.'); 2 == c.length && (a = a[c[0]], b = c[1]); a[b] = function(){a.push([b].concat(Array.prototype.slice.call(arguments, 0))); }; } var g = a; 'undefined' !== typeof f ? g = a[f] = [] : f = 'mixpanel'; g.people = g.people || []; h = ['disable', 'time_event', 'track', 'track_pageview', 'track_links', 'track_forms', 'register', 'register_once', 'unregister', 'identify', 'alias', 'name_tag', 'set_config', 'people.set', 'people.increment', 'people.track_charge', 'people.append', "people.union", "people.track_charge", "people.clear_charges", "people.delete_user"]; for (e = 0; e < h.length; e++) d(g, h[e]); a._i.push([b, c, f]); }; a.__SV = 1.2; })(document, window.mixpanel || []);
  /* eslint-enable */
  this.options.increments = lowercase(this.options.increments);
  var options = alias(this.options, optionsAliases);
  window.mixpanel.init(options.token, options);
  this.load(this.ready);
};

/**
 * Loaded?
 *
 * @api private
 * @return {boolean}
 */

Mixpanel.prototype.loaded = function() {
  return !!(window.mixpanel && window.mixpanel.config);
};

/**
 * Page.
 *
 * https://mixpanel.com/help/reference/javascript-full-api-reference#mixpanel.track_pageview
 *
 * @api public
 * @param {Page} page
 */

Mixpanel.prototype.page = function(page) {
  var category = page.category();
  var name = page.fullName();
  var opts = this.options;

  // all pages
  if (opts.trackAllPages) {
    this.track(page.track());
  }

  // categorized pages
  if (category && opts.trackCategorizedPages) {
    this.track(page.track(category));
  }

  // named pages
  if (name && opts.trackNamedPages) {
    this.track(page.track(name));
  }
};

/**
 * Trait aliases.
 */

var traitAliases = {
  created: '$created',
  email: '$email',
  firstName: '$first_name',
  lastName: '$last_name',
  lastSeen: '$last_seen',
  name: '$name',
  username: '$username',
  phone: '$phone'
};

/**
 * Identify.
 *
 * https://mixpanel.com/help/reference/javascript#super-properties
 * https://mixpanel.com/help/reference/javascript#user-identity
 * https://mixpanel.com/help/reference/javascript#storing-user-profiles
 *
 * @api public
 * @param {Identify} identify
 */

Mixpanel.prototype.identify = function(identify) {
  var username = identify.username();
  var email = identify.email();
  var id = identify.userId();
  var setAllTraitsByDefault = this.options.setAllTraitsByDefault;
  var people = this.options.people;

  // id
  if (id) window.mixpanel.identify(id);

  // name tag
  var nametag = email || username || id;
  if (nametag) window.mixpanel.name_tag(nametag);

  // default set all traits as super and people properties
  var traits = identify.traits(traitAliases);
  if (traits.$created) del(traits, 'createdAt');
  if (setAllTraitsByDefault) {
    window.mixpanel.register(dates(traits, iso));
    if (people) window.mixpanel.people.set(traits);
  }

  // explicitly set select traits as people and super properties
  var opts = identify.integrations() || {};
  opts = opts[this.name] || {};
  var superProps = pick(opts.superProperties || [], identify.traits());
  var peopleProps = pick(opts.peopleProperties || [], identify.traits());
  superProps = mapTraits(superProps, traitAliases);
  peopleProps = mapTraits(peopleProps, traitAliases);
  if (!is.empty(superProps)) window.mixpanel.register(superProps);
  if (!is.empty(peopleProps) && people) window.mixpanel.people.set(peopleProps);
};

/**
 * Track.
 *
 * https://mixpanel.com/help/reference/javascript#sending-events
 * https://mixpanel.com/help/reference/javascript#tracking-revenue
 *
 * @api public
 * @param {Track} track
 */

Mixpanel.prototype.track = function(track) {
  var increments = this.options.increments;
  var increment = track.event().toLowerCase();
  var people = this.options.people;
  var props = track.properties();
  var revenue = track.revenue();
  var opts = track.options(this.name) || {};
  // delete mixpanel's reserved properties, so they don't conflict
  delete props.distinct_id;
  delete props.ip;
  delete props.mp_name_tag;
  delete props.mp_note;
  delete props.token;

  // Map People and Super props to Mixpanel special properties
  var superProps = mapTraits(pick(opts.superProperties || [], props), traitAliases);
  var peopleProps = mapTraits(pick(opts.peopleProperties || [], props), traitAliases);

  // increment properties in mixpanel people
  if (people && includes(increment, increments)) {
    window.mixpanel.people.increment(track.event());
    window.mixpanel.people.set('Last ' + track.event(), new Date());
  }

  // track the event
  props = dates(props, iso);
  window.mixpanel.track(track.event(), props);

  // register super properties if present in context.mixpanel.superProperties
  if (!is.empty(superProps)) {
    window.mixpanel.register(superProps);
  }

  // set people properties if present in context.mixpanel.peopleProperties
  if (!is.empty(peopleProps) && people) {
    window.mixpanel.people.set(peopleProps);
  }

  // track revenue specifically
  if (revenue && people) {
    window.mixpanel.people.track_charge(revenue);
  }
};

/**
 * Alias.
 *
 * https://mixpanel.com/help/reference/javascript#user-identity
 * https://mixpanel.com/help/reference/javascript-full-api-reference#mixpanel.alias
 *
 * @api public
 * @param {Alias} alias
 */

Mixpanel.prototype.alias = function(alias) {
  var mp = window.mixpanel;
  var to = alias.to();
  if (mp.get_distinct_id && mp.get_distinct_id() === to) return;
  // HACK: internal mixpanel API to ensure we don't overwrite
  if (mp.get_property && mp.get_property('$people_distinct_id') === to) return;
  // although undocumented, mixpanel takes an optional original id
  mp.alias(to, alias.from());
};

/**
 * Lowercase the given `arr`.
 *
 * @api private
 * @param {Array} arr
 * @return {Array}
 */

function lowercase(arr) {
  var ret = new Array(arr.length);

  for (var i = 0; i < arr.length; ++i) {
    ret[i] = String(arr[i]).toLowerCase();
  }

  return ret;
}

/**
 * Map dictionary to traits in the given arr
 *
 * @api private
 * @param {Object} traits
 * @param {Object} dictionary
 * @return {Array}
 */

function mapTraits(traits, traitAliases) {
  if (!traits) return {};
  var ret = {};
  for (var trait in traits) {
    if (traitAliases.hasOwnProperty(trait)) ret[traitAliases[trait]] = traits[trait];
    else ret[trait] = traits[trait];
  }
  return ret;
}
