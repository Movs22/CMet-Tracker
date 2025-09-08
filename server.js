const express = require("express")
let app = express()

app.use(express.static(__dirname + "/history"))
let PORT = 65000

app.listen(PORT)