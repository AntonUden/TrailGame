var express = require('express');
var app = express();
var serv = require('http').Server(app);
var colors = require('colors/safe');
var wildcard = require('socketio-wildcard')();

//---------- Server settings ----------
var MAX_SOCKET_ACTIVITY_PER_SECOND = 500;
//-------------------------------------

console.log(colors.green("[Trail Game] Starting server..."));

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

var port = process.env.PORT || 80;
serv.listen(port);
var io = require("socket.io")(serv, {});
io.use(wildcard);

if(process.env.PORT == undefined)
    console.log(colors.blue("[jsShooter] no port defined using default (80)"));
console.log(colors.green("[Trail Game] Socket started on port " + port));

var SOCKET_ACTIVITY = {};
var SOCKET_LIST = {};
var PLAYER_LIST = {};
var TRAIL_LIST = {};

var gameStarted, inCountdown, waiting = false;
var countdown = 10;
var lastWinner = "";
var lastWinnerID = -1.0;

var Trail = function(id, x, y) {
    var self = {
        x: x,
        y: y,
        endX: x,
        endY: y,
        id: id,
        color: 0
    }
    return self;
}

var Player = function(id) {
    var self = {
        x: Math.floor(Math.random() * 1100) + 50,
        y: Math.floor(Math.random() * 500) + 50,
        mx: 0,
        my: 0,
        id: id,
        afkKickTimeout: 100,
        currentTrail: -1,
        joinKickTimeout: 30,
        pressingRight: false,
        pressingLeft: false,
        pressingUp: false,
        pressingDown: false,
        isDead: false,
        color: Math.floor(Math.random() * 360),
        name: "Unnamed player"
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
        TRAIL_LIST[trailID].color = self.color;
        self.currentTrail = trailID;
    }

    self.update = function() {
        if (gameStarted && !self.isDead) {
            var lmx = self.mx;
            var lmy = self.my;

            if (self.pressingRight && self.mx != -1) {
                self.mx = 1;
                self.my = 0;
            } else if (self.pressingLeft && self.mx != 1) {
                self.mx = -1;
                self.my = 0;
            } else if (self.pressingUp && self.my != 1) {
                self.mx = 0;
                self.my = -1;
            } else if (self.pressingDown && self.my != -1) {
                self.mx = 0;
                self.my = 1;
            }

            var trail = getTrailByID(self.currentTrail);
            if (trail != undefined) {
                if (lmx != self.mx || lmy != self.my) {
                    trail.endX = self.x;
                    trail.endY = self.y;
                    var trailID = (Math.random() * 100);
                    TRAIL_LIST[trailID] = Trail(trailID, self.x, self.y);
                    TRAIL_LIST[trailID].color = self.color;
                    self.currentTrail = trailID;
                } else {
                    trail.endX = self.x;
                    trail.endY = self.y;
                }
            } else {}
            self.x += self.mx;
            self.y += self.my;

            if (self.x < 0 || self.x > 1200 || self.y < 0 || self.y > 600) {
                self.isDead = true;
            }

            for (var tra in TRAIL_LIST) {
                var trail = TRAIL_LIST[tra];
                if (trail.id != self.currentTrail) {
                    var colission = 0;
                    if (trail.endX > trail.x) {
                        if (self.x >= trail.x && self.x <= trail.endX) {
                            colission++;
                        }
                    } else if (trail.endX < trail.x) {
                        if (self.x <= trail.x && self.x >= trail.endX) {
                            colission++;
                        }
                    } else if (self.x == trail.x || self.x == trail.endX) {
                        colission++;
                    }
                    if (trail.endY > trail.y) {
                        if (self.y >= trail.y && self.y <= trail.endY) {
                            colission++;
                        }
                    } else if (trail.endY < trail.y) {
                        if (self.y <= trail.y && self.y >= trail.endY) {
                            colission++;
                        }
                    } else if (self.y == trail.y || self.y == trail.endY) {
                        colission++;
                    }
                    if (colission == 2) {
                        self.isDead = true;
                    }
                }
            }
        }
    }
    if (Boolean(Math.round(Math.random()))) {
        if (Boolean(Math.round(Math.random()))) {
            self.mx = 1;
        } else {
            self.mx = -1;
        }
    } else {
        if (Boolean(Math.round(Math.random()))) {
            self.my = 1;
        } else {
            self.my = -1;
        }
    }

    return self;
}

