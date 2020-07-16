import { newNDArray, forEach } from './array-utils.js';

const FPS = 60;
let canvases;
let tetris;
const gamePieces = [
	/* I */ { color: "#4ECAD9", collisionMap: [[0, 0, 0, 0],[1, 1, 1, 1],[0, 0, 0, 0],[0, 0, 0, 0]] },
	/* J */ { color: "#DE9B31", collisionMap: [[0, 0, 0],[1, 1, 1],[0, 0, 1]] },
	/* L */ { color: "#3228DE", collisionMap: [[0, 0, 0],[1, 1, 1],[1, 0, 0]] },
	/* O */ { color: "#F8DC1F", collisionMap: [[1, 1],[1, 1]] },
	/* S */ { color: "#FA451C", collisionMap: [[0, 0, 0],[0, 1, 1],[1, 1, 0]] },
	/* T */ { color: "#CC3EFA", collisionMap: [[0, 1, 0],[1, 1, 0],[0, 1, 0]] },
	/* Z */ { color: "#51FF36", collisionMap: [[0, 0, 0],[1, 1, 0],[0, 1, 1]] },
];

function line(ctx, x1, y1, x2, y2) {
	ctx.save();
	ctx.beginPath();

	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);

	ctx.closePath();
	ctx.restore();
	ctx.stroke();
}

function arrayCopy2D(collisionMap) {
	let copy = [];
	for (let i = 0; i < collisionMap.length; ++i) {
		copy.push([]);
		for (let j = 0; j < collisionMap[i].length; ++j) {
			copy[i].push(collisionMap[i][j]);
		}
	}
	return copy;
}

class GamePiece {
	constructor(collisionMap, color) {
		this.collisionMap = arrayCopy2D(collisionMap);
		this.color = color;
		this.dims = { x: collisionMap[0].length, y: collisionMap.length };

		// Calculate width and height
		this.widthMin = this.collisionMap[0].length - 1;
		this.widthMax = 0;
		this.heightMin = this.collisionMap.length - 1;
		this.heightMax = 0;
		for (let i = 0; i < this.collisionMap.length; ++i) {
			for (let j = 0; j < this.collisionMap[i].length; ++j) {
				if (this.collisionMap[i][j]) {
					this.widthMin  = Math.min(this.widthMin, j);
					this.widthMax  = Math.max(this.widthMax, j);
					this.heightMin = Math.min(this.heightMin, i);
					this.heightMax = Math.max(this.heightMax, i);
				}
			}
		}
		this.width  = this.widthMax  - this.widthMin  + 1;
		this.height = this.heightMax - this.heightMin + 1;
	}

	rotateCCW() {
		let rotatedCopy = [];
		for (let i = 0; i < this.collisionMap.length; ++i) {
			rotatedCopy.push([]);
			for (let j = 0; j < this.collisionMap[i].length; ++j) {
				rotatedCopy[i].push(this.collisionMap[j][this.collisionMap[j].length - 1 - i]);
			}
		}

		let tmp        = this.widthMin;
		this.widthMin  = this.heightMin;
		this.heightMin = this.collisionMap[0].length - 1 - this.widthMax;
		this.widthMax  = this.heightMax;
		this.heightMax = this.collisionMap[0].length - 1 - tmp;
		tmp            = this.width;
		this.width     = this.height;
		this.height    = tmp;
		this.collisionMap = rotatedCopy;
	}

	rotateCW() {
		let rotatedCopy = [];
		for (let i = 0; i < this.collisionMap.length; ++i) {
			rotatedCopy.push([]);
			for (let j = 0; j < this.collisionMap[i].length; ++j) {
				rotatedCopy[i].push(this.collisionMap[this.collisionMap.length - 1 - j][i]);
			}
		}

		let tmp        = this.heightMin;
		this.heightMin = this.widthMin;
		this.widthMin  = this.collisionMap.length - 1 - this.heightMax;
		this.heightMax = this.widthMax;
		this.widthMax  = this.collisionMap.length - 1 - tmp;
		tmp            = this.width;
		this.width     = this.height;
		this.height    = tmp;
		this.collisionMap = rotatedCopy;
	}
}

function getRandomGamePiece() {
	const randIdx = Math.floor(Math.random() * gamePieces.length);
	const randAng = Math.floor(Math.random() * 4);
	let gamePiece = new GamePiece(gamePieces[randIdx].collisionMap, gamePieces[randIdx].color);
	if (randAng > 0) {
		gamePiece.rotateCW();
		if (randAng == 1) gamePiece.rotateCW();
	} else if (randAng == 3) {
		gamePiece.rotateCCW();
	}
	return gamePiece;
}

