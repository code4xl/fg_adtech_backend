/*!
 * Ocean Ads SDK
 * Copyright (c) 2025 Ocean Ads Network
 * Publisher: 02e41c5c-35bd-4674-8de0-7dc994d08866
 * Build: production
 * Generated: 2025-07-04T12:00:21.177Z
 */
// (function(){'use strict';// Embed configuration window.__OCEAN_CONFIG__ ={"publisher":{"id":"02e41c5c-35bd-4674-8de0-7dc994d08866","tier":"basic"},"website":{"id":"8b3eb1dd-880c-4c0c-8e35-84ec2bcb3371","domain":"sportsfan924-227.co"},"inventory":[],"settings":{"apiUrl":"http://localhost:3001","endpoints":{"bid":"http://localhost:3001/rtb/bid-request","track":"http://localhost:3001/rtb/track","sse":"http://localhost:3001/rtb/stream"},"sseTimeout":250,"debug":true,"batchDelay":50,"maxRetries":1,"fallbackTimeout":500}};// Configuration validation if(typeof window.__OCEAN_CONFIG__ !== 'object' || !window.__OCEAN_CONFIG__){console.error('[Ocean Ads] Invalid configuration');return;}// Debug mode logging if(window.__OCEAN_CONFIG__.settings.debug){console.log('[Ocean Ads] Configuration loaded:',window.__OCEAN_CONFIG__);}})();
/*!
 * Ocean Ads SDK v2.0.0
 * (c) 2024 Ocean Ads Network
 * Released under the MIT License
 * Built: 2025-07-04T11:29:26.169Z
 */
