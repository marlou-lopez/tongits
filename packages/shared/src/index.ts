export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  id: string; // e.g. "hearts-A"
  suit: Suit;
  rank: Rank;
  value: number; // 1-10 for points
}

export interface Player {
  id: string;
  socketId: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  
  // Game state
  hand: Card[];
  exposedMelds: Card[][];
  hasBahay: boolean;
  fightEligible: boolean;
  points: number;
  wins: number; // For Scoreboard
}

export interface GameState {
  players: Player[];
  status: 'waiting' | 'playing' | 'finished';
  phase: 'waiting_for_players' | 'dealing' | 'player_turn' | 'round_end';
  deckCount: number;
  dumpPile: Card[];
  turnId: string | null;
  winnerId: string | null;
  winReason: string | null;
  hasDrawnThisTurn: boolean;
  canUndo?: boolean;
}

export interface ServerToClientEvents {
  gameStateUpdate: (state: GameState) => void;
  playerJoined: (player: Player) => void;
  playerLeft: (playerId: string) => void;
  error: (message: string) => void;
  gameMessage: (message: string) => void;
}

export interface ClientToServerEvents {
  joinGame: (name: string, callback: (response: { success: boolean, playerId?: string }) => void) => void;
  rejoinGame: (playerId: string, callback: (success: boolean) => void) => void;
  leaveGame: () => void;
  
  // Gameplay Actions
  startGame: () => void;
  drawCard: () => void;
  pickDump: (targetMeldIndices: number[]) => void;
  layMeld: (cardIndices: number[]) => void;
  sapaw: (cardIndices: number[], targetPlayerId: string, meldIndex: number) => void;
  discardCard: (cardIndex: number) => void;
  callFight: () => void;
  restartGame: () => void;
  fold: () => void;
  undo: () => void;
}