function getPlayerByID(id) {
    for (var p in PLAYER_LIST) {
        var player = PLAYER_LIST[p];
        if (player.id == id) {
            return player;
        }
    }
}

function getTrailByID(id) {
    for (var t in TRAIL_LIST) {
        var trail = TRAIL_LIST[t];
        if (trail.id == id) {
            return trail;
        }
    }
}

function disconnectSocket(id) {
    SOCKET_LIST[id].disconnect();
    delete SOCKET_LIST[id];
    delete SOCKET_ACTIVITY[id];
}

io.sockets.on("connection", function(socket) {
    socket.id = Math.random();
    if(SOCKET_ACTIVITY[socket.id] == undefined) {
        SOCKET_ACTIVITY[socket.id] = 0;
    }
    SOCKET_LIST[socket.id] = socket;
    var player = Player(socket.id);
    if (gameStarted) {
        player.isDead = true;
    }
    PLAYER_LIST[socket.id] = player;
    console.log(colors.cyan("[Trail Game] Socket connection with id " + socket.id + " connected"));
    socket.emit("id", {
        id: socket.id
    });
    socket.emit("newName", {
        name: player.name
    });

    // Player disconnect
    socket.on("disconnect", function() {
        delete PLAYER_LIST[socket.id];
        disconnectSocket(socket.id);
        console.log(colors.cyan("[Trail Game] Player with id " + socket.id + " disconnected"));
    });

    // Player name change
    socket.on('changeName', function(data) {
        try {
            if(data.name.length > 64) { // Name is way too long. Kick the player for sending too much data
                console.log(colors.red("[Trail Game] Player with id " + socket.id + " tried to change name to " + data.name + " but it is longer than 64 chars. Disconnecting socket"));
                disconnectSocket(socket.id);
                return;
            }

            if(data.name.length > 16) { // Name is too long
                return;
            }

            var player = getPlayerByID(socket.id);
            player.name = data.name;
            socket.emit("newName", {
                name: player.name
            });
        } catch (err) {}
    });

    socket.on('not afk', function(data) {
        try {
            var player = getPlayerByID(socket.id);
            player.afkKickTimeout = 100;
        } catch (err) {}
    });

    // Key Presses
    socket.on('keyPress', function(data) {
        try {
            if (data.inputId === 'left')
                player.pressingLeft = data.state;
            else if (data.inputId === 'right')
                player.pressingRight = data.state;
            else if (data.inputId === 'up')
                player.pressingUp = data.state;
            else if (data.inputId === 'down')
                player.pressingDown = data.state;
        } catch (err) {}
    });

    // Player verification
    socket.on('kthx', function(data) {
        try {
            var player = getPlayerByID(socket.id);
            if (!(player == undefined)) {
                if (player.joinKickTimeout != -1) {
                    player.joinKickTimeout = -1;
                    if (!player.isDead) {
                        var trailID = (Math.random() * 100);
                        TRAIL_LIST[trailID] = Trail(trailID, player.x, player.y);
                        TRAIL_LIST[trailID].color = player.color;
                        player.currentTrail = trailID;
                    }
                    console.log(colors.cyan("[Trail Game] Player with id " + socket.id + " is now verified"));
                }
            }
        } catch (err) {}
    });

    socket.on("*", function(data) {
        try {
            SOCKET_ACTIVITY[socket.id]++;
            //console.log(data);
        } catch(err) {}
    });

});