var OceanAds=(function(exports){'use strict';
        if (!window.Promise) {
          throw new Error('Ocean Ads SDK requires Promise support');
        }
        if (!window.EventSource) {
          throw new Error('Ocean Ads SDK requires EventSource support');
        }
      

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function __generator(thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
}

function __values(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
}

function __read(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};var EventBus = /** @class */ (function () {
    function EventBus() {
        this.listeners = new Map();
        this.subscriptionCounter = 0;
        this.domCleanupMap = new WeakMap();
    }
    EventBus.getInstance = function () {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    };
    EventBus.prototype.on = function (type, handler, context) {
        var subscriptionId = this.generateSubscriptionId();
        var subscription = {
            id: subscriptionId,
            type: type,
            handler: handler,
            once: false
        };
        this.addSubscription(type, subscription);
        if (context && context instanceof Element) {
            this.trackDomSubscription(context, subscriptionId);
        }
        return subscriptionId;
    };
    EventBus.prototype.once = function (type, handler, context) {
        var self = this;
        var wrappedHandler = function (event) {
            handler(event);
            self.off(subscriptionId);
        };
        var subscriptionId = this.generateSubscriptionId();
        var subscription = {
            id: subscriptionId,
            type: type,
            handler: wrappedHandler,
            once: true
        };
        this.addSubscription(type, subscription);
        if (context && context instanceof Element) {
            this.trackDomSubscription(context, subscriptionId);
        }
        return subscriptionId;
    };
    EventBus.prototype.off = function (subscriptionId) {
        var e_1, _a, e_2, _b;
        try {
            for (var _c = __values(this.listeners), _d = _c.next(); !_d.done; _d = _c.next()) {
                var _e = __read(_d.value, 2), type = _e[0], subscriptions = _e[1];
                try {
                    for (var subscriptions_1 = (e_2 = void 0, __values(subscriptions)), subscriptions_1_1 = subscriptions_1.next(); !subscriptions_1_1.done; subscriptions_1_1 = subscriptions_1.next()) {
                        var subscription = subscriptions_1_1.value;
                        if (subscription.id === subscriptionId) {
                            subscriptions.delete(subscription);
                            if (subscriptions.size === 0) {
                                this.listeners.delete(type);
                            }
                            return true;
                        }
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (subscriptions_1_1 && !subscriptions_1_1.done && (_b = subscriptions_1.return)) _b.call(subscriptions_1);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return false;
    };
    EventBus.prototype.emit = function (type, data) {
        var event = {
            type: type,
            timestamp: Date.now(),
            data: data
        };
        var subscriptions = this.listeners.get(type);
        if (!subscriptions || subscriptions.size === 0) {
            return;
        }
        var subscriptionArray = Array.from(subscriptions);
        for (var i = 0; i < subscriptionArray.length; i++) {
            var subscription = subscriptionArray[i];
            try {
                subscription.handler(event);
            }
            catch (error) {
                if (typeof console !== 'undefined' && console.error) {
                    console.error('EventBus: Error in event handler', error);
                }
            }
        }
    };
    EventBus.prototype.clear = function (type) {
        if (type) {
            this.listeners.delete(type);
        }
        else {
            this.listeners.clear();
        }
    };
    EventBus.prototype.getListenerCount = function (type) {
        var e_3, _a;
        if (type) {
            var subscriptions = this.listeners.get(type);
            return subscriptions ? subscriptions.size : 0;
        }
        var total = 0;
        try {
            for (var _b = __values(this.listeners), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), _ = _d[0], subs = _d[1];
                total += subs.size;
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_3) throw e_3.error; }
        }
        return total;
    };
    EventBus.prototype.cleanupElement = function (element) {
        var e_4, _a;
        var subscriptionIds = this.domCleanupMap.get(element);
        if (!subscriptionIds) {
            return;
        }
        try {
            for (var subscriptionIds_1 = __values(subscriptionIds), subscriptionIds_1_1 = subscriptionIds_1.next(); !subscriptionIds_1_1.done; subscriptionIds_1_1 = subscriptionIds_1.next()) {
                var id = subscriptionIds_1_1.value;
                this.off(id);
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (subscriptionIds_1_1 && !subscriptionIds_1_1.done && (_a = subscriptionIds_1.return)) _a.call(subscriptionIds_1);
            }
            finally { if (e_4) throw e_4.error; }
        }
        this.domCleanupMap.delete(element);
    };
    EventBus.prototype.addSubscription = function (type, subscription) {
        var subscriptions = this.listeners.get(type);
        if (!subscriptions) {
            subscriptions = new Set();
            this.listeners.set(type, subscriptions);
        }
        subscriptions.add(subscription);
    };
    EventBus.prototype.trackDomSubscription = function (element, subscriptionId) {
        var subscriptions = this.domCleanupMap.get(element);
        if (!subscriptions) {
            subscriptions = new Set();
            this.domCleanupMap.set(element, subscriptions);
        }
        subscriptions.add(subscriptionId);
    };
    EventBus.prototype.generateSubscriptionId = function () {
        return 'sub_' + (++this.subscriptionCounter) + '_' + Date.now();
    };
    EventBus.prototype.getAllEventTypes = function () {
        return Array.from(this.listeners.keys());
    };
    EventBus.prototype.hasListeners = function (type) {
        var subscriptions = this.listeners.get(type);
        return subscriptions ? subscriptions.size > 0 : false;
    };
    return EventBus;
}());
var eventBus = EventBus.getInstance();/**
 * Configuration types for Ocean Ads SDK v2
 * Defines the structure of window.__OCEAN_CONFIG__ embedded by CDN
 */
/**
 * Default settings if not provided
 */
var DEFAULT_SETTINGS = {
    sseTimeout: 250,
    debug: false,
    batchDelay: 50,
    maxRetries: 1,
    fallbackTimeout: 500
};
/**
 * Validates configuration structure
 * @param config - Configuration object to validate
 * @returns True if valid, false otherwise
 */
function isValidConfig(config) {
    if (!config || typeof config !== 'object') {
        return false;
    }
    // Validate publisher
    if (!config.publisher ||
        typeof config.publisher.id !== 'string' ||
        typeof config.publisher.tier !== 'string') {
        return false;
    }
    // Validate website
    if (!config.website ||
        typeof config.website.id !== 'string' ||
        typeof config.website.domain !== 'string') {
        return false;
    }
    // Validate inventory
    if (!Array.isArray(config.inventory) || config.inventory.length === 0) {
        return false;
    }
    // Validate each inventory item
    for (var i = 0; i < config.inventory.length; i++) {
        var item = config.inventory[i];
        if (typeof item.selector !== 'string' ||
            typeof item.inventoryId !== 'string') {
            return false;
        }
    }
    // Validate settings
    if (!config.settings ||
        typeof config.settings.apiUrl !== 'string' ||
        typeof config.settings.sseTimeout !== 'number') {
        return false;
    }
    return true;
}
/**
 * Merges partial config with defaults
 * @param config - Partial configuration
 * @returns Complete configuration with defaults
 */
function mergeWithDefaults(config) {
    return {
        publisher: config.publisher,
        website: config.website,
        inventory: config.inventory,
        settings: Object.assign({}, DEFAULT_SETTINGS, config.settings)
    };
}/**
 * Internal SDK types for Ocean Ads SDK v2
 * Defines internal state management, events, and error handling
 */
/**
 * Creates an SDK error
 * @param code - Error code
 * @param message - Error message
 * @param context - Additional context
 * @returns SDK error object
 */
function createError(code, message, context) {
    var severity = 'medium';
    // Determine severity based on code
    if (code === 'CONFIG_MISSING' || code === 'CONFIG_INVALID') {
        severity = 'critical';
    }
    else if (code === 'REQUEST_FAILED' || code === 'SSE_FAILED') {
        severity = 'high';
    }
    else if (code === 'TRACKING_FAILED') {
        severity = 'low';
    }
    return {
        code: code,
        message: message,
        severity: severity,
        context: context,
        timestamp: Date.now()
    };
}
/**
 * Creates a performance metric
 * @param metric - Metric name
 * @param value - Metric value
 * @param unit - Metric unit
 * @returns Performance event data
 */
function createMetric(metric, value, unit) {
    return {
        metric: metric,
        value: value,
        unit: unit
    };
}var ConfigManager = /** @class */ (function () {
    function ConfigManager() {
        this.config = null;
        this.configOverrides = {};
        this.loadConfig();
    }
    ConfigManager.getInstance = function () {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    };
    ConfigManager.prototype.loadConfig = function () {
        try {
            var embeddedConfig = window.__OCEAN_CONFIG__;
            if (!embeddedConfig) {
                var error = createError('CONFIG_MISSING', 'No configuration found in window.__OCEAN_CONFIG__');
                eventBus.emit('sdk:error', { error: error });
                return;
            }
            if (!isValidConfig(embeddedConfig)) {
                var validationError = createError('CONFIG_INVALID', 'Invalid configuration structure', { config: embeddedConfig });
                eventBus.emit('sdk:error', { error: validationError });
                return;
            }
            this.config = mergeWithDefaults(embeddedConfig);
            eventBus.emit('context:collected', {
                type: 'config',
                data: this.getSafeConfig()
            });
        }
        catch (error) {
            var loadError = createError('CONFIG_INVALID', 'Failed to load configuration', { originalError: error });
            eventBus.emit('sdk:error', { error: loadError });
        }
    };
    ConfigManager.prototype.getConfig = function () {
        return this.config;
    };
    ConfigManager.prototype.getPublisher = function () {
        return this.config ? this.config.publisher : null;
    };
    ConfigManager.prototype.getWebsite = function () {
        return this.config ? this.config.website : null;
    };
    ConfigManager.prototype.getInventory = function () {
        return this.config ? this.config.inventory : [];
    };
    ConfigManager.prototype.getSettings = function () {
        if (this.config) {
            return Object.assign({}, this.config.settings, this.configOverrides.settings);
        }
        return DEFAULT_SETTINGS;
    };
    ConfigManager.prototype.getInventoryById = function (inventoryId) {
        if (!this.config)
            return null;
        for (var i = 0; i < this.config.inventory.length; i++) {
            if (this.config.inventory[i].inventoryId === inventoryId) {
                return this.config.inventory[i];
            }
        }
        return null;
    };
    ConfigManager.prototype.getInventoryBySelector = function (selector) {
        if (!this.config)
            return null;
        for (var i = 0; i < this.config.inventory.length; i++) {
            if (this.config.inventory[i].selector === selector) {
                return this.config.inventory[i];
            }
        }
        return null;
    };
    ConfigManager.prototype.updateSettings = function (settings) {
        if (!this.config)
            return;
        this.configOverrides.settings = Object.assign({}, this.configOverrides.settings, settings);
        eventBus.emit('context:collected', {
            type: 'settings_update',
            data: this.getSettings()
        });
    };
    ConfigManager.prototype.isDebugMode = function () {
        var settings = this.getSettings();
        return settings.debug === true;
    };
    ConfigManager.prototype.getApiUrl = function () {
        var settings = this.getSettings();
        return settings.apiUrl;
    };
    ConfigManager.prototype.getSSETimeout = function () {
        var settings = this.getSettings();
        return settings.sseTimeout;
    };
    ConfigManager.prototype.getBatchDelay = function () {
        var settings = this.getSettings();
        return settings.batchDelay || 50;
    };
    ConfigManager.prototype.getMaxRetries = function () {
        var settings = this.getSettings();
        return settings.maxRetries || 1;
    };
    ConfigManager.prototype.getFallbackTimeout = function () {
        var settings = this.getSettings();
        return settings.fallbackTimeout || 500;
    };
    ConfigManager.prototype.isValid = function () {
        return this.config !== null;
    };
    ConfigManager.prototype.getSafeConfig = function () {
        if (!this.config)
            return {};
        return {
            publisher: {
                id: this.config.publisher.id,
                tier: this.config.publisher.tier
            },
            website: {
                id: this.config.website.id,
                domain: this.config.website.domain
            },
            inventory: this.config.inventory.map(function (inv) {
                return {
                    selector: inv.selector,
                    inventoryId: inv.inventoryId,
                    size: inv.size
                };
            }),
            settings: {
                apiUrl: this.config.settings.apiUrl,
                sseTimeout: this.config.settings.sseTimeout,
                debug: this.config.settings.debug
            }
        };
    };
    ConfigManager.prototype.reload = function () {
        this.config = null;
        this.configOverrides = {};
        this.loadConfig();
    };
    ConfigManager.prototype.validateInventorySelector = function (selector) {
        try {
            document.querySelector(selector);
            return true;
        }
        catch (e) {
            return false;
        }
    };
    ConfigManager.prototype.getRefreshConfig = function (inventoryId) {
        var inventory = this.getInventoryById(inventoryId);
        if (!inventory || !inventory.refresh) {
            return { enabled: true };
        }
        return inventory.refresh;
    };
    return ConfigManager;
}());
var configManager = ConfigManager.getInstance();/**
 * UUID generation utilities for Ocean Ads SDK v2
 * Fast, collision-resistant ID generation without external dependencies
 */
/**
 * Simple random string generator
 * @param length - Length of random string
 * @returns Random alphanumeric string
 */
function randomString(length) {
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var result = '';
    for (var i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
/**
 * Get high-resolution timestamp
 * Falls back to Date.now() if performance.now() unavailable
 * @returns Timestamp in milliseconds
 */
function getTimestamp() {
    if (typeof performance !== 'undefined' && performance.now) {
        return Math.floor(performance.now() + performance.timeOrigin);
    }
    return Date.now();
}
/**
 * Counter for ensuring uniqueness within same millisecond
 */
var counter = 0;
var lastTimestamp = 0;
/**
 * Generates a unique request ID
 * Format: req_{timestamp}_{random}
 * Example: req_1704123456789_abc123
 * @returns Unique request identifier
 */
function generateRequestId() {
    var timestamp = getTimestamp();
    // If same timestamp, increment counter
    if (timestamp === lastTimestamp) {
        counter++;
    }
    else {
        counter = 0;
        lastTimestamp = timestamp;
    }
    // Add counter to timestamp for uniqueness
    var uniqueTimestamp = timestamp + '_' + counter;
    var random = randomString(6);
    return 'req_' + uniqueTimestamp + '_' + random;
}
/**
 * Generates a session ID
 * Format: sess_{random}
 * Example: sess_abc123xyz789
 * @returns Unique session identifier
 */
function generateSessionId() {
    return 'sess_' + randomString(12);
}
/**
 * Generates a generic unique ID
 * Can be used for internal tracking
 * @param prefix - Optional prefix for the ID
 * @returns Unique identifier
 */
function generateUniqueId(prefix) {
    var timestamp = Date.now().toString(36);
    var random = randomString(8);
    var id = timestamp + '_' + random;
    return prefix ? prefix + '_' + id : id;
}
/**
 * Generates a short ID suitable for DOM elements
 * Ensures it starts with a letter for valid HTML IDs
 * @returns Short unique identifier
 */
function generateElementId() {
    return 'ocean_' + randomString(8);
}/**
 * DOM manipulation utilities for Ocean Ads SDK v2
 * Safe, IE11-compatible DOM operations
 */
// Re-export generateElementId for convenience
/**
 * Safely queries for multiple elements
 * @param selector - CSS selector
 * @param context - Optional context element
 * @returns Array of elements (never null)
 */
function safeQuerySelectorAll(selector, context) {
    try {
        var root = context || document;
        var nodeList = root.querySelectorAll(selector);
        var results = [];
        // Convert NodeList to Array (IE11 compatible)
        for (var i = 0; i < nodeList.length; i++) {
            results.push(nodeList[i]);
        }
        return results;
    }
    catch (error) {
        // Invalid selector or other error
        return [];
    }
}
/**
 * Checks if element is visible in viewport
 * @param element - Element to check
 * @param threshold - Visibility threshold (0-1)
 * @returns True if visible
 */
function isElementVisible(element, threshold) {
    if (!element || !element.offsetParent) {
        return false;
    }
    var rect = element.getBoundingClientRect();
    var viewHeight = window.innerHeight || document.documentElement.clientHeight;
    var viewWidth = window.innerWidth || document.documentElement.clientWidth;
    // Check if element has dimensions
    if (rect.width === 0 || rect.height === 0) {
        return false;
    }
    // Calculate visible area
    var visibleWidth = Math.min(rect.right, viewWidth) - Math.max(rect.left, 0);
    var visibleHeight = Math.min(rect.bottom, viewHeight) - Math.max(rect.top, 0);
    if (visibleWidth <= 0 || visibleHeight <= 0) {
        return false;
    }
    // Calculate visibility percentage
    var visibleArea = visibleWidth * visibleHeight;
    var totalArea = rect.width * rect.height;
    var visibilityRatio = visibleArea / totalArea;
    var minThreshold = threshold || 0.5;
    return visibilityRatio >= minThreshold;
}
/**
 * Checks if DOM is ready
 * @param callback - Function to call when ready
 */
function domReady(callback) {
    if (document.readyState === 'loading') {
        // IE11 compatible event listener
        if (document.addEventListener) {
            document.addEventListener('DOMContentLoaded', callback);
        }
        else {
            // Fallback for very old browsers
            document.attachEvent('onreadystatechange', function () {
                if (document.readyState === 'complete') {
                    callback();
                }
            });
        }
    }
    else {
        // DOM already ready
        callback();
    }
}
/**
 * Creates element with attributes
 * @param tag - Element tag name
 * @param attributes - Attributes to set
 * @param children - Optional children elements or text
 * @returns Created element
 */
function createElement(tag, attributes, children) {
    var element = document.createElement(tag);
    // Set attributes
    if (attributes) {
        for (var key in attributes) {
            if (attributes.hasOwnProperty(key)) {
                var value = attributes[key];
                if (value !== null && value !== undefined && value !== false) {
                    if (key === 'className') {
                        element.className = String(value);
                    }
                    else if (key.startsWith('data-')) {
                        // Handle data attributes
                        var dataKey = key.slice(5).replace(/-(.)/g, function (_, char) {
                            return char.toUpperCase();
                        });
                        element.dataset[dataKey] = String(value);
                    }
                    else {
                        element.setAttribute(key, String(value));
                    }
                }
            }
        }
    }
    // Add children
    if (children) {
        for (var i = 0; i < children.length; i++) {
            var child = children[i];
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            }
            else if (child instanceof Node) {
                element.appendChild(child);
            }
        }
    }
    return element;
}
/**
 * Checks if IntersectionObserver is supported
 * @returns True if supported
 */
function isIntersectionObserverSupported() {
    return typeof window !== 'undefined' &&
        'IntersectionObserver' in window &&
        'IntersectionObserverEntry' in window &&
        'intersectionRatio' in window.IntersectionObserverEntry.prototype;
}
/**
 * Simple IntersectionObserver polyfill check
 * Returns a fallback visibility checker if not supported
 * @param callback - Visibility change callback
 * @param options - Observer options
 * @returns Disconnect function
 */
function observeVisibility(element, callback, options) {
    if (isIntersectionObserverSupported()) {
        // Use native IntersectionObserver
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                callback(entry.isIntersecting, entry);
            });
        }, {
            threshold: (options === null || options === void 0 ? void 0 : options.threshold) || 0.5,
            rootMargin: (options === null || options === void 0 ? void 0 : options.rootMargin) || '0px'
        });
        observer.observe(element);
        return function () {
            observer.disconnect();
        };
    }
    else {
        // Fallback: Poll for visibility
        var checkVisibility = function () {
            var isVisible = isElementVisible(element, options === null || options === void 0 ? void 0 : options.threshold);
            callback(isVisible);
        };
        // Check immediately
        checkVisibility();
        // Set up polling
        var intervalId = window.setInterval(checkVisibility, 250);
        return function () {
            window.clearInterval(intervalId);
        };
    }
}
/**
 * Safely adds event listener with IE11 support
 * @param element - Target element
 * @param event - Event name
 * @param handler - Event handler
 * @param options - Event options
 * @returns Remove listener function
 */
function addEventListener(element, event, handler, options) {
    if (element.addEventListener) {
        element.addEventListener(event, handler, options);
        return function () {
            element.removeEventListener(event, handler, options);
        };
    }
    else if (element.attachEvent) {
        // IE8 fallback
        var wrappedHandler = function (e) {
            handler.call(element, e || window.event);
        };
        element.attachEvent('on' + event, wrappedHandler);
        return function () {
            element.detachEvent('on' + event, wrappedHandler);
        };
    }
    return function () { }; // No-op
}var SlotManager = /** @class */ (function () {
    function SlotManager() {
        this.observer = null;
        this.observerConnected = false;
        this.slots = new Map();
        this.elementToSlotMap = new WeakMap();
        this.setupMutationObserver();
    }
    SlotManager.getInstance = function () {
        if (!SlotManager.instance) {
            SlotManager.instance = new SlotManager();
        }
        return SlotManager.instance;
    };
    SlotManager.prototype.discoverSlots = function () {
        var inventoryConfigs = configManager.getInventory();
        var discoveredSlots = [];
        for (var i = 0; i < inventoryConfigs.length; i++) {
            var config = inventoryConfigs[i];
            var elements = this.findSlotElements(config);
            for (var j = 0; j < elements.length; j++) {
                var slot = this.createSlotFromElement(elements[j], config);
                if (slot && !this.isDuplicateSlot(slot)) {
                    this.addSlot(slot);
                    discoveredSlots.push(slot);
                }
            }
        }
        if (discoveredSlots.length > 0) {
            eventBus.emit('performance:metric', {
                metric: 'slots_discovered',
                value: discoveredSlots.length,
                unit: 'count'
            });
        }
        this.startObserving();
        return discoveredSlots;
    };
    SlotManager.prototype.findSlotElements = function (config) {
        if (!configManager.validateInventorySelector(config.selector)) {
            eventBus.emit('sdk:error', {
                error: createError('SLOT_INVALID', 'Invalid selector: ' + config.selector, { inventoryId: config.inventoryId })
            });
            return [];
        }
        return safeQuerySelectorAll(config.selector);
    };
    SlotManager.prototype.createSlotFromElement = function (element, config) {
        var _a, _b;
        if (!this.isValidSlotElement(element)) {
            return null;
        }
        var existingSlotId = this.elementToSlotMap.get(element);
        if (existingSlotId) {
            return this.slots.get(existingSlotId) || null;
        }
        var elementId = element.id || generateElementId();
        if (!element.id) {
            element.id = elementId;
        }
        var slot = {
            id: generateUniqueId('slot'),
            inventoryId: config.inventoryId,
            element: element,
            elementId: elementId,
            state: 'discovered',
            refresh: {
                enabled: ((_a = config.refresh) === null || _a === void 0 ? void 0 : _a.enabled) !== false,
                count: 0,
                interval: (_b = config.refresh) === null || _b === void 0 ? void 0 : _b.interval
            }
        };
        var sizeAttr = element.getAttribute('data-size');
        if (sizeAttr) {
            var sizeParts = sizeAttr.split('x');
            if (sizeParts.length === 2) {
                slot.size = {
                    width: parseInt(sizeParts[0], 10),
                    height: parseInt(sizeParts[1], 10)
                };
            }
        }
        return slot;
    };
    SlotManager.prototype.isValidSlotElement = function (element) {
        return element.offsetWidth > 0 &&
            element.offsetHeight > 0 &&
            element.offsetParent !== null;
    };
    SlotManager.prototype.isDuplicateSlot = function (slot) {
        return this.elementToSlotMap.has(slot.element);
    };
    SlotManager.prototype.addSlot = function (slot) {
        this.slots.set(slot.id, slot);
        this.elementToSlotMap.set(slot.element, slot.id);
        eventBus.emit('slot:discovered', {
            slotId: slot.id,
            inventoryId: slot.inventoryId
        });
        this.setupSlotVisibilityTracking(slot);
    };
    SlotManager.prototype.setupSlotVisibilityTracking = function (slot) {
        observeVisibility(slot.element, function (isVisible) {
            if (isVisible && slot.state === 'rendered') {
                eventBus.emit('slot:viewable', {
                    slotId: slot.id,
                    inventoryId: slot.inventoryId
                });
            }
        }, { threshold: 0.5 });
    };
    SlotManager.prototype.getSlotById = function (slotId) {
        return this.slots.get(slotId) || null;
    };
    SlotManager.prototype.getSlotByElement = function (element) {
        var slotId = this.elementToSlotMap.get(element);
        return slotId ? this.slots.get(slotId) || null : null;
    };
    SlotManager.prototype.getSlotsByInventoryId = function (inventoryId) {
        var results = [];
        this.slots.forEach(function (slot) {
            if (slot.inventoryId === inventoryId) {
                results.push(slot);
            }
        });
        return results;
    };
    SlotManager.prototype.getAllSlots = function () {
        return Array.from(this.slots.values());
    };
    SlotManager.prototype.getActiveSlots = function () {
        return this.getAllSlots().filter(function (slot) {
            return slot.state !== 'failed' &&
                slot.element.offsetParent !== null;
        });
    };
    SlotManager.prototype.updateSlotState = function (slotId, state) {
        var slot = this.slots.get(slotId);
        if (!slot)
            return;
        var previousState = slot.state;
        slot.state = state;
        if (state === 'requesting') {
            slot.lastRequest = Date.now();
        }
        eventBus.emit('slot:' + state, {
            slotId: slot.id,
            inventoryId: slot.inventoryId,
            previousState: previousState
        });
    };
    SlotManager.prototype.addDynamicSlot = function (element, inventoryId) {
        if (!this.isValidSlotElement(element)) {
            return null;
        }
        var config = null;
        if (inventoryId) {
            config = configManager.getInventoryById(inventoryId);
        }
        else {
            var classList = element.className.split(' ');
            for (var i = 0; i < classList.length; i++) {
                config = configManager.getInventoryBySelector('.' + classList[i]);
                if (config)
                    break;
            }
        }
        if (!config) {
            eventBus.emit('sdk:error', {
                error: createError('SLOT_INVALID', 'No inventory config found for dynamic slot', { element: element.id || element.className })
            });
            return null;
        }
        var slot = this.createSlotFromElement(element, config);
        if (slot) {
            this.addSlot(slot);
        }
        return slot;
    };
    SlotManager.prototype.setupMutationObserver = function () {
        var self = this;
        if (typeof MutationObserver === 'undefined') {
            return;
        }
        this.observer = new MutationObserver(function () {
            self.handleMutations();
        });
    };
    SlotManager.prototype.startObserving = function () {
        if (this.observer && !this.observerConnected) {
            this.observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'id']
            });
            this.observerConnected = true;
        }
    };
    SlotManager.prototype.handleMutations = function () {
        var self = this;
        if (this.discoveryTimer) {
            clearTimeout(this.discoveryTimer);
        }
        this.discoveryTimer = window.setTimeout(function () {
            self.discoverNewSlots();
        }, 100);
    };
    SlotManager.prototype.discoverNewSlots = function () {
        var inventoryConfigs = configManager.getInventory();
        var newSlots = [];
        for (var i = 0; i < inventoryConfigs.length; i++) {
            var config = inventoryConfigs[i];
            var elements = this.findSlotElements(config);
            for (var j = 0; j < elements.length; j++) {
                if (!this.elementToSlotMap.has(elements[j])) {
                    var slot = this.createSlotFromElement(elements[j], config);
                    if (slot) {
                        this.addSlot(slot);
                        newSlots.push(slot);
                    }
                }
            }
        }
        if (newSlots.length > 0) {
            eventBus.emit('slot:discovered', {
                dynamic: true,
                count: newSlots.length
            });
        }
    };
    SlotManager.prototype.removeSlot = function (slotId) {
        var slot = this.slots.get(slotId);
        if (!slot)
            return;
        this.elementToSlotMap.delete(slot.element);
        this.slots.delete(slotId);
        if (slot.refresh.timer) {
            clearTimeout(slot.refresh.timer);
        }
    };
    SlotManager.prototype.cleanup = function () {
        if (this.observer) {
            this.observer.disconnect();
            this.observerConnected = false;
        }
        if (this.discoveryTimer) {
            clearTimeout(this.discoveryTimer);
        }
        this.slots.forEach(function (slot) {
            if (slot.refresh.timer) {
                clearTimeout(slot.refresh.timer);
            }
        });
        this.slots.clear();
    };
    SlotManager.prototype.getSlot = function (slotId) {
        return this.slots.get(slotId) || null;
    };
    SlotManager.prototype.refreshSlot = function (slotId) {
        var slot = this.getSlot(slotId);
        if (!slot)
            return;
        slot.refresh.count++;
        this.updateSlotState(slotId, 'refreshing');
        eventBus.emit('slot:refresh', {
            slotId: slot.id,
            inventoryId: slot.inventoryId,
            refreshCount: slot.refresh.count
        });
    };
    SlotManager.prototype.refreshAll = function () {
        var slots = this.getAllSlots();
        for (var i = 0; i < slots.length; i++) {
            if (slots[i].refresh.enabled) {
                this.refreshSlot(slots[i].id);
            }
        }
    };
    SlotManager.prototype.getMetrics = function () {
        var states = {
            discovered: 0,
            validated: 0,
            requesting: 0,
            received: 0,
            rendering: 0,
            rendered: 0,
            failed: 0,
            refreshing: 0
        };
        this.slots.forEach(function (slot) {
            states[slot.state]++;
        });
        return {
            total: this.slots.size,
            states: states,
            activeSlots: this.getActiveSlots().length
        };
    };
    return SlotManager;
}());
var slotManager = SlotManager.getInstance();var Logger = /** @class */ (function () {
    function Logger() {
        this.enabled = false;
        this.logHistory = [];
        this.MAX_HISTORY = 100;
        this.prefix = '[Ocean Ads]';
        this.checkDebugMode();
    }
    Logger.getInstance = function () {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    };
    Logger.prototype.checkDebugMode = function () {
        if (typeof window !== 'undefined') {
            var urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('ocean_debug') === 'true' || window.__OCEAN_DEBUG__) {
                this.enabled = true;
            }
        }
    };
    Logger.prototype.setEnabled = function (enabled) {
        this.enabled = enabled;
    };
    Logger.prototype.isEnabled = function () {
        return this.enabled;
    };
    Logger.prototype.log = function (level, message, data) {
        var entry = {
            level: level,
            message: message,
            data: data,
            timestamp: Date.now(),
            source: this.getCallerSource()
        };
        this.logHistory.push(entry);
        if (this.logHistory.length > this.MAX_HISTORY) {
            this.logHistory.shift();
        }
        if (this.enabled && typeof console !== 'undefined') {
            var logMessage = this.prefix + ' ' + message;
            var consoleFn = console[level] || console.log;
            if (data !== undefined) {
                consoleFn.call(console, logMessage, data);
            }
            else {
                consoleFn.call(console, logMessage);
            }
        }
        eventBus.emit('sdk:log', entry);
    };
    Logger.prototype.debug = function (message, data) {
        this.log('debug', message, data);
    };
    Logger.prototype.info = function (message, data) {
        this.log('info', message, data);
    };
    Logger.prototype.warn = function (message, data) {
        this.log('warn', message, data);
    };
    Logger.prototype.error = function (message, data) {
        this.log('error', message, data);
    };
    Logger.prototype.getCallerSource = function () {
        try {
            var stack = new Error().stack;
            if (!stack)
                return undefined;
            var lines = stack.split('\n');
            // Skip first 3 lines (Error, getCallerSource, log method)
            for (var i = 3; i < lines.length; i++) {
                var line = lines[i];
                if (line.indexOf('Logger') === -1) {
                    var match = line.match(/at\s+(\S+)/);
                    if (match) {
                        return match[1];
                    }
                }
            }
        }
        catch (e) {
            // Stack trace not available
        }
        return undefined;
    };
    Logger.prototype.getHistory = function (level) {
        if (!level) {
            return this.logHistory.slice();
        }
        return this.logHistory.filter(function (entry) {
            return entry.level === level;
        });
    };
    Logger.prototype.clearHistory = function () {
        this.logHistory = [];
    };
    Logger.prototype.group = function (label) {
        if (this.enabled && typeof console !== 'undefined' && console.group) {
            console.group(this.prefix + ' ' + label);
        }
    };
    Logger.prototype.groupEnd = function () {
        if (this.enabled && typeof console !== 'undefined' && console.groupEnd) {
            console.groupEnd();
        }
    };
    Logger.prototype.time = function (label) {
        if (this.enabled && typeof console !== 'undefined' && console.time) {
            console.time(this.prefix + ' ' + label);
        }
    };
    Logger.prototype.timeEnd = function (label) {
        if (this.enabled && typeof console !== 'undefined' && console.timeEnd) {
            console.timeEnd(this.prefix + ' ' + label);
        }
    };
    Logger.prototype.table = function (data, columns) {
        if (this.enabled && typeof console !== 'undefined' && console.table) {
            console.table(data, columns);
        }
    };
    return Logger;
}());
var logger = Logger.getInstance();/**
 * Device detection utilities for Ocean Ads SDK v2
 * Privacy-safe device and browser detection without fingerprinting
 */
