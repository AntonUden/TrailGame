var express = require('express');
var app = express();
var serv = require('http').Server(app);
var colors = require('colors/safe');

console.log(colors.green("[Trail Game] Starting server..."));

app.get('/',function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));

var port = process.env.PORT || 80;
serv.listen(port);
var io = require("socket.io")(serv, {});

console.log(colors.green("[Trail Game] Server started on port " + port));

var SOCKET_LIST = {};
var PLAYER_LIST = {};

var Player = function(id) {
	var self = {
		x:300,
		y:300,
		id:id,
		joinKickTimeout:10,
		pressingRight:false,
		pressingLeft:false,
		pressingUp:false,
		pressingDown:false,
		name:"Unnamed"
	}

	self.respawn = function() {
		self.x = 300;
		self.y = 300;
		self.pressingRight = false;
		self.pressingLeft = false;
		self.pressingUp = false;
		self.pressingDown = false;
	}

	self.update = function() {
		
	}
	return self;
}

function getPlayerByID(id) {
	for(var p in PLAYER_LIST) {
		var player = PLAYER_LIST[p];
		if(player.id == id) {
			return player;
		}
	}
}

io.sockets.on("connection", function(socket) {
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;
	var player = Player(socket.id);
	PLAYER_LIST[socket.id] = player;
	console.log(colors.cyan("[Trail Game] Socket connection with id " + socket.id + " connected"));
	socket.emit("id", {
		id:socket.id
	});
	
	socket.on("disconnect", function() {
		delete SOCKET_LIST[socket.id];
		delete PLAYER_LIST[socket.id];
		console.log(colors.cyan("[Trail Game] Player with id " + socket.id + " disconnected"));
	});

    socket.on('keyPress',function(data){
        try {
        	if(data.inputId === 'left')
	            player.pressingLeft = data.state;
	        else if(data.inputId === 'right')
	            player.pressingRight = data.state;
	        else if(data.inputId === 'up')
	            player.pressingUp = data.state;
	        else if(data.inputId === 'down')
	            player.pressingDown = data.state;
        } catch(err) {
        }
    });
    socket.on('kthx',function(data){
        var player = getPlayerByID(socket.id);
        if(!(player == undefined)) {
        	player.joinKickTimeout = -1;
        	console.log(colors.cyan("[Trail Game] Player with id " + socket.id + " is now verified"));
        }
    });

});

setInterval(function() {
	for(var p in PLAYER_LIST) {
		var player = PLAYER_LIST[p];
		if(player.joinKickTimeout > 0) {
			player.joinKickTimeout--;
		}
		if(player.joinKickTimeout == 0) {
			delete PLAYER_LIST[player.id];
			delete SOCKET_LIST[player.id];
			console.log(colors.red("[Trail Game] Kicked " + player.id + " for inactivity"));
		}
	}
}, 100);

// Main update loop
setInterval(function() {
	try {
		var playerPack = [];
		for(var p in PLAYER_LIST) {
			var player = PLAYER_LIST[p];
			player.update();

			if(player.joinKickTimeout < 0) {
				playerPack.push({
					x:player.x,
					y:player.y,
					name:player.name
				});
			}
		}
		for(var i in SOCKET_LIST) {
			var socket = SOCKET_LIST[i];
			socket.emit("newPositions", {
				players:playerPack
			});
		}
	} catch(err) {
		console.log(colors.red("[Trail Game] (Warning) Crash during main update loop. " + err));
	}
},(1000 / 25));