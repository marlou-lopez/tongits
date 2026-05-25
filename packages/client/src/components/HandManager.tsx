import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type {
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import type { Card as CardType } from '@tongits/shared';
import { SortableCard } from './SortableCard';

interface HandManagerProps {
  serverHand: CardType[];
  selectedCards: string[];
  onCardClick: (cardId: string) => void;
  isPlaying: boolean;
}

interface GroupDroppableProps {
  id: string;
  items: CardType[];
  selectedCards: string[];
  onCardClick: (cardId: string) => void;
  onSort: (groupId: string, type: 'suit' | 'rank') => void;
  onRemove?: (groupId: string) => void;
  isEmptyPlaceholder?: boolean;
}

function DroppableGroup({ id, items, selectedCards, onCardClick, onSort, onRemove, isEmptyPlaceholder }: GroupDroppableProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="relative group">
      <div className="absolute -top-3 right-0 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-20 bg-gray-900 rounded-md border border-gray-700 shadow-xl p-1">
        {items.length > 1 && (
          <button onClick={() => onSort(id, 'rank')} className="p-1 bg-gray-800 hover:bg-accent-600 rounded text-gray-300 transition-colors" title="Sort Hand">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"></path>
              <path d="M7 12h10"></path>
              <path d="M10 18h4"></path>
            </svg>
          </button>
        )}
        {onRemove && (
          <button onClick={() => onRemove(id)} className="p-1 bg-gray-800 hover:bg-red-600 rounded text-gray-300 transition-colors" title="Remove Zone">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"></path>
            </svg>
          </button>
        )}
      </div>
      <div 
        ref={setNodeRef}
        className={`flex flex-col justify-center items-center mx-1 rounded-xl transition-colors border-2 ${
          isEmptyPlaceholder 
            ? `w-16 h-24 sm:w-20 sm:h-28 md:w-24 md:h-36 ${isOver ? 'bg-accent-50 border-accent-400 border-dashed' : 'bg-transparent border-dashed border-gray-300'}`
            : `min-w-[60px] md:min-w-[120px] min-h-[5rem] md:min-h-[10rem] p-1 md:p-2 ${isOver ? 'bg-accent-50 border-accent-400 border-dashed' : 'bg-gray-50 border-transparent'}`
        }`}
      >
      <SortableContext id={id} items={items.map(c => c.id)} strategy={rectSortingStrategy}>
        <div className={`flex flex-wrap justify-center items-center w-full h-full ${isEmptyPlaceholder ? '' : 'gap-y-2 pl-10 sm:pl-12 md:pl-14 py-2'}`}>
          {items.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              isSelected={selectedCards.includes(card.id)}
              onClick={() => onCardClick(card.id)}
              className={`w-16 h-24 sm:w-20 sm:h-28 md:w-24 md:h-36 text-xs sm:text-sm md:text-xl shrink-0 cursor-grab active:cursor-grabbing ${isEmptyPlaceholder ? '' : '-ml-10 sm:-ml-12 md:-ml-14'}`}
            />
          ))}
          {items.length === 0 && isEmptyPlaceholder && (
            <span className="text-gray-400 text-xs md:text-sm text-center">Drop</span>
          )}
        </div>
      </SortableContext>
      </div>
    </div>
  );
}