/**
 * Cached device info to avoid repeated calculations
 */
var cachedDeviceInfo = null;
/**
 * Detects device type from user agent and screen size
 * @returns Device type
 */
function getDeviceType() {
    var ua = navigator.userAgent.toLowerCase();
    var screenWidth = window.screen.width;
    // Tablet detection (iPads, Android tablets)
    if (/(ipad|tablet|playbook|silk)|(android(?!.*mobile))/i.test(ua)) {
        return 'tablet';
    }
    // Mobile detection
    if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
        return 'mobile';
    }
    // Additional check based on screen size
    if (screenWidth < 768 && 'ontouchstart' in window) {
        return 'mobile';
    }
    return 'desktop';
}
/**
 * Detects operating system
 * @returns OS name and version
 */
function getOS() {
    var ua = navigator.userAgent;
    var os = 'unknown';
    var version = '';
    // Windows
    if (/windows/i.test(ua)) {
        os = 'windows';
        if (/windows nt 10/i.test(ua)) {
            version = '10';
        }
        else if (/windows nt 6\.3/i.test(ua)) {
            version = '8.1';
        }
        else if (/windows nt 6\.2/i.test(ua)) {
            version = '8';
        }
        else if (/windows nt 6\.1/i.test(ua)) {
            version = '7';
        }
    }
    // macOS
    else if (/macintosh|mac os x/i.test(ua)) {
        os = 'macos';
        var match = ua.match(/mac os x (\d+)[._](\d+)/i);
        if (match) {
            version = match[1] + '.' + match[2];
        }
    }
    // iOS
    else if (/iphone|ipad|ipod/i.test(ua)) {
        os = 'ios';
        var iosMatch = ua.match(/os (\d+)[._](\d+)/i);
        if (iosMatch) {
            version = iosMatch[1] + '.' + iosMatch[2];
        }
    }
    // Android
    else if (/android/i.test(ua)) {
        os = 'android';
        var androidMatch = ua.match(/android (\d+)\.(\d+)/i);
        if (androidMatch) {
            version = androidMatch[1] + '.' + androidMatch[2];
        }
    }
    // Linux
    else if (/linux/i.test(ua)) {
        os = 'linux';
    }
    return { name: os, version: version };
}
/**
 * Detects browser name and version
 * @returns Browser info
 */
function getBrowser() {
    var ua = navigator.userAgent;
    var browser = 'unknown';
    var version = '';
    // Edge (Chromium)
    if (/edg\//i.test(ua)) {
        browser = 'edge';
        var edgeMatch = ua.match(/edg\/(\d+)/i);
        if (edgeMatch) {
            version = edgeMatch[1];
        }
    }
    // Chrome
    else if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) {
        browser = 'chrome';
        var chromeMatch = ua.match(/(?:chrome|crios)\/(\d+)/i);
        if (chromeMatch) {
            version = chromeMatch[1];
        }
    }
    // Firefox
    else if (/firefox|fxios/i.test(ua)) {
        browser = 'firefox';
        var firefoxMatch = ua.match(/(?:firefox|fxios)\/(\d+)/i);
        if (firefoxMatch) {
            version = firefoxMatch[1];
        }
    }
    // Safari
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
        browser = 'safari';
        var safariMatch = ua.match(/version\/(\d+)/i);
        if (safariMatch) {
            version = safariMatch[1];
        }
    }
    // IE11
    else if (/trident.*rv:11/i.test(ua)) {
        browser = 'ie';
        version = '11';
    }
    // Legacy IE
    else if (/msie (\d+)/i.test(ua)) {
        browser = 'ie';
        var ieMatch = ua.match(/msie (\d+)/i);
        if (ieMatch) {
            version = ieMatch[1];
        }
    }
    return { name: browser, version: version };
}
/**
 * Gets complete device information
 * Cached to avoid repeated parsing
 * @returns Device info object
 */
function getDeviceInfo() {
    if (cachedDeviceInfo) {
        return cachedDeviceInfo;
    }
    var os = getOS();
    var browser = getBrowser();
    cachedDeviceInfo = {
        type: getDeviceType(),
        os: os.name,
        osVersion: os.version,
        browser: browser.name,
        browserVersion: browser.version,
        userAgent: navigator.userAgent
    };
    return cachedDeviceInfo;
}
/**
 * Gets screen information
 * @returns Screen dimensions and pixel ratio
 */
function getScreenInfo() {
    return {
        width: window.screen.width,
        height: window.screen.height,
        pixelRatio: window.devicePixelRatio || 1
    };
}
/**
 * Gets viewport information
 * @returns Viewport dimensions
 */
function getViewportInfo() {
    return {
        width: window.innerWidth || document.documentElement.clientWidth,
        height: window.innerHeight || document.documentElement.clientHeight
    };
}
/**
 * Detects connection type
 * Uses Network Information API when available
 * @returns Connection type
 */
function getConnectionType() {
    // Check for Network Information API
    var nav = navigator;
    var connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (connection) {
        // Modern API
        if (connection.effectiveType) {
            return connection.effectiveType;
        }
        // Legacy API
        if (connection.type) {
            switch (connection.type) {
                case 'wifi':
                    return 'wifi';
                case 'cellular':
                    // Try to determine cellular type
                    if (connection.downlinkMax) {
                        if (connection.downlinkMax > 10)
                            return '4g';
                        if (connection.downlinkMax > 2)
                            return '3g';
                        return '2g';
                    }
                    return '3g'; // Default cellular
                case 'ethernet':
                    return 'ethernet';
                default:
                    return 'unknown';
            }
        }
    }
    // Fallback: estimate based on performance
    if (typeof performance !== 'undefined' && performance.timing) {
        var loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        if (loadTime < 1000)
            return '4g';
        if (loadTime < 3000)
            return '3g';
        if (loadTime < 5000)
            return '2g';
    }
    return 'unknown';
}
/**
 * Estimates connection speed based on various metrics
 * @returns 'fast', 'slow', or 'unknown'
 */
function getConnectionSpeed() {
    var connectionType = getConnectionType();
    // Fast connections
    if (connectionType === '4g' || connectionType === 'wifi' || connectionType === 'ethernet') {
        return 'fast';
    }
    // Slow connections
    if (connectionType === '2g' || connectionType === '3g') {
        return 'slow';
    }
    // Check navigation timing
    if (typeof performance !== 'undefined' && performance.timing) {
        var dns = performance.timing.domainLookupEnd - performance.timing.domainLookupStart;
        var tcp = performance.timing.connectEnd - performance.timing.connectStart;
        var ttfb = performance.timing.responseStart - performance.timing.navigationStart;
        // Fast if all metrics are good
        if (dns < 50 && tcp < 100 && ttfb < 800) {
            return 'fast';
        }
        // Slow if any metric is poor
        if (dns > 200 || tcp > 500 || ttfb > 2000) {
            return 'slow';
        }
    }
    return 'unknown';
}var DeviceContext = /** @class */ (function () {
    function DeviceContext() {
        this.cachedDeviceContext = null;
        this.cachedGeoContext = null;
        this.lastUpdate = 0;
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
        this.initialize();
    }
    DeviceContext.getInstance = function () {
        if (!DeviceContext.instance) {
            DeviceContext.instance = new DeviceContext();
        }
        return DeviceContext.instance;
    };
    DeviceContext.prototype.initialize = function () {
        this.updateDeviceContext();
        this.updateGeoContext();
        var self = this;
        if (window.addEventListener) {
            window.addEventListener('resize', function () {
                self.handleViewportChange();
            });
            window.addEventListener('orientationchange', function () {
                self.handleViewportChange();
            });
        }
    };
    DeviceContext.prototype.getDeviceContext = function () {
        var now = Date.now();
        if (!this.cachedDeviceContext || (now - this.lastUpdate) > this.CACHE_DURATION) {
            this.updateDeviceContext();
            this.lastUpdate = now;
        }
        var viewport = getViewportInfo();
        return Object.assign({}, this.cachedDeviceContext, {
            viewport: viewport
        });
    };
    DeviceContext.prototype.getGeoContext = function () {
        if (!this.cachedGeoContext) {
            this.updateGeoContext();
        }
        return this.cachedGeoContext;
    };
    DeviceContext.prototype.getPerformanceContext = function () {
        var timing = this.getPerformanceTiming();
        var connectionSpeed = getConnectionSpeed();
        return {
            pageLoadTime: timing.loadTime,
            domReady: timing.domReady,
            connectionSpeed: connectionSpeed
        };
    };
    DeviceContext.prototype.updateDeviceContext = function () {
        var deviceInfo = getDeviceInfo();
        var screenInfo = getScreenInfo();
        var viewportInfo = getViewportInfo();
        var connectionType = getConnectionType();
        this.cachedDeviceContext = {
            userAgent: deviceInfo.userAgent,
            type: deviceInfo.type,
            os: deviceInfo.os,
            osVersion: deviceInfo.osVersion,
            browser: deviceInfo.browser,
            browserVersion: deviceInfo.browserVersion,
            screen: screenInfo,
            viewport: viewportInfo,
            connection: connectionType
        };
        eventBus.emit('context:collected', {
            type: 'device',
            data: this.cachedDeviceContext
        });
    };
    DeviceContext.prototype.updateGeoContext = function () {
        var date = new Date();
        this.cachedGeoContext = {
            timezone: this.getTimezone(),
            timezoneOffset: date.getTimezoneOffset()
        };
    };
    DeviceContext.prototype.getTimezone = function () {
        try {
            if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
                var formatter = Intl.DateTimeFormat();
                if (formatter.resolvedOptions) {
                    var options = formatter.resolvedOptions();
                    if (options.timeZone) {
                        return options.timeZone;
                    }
                }
            }
        }
        catch (e) {
            // Intl API not supported or error
        }
        var offset = new Date().getTimezoneOffset();
        var hours = Math.floor(Math.abs(offset) / 60);
        var minutes = Math.abs(offset) % 60;
        var sign = offset <= 0 ? '+' : '-';
        return 'UTC' + sign +
            (hours < 10 ? '0' : '') + hours + ':' +
            (minutes < 10 ? '0' : '') + minutes;
    };
    DeviceContext.prototype.getPerformanceTiming = function () {
        if (typeof performance === 'undefined' || !performance.timing) {
            return { loadTime: 0, domReady: 0 };
        }
        var timing = performance.timing;
        var loadTime = 0;
        var domReady = 0;
        if (timing.loadEventEnd && timing.navigationStart) {
            loadTime = timing.loadEventEnd - timing.navigationStart;
        }
        if (timing.domContentLoadedEventEnd && timing.navigationStart) {
            domReady = timing.domContentLoadedEventEnd - timing.navigationStart;
        }
        return {
            loadTime: Math.max(0, loadTime),
            domReady: Math.max(0, domReady)
        };
    };
    DeviceContext.prototype.handleViewportChange = function () {
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
        this.resizeTimeout = window.setTimeout(function () {
            var viewport = getViewportInfo();
            eventBus.emit('context:collected', {
                type: 'viewport_change',
                data: viewport
            });
        }, 250);
    };
    DeviceContext.prototype.refresh = function () {
        this.updateDeviceContext();
        this.updateGeoContext();
    };
    DeviceContext.prototype.isHighPerformanceDevice = function () {
        var _a;
        var connection = (_a = this.cachedDeviceContext) === null || _a === void 0 ? void 0 : _a.connection;
        var connectionSpeed = getConnectionSpeed();
        return (connection === '4g' || connection === 'wifi' || connection === 'ethernet') &&
            connectionSpeed === 'fast';
    };
    DeviceContext.prototype.isMobileDevice = function () {
        var _a;
        return ((_a = this.cachedDeviceContext) === null || _a === void 0 ? void 0 : _a.type) === 'mobile';
    };
    DeviceContext.prototype.isTabletDevice = function () {
        var _a;
        return ((_a = this.cachedDeviceContext) === null || _a === void 0 ? void 0 : _a.type) === 'tablet';
    };
    DeviceContext.prototype.isDesktopDevice = function () {
        var _a;
        return ((_a = this.cachedDeviceContext) === null || _a === void 0 ? void 0 : _a.type) === 'desktop';
    };
    DeviceContext.prototype.getScreenSize = function () {
        var _a;
        var width = ((_a = this.cachedDeviceContext) === null || _a === void 0 ? void 0 : _a.screen.width) || 0;
        if (width < 768)
            return 'small';
        if (width < 1024)
            return 'medium';
        return 'large';
    };
    return DeviceContext;
}());
var deviceContext = DeviceContext.getInstance();/**
 * Device detection utilities for Ocean Ads SDK v2
 * Privacy-safe device and browser detection without fingerprinting
 */
/**
 * Cached device info to avoid repeated calculations
 */
/**
 * Throttle and debounce utilities for Ocean Ads SDK v2
 * Performance optimization for event handlers
 */
/**
 * Throttles a function to only execute once per specified delay
 * @param func - Function to throttle
 * @param delay - Minimum time between executions in ms
 * @returns Throttled function
 */
