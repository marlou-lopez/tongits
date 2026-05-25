import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card as CardType } from '@tongits/shared';
import { Card } from './Card';

interface Props {
  card: CardType;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function SortableCard({ card, isSelected, onClick, className }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, data: card });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none flex-shrink-0">
      <Card 
        card={card} 
        isSelected={isSelected} 
        onClick={onClick} 
        className={className} 
      />
    </div>
  );
}
