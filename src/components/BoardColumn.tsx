import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MoreHorizontal, MessageSquare, Paperclip, Calendar } from 'lucide-react';
import CardDetailDrawer from './CardDetailDrawer';
import { notifyAction } from '../lib/notify';

interface Card {
  id: string;
  title: string;
  priority: string;
  assignee: string;
  tags: string[];
  comments: number;
  attachments: number;
  dueDate: string;
}

interface Column {
  id: string;
  title: string;
  color: string;
  cards: Card[];
}

interface BoardColumnProps {
  column: Column;
}

const priorityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-emerald-100 text-emerald-700',
};

export default function BoardColumn({ column }: BoardColumnProps) {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  return (
    <>
      <div className="flex flex-col w-72 flex-shrink-0">
        {/* Column header */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: column.color }} />
            <span className="text-sm font-semibold text-gray-700">{column.title}</span>
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{column.cards.length}</span>
          </div>
          <button
            onClick={() => notifyAction(`${column.title} options`)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 transition-colors text-gray-400"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Cards */}
        <div className="flex flex-col gap-2 flex-1 min-h-32 bg-gray-50 rounded-xl p-2">
          <AnimatePresence>
            {column.cards.map((card, i) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedCard(card)}
                className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
              >
                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {card.tags.map(tag => (
                    <span key={tag} className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">{tag}</span>
                  ))}
                </div>

                {/* Title */}
                <p className="text-sm font-medium text-gray-800 mb-3 leading-snug">{card.title}</p>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priorityColors[card.priority]}`}>
                      {card.priority}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    {card.attachments > 0 && (
                      <span className="flex items-center gap-0.5 text-xs">
                        <Paperclip className="w-3 h-3" />
                        {card.attachments}
                      </span>
                    )}
                    {card.comments > 0 && (
                      <span className="flex items-center gap-0.5 text-xs">
                        <MessageSquare className="w-3 h-3" />
                        {card.comments}
                      </span>
                    )}
                  </div>
                </div>

                {/* Assignee + due date */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-xs font-bold text-white">{card.assignee.split(' ').map(w => w[0]).join('')}</span>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Calendar className="w-3 h-3" />
                    {card.dueDate}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Add card */}
          <button
            onClick={() => notifyAction(`Add card to ${column.title}`)}
            className="flex items-center gap-2 px-2 py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-all duration-200 mt-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Add card
          </button>
        </div>
      </div>

      {selectedCard && (
        <CardDetailDrawer card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </>
  );
}
