var msgpack = require('msgpack-lite');
var debug = require('debug')('tarantool-driver:handler');

var utils = require('./utils');
var tarantoolConstants = require('./const');

var Decoder = msgpack.Decoder;
var decoder = new Decoder();

exports.connectHandler = function (self) {
	return function () {
		self.retryAttempts = 0;
		switch(self.state){
			case self.states.CONNECTING:
				self.dataState = self.states.PREHELLO;
				break;
			case self.states.CONNECTED:
				if(self.options.password){
					self.setState(self.states.AUTH);
					self._auth(self.options.username, self.options.password)
						.then(function(){
							self.setState(self.states.CONNECT, {host: self.options.host, port: self.options.port});
							debug('authenticated [%s]', self.options.username);
							sendOfflineQueue(self);
						}, function(err){
							self.flushQueue(err);
							self.silentEmit('error', err);
							self.disconnect(true);
						});
				} else {
					self.setState(self.states.CONNECT, {host: self.options.host, port: self.options.port});
					sendOfflineQueue(self);
				}
				break;
		}
  };
};

function sendOfflineQueue(self){
	if (self.offlineQueue.length) {
		debug('send %d commands in offline queue', self.offlineQueue.length);
		var offlineQueue = self.offlineQueue;
		self.resetOfflineQueue();
		while (offlineQueue.length > 0) {
			var command = offlineQueue.shift();
			self.sendCommand(command[0], command[1]);
		}
	}
}

exports.dataHandler = function(self){
	var trackResult;
	return function(data){
		switch(self.dataState){
			case self.states.PREHELLO:
				self.salt = data.slice(64, 108).toString('utf8');
				self.dataState = self.states.CONNECTED;
				self.setState(self.states.CONNECTED);
				exports.connectHandler(self)();
				break;
			case self.states.CONNECTED:
				trackResult = self._responseBufferTrack(data);
				if (trackResult.length == 2) {
					self.dataState = self.states.AWAITING;
					self.awaitingResponseLength = trackResult[1];
					self.buffer = trackResult[0];
				} else {
					self.buffer = null;
				}
				break;
			case self.states.AWAITING:
				trackResult = self._responseBufferTrack(
					Buffer.concat([self.buffer, data]),
					self.awaitingResponseLength
				);
				if (trackResult.length == 2) {
					self.dataState = self.states.AWAITING;
					self.awaitingResponseLength = trackResult[1];
					self.buffer = trackResult[0];

				} else {
					self.buffer = null;
					self.dataState = self.states.CONNECTED;
				}
				break;
		}
	};
};

exports.errorHandler = function(self){
	return function(error){
		debug('error: %s', error);
		self.silentEmit('error', error);
	};
};

exports.closeHandler = function(self){
	return function(){
		process.nextTick(self.emit.bind(self, 'close'));
		if (self.manuallyClosing) {
      self.manuallyClosing = false;
      debug('skip reconnecting since the connection is manually closed.');
      return close();
    }
		if (typeof self.options.retryStrategy !== 'function') {
      debug('skip reconnecting because `retryStrategy` is not a function');
      return close();
    }
    var retryDelay = self.options.retryStrategy(++self.retryAttempts);

    if (typeof retryDelay !== 'number') {
      debug('skip reconnecting because `retryStrategy` doesn\'t return a number');
      return close();
		}
		self.setState(self.states.RECONNECTING, retryDelay);
		if (self.options.reserveHosts){
      if(self.retryAttempts-1 == self.options.beforeReserve){
				self.useNextReserve();
				self.connect().catch(function(){});
				return;
			}
    }
    debug('reconnect in %sms', retryDelay);

    self.reconnectTimeout = setTimeout(function () {
      self.reconnectTimeout = null;
      self.connect().catch(function(){});
    }, retryDelay);
	};

	function close() {
    self.setState(self.states.END);
    self.flushQueue(new utils.TarantoolError('Connection is closed.'));
  }
};