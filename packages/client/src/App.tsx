import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import type { GameState, ServerToClientEvents, ClientToServerEvents } from '@tongits/shared'
import { GameBoard } from './components/GameBoard'

const SERVER_URL = `http://${window.location.hostname}:3000`;
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL);
const STORAGE_KEY = 'tongits_player_id';

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [joined, setJoined] = useState(false);
  const [spectator, setSpectator] = useState(false);
  const [gameMessage, setGameMessage] = useState('');

  // Attempt to auto-rejoin if we have a token
  useEffect(() => {
    const savedPlayerId = localStorage.getItem(STORAGE_KEY);
    if (savedPlayerId && isConnected && !joined) {
      socket.emit('rejoinGame', savedPlayerId, (success) => {
        if (success) setJoined(true);
        else localStorage.removeItem(STORAGE_KEY);
      });
    }
  }, [isConnected, joined]);

  useEffect(() => {
    function onConnect() { setIsConnected(true); }
    function onDisconnect() { setIsConnected(false); }
    function onGameStateUpdate(state: GameState) { setGameState(state); }
    function onGameMessage(msg: string) {
      setGameMessage(msg);
      setTimeout(() => setGameMessage(''), 5000);
    }
    function onError(msg: string) {
      alert(msg);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('gameStateUpdate', onGameStateUpdate);
    socket.on('gameMessage', onGameMessage);
    socket.on('error', onError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('gameStateUpdate', onGameStateUpdate);
      socket.off('gameMessage', onGameMessage);
      socket.off('error', onError);
    };
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    socket.emit('joinGame', playerName, (response) => {
      if (response.success && response.playerId) {
        localStorage.setItem(STORAGE_KEY, response.playerId);
        setJoined(true);
        setSpectator(false);
      } else {
        setSpectator(true);
      }
    });
  };

  const handleLeave = () => {
    if (window.confirm("Are you sure you want to leave the game?")) {
      socket.emit('leaveGame');
      localStorage.removeItem(STORAGE_KEY);
      setJoined(false);
      setSpectator(false);
      setPlayerName('');
    }
  };

  const handleRestart = () => {
    if (window.confirm("Are you sure you want to abort the current round and restart the game?")) {
      socket.emit('restartGame');
    }
  };

  const playerId = localStorage.getItem(STORAGE_KEY) || '';

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-900 flex flex-col items-center p-4 overflow-hidden">
      {/* Header */}
      <div className="w-full max-w-[1400px] flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0 mb-4 md:mb-6">
        <h1 className="text-2xl md:text-3xl font-black text-accent-600 tracking-wider drop-shadow-sm">TONG-ITS</h1>
        <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-center">
          <div className="text-xs md:text-sm font-mono bg-white px-2 py-1 md:px-3 md:py-1 rounded-full border border-gray-200 shadow-sm">
            {isConnected ? <span className="text-accent-500 font-medium">● <span className="hidden sm:inline">Connected</span></span> : <span className="text-red-500 font-medium">● <span className="hidden sm:inline">Disconnected</span></span>}
          </div>
          {joined && (
            <div className="flex gap-2">
              {gameState?.players.find(p => p.id === playerId)?.isHost && (
                <button onClick={handleRestart} className="text-[10px] md:text-xs text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 px-2 md:px-3 py-1 rounded-full transition-colors border border-yellow-200 bg-white shadow-sm font-bold">
                  Restart
                </button>
              )}
              <button onClick={handleLeave} className="text-[10px] md:text-xs text-red-500 hover:text-red-600 hover:bg-red-50 px-2 md:px-3 py-1 rounded-full transition-colors border border-red-200 bg-white shadow-sm font-bold">
                Leave
              </button>
            </div>
          )}
        </div>
      </div>

      {gameMessage && (
        <div className="fixed top-20 z-50 bg-indigo-600 text-white px-8 py-4 rounded-full shadow-[0_0_30px_rgba(79,70,229,0.5)] font-bold text-lg">
          {gameMessage}
        </div>
      )}

      {!joined && !spectator ? (
        <div className="flex-1 flex flex-col items-center justify-center w-full gap-8">
          <form onSubmit={handleJoin} className="flex flex-col gap-6 w-full max-w-sm bg-white p-8 rounded-2xl border border-gray-200 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent-400 to-accent-500"></div>
            <h2 className="text-2xl font-bold text-center text-gray-800">Join the Lobby</h2>
            <input 
              type="text" 
              placeholder="Enter your name" 
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="p-4 rounded-xl bg-[#F8F9FA] border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all text-lg"
            />
            <button type="submit" className="bg-accent-500 hover:bg-accent-600 p-4 rounded-xl font-bold text-white text-lg transition-all hover:-translate-y-1 shadow-md hover:shadow-lg">
              Join Game
            </button>
          </form>

          {gameState && gameState.players.length > 0 && (
            <div className="w-full max-w-sm bg-white p-6 rounded-2xl border border-gray-200 shadow-md">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Players on server ({gameState.players.length}/3)</h3>
              <div className="flex flex-col gap-3">
                {gameState.players.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-[#F8F9FA] p-3 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${p.connected ? 'bg-accent-500 shadow-[0_0_8px_rgba(101,82,173,0.4)]' : 'bg-red-500'}`}></div>
                      <span className="font-bold text-gray-800">{p.name}</span>
                    </div>
                    {p.isHost && (
                      <span className="text-[10px] bg-accent-50 text-accent-600 border border-accent-100 px-2 py-1 rounded uppercase tracking-wider font-bold">Host</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : spectator ? (
        <div className="flex-1 flex items-center justify-center w-full">
          <div className="text-2xl text-yellow-400 font-bold p-8 bg-yellow-400/10 rounded-2xl border border-yellow-400/20 shadow-xl">
            You are spectating (Game is full)
          </div>
        </div>
      ) : gameState ? (
        <div className="w-full flex-1 flex justify-center pb-8">
          <GameBoard gameState={gameState} socket={socket} playerId={playerId} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center w-full">
          <span className="text-gray-500 animate-pulse text-xl font-medium">Loading game state...</span>
        </div>
      )}
    </div>
  )
}

export default App
