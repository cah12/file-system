module.exports = function (user, fileSystemDb, Node) {
  /* 
Character Encodings
  -utf8: Multi-byte encoded Unicode characters. Many web pages and other document formats use UTF-8. This is the default character encoding.
  -utf16le: Multi-byte encoded Unicode characters. Unlike utf8, each character in the string will be encoded using either 2 or 4 bytes.
  -latin1: Latin-1 stands for ISO-8859-1. This character encoding only supports the Unicode characters from U+0000 to U+00FF.
Binary-to-Text Encodings
  -base64: Base64 encoding. When creating a Buffer from a string, this encoding will also correctly accept "URL and Filename Safe Alphabet" 
  as specified in RFC 4648, Section 5.
  -hex: Encode each byte as two hexadecimal characters.
Legacy Character Encodings
  -ascii: For 7-bit ASCII data only. Generally, there should be no reason to use this encoding, as 'utf8' (or, if the data is known to always 
    be ASCII-only, 'latin1') will be a better choice when encoding or decoding ASCII-only text.
  -binary: Alias for 'latin1'.
  -ucs2: Alias of 'utf16le'. 
*/

  const self = this;

  self.user = user;
  self.db = fileSystemDb;

  self.Node = Node;

  const mongoose = require("mongoose");
  const ObjectId = mongoose.Types.ObjectId;
  const fs = require("fs");
  const streamifier = require("streamifier");
  //const { resolve } = require("path");
  const createBucket = require("mongoose-gridfs").createBucket;
  const bucket = createBucket({ connection: fileSystemDb });

  const bycrypt = require("bcrypt");

  const Transform = require("stream").Transform;

  const Schema = mongoose.Schema;

  self.promises = {};
  self.promises.opts = self.opts = {
    rootDir: "root:",
    sep: "\\",
    gridFsStorage: true,
  };
  //self.user = null;

  //var rootDir = "root:";

  /* dir <string>
root <string>
base <string>
name <string>
ext <string>
For example, on POSIX:

path.parse('/home/user/dir/file.txt');
// Returns:
// { root: '/',
//   dir: '/home/user/dir',
//   base: 'file.txt',
//   ext: '.txt',
//   name: 'file' } */

  function unDecoratedPath(path, opts) {
    if (self.extname(path, opts) == "###") {
      path = path.replace(".###", "");
    }
    var name = path.replace(/@/g, opts.sep);
    return name.replace("%", opts.rootDir);
  }

  self.unDecoratedPath = function (path, opts) {
    return unDecoratedPath(path, opts);
  };

  function decoratedPath(path, opts) {
    //console.log(878, opts)
    let _name = null;
    if (opts.sep == "\\") {
      _name = path.replace(/\\/g, "@");
    } else {
      let re = new RegExp(opts.sep, "g");
      _name = path.replace(re, "@");
    }
    return _name.replace(opts.rootDir, "%");
  }

  function decoratedDir(path, opts) {
    if (path.indexOf("@") == -1) {
      //ensure path is decorated
      path = decoratedPath(path, opts);
    }
    if (path.lastIndexOf("@") !== -1) {
      path = path.slice(0, path.lastIndexOf("@"));
    }
    return path;
  }

  function getBase(path, opts) {
    path = decoratedPath(path, opts);
    var parts = path.split("@");
    return parts[parts.length - 1];
  }

  self.root = function (path, opts) {
    return opts.rootDir;
  };

  //short filename
  self.base = function (path, opts) {
    return getBase(path, opts);
  };

  self.dir = function (path, opts) {
    var name = decoratedDir(path, opts);
    name = name.replace(/@/g, opts.sep);
    return name.replace("%", opts.rootDir);
  };

  self.extname = function (path, opts) {
    if (path.indexOf(".") == -1) return null;
    const parts = getBase(path, opts).split(".");
    var lastPart = parts[parts.length - 1];
    return lastPart.length == 3 ? lastPart : null;
  };

  async function getChildren(node) {
    const user = self.user;
    const Node = self.Node;
    var result = [];
    var nodes = await Node.find(
      { user_id: user._id },
      { name: true, isFile: true, parent: true, gridFsId: true }
    ); //all nodes

    for (var i = 0; i < nodes.length; ++i) {
      if (nodes[i].name.length > node.name.length) {
        if (
          nodes[i].name.indexOf(node.name) !== -1 &&
          nodes[i].parent !== node.parent
        ) {
          result.push(nodes[i]);
        }
      }
    }
    return result;
  }

  class EncodingStream extends Transform {
    constructor(encoding) {
      super();
      this._encoding = encoding;
    }
    _transform(chunk, enc, cb) {
      if (this._encoding == "utf8") return cb(null, chunk);
      //cb(null, Buffer.from(chunk.toString(this._encoding)));
      cb(null, chunk.toString(this._encoding));
    }
  }

  /* 
fs.createReadStream(path[, options])#
-path <string> | <Buffer> | <URL>
-options <string> | <Object>
  -flags <string> See support of file system flags. Default: 'r'.
  -encoding <string> Default: null
  -fd <integer> Default: null
  -mode <integer> Default: 0o666
  -autoClose <boolean> Default: true
  -emitClose <boolean> Default: false
  -start <integer>
  -end <integer> Default: Infinity
  -highWaterMark <integer> Default: 64 * 1024
  -fs <Object> | <null> Default: null
Returns: <fs.ReadStream> See Readable Stream.
Unlike the 16 kb default highWaterMark for a readable stream, the stream returned by this method has a default highWaterMark of 64 kb.
options can include start and end values to read a range of bytes from the file instead of the entire file. Both start and end are inclusive 
and start counting at 0, allowed values are in the [0, Number.MAX_SAFE_INTEGER] range. If fd is specified and start is omitted or undefined, 
fs.createReadStream() reads sequentially from the current file position. The encoding can be any one of those accepted by Buffer.

If fd is specified, ReadStream will ignore the path argument and will use the specified file descriptor. This means that no 'open' event 
will be emitted. fd should be blocking; non-blocking fds should be passed to net.Socket.

If fd points to a character device that only supports blocking reads (such as keyboard or sound card), read operations do not finish until 
data is available. This can prevent the process from exiting and the stream from closing naturally.

By default, the stream will not emit a 'close' event after it has been destroyed. This is the opposite of the default for other Readable 
streams. Set the emitClose option to true to change this behavior.

By providing the fs option, it is possible to override the corresponding fs implementations for open, read, and close. When providing the 
fs option, overrides for open, read, and close are required.
 */
  self.promises.createReadStream = self.createReadStream = function (
    path,
    options
  ) {
    //console.log(401, path)
    return new Promise(async (resolve, reject) => {
      const opts = self.opts;

      if (!self.extname(path, opts)) {
        path += ".###";
      }
      if (typeof options === "string") {
        options = { encoding: options, flag: "r" };
      } else if (typeof options !== "string" && typeof options !== "object") {
        //No options provided
        options = { encoding: null, flag: "r" }; //provide default options
      }

      //console.log(401, opts)
      var _name = decoratedPath(path, opts);
      //console.log(456, _name)
      try {
        const user = self.user;
        const Node = self.Node;
        const node = await Node.findOne({ user_id: user._id, name: _name });
        if (!node) {
          reject({ success: false, msg: "Invalid filename" });
        } else {
          if (node.gridFsId) {
            const _id = node.gridFsId;
            const filename = "file-" + _id.toString();
            //console.log(4000, options)
            resolve(
              bucket
                .createReadStream({ _id, filename })
                .pipe(new EncodingStream(options.encoding))
            );
          } else {
            resolve(streamifier.createReadStream(node.data, options));
          }
        }
      } catch (err) {
        reject(err);
      }
    });
  };

  async function create(path, _isFile, _dataObj) {
    let _data = _dataObj; //.data;
    return new Promise(async (resolve, reject) => {
      const opts = self.opts;
      const user = self.user;
      const Node = self.Node;
      if (!path || path.length == 0) {
        reject({
          success: false,
          msg: "Please ensure the filename is valid.",
        });
      }
      try {
        const parentNode = await Node.findOne(
          {
            user_id: user._id,
            name: decoratedDir(path, opts),
          },
          { name: true }
        );
        if (!parentNode) {
          reject({
            success: false,
            msg: "Folder does not exist.",
          });
        }
      } catch {
        reject({
          success: false,
          msg: "Error path check failed.",
        });
      }
      _data = _data || "";
      _data = _isFile === true ? _data : undefined;

      var newNode = new Node({
        user_id: user._id,
        name: path,
        parent: decoratedDir(path, opts),
        isFile: _isFile,
        //data: _data
      });

      if (_isFile) {
        //console.log("opts.gridFsStorage", opts.gridFsStorage)
        if (opts.gridFsStorage) {
          const _id = new ObjectId();
          newNode.gridFsId = _id;
          const filename = "file-" + _id.toString();
          var readStream = null;
          readStream = streamifier.createReadStream(_data);
          readStream.pipe(
            bucket.createWriteStream({
              _id,
              filename,
            })
          );
        } else {
          newNode.data = _data;
        }
      }
      try {
        await newNode.save();
        return resolve(newNode);
      } catch (err) {
        console.log(4002, err);
        reject({
          success: false,
          msg: "Error creating node.",
        });
      }
    });
  }

  self.initTree = function () {
    return new Promise(async (resolve, reject) => {
      try {
        const opts = self.opts;
        const user = self.user;
        const Node = self.Node;

        const name = decoratedDir(opts.rootDir, opts);

        if (!(await Node.findOne({ user_id: user._id, name }))) {
          const rootNode = new Node({
            user_id: user._id,
            name,
            parent: "",
            isFile: false,
          });
          //console.log("here")
          await rootNode.save();
        }

        resolve();
      } catch (err) {
        reject(err);
      }
    });
  };

  self.connect = async function (cb) {
    if (!user) {
      return cb({ msg: "Connection error: Invalid user object" });
    }
    try {
      try {
        console.log("Connected to mongoose");
        await self.initTree();
        return cb(null);
      } catch (err) {
        return cb(err);
      }
    } catch (err) {
      cb(err);
    }
  };

  self.promises.connect = function () {
    return new Promise((resolve, reject) => {
      self.connect((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  };

  self.promises.configFs = self.configFs = function (options) {
    let currentOpts = self.opts;
    currentOpts.rootDir = options.rootDir || currentOpts.rootDir;
    currentOpts.sep = options.sep || currentOpts.sep;
    if (options.gridFsStorage !== undefined)
      currentOpts.gridFsStorage = options.gridFsStorage;
    self.promises.opts = self.opts = currentOpts;
  };

  /* 
-path <string> | <Buffer> | <URL> | <integer> filename or file descriptor
-options <Object> | <string>
    -encoding <string> | <null> Default: null
    -flag <string> See support of file system flags. Default: 'r'.
-callback <Function>
    -err <Error>
    -data <string> | <Buffer>
Asynchronously reads the entire contents of a file.
 */
  self.readFile = async function (path, options, cb) {
    const opts = self.opts;
    if (!self.extname(path, opts)) {
      path += ".###";
    }
    if (typeof options === "string") {
      options = { encoding: options, flag: "r" };
    } else if (typeof options !== "string" && typeof options !== "object") {
      //No options provided
      cb = options;
      options = { encoding: null, flag: "r" }; //provide default options
    }

    var _name = decoratedPath(path, opts);
    try {
      const user = self.user;
      const Node = self.Node;
      const node = await Node.findOne({ user_id: user._id, name: _name });
      if (!node) {
        return cb({ success: false, msg: "Invalid filename" }, null);
      } else {
        const readStream = await self.promises.createReadStream(path, options);
        let data = "";
        readStream
          .on("data", function (chunk) {
            data += chunk;
          })
          .on("end", function () {
            return cb(null, Buffer.from(data).toString(options.encoding));
          });
      }
    } catch (err) {
      return cb({ success: false, err }, null);
    }
  };

  /* 
-path: It holds the name of the file to read or the entire path if stored at other location. It is a string, buffer, URL or a filename.
-options: It holds the encoding of file. Its default value is ‘utf8’. It is an object or a string.
    -encoding: It is a String or NULL. Default: null
    -flag: It is a string that support file system flags. Default: ‘r’.
-Return Value: It returns a Promise.

The Promise is resolved with the contents of the file. If no encoding is specified (using options.encoding), the data is returned as a 
Buffer object. Otherwise, the data will be a string.
If options is a string, then it specifies the encoding.
When the path is a directory, the behavior of fsPromises.readFile() is platform-specific. On macOS, Linux, and Windows, the promise will 
be rejected with an error. On FreeBSD, a representation of the directory’s contents will be returned.
 */
  self.promises.readFile = function (path, options) {
    return new Promise(async (resolve, reject) => {
      options = options || { encoding: null, flag: "r" };
      self.readFile(path, options, (err, data) => {
        if (!err) {
          resolve(data);
        } else {
          reject(err);
        }
      });
    });
  };

  /* 
-path <string> | <Buffer> | <URL> | <number> filename or file descriptor
-data <string> | <Buffer>
-options <Object> | <string>
    -encoding <string> | <null> Default: 'utf8'
    -mode <integer> Default: 0o666
    -flag <string> See support of file system flags. Default: 'a'.
-callback <Function>
    -err <Error>
Asynchronously append data to a file, creating the file if it does not yet exist. content can be a string or a Buffer. 
*/
  self.appendFile = async function (path, data, options, cb) {
    if (options === undefined) {
      //No options provided
      cb = options;
      options = { encoding: "utf8", mode: 0o666, flag: "a" }; //provide default options
    } else if (typeof options === "string") {
      var defaultOptions = { encoding: options, mode: 0o666, flag: "a" }; //provide default options
      options = defaultOptions;
    }
    options.encoding = options.encoding || "utf8";
    options.mode = options.mode || 0o666;
    options.flag = options.flag || "a";
    self.writeFile(path, data, options, cb);
  };

  /* 
-path: It is a String, Buffer or URL that specifies the path to the target file in which given data is to be appended.
-data: It is a String or Buffer that is going to append to the target file.
-options: It is an optional parameter that affects the output in someway accordingly we provide it to the function call or not.
    -encoding: It specifies the encoding technique, default value is ‘UTF8’.
    -mode: It specifies the file mode. File modes allow us to create, read, write, or modify a file. The default value is ‘0o666’.
    -flag: It specifies the flag used while appending to the file. The default value is ‘a’.
Return Value: It returns a resolved or rejected promise. The promise is resolved if data is successfully appended to the target file 
otherwise rejected with an error object if any error is occurred (example-specified file does not have write permission, etc.)
This method accepts three parameter path, data and options. Options is an optional parameter.
 */
  self.promises.appendFile = function (path, data, options) {
    return new Promise(async (resolve, reject) => {
      options = options || { encoding: "utf8", mode: 0o666, flag: "a" };
      self.appendFile(path, data, options, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  };

  /* 
-path: It is a string, Buffer, URL or file description integer that denotes the path of the file where it has to be written. Using a file 
descriptor will make it behave similar to fs.write() method.
-data: It is a string, Buffer, TypedArray or DataView that will be written to the file.
-options: It is an string or object that can be used to specify optional parameters that will affect the output. It has three optional parameter:
    -encoding: It is a string value that specifies the encoding of the file. The default value is ‘utf8’.
    -mode: It is an integer value that specifies the file mode. The default value is 0o666.
    -flag: It is a string value that specifies the flag used while writing to the file. The default value is ‘w’.
-callback: It is the function that would be called when the method is executed.
    -err: It is an error that would be thrown if the operation fails.
This method is used to asynchronously write the specified data to a file. By default, the file would be replaced if it exists. It would be 
created if it does not exist. The ‘options’ parameter can be used to modify the functionality of the method.
 */
  self.writeFile = async function (path, data, options, cb) {
    //console.log(47, path, data)
    //console.log(5556, path, data, options)
    const opts = self.opts;
    if (!self.extname(path, opts)) {
      path += ".###";
    }
    if (options === undefined) {
      //No options provided
      cb = options;
      options = { encoding: "utf8", mode: 0o666, flag: "w" }; //provide default options
    } else if (typeof options === "string") {
      var defaultOptions = { encoding: options, mode: 0o666, flag: "w" }; //provide default options
      options = defaultOptions;
    }
    //console.log(47, path, data)
    options.encoding = options.encoding || "utf8";
    options.mode = options.mode || 0o666;
    options.flag = options.flag || "w";

    var _name = decoratedPath(path, opts);
    //parent must exist
    const parent = decoratedDir(_name, opts);
    const user = self.user;
    const Node = self.Node;
    try {
      const parentNode = await Node.findOne(
        {
          user_id: user._id,
          name: parent,
        },
        { name: true }
      );
      if (!parentNode) {
        return cb({ success: false, msg: "Folder does not exist." });
      }
    } catch (err) {
      return cb(err);
    }
    try {
      //[Error: EEXIST: file already exists, open 'C:\Users\Anthony\Google Drive\MyGames\dev-projects\test\hello.txt']
      const node = await Node.findOne({ user_id: user._id, name: _name });
      if (
        node &&
        (options.flag == "ax" ||
          options.flag == "ax+" ||
          options.flag == "wx" ||
          options.flag == "wx+")
      ) {
        return cb({ Error: `EEXIST: file already exists, open '${path}'` }); //err
      }
      if (
        !node ||
        (node &&
          !node.isFile) /*  || (node && node.isFile && options.flag === "w") */
      ) {
        //file does not exist. Create it
        try {
          await create(_name, true, data);
          return cb(null); //no error
        } catch (err) {
          return cb(err);
        }
      }

      var buf = Buffer.from(data, options.encoding);
      /* if (options.flag == "a" || options.flag == "a+") {
        //append
        var bufList = [];
        bufList.push(node.data);
        bufList.push(buf);
        buf = Buffer.concat(bufList);
      } */

      //file exist. Truncate it
      if (options.flag == "w") {
        if (node.gridFsId) {
          const _id = node.gridFsId;
          bucket.deleteFile(_id, (error, results) => {
            if (error) {
              return cb(err);
            }
            const readStream = streamifier.createReadStream(buf);
            const filename = "file-" + _id.toString();
            const out = bucket.createWriteStream({
              _id,
              filename,
            });
            readStream.pipe(out);
            out.on("finish", () => {
              return cb(null);
            });
          });
        } else {
          await node.updateOne({ data: buf });
          return cb(null);
        }
      }

      //file exist. Append to it
      if (options.flag == "a" || options.flag == "a+") {
        if (node.gridFsId) {
          //TODO
          /* const _id = node.gridFsId;
          bucket.deleteFile(_id, (error, results) => {
            if (error) {
              return cb(err);
            }
            const readStream = streamifier.createReadStream(buf);
            const filename = "file-" + _id.toString();
            readStream.pipe(
              bucket.createWriteStream({
                _id,
                filename,
              })
            );
          });  */
        } else {
          var bufList = [];
          bufList.push(node.data);
          bufList.push(buf);
          buf = Buffer.concat(bufList);
          await node.updateOne({ data: buf });
          return cb(null);
        }
      }
      //return cb(null);
    } catch (err) {
      cb(err);
    }
  };

  /* 
-path: It is a string, Buffer, URL or file description integer that denotes the path of the file where it has to be written. Using a file descriptor
 will make it behave similar to fsPromises.write() method.
-data: It is a string, Buffer, TypedArray or DataView that will be written to the file.
-options: It is an string or object that can be used to specify optional parameters that will affect the output. It has three optional parameter:
    -encoding: It is a string value that specifies the encoding of the file. The default value is ‘utf8’.
    -mode: It is an integer value that specifies the file mode. The default value is 0o666.
    -flag: It is a string value that specifies the flag used while writing to the file. The default value is ‘w’.
This  method is used to asynchronously write the specified data to a file. By default, the file would be replaced if it exists. The ‘options’ 
parameter can be used to modify the functionality of the method.
The Promise will be resolved with no arguments upon success.
 */
  self.promises.writeFile = function (path, data, options) {
    return new Promise(async (resolve, reject) => {
      options = options || { encoding: "utf8", mode: 0o666, flag: "w" };
      self.writeFile(path, data, options, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(null);
        }
      });
    });
  };

  /* 
-path <string> | <Buffer> | <URL>
-options <Object> | <integer>
    -recursive <boolean> Default: false
    -mode <string> | <integer> Not supported on Windows. Default: 0o777.
-callback <Function>
    -err <Error>
Asynchronously creates a directory.
The callback is given a possible exception and, if recursive is true, the first directory path created, (err, [path]).
The optional options argument can be an integer specifying mode (permission and sticky bits), or an object with a mode property and a 
recursive property indicating whether parent directories should be created. Calling fs.mkdir() when path is a directory that exists results 
in an error only when recursive is false.
 */
  self.mkdir = async function (path, options, cb) {
    //console.log(478, path, options, cb)
    if (typeof options !== "object") {
      //No options provided
      cb = options;
      options = { recursive: false }; //provide default options
    }
    const opts = self.opts;
    var _name = decoratedPath(path, opts);
    const user = self.user;
    const Node = self.Node;
    try {
      const node = await Node.findOne(
        { user_id: user._id, name: _name },
        { name: true }
      );
      //console.log(500, node)
      if (node && !node.isFile) {
        if (!options.recursive) {
          return cb({ success: false, msg: "Folder already exist." });
        } else {
          return cb(null);
        }
      }
    } catch (err) {
      return cb(err);
    }
    //console.log(500, path)
    if (!options.recursive) {
      //parent must exist
      const parent = decoratedDir(_name, opts);
      try {
        const parentNode = await Node.findOne(
          {
            user_id: user._id,
            name: parent,
          },
          { name: true }
        );

        //console.log(500, parentNode)
        if (!parentNode) {
          return cb({ success: false, msg: "Parent folder does not exist." });
        } else {
          //create folder
          try {
            //console.log(500, _name)
            const newNode = await create(_name, false);
            //console.log(500, newNode)
            return cb(null);
          } catch (err) {
            return cb(err);
          }
        }
      } catch (err) {
        return cb(err);
      }
    }

    //console.log(500, _name)
    //find node level
    var parentName = decoratedDir(_name, opts);
    var folders = [];
    folders.push(_name);
    while (parentName !== opts.rootDir) {
      const parentNode = await Node.findOne(
        {
          user_id: user._id,
          name: parentName,
        },
        { name: true }
      );
      if (parentNode) {
        //folder exist at this level
        break;
      }
      folders.push(parentName);
      parentName = decoratedDir(parentName, opts);
    }
    forders = folders.reverse();

    console.log("folders", folders);
    for (var i = 0; i < folders.length; ++i) {
      try {
        var newNode = await create(folders[i], false);
      } catch (err) {
        cb({
          success: false,
          msg: "Faied to create one or more directories recursively",
        });
      }
    }
    cb(null, unDecoratedPath(folders[0], opts));
  };

  /* 
The fsPromises.mkdir() method is used to asynchronously create a directory then resolves the Promise with either no arguments, or the first 
directory path created if recursive is true.
-path: This parameter is a String, Buffer or URL and holds the path of the directory has to be created.
-options: It is an Object or an Integer
    -recursive: This parameter holds the recursive boolean value. By default it is false.
    -mode: The mode option is used to set the directory permission, by default it is 0777. It is a String or an Integer
Return Value: It returns the Promise object which represents the eventual completion (or failure) of an asynchronous operation, and its 
resulting value.
 */
  self.promises.mkdir = function (path, options) {
    return new Promise((resolve, reject) => {
      options = options || { recursive: false };
      //console.log(500, path, options)
      self.mkdir(path, options, (err, path) => {
        if (err) {
          return reject(err);
        }
        if (options.recursive) {
          return resolve(path);
        }
        //console.log(500, path, options)
        resolve();      
      });
  });
};

/* 
-path: It holds the path of the directory that has to be removed. It can be a String, Buffer or URL.
-options: It is an object that can be used to specify optional parameters that will affect the operation. It has three optional parameters:
  -recursive: It is a boolean value which specifies if recursive directory removal is performed. In this mode, errors are not reported if 
  the specifed path is not found and the operation is retried on failure. The default value is false.
  -maxRetries: It is an integer value which specifies the number of times Node.js will try to perform the operation when it fails due to 
  any error. The operations are performed after the given retry delay. This option is ignored if the recursive option is not set to true. 
  The default value is 0.
  -retryDelay: It is an integer value which specifies the time to wait in milliseconds before the operation is retried. This option is 
  ignored if the recursive option is not set to true. The default value is 100 miliseconds.
-callback: It is the function that would be called when the method is executed.
  -err: It is an error that would be thrown if the operation fails.
*/
self.rmdir = async function (path, options, cb) {
  if (typeof options !== "object") {
    //No options provided
    cb = options;
    options = { recursive: false }; //provide default options
  }
  const opts = self.opts;
  var _name = decoratedPath(path, opts);

  if (_name == opts.rootDir) {
    cb({
      success: false,
      msg: `Cannot remove ${opts.rootDir} folder.`,
    });
  }
  const user = self.user;
  const Node = self.Node;
  try {
    const node = await Node.findOne(
      { user_id: user._id, name: _name },
      { name: true, isFile: true, parent: true }
    );
    if (!node) {
      return cb({
        success: false,
        msg: "Could not find folder ",
      });
    }
    if (node.isFile) {
      return cb({
        success: false,
        msg: "Node is not a folder ",
      });
    }
    var children = await getChildren(node);
    await Node.deleteOne({ _id: node._id });
    for (var i = 0; i < children.length; ++i) {
      if (children[i].isFile) {
        bucket.deleteFile(children[i].gridFsId, async (error, results) => {
          if (error) {
            return cb(error);
          }
        });
      }
      try {
        await Node.deleteOne({ _id: children[i]._id });
      } catch (err) {
        return cb(err);
      }
    }
    return cb(null);
  } catch {
    return cb({
      success: false,
      msg: "Cannot remove node.",
    });
  }
};

self.promises.rmdir = function (path, options, cb) {
  return new Promise((resolve, reject) => {
    options = options || { recursive: false };
    self.rmdir(path, options, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

/* 
-path <string> | <Buffer> | <URL>
-callback <Function>
  -err <Error>
Asynchronously removes a file or symbolic link. No arguments other than a possible exception are given to the completion callback.
*/
self.unlink = async function (path, cb) {
  const opts = self.opts;
  if (!self.extname(path, opts)) {
    path += ".###";
  }

  var _name = decoratedPath(path, opts);
  const user = self.user;
  const Node = self.Node;
  try {
    const node = await Node.findOne(
      { user_id: user._id, name: _name },
      { name: true, isFile: true, parent: true, gridFsId: true }
    );
    //console.log(4000, node)
    if (!node) {
      return cb({
        success: false,
        msg: "Could not find file ",
      });
    }
    if (!node.isFile) {
      return cb({
        success: false,
        msg: "Node is not a file ",
      });
    }
    bucket.deleteFile(node.gridFsId, async (error, results) => {
      if (error) {
        return cb(error);
      }
    });

    try {
      await Node.deleteOne({ _id: node._id });

      cb(null);
    } catch (err) {
      return cb(err);
    }
  } catch {
    cb({
      success: false,
      msg: "Cannot remove node.",
    });
  }
};

self.promises.unlink = async function (path) {
  return new Promise((resolve, reject) => {
    self.unlink(path, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

/* 
This method accept three parameters as described below:
-oldPath: It holds the path of the file that has to be renamed. It can be a string, buffer or URL.
-newPath: It holds the new path that the file has to be renamed. It can be a string, buffer or URL.
-callback: It is the function that would be called when the method is executed. It has an optional argument for showing any error that 
occurs during the process.
*/
self.rename = async function (oldPath, newPath, cb) {
  //case of folders

  var newDecoratedParent = "";
  const opts = self.opts;
  var folderName = decoratedPath(oldPath, opts);
  const user = self.user;
  const Node = self.Node;
  try {
    const node = await Node.findOne(
      { user_id: user._id, name: folderName },
      { name: true, isFile: true, parent: true }
    );
    if (node && !node.isFile) {
      var newName = decoratedPath(newPath, opts);
      try {
        var newNameNode = await Node.findOne(
          {
            user_id: user._id,
            name: newName,
          },
          { name: true }
        );
        if (newNameNode) {
          return cb({
            success: false,
            msg: "Folder with that name already exist",
          });
        }
      } catch (err) { }

      const children = await getChildren(node);
      for (let i = 0; i < children.length; ++i) {
        var m_node = children[i];
        const name = m_node.name.replace(folderName, newName);
        const parent = decoratedDir(name, opts);
        await m_node.updateOne({ name, parent });
      }
      const name = newName;
      const parent = decoratedDir(newName, opts);
      await node.updateOne({ name, parent });
      return cb(null);
    }
  } catch (err) { }

  //case of file
  if (!self.extname(oldPath, opts)) {
    oldPath += ".###";
  }
  var _name = decoratedPath(oldPath, opts);
  if (!self.extname(newPath, opts)) {
    newPath += ".###";
  }
  var newName = decoratedPath(newPath, opts);
  try {
    var node = await Node.findOne(
      { user_id: user._id, name: newName },
      { name: true, isFile: true, parent: true }
    );
    if (node) {
      return cb({
        success: false,
        msg: "File with that name already exist",
      });
    }
  } catch (err) { }

  try {
    var node = await Node.findOne(
      { user_id: user._id, name: _name },
      { name: true, isFile: true, parent: true }
    );
    if (!node) {
      return cb({
        success: false,
        msg: "Could not find file ",
      });
    }
    if (!node.isFile) {
      return cb({
        success: false,
        msg: "Node is not a file ",
      });
    }
    await node.updateOne({
      name: newName,
      parent: decoratedDir(newName, opts),
    });
    return cb(null);
  } catch (err) {
    return cb(err);
  }
};

self.promises.rename = function (oldPath, newPath, cb) {
  return new Promise((resolve, reject) => {
    self.rename(oldPath, newPath, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

/* fs.copyFile(src, dest[, mode], callback)#
History
src <string> | <Buffer> | <URL> source filename to copy
dest <string> | <Buffer> | <URL> destination filename of the copy operation
mode <integer> modifiers for copy operation. Default: 0.
callback <Function>
Asynchronously copies src to dest. By default, dest is overwritten if it already exists. No arguments other than a possible 
exception are given to the callback function. Node.js makes no guarantees about the atomicity of the copy operation. If an error
 occurs after the destination file has been opened for writing, Node.js will attempt to remove the destination.
mode is an optional integer that specifies the behavior of the copy operation. It is possible to create a mask consisting of the
 bitwise OR of two or more values (e.g. fs.constants.COPYFILE_EXCL | fs.constants.COPYFILE_FICLONE).
 
fs.constants.COPYFILE_EXCL: The copy operation will fail if dest already exists.
fs.constants.COPYFILE_FICLONE: The copy operation will attempt to create a copy-on-write reflink. If the platform does not 
support copy-on-write, then a fallback copy mechanism is used.
fs.constants.COPYFILE_FICLONE_FORCE: The copy operation will attempt to create a copy-on-write reflink. If the platform does not 
support copy-on-write, then the operation will fail. */
//self.copyFile(src, dest[, mode], callback)
self.copyFile = async function (src, dest, mode, cb) {
  //console.log(2000, arguments)
  if (arguments[2] === undefined) {
    //No mode provided
    //cb = mode;
    //mode = undefined;
  }
  //console.log(2000, cb)
  const opts = self.opts;
  var _src = decoratedPath(src, opts);
  var _dest = decoratedPath(dest, opts);
  const user = self.user;
  const Node = self.Node;

  //console.log(456, _src, _dest)
  const cpyName = `${_dest}@${self.base(_src, opts)}`;

  //console.log(456, self.unDecoratedPath(cpyName, opts))
  //console.log(456, cpyName)

  try {
    const node = await Node.findOne(
      { user_id: user._id, name: cpyName },
      { name: true }
    );
    //console.log(456, node)
    if (node) {
      await self.promises.unlink(cpyName);
    }
    const data = await self.promises.readFile(src, "utf8");
    await create(cpyName, true, data);
    //console.log(456, "hello");
    return cb({ error: null, cpyName: self.unDecoratedPath(cpyName, opts) });
  } catch (err) {
    console.log({ error: err });
  }
};

self.promises.copyFile = async function (src, dest, mode) {
  return new Promise((resolve, reject) => {
    //mode = mode || undefined;
    self.copyFile(src, dest, mode, (data) => {
      if (data.err) {
        reject(data.err);
      } else {
        resolve(data.cpyName);
      }
    });
  });
};

/*
fs.access(path[, mode], callback)#
History
path <string> | <Buffer> | <URL>
mode <integer> Default: fs.constants.F_OK
callback <Function>
err <Error>
Tests a user's permissions for the file or directory specified by path. The mode argument is an optional integer that specifies the 
accessibility checks to be performed. Check File access constants for possible values of mode. It is possible to create a mask consisting 
of the bitwise OR of two or more values (e.g. fs.constants.W_OK | fs.constants.R_OK).

The final argument, callback, is a callback function that is invoked with a possible error argument. If any of the accessibility checks fail, 
the error argument will be an Error object.

/* Constant	Description */
const F_OK = 0x1;
/* F_OK	Flag indicating that the file is visible to the calling process. This is useful for determining if a file exists, but says nothing 
about rwx permissions. Default if no mode is specified. */
const R_OK = 0x2;
/* R_OK	Flag indicating that the file can be read by the calling process. */
const W_OK = 0x3;
/* W_OK	Flag indicating that the file can be written by the calling process. */
const X_OK = 0x4;
/* X_OK	Flag indicating that the file can be executed by the calling process. This has no effect on 
Windows (will behave like fs.constants.F_OK). */

self.access = async function (path, mode, cb) {
  if (typeof mode !== "number") {
    //No mode provided
    cb = mode;
    mode = F_OK; //provide default options
  }
  const opts = self.opts;
  var _name = decoratedPath(path, opts);
  const user = self.user;
  const Node = self.Node;
  try {
    var node = await Node.findOne(
      { user_id: user._id, name: _name },
      { name: true }
    );
    if (!node) {
      return cb({
        success: false,
        msg: "Could not find file ",
      });
    }
    return cb(null);
  } catch (err) { }
};

self.promises.access = async function (path, mode) {
  return new Promise((resolve, reject) => {
    mode = mode || F_OK;
    self.access(path, mode, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

function ext(path, opts, isFile) {
  if (!isFile || path.indexOf(".") == -1) {
    return null;
  }
  const parts = getBase(path, opts).split(".");
  var lastPart = parts[parts.length - 1];
  return lastPart.length == 3 ? lastPart : null;
}

function base(path, opts) {
  var parts = path.split(opts.sep);
  return parts[parts.length - 1];
}

function displayName(path, opts, isFile) {
  if (!isFile) {
    return base(path, opts);
  }
  var baseName = base(path, opts);
  return baseName.replace("." + ext(path, opts, isFile), "");
}

/* 
return the complete decorated tree;
*/
//var a = 0;
self.tree = async function (cb) {
  var l = [];
  const user = self.user;
  const Node = self.Node;
  const opts = self.opts;
  try {
    const nodes = await Node.find(
      { user_id: user._id },
      { name: true, isFile: true, parent: true }
    );
    //console.log("nodes", nodes)
    for (var i = 0; i < nodes.length; ++i) {
      l.push({
        isFile: nodes[i].isFile,
        displayName: displayName(
          unDecoratedPath(nodes[i].name, opts),
          opts,
          nodes[i].isFile
        ),
        parentPath: unDecoratedPath(nodes[i].parent, opts),
        parentId: unDecoratedPath(nodes[i].parent, opts),
        path: unDecoratedPath(nodes[i].name, opts),
        id: nodes[i].isFile
          ? "f" + unDecoratedPath(nodes[i].name, opts)
          : unDecoratedPath(nodes[i].name, opts),
        ext: ext(unDecoratedPath(nodes[i].name, opts), opts, nodes[i].isFile),
        sep: opts.sep,
        rootDir: opts.rootDir,
      });
    }
    cb(null, l.reverse());
  } catch (err) {
    setTimeout(() => {
      return self.tree(cb);
    }, 300)
    cb(err);
  }
};

self.promises.tree = function () {
  return new Promise((resolve, rejct) => {
    self.tree((err, nodes) => {
      if (err) {
        reject(err);
      } else {
        resolve(nodes);
      }
    });
  });
};
};

//module.exports = function(){return exp;}