export function HandManager({ serverHand, selectedCards, onCardClick, isPlaying }: HandManagerProps) {
  const [groups, setGroups] = useState<Record<string, CardType[]>>({
    'group-0': serverHand || []
  });

  const handleAddZone = () => {
    const newId = `group-${Date.now()}`;
    setGroups(prev => ({ ...prev, [newId]: [] }));
  };

  const handleRemoveZone = (id: string) => {
    setGroups(prev => {
      const newGroups = { ...prev };
      const itemsToMove = newGroups[id] || [];
      delete newGroups[id];
      newGroups['group-0'] = [...newGroups['group-0'], ...itemsToMove];
      return newGroups;
    });
  };

  const extraGroups = Object.keys(groups).filter(k => k !== 'group-0');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Sync with server state
  useEffect(() => {
    if (!serverHand) return;
    
    const serverCardIds = new Set(serverHand.map(c => c.id));
    const newGroups = { ...groups };
    let changed = false;

    // 1. Remove played/discarded cards
    for (const groupId in newGroups) {
      const filtered = newGroups[groupId].filter(c => serverCardIds.has(c.id));
      if (filtered.length !== newGroups[groupId].length) {
        newGroups[groupId] = filtered;
        changed = true;
      }
    }

    // 2. Add newly drawn cards
    const localCardIds = new Set(Object.values(newGroups).flat().map(c => c.id));
    const newCards = serverHand.filter(c => !localCardIds.has(c.id));
    
    if (newCards.length > 0) {
      newGroups['group-0'] = [...newGroups['group-0'], ...newCards];
      changed = true;
    }

    if (changed) {
      setGroups(newGroups);
    }
  }, [serverHand]);

  const handleSort = (groupId: string, type: 'suit' | 'rank') => {
    setGroups(prev => {
      const groupItems = [...prev[groupId]];
      const rankOrder: Record<string, number> = { 'A':1, '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, '10':10, 'J':11, 'Q':12, 'K':13 };
      const suitOrder: Record<string, number> = { 'spades':1, 'hearts':2, 'clubs':3, 'diamonds':4 };
      
      groupItems.sort((a, b) => {
        if (type === 'rank') {
          if (rankOrder[a.rank] !== rankOrder[b.rank]) return rankOrder[a.rank] - rankOrder[b.rank];
          return suitOrder[a.suit] - suitOrder[b.suit];
        } else {
          if (suitOrder[a.suit] !== suitOrder[b.suit]) return suitOrder[a.suit] - suitOrder[b.suit];
          return rankOrder[a.rank] - rankOrder[b.rank];
        }
      });
      return { ...prev, [groupId]: groupItems };
    });
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    // Find which groups contain the active and over items
    let activeGroupId = Object.keys(groups).find(k => groups[k].some(c => c.id === activeId));
    let overGroupId = Object.keys(groups).find(k => k === overId || groups[k].some(c => c.id === overId));

    if (!activeGroupId || !overGroupId || activeGroupId === overGroupId) return;

    setGroups(prev => {
      const activeItems = prev[activeGroupId!];
      const overItems = prev[overGroupId!];
      const activeIndex = activeItems.findIndex(c => c.id === activeId);
      const overIndex = overItems.findIndex(c => c.id === overId);
      
      const newActive = [...activeItems];
      const newOver = [...overItems];
      const [item] = newActive.splice(activeIndex, 1);
      
      if (overIndex >= 0) {
        newOver.splice(overIndex, 0, item);
      } else {
        newOver.push(item);
      }

      return {
        ...prev,
        [activeGroupId!]: newActive,
        [overGroupId!]: newOver,
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeGroupId = Object.keys(groups).find(k => groups[k].some(c => c.id === activeId));
    
    if (activeGroupId && activeId !== overId) {
      const activeIndex = groups[activeGroupId].findIndex(c => c.id === activeId);
      const overIndex = groups[activeGroupId].findIndex(c => c.id === overId);

      if (activeIndex !== overIndex && overIndex !== -1) {
        setGroups(prev => ({
          ...prev,
          [activeGroupId]: arrayMove(prev[activeGroupId], activeIndex, overIndex)
        }));
      }
    }
  };

  if (!serverHand || serverHand.length === 0) {
    return isPlaying ? <span className="text-gray-500 italic text-xl p-8">No cards in hand</span> : null;
  }

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={closestCenter} 
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-2 md:gap-6 w-full items-center">
        {/* Extra Zones (Top Row) */}
        <div className="flex flex-wrap w-full justify-center items-center gap-2 md:gap-4 px-2">
          {extraGroups.map((groupId) => (
            <DroppableGroup 
              key={groupId} 
              id={groupId} 
              items={groups[groupId] || []} 
              selectedCards={selectedCards} 
              onCardClick={onCardClick} 
              onSort={handleSort}
              onRemove={handleRemoveZone}
              isEmptyPlaceholder={(groups[groupId] || []).length === 0}
            />
          ))}
          {extraGroups.length < 5 && (
            <button 
              onClick={(e) => {
                handleAddZone();
                e.currentTarget.blur();
              }}
              className={`w-16 h-24 sm:w-20 sm:h-28 md:w-24 md:h-36 border-2 border-dashed rounded-xl flex items-center justify-center transition-colors mx-1 focus:outline-none focus:ring-0 ${
                extraGroups.some(groupId => (groups[groupId] || []).length === 0)
                  ? 'border-gray-300 text-gray-400 cursor-not-allowed opacity-50'
                  : 'border-gray-300 hover:border-accent-500 text-gray-400 hover:text-accent-500'
              }`}
              title="Add Drop Zone"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"></path>
              </svg>
            </button>
          )}
        </div>

        {/* Main Pile (Bottom Row) */}
        <div className="flex flex-wrap w-full pb-4 pt-2 justify-center px-2">
          <DroppableGroup 
            id="group-0" 
            items={groups['group-0'] || []} 
            selectedCards={selectedCards} 
            onCardClick={onCardClick} 
            onSort={handleSort}
            isEmptyPlaceholder={(groups['group-0'] || []).length === 0}
          />
        </div>
      </div>
    </DndContext>
  );
}
