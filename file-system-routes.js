

module.exports = function (fs) {  
  const express = require("express");
  const router = express.Router();
  //const Transform = require("stream").Transform;
  const jwt = require("jsonwebtoken");

  const mongoose = require("mongoose");
  const ObjectId = mongoose.Types.ObjectId;

  const bycrypt = require("bcrypt");

  const Schema = mongoose.Schema;

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  /* 
Character Encodings
  -utf8: Multi-byte encoded Unicode characters. Many web pages and other document formats use UTF-8. This is the default character encoding.
  -utf16le: Multi-byte encoded Unicode characters. Unlike utf8, each character in the string will be encoded using either 2 or 4 bytes.
  -latin1: Latin-1 stands for ISO-8859-1. This character encoding only supports the Unicode characters from U+0000 to U+00FF.
Binary-to-Text Encodings
  -base64: Base64 encoding. When creating a Buffer from a string, this encoding will also correctly accept "URL and Filename Safe Alphabet" as specified in RFC 4648, Section 5.
  -hex: Encode each byte as two hexadecimal characters.
Legacy Character Encodings
  -ascii: For 7-bit ASCII data only. Generally, there should be no reason to use this encoding, as 'utf8' (or, if the data is known to always be ASCII-only, 'latin1') will be a better choice when encoding or decoding ASCII-only text.
  -binary: Alias for 'latin1'.
  -ucs2: Alias of 'utf16le'. 
*/

// create a schema
var nodeSchema = new Schema({
  user_id: { type: ObjectId/* , unique: true  */},
  name: { type: String, /* unique: true,  */required: true },
  parent: { type: String, default: "" },
  data: Buffer,
  gridFsId: { type: ObjectId /* , unique: true  */ },
  isFile: { type: Boolean, required: true },
  //created_at: { type: Date, default: Date.now() },
 // updated_at: Date,
  
});

 // create a schema
  var refreshTokenSchema = new Schema({
    refreshToken: { type: String, unique: true, required: true },
    createdAt: { type: Date, default: Date.now, expires: 3600 }
  });  
  
  // create a schema
  var userSchema = new Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, unique: true, required: true },
    email: { type: String, /* unique: true ,  */ default: "" },
    created_at: { type: Date, default: Date.now() },
    /* rootDir: { type: String, default: "root:" },
    sep: { type: String, default: "\\" }, */
    data: {
      type: String,
      get: function (data) {
        try {
          return JSON.parse(data);
        } catch {
          return data;
        }
      },
      set: function (data) {
        return JSON.stringify(data);
      },
    }/* ,
    files: [ Object ] */
  });

    
  let fsStack = {};
  let originStack = {};

  const fileSystemDb = mongoose.createConnection(process.env.FILESYSTEM_DATABASE_URL, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
  });

  nodeSchema.index({user_id: 1, name: -1});
  const Node = fileSystemDb.model("Node", nodeSchema); 
  
  const UserFs = fileSystemDb.model("UserFs", userSchema); 
   
  const RefreshToken = fileSystemDb.model("RefreshToken", refreshTokenSchema);
  

  async function registerFs(data, cb) {
    //console.log("here", data)
    const username = data.username;
    let user = null;
    let hashedPassword = null;
    try {
      hashedPassword = await bycrypt.hash(data.password, 10);
      data.password = hashedPassword;
    } catch (err) {
      return res.json(err);
    }
    //console.log("here", data)
    try {
      user = await UserFs.findOne({ username });
      //console.log("here", user)
      if (user) {
        return cb({ msg: "username already taken" });
      }
      user = new UserFs(data);
      user.data = { rootDir: "root:", sep: "\\", gridFsStorage: true };
      //console.log("User", user);
    } catch (err) {
      cb(err);
    }
    try {
      //console.log("User", user);
      await user.save();
      //console.log("User", user);
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  function registerFsPromise(data) {
    return new Promise((resolve, reject) => {
      registerFs(data, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  //Register a user for the filiesystem
  router.post("/registerFs", async function (req, res) {
    if (req.body.username === undefined && req.body.password === undefined) {
      req.body.username = process.env.FILESYSTEM_DEFAULT_USERNAME;
      req.body.password = process.env.FILESYSTEM_DEFAULT_PASSWORD;
    }

    if (
      req.body.username.trim().length == 0 ||
      req.body.password.trim().length == 0
    ) {
      return res.json({
        success: false,
        msg: "Need a valid username and password.",
      });
    }
    try {
      await registerFsPromise(req.body);
      return res.json({
        success: true,
        msg: "Registration completed.",
      });
    } catch (err) {
      res.json(err);
    }
  });

  router.post("/config", authenticateToken, async function (req, res) {
    const username = req.user.username;
    const fsPromises = fsStack[username].promises;
    let options = req.body;
    try {
      fsPromises.configFs(options);
      let user = await UserFs.findOne({ username });
      if (!user) {
        return res.status(401).json({
          success: false,
          msg: "Fail to save new configuration...",
        });
      }
      await user.updateOne({ data: options });
      return res.json(null);
    } catch (err) {
      return res.status(401).json({
        success: false,
        msg: "Configuration of file system failed...",
      });
    }
  });

  router.get("/config", authenticateToken, async function (req, res) {
    const username = req.user.username;
    try {
      const user = await UserFs.findOne({ username });
      if (!user) {
        return res.status(401).json({
          success: false,
          msg: "Fail to get configuration...",
        });
      }
      return res.json(user.data);
    } catch (err) {
      return res.status(401).json({
        success: false,
        msg: "Fail to get configuration...",
      });
    }
  });

  const cookieOptions = {
    maxAge: 1000 * 60 * 15, // would expire after 15 minutes
    httpOnly: true, // The cookie only accessible by the web server
    //signed: true // Indicates if the cookie should be signed
  };

  //Connects to the user filiesystem
  router.post("/connect", async function (req, res) {
    if(originStack[req.headers.origin] === undefined) return res.json({
      error: true,
      msg: "set-up failed.",
    });
    if (req.body.username === undefined && req.body.password === undefined) {
      req.body.username = process.env.FILESYSTEM_DEFAULT_USERNAME;
      req.body.password = process.env.FILESYSTEM_DEFAULT_PASSWORD;
      const user = await UserFs.findOne({
        username: process.env.FILESYSTEM_DEFAULT_USERNAME,
      });
      if (!user) {
        try {
          await registerFsPromise(
            {
              username: process.env.FILESYSTEM_DEFAULT_USERNAME,
              password: process.env.FILESYSTEM_DEFAULT_PASSWORD,
            });
            //console.log("Default registration completed.");
        } catch (err) {
          return res.json({
            error: true,
            msg: "Default registration failed.",
          });
        }
      }
    }
    if (
      req.body.username.trim().length == 0 ||
      req.body.password.trim().length == 0
    ) {
      return res.json({
        error: true,
        msg: "Need a valid username.",
      });
    }
    const username = req.body.username;
    try {
      //console.log(555, req.body)
      const user = await UserFs.findOne({ username });
      if (!user) {
        return res.status(401).json({
          error: true,
          msg: "Not registered.",
        });
      }
      if (!(await bycrypt.compare(req.body.password, user.password))) {
        return res.status(401).json({
          error: true,
          msg:
            "Initialization of file system failed. Incorrect password or username.",
        });
      }

      if (fsStack[username] === undefined) {
        fsStack[username] = new fs(user, fileSystemDb, Node);
      }
      //console.log(1001, gridFsDb)
      await fsStack[username].promises.connect();
      //console.log("originStack:", originStack)
      const accessToken = jwt.sign(
        { username },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: originStack[req.headers.origin].accessTokenExpiry }
      );
      fsStack[username].promises.configFs(user.data);

      const refreshToken = jwt.sign(
        { username },
        process.env.REFRESH_TOKEN_SECRET
      );
      const newRefreshToken = new RefreshToken({ refreshToken });
      //newRefreshToken.ttl = "1h"; // lives for 1 hour
      try {
        await newRefreshToken.save();
      } catch (err) {
        return res.status(401).json(err);
      }
      if (originStack[req.headers.origin].sameDomain) {
        res.cookie("refresh_token", refreshToken, cookieOptions); // options is optional
        return res.json({ accessToken, username, configData: user.data });
      }
      return res.json({
        accessToken,
        username,
        refreshToken,
        configData: user.data,
      });
    } catch (err) {
      console.log(err);
      return res.status(401).json({
        error: true,
        msg: "Initialization of file system failed.",
      });
    }
  });

  //Re-connects to the logged-in user filiesystem
  router.post("/re-connect", authenticateToken, async function (req, res) {
    const username = req.user.username;
    const user = await UserFs.findOne({ username });
    if (!user) {
      return res.status(401).json({
        error: true,
        msg: "Initialization of file system failed.",
      });
    }
    return res.json({ error: false, username, configData: user.data });
  });

  router.post("/disconnect", authenticateToken, async function (req, res) {
    const username = req.user.username;
    if (username && fsStack[username]) {
      const fsPromises = fsStack[username].promises;
      try {
        //await fsPromises.disconnect();
        delete fsStack[username];
        if (req.body.refreshToken) {
          await RefreshToken.deleteOne({
            refreshToken: req.body.refreshToken,
          });
        } else {
          await RefreshToken.deleteOne({
            refreshToken: req.cookies.refresh_token,
          });
          res.clearCookie("refresh_token");
        }
        return res.json(null);
      } catch (err) {
        return res.status(401).json(err);
      }
    }
  });


  router.post("/refresh_token", async function (req, res) {
    if (!originStack[req.headers.origin]){
      console.log("originStack not initialized")
      return res.status(403).json({ msg: "originStack not initialized" });
    }      
    let _refreshToken = null;
    if (originStack[req.headers.origin].sameDomain) {
      _refreshToken = req.cookies.refresh_token;
    } else {
      _refreshToken = req.body.refreshToken;
    }
    try {
      const token = await RefreshToken.findOne({
        refreshToken: _refreshToken,
      });
      if (!token){
        console.log("No matching refresh token in database.")
        return res.status(403).json({ msg: "No matching refresh token in database." });
      } 
      jwt.verify(
        token.refreshToken,
        process.env.REFRESH_TOKEN_SECRET,
        async (err, user) => {
          if (err) {
            console.log("Failed to verify token against secret.")
            return res.status(403).json({ msg: "Failed to verify token against secret." });
          }
          const accessToken = jwt.sign(
            { username: user.username },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: originStack[req.headers.origin].accessTokenExpiry }
          );
          const refreshToken = jwt.sign(
            { username: user.username },
            process.env.REFRESH_TOKEN_SECRET
          );
          const newRefreshToken = new RefreshToken({ refreshToken });
          //newRefreshToken.ttl = "1h"; // lives for 1 hour
          try {
            await RefreshToken.deleteOne({ _id: token._id });
          } catch (err) {
            return res.status(401).json({msg: "Failed to delete refresh token"});
          }
          try {
            await newRefreshToken.save();            
          } catch (err) {
            return res.status(401).json({msg: "Failed to save new refresh token"});
          }          
          if (originStack[req.headers.origin].sameDomain) {
            res.cookie("refresh_token", refreshToken, cookieOptions); // options is optional
            return res.json({ accessToken, refreshToken: null });
          }
          return res.json({ accessToken, refreshToken });
        }
      );
    } catch (err) {
      console.log(err)
      return res.status(403).json({ msg: err });
    }
  });
  
  
  //Gets the entire tree
  router.post("/setup", function (req, res) {
    const sameDomain = req.body.sameDomain;
    const accessTokenExpiry = req.body.accessTokenExpiry || 10; //secs
    let data = { sameDomain, accessTokenExpiry };
    originStack[req.headers.origin] = data;
    console.log("Setup completed")
    res.json(data);
  });

  router.delete("/removeFile", authenticateToken, async function (req, res) {
    //console.log(4000, req.body.name)
    const username = req.user.username;
    const fsPromises = fsStack[username].promises;
    try {
      await fsPromises.unlink(req.body.name); 
      res.json({success: true,
        msg: "File removed."
      })     
    } catch {
      return res.status(401).json({
        success: false,
        msg: "Cannot remove file.",
      });
    }
  });

  router.delete("/removeFolder", authenticateToken, async function (req, res) {
    const username = req.user.username;
    const fsPromises = fsStack[username].promises;
    try {
      await fsPromises.rmdir(req.body.name); 
      res.json({success: false,
        msg: "Folder removed."
      })     
    } catch {
      return res.status(401).json({
        success: true,
        msg: "Cannot remove folder.",
      });
    }
  });

  router.delete("/breakdown", function (req, res) {
    delete originStack[req.headers.origin];
    res.json({ msg: "breakdown completed" });
  });

  //Gets the entire tree
  router.get("/tree", authenticateToken, async function (req, res) {
    const username = req.user.username;
    if(fsStack[username]===undefined){
      return res.status(401).json({
        success: false,
        msg: "Cannot get tree. fsStack not initialized",
      });
    }
    const fsPromises = fsStack[username].promises;
    try {
      const tree = await fsPromises.tree(/* username */);
      return res.json({ tree: tree });
    } catch {
      return res.status(401).json({
        success: false,
        msg: "Cannot get tree.",
      });
    }
  });

  //Create a new folder for the user
  router.post("/createFolder", authenticateToken, async function (req, res) {
    const username = req.user.username;
    const fsPromises = fsStack[username].promises;
    
    if (!req.body.name || req.body.name.trim().length == 0) {
      return res.status(401).json({
        success: false,
        msg: "Please ensure the folder name is valid.",
      });
    }
    try {
      //console.log(478, req.body)
      await fsPromises.mkdir(req.body.name);
      //console.log(478, req.body)
      return res.json({ success: true, msg: "Folder created" });
    } catch (err) {
      //console.log(479, req.body)
      return res.status(401).json(err);
    }
  });

  //Create a new file for the user
  router.post("/access", authenticateToken, async function (req, res) {
    //console.log(225, req.user)
    const username = req.user.username;
    const fsPromises = fsStack[username].promises;
    if (!req.body.name || req.body.name.trim().length == 0) {
      return res.status(401).json({
        success: false,
        msg: "Please ensure the filename is valid.",
      });
    }
    try {
      await fsPromises.access(req.body.name, req.body.mode);
      return res.json({ success: true, msg: "File exist" });
    } catch (err) {
      //console.log(225,err)
      return res.status(401).json(err);
    }
  });

  //Create a new file for the user
  router.post("/copyFile", authenticateToken, async function (req, res) {
    //console.log(225, req.user)
    const username = req.user.username;
    const fsPromises = fsStack[username].promises;
    if ((!req.body.src || req.body.src.trim().length == 0)||(!req.body.dest || req.body.dest.trim().length == 0)) {
      return res.status(401).json({
        success: false,
        msg: "Please ensure the src and dest are valid.",
      });
    }
    try {
      const result = await fsPromises.copyFile(req.body.src, req.body.dest, req.body.mode);
      //console.log(224,result)
      return res.json(result);
    } catch (err) {
      console.log(225,err)
      return res.status(401).json(err);
    }
  });

  //Create a new file for the user
  router.post("/createFile", authenticateToken, async function (req, res) {
    //console.log(225, req.body)
    const username = req.user.username;
    const fsPromises = fsStack[username].promises;
    if (!req.body.name || req.body.name.trim().length == 0) {
      return res.status(401).json({
        success: false,
        msg: "Please ensure the filename is valid.",
      });
    }
    try {
      const data = req.body.data || "";
      await fsPromises.writeFile(req.body.name, data, req.body.options);       
      return res.json({ success: true, msg: "File created" });
    } catch (err) {      
      return res.status(401).json({ success: false, msg: "Failed to create file" });
    }
  });

  router.post("/rename", authenticateToken, async function (req, res) {
    //console.log(225, req.body)
    const username = req.user.username;
    const fsPromises = fsStack[username].promises;
    if (!req.body.name || !req.body.newName) {
      return res.status(401).json({
        success: false,
        msg: "Invalid arguments.",
      });
    }
    try {
      if(req.body.replaceFile){
        await fsPromises.unlink(req.body.newName);
        await fsPromises.rename(req.body.name, req.body.newName);
      }else{
        await fsPromises.rename(req.body.name, req.body.newName);
      }      
      return res.json({ success: true, msg: "File or folder renamed" });
    } catch (err) {
      return res.status(401).json(err);
    }
  });

  router.post("/readFile", authenticateToken, async function (req, res) {
    const username = req.user.username;
    const fsPromises = fsStack[username].promises;
    try {
      var data = null;
      if (req.body.options) {
        data = await fsPromises.readFile(req.body.name, req.body.options);
      } else {
        data = await fsPromises.readFile(req.body.name);
      }
      return res.json(data);
    } catch (err) {
      return res.status(401).json(err);
    }
  });

  /* class EncodingStream extends Transform {
    constructor(encoding) {
      super();
      this._encoding = encoding;
    }
    _transform(chunk, encoding, cb) {
      if (encoding == "buffer") {
        cb(null, Buffer.from(chunk.toString(this._encoding)));
      } else {
        cb(null, Buffer.from(chunk).toString(this._encoding));
      }
    }
  } */

  //Stream data to response
  router.post("/readStream", authenticateToken, async function (req, res) {
    const username = req.user.username;
    const fsPromises = fsStack[username].promises;
    try {
      
      var readStream = await fsPromises.createReadStream(req.body.name, req.body.options.encoding);
      //console.log(564, readStream)
      readStream.pipe(res);     
    } catch (err) {
      return res.status(401).json(err);
    }
  });

  router.post("/writeFile", authenticateToken, async function (req, res) {
    const username = req.user.username;
    const fsPromises = fsStack[username].promises;
    //console.log("here", req.body)
    try {
      const result = await fsPromises.writeFile(
        req.body.name,
        req.body.data,
        req.body.options
      );
      //console.log(100, result)
      return res.json(result);
    } catch (err) {
      //console.log(100, err)
      return res.status(401).json(err);
    }
  });

  router.post("/appendFile", async function (req, res) {
    const username = req.user.username;
    const fsPromises = fsStack[username].promises;
    try {
      const result = await fsPromises.appendFile(
        req.body.name,
        req.body.data,
        req.body.options
      );
      return res.json(result);
    } catch (err) {
      return res.status(401).json(err);
    }
  });

  function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!authHeader) {
      return res.sendStatus(401);
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
      if (err) {
        return res.sendStatus(403);
      }
      req.user = user;
      next();
    });
  }
  

  return router;
};
