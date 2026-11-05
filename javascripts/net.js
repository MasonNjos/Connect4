// ---- Who am I? ----
// No hash in the URL = host (Player 1). Hash present = guest (Player 2).
const hostId = location.hash.slice(1);
const isHost = !hostId;
const me = isHost ? 0 : 1;            // 0 = Player 1, 1 = Player 2

const COLS = 7, ROWS = 6;
const $ = (id) => document.getElementById(id);
let conn = null;
let game;

// ---- Build the board (42 playable cells + the bottom "taken" row) ----
const grid = document.querySelector('.grid');
for (let i = 0; i < COLS * ROWS; i++) grid.appendChild(document.createElement('div'));

const cells = [...grid.children].slice(0, COLS * ROWS);

// ---- Every possible line of four ----
const LINES = [];
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    // Check four directions: right, down, down-right, down-left
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const line = [];
      for (let k = 0; k < 4; k++) {
        // cell's position after k steps in the direction (dr, dc)
        const rr = r + dr * k, cc = c + dc * k;
        // If out of bounds, stop checking this line
        if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) break;
        line.push(rr * COLS + cc);
      }
      if (line.length === 4) LINES.push(line);
    }
  }
}

// ---- Game logic (runs identically on both devices) ----
function newGame() {
  game = { board: Array(COLS * ROWS).fill(null), turn: 0, winner: null };
}

// Drop a disc for player `who` in column `col`. Returns true if it was legal.
function dropDisc(col, who) {
  if (game.winner !== null || game.turn !== who) return false;
  // start at the bottom to ensure disks "fall" to the lowest empty row in the column
  for (let r = ROWS - 1; r >= 0; r--) {
    // translate row/col to index in the board array
    const i = r * COLS + col;
    if (game.board[i] === null) {
      // if its empty, drop the disc here
      game.board[i] = who;
      // check for winner
      if (LINES.some((l) => l.every((j) => game.board[j] === who))) game.winner = who;
      else if (game.board.every((v) => v !== null)) game.winner = 'draw';
      // drop disk
      else game.turn = 1 - who;
      render();
      return true;
    }
  }
  return false; // column full
}

function render() {
  cells.forEach((cell, i) => {
    const v = game.board[i];
    cell.className = v === null ? '' : 'taken ' + (v === 0 ? 'player-one' : 'player-two');
  });
  const myTurn = game.turn === me;
  $('turn').textContent = game.winner !== null ? '' :
    (myTurn ? 'Your turn' : "Opponent's turn") + ' (you are Player ' + (me + 1) + ')';
  $('result').textContent =
    game.winner === null ? '' :
    game.winner === 'draw' ? "It's a draw!" :
    game.winner === me ? 'You win!' : 'You lose!';
  $('again').hidden = game.winner === null;
}

// ---- Input: click a cell, play in that column ----
cells.forEach((cell, i) => {
  cell.onclick = () => {
    if (!conn || game.turn !== me) return;
    const col = i % COLS;
    if (dropDisc(col, me)) conn.send({ type: 'move', col });
  };
});

// play again
$('again').onclick = () => {
  newGame();
  render();
  if (conn) conn.send({ type: 'reset' });
};

// ---- Networking ----
const peer = new Peer();

peer.on('open', (id) => {
  if (isHost) {
    $('link').value = location.origin + location.pathname + '#' + id;
    console.log('link: ' + $('link').value);  // for debugging
    $('invite').hidden = false;
    $('status').textContent = 'Waiting for your friend to open the link…';
  } else {
    $('status').textContent = 'Joining…';
    attach(peer.connect(hostId));
    console.log('connecting to ' + hostId);  // for debugging
  }
});

peer.on('connection', (c) => {
  if (conn) { c.close(); return; }   // only one opponent for now
  attach(c);
});

peer.on('error', (e) => { $('status').textContent = 'Error: ' + e.type; });

function attach(c) {
  conn = c;
  const start = () => {
    $('status').textContent = 'Connected!';
    $('invite').hidden = true;
    $('game').hidden = false;
    newGame();
    render();
  };
  if (c.open) start(); else c.on('open', start);

  c.on('data', (msg) => {
    if (msg.type === 'move') dropDisc(msg.col, 1 - me);
    else if (msg.type === 'reset') { newGame(); render(); }
  });
  c.on('close', () => {
    $('status').textContent = 'Your friend disconnected.';
    conn = null;
  });
}

$('copy').onclick = () => navigator.clipboard.writeText($('link').value);