setInterval(function() {
    for(var sa in SOCKET_ACTIVITY) {
            if(isNaN(SOCKET_ACTIVITY[sa])) {
            delete SOCKET_ACTIVITY[sa];
            break;
        }

        if(SOCKET_ACTIVITY[sa] > MAX_SOCKET_ACTIVITY_PER_SECOND) {
            console.log(colors.red("[Trail Game] Kicked " + sa + " Too high network activity. " + SOCKET_ACTIVITY[sa] + " > " + MAX_SOCKET_ACTIVITY_PER_SECOND + " Messages in 1 second"));
            delete PLAYER_LIST[sa];
            disconnectSocket(sa);
        } else {
            SOCKET_ACTIVITY[sa] = 0;
        }
    }
    for (var i in SOCKET_LIST) {
        var socket = SOCKET_LIST[i];
        socket.emit("afk?", {});
    }
}, 1000);

// Player afk kick loop
setInterval(function() {
    for (var p in PLAYER_LIST) {
        var player = PLAYER_LIST[p];
        player.afkKickTimeout--;
        if (player.joinKickTimeout > 0) {
            player.joinKickTimeout--;
        }
        if (player.joinKickTimeout == 0 || player.afkKickTimeout <= 0) {
            delete PLAYER_LIST[player.id];
            disconnectSocket(socket.id);
            console.log(colors.red("[Trail Game] Kicked " + player.id + " for inactivity"));
        }
    }
}, 100);

// Countdown loop
setInterval(function() {
    if (inCountdown) {
        if (countdown > 0) {
            countdown--;
            console.log(colors.yellow("[Trail Game] Starting in " + countdown));
        }
        if (countdown <= 0) {
            console.log(colors.yellow("[Trail Game] Round started"));
            inCountdown = false;
            gameStarted = true;
        }
    }
}, 1000);

// Main update loop
setInterval(function() {
    try {
        if (!gameStarted && !waiting) {
            if (Object.keys(PLAYER_LIST).length > 1) {
                inCountdown = true;
            } else {
                inCountdown = false;
                countdown = 10;
            }
        } else {
            countdown = 10;
        }

        if (gameStarted) {
            var playersAlive = 0;
            for (var p in PLAYER_LIST) {
                var player = PLAYER_LIST[p];
                if (!player.isDead) {
                    playersAlive++;
                }
            }
            if (playersAlive <= 1) {
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
                for (var i in TRAIL_LIST) {
                    delete TRAIL_LIST[i];
                }
                lastWinner = "None";
                for (var p in PLAYER_LIST) {
                    var player = PLAYER_LIST[p];
                    if (!player.isDead) {
                        console.log(colors.yellow("[Trail Game] Winner: " + player.name + " ID: " + player.id));
                        lastWinner = player.name;
                        lastWinnerID = player.id;
                    }
                    player.respawn();
                }
            }
        }

        var playerPack = [];
        var trailPack = [];

        var onlinePlayers = Object.keys(PLAYER_LIST).length;
        for (var p in PLAYER_LIST) {
            var player = PLAYER_LIST[p];
            player.update();

            if (player.joinKickTimeout < 0) {
                playerPack.push({
                    x: player.x,
                    y: player.y,
                    id: player.id,
                    color: player.color,
                    isDead: player.isDead,
                    name: player.name
                });
            }
        }
        for (var t in TRAIL_LIST) {
            var trail = TRAIL_LIST[t];
            trailPack.push({
                x: trail.x,
                y: trail.y,
                endX: trail.endX,
                endY: trail.endY,
                color: trail.color
            });
        }
        for (var i in SOCKET_LIST) {
            var socket = SOCKET_LIST[i];
            socket.emit("data", {
                players: playerPack,
                trails: trailPack,
                countdown: countdown,
                gameStarted: gameStarted,
                inCountdown: inCountdown,
                waiting: waiting,
                onlinePlayers: onlinePlayers,
                lastWinner: lastWinner,
                lastWinnerID: lastWinnerID
            });
        }
    } catch (err) {
        console.log(colors.red("[Trail Game] (Warning) Crash during main update loop. " + err));
    }
}, (1000 / 60));
console.log(colors.green("[Trail Game] Server started "));