function throttle(func, delay) {
    var lastCall = 0;
    var timeout = null;
    var lastArgs = null;
    var lastThis = null;
    return function throttled() {
        var now = Date.now();
        var args = arguments;
        lastArgs = args;
        lastThis = this;
        var remaining = delay - (now - lastCall);
        if (remaining <= 0 || remaining > delay) {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            lastCall = now;
            func.apply(this, args);
        }
        else if (!timeout) {
            timeout = window.setTimeout(function () {
                lastCall = Date.now();
                timeout = null;
                if (lastArgs) {
                    func.apply(lastThis, lastArgs);
                }
            }, remaining);
        }
    };
}var PageContext = /** @class */ (function () {
    function PageContext() {
        this.totalScrollDistance = 0;
        this.lastScrollPosition = 0;
        this.maxScrollDepth = 0;
        this.engagementStartTime = 0;
        this.totalEngagementTime = 0;
        this.isEngaged = false;
        this.pageDepth = 1;
        this.cleanupFunctions = [];
        this.SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
        this.STORAGE_KEY = 'ocean_session';
        this.pageStartTime = Date.now();
        this.lastInteractionTime = Date.now();
        this.initializeSession();
        this.setupEventListeners();
    }
    PageContext.getInstance = function () {
        if (!PageContext.instance) {
            PageContext.instance = new PageContext();
        }
        return PageContext.instance;
    };
    PageContext.prototype.initializeSession = function () {
        var storedSession = this.loadSession();
        var now = Date.now();
        if (storedSession && (now - storedSession.lastActivity) < this.SESSION_TIMEOUT) {
            this.session = storedSession;
            this.session.pageViews++;
            this.session.lastActivity = now;
            this.pageDepth = this.session.pageViews;
        }
        else {
            this.session = {
                sessionId: generateSessionId(),
                startTime: now,
                pageViews: 1,
                lastActivity: now
            };
        }
        this.saveSession();
    };
    PageContext.prototype.loadSession = function () {
        try {
            if (typeof sessionStorage === 'undefined')
                return null;
            var data = sessionStorage.getItem(this.STORAGE_KEY);
            if (!data)
                return null;
            return JSON.parse(data);
        }
        catch (e) {
            return null;
        }
    };
    PageContext.prototype.saveSession = function () {
        try {
            if (typeof sessionStorage === 'undefined')
                return;
            sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.session));
        }
        catch (e) {
            // Storage might be full or disabled
        }
    };
    PageContext.prototype.setupEventListeners = function () {
        var self = this;
        // Scroll tracking
        var handleScroll = throttle(function () {
            self.updateScrollMetrics();
        }, 100);
        this.cleanupFunctions.push(addEventListener(window, 'scroll', handleScroll, { passive: true }));
        // Interaction tracking
        var interactionEvents = ['click', 'keydown', 'touchstart', 'mousemove'];
        for (var i = 0; i < interactionEvents.length; i++) {
            var eventName = interactionEvents[i];
            var handler = throttle(function () {
                self.updateInteraction();
            }, 1000);
            this.cleanupFunctions.push(addEventListener(document, eventName, handler, { passive: true }));
        }
        // Visibility tracking
        if (typeof document.hidden !== 'undefined') {
            var handleVisibilityChange = function () {
                if (document.hidden) {
                    self.pauseEngagement();
                }
                else {
                    self.resumeEngagement();
                }
            };
            this.cleanupFunctions.push(addEventListener(document, 'visibilitychange', handleVisibilityChange));
        }
        // Initial engagement
        this.resumeEngagement();
    };
    PageContext.prototype.updateScrollMetrics = function () {
        var currentScrollPosition = window.pageYOffset || document.documentElement.scrollTop || 0;
        var scrollDistance = Math.abs(currentScrollPosition - this.lastScrollPosition);
        this.totalScrollDistance += scrollDistance;
        this.lastScrollPosition = currentScrollPosition;
        var documentHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight, document.documentElement.offsetHeight, document.body.clientHeight, document.documentElement.clientHeight);
        var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        var scrollableHeight = documentHeight - viewportHeight;
        if (scrollableHeight > 0) {
            var currentDepth = (currentScrollPosition + viewportHeight) / documentHeight;
            this.maxScrollDepth = Math.max(this.maxScrollDepth, Math.min(1, currentDepth));
        }
        this.updateInteraction();
    };
    PageContext.prototype.updateInteraction = function () {
        this.lastInteractionTime = Date.now();
        this.session.lastActivity = this.lastInteractionTime;
        if (!this.isEngaged) {
            this.resumeEngagement();
        }
    };
    PageContext.prototype.pauseEngagement = function () {
        if (this.isEngaged) {
            this.totalEngagementTime += Date.now() - this.engagementStartTime;
            this.isEngaged = false;
        }
    };
    PageContext.prototype.resumeEngagement = function () {
        if (!this.isEngaged) {
            this.engagementStartTime = Date.now();
            this.isEngaged = true;
        }
    };
    PageContext.prototype.getPageContext = function () {
        return {
            url: this.getCurrentUrl(),
            title: document.title || '',
            referrer: document.referrer || '',
            depth: this.pageDepth
        };
    };
    PageContext.prototype.getUserContext = function () {
        var now = Date.now();
        var currentEngagementTime = this.totalEngagementTime;
        if (this.isEngaged) {
            currentEngagementTime += now - this.engagementStartTime;
        }
        return {
            sessionId: this.session.sessionId,
            isNewSession: this.session.pageViews === 1,
            timeOnSite: Math.floor((now - this.session.startTime) / 1000),
            timeOnPage: Math.floor((now - this.pageStartTime) / 1000),
            scrollDepth: Math.round(this.maxScrollDepth * 100) / 100,
            totalScrollDistance: Math.round(this.totalScrollDistance),
            engagementTime: Math.floor(currentEngagementTime / 1000),
            lastInteraction: Math.floor((now - this.lastInteractionTime) / 1000)
        };
    };
    PageContext.prototype.getCurrentUrl = function () {
        return window.location.href;
    };
    PageContext.prototype.cleanup = function () {
        this.pauseEngagement();
        this.saveSession();
        for (var i = 0; i < this.cleanupFunctions.length; i++) {
            this.cleanupFunctions[i]();
        }
        this.cleanupFunctions = [];
    };
    PageContext.prototype.refresh = function () {
        this.updateScrollMetrics();
        eventBus.emit('context:collected', {
            type: 'page',
            data: {
                page: this.getPageContext(),
                user: this.getUserContext()
            }
        });
    };
    PageContext.prototype.getSessionId = function () {
        return this.session.sessionId;
    };
    PageContext.prototype.isNewSession = function () {
        return this.session.pageViews === 1;
    };
    PageContext.prototype.getPageLoadTime = function () {
        return Date.now() - this.pageStartTime;
    };
    PageContext.prototype.getEngagementRate = function () {
        var totalTime = Date.now() - this.pageStartTime;
        var engagementTime = this.totalEngagementTime;
        if (this.isEngaged) {
            engagementTime += Date.now() - this.engagementStartTime;
        }
        return totalTime > 0 ? Math.min(1, engagementTime / totalTime) : 0;
    };
    return PageContext;
}());
var pageContext = PageContext.getInstance();var ContextCollector = /** @class */ (function () {
    function ContextCollector() {
        this.capabilities = null;
        this.capabilitiesChecked = false;
        this.collectStartTime = 0;
        this.checkCapabilities();
    }
    ContextCollector.getInstance = function () {
        if (!ContextCollector.instance) {
            ContextCollector.instance = new ContextCollector();
        }
        return ContextCollector.instance;
    };
    ContextCollector.prototype.collect = function () {
        this.collectStartTime = Date.now();
        var context = {
            device: deviceContext.getDeviceContext(),
            geo: deviceContext.getGeoContext(),
            page: pageContext.getPageContext(),
            user: pageContext.getUserContext(),
            performance: deviceContext.getPerformanceContext()
        };
        var collectTime = Date.now() - this.collectStartTime;
        eventBus.emit('performance:metric', createMetric('context_collection', collectTime, 'ms'));
        eventBus.emit('context:collected', {
            type: 'full_context',
            data: context
        });
        return context;
    };
    ContextCollector.prototype.getCapabilities = function () {
        if (!this.capabilitiesChecked) {
            this.checkCapabilities();
        }
        return this.capabilities || this.getDefaultCapabilities();
    };
    ContextCollector.prototype.checkCapabilities = function () {
        this.capabilities = {
            cookiesEnabled: this.checkCookiesEnabled(),
            doNotTrack: this.checkDoNotTrack(),
            adBlocker: false // Will be set by ad blocker detection
        };
        this.capabilitiesChecked = true;
        // Async ad blocker check
        this.checkAdBlocker();
    };
    ContextCollector.prototype.checkCookiesEnabled = function () {
        try {
            if (typeof navigator.cookieEnabled !== 'undefined') {
                return navigator.cookieEnabled;
            }
            // Test by setting a cookie
            document.cookie = 'ocean_test=1';
            var cookieEnabled = document.cookie.indexOf('ocean_test') !== -1;
            // Clean up test cookie
            if (cookieEnabled) {
                document.cookie = 'ocean_test=1; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
            }
            return cookieEnabled;
        }
        catch (e) {
            return false;
        }
    };
    ContextCollector.prototype.checkDoNotTrack = function () {
        try {
            var nav = navigator;
            // Check various DNT implementations
            if (nav.doNotTrack === '1' ||
                nav.doNotTrack === 'yes' ||
                nav.msDoNotTrack === '1' ||
                window.doNotTrack === '1') {
                return true;
            }
            return false;
        }
        catch (e) {
            return false;
        }
    };
    ContextCollector.prototype.checkAdBlocker = function () {
        var self = this;
        // Method 1: Check if common ad scripts can be loaded
        var testScript = document.createElement('script');
        testScript.src = 'https://googleads.g.doubleclick.net/pagead/id';
        testScript.onerror = function () {
            self.setAdBlockerDetected(true);
        };
        // Clean up after a short delay
        window.setTimeout(function () {
            if (testScript.parentNode) {
                testScript.parentNode.removeChild(testScript);
            }
        }, 100);
        // Method 2: Check if ad-related CSS classes are hidden
        var testDiv = document.createElement('div');
        testDiv.className = 'ad advertisement adsbox ad-placement';
        testDiv.style.position = 'absolute';
        testDiv.style.left = '-9999px';
        testDiv.style.width = '1px';
        testDiv.style.height = '1px';
        document.body.appendChild(testDiv);
        window.setTimeout(function () {
            var styles = window.getComputedStyle(testDiv);
            var isHidden = styles.display === 'none' ||
                styles.visibility === 'hidden' ||
                testDiv.offsetHeight === 0;
            if (isHidden) {
                self.setAdBlockerDetected(true);
            }
            if (testDiv.parentNode) {
                testDiv.parentNode.removeChild(testDiv);
            }
        }, 10);
    };
    ContextCollector.prototype.setAdBlockerDetected = function (detected) {
        if (this.capabilities) {
            this.capabilities.adBlocker = detected;
            if (detected) {
                eventBus.emit('context:collected', {
                    type: 'capability',
                    data: { adBlocker: true }
                });
            }
        }
    };
    ContextCollector.prototype.getDefaultCapabilities = function () {
        return {
            cookiesEnabled: true,
            doNotTrack: false,
            adBlocker: false
        };
    };
    ContextCollector.prototype.refresh = function () {
        deviceContext.refresh();
        pageContext.refresh();
        this.checkCapabilities();
    };
    ContextCollector.prototype.getSessionId = function () {
        return pageContext.getSessionId();
    };
    ContextCollector.prototype.isNewSession = function () {
        return pageContext.isNewSession();
    };
    ContextCollector.prototype.getDeviceType = function () {
        return deviceContext.getDeviceContext().type;
    };
    ContextCollector.prototype.isHighPerformanceDevice = function () {
        return deviceContext.isHighPerformanceDevice();
    };
    ContextCollector.prototype.getEngagementRate = function () {
        return pageContext.getEngagementRate();
    };
    ContextCollector.prototype.getPageLoadTime = function () {
        return pageContext.getPageLoadTime();
    };
    ContextCollector.prototype.cleanup = function () {
        pageContext.cleanup();
    };
    ContextCollector.prototype.getContextSummary = function () {
        var device = deviceContext.getDeviceContext();
        var user = pageContext.getUserContext();
        return {
            deviceType: device.type,
            browser: device.browser,
            os: device.os,
            sessionId: user.sessionId,
            isNewSession: user.isNewSession,
            timeOnPage: user.timeOnPage,
            engagementTime: user.engagementTime,
            scrollDepth: user.scrollDepth
        };
    };
    ContextCollector.prototype.shouldOptimizeForPerformance = function () {
        var device = deviceContext.getDeviceContext();
        var performance = deviceContext.getPerformanceContext();
        return device.connection === '2g' ||
            device.connection === '3g' ||
            performance.connectionSpeed === 'slow' ||
            performance.pageLoadTime > 5000;
    };
    ContextCollector.prototype.getCollectionTime = function () {
        return Date.now() - this.collectStartTime;
    };
    return ContextCollector;
}());
var contextCollector = ContextCollector.getInstance();var SSEClient = /** @class */ (function () {
    function SSEClient() {
        this.activeConnections = new Map();
        this.requestTimeouts = new Map();
    }
    SSEClient.prototype.requestAds = function (apiUrl_1, payload_1) {
        return __awaiter(this, arguments, void 0, function (apiUrl, payload, timeout) {
            var requestStartTime, initResponse, sseUrl, error_1;
            if (timeout === void 0) { timeout = 250; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        requestStartTime = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, this.sendInitialRequest(apiUrl, payload)];
                    case 2:
                        initResponse = _a.sent();
                        if (!initResponse.sseUrl) {
                            throw createError('SSE_FAILED', 'No SSE URL provided in response', { response: initResponse });
                        }
                        sseUrl = this.buildSSEUrl(apiUrl, initResponse.sseUrl);
                        return [4 /*yield*/, this.connectSSE(sseUrl, initResponse.requestId, timeout, requestStartTime)];
                    case 3: return [2 /*return*/, _a.sent()];
                    case 4:
                        error_1 = _a.sent();
                        if (error_1.code && error_1.code.startsWith('SSE_')) {
                            throw error_1;
                        }
                        throw createError('REQUEST_FAILED', 'Failed to request ads', { originalError: error_1 });
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    SSEClient.prototype.sendInitialRequest = function (apiUrl, payload) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch(apiUrl + '/rtb/bid-request', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(payload)
                        })];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            throw createError('REQUEST_FAILED', 'Initial request failed: ' + response.statusText, { status: response.status });
                        }
                        return [2 /*return*/, response.json()];
                }
            });
        });
    };
    SSEClient.prototype.buildSSEUrl = function (apiUrl, sseUrl) {
        if (sseUrl.startsWith('http')) {
            return sseUrl;
        }
        var baseUrl = apiUrl.replace(/\/$/, '');
        var path = sseUrl.startsWith('/') ? sseUrl : '/' + sseUrl;
        return baseUrl + path;
    };
    SSEClient.prototype.connectSSE = function (url, requestId, timeout, startTime) {
        var self = this;
        return new Promise(function (resolve, reject) {
            var eventSource = null;
            var timeoutId = null;
            var isResolved = false;
            function cleanup() {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    self.requestTimeouts.delete(requestId);
                }
                if (eventSource) {
                    eventSource.close();
                    self.activeConnections.delete(requestId);
                }
            }
            function handleComplete(data) {
                if (isResolved)
                    return;
                isResolved = true;
                var responseTime = Date.now() - startTime;
                eventBus.emit('performance:metric', {
                    metric: 'sse_response_time',
                    value: responseTime,
                    unit: 'ms'
                });
                cleanup();
                resolve(data);
            }
            function handleError(error) {
                if (isResolved)
                    return;
                isResolved = true;
                cleanup();
                reject(error);
            }
            try {
                eventSource = new EventSource(url);
                self.activeConnections.set(requestId, eventSource);
                eventSource.addEventListener('bid_update', function (event) {
                    try {
                        var update = JSON.parse(event.data);
                        eventBus.emit('request:bid_update', {
                            requestId: requestId,
                            status: update.status,
                            progress: update.progress
                        });
                    }
                    catch (e) {
                        // Invalid update data
                    }
                });
                eventSource.addEventListener('bid_complete', function (event) {
                    try {
                        var response = JSON.parse(event.data);
                        handleComplete(response);
                    }
                    catch (e) {
                        handleError(createError('SSE_FAILED', 'Invalid bid_complete data', { data: event.data }));
                    }
                });
                eventSource.addEventListener('error', function () {
                    if (eventSource.readyState === EventSource.CLOSED) {
                        handleError(createError('SSE_FAILED', 'SSE connection closed unexpectedly', { readyState: EventSource.CLOSED }));
                    }
                });
                eventSource.onerror = function () {
                    handleError(createError('SSE_FAILED', 'SSE connection error', { url: url }));
                };
                timeoutId = window.setTimeout(function () {
                    handleError(createError('SSE_TIMEOUT', 'SSE response timeout after ' + timeout + 'ms', { timeout: timeout }));
                }, timeout);
                self.requestTimeouts.set(requestId, timeoutId);
            }
            catch (error) {
                handleError(createError('SSE_FAILED', 'Failed to create EventSource', { originalError: error }));
            }
        });
    };
    SSEClient.prototype.isSupported = function () {
        return typeof EventSource !== 'undefined';
    };
    SSEClient.prototype.closeConnection = function (requestId) {
        var connection = this.activeConnections.get(requestId);
        if (connection) {
            connection.close();
            this.activeConnections.delete(requestId);
        }
        var timeoutId = this.requestTimeouts.get(requestId);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this.requestTimeouts.delete(requestId);
        }
    };
    SSEClient.prototype.closeAllConnections = function () {
        var self = this;
        this.activeConnections.forEach(function (_connection, requestId) {
            self.closeConnection(requestId);
        });
    };
    SSEClient.prototype.getActiveConnectionCount = function () {
        return this.activeConnections.size;
    };
    return SSEClient;
}());var FallbackClient = /** @class */ (function () {
    function FallbackClient() {
        this.POLL_INTERVAL = 50;
        this.MAX_POLLS = 10;
        this.activeRequests = new Map();
    }
    FallbackClient.prototype.requestAds = function (apiUrl_1, payload_1) {
        return __awaiter(this, arguments, void 0, function (apiUrl, payload, timeout) {
            var requestStartTime, controller, requestId, timeoutId, initResponse, response, totalTime, error_1;
            var _this = this;
            if (timeout === void 0) { timeout = 500; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        requestStartTime = Date.now();
                        controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
                        requestId = payload.meta.requestId;
                        timeoutId = null;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, 5, 6]);
                        return [4 /*yield*/, this.sendInitialRequest(apiUrl, payload, controller)];
                    case 2:
                        initResponse = _a.sent();
                        if (!initResponse.requestId) {
                            throw createError('REQUEST_FAILED', 'No request ID in response', { response: initResponse });
                        }
                        timeoutId = window.setTimeout(function () {
                            _this.cancelRequest(requestId);
                        }, timeout);
                        if (controller) {
                            this.activeRequests.set(requestId, { controller: controller, timeoutId: timeoutId });
                        }
                        return [4 /*yield*/, this.pollForResponse(apiUrl, initResponse.requestId, controller, timeout - (Date.now() - requestStartTime))];
                    case 3:
                        response = _a.sent();
                        totalTime = Date.now() - requestStartTime;
                        eventBus.emit('performance:metric', {
                            metric: 'fallback_response_time',
                            value: totalTime,
                            unit: 'ms'
                        });
                        return [2 /*return*/, response];
                    case 4:
                        error_1 = _a.sent();
                        if (error_1.name === 'AbortError') {
                            throw createError('REQUEST_TIMEOUT', 'Request aborted due to timeout', { timeout: timeout });
                        }
                        if (error_1.code) {
                            throw error_1;
                        }
                        throw createError('REQUEST_FAILED', 'Fallback request failed', { originalError: error_1 });
                    case 5:
                        this.cleanupRequest(requestId);
                        return [7 /*endfinally*/];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    FallbackClient.prototype.sendInitialRequest = function (apiUrl, payload, controller) {
        return __awaiter(this, void 0, void 0, function () {
            var options, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(payload)
                        };
                        if (controller) {
                            options.signal = controller.signal;
                        }
                        return [4 /*yield*/, fetch(apiUrl + '/rtb/bid-request', options)];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            throw createError('REQUEST_FAILED', 'Initial request failed: ' + response.statusText, { status: response.status });
                        }
                        return [2 /*return*/, response.json()];
                }
            });
        });
    };
    FallbackClient.prototype.pollForResponse = function (apiUrl, requestId, controller, remainingTimeout) {
        return __awaiter(this, void 0, void 0, function () {
            var pollCount, pollStartTime, response, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        pollCount = 0;
                        pollStartTime = Date.now();
                        _a.label = 1;
                    case 1:
                        if (!(pollCount < this.MAX_POLLS)) return [3 /*break*/, 8];
                        if (Date.now() - pollStartTime > remainingTimeout) {
                            throw createError('REQUEST_TIMEOUT', 'Polling timeout exceeded', { timeout: remainingTimeout });
                        }
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.checkResponse(apiUrl, requestId, controller)];
                    case 3:
                        response = _a.sent();
                        if (response && response.meta && response.slots) {
                            return [2 /*return*/, response];
                        }
                        if (response && response.status === 'processing') {
                            eventBus.emit('request:bid_update', {
                                requestId: requestId,
                                status: 'processing',
                                progress: pollCount / this.MAX_POLLS
                            });
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _a.sent();
                        if (error_2.name === 'AbortError') {
                            throw error_2;
                        }
                        return [3 /*break*/, 5];
                    case 5:
                        pollCount++;
                        if (!(pollCount < this.MAX_POLLS)) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.sleep(this.POLL_INTERVAL)];
                    case 6:
                        _a.sent();
                        _a.label = 7;
                    case 7: return [3 /*break*/, 1];
                    case 8: throw createError('REQUEST_TIMEOUT', 'Max polling attempts reached', { attempts: pollCount });
                }
            });
        });
    };
    FallbackClient.prototype.checkResponse = function (apiUrl, requestId, controller) {
        return __awaiter(this, void 0, void 0, function () {
            var options, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = {
                            method: 'GET',
                            headers: {
                                'Accept': 'application/json'
                            }
                        };
                        if (controller) {
                            options.signal = controller.signal;
                        }
                        return [4 /*yield*/, fetch(apiUrl + '/rtb/bid-response/' + requestId, options)];
                    case 1:
                        response = _a.sent();
                        if (response.status === 202) {
                            return [2 /*return*/, { status: 'processing' }];
                        }
                        if (response.ok) {
                            return [2 /*return*/, response.json()];
                        }
                        return [2 /*return*/, null];
                }
            });
        });
    };
    FallbackClient.prototype.sleep = function (ms) {
        return new Promise(function (resolve) {
            setTimeout(resolve, ms);
        });
    };
    FallbackClient.prototype.cancelRequest = function (requestId) {
        var request = this.activeRequests.get(requestId);
        if (request) {
            request.controller.abort();
        }
    };
    FallbackClient.prototype.cleanupRequest = function (requestId) {
        var request = this.activeRequests.get(requestId);
        if (request) {
            if (request.timeoutId) {
                clearTimeout(request.timeoutId);
            }
            this.activeRequests.delete(requestId);
        }
    };
    FallbackClient.prototype.isSupported = function () {
        return typeof fetch !== 'undefined';
    };
    FallbackClient.prototype.cancelAllRequests = function () {
        var self = this;
        this.activeRequests.forEach(function (_request, requestId) {
            self.cancelRequest(requestId);
        });
        this.activeRequests.clear();
    };
    FallbackClient.prototype.getActiveRequestCount = function () {
        return this.activeRequests.size;
    };
    return FallbackClient;
}());var RequestManager = /** @class */ (function () {
    function RequestManager() {
        this.MIN_REQUEST_INTERVAL = 100;
        this.sseClient = new SSEClient();
        this.fallbackClient = new FallbackClient();
        this.requestQueue = [];
        this.isProcessing = false;
        this.activeRequests = new Map();
        this.lastRequestTime = 0;
        this.setupEventHandlers();
    }
    RequestManager.getInstance = function () {
        if (!RequestManager.instance) {
            RequestManager.instance = new RequestManager();
        }
        return RequestManager.instance;
    };
    RequestManager.prototype.setupEventHandlers = function () {
        var self = this;
        eventBus.on('slot:discovered', function () {
            self.scheduleBatchRequest();
        });
        eventBus.on('slot:refresh', function (event) {
            var slot = slotManager.getSlotById(event.data.slotId);
            if (slot) {
                self.requestAdsForSlots([slot]);
            }
        });
    };
    RequestManager.prototype.requestAdsForSlots = function (slots) {
        var validSlots = this.validateSlots(slots);
        if (validSlots.length === 0) {
            return Promise.reject(createError('SLOT_INVALID', 'No valid slots to request ads for'));
        }
        return this.queueRequest(validSlots);
    };
    RequestManager.prototype.validateSlots = function (slots) {
        return slots.filter(function (slot) {
            if (slot.state === 'requesting' || slot.state === 'refreshing') {
                return false;
            }
            if (!slot.element.offsetParent) {
                return false;
            }
            var refreshConfig = configManager.getRefreshConfig(slot.inventoryId);
            if (!(refreshConfig === null || refreshConfig === void 0 ? void 0 : refreshConfig.enabled) && slot.refresh.count > 0) {
                return false;
            }
            return true;
        });
    };
    RequestManager.prototype.queueRequest = function (slots) {
        var self = this;
        return new Promise(function (resolve, reject) {
            var queueItem = {
                id: generateRequestId(),
                slots: slots,
                payload: null,
                retries: 0,
                createdAt: Date.now(),
                callbacks: { resolve: resolve, reject: reject }
            };
            self.requestQueue.push(queueItem);
            self.scheduleBatchRequest();
        });
    };
    RequestManager.prototype.scheduleBatchRequest = function () {
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }
        var batchDelay = configManager.getBatchDelay();
        var self = this;
        this.batchTimer = window.setTimeout(function () {
            self.processBatch();
        }, batchDelay);
    };
    RequestManager.prototype.processBatch = function () {
        return __awaiter(this, void 0, void 0, function () {
            var batch, mergedSlots, request, queueItem, response, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.isProcessing || this.requestQueue.length === 0) {
                            return [2 /*return*/];
                        }
                        this.isProcessing = true;
                        batch = this.requestQueue.splice(0, this.requestQueue.length);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, 4, 5]);
                        mergedSlots = this.mergeBatchSlots(batch);
                        if (mergedSlots.length === 0) {
                            this.rejectBatch(batch, createError('SLOT_INVALID', 'No valid slots in batch'));
                            return [2 /*return*/];
                        }
                        request = this.buildRequest(mergedSlots);
                        queueItem = this.createMergedQueueItem(batch, request);
                        this.activeRequests.set(request.meta.requestId, queueItem);
                        mergedSlots.forEach(function (slot) {
                            slotManager.updateSlotState(slot.id, 'requesting');
                        });
                        eventBus.emit('request:batch:start', {
                            requestId: request.meta.requestId,
                            slotCount: mergedSlots.length
                        });
                        return [4 /*yield*/, this.executeRequest(request)];
                    case 2:
                        response = _a.sent();
                        this.handleResponse(response, queueItem);
                        return [3 /*break*/, 5];
                    case 3:
                        error_1 = _a.sent();
                        this.handleBatchError(batch, error_1);
                        return [3 /*break*/, 5];
                    case 4:
                        this.isProcessing = false;
                        if (this.requestQueue.length > 0) {
                            this.scheduleBatchRequest();
                        }
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    RequestManager.prototype.mergeBatchSlots = function (batch) {
        var slotMap = new Map();
        batch.forEach(function (item) {
            item.slots.forEach(function (slot) {
                if (!slotMap.has(slot.id)) {
                    slotMap.set(slot.id, slot);
                }
            });
        });
        return Array.from(slotMap.values());
    };
    RequestManager.prototype.buildRequest = function (slots) {
        var config = configManager.getConfig();
        if (!config) {
            throw createError('CONFIG_MISSING', 'Configuration not loaded');
        }
        var context = contextCollector.collect();
        var capabilities = contextCollector.getCapabilities();
        var requestSlots = slots.map(function (slot) {
            return {
                inventoryId: slot.inventoryId,
                elementId: slot.elementId,
                refresh: {
                    enabled: slot.refresh.enabled,
                    count: slot.refresh.count
                }
            };
        });
        return {
            meta: {
                version: '2.0',
                requestId: generateRequestId(),
                publisherId: config.publisher.id,
                websiteId: config.website.id,
                timestamp: Date.now()
            },
            slots: requestSlots,
            context: context,
            capabilities: capabilities
        };
    };
    RequestManager.prototype.createMergedQueueItem = function (batch, request) {
        var mergedSlots = [];
        var callbacks = [];
        batch.forEach(function (item) {
            mergedSlots = mergedSlots.concat(item.slots);
            callbacks.push(item.callbacks);
        });
        return {
            id: request.meta.requestId,
            slots: mergedSlots,
            payload: request,
            retries: 0,
            createdAt: Date.now(),
            callbacks: {
                resolve: function (response) {
                    callbacks.forEach(function (cb) {
                        cb.resolve(response);
                    });
                },
                reject: function (error) {
                    callbacks.forEach(function (cb) {
                        cb.reject(error);
                    });
                }
            }
        };
    };
    RequestManager.prototype.executeRequest = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var apiUrl, timeout, now, timeSinceLastRequest, fallbackTimeout, error_2, retryTimeout;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        apiUrl = configManager.getApiUrl();
                        timeout = configManager.getSSETimeout();
                        now = Date.now();
                        timeSinceLastRequest = now - this.lastRequestTime;
                        if (!(timeSinceLastRequest < this.MIN_REQUEST_INTERVAL)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.sleep(this.MIN_REQUEST_INTERVAL - timeSinceLastRequest)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        this.lastRequestTime = Date.now();
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 8, , 11]);
                        if (!this.sseClient.isSupported()) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.sseClient.requestAds(apiUrl, request, timeout)];
                    case 4: return [2 /*return*/, _a.sent()];
                    case 5:
                        eventBus.emit('request:fallback', {
                            reason: 'SSE not supported',
                            requestId: request.meta.requestId
                        });
                        fallbackTimeout = configManager.getFallbackTimeout();
                        return [4 /*yield*/, this.fallbackClient.requestAds(apiUrl, request, fallbackTimeout)];
                    case 6: return [2 /*return*/, _a.sent()];
                    case 7: return [3 /*break*/, 11];
                    case 8:
                        error_2 = _a.sent();
                        if (!(error_2.code === 'SSE_FAILED' || error_2.code === 'SSE_TIMEOUT')) return [3 /*break*/, 10];
                        eventBus.emit('request:fallback', {
                            reason: error_2.message,
                            requestId: request.meta.requestId
                        });
                        retryTimeout = configManager.getFallbackTimeout();
                        return [4 /*yield*/, this.fallbackClient.requestAds(apiUrl, request, retryTimeout)];
                    case 9: return [2 /*return*/, _a.sent()];
                    case 10: throw error_2;
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    RequestManager.prototype.handleResponse = function (response, queueItem) {
        this.activeRequests.delete(response.meta.requestId);
        var slotResponseMap = new Map();
        response.slots.forEach(function (slotResponse) {
            slotResponseMap.set(slotResponse.inventoryId, slotResponse);
        });
        queueItem.slots.forEach(function (slot) {
            var slotResponse = slotResponseMap.get(slot.inventoryId);
            if (slotResponse) {
                if (slotResponse.status === 'filled') {
                    slotManager.updateSlotState(slot.id, 'received');
                }
                else {
                    slot.lastError = createError('SLOT_NOT_FOUND', 'No bid for slot', { status: slotResponse.status });
                    slotManager.updateSlotState(slot.id, 'failed');
                }
            }
            else {
                slot.lastError = createError('SLOT_NOT_FOUND', 'No response for slot', { inventoryId: slot.inventoryId });
                slotManager.updateSlotState(slot.id, 'failed');
            }
        });
        eventBus.emit('request:batch:complete', {
            requestId: response.meta.requestId,
            processingTime: response.meta.processingTime,
            successCount: response.slots.filter(function (s) { return s.status === 'filled'; }).length,
            totalCount: response.slots.length
        });
        queueItem.callbacks.resolve(response);
    };
    RequestManager.prototype.handleBatchError = function (batch, error) {
        var sdkError = error.code ? error : createError('REQUEST_FAILED', 'Batch request failed', { originalError: error });
        batch.forEach(function (item) {
            item.slots.forEach(function (slot) {
                slot.lastError = sdkError;
                slotManager.updateSlotState(slot.id, 'failed');
            });
        });
        this.rejectBatch(batch, sdkError);
    };
    RequestManager.prototype.rejectBatch = function (batch, error) {
        batch.forEach(function (item) {
            item.callbacks.reject(error);
        });
    };
    RequestManager.prototype.sleep = function (ms) {
        return new Promise(function (resolve) {
            setTimeout(resolve, ms);
        });
    };
    RequestManager.prototype.cancelAllRequests = function () {
        this.sseClient.closeAllConnections();
        this.fallbackClient.cancelAllRequests();
        this.activeRequests.forEach(function (queueItem) {
            queueItem.callbacks.reject(createError('REQUEST_FAILED', 'Request cancelled'));
        });
        this.activeRequests.clear();
        this.requestQueue = [];
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = undefined;
        }
    };
    RequestManager.prototype.getMetrics = function () {
        return {
            queueLength: this.requestQueue.length,
            activeRequests: this.activeRequests.size,
            isProcessing: this.isProcessing,
            sseConnections: this.sseClient.getActiveConnectionCount(),
            fallbackRequests: this.fallbackClient.getActiveRequestCount()
        };
    };
    RequestManager.prototype.retryFailedSlots = function () {
        var failedSlots = slotManager.getAllSlots().filter(function (slot) {
            return slot.state === 'failed' && slot.lastError;
        });
        if (failedSlots.length > 0) {
            var maxRetries = configManager.getMaxRetries();
            var self = this;
            var slotsToRetry = failedSlots.filter(function (slot) {
                var queueItem = Array.from(self.activeRequests.values()).find(function (item) {
                    return item.slots.some(function (s) { return s.id === slot.id; });
                });
                return !queueItem || queueItem.retries < maxRetries;
            });
            if (slotsToRetry.length > 0) {
                this.requestAdsForSlots(slotsToRetry);
            }
        }
    };
    RequestManager.prototype.scheduleRefresh = function (slot, delay) {
        if (!slot.refresh.enabled)
            return;
        if (slot.refresh.timer) {
            clearTimeout(slot.refresh.timer);
        }
        slot.refresh.timer = window.setTimeout(function () {
            slot.refresh.count++;
            slotManager.updateSlotState(slot.id, 'refreshing');
            eventBus.emit('slot:refresh', {
                slotId: slot.id,
                inventoryId: slot.inventoryId,
                refreshCount: slot.refresh.count
            });
        }, delay);
    };
    RequestManager.prototype.requestAds = function (slots, _context) {
        return this.requestAdsForSlots(slots);
    };
    RequestManager.prototype.cleanup = function () {
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = undefined;
        }
        this.requestQueue = [];
        this.activeRequests.clear();
        this.isProcessing = false;
    };
    return RequestManager;
}());
var requestManager = RequestManager.getInstance();var SlotRenderer = /** @class */ (function () {
    function SlotRenderer() {
        this.clickHandlers = new Map();
    }
    SlotRenderer.prototype.render = function (slot, creative, bid) {
        return __awaiter(this, void 0, void 0, function () {
            var renderStartTime, _a, renderTime, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        renderStartTime = Date.now();
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 11, , 12]);
                        this.clearSlot(slot);
                        _a = creative.type;
                        switch (_a) {
                            case 'banner': return [3 /*break*/, 2];
                            case 'native': return [3 /*break*/, 4];
                            case 'video': return [3 /*break*/, 6];
                        }
                        return [3 /*break*/, 8];
                    case 2: return [4 /*yield*/, this.renderBanner(slot, creative, bid)];
                    case 3:
                        _b.sent();
                        return [3 /*break*/, 10];
                    case 4: return [4 /*yield*/, this.renderNative(slot, creative, bid)];
                    case 5:
                        _b.sent();
                        return [3 /*break*/, 10];
                    case 6: return [4 /*yield*/, this.renderVideo(slot, creative, bid)];
                    case 7:
                        _b.sent();
                        return [3 /*break*/, 10];
                    case 8: return [4 /*yield*/, this.renderBanner(slot, creative, bid)];
                    case 9:
                        _b.sent();
                        _b.label = 10;
                    case 10:
                        this.setupTracking(slot, creative, bid);
                        renderTime = Date.now() - renderStartTime;
                        if (renderTime > 10) {
                            eventBus.emit('performance:metric', {
                                metric: 'slow_render',
                                value: renderTime,
                                unit: 'ms'
                            });
                        }
                        return [3 /*break*/, 12];
                    case 11:
                        error_1 = _b.sent();
                        throw createError('RENDER_FAILED', 'Failed to render creative', { creativeType: creative.type, error: error_1 });
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    SlotRenderer.prototype.renderFallback = function (slot, fallback) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                try {
                    this.clearSlot(slot);
                    if (fallback.type === 'google' && fallback.markup) {
                        this.renderGoogleFallback(slot, fallback.markup);
                    }
                    else if (fallback.type === 'house' && fallback.markup) {
                        this.renderHouseFallback(slot, fallback.markup);
                    }
                    else {
                        slot.element.style.display = 'none';
                    }
                }
                catch (error) {
                    throw createError('RENDER_FAILED', 'Failed to render fallback', { fallbackType: fallback.type, error: error });
                }
                return [2 /*return*/];
            });
        });
    };
    SlotRenderer.prototype.clearSlot = function (slot) {
        var clickHandler = this.clickHandlers.get(slot.id);
        if (clickHandler) {
            this.clickHandlers.delete(slot.id);
        }
        slot.element.innerHTML = '';
        slot.element.style.display = '';
    };
    SlotRenderer.prototype.renderBanner = function (slot, creative, bid) {
        return __awaiter(this, void 0, void 0, function () {
            var container, img;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        container = this.createContainer(slot, creative);
                        if (!this.isImageMarkup(creative.markup)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.createImageElement(creative.markup, creative.width, creative.height)];
                    case 1:
                        img = _a.sent();
                        container.appendChild(img);
                        return [3 /*break*/, 3];
                    case 2:
                        container.innerHTML = creative.markup;
                        _a.label = 3;
                    case 3:
                        this.applyStyles(container, creative);
                        slot.element.appendChild(container);
                        if (bid) {
                            container.setAttribute('data-bid-id', bid.bidId);
                            container.setAttribute('data-campaign-id', bid.campaignId);
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    SlotRenderer.prototype.renderNative = function (slot, creative, _bid) {
        return __awaiter(this, void 0, void 0, function () {
            var container, nativeData, nativeElement;
            return __generator(this, function (_a) {
                container = this.createContainer(slot, creative);
                container.className += ' ocean-native-ad';
                try {
                    nativeData = this.parseNativeMarkup(creative.markup);
                    nativeElement = this.buildNativeElement(nativeData);
                    container.appendChild(nativeElement);
                }
                catch (e) {
                    container.innerHTML = creative.markup;
                }
                this.applyStyles(container, creative);
                slot.element.appendChild(container);
                return [2 /*return*/];
            });
        });
    };
    SlotRenderer.prototype.renderVideo = function (slot, creative, _bid) {
        return __awaiter(this, void 0, void 0, function () {
            var container, video;
            return __generator(this, function (_a) {
                container = this.createContainer(slot, creative);
                container.className += ' ocean-video-ad';
                if (this.isVideoUrl(creative.markup)) {
                    video = this.createVideoElement(creative.markup, creative.width, creative.height);
                    container.appendChild(video);
                }
                else {
                    container.innerHTML = creative.markup;
                }
                this.applyStyles(container, creative);
                slot.element.appendChild(container);
                return [2 /*return*/];
            });
        });
    };
    SlotRenderer.prototype.renderGoogleFallback = function (slot, markup) {
        var container = createElement('div', {
            className: 'ocean-fallback-google',
            'data-slot-id': slot.id
        });
        container.innerHTML = markup;
        slot.element.appendChild(container);
        this.executeInlineScripts(container);
    };
    SlotRenderer.prototype.renderHouseFallback = function (slot, markup) {
        var container = createElement('div', {
            className: 'ocean-fallback-house',
            'data-slot-id': slot.id
        });
        container.innerHTML = markup;
        slot.element.appendChild(container);
    };
    SlotRenderer.prototype.createContainer = function (slot, creative) {
        return createElement('div', {
            className: 'ocean-ad-container',
            'data-slot-id': slot.id,
            'data-creative-type': creative.type,
            style: 'position:relative;width:' + creative.width + 'px;height:' + creative.height + 'px;'
        });
    };
    SlotRenderer.prototype.isImageMarkup = function (markup) {
        return /^https?:\/\/.*\.(jpg|jpeg|png|gif|webp)$/i.test(markup.trim());
    };
    SlotRenderer.prototype.createImageElement = function (src, width, height) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        var img = createElement('img', {
                            src: src,
                            width: width,
                            height: height,
                            alt: '',
                            style: 'display:block;width:100%;height:100%;object-fit:contain;'
                        });
                        img.onload = function () {
                            resolve(img);
                        };
                        img.onerror = function () {
                            reject(new Error('Failed to load image'));
                        };
                        setTimeout(function () {
                            reject(new Error('Image load timeout'));
                        }, 5000);
                    })];
            });
        });
    };
    SlotRenderer.prototype.isVideoUrl = function (markup) {
        return /^https?:\/\/.*\.(mp4|webm|ogg)$/i.test(markup.trim());
    };
    SlotRenderer.prototype.createVideoElement = function (src, width, height) {
        return createElement('video', {
            src: src,
            width: width,
            height: height,
            controls: 'true',
            muted: 'true',
            playsinline: 'true',
            style: 'display:block;width:100%;height:100%;'
        });
    };
    SlotRenderer.prototype.parseNativeMarkup = function (markup) {
        try {
            return JSON.parse(markup);
        }
        catch (e) {
            return {
                title: '',
                description: '',
                image: '',
                cta: 'Learn More'
            };
        }
    };
    SlotRenderer.prototype.buildNativeElement = function (data) {
        var wrapper = createElement('div', { className: 'ocean-native-wrapper' });
        if (data.title) {
            wrapper.appendChild(createElement('h3', {
                className: 'ocean-native-title'
            }, [data.title]));
        }
        if (data.image) {
            wrapper.appendChild(createElement('img', {
                src: data.image,
                className: 'ocean-native-image',
                alt: data.title || ''
            }));
        }
        if (data.description) {
            wrapper.appendChild(createElement('p', {
                className: 'ocean-native-description'
            }, [data.description]));
        }
        if (data.cta) {
            wrapper.appendChild(createElement('span', {
                className: 'ocean-native-cta'
            }, [data.cta]));
        }
        return wrapper;
    };
    SlotRenderer.prototype.applyStyles = function (container, creative) {
        if (!container.style.width) {
            container.style.width = creative.width + 'px';
        }
        if (!container.style.height) {
            container.style.height = creative.height + 'px';
        }
        container.style.overflow = 'hidden';
        container.style.position = 'relative';
    };
    SlotRenderer.prototype.setupTracking = function (slot, creative, bid) {
        if (creative.trackers.impression) {
            this.fireImpressionPixel(creative.trackers.impression, slot.id);
        }
        if (creative.trackers.click) {
            this.setupClickTracking(slot, creative.trackers.click, bid);
        }
    };
    SlotRenderer.prototype.fireImpressionPixel = function (url, slotId) {
        var pixel = createElement('img', {
            src: url + (url.indexOf('?') > -1 ? '&' : '?') + 't=' + Date.now(),
            width: 1,
            height: 1,
            style: 'position:absolute;left:-9999px;top:-9999px;'
        });
        document.body.appendChild(pixel);
        setTimeout(function () {
            if (pixel.parentNode) {
                pixel.parentNode.removeChild(pixel);
            }
        }, 1000);
        eventBus.emit('impression:tracked', {
            slotId: slotId,
            timestamp: Date.now()
        });
    };
    SlotRenderer.prototype.setupClickTracking = function (slot, clickUrl, bid) {
        var self = this;
        var container = slot.element.querySelector('.ocean-ad-container');
        if (!container)
            return;
        var links = container.querySelectorAll('a');
        for (var i = 0; i < links.length; i++) {
            this.wrapClickTracking(links[i], clickUrl, slot.id, bid);
        }
        if (links.length === 0) {
            var clickHandler = function (event) {
                event.preventDefault();
                event.stopPropagation();
                self.trackClick(clickUrl, slot.id, bid);
                if (bid && links.length > 0) {
                    window.open(links[0].href, '_blank');
                }
            };
            addEventListener(container, 'click', clickHandler);
            this.clickHandlers.set(slot.id, clickHandler);
        }
    };
    SlotRenderer.prototype.wrapClickTracking = function (link, clickUrl, slotId, bid) {
        var self = this;
        var originalHref = link.href;
        addEventListener(link, 'click', function (event) {
            event.preventDefault();
            self.trackClick(clickUrl, slotId, bid);
            window.open(originalHref, link.target || '_blank');
        });
    };
    SlotRenderer.prototype.trackClick = function (clickUrl, slotId, bid) {
        var _a;
        var trackingUrl = clickUrl + (clickUrl.indexOf('?') > -1 ? '&' : '?') +
            't=' + Date.now();
        if (bid) {
            trackingUrl += '&bid=' + bid.bidId + '&cmp=' + bid.campaignId;
        }
        var img = new Image();
        img.src = trackingUrl;
        eventBus.emit('click:tracked', {
            slotId: slotId,
            bidId: bid === null || bid === void 0 ? void 0 : bid.bidId,
            timestamp: Date.now()
        });
        eventBus.emit('slot:click', {
            slotId: slotId,
            inventoryId: (_a = slotManager.getSlotById(slotId)) === null || _a === void 0 ? void 0 : _a.inventoryId
        });
    };
    SlotRenderer.prototype.executeInlineScripts = function (container) {
        var scripts = container.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
            var script = scripts[i];
            if (!script.src && script.innerHTML) {
                try {
                    var func = new Function(script.innerHTML);
                    func();
                }
                catch (e) {
                    // Script execution failed
                }
            }
        }
    };
    SlotRenderer.prototype.cleanup = function () {
        this.clickHandlers.clear();
    };
    return SlotRenderer;
}());var SafeFrame = /** @class */ (function () {
    function SafeFrame() {
        this.FRAME_TIMEOUT = 3000;
        this.frames = new Map();
        this.frameConfigs = new Map();
        this.messageHandlers = new Map();
        this.setupGlobalMessageHandler();
    }
    SafeFrame.prototype.render = function (slot, creative, bid) {
        return __awaiter(this, void 0, void 0, function () {
            var frameId, config, iframe, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        frameId = this.generateFrameId(slot.id);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        this.cleanup(slot.id);
                        config = {
                            id: frameId,
                            src: this.generateFrameSrc(),
                            width: creative.width,
                            height: creative.height,
                            content: this.wrapCreativeContent(creative, bid)
                        };
                        this.frameConfigs.set(frameId, config);
                        return [4 /*yield*/, this.createFrame(slot, config)];
                    case 2:
                        iframe = _a.sent();
                        this.frames.set(slot.id, iframe);
                        return [4 /*yield*/, this.initializeFrame(iframe, config)];
                    case 3:
                        _a.sent();
                        this.setupFrameTracking(slot, creative, frameId);
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        this.cleanup(slot.id);
                        throw createError('RENDER_FAILED', 'SafeFrame render failed', { frameId: frameId, error: error_1 });
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    SafeFrame.prototype.generateFrameId = function (slotId) {
        return 'sf_' + slotId + '_' + generateUniqueId();
    };
    SafeFrame.prototype.generateFrameSrc = function () {
        return 'about:blank';
    };
    SafeFrame.prototype.wrapCreativeContent = function (creative, bid) {
        var metadata = {
            width: creative.width,
            height: creative.height,
            type: creative.type,
            bidId: bid === null || bid === void 0 ? void 0 : bid.bidId,
            campaignId: bid === null || bid === void 0 ? void 0 : bid.campaignId,
            trackers: creative.trackers
        };
        return '<!DOCTYPE html>' +
            '<html>' +
            '<head>' +
            '<meta charset="utf-8">' +
            '<style>' +
            'body{margin:0;padding:0;overflow:hidden;}' +
            '.sf-content{width:' + creative.width + 'px;height:' + creative.height + 'px;}' +
            '</style>' +
            '<script>' +
            'window.SF_METADATA=' + JSON.stringify(metadata) + ';' +
            'window.SF_API={' +
            'resize:function(w,h){parent.postMessage({cmd:"resize",width:w,height:h,id:"' + metadata.bidId + '"},"*");},' +
            'track:function(type,data){parent.postMessage({cmd:"track",type:type,data:data,id:"' + metadata.bidId + '"},"*");}' +
            '};' +
            '</script>' +
            '</head>' +
            '<body>' +
            '<div class="sf-content">' + creative.markup + '</div>' +
            '<script>' +
            '(function(){' +
            'var meta=window.SF_METADATA;' +
            'if(meta.trackers&&meta.trackers.impression){' +
            'var img=new Image();img.src=meta.trackers.impression;' +
            '}' +
            'document.addEventListener("click",function(e){' +
            'if(meta.trackers&&meta.trackers.click){' +
            'var img=new Image();img.src=meta.trackers.click;' +
            'window.SF_API.track("click",{target:e.target.tagName});' +
            '}' +
            '});' +
            '})();' +
            '</script>' +
            '</body>' +
            '</html>';
    };
    SafeFrame.prototype.createFrame = function (slot, config) {
        return __awaiter(this, void 0, void 0, function () {
            var iframe;
            return __generator(this, function (_a) {
                iframe = createElement('iframe', {
                    id: config.id,
                    width: config.width,
                    height: config.height,
                    frameBorder: '0',
                    scrolling: 'no',
                    marginWidth: '0',
                    marginHeight: '0',
                    sandbox: 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox',
                    style: 'display:block;border:0;overflow:hidden;'
                });
                slot.element.innerHTML = '';
                slot.element.appendChild(iframe);
                return [2 /*return*/, iframe];
            });
        });
    };
    SafeFrame.prototype.initializeFrame = function (iframe, config) {
        var self = this;
        return new Promise(function (resolve, reject) {
            var timeoutId = setTimeout(function () {
                reject(new Error('Frame initialization timeout'));
            }, self.FRAME_TIMEOUT);
            var messageHandler = function (event) {
                if (event.data && event.data.cmd === 'ready' && event.data.frameId === config.id) {
                    clearTimeout(timeoutId);
                    self.messageHandlers.delete(config.id);
                    resolve();
                }
            };
            self.messageHandlers.set(config.id, messageHandler);
            try {
                var doc = iframe.contentDocument || iframe.contentWindow.document;
                doc.open();
                doc.write(config.content);
                doc.close();
                iframe.contentWindow.postMessage({
                    cmd: 'init',
                    frameId: config.id
                }, '*');
                if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                    setTimeout(function () {
                        clearTimeout(timeoutId);
                        self.messageHandlers.delete(config.id);
                        resolve();
                    }, 100);
                }
            }
            catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    };
    SafeFrame.prototype.setupGlobalMessageHandler = function () {
        var self = this;
        addEventListener(window, 'message', function (event) {
            var messageEvent = event;
            if (!messageEvent.data || typeof messageEvent.data !== 'object')
                return;
            var data = messageEvent.data;
            if (data.cmd === 'resize') {
                self.handleResize(data);
            }
            else if (data.cmd === 'track') {
                self.handleTracking(data);
            }
            else if (data.frameId) {
                var handler = self.messageHandlers.get(data.frameId);
                if (handler) {
                    handler(messageEvent);
                }
            }
        });
    };
    SafeFrame.prototype.handleResize = function (data) {
        var e_1, _a;
        if (!data.id || !data.width || !data.height)
            return;
        try {
            for (var _b = __values(this.frames), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), slotId = _d[0], iframe = _d[1];
                var config = this.frameConfigs.get(iframe.id);
                if (config && data.id === config.id) {
                    var maxWidth = config.width * 1.5;
                    var maxHeight = config.height * 1.5;
                    var newWidth = Math.min(data.width, maxWidth);
                    var newHeight = Math.min(data.height, maxHeight);
                    iframe.width = String(newWidth);
                    iframe.height = String(newHeight);
                    eventBus.emit('slot:resized', {
                        slotId: slotId,
                        width: newWidth,
                        height: newHeight
                    });
                    break;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
    };
    SafeFrame.prototype.handleTracking = function (data) {
        var e_2, _a;
        if (!data.type || !data.id)
            return;
        try {
            for (var _b = __values(this.frames), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), slotId = _d[0], iframe = _d[1];
                var config = this.frameConfigs.get(iframe.id);
                if (config && data.id === config.id) {
                    if (data.type === 'click') {
                        eventBus.emit('slot:click', {
                            slotId: slotId,
                            data: data.data
                        });
                        eventBus.emit('click:tracked', {
                            slotId: slotId,
                            timestamp: Date.now()
                        });
                    }
                    break;
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
    };
    SafeFrame.prototype.setupFrameTracking = function (slot, _creative, frameId) {
        eventBus.emit('impression:tracked', {
            slotId: slot.id,
            frameId: frameId,
            timestamp: Date.now()
        });
    };
    SafeFrame.prototype.cleanup = function (slotId) {
        if (slotId) {
            var iframe = this.frames.get(slotId);
            if (iframe) {
                if (iframe.parentNode) {
                    iframe.parentNode.removeChild(iframe);
                }
                var config = this.frameConfigs.get(iframe.id);
                if (config) {
                    this.frameConfigs.delete(iframe.id);
                    this.messageHandlers.delete(config.id);
                }
                this.frames.delete(slotId);
            }
        }
        else {
            this.frames.forEach(function (iframe) {
                if (iframe.parentNode) {
                    iframe.parentNode.removeChild(iframe);
                }
            });
            this.frames.clear();
            this.frameConfigs.clear();
            this.messageHandlers.clear();
        }
    };
    SafeFrame.prototype.getFrameCount = function () {
        return this.frames.size;
    };
    SafeFrame.prototype.isFrameActive = function (slotId) {
        return this.frames.has(slotId);
    };
    return SafeFrame;
}());var RenderEngine = /** @class */ (function () {
    function RenderEngine() {
        this.slotRenderer = new SlotRenderer();
        this.safeFrame = new SafeFrame();
        this.renderQueue = [];
        this.isRendering = false;
        this.renderedSlots = new Set();
        this.setupEventHandlers();
    }
    RenderEngine.getInstance = function () {
        if (!RenderEngine.instance) {
            RenderEngine.instance = new RenderEngine();
        }
        return RenderEngine.instance;
    };
    RenderEngine.prototype.setupEventHandlers = function () {
        var self = this;
        eventBus.on('request:batch:complete', function () {
            self.scheduleRender();
        });
        eventBus.on('slot:received', function () {
            self.scheduleRender();
        });
    };
    RenderEngine.prototype.processResponse = function (response) {
        var self = this;
        var renderStartTime = Date.now();
        response.slots.forEach(function (slotResponse) {
            var slots = slotManager.getSlotsByInventoryId(slotResponse.inventoryId);
            slots.forEach(function (slot) {
                if (slot.elementId === slotResponse.elementId &&
                    slot.state === 'received') {
                    self.queueSlotRender(slot, slotResponse);
                }
            });
        });
        eventBus.emit('performance:metric', {
            metric: 'render_queue_time',
            value: Date.now() - renderStartTime,
            unit: 'ms'
        });
        this.processRenderQueue();
    };
    RenderEngine.prototype.queueSlotRender = function (slot, response) {
        var _a;
        if (this.renderedSlots.has(slot.id + '_' + ((_a = response.bid) === null || _a === void 0 ? void 0 : _a.bidId))) {
            return;
        }
        this.renderQueue.push({ slot: slot, response: response });
    };
    RenderEngine.prototype.scheduleRender = function () {
        if (this.renderTimer) {
            clearTimeout(this.renderTimer);
        }
        var self = this;
        this.renderTimer = window.setTimeout(function () {
            self.processRenderQueue();
        }, 10);
    };
    RenderEngine.prototype.processRenderQueue = function () {
        return __awaiter(this, void 0, void 0, function () {
            var item;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.isRendering || this.renderQueue.length === 0) {
                            return [2 /*return*/];
                        }
                        this.isRendering = true;
                        _a.label = 1;
                    case 1:
                        if (!(this.renderQueue.length > 0)) return [3 /*break*/, 4];
                        item = this.renderQueue.shift();
                        if (!item) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.renderSlot(item.slot, item.response)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [3 /*break*/, 1];
                    case 4:
                        this.isRendering = false;
                        return [2 /*return*/];
                }
            });
        });
    };
    RenderEngine.prototype.renderSlot = function (slot, response) {
        return __awaiter(this, void 0, void 0, function () {
            var renderStartTime, renderTime, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        renderStartTime = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 7, , 8]);
                        slotManager.updateSlotState(slot.id, 'rendering');
                        eventBus.emit('slot:render:start', {
                            slotId: slot.id,
                            inventoryId: slot.inventoryId,
                            status: response.status
                        });
                        if (!(response.status === 'filled' && response.creative)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.renderCreative(slot, response)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 3:
                        if (!(response.status === 'no_bid' && response.fallback)) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.renderFallback(slot, response)];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        this.renderBlank(slot);
                        _a.label = 6;
                    case 6:
                        renderTime = Date.now() - renderStartTime;
                        if (slot.metrics) {
                            slot.metrics.renderedAt = Date.now();
                            slot.metrics.totalTime = slot.metrics.renderedAt - slot.metrics.discoveredAt;
                        }
                        eventBus.emit('performance:metric', {
                            metric: 'slot_render_time',
                            value: renderTime,
                            unit: 'ms'
                        });
                        if (response.bid) {
                            this.renderedSlots.add(slot.id + '_' + response.bid.bidId);
                        }
                        return [3 /*break*/, 8];
                    case 7:
                        error_1 = _a.sent();
                        this.handleRenderError(slot, error_1);
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    RenderEngine.prototype.renderCreative = function (slot, response) {
        return __awaiter(this, void 0, void 0, function () {
            var useSafeFrame;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!response.creative) {
                            throw createError('RENDER_FAILED', 'No creative in response');
                        }
                        useSafeFrame = this.shouldUseSafeFrame(response.creative.type);
                        if (!useSafeFrame) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.safeFrame.render(slot, response.creative, response.bid)];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, this.slotRenderer.render(slot, response.creative, response.bid)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        slotManager.updateSlotState(slot.id, 'rendered');
                        eventBus.emit('slot:render:complete', {
                            slotId: slot.id,
                            inventoryId: slot.inventoryId,
                            creativeType: response.creative.type,
                            usedSafeFrame: useSafeFrame
                        });
                        this.scheduleRefresh(slot);
                        return [2 /*return*/];
                }
            });
        });
    };
    RenderEngine.prototype.renderFallback = function (slot, response) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!response.fallback) {
                            this.renderBlank(slot);
                            return [2 /*return*/];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.slotRenderer.renderFallback(slot, response.fallback)];
                    case 2:
                        _a.sent();
                        slotManager.updateSlotState(slot.id, 'rendered');
                        eventBus.emit('slot:render:complete', {
                            slotId: slot.id,
                            inventoryId: slot.inventoryId,
                            fallbackType: response.fallback.type
                        });
                        return [3 /*break*/, 4];
                    case 3:
                        _a.sent();
                        this.renderBlank(slot);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    RenderEngine.prototype.renderBlank = function (slot) {
        slot.element.innerHTML = '';
        slot.element.style.display = 'none';
        slotManager.updateSlotState(slot.id, 'failed');
    };
    RenderEngine.prototype.shouldUseSafeFrame = function (creativeType) {
        return creativeType === 'html' ||
            creativeType === 'html5' ||
            creativeType === 'rich_media';
    };
    RenderEngine.prototype.handleRenderError = function (slot, error) {
        var sdkError = error.code ? error : createError('RENDER_FAILED', 'Failed to render slot', { slotId: slot.id, originalError: error });
        slot.lastError = sdkError;
        slotManager.updateSlotState(slot.id, 'failed');
        eventBus.emit('slot:failed', {
            slotId: slot.id,
            inventoryId: slot.inventoryId,
            error: sdkError
        });
        this.renderBlank(slot);
    };
    RenderEngine.prototype.scheduleRefresh = function (slot) {
        var refreshConfig = configManager.getRefreshConfig(slot.inventoryId);
        if (!(refreshConfig === null || refreshConfig === void 0 ? void 0 : refreshConfig.enabled) || !slot.refresh.enabled) {
            return;
        }
        var interval = slot.refresh.interval || refreshConfig.interval || 30000;
        if (slot.refresh.timer) {
            clearTimeout(slot.refresh.timer);
        }
        slot.refresh.timer = window.setTimeout(function () {
            slot.refresh.count++;
            eventBus.emit('slot:refresh', {
                slotId: slot.id,
                inventoryId: slot.inventoryId,
                refreshCount: slot.refresh.count
            });
        }, interval);
    };
    RenderEngine.prototype.clearSlot = function (slotId) {
        var _this = this;
        var slot = slotManager.getSlotById(slotId);
        if (!slot)
            return;
        if (slot.refresh.timer) {
            clearTimeout(slot.refresh.timer);
            slot.refresh.timer = undefined;
        }
        this.renderBlank(slot);
        var keysToRemove = [];
        this.renderedSlots.forEach(function (key) {
            if (key.startsWith(slotId + '_')) {
                keysToRemove.push(key);
            }
        });
        keysToRemove.forEach(function (key) { return _this.renderedSlots.delete(key); });
    };
    RenderEngine.prototype.renderResponse = function (response) {
        var self = this;
        return new Promise(function (resolve, reject) {
            try {
                response.slots.forEach(function (slotResponse) {
                    if (slotResponse.status === 'filled' && slotResponse.bid) {
                        var slot = slotManager.getSlotsByInventoryId(slotResponse.inventoryId)[0];
                        if (slot) {
                            self.renderQueue.push({ slot: slot, response: slotResponse });
                        }
                    }
                });
                self.processRenderQueue();
                resolve();
            }
            catch (error) {
                reject(error);
            }
        });
    };
    RenderEngine.prototype.cleanup = function () {
        if (this.renderTimer) {
            clearTimeout(this.renderTimer);
        }
        this.renderQueue = [];
        this.isRendering = false;
        this.renderedSlots.clear();
        slotManager.getAllSlots().forEach(function (slot) {
            if (slot.refresh.timer) {
                clearTimeout(slot.refresh.timer);
            }
        });
    };
    RenderEngine.prototype.getMetrics = function () {
        return {
            queueLength: this.renderQueue.length,
            isRendering: this.isRendering,
            renderedCount: this.renderedSlots.size
        };
    };
    return RenderEngine;
}());
var renderEngine = RenderEngine.getInstance();var ImpressionTracker = /** @class */ (function () {
    function ImpressionTracker() {
        this.VIEWABILITY_THRESHOLD = 0.5; // 50%
        this.VIEWABILITY_DURATION = 1000; // 1 second
        this.trackedImpressions = new Map();
        this.visibilityTimers = new Map();
    }
    ImpressionTracker.getInstance = function () {
        if (!ImpressionTracker.instance) {
            ImpressionTracker.instance = new ImpressionTracker();
        }
        return ImpressionTracker.instance;
    };
    ImpressionTracker.prototype.trackSlot = function (slot, trackerUrl) {
        if (!slot.element || !trackerUrl || this.trackedImpressions.has(slot.id)) {
            return;
        }
        var self = this;
        var impression = {
            slotId: slot.id,
            trackerUrl: trackerUrl,
            startTime: Date.now(),
            fired: false
        };
        this.trackedImpressions.set(slot.id, impression);
        var cleanup = observeVisibility(slot.element, function (isVisible) {
            if (isVisible) {
                self.handleSlotVisible(slot.id);
            }
            else {
                self.handleSlotHidden(slot.id);
            }
        }, { threshold: this.VIEWABILITY_THRESHOLD });
        impression.cleanup = cleanup;
    };
    ImpressionTracker.prototype.handleSlotVisible = function (slotId) {
        var self = this;
        if (this.visibilityTimers.has(slotId)) {
            return;
        }
        var timer = window.setTimeout(function () {
            self.fireImpression(slotId);
        }, this.VIEWABILITY_DURATION);
        this.visibilityTimers.set(slotId, timer);
    };
    ImpressionTracker.prototype.handleSlotHidden = function (slotId) {
        var timer = this.visibilityTimers.get(slotId);
        if (timer) {
            window.clearTimeout(timer);
            this.visibilityTimers.delete(slotId);
        }
    };
    ImpressionTracker.prototype.fireImpression = function (slotId) {
        var impression = this.trackedImpressions.get(slotId);
        if (!impression || impression.fired) {
            return;
        }
        impression.fired = true;
        this.visibilityTimers.delete(slotId);
        var pixel = new Image();
        pixel.src = impression.trackerUrl;
        pixel.style.display = 'none';
        var viewTime = Date.now() - impression.startTime;
        eventBus.emit('impression:tracked', {
            slotId: slotId,
            trackerUrl: impression.trackerUrl,
            viewTime: viewTime,
            timestamp: Date.now()
        });
        eventBus.emit('performance:metric', {
            metric: 'impression_tracked',
            value: viewTime,
            unit: 'ms'
        });
    };
    ImpressionTracker.prototype.untrackSlot = function (slotId) {
        var impression = this.trackedImpressions.get(slotId);
        if (!impression) {
            return;
        }
        if (impression.cleanup) {
            impression.cleanup();
        }
        var timer = this.visibilityTimers.get(slotId);
        if (timer) {
            window.clearTimeout(timer);
            this.visibilityTimers.delete(slotId);
        }
        this.trackedImpressions.delete(slotId);
    };
    ImpressionTracker.prototype.cleanup = function () {
        var e_1, _a;
        try {
            for (var _b = __values(this.trackedImpressions), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 1), slotId = _d[0];
                this.untrackSlot(slotId);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
    };
    ImpressionTracker.prototype.getTrackedCount = function () {
        var e_2, _a;
        var count = 0;
        try {
            for (var _b = __values(this.trackedImpressions), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), _ = _d[0], impression = _d[1];
                if (impression.fired) {
                    count++;
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return count;
    };
    ImpressionTracker.prototype.isSlotTracked = function (slotId) {
        var impression = this.trackedImpressions.get(slotId);
        return impression ? impression.fired : false;
    };
    ImpressionTracker.prototype.forceFireAll = function () {
        var e_3, _a;
        try {
            for (var _b = __values(this.trackedImpressions), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), slotId = _d[0], impression = _d[1];
                if (!impression.fired) {
                    this.fireImpression(slotId);
                }
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_3) throw e_3.error; }
        }
    };
    ImpressionTracker.prototype.isIntersectionObserverAvailable = function () {
        return isIntersectionObserverSupported();
    };
    return ImpressionTracker;
}());
var impressionTracker = ImpressionTracker.getInstance();var PerformanceTracker = /** @class */ (function () {
    function PerformanceTracker() {
        this.marks = {
            sdkLoadStart: Date.now()
        };
        this.slotMetrics = new Map();
        this.requestMetrics = [];
        this.requestCount = { total: 0, successful: 0, failed: 0 };
        this.setupEventListeners();
    }
    PerformanceTracker.getInstance = function () {
        if (!PerformanceTracker.instance) {
            PerformanceTracker.instance = new PerformanceTracker();
        }
        return PerformanceTracker.instance;
    };
    PerformanceTracker.prototype.setupEventListeners = function () {
        var self = this;
        eventBus.on('sdk:init', function () {
            self.mark('sdkInitStart');
        });
        eventBus.on('sdk:ready', function () {
            self.mark('sdkInitEnd');
            self.calculateInitTime();
        });
        eventBus.on('slot:discovered', function (event) {
            self.trackSlotDiscovery(event.data.slotId);
        });
        eventBus.on('request:start', function () {
            self.mark('requestStart');
            self.requestCount.total++;
        });
        eventBus.on('request:complete', function (_event) {
            self.mark('requestEnd');
            self.requestCount.successful++;
            self.trackRequestTime();
        });
        eventBus.on('request:error', function () {
            self.requestCount.failed++;
        });
        eventBus.on('slot:render:start', function (event) {
            if (!self.marks.renderStart) {
                self.mark('renderStart');
            }
            self.trackSlotRenderStart(event.data.slotId);
        });
        eventBus.on('slot:render:complete', function (event) {
            self.trackSlotRenderComplete(event.data.slotId);
            if (!self.marks.firstAdRendered) {
                self.mark('firstAdRendered');
                self.calculateTimeToFirstAd();
            }
        });
        eventBus.on('impression:tracked', function (event) {
            self.trackImpression(event.data.slotId);
        });
    };
    PerformanceTracker.prototype.mark = function (name) {
        this.marks[name] = Date.now();
    };
    PerformanceTracker.prototype.trackSlotDiscovery = function (slotId) {
        if (!this.slotMetrics.has(slotId)) {
            this.slotMetrics.set(slotId, {
                discovered: Date.now()
            });
        }
        if (!this.marks.slotsDiscovered) {
            this.mark('slotsDiscovered');
        }
    };
    PerformanceTracker.prototype.trackSlotRenderStart = function (slotId) {
        var slot = this.slotMetrics.get(slotId);
        if (slot) {
            slot.renderStart = Date.now();
        }
    };
    PerformanceTracker.prototype.trackSlotRenderComplete = function (slotId) {
        var slot = this.slotMetrics.get(slotId);
        if (slot) {
            slot.renderComplete = Date.now();
            if (!this.marks.renderEnd) {
                this.mark('renderEnd');
            }
        }
    };
    PerformanceTracker.prototype.trackImpression = function (slotId) {
        var slot = this.slotMetrics.get(slotId);
        if (slot) {
            slot.impressionTracked = Date.now();
        }
    };
    PerformanceTracker.prototype.trackRequestTime = function () {
        if (this.marks.requestStart && this.marks.requestEnd) {
            var duration = this.marks.requestEnd - this.marks.requestStart;
            this.requestMetrics.push(duration);
            eventBus.emit('performance:metric', {
                metric: 'request_duration',
                value: duration,
                unit: 'ms'
            });
        }
    };
    PerformanceTracker.prototype.calculateInitTime = function () {
        if (this.marks.sdkInitStart && this.marks.sdkInitEnd) {
            var initTime = this.marks.sdkInitEnd - this.marks.sdkInitStart;
            eventBus.emit('performance:metric', {
                metric: 'sdk_init_time',
                value: initTime,
                unit: 'ms'
            });
        }
    };
    PerformanceTracker.prototype.calculateTimeToFirstAd = function () {
        if (this.marks.sdkLoadStart && this.marks.firstAdRendered) {
            var timeToFirstAd = this.marks.firstAdRendered - this.marks.sdkLoadStart;
            eventBus.emit('performance:metric', {
                metric: 'time_to_first_ad',
                value: timeToFirstAd,
                unit: 'ms'
            });
        }
    };
    PerformanceTracker.prototype.getMetrics = function () {
        var e_1, _a;
        var totalSlots = this.slotMetrics.size;
        var renderedSlots = 0;
        try {
            for (var _b = __values(this.slotMetrics), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), _ = _d[0], slot = _d[1];
                if (slot.renderComplete) {
                    renderedSlots++;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        var avgResponseTime = 0;
        if (this.requestMetrics.length > 0) {
            var sum = 0;
            for (var i = 0; i < this.requestMetrics.length; i++) {
                sum += this.requestMetrics[i];
            }
            avgResponseTime = sum / this.requestMetrics.length;
        }
        var metrics = {
            marks: this.marks,
            slots: this.slotMetrics,
            requests: {
                total: this.requestCount.total,
                successful: this.requestCount.successful,
                failed: this.requestCount.failed,
                avgResponseTime: Math.round(avgResponseTime)
            },
            summary: {
                totalSlots: totalSlots,
                renderedSlots: renderedSlots
            }
        };
        if (this.marks.sdkInitStart && this.marks.sdkInitEnd) {
            metrics.summary.initTime = this.marks.sdkInitEnd - this.marks.sdkInitStart;
        }
        if (this.marks.sdkLoadStart && this.marks.firstAdRendered) {
            metrics.summary.timeToFirstAd = this.marks.firstAdRendered - this.marks.sdkLoadStart;
        }
        if (this.marks.renderStart && this.marks.renderEnd) {
            metrics.summary.totalRenderTime = this.marks.renderEnd - this.marks.renderStart;
        }
        metrics.memory = this.getMemoryUsage();
        return metrics;
    };
    PerformanceTracker.prototype.getMemoryUsage = function () {
        if (typeof performance !== 'undefined' && performance.memory) {
            var memory = performance.memory;
            return {
                usedJSHeapSize: memory.usedJSHeapSize,
                totalJSHeapSize: memory.totalJSHeapSize,
                jsHeapSizeLimit: memory.jsHeapSizeLimit
            };
        }
        return undefined;
    };
    PerformanceTracker.prototype.reset = function () {
        this.marks = {
            sdkLoadStart: Date.now()
        };
        this.slotMetrics.clear();
        this.requestMetrics = [];
        this.requestCount = { total: 0, successful: 0, failed: 0 };
    };
    PerformanceTracker.prototype.getSlotMetrics = function (slotId) {
        return this.slotMetrics.get(slotId);
    };
    PerformanceTracker.prototype.logSummary = function () {
        var metrics = this.getMetrics();
        if (typeof console !== 'undefined' && console.log) {
            console.log('Ocean Ads Performance Summary:', {
                initTime: metrics.summary.initTime + 'ms',
                timeToFirstAd: metrics.summary.timeToFirstAd + 'ms',
                avgResponseTime: metrics.requests.avgResponseTime + 'ms',
                slots: metrics.summary.renderedSlots + '/' + metrics.summary.totalSlots,
                requests: metrics.requests.successful + '/' + metrics.requests.total
            });
        }
    };
    return PerformanceTracker;
}());
var performanceTracker = PerformanceTracker.getInstance();var ClickTracker = /** @class */ (function () {
    function ClickTracker() {
        this.trackedClicks = new Map();
    }
    ClickTracker.getInstance = function () {
        if (!ClickTracker.instance) {
            ClickTracker.instance = new ClickTracker();
        }
        return ClickTracker.instance;
    };
    ClickTracker.prototype.trackSlot = function (slot, clickUrl, landingUrl) {
        if (!slot.element || !clickUrl || this.trackedClicks.has(slot.id)) {
            return;
        }
        var self = this;
        var clickData = {
            slotId: slot.id,
            clickUrl: clickUrl,
            landingUrl: landingUrl
        };
        var cleanup = addEventListener(slot.element, 'click', function (event) {
            self.handleClick(event, slot.id);
        });
        clickData.cleanup = cleanup;
        this.trackedClicks.set(slot.id, clickData);
    };
    ClickTracker.prototype.handleClick = function (event, slotId) {
        var clickData = this.trackedClicks.get(slotId);
        if (!clickData) {
            return;
        }
        var target = event.target;
        var anchor = this.findAnchor(target);
        if (anchor) {
            event.preventDefault();
            this.fireClickBeacon(clickData.clickUrl);
            eventBus.emit('slot:click', {
                slotId: slotId,
                clickUrl: clickData.clickUrl,
                timestamp: Date.now()
            });
            eventBus.emit('click:tracked', {
                slotId: slotId
            });
            if (clickData.landingUrl || anchor.href) {
                window.open(clickData.landingUrl || anchor.href, anchor.target || '_blank');
            }
        }
    };
    ClickTracker.prototype.findAnchor = function (element) {
        var current = element;
        while (current && current.tagName !== 'A') {
            current = current.parentElement;
        }
        return current;
    };
    ClickTracker.prototype.fireClickBeacon = function (clickUrl) {
        var beacon = new Image();
        beacon.src = clickUrl;
        beacon.style.display = 'none';
    };
    ClickTracker.prototype.untrackSlot = function (slotId) {
        var clickData = this.trackedClicks.get(slotId);
        if (!clickData) {
            return;
        }
        if (clickData.cleanup) {
            clickData.cleanup();
        }
        this.trackedClicks.delete(slotId);
    };
    ClickTracker.prototype.cleanup = function () {
        var e_1, _a;
        try {
            for (var _b = __values(this.trackedClicks), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 1), slotId = _d[0];
                this.untrackSlot(slotId);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
    };
    ClickTracker.prototype.getTrackedCount = function () {
        return this.trackedClicks.size;
    };
    ClickTracker.prototype.isSlotTracked = function (slotId) {
        return this.trackedClicks.has(slotId);
    };
    return ClickTracker;
}());
var clickTracker = ClickTracker.getInstance();var OceanAds = /** @class */ (function () {
    function OceanAds() {
        this.version = '__SDK_VERSION__';
        this.initialized = false;
        this.ready = false;
        this.initPromise = null;
        this.handleError = this.handleError.bind(this);
        this.setupErrorHandling();
    }
    OceanAds.getInstance = function () {
        if (!OceanAds.instance) {
            OceanAds.instance = new OceanAds();
        }
        return OceanAds.instance;
    };
    OceanAds.prototype.setupErrorHandling = function () {
        var self = this;
        eventBus.on('sdk:error', function (event) {
            self.handleError(event.data.error);
        });
        if (typeof window !== 'undefined') {
            var originalOnError = window.onerror;
            window.onerror = function (msg, url, line, col, _error) {
                if (url && url.indexOf('ocean-ads') !== -1) {
                    self.handleError(createError('UNKNOWN_ERROR', typeof msg === 'string' ? msg : 'Unknown error', { line: line, col: col }));
                }
                if (originalOnError) {
                    return originalOnError.apply(window, arguments);
                }
                return false;
            };
        }
    };
    OceanAds.prototype.init = function () {
        if (this.initPromise) {
            return this.initPromise;
        }
        var self = this;
        this.initPromise = new Promise(function (resolve, reject) {
            domReady(function () {
                self.performInit()
                    .then(resolve)
                    .catch(reject);
            });
        });
        return this.initPromise;
    };
    OceanAds.prototype.performInit = function () {
        return __awaiter(this, void 0, void 0, function () {
            var slots, context, response, error_1, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.initialized) {
                            return [2 /*return*/];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 7, , 8]);
                        eventBus.emit('sdk:init', {
                            version: this.version,
                            config: configManager.getConfig()
                        });
                        if (!configManager.isValid()) {
                            throw createError('CONFIG_INVALID', 'Invalid or missing configuration');
                        }
                        logger.info('Ocean Ads SDK initializing', { version: this.version });
                        contextCollector.refresh();
                        slots = slotManager.discoverSlots();
                        logger.info('Discovered slots', { count: slots.length });
                        if (slots.length === 0) {
                            logger.warn('No ad slots found on page');
                            this.ready = true;
                            eventBus.emit('sdk:ready', {});
                            return [2 /*return*/];
                        }
                        this.initialized = true;
                        context = contextCollector.collect();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 5, , 6]);
                        return [4 /*yield*/, requestManager.requestAds(slots, context)];
                    case 3:
                        response = _a.sent();
                        return [4 /*yield*/, renderEngine.renderResponse(response)];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _a.sent();
                        logger.error('Failed to load ads', error_1);
                        return [3 /*break*/, 6];
                    case 6:
                        this.ready = true;
                        eventBus.emit('sdk:ready', {});
                        if (configManager.isDebugMode()) {
                            performanceTracker.logSummary();
                        }
                        return [3 /*break*/, 8];
                    case 7:
                        error_2 = _a.sent();
                        this.handleError(error_2);
                        throw error_2;
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    OceanAds.prototype.refresh = function (slotId) {
        if (!this.ready) {
            logger.warn('SDK not ready for refresh');
            return;
        }
        try {
            if (slotId) {
                var slot = slotManager.getSlot(slotId);
                if (!slot) {
                    logger.warn('Slot not found for refresh', { slotId: slotId });
                    return;
                }
                slotManager.refreshSlot(slotId);
            }
            else {
                slotManager.refreshAll();
            }
        }
        catch (error) {
            this.handleError(error);
        }
    };
    OceanAds.prototype.debug = function (enabled) {
        configManager.updateSettings({ debug: enabled });
        logger.setEnabled(enabled);
        if (enabled) {
            logger.info('Debug mode enabled');
            performanceTracker.logSummary();
        }
        else {
            logger.info('Debug mode disabled');
        }
    };
    OceanAds.prototype.getMetrics = function () {
        return performanceTracker.getMetrics();
    };
    OceanAds.prototype.destroy = function () {
        if (!this.initialized) {
            return;
        }
        try {
            impressionTracker.cleanup();
            clickTracker.cleanup();
            requestManager.cleanup();
            renderEngine.cleanup();
            slotManager.cleanup();
            contextCollector.cleanup();
            eventBus.clear();
            this.initialized = false;
            this.ready = false;
            this.initPromise = null;
            logger.info('SDK destroyed');
        }
        catch (error) {
            this.handleError(error);
        }
    };
    OceanAds.prototype.handleError = function (error) {
        if (error.severity === 'critical') {
            logger.error('Critical error', error);
            this.destroy();
        }
        else {
            logger.error('SDK error', error);
        }
    };
    OceanAds.prototype.isReady = function () {
        return this.ready;
    };
    OceanAds.prototype.getVersion = function () {
        return this.version;
    };
    OceanAds.prototype.forceInit = function () {
        this.initialized = false;
        this.ready = false;
        this.initPromise = null;
        return this.init();
    };
    return OceanAds;
}());
var oceanAds = OceanAds.getInstance();// Auto-initialization logic
(function () {
    if (typeof window === 'undefined') {
        return;
    }
    var autoInit = function () {
        if (window.__OCEAN_CONFIG__) {
            oceanAds.init().catch(function (error) {
                if (typeof console !== 'undefined' && console.error) {
                    console.error('Ocean Ads SDK initialization failed:', error);
                }
            });
        }
        else {
            logger.warn('No configuration found. SDK not auto-initialized.');
        }
        if (window.__OCEAN_DEBUG__) {
            oceanAds.debug(true);
        }
    };
    if (document.readyState === 'loading') {
        if (document.addEventListener) {
            document.addEventListener('DOMContentLoaded', autoInit);
        }
        else {
            document.attachEvent('onreadystatechange', function () {
                if (document.readyState === 'complete') {
                    autoInit();
                }
            });
        }
    }
    else {
        setTimeout(autoInit, 0);
    }
})();
// Global assignment
if (typeof window !== 'undefined') {
    window.OceanAds = oceanAds;
}
// Version will be injected by build process
var VERSION = '__SDK_VERSION__';exports.VERSION=VERSION;exports.default=oceanAds;exports.oceanAds=oceanAds;Object.defineProperty(exports,'__esModule',{value:true});return exports;})({});

// Ocean Ads SDK initialization complete
if (typeof window.__OCEAN_INIT__ === 'function') {
  window.__OCEAN_INIT__();
}