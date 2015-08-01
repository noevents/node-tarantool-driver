# node-tarantool-driver
Node tarantool driver for 1.6 support Node.js v.0.12+ and IO.js.

Based on https://github.com/mialinx/go-tarantool-1.6 and implements http://tarantool.org/doc/dev_guide/box-protocol.html, for more information you can read them or basic documentation at http://tarantool.org/doc/.

For work with tarantool tuple i use msgpack5(https://github.com/mcollina/msgpack5/) and array default transformation with this package.

If you have a problem with connection it will be destroyed. You can subscribe on TarantoolConnection.socket.on('close') for retrieve information about closing connection or you can process rejected errors for you requests.

##Install

```
npm install --save tarantool-driver
```

##Usage example

We use TarantoolConnection instance and connect before other operations. Methods call return promise(https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Promise). Available methods with some testing: select, update, replace, insert, delete, auth, destroy.
```
var TarantoolConnection = require('tarantool-driver');
var conn = new TarantoolConnection({port: 3301});
conn.connect()
.then(function(){
  //auth for login, password
  return conn.auth('test', 'test');
}).then(function(){
  // select arguments space_id, index_id, limit, offset, iterator, key
  return conn.select(512, 0, 1, 0, 'eq', [50]);
})
.then(funtion(results){
  doSomeThingWithResults(results);
});
```

##API

**class TarantoolConnection(options)**
```
var defaultOptions = {
    host: 'localhost',
    port: '3301'
};
```
You can overrid default options with options.

**connect() : Promise**

Resolve if connected. Or reject if not.

**auth(login: String, password: String) : Promise**

Auth with using chap-sha1(http://tarantool.org/doc/book/box/box_space.html). About authenthication more here: http://tarantool.org/doc/book/box/authentication.html

**select(spaceId: Number, indexId: Number, limit: Number, offset: Number, iterator: Iterator,  key: tuple) : Promise( Array of tuples)**

Iterators: http://tarantool.org/doc/book/box/box_index.html. Available iterators: 'eq', 'req', 'all', 'lt', 'le', 'ge', 'gt', 'bitsAllSet', 'bitsAnySet', 'bitsAllNotSet'.

It's just select. Promise resolve array of tuples.

**delete(spaceId: Number, indexId: Number, key: tuple) : Promise(Array of tuples)**

Promise resolve an array of deleted tuples.

**update(spaceId: Number, indexId: Number, key: tuple, ops) : Promise(Array of tuples)**

Ops: http://tarantool.org/doc/book/box/box_space.html(search for update here).

Promise resolve an array of updated tuples.

**insert(spaceId: Number, tuple: tuple) : Promise(Tuple)**

So it's insert. More you can read here: http://tarantool.org/doc/book/box/box_space.html

Promise resolve a new tuple.


**replace(spaceId: Number, tuple: tuple) : Promise(Tuple)**

So it's replace. More you can read here: http://tarantool.org/doc/book/box/box_space.html

Promise resolve a new or replaced tuple.

**call(functionName: String, args...) : Promise(Array or undefined)**

Call function with arguments. You can find example at test.

You can create function on tarantool side: 
```
function myget(id)
    val = box.space.batched:select{id}
    return val[1]
end
```

And then use something like this:
```
conn.call('myget', 4)
.then(function(value){
    console.log(value);
});
```

If you have a 2 arguments function just send a second arguments in this way:
```
conn.call('my2argumentsfunc', 'first', 'second arguments')
```
And etc like this.

Because lua support a multiple return it's always return array or undefined.

**destroy(interupt: Boolean) : Promise**

If you call destroy with interupt true it will interupt all process and destroy socket connection without awaiting results. Else it's stub methods with promise reject for future call and await all results and then destroy connection.

##Testing

Now it's poor test just a win to win situation and some hacks before. Install all packages and tarantool on your machine then launch a test through:
```
$ ./test/box.lua
```

Then just a use **npm test** and it will use mocha and launch test.

##Contributions

It's ok you can do whatever you need.

##ToDo

Test **eval** methods.
