import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import type { GameState, ServerToClientEvents, ClientToServerEvents, Card as CardType } from '@tongits/shared';

function getMeldLabel(meld: CardType[]) {
  if (!meld || meld.length === 0) return null;
  const isSet = meld.every(c => c.rank === meld[0].rank);
  if (isSet) {
    return null;
  } else {
    const first = meld[0];
    const last = meld[meld.length - 1];
    const suitSymbol = first.suit === 'hearts' ? '♥' : first.suit === 'diamonds' ? '♦' : first.suit === 'clubs' ? '♣' : '♠';
    return `${first.rank}-${last.rank} ${suitSymbol}`;
  }
}
import { Card } from './Card';
import { Scoreboard } from './Scoreboard';
import { HandManager } from './HandManager';

interface Props {
  gameState: GameState;
  socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  playerId: string;
}

export function GameBoard({ gameState, socket, playerId }: Props) {
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [selectedMeld, setSelectedMeld] = useState<{ playerId: string, meldIndex: number } | null>(null);
  const [isDumpSelected, setIsDumpSelected] = useState(false);
  const [isScoreboardOpen, setIsScoreboardOpen] = useState(false);
  
  const currentPlayer = gameState.players.find(p => p.id === playerId);
  const opponents = gameState.players.filter(p => p.id !== playerId);
  
  const isMyTurn = gameState.turnId === playerId;
  const isPlaying = gameState.status === 'playing';
  
  useEffect(() => {
    if (!isMyTurn || gameState.hasDrawnThisTurn) {
      setIsDumpSelected(false);
    }
  }, [isMyTurn, gameState.hasDrawnThisTurn]);
  
  const handleCardClick = (cardId: string) => {
    if (selectedCardIds.includes(cardId)) {
      setSelectedCardIds(selectedCardIds.filter(id => id !== cardId));
    } else {
      setSelectedCardIds([...selectedCardIds, cardId]);
    }
  };

  const getServerIndices = (cardIds: string[]) => {
    return cardIds.map(id => currentPlayer!.hand.findIndex(c => c.id === id)).filter(i => i !== -1);
  };

  const handleDrawDeck = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsDumpSelected(false);
    if (!isMyTurn) return;
    socket.emit('drawCard');
  };

  const handleToggleDump = () => {
    if (!isMyTurn || gameState.hasDrawnThisTurn || !gameState.dumpPile || gameState.dumpPile.length === 0) return;
    setIsDumpSelected(!isDumpSelected);
  };

  const handleLayMeld = () => {
    if (!isMyTurn) return;
    if (isDumpSelected) {
      if (selectedCardIds.length < 2) return;
      socket.emit('pickDump', getServerIndices(selectedCardIds));
      setIsDumpSelected(false);
    } else {
      if (selectedCardIds.length < 3) return;
      socket.emit('layMeld', getServerIndices(selectedCardIds));
    }
    setSelectedCardIds([]);
  };

  const handleSapaw = () => {
    if (!isMyTurn || selectedCardIds.length === 0 || !selectedMeld) return;
    socket.emit('sapaw', getServerIndices(selectedCardIds), selectedMeld.playerId, selectedMeld.meldIndex);
    setSelectedCardIds([]);
    setSelectedMeld(null);
  };

  const handleUndo = () => {
    if (!isMyTurn || !gameState.canUndo) return;
    socket.emit('undo');
    setSelectedCardIds([]);
    setSelectedMeld(null);
  };

  const handleDiscard = () => {
    if (!isMyTurn || selectedCardIds.length !== 1) return;
    socket.emit('discardCard', getServerIndices(selectedCardIds)[0]);
    setSelectedCardIds([]);
  };

  const handleCallFight = () => {
    if (!isMyTurn) return;
    socket.emit('callFight');
  };

  const handleStartGame = () => {
    socket.emit('startGame');
  };

  const handleRespondToFight = (response: 'fold' | 'challenge') => {
    socket.emit('respondToFight', response);
  };

  if (!currentPlayer) return <div>Loading...</div>;

  const handleBackgroundClick = () => {
    setSelectedCardIds([]);
    setSelectedMeld(null);
    setIsDumpSelected(false);
  };

  return (
    <div className="flex flex-col w-full max-w-[1400px]" onClick={handleBackgroundClick}>
      <div className="flex justify-end mb-4 pr-2 md:pr-0">
        <button onClick={() => setIsScoreboardOpen(true)} className="bg-white hover:bg-gray-50 text-accent-600 border border-gray-200 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm backdrop-blur-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="hidden sm:inline">Scoreboard</span>
        </button>
      </div>

      {/* Game Arena - Only visible when playing */}
      {(gameState.phase === 'player_turn' || gameState.phase === 'dealing' || gameState.phase === 'fight_challenge') && (
        <div className="flex-1 flex flex-col justify-between bg-white rounded-xl p-2 sm:p-4 md:p-8 border border-gray-200 shadow-xl relative min-h-[600px] lg:min-h-[700px] overflow-hidden">
          {/* Fight Challenge Modal Overlay */}
          {gameState.phase === 'fight_challenge' && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
              <div className="bg-white border-2 border-orange-500 rounded-2xl shadow-[0_0_50px_rgba(249,115,22,0.3)] p-8 max-w-2xl w-full text-center">
                <h2 className="text-3xl md:text-5xl font-black text-orange-600 mb-6 drop-shadow-sm">FIGHT IN PROGRESS!</h2>
                
                {gameState.fightCallerId === currentPlayer.id ? (
                  <p className="text-xl md:text-2xl text-gray-800 animate-pulse font-bold">Waiting for opponents to respond...</p>
                ) : gameState.fightResponses?.[currentPlayer.id] ? (
                  <div className="flex flex-col items-center">
                    <p className="text-xl md:text-2xl text-gray-800 mb-4 font-bold">
                      You chose to {gameState.fightResponses[currentPlayer.id].toUpperCase()}.
                    </p>
                    <p className="text-lg text-gray-500 animate-pulse">Waiting for other players...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <p className="text-xl md:text-2xl text-gray-800 mb-8 font-bold leading-relaxed">
                      <span className="text-accent-600 text-3xl uppercase tracking-wider">{gameState.players.find(p => p.id === gameState.fightCallerId)?.name}</span><br/>called a FIGHT!
                    </p>
                    <div className="flex gap-4 md:gap-8 w-full justify-center">
                      <button onClick={() => handleRespondToFight('challenge')} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 md:px-10 md:py-5 rounded-xl font-black text-lg md:text-2xl shadow-lg transition-transform hover:-translate-y-1 flex-1">
                        CHALLENGE
                      </button>
                      <button onClick={() => handleRespondToFight('fold')} className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 md:px-10 md:py-5 rounded-xl font-black text-lg md:text-2xl shadow-lg transition-transform hover:-translate-y-1 flex-1">
                        FOLD
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        
        {/* Opponents Area */}
        <div className="flex justify-between min-h-[12rem] md:min-h-[16rem] h-auto mb-4">
          {opponents.map(opp => (
            <div key={opp.id} className={`flex flex-col items-center p-2 md:p-4 rounded-xl transition-all duration-500 min-w-[100px] sm:min-w-[150px] md:min-w-[200px] relative ${gameState.turnId === opp.id ? 'bg-accent-50 border-2 border-accent-500 shadow-[0_0_20px_rgba(101,82,173,0.3)] ring-4 ring-accent-500/20 scale-[1.02] z-10' : 'bg-[#F8F9FA] border border-gray-200 opacity-60 scale-95 hover:opacity-80'}`}>
              <span className={`font-bold mb-2 text-xs md:text-base text-center transition-colors ${gameState.turnId === opp.id ? 'text-accent-700' : 'text-gray-600'}`}>
                {opp.name}
              </span>
              <div className="flex flex-col items-center mt-1">
                {Array.from({ length: Math.ceil((opp.hand?.length || 0) / 7) }).map((_, rIdx) => (
                  <div key={rIdx} className={`flex -space-x-6 md:-space-x-12 ${rIdx > 0 ? '-mt-8 md:-mt-16 z-10' : 'z-0'}`}>
                    {opp.hand?.slice(rIdx * 7, (rIdx + 1) * 7).map((card, i) => (
                      <Card key={i} card={card} className="w-10 h-14 md:w-20 md:h-28 text-[0.5rem] md:text-base shadow-sm" />
                    ))}
                  </div>
                ))}
              </div>
              {opp.exposedMelds && opp.exposedMelds.length > 0 && (
                <div className="mt-2 md:mt-4 flex flex-wrap justify-center max-w-full gap-3 md:gap-6">
                  {opp.exposedMelds.map((meld, mi) => {
                    const isSelected = selectedMeld?.playerId === opp.id && selectedMeld?.meldIndex === mi;
                    const label = getMeldLabel(meld);
                    return (
                      <div key={mi} className="flex flex-col items-center group relative mb-8 md:mb-16">
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isSelected) {
                              setSelectedMeld(null);
                            } else {
                              setSelectedMeld({ playerId: opp.id, meldIndex: mi });
                            }
                          }}
                          className={`flex -space-x-6 md:-space-x-12 cursor-pointer transition-all ${isSelected ? 'ring-[3px] md:ring-[8px] ring-accent-500 rounded-xl scale-110' : 'hover:scale-105'}`}
                        >
                          {meld?.map((c, ci) => <Card key={ci} card={c} className="w-10 h-14 md:w-20 md:h-28 text-[0.5rem] md:text-base" />)}
                        </div>
                        {label && (
                          <div className="absolute -bottom-6 md:-bottom-14 text-sm md:text-3xl font-bold text-accent-600 bg-white px-3 md:px-6 py-1 md:py-2 rounded-full border border-gray-200 opacity-70 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none shadow-md">
                            {label}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Center Area (Deck & Dump) */}
        <div className="flex justify-center items-center gap-8 sm:gap-16 md:gap-24 my-8 md:my-12 mt-10 md:mt-12" onClick={e => { e.stopPropagation(); setIsDumpSelected(false); }}>
          <div className="flex flex-col items-center relative w-24 md:w-36">
            <span className="absolute -top-6 md:-top-8 text-gray-500 font-bold text-[10px] md:text-sm tracking-widest uppercase whitespace-nowrap">Main Deck ({gameState.deckCount})</span>
            <div onClick={handleDrawDeck} className={`relative ${isMyTurn && !gameState.hasDrawnThisTurn ? 'cursor-pointer hover:scale-[0.80] md:hover:scale-105 hover:-translate-y-2 rounded-xl' : isMyTurn ? 'opacity-50 cursor-not-allowed' : 'opacity-70'} transition-all duration-300 scale-75 md:scale-100`}>
              <div className="w-24 h-36 bg-indigo-50 border border-indigo-200 rounded-xl shadow-md flex items-center justify-center overflow-hidden">
                <span className="text-indigo-200 font-black text-4xl">T</span>
              </div>
              <div className="absolute top-1 left-1 w-24 h-36 bg-indigo-50 border border-indigo-200 rounded-xl -z-10 shadow-sm"></div>
              <div className="absolute top-2 left-2 w-24 h-36 bg-indigo-50 border border-indigo-200 rounded-xl -z-20 shadow-sm"></div>
            </div>
          </div>
          
          <div className="flex flex-col items-center relative w-24 md:w-36">
            <span className="absolute -top-6 md:-top-8 text-gray-500 font-bold text-[10px] md:text-sm tracking-widest uppercase whitespace-nowrap">Dump Pile</span>
            <div onClick={(e) => { e.stopPropagation(); handleToggleDump(); }} className={`${isDumpSelected ? 'cursor-pointer -translate-y-2 md:-translate-y-4 ring-[4px] md:ring-[6px] ring-accent-400 rounded-xl scale-90 md:scale-110 shadow-lg z-20' : isMyTurn && !gameState.hasDrawnThisTurn && gameState.dumpPile && gameState.dumpPile.length > 0 ? 'cursor-pointer hover:-translate-y-2 rounded-xl shadow-md' : isMyTurn ? 'opacity-50' : ''} transition-all duration-300 scale-75 md:scale-100`}>
              {gameState.dumpPile && gameState.dumpPile.length > 0 ? (
                <Card card={gameState.dumpPile[gameState.dumpPile.length - 1]} className="w-24 h-36 text-xl shadow-md" />
              ) : (
                <div className="w-24 h-36 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center bg-gray-50">
                  <span className="text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-wider text-center px-2">Empty</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Player's Hand Area */}
        <div className={`flex flex-col items-center mt-auto w-full pt-4 pb-2 px-2 md:px-4 rounded-2xl transition-all duration-500 relative ${isMyTurn ? 'bg-gradient-to-t from-accent-100/40 to-transparent border-t-[3px] border-accent-500 shadow-[0_-15px_30px_rgba(101,82,173,0.15)]' : 'opacity-80'}`}>
          {isMyTurn && (
             <div className="absolute -top-4 md:-top-5 bg-accent-500 text-white text-[10px] md:text-sm font-bold px-4 py-1 rounded-full shadow-lg tracking-widest uppercase z-10">
               Your Turn
             </div>
          )}
          <div className="w-full flex flex-col md:flex-row justify-between items-center md:items-end mb-4 md:mb-8 px-2 md:px-4 gap-4">
            
            {/* Exposed Melds (Player) */}
            <div className="flex gap-2 md:gap-4 flex-wrap justify-center w-full md:w-auto">
              {currentPlayer.exposedMelds?.map((meld, mi) => {
                const isSelected = selectedMeld?.playerId === currentPlayer.id && selectedMeld?.meldIndex === mi;
                const label = getMeldLabel(meld);
                return (
                  <div key={mi} className="flex flex-col items-center group relative mt-4 md:mt-0">
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isSelected) {
                          setSelectedMeld(null);
                        } else {
                          setSelectedMeld({ playerId: currentPlayer.id, meldIndex: mi });
                        }
                      }}
                      className={`flex -space-x-8 md:-space-x-12 cursor-pointer transition-all ${isSelected ? 'ring-[4px] md:ring-[8px] ring-accent-500 rounded-xl scale-105' : 'hover:-translate-y-2'}`}
                    >
                      {meld?.map((c, ci) => <Card key={ci} card={c} className="w-12 h-16 sm:w-16 sm:h-24 md:w-20 md:h-28 text-[0.6rem] sm:text-xs md:text-base shadow-sm" />)}
                    </div>
                    {label && (
                      <div className="absolute -bottom-4 md:-bottom-6 text-xs md:text-base font-bold text-accent-600 bg-white px-2 md:px-3 py-0.5 md:py-1 rounded-full border border-gray-200 opacity-70 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none shadow-md">
                        {label}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            
            {/* Actions */}
            <div className="flex gap-2 md:gap-3 flex-wrap justify-center w-full md:w-auto">
              <button onClick={handleLayMeld} disabled={!isMyTurn || (isDumpSelected ? selectedCardIds.length < 2 : selectedCardIds.length < 3)} className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 text-white px-3 py-2 md:px-6 md:py-3 rounded-lg font-bold text-sm md:text-base transition-colors shadow-sm flex-1 md:flex-none">
                Bahay
              </button>
              <button onClick={handleSapaw} disabled={!isMyTurn || isDumpSelected || selectedCardIds.length === 0 || !selectedMeld} className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-200 disabled:text-gray-400 text-white px-3 py-2 md:px-6 md:py-3 rounded-lg font-bold text-sm md:text-base transition-colors shadow-sm flex-1 md:flex-none">
                Sapaw
              </button>
              <button onClick={handleDiscard} disabled={!isMyTurn || selectedCardIds.length !== 1} className="bg-red-500 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 text-white px-3 py-2 md:px-6 md:py-3 rounded-lg font-bold text-sm md:text-base transition-colors shadow-sm flex-1 md:flex-none">
                Tapon
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleUndo(); }} disabled={!isMyTurn || !gameState.canUndo} className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-200 disabled:text-gray-400 text-white px-3 py-2 md:px-6 md:py-3 rounded-lg font-bold text-sm md:text-base transition-colors shadow-sm flex-1 md:flex-none">
                Undo
              </button>
              <button onClick={handleCallFight} disabled={!isMyTurn || gameState.hasDrawnThisTurn || !currentPlayer.hasBahay || !currentPlayer.fightEligible} className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white px-3 py-2 md:px-6 md:py-3 rounded-lg font-bold text-sm md:text-base transition-colors shadow-sm w-full md:w-auto mt-2 md:mt-0">
                FIGHT!
              </button>
            </div>
          </div>
          
          <HandManager 
            serverHand={currentPlayer.hand} 
            selectedCards={selectedCardIds} 
            onCardClick={handleCardClick} 
            isPlaying={isPlaying} 
          />
        </div>

        </div>
      )}

      {/* Standalone Overlays */}
      {gameState.phase === 'waiting_for_players' && (
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-xl p-8 border border-gray-200 shadow-xl min-h-[50vh]">
          {currentPlayer.isHost ? (
            <button onClick={handleStartGame} className="bg-accent-500 hover:bg-accent-600 px-6 py-3 md:px-10 md:py-5 rounded-xl font-bold text-white text-xl md:text-2xl shadow-md transition-all hover:-translate-y-1">
              Start Game
            </button>
          ) : (
            <span className="text-lg md:text-2xl text-gray-800 font-bold animate-pulse text-center">Waiting for host to start...</span>
          )}
        </div>
      )}



      {gameState.phase === 'round_end' && (
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-xl p-8 border border-gray-200 shadow-xl min-h-[50vh] text-center">
          {gameState.winnerId === currentPlayer.id ? (
            <h2 className="text-4xl md:text-6xl font-black text-accent-600 mb-4 md:mb-6 drop-shadow-sm">🎉 YOU WON! 🎉</h2>
          ) : (
            <h2 className="text-4xl md:text-6xl font-black text-accent-600 mb-4 md:mb-6 drop-shadow-sm">Round Ended!</h2>
          )}
          <p className="text-lg md:text-2xl text-gray-800 mb-6 md:mb-8 max-w-2xl leading-relaxed bg-[#F8F9FA] p-4 md:p-6 rounded-2xl border border-gray-200 shadow-sm">{gameState.winReason}</p>
          
          <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-md p-6 mb-8">
            <h3 className="text-xl font-black text-gray-800 mb-4 uppercase tracking-wide border-b border-gray-100 pb-2 text-left">Final Points</h3>
            <ul className="space-y-3">
              {gameState.players.slice().sort((a, b) => a.points - b.points).map((p) => (
                <li key={p.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                  <span className={`font-bold text-lg ${p.id === gameState.winnerId ? 'text-accent-600' : 'text-gray-700'}`}>
                    {p.name} {p.id === gameState.winnerId && '👑'}
                  </span>
                  <span className="font-mono font-black text-xl text-gray-800 bg-white px-3 py-1 rounded-md shadow-sm border border-gray-200">
                    {p.points}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {currentPlayer.isHost ? (
            <button onClick={handleStartGame} className="bg-accent-500 hover:bg-accent-600 text-white px-6 py-3 md:px-10 md:py-5 rounded-xl font-bold text-xl md:text-2xl shadow-md transition-all hover:-translate-y-1">
              Start Next Round
            </button>
          ) : (
            <span className="text-sm md:text-xl text-gray-500 animate-pulse font-medium">Waiting for host to start next round...</span>
          )}
        </div>
      )}

      {isScoreboardOpen && <Scoreboard players={gameState.players} onClose={() => setIsScoreboardOpen(false)} />}
    </div>
  )
}
