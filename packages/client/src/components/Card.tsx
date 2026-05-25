import { motion } from 'framer-motion';
import type { Card as CardType } from '@tongits/shared';

interface Props {
  card: CardType;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Card({ card, isSelected, onClick, className = '' }: Props) {
  const isHidden = card.id === 'hidden';
  const widthClass = className.includes('w-') ? '' : 'w-20';
  const heightClass = className.includes('h-') ? '' : 'h-28';
  
  return (
    <motion.div
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
      whileHover={onClick ? { y: -10 } : {}}
      animate={{ y: isSelected ? -20 : 0 }}
      layout
      className={`relative ${widthClass} ${heightClass} flex-shrink-0 rounded-lg shadow-sm border-2 bg-white flex flex-col justify-between py-1 px-1 sm:py-1.5 sm:px-2 md:py-2 md:px-2.5
        ${onClick ? 'cursor-pointer' : ''}
        ${isSelected ? 'border-accent-500 shadow-accent-500/50' : 'border-gray-200'}
        ${isHidden ? 'bg-indigo-50 border-indigo-200' : ''}
        ${className}`}
    >
      {isHidden ? (
        <div className="w-full h-full border border-indigo-200 rounded bg-indigo-100/50 flex items-center justify-center opacity-80">
          <span className="text-indigo-300/50 font-black text-xl md:text-2xl">T</span>
        </div>
      ) : (
        <>
          <div className={`flex flex-col items-center w-fit leading-none ${['hearts', 'diamonds'].includes(card.suit) ? 'text-red-500' : 'text-slate-800'}`}>
            <span className="text-[0.8em] font-bold">{card.rank}</span>
            <span className="text-[1.2em] -mt-[0.1em]">{card.suit === 'hearts' ? '♥' : card.suit === 'diamonds' ? '♦' : card.suit === 'clubs' ? '♣' : '♠'}</span>
          </div>
          <div className={`text-[2.5em] text-center self-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20 ${['hearts', 'diamonds'].includes(card.suit) ? 'text-red-500' : 'text-slate-800'}`}>
            {card.suit === 'hearts' ? '♥' : card.suit === 'diamonds' ? '♦' : card.suit === 'clubs' ? '♣' : '♠'}
          </div>
          <div className={`flex flex-col items-center w-fit leading-none self-end rotate-180 ${['hearts', 'diamonds'].includes(card.suit) ? 'text-red-500' : 'text-slate-800'}`}>
            <span className="text-[0.8em] font-bold">{card.rank}</span>
            <span className="text-[1.2em] -mt-[0.1em]">{card.suit === 'hearts' ? '♥' : card.suit === 'diamonds' ? '♦' : card.suit === 'clubs' ? '♣' : '♠'}</span>
          </div>
        </>
      )}
    </motion.div>
  )
}
