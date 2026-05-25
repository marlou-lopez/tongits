"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const os_1 = __importDefault(require("os"));
const crypto_1 = __importDefault(require("crypto"));
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
const path_1 = __importDefault(require("path"));
const gameLogic_1 = require("./gameLogic");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
// Serve static files from the React client build
const clientDistPath = path_1.default.join(__dirname, '../../client/dist');
app.use(express_1.default.static(clientDistPath));
// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path_1.default.join(clientDistPath, 'index.html'));
});
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: { origin: '*' },
});
const PORT = process.env.PORT || 3000;
let serverDeck = [];
const gameState = {
    players: [],
    status: 'waiting',
    phase: 'waiting_for_players',
    deckCount: 0,
    dumpPile: [],
    turnId: null,
    winnerId: null,
    winReason: null,
    hasDrawnThisTurn: false
};
let turnHistory = [];
function saveStateSnapshot() {
    turnHistory.push(JSON.parse(JSON.stringify(gameState)));
}
// Helper: Broadcast state to all clients, hiding opponents' hands
function broadcastGameState() {
    gameState.deckCount = serverDeck.length;
    // Emit uniquely to each connected socket
    io.sockets.sockets.forEach((socket) => {
        // Determine which player this socket belongs to
        const player = gameState.players.find(p => p.socketId === socket.id);
        const receiverId = player ? player.id : null;
        // Deep clone the state
        const sanitizedState = JSON.parse(JSON.stringify(gameState));
        sanitizedState.canUndo = turnHistory.length > 0;
        // Hide other players' hands
        sanitizedState.players.forEach(p => {
            p.points = (0, gameLogic_1.calculatePoints)(p.hand);
            if (p.id !== receiverId) {
                // Map hand to hidden cards (so client knows count but not actual cards)
                p.hand = p.hand.map(c => ({ id: 'hidden', suit: 'hearts', rank: 'A', value: 0 }));
            }
        });
        socket.emit('gameStateUpdate', sanitizedState);
    });
}
function endRound(winnerId, reason) {
    gameState.status = 'finished';
    gameState.phase = 'round_end';
    gameState.winnerId = winnerId;
    gameState.winReason = reason;
    const winnerIndex = gameState.players.findIndex(p => p.id === winnerId);
    if (winnerIndex !== -1) {
        gameState.players[winnerIndex].wins += 1;
    }
    // Next round host is the winner
    gameState.players.forEach(p => p.isHost = (p.id === winnerId));
    io.emit('gameMessage', `Game Over! ${reason}`);
    broadcastGameState();
}
function evaluateFight() {
    const isFightChallenge = gameState.phase === 'fight_challenge';
    const callerId = gameState.fightCallerId;
    const responses = gameState.fightResponses || {};
    let lowestPoints = Infinity;
    let winnerId = '';
    let burnedCount = 0;
    // Track eligible players for tie-breaking
    const eligiblePlayers = [];
    gameState.players.forEach(p => {
        let pPoints = (0, gameLogic_1.calculatePoints)(p.hand);
        // In a fight challenge, folded players get max points
        if (isFightChallenge && p.id !== callerId && responses[p.id] === 'fold') {
            pPoints = 999;
            burnedCount++;
        }
        // Standard burn rule
        else if (!p.hasBahay) {
            pPoints = 999; // Burned!
            burnedCount++;
        }
        if (pPoints < 999) {
            eligiblePlayers.push({ id: p.id, points: pPoints });
        }
        if (pPoints < lowestPoints) {
            lowestPoints = pPoints;
            winnerId = p.id;
        }
    });
    if (burnedCount === gameState.players.length) {
        winnerId = gameState.players.find(p => p.isHost)?.id || gameState.players[0].id;
        endRound(winnerId, "Everyone was Burned! Host wins by default.");
        return;
    }
    // Handle ties in fight challenge
    if (isFightChallenge && callerId) {
        const tiedPlayers = eligiblePlayers.filter(p => p.points === lowestPoints);
        if (tiedPlayers.length > 1) {
            // Tie breaker: caller loses to challengers. Between challengers, latest in turn order wins.
            const callerIndex = gameState.players.findIndex(p => p.id === callerId);
            const getDistance = (id) => {
                if (id === callerId)
                    return 0;
                const idx = gameState.players.findIndex(p => p.id === id);
                return (idx - callerIndex + gameState.players.length) % gameState.players.length;
            };
            tiedPlayers.sort((a, b) => getDistance(b.id) - getDistance(a.id));
            winnerId = tiedPlayers[0].id;
        }
    }
    const winner = gameState.players.find(p => p.id === winnerId);
    endRound(winnerId, `${winner?.name} won with ${lowestPoints} points!`);
}
function nextTurn() {
    const currentIndex = gameState.players.findIndex(p => p.id === gameState.turnId);
    const nextIndex = (currentIndex + 1) % gameState.players.length;
    gameState.turnId = gameState.players[nextIndex].id;
    gameState.hasDrawnThisTurn = false;
    turnHistory = [];
    broadcastGameState();
}
io.on('connection', (socket) => {
    console.log(`[${socket.id}] Connected`);
    socket.on('joinGame', (name, callback) => {
        if (gameState.players.length >= 3) {
            callback({ success: false });
            return;
        }
        const playerId = crypto_1.default.randomUUID();
        const newPlayer = {
            id: playerId,
            socketId: socket.id,
            name,
            isHost: gameState.players.length === 0,
            connected: true,
            hand: [],
            exposedMelds: [],
            hasBahay: false,
            fightEligible: false,
            points: 0,
            wins: 0
        };
        gameState.players.push(newPlayer);
        if (gameState.players.length === 3 && gameState.status === 'waiting') {
            gameState.phase = 'waiting_for_players';
        }
        console.log(`[${socket.id}] ${name} joined as ${playerId}.`);
        io.emit('playerJoined', newPlayer);
        broadcastGameState();
        callback({ success: true, playerId });
    });
    socket.on('rejoinGame', (playerId, callback) => {
        const playerIndex = gameState.players.findIndex(p => p.id === playerId);
        if (playerIndex !== -1) {
            gameState.players[playerIndex].socketId = socket.id;
            gameState.players[playerIndex].connected = true;
            console.log(`[${socket.id}] ${gameState.players[playerIndex].name} rejoined.`);
            broadcastGameState();
            callback(true);
        }
        else {
            callback(false);
        }
    });
    socket.on('leaveGame', () => {
        const playerIndex = gameState.players.findIndex(p => p.socketId === socket.id);
        if (playerIndex !== -1) {
            const leftPlayer = gameState.players[playerIndex];
            gameState.players.splice(playerIndex, 1);
            if (leftPlayer.isHost && gameState.players.length > 0) {
                gameState.players[0].isHost = true;
            }
            // If game was playing, abort it
            if (gameState.status === 'playing') {
                gameState.status = 'waiting';
                gameState.phase = 'waiting_for_players';
                io.emit('gameMessage', `${leftPlayer.name} left. Game aborted.`);
            }
            broadcastGameState();
        }
    });
    socket.on('disconnect', () => {
        const playerIndex = gameState.players.findIndex(p => p.socketId === socket.id);
        if (playerIndex !== -1) {
            gameState.players[playerIndex].connected = false;
            broadcastGameState();
        }
    });
    // GAME ACTIONS ==============================================
    socket.on('startGame', () => {
        const player = gameState.players.find(p => p.socketId === socket.id);
        if (!player) {
            console.log(`[${socket.id}] Attempted to start game but player not found.`);
            return;
        }
        if (!player.isHost) {
            socket.emit('error', 'Only the host can start the game.');
            return;
        }
        if (gameState.players.length !== 3) {
            socket.emit('error', `Cannot start game. Waiting for exactly 3 players (currently have ${gameState.players.length}).`);
            return;
        }
        console.log(`[${socket.id}] Host started the game.`);
        // Initialize round
        serverDeck = (0, gameLogic_1.shuffleDeck)((0, gameLogic_1.createDeck)());
        gameState.status = 'playing';
        gameState.phase = 'dealing';
        gameState.dumpPile = [];
        gameState.winnerId = null;
        gameState.winReason = null;
        gameState.fightCallerId = null;
        gameState.fightResponses = {};
        turnHistory = [];
        // Deal cards (Host gets 13, others 12)
        const hostIndex = gameState.players.findIndex(p => p.isHost);
        for (let i = 0; i < 3; i++) {
            const pIndex = (hostIndex + i) % 3;
            gameState.players[pIndex].hand = [];
            gameState.players[pIndex].exposedMelds = [];
            gameState.players[pIndex].hasBahay = false;
            gameState.players[pIndex].fightEligible = false;
            const cardsToDeal = i === 0 ? 13 : 12;
            for (let c = 0; c < cardsToDeal; c++) {
                gameState.players[pIndex].hand.push(serverDeck.pop());
            }
        }
        gameState.turnId = gameState.players[hostIndex].id;
        gameState.phase = 'player_turn';
        gameState.hasDrawnThisTurn = true; // Host already has 13 cards, they just need to discard/play
        broadcastGameState();
        io.emit('gameMessage', 'Game started! Host plays first.');
    });
    socket.on('drawCard', () => {
        const player = gameState.players.find(p => p.socketId === socket.id);
        if (!player || gameState.turnId !== player.id || gameState.hasDrawnThisTurn || gameState.status !== 'playing')
            return;
        if (serverDeck.length === 0) {
            evaluateFight();
            return;
        }
        const card = serverDeck.pop();
        player.hand.push(card);
        gameState.hasDrawnThisTurn = true;
        turnHistory = [];
        broadcastGameState();
    });
    socket.on('pickDump', (targetMeldIndices) => {
        const player = gameState.players.find(p => p.socketId === socket.id);
        if (!player || gameState.turnId !== player.id || gameState.hasDrawnThisTurn || gameState.status !== 'playing')
            return;
        if (gameState.dumpPile.length === 0)
            return;
        const dumpCard = gameState.dumpPile[gameState.dumpPile.length - 1];
        const proposedMeldCards = targetMeldIndices.map(i => player.hand[i]);
        proposedMeldCards.push(dumpCard);
        if ((0, gameLogic_1.isValidMeld)(proposedMeldCards)) {
            turnHistory = []; // Pick dump cannot be undone
            const sortedMeld = (0, gameLogic_1.sortMeld)(proposedMeldCards);
            gameState.dumpPile.pop(); // Remove from dump
            // Remove used cards from hand
            const cardsToRemove = new Set(targetMeldIndices.map(i => player.hand[i].id));
            player.hand = player.hand.filter(c => !cardsToRemove.has(c.id));
            player.exposedMelds.push(sortedMeld);
            player.hasBahay = true;
            player.fightEligible = true;
            gameState.hasDrawnThisTurn = true;
            if (player.hand.length === 0) {
                endRound(player.id, "Tong-its!");
            }
            else {
                broadcastGameState();
            }
        }
        else {
            socket.emit('error', 'Invalid meld combination to pick dump card.');
        }
    });
    socket.on('layMeld', (cardIndices) => {
        const player = gameState.players.find(p => p.socketId === socket.id);
        if (!player || gameState.turnId !== player.id || !gameState.hasDrawnThisTurn || gameState.status !== 'playing')
            return;
        const proposedCards = cardIndices.map(i => player.hand[i]);
        if ((0, gameLogic_1.isValidMeld)(proposedCards)) {
            saveStateSnapshot();
            const sortedMeld = (0, gameLogic_1.sortMeld)(proposedCards);
            // Remove from hand
            const cardsToRemove = new Set(proposedCards.map(c => c.id));
            player.hand = player.hand.filter(c => !cardsToRemove.has(c.id));
            player.exposedMelds.push(sortedMeld);
            player.hasBahay = true;
            player.fightEligible = true;
            if (player.hand.length === 0) {
                endRound(player.id, "Tong-its!");
            }
            else {
                broadcastGameState();
            }
        }
        else {
            socket.emit('error', 'Invalid meld combination.');
        }
    });
    socket.on('sapaw', (cardIndices, targetPlayerId, meldIndex) => {
        const player = gameState.players.find(p => p.socketId === socket.id);
        if (!player || gameState.turnId !== player.id || !gameState.hasDrawnThisTurn || gameState.status !== 'playing')
            return;
        const targetPlayer = gameState.players.find(p => p.id === targetPlayerId);
        if (!targetPlayer || !targetPlayer.exposedMelds[meldIndex]) {
            socket.emit('error', 'Target meld does not exist.');
            return;
        }
        const targetMeld = targetPlayer.exposedMelds[meldIndex];
        const proposedCards = cardIndices.map(i => player.hand[i]);
        const combinedMeld = [...targetMeld, ...proposedCards];
        if ((0, gameLogic_1.isValidMeld)(combinedMeld)) {
            saveStateSnapshot();
            const sortedMeld = (0, gameLogic_1.sortMeld)(combinedMeld);
            // Remove from hand
            const cardsToRemove = new Set(proposedCards.map(c => c.id));
            player.hand = player.hand.filter(c => !cardsToRemove.has(c.id));
            // Update target meld
            targetPlayer.exposedMelds[meldIndex] = sortedMeld;
            targetPlayer.fightEligible = false;
            player.fightEligible = true;
            if (player.hand.length === 0) {
                endRound(player.id, "Tong-its!");
            }
            else {
                broadcastGameState();
            }
        }
        else {
            socket.emit('error', 'Invalid cards for sapaw (does not form a valid meld).');
        }
    });
    socket.on('discardCard', (cardIndex) => {
        const player = gameState.players.find(p => p.socketId === socket.id);
        if (!player || gameState.turnId !== player.id || !gameState.hasDrawnThisTurn || gameState.status !== 'playing')
            return;
        const card = player.hand.splice(cardIndex, 1)[0];
        gameState.dumpPile.push(card);
        if (player.hand.length === 0) {
            endRound(player.id, "Tong-its!");
        }
        else if (serverDeck.length === 0) {
            evaluateFight();
        }
        else {
            nextTurn();
        }
    });
    socket.on('callFight', () => {
        const player = gameState.players.find(p => p.socketId === socket.id);
        if (!player || gameState.turnId !== player.id || gameState.hasDrawnThisTurn || gameState.status !== 'playing')
            return;
        // Can only call fight if they have bahay
        if (!player.hasBahay) {
            socket.emit('error', 'You need an exposed meld (bahay) to call a fight.');
            return;
        }
        if (!player.fightEligible) {
            socket.emit('error', 'Your meld was sapaw-ed! You must lay a new meld before you can call a fight.');
            return;
        }
        io.emit('gameMessage', `${player.name} called a FIGHT!`);
        gameState.phase = 'fight_challenge';
        gameState.fightCallerId = player.id;
        gameState.fightResponses = {};
        // Auto-fold players without bahay
        gameState.players.forEach(p => {
            if (p.id !== player.id) {
                if (!p.hasBahay) {
                    gameState.fightResponses[p.id] = 'fold';
                }
            }
        });
        // If everyone else auto-folded, evaluate immediately
        const totalOpponents = gameState.players.length - 1;
        const respondedCount = Object.keys(gameState.fightResponses).length;
        if (respondedCount === totalOpponents) {
            evaluateFight();
        }
        else {
            broadcastGameState();
        }
    });
    socket.on('respondToFight', (response) => {
        const player = gameState.players.find(p => p.socketId === socket.id);
        if (!player || gameState.phase !== 'fight_challenge' || !gameState.fightResponses)
            return;
        if (player.id === gameState.fightCallerId)
            return; // Caller cannot respond
        if (gameState.fightResponses[player.id])
            return; // Already responded
        gameState.fightResponses[player.id] = response;
        const totalOpponents = gameState.players.length - 1;
        const respondedCount = Object.keys(gameState.fightResponses).length;
        if (respondedCount === totalOpponents) {
            evaluateFight();
        }
        else {
            broadcastGameState();
        }
    });
    socket.on('restartGame', () => {
        const player = gameState.players.find(p => p.socketId === socket.id);
        if (!player || !player.isHost)
            return;
        gameState.status = 'waiting';
        gameState.phase = 'waiting_for_players';
        gameState.turnId = null;
        gameState.winnerId = null;
        gameState.winReason = null;
        gameState.dumpPile = [];
        gameState.hasDrawnThisTurn = false;
        gameState.fightCallerId = null;
        gameState.fightResponses = {};
        turnHistory = [];
        // Reset hands but keep wins intact
        gameState.players.forEach(p => {
            p.hand = [];
            p.exposedMelds = [];
            p.hasBahay = false;
            p.fightEligible = false;
            p.points = 0;
        });
        io.emit('gameMessage', 'The Host has forcefully restarted the game. Waiting to deal again.');
        broadcastGameState();
    });
    socket.on('undo', () => {
        const player = gameState.players.find(p => p.socketId === socket.id);
        if (!player || gameState.turnId !== player.id || gameState.status !== 'playing')
            return;
        if (turnHistory.length > 0) {
            const prevState = turnHistory.pop();
            Object.assign(gameState, prevState);
            broadcastGameState();
        }
    });
});
function getLocalIp() {
    const interfaces = os_1.default.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal)
                return iface.address;
        }
    }
    return 'localhost';
}
httpServer.listen(PORT, () => {
    const ip = getLocalIp();
    const serverUrl = `http://${ip}:${PORT}`;
    console.log(`\n=================================================`);
    console.log(`Tong-its Server running at: \x1b[36m${serverUrl}\x1b[0m`);
    console.log(`To play, everyone on your Wi-Fi can visit that link,`);
    console.log(`or simply scan the QR code below:\n`);
    qrcode_terminal_1.default.generate(serverUrl, { small: true });
    console.log(`=================================================\n`);
});
