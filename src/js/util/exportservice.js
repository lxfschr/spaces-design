/*
 * Copyright (c) 2014 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */

define(function (require, exports, module) {
    "use strict";

    var Promise = require("bluebird"),
        log = require("js/util/log");

    var _token = "abc123",
        _wsUrl = "ws://127.0.0.1:56251",
        _wsCount = 0;

    var ExportService = function () {
        this.ws = new window.WebSocket(_wsUrl);
        this.deferred = null;
    };

    /**
     * init
     *
     * @return {Promise}
     */
    ExportService.prototype.init = function () {
        var handshake = {
                id: 0,
                command: "handshake",
                payload: "nope",
                token: _token
            },
            handshakeFunc = function (handshake, callback) {
                this.ws.onmessage = this.receiveMessage.bind(this);
                this.ws.onopen = function () {
                    this.ws.send(JSON.stringify(handshake));
                    this.wsOpen = true;
                    log.debug("WebSocket handshake complete");
                    callback(null, "ok");
                }.bind(this);
                this.ws.onerror = function (event) {
                    log.error("ExportService error: %O", event);
                };
            },
            handshakePromisified = Promise.promisify(handshakeFunc, this);

        return handshakePromisified(handshake).timeout(1000);
    };

    ExportService.prototype.open = function () {
        return this.ws && this.ws.readyState === window.WebSocket.OPEN;
    };

    ExportService.prototype.close = function () {
        if (this.open) {
            this.ws.close();
            return Promise.resolve();
        }
    };

    ExportService.prototype.receiveMessage = function (response) {
        log.debug("recieved message: %s", JSON.stringify(response));
        if (this.deferred && this.deferred.promise && this.deferred.promise.isPending()) {
            if (response && response.data) {
                this.deferred.resolve(JSON.parse(response.data));
            } else {
                log.error("what up with this message: %O", response);
                this.deferred.reject("bad response");
            }
        }
        this.deferred = null;
    };
        
    ExportService.prototype.sendMessage = function (command, payload) {
        if (this.open()) {
            var message = {
                id: ++_wsCount,
                command: command,
                payload: payload,
                token: _token
            };
            this.ws.send(JSON.stringify(message));

            var deferred = {};
            deferred.promise = new Promise(function (resolve, reject) {
                deferred.resolve = resolve;
                deferred.reject = reject;
            });
            deferred.promise.timeout(400);
            this.deferred = deferred;
            return deferred.promise;
        }
        return Promise.reject("Connection not available");
    };

    module.exports = ExportService;
});
