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
var TRAIL_LIST = {};

var gameStarted = false;
var inCountdown = false;
var waiting = false;
var countdown = 10;
var lastWinner = "";

var Trail = function(id, x, y) {
	var self = {
		x:x,
		y:y,
		endX:x,
		endY:y,
		id:id
	}

	return self;
}

var Player = function(id) {
	var self = {
		x:Math.floor(Math.random() * 1100) + 50,
		y:Math.floor(Math.random() * 500) + 50,
		mx:0,
		my:0,
		id:id,
		currentTrail:-1,
		joinKickTimeout:10,
		pressingRight:false,
		pressingLeft:false,
		pressingUp:false,
		pressingDown:false,
		isDead:false,
		color:{
			r:Math.floor(Math.random() * 255),
			g:Math.floor(Math.random() * 200),
			b:Math.floor(Math.random() * 255)
		},
		name:"Unnamed player"
	}

	self.respawn = function() {
		self.x = Math.floor(Math.random() * 1100) + 50;
		self.y = Math.floor(Math.random() * 500) + 50;
		self.isDead = false;
		self.currentTrail = -1;
		self.pressingRight = false;
		self.pressingLeft = false;
		self.pressingUp = false;
		self.pressingDown = false;
		var trailID = (Math.random() * 100);
		TRAIL_LIST[trailID] = Trail(trailID, self.x, self.y);
		self.currentTrail = trailID;
	}

	self.update = function() {
		if(gameStarted && !self.isDead) {
			var lmx = self.mx;
			var lmy = self.my;

			if(self.pressingRight && self.mx != -1) {
				self.mx = 1;
				self.my = 0;
			} else if(self.pressingLeft && self.mx != 1) {
				self.mx = -1;
				self.my = 0;
			} else if(self.pressingUp && self.my != 1) {
				self.mx = 0;
				self.my = -1;
			} else if(self.pressingDown && self.my != -1) {
				self.mx = 0;
				self.my = 1;
			}
			
			var trail = getTrailByID(self.currentTrail);
			if(trail != undefined) {
				if(lmx != self.mx || lmy != self.my) {
					trail.endX = self.x;
					trail.endY = self.y;
					var trailID = (Math.random() * 100);
					TRAIL_LIST[trailID] = Trail(trailID, self.x, self.y);
					self.currentTrail = trailID;
				} else {
					trail.endX = self.x;
					trail.endY = self.y;
				}
			} else {
			}
			self.x += self.mx;
			self.y += self.my;

			if(self.x < 0 || self.x > 1200 || self.y < 0 || self.y > 600) {
				self.isDead = true;
			}

			for(var tra in TRAIL_LIST) {
				var trail = TRAIL_LIST[tra];
				if(trail.id != self.currentTrail) {
					var colission = 0;
					if(trail.endX > trail.x) {
						if(self.x >= trail.x && self.x <= trail.endX) {
							colission++;
						}
					} else if(trail.endX < trail.x) {
						if(self.x <= trail.x && self.x >= trail.endX) {
							colission++;
						}
					} else if(self.x == trail.x || self.x == trail.endX) {
						colission++;
					}
					if(trail.endY > trail.y) {
						if(self.y >= trail.y && self.y <= trail.endY) {
							colission++;
						}
					} else if(trail.endY < trail.y) {
						if(self.y <= trail.y && self.y >= trail.endY) {
							colission++;
						}
					} else if(self.y == trail.y || self.y == trail.endY) {
						colission++;
					}
					if(colission == 2) {
						self.isDead = true;
					}
				}
			}
		}
	}

	if(Boolean(Math.round(Math.random()))) {
		if(Boolean(Math.round(Math.random()))) {
			self.mx = 1;
		} else {
			self.mx = -1;
		}
	} else {
		if(Boolean(Math.round(Math.random()))) {
			self.my = 1;
		} else {
			self.my = -1;
		}
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
function getTrailByID(id) {
	for(var t in TRAIL_LIST) {
		var trail = TRAIL_LIST[t];
		if(trail.id == id) {
			return trail;
		}
	}
}

io.sockets.on("connection", function(socket) {
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;
	var player = Player(socket.id);
	if(gameStarted) {
		player.isDead = true;
	}
	PLAYER_LIST[socket.id] = player;
	console.log(colors.cyan("[Trail Game] Socket connection with id " + socket.id + " connected"));
	socket.emit("id", {
		id:socket.id
	});
	socket.emit("newName", {
		name:player.name
	});

	socket.on("disconnect", function() {
		delete SOCKET_LIST[socket.id];
		delete PLAYER_LIST[socket.id];
		console.log(colors.cyan("[Trail Game] Player with id " + socket.id + " disconnected"));
	});

	socket.on('changeName', function(data) {
		try {
			var player = getPlayerByID(socket.id);
			player.name = data.name;
			socket.emit("newName", {
				name:player.name
			});
		} catch(err) {}
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
		} catch(err) {}
	});
	socket.on('kthx',function(data){
		try {
			var player = getPlayerByID(socket.id);
			if(!(player == undefined)) {
				if(player.joinKickTimeout != -1) {
					player.joinKickTimeout = -1;
					if(!player.isDead) {
						var trailID = (Math.random() * 100);
						TRAIL_LIST[trailID] = Trail(trailID, player.x, player.y);
						player.currentTrail = trailID;
					}
					console.log(colors.cyan("[Trail Game] Player with id " + socket.id + " is now verified"));
				}
			}
		} catch(err) {}
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

// Countdown loop
setInterval(function() {
	if(inCountdown) {
		if(countdown > 0) {
			countdown--;
			console.log(colors.yellow("[Trail Game] Starting in " + countdown));
		}
		if(countdown <= 0) {
			console.log(colors.yellow("[Trail Game] Round started"));
			inCountdown = false;
			gameStarted = true;
		}
	}
}, 1000)

// Main update loop
setInterval(function() {
	try {
		if(!gameStarted && !waiting) {
			if(Object.keys(PLAYER_LIST).length > 1) {
				inCountdown = true;
			} else {
				inCountdown = false;
				countdown = 10;
			}
		} else {
			countdown = 10;
		}

		if(gameStarted) {
			var playersAlive = 0;
			for(var p in PLAYER_LIST) {
				var player = PLAYER_LIST[p];
				if(!player.isDead) {
					playersAlive++;
				}
			}
			if(playersAlive <= 1) {
				console.log(colors.yellow("[Trail Game] Round over. next round starting in 3 seconds"));
				waiting = true;
				inCountdown = false;
				countdown = 10;
				gameStarted = false;
				setTimeout(function() {
					console.log(colors.yellow("[Trail Game] Countdown started"));
					waiting = false;
					inCountdown = true;
					countdown = 10;
				}, 3000);
				for(var i in TRAIL_LIST) {
					delete TRAIL_LIST[i];
				}
				lastWinner = "None";
				for(var p in PLAYER_LIST) {
					var player = PLAYER_LIST[p];
					if(!player.isDead) {
						console.log(colors.yellow("[Trail Game] Winner: " + player.name));
						lastWinner = player.name;
					}
					player.respawn();
				}
			}
		}

		var playerPack = [];
		var trailPack = [];

		var onlinePlayers = Object.keys(PLAYER_LIST).length;
		for(var p in PLAYER_LIST) {
			var player = PLAYER_LIST[p];
			player.update();

			if(player.joinKickTimeout < 0) {
				playerPack.push({
					x:player.x,
					y:player.y,
					id:player.id,
					color:player.color,
					isDead:player.isDead,
					name:player.name
				});
			}
		}

		for(var t in TRAIL_LIST) {
			var trail = TRAIL_LIST[t];
			trailPack.push({
				x:trail.x,
				y:trail.y,
				endX:trail.endX,
				endY:trail.endY
			});
		}

		for(var i in SOCKET_LIST) {
			var socket = SOCKET_LIST[i];
			socket.emit("data", {
				players:playerPack,
				trails:trailPack,
				countdown:countdown,
				gameStarted:gameStarted,
				inCountdown:inCountdown,
				waiting:waiting,
				onlinePlayers:onlinePlayers,
				lastWinner:lastWinner
			});
		}
	} catch(err) {
		console.log(colors.red("[Trail Game] (Warning) Crash during main update loop. " + err));
	}
},(1000 / 60));