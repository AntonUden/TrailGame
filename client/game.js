var uiVisible = false;
var uiDiv = document.getElementById("uiDiv");
var canvas = document.getElementById('ctx');
var ctx = canvas.getContext("2d");
ctx.font = "50px Arial";
ctx.clearRect(0, 0, 1200, 600);
ctx.fillStyle = "#FFFFFF";
ctx.fillRect(0, 0, 1200, 600);
ctx.textAlign = "center";
ctx.fillStyle = "#BBBBBB";

for (var bgLineX = 0; bgLineX < 1200; bgLineX += 20) {
	ctx.fillRect(bgLineX, 0, 1, 600);
}
for (var bgLineY = 0; bgLineY < 600; bgLineY += 20) {
	ctx.fillRect(0, bgLineY, 1200, 1);
}

ctx.fillStyle = "#000000";
ctx.fillText("No data from server =(", 600, 300);
uiDiv.style.height = "0px";

var socket = io();
var id = -1;

var start = new Date();
var lines = 16,
	cW = ctx.canvas.width / 2,
	cH = ctx.canvas.height / 2;
var uiVisible = false;


function nameInputKeydown(event) {
	if (event.keyCode == 13) {
		document.getElementById('setName').click();
	}
}

function changeName() {
	var name = "" + document.getElementById("nameInput").value;
	if (name == "") {
		name = "Unnamed";
	}
	console.log("changing name to " + name);
	socket.emit("changeName", {
		name: name
	});
	document.getElementById("nameInput").value = name;
}

function mouseClick(e) {
	var element = document.getElementById("body");
	var offsetX = 0,
		offsetY = 0
	if (element.offsetParent) {
		do {
			offsetX += element.offsetLeft;
			offsetY += element.offsetTop;
		} while ((element = element.offsetParent));
	}

	x = (e.pageX - offsetX) - window.innerWidth / 2;
	y = (e.pageY - offsetY) - window.innerHeight / 2;
	if (x > y && x > 200) {
		socket.emit('keyPress', {
			inputId: 'right',
			state: true
		});
		setTimeout(function() {
			socket.emit('keyPress', {
				inputId: 'right',
				state: false
			})
		}, 50);
	} else if (x < y && x < -200) {
		socket.emit('keyPress', {
			inputId: 'left',
			state: true
		});
		setTimeout(function() {
			socket.emit('keyPress', {
				inputId: 'left',
				state: false
			})
		}, 50);
	}
	if (y > x && y > 100) {
		socket.emit('keyPress', {
			inputId: 'down',
			state: true
		});
		setTimeout(function() {
			socket.emit('keyPress', {
				inputId: 'down',
				state: false
			})
		}, 50);
	} else if (y < x && y < -100) {
		socket.emit('keyPress', {
			inputId: 'up',
			state: true
		});
		setTimeout(function() {
			socket.emit('keyPress', {
				inputId: 'up',
				state: false
			})
		}, 50);
	}
}

socket.on("winners", function(data) {
	var newText = "<tr><th>Latest winners</th></tr>";
	while(data.list.length > 0) {
		newText+="<tr><td>" + data.list.pop() + "</td></tr>";	
	}
    document.getElementById("winners").innerHTML = newText;
});

