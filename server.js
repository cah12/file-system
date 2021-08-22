if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
  //process.env.FILESYSTEM_DATABASE_URL = process.env.FILESYSTEM_LOCAL_DATABASE_URL;  
}

const port = process.env.PORT || 3000;
const express = require("express");
const app = express();
const cookieParser = require('cookie-parser');
var cors = require("cors");

var whitelist = ['http://127.0.0.1:5500', 'https://easy-grapher.herokuapp.com/']
var corsOptions = {
   origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  } 
}
app.use(cors(corsOptions));

app.use(cookieParser());

app.use(express.json({limit: "140mb", extended: true }));

const fs = require("./filesystem-mongo");
const fileSystemRoutes = require("./file-system-routes")(fs);
app.use(fileSystemRoutes); 

app.use(express.static('public'));

const server = app.listen(port, () => {
  console.log("Listening on port " + port);  
});


 