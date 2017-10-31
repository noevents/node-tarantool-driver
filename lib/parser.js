var debug = require('debug')('tarantool-driver:response');
var tarantoolConstants = require('./const');
var utils = require('./utils');

exports._responseBufferTrack = function(buffer, length) {
  if (!length) {
    if (buffer.length >= 5) {
      length = buffer.readUInt32BE(1);
      buffer = buffer.slice(5);
    } else return [buffer, null];
  }
  if (buffer.length >= length) {
    if (buffer.length == length) {
      this._processResponse(buffer);
      return [];
    } else {
      var curBuffer = buffer.slice(0, length);
      this._processResponse(curBuffer);
      return this._responseBufferTrack(buffer.slice(length));
    }
  } else return [buffer, length];
};

exports._processResponse = function(buffer) {
  var dataBuffer = Buffer.concat([new Buffer([0x92]), buffer]);
  var obj = this.msgpack.decode(dataBuffer);

  var reqId = obj[0][1];
  if (this.schemaId) {
    if (this.schemaId != obj[0][5]) {
      this.schemaId = obj[0][5];
      this.namespace = {};
    }
  } else {
    this.schemaId = obj[0][5];
  }
	var task;
	for(var i = 0; i<this.commandsQueue.length; i++) {
    task = this.commandsQueue._list[(this.commandsQueue._head + i) & this.commandsQueue._capacityMask];
    if (task[1] == reqId)
    {
      this.commandsQueue.removeOne(i);
      break;
    }
  }
	var dfd = task[2];
  var success = obj[0][0] == 0 ? true : false;
	
	if (success)
    dfd.resolve(_returnBool(task[0], obj[1][tarantoolConstants.KeysCode.data]));
	else 
		dfd.reject(new utils.TarantoolError(obj[1][tarantoolConstants.KeysCode.error]));
};

function _returnBool(cmd, data){
	switch (cmd){
		case tarantoolConstants.RequestCode.rqAuth:
		case tarantoolConstants.RequestCode.rqPing:
			return true;
		default: 
			return data;
	}
}