socket.on("data", function(data) {
	ctx.clearRect(0, 0, 1200, 600);
	ctx.fillStyle = "#FFFFFF";
	ctx.fillRect(0, 0, 1200, 600);
	ctx.textAlign = "center";
	ctx.font = "10px Arial";

	ctx.fillStyle = "#BBBBBB";
	for (var bgLineX = 0; bgLineX < 1200; bgLineX += 20) {
		ctx.fillRect(bgLineX, 0, 1, 600);
	}
	for (var bgLineY = 0; bgLineY < 600; bgLineY += 20) {
		ctx.fillRect(0, bgLineY, 1200, 1);
	}

	for (var i = 0; i < data.trails.length; i++) {
		ctx.strokeStyle = "hsl(" + data.trails[i].color + ", 100%, 50%)";
		ctx.beginPath();
		ctx.moveTo(data.trails[i].x, data.trails[i].y);
		ctx.lineTo(data.trails[i].endX, data.trails[i].endY);
		ctx.stroke();
	}

	for (var i = 0; i < data.players.length; i++) {
		if (!data.players[i].isDead) {
			ctx.fillStyle = "hsl(" + data.players[i].color + ", 100%, 50%)";
			if (data.players[i].id == id) {
				if (!data.gameStarted) {
					ctx.strokeStyle = "blue";
					ctx.beginPath();
					ctx.arc(data.players[i].x, data.players[i].y, 10 + (Math.sin(new Date().getTime() / 500) * 5), 0, 2 * Math.PI);
					ctx.stroke();
					ctx.beginPath();
					ctx.arc(data.players[i].x, data.players[i].y, 10 + (Math.cos(new Date().getTime() / 500) * 5), 0, 2 * Math.PI);
					ctx.stroke();
				}
				ctx.fillStyle = "#00FF00";
			}

			ctx.fillRect(data.players[i].x - 3, data.players[i].y - 3, 6, 6);
			ctx.fillStyle = "#000000";
			ctx.fillText(data.players[i].name, data.players[i].x, data.players[i].y - 10);
		}
	}
	ctx.fillStyle = "#000000";
	ctx.font = "40px Arial";
	if (data.inCountdown && !data.gameStarted) {
		ctx.fillText(data.countdown, 600, 300);
	}
	if (!data.gameStarted && !data.waiting && data.onlinePlayers < 2) {
		ctx.fillText("Waiting for players", 600, 300);
	}
	if (data.waiting && !data.gameStarted && !data.inCountdown) {
		if (data.lastWinnerID == id) {
			ctx.font = "15px Arial";
			ctx.fillStyle = "#000000";
			ctx.fillText("You Won", 600, 330);
			ctx.font = "40px Arial";
			ctx.fillStyle = "#33FF33";
		}
		ctx.fillText("Winner: " + data.lastWinner, 600, 300);
	}
});

socket.on("newName", function(data) {
	console.log("Sever changed your name to " + data.name);
	document.getElementById("nameInput").value = data.name;
});

socket.on("id", function(data) {
	console.log("Your id is " + data.id);
	id = data.id;
	setTimeout(function() {
		socket.emit("kthx");
	}, 100);
});

socket.on("afk?", function(data) {
	socket.emit("not afk");
});

document.onkeydown = function(event) {
	if (event.keyCode === 68 || event.keyCode === 39) //d
		socket.emit('keyPress', {
		inputId: 'right',
		state: true
	});
	else if (event.keyCode === 83 || event.keyCode === 40) //s
		socket.emit('keyPress', {
		inputId: 'down',
		state: true
	});
	else if (event.keyCode === 65 || event.keyCode === 37) //a
		socket.emit('keyPress', {
		inputId: 'left',
		state: true
	});
	else if (event.keyCode === 87 || event.keyCode === 38) // w
		socket.emit('keyPress', {
		inputId: 'up',
		state: true
	});
}
document.onkeyup = function(event) {
	if (event.keyCode === 68 || event.keyCode === 39) //d
		socket.emit('keyPress', {
		inputId: 'right',
		state: false
	});
	else if (event.keyCode === 83 || event.keyCode === 40) //s
		socket.emit('keyPress', {
		inputId: 'down',
		state: false
	});
	else if (event.keyCode === 65 || event.keyCode === 37) //a
		socket.emit('keyPress', {
		inputId: 'left',
		state: false
	});
	else if (event.keyCode === 87 || event.keyCode === 38) // w
		socket.emit('keyPress', {
		inputId: 'up',
		state: false
	});
}

function mouseMove(e) {
	mx = Math.round(e.clientX / window.innerWidth * 1200);
	my = Math.round(e.clientY / window.innerHeight * 600);
	if (e.clientY < window.innerHeight - 70 && uiVisible && !document.getElementById("mlock").checked) {
		unfocus();
		uiVisible = false;
		uiDiv.style.height = "0px";
		document.getElementById("menuTextDiv").style.height = "20px";
	} else if (e.clientY > window.innerHeight - 40 && !uiVisible) {
		uiVisible = true;
		document.getElementById("menuTextDiv").style.height = "0px";
		uiDiv.style.height = "55px";
	}
}

function unfocus() {
	var tmp = document.createElement("input");
	document.body.appendChild(tmp);
	tmp.focus();
	document.body.removeChild(tmp);
}