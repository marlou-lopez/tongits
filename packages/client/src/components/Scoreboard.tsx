import type { Player } from '@tongits/shared';

interface Props {
  players: Player[];
  onClose: () => void;
}

export function Scoreboard({ players, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-3">
          <h3 className="text-2xl font-bold text-accent-600">Scoreboard</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors bg-gray-100 hover:bg-gray-200 p-1 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <ul className="flex flex-col gap-3">
          {players.map((p, index) => (
            <li key={p.id} className="flex justify-between items-center bg-[#F8F9FA] p-3 rounded-xl border border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-gray-500 w-6">{index + 1}.</span>
                <span className="font-medium text-gray-800 truncate pr-2 text-lg">
                  {p.name} {p.isHost && <span className="text-sm text-accent-500" title="Host">👑</span>}
                </span>
              </div>
              <span className="bg-accent-100 text-accent-700 px-4 py-1.5 rounded-full font-bold text-sm whitespace-nowrap">
                {p.wins} Wins
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
