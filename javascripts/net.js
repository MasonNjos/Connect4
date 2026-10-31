  // ---- Who am I? ----
  // The link looks like https://yoursite/#<hostPeerId>.
  // No hash = I'm the host (player 0). Hash present = I'm the guest (player 1).
  const hostId = location.hash.slice(1);
  const isHost = !hostId;
  const me = isHost ? 0 : 1;

  const $ = (id) => document.getElementById(id);
  let conn = null;
  let state = { turn: 0, moves: [] };   // host moves first

  // ---- Connection setup ----
  const peer = new Peer({debug: 3});              // uses PeerJS's free public signaling server

  peer.on('open', (id) => {
    if (isHost) {
      $('link').value = location.origin + location.pathname + '#' + id;
      $('invite').hidden = false;
      $('status').textContent = 'Waiting for your friend to open the link…';
    } else {
      $('status').textContent = 'Joining…';
      attach(peer.connect(hostId));
    }
  });

  peer.on('connection', (c) => {        // host side: a guest connected
    console.log('HOST: incoming connection from', c.peer);
    if (conn) { c.close(); return; }    // only one opponent for now
    attach(c);
  });

  peer.on('error', (e) => { $('status').textContent = 'Error: ' + e.type; });

  function attach(c) {
    conn = c;
    c.on('error', (e) => console.log('CONN error:', e));
    c.on('open', () => console.log('CONN open'));
    const start = () => {
      $('status').textContent = 'Connected!';
      $('invite').hidden = true;
      $('game').hidden = false;
      render();
    };
    if (c.open) start(); else c.on('open', start);

    c.on('data', (msg) => {
      if (msg.type === 'move') applyMove(msg.move, 1 - me);
    });
    c.on('close', () => {
      $('status').textContent = 'Your friend disconnected.';
      $('move').disabled = true;
    });
  }

  // ---- Game plumbing (swap this part for your real game) ----
  function applyMove(move, who) {
    state.moves.push({ who, move });
    state.turn = 1 - state.turn;
    render();
  }

  function sendMove(move) {
    if (!conn || state.turn !== me) return;   // ignore clicks out of turn
    applyMove(move, me);                      // update my own view
    conn.send({ type: 'move', move });        // tell the other player
  }

  function render() {
    const myTurn = state.turn === me;
    $('turn').textContent = myTurn ? 'Your turn' : 'Waiting for opponent…';
    $('move').disabled = !myTurn;
    $('log').innerHTML = state.moves
      .map((m) => `<li>${m.who === me ? 'You' : 'Opponent'}: ${m.move}</li>`)
      .join('');
  }

  $('move').onclick = () => sendMove('move #' + (state.moves.length + 1));
  $('copy').onclick = () => navigator.clipboard.writeText($('link').value);