class PreviewCanvas {
	constructor(previewCanvas) {
		this.ctx = previewCanvas;
		this.paddingFrac = { x: 0.05, y: 0.05 };
	}

	onResize() {
		this.ctx.canvas.width  = this.ctx.canvas.offsetWidth;
		this.ctx.canvas.height = this.ctx.canvas.offsetHeight;
		this.dims = { x: this.ctx.canvas.width * (1 - 2 * this.paddingFrac.x), y: this.ctx.canvas.height * (1 - 2 * this.paddingFrac.y) };
		this.pos  = { x: this.ctx.canvas.width *          this.paddingFrac.x,  y: this.ctx.canvas.height *          this.paddingFrac.y };
	}

	draw(gamePiece) {
		if (!gamePiece) return;

		const tileSize = Math.min(this.dims.x / gamePiece.width, this.dims.y / gamePiece.height);
		const offset = {
			x: this.ctx.canvas.width  / 2 - gamePiece.width  * tileSize / 2,
			y: this.ctx.canvas.height / 2 - gamePiece.height * tileSize / 2,
		}

		// Draw piece
		this.ctx.fillStyle = gamePiece.color;
		for (let c_i = gamePiece.heightMin, i = 0; c_i <= gamePiece.heightMax; ++c_i) {
			for (let c_j = gamePiece.widthMin, j = 0; c_j <= gamePiece.widthMax; ++c_j) {
				if (gamePiece.collisionMap[c_i][c_j]) {
					this.ctx.fillRect(
						Math.round(offset.x + j * tileSize), Math.round(offset.y + i * tileSize),
						Math.round(tileSize), Math.round(tileSize)
					);
				}
				++j;
			}
			++i;
		}

		// Draw overlay grid
		this.ctx.strokeStyle = "#000000";
		for (let x = 0; x <= gamePiece.width; ++x) {
			line(this.ctx,
				Math.round(offset.x + x * tileSize), Math.round(0),
				Math.round(offset.x + x * tileSize), Math.round(this.ctx.canvas.height),
			);
		}
		for (let y = 0; y <= gamePiece.height; ++y) {
			line(this.ctx,
				Math.round(0),                     Math.round(offset.y + y * tileSize),
				Math.round(this.ctx.canvas.width), Math.round(offset.y + y * tileSize),
			);
		}
	}
}

class Tetris {
	constructor(canvases) {
		this.holdCanvas = new PreviewCanvas(canvases.hold);
		this.nextCanvas = new PreviewCanvas(canvases.next);
		this.ctx = canvases.game;
		this.gridDim = { x: 10, y: 20 };
		this.grid = newNDArray([this.gridDim.y, this.gridDim.x], undefined);
	}

	onResize() {
		// Calculate grid size and position
		this.gridTileDim  = { x: this.ctx.canvas.width / this.gridDim.x, y: this.ctx.canvas.height / this.gridDim.y };
		this.gridPixelDim = { x: this.ctx.canvas.width, y: this.ctx.canvas.height };	

		this.holdCanvas.onResize();
		this.nextCanvas.onResize();
	}

	resetPosition() {
		this.pos = { x: Math.floor(this.gridDim.x / 2 - this.curGamePiece.width / 2), y: -this.curGamePiece.heightMin }; // Position of upper left corner of current game piece
	}

	resetGamePiece() {
		this.curGamePiece = this.nextGamePiece;
		this.nextGamePiece = getRandomGamePiece();
		this.resetPosition();
	}

	swapGamePiece() {
		if (this.holdGamePiece) {
			const tmp = this.holdGamePiece;
			this.holdGamePiece = this.curGamePiece;
			this.curGamePiece = tmp;
		} else {
			this.holdGamePiece = this.curGamePiece;
			this.resetGamePiece();
		}
		this.resetPosition();
	}

	init() {
		this.onResize();
		this.nextGamePiece = getRandomGamePiece();
		this.resetGamePiece();
	}

	drawGameGrid() {
		this.ctx.strokeStyle = "#FFFFFF";
		// Draw vertical lines
		for (let x = 0; x <= this.gridDim.x; ++x) {
			line(this.ctx,
				Math.round(x * this.gridTileDim.x), Math.round(0),
				Math.round(x * this.gridTileDim.x), Math.round(this.gridPixelDim.y)
			);
		}
		// Draw horizontal lines
		for (let y = 0; y <= this.gridDim.y; ++y) {
			line(this.ctx,
				Math.round(0),                   Math.round(y * this.gridTileDim.y),
				Math.round(this.gridPixelDim.x), Math.round(y * this.gridTileDim.y)
			);
		}
	}

	drawPlacedPieces() {
		forEach(this.grid, (color, [y, x]) => {
			if (color) {
				this.ctx.fillStyle = color;
				this.ctx.fillRect(
					x * this.gridTileDim.x, y * this.gridTileDim.y,
					this.gridTileDim.x, this.gridTileDim.y
				);
			}
		});
	}

	iterateOverPiece(callback) {
		for (let y = 0; y <= this.curGamePiece.heightMax; ++y) {
			for (let x = 0; x <= this.curGamePiece.widthMax; ++x) {
				if (this.curGamePiece.collisionMap[y][x]) {
					callback(x, y);
				}
			}
		}
	}

	drawGamePiece() {
		this.ctx.fillStyle = this.curGamePiece.color;
		this.iterateOverPiece((x, y) => {
			this.ctx.fillRect(
				Math.round((x + this.pos.x) * this.gridTileDim.x), Math.round((y + this.pos.y) * this.gridTileDim.y),
				Math.round(this.gridTileDim.x), Math.round(this.gridTileDim.y)
			);
		});
	}

	draw() {
		// Draw placed pieces
		this.drawPlacedPieces();

		// Draw current piece
		this.drawGamePiece();

		// Draw game grid
		this.drawGameGrid();

		// Draw previews
		this.holdCanvas.draw(this.holdGamePiece);
		this.nextCanvas.draw(this.nextGamePiece);
	}

	onMove() {
		this.pos.x = Math.max(
			Math.min(this.pos.x, this.gridDim.x - this.curGamePiece.widthMax  - 1),
			-this.curGamePiece.widthMin
		);
		this.pos.y = Math.max(
			Math.min(this.pos.y, this.gridDim.y - this.curGamePiece.heightMax - 1),
			-this.curGamePiece.heightMin - this.curGamePiece.height
		);
	}

	placeGamePiece() {
		this.iterateOverPiece((x, y) => {
			this.grid[this.pos.y + y][this.pos.x + x] = this.curGamePiece.color;
		});
		this.resetGamePiece();
	}

	move(dx, dy) {
		// Check if the piece is at a boundary
		const newPos = { x: this.pos.x + dx, y: this.pos.y + dy };
		if (newPos.x > this.gridDim.x - this.curGamePiece.widthMax - 1) return false;
		if (newPos.x < -this.curGamePiece.widthMin) return false;
		if (newPos.y > this.gridDim.y - this.curGamePiece.heightMax - 1) return false;
		if (newPos.y < -this.curGamePiece.heightMin - this.curGamePiece.height) return false;

		// Check if there are pieces in the way
		let canMove = true;
		this.iterateOverPiece((x, y) => {
			if (this.grid[this.pos.y + y + dy] && this.grid[this.pos.y + y + dy][this.pos.x + x + dx]) canMove = false;
		});

		if (canMove) {
			this.pos.x += dx;
			this.pos.y += dy;
		}

		return canMove;
	}

	handleKeyDown(event) {
		if (event.defaultPrevented) return;
		switch (event.key) {
			case "ArrowDown":
				this.move(0, +1);
				break;
			case "ArrowUp":
				this.move(0, -1);
				break;
			case "ArrowLeft":
				this.move(-1, 0);
				break;
			case "ArrowRight":
				this.move(+1, 0);
				break;
			case "a":
				this.curGamePiece.rotateCCW();
				break;
			case "d":
				this.curGamePiece.rotateCW();
				break;
			case "s":
				this.placeGamePiece();
				return;
			case "w":
				this.swapGamePiece();
				return;
			case " ":
				while (this.move(0, +1));
				console.log("okay");
				this.placeGamePiece();
				return;
			default: return;
		}

		this.onMove();
	}
}

function setUpCanvas(canvasName) {
	let canvas = document.getElementById(canvasName);
	canvas.width = canvas.offsetWidth;
	canvas.height = canvas.offsetHeight;
	return canvas.getContext('2d');
}

window.onload = () => {
	canvases = {
		hold: setUpCanvas("hold-canvas"),
		next: setUpCanvas("next-canvas"),
		game: setUpCanvas("game-canvas")
	};
	tetris = new Tetris(canvases);
	tetris.init();
	document.addEventListener("keydown", (event) => { tetris.handleKeyDown(event) });
	setInterval(() => {
		Object.values(canvases).forEach((ctx) => {
			ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		});
		tetris.draw();
	}, 1000 / FPS);
}

window.onresize = () => {
	Object.values(canvases).forEach((ctx) => {
		ctx.canvas.width  = ctx.canvas.offsetWidth;
		ctx.canvas.height = ctx.canvas.offsetHeight;
	});
	tetris.onResize();
};