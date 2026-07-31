import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Paperclip, Calendar, Tag, User, Clock, Send } from 'lucide-react';

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

interface CardDetailDrawerProps {
  card: Card;
  onClose: () => void;
}

const priorityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-emerald-100 text-emerald-700',
};

const mockComments = [
  { id: '1', author: 'John M.', avatar: 'JM', text: 'I have ordered the replacement unit, should arrive by Friday.', time: '2 hr ago' },
  { id: '2', author: 'Sarah K.', avatar: 'SK', text: 'Please ensure it is installed before the board meeting on Monday.', time: '1 hr ago' },
  { id: '3', author: 'Mike T.', avatar: 'MT', text: 'Confirmed, will have it done by Sunday.', time: '30 min ago' },
];

export default function CardDetailDrawer({ card, onClose }: CardDetailDrawerProps) {
  const [comment, setComment] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex">
        <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
        <motion.aside
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl flex flex-col"
          aria-label="Card details"
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-gray-100">
            <div className="flex-1 pr-4">
              <div className="flex flex-wrap gap-1 mb-2">
                {card.tags.map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">{tag}</span>
                ))}
              </div>
              <h2 className="text-base font-semibold text-gray-900 leading-snug">{card.title}</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-400 flex-shrink-0"
              aria-label="Close drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 px-6">
            {(['details', 'activity'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium capitalize border-b-2 transition-colors duration-200 ${
                  activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'details' ? (
            <div className="flex-1 p-6 space-y-6">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><User className="w-3 h-3" /> Assignee</p>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                      <span className="text-xs font-bold text-white">{card.assignee.split(' ').map(w => w[0]).join('')}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-700">{card.assignee}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Tag className="w-3 h-3" /> Priority</p>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${priorityColors[card.priority]}`}>{card.priority}</span>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Due Date</p>
                  <span className="text-sm font-medium text-gray-700">{card.dueDate}</span>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Paperclip className="w-3 h-3" /> Attachments</p>
                  <span className="text-sm font-medium text-gray-700">{card.attachments} files</span>
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-xs text-gray-400 mb-2">Description</p>
                <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-3">
                  This task requires immediate attention. Please coordinate with the relevant department heads and ensure all necessary resources are allocated before the deadline.
                </p>
              </div>

              {/* Attachments */}
              <div>
                <p className="text-xs text-gray-400 mb-2">Attachments</p>
                <div className="space-y-2">
                  {['specification.pdf', 'photo_evidence.jpg'].slice(0, card.attachments || 1).map(file => (
                    <div key={file} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                      <Paperclip className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-600 flex-1">{file}</span>
                      <span className="text-xs text-blue-600 cursor-pointer hover:underline">Download</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-6">
              <div className="space-y-4 mb-6">
                {mockComments.map(c => (
                  <div key={c.id} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-white">{c.avatar}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-800">{c.author}</span>
                        <span className="text-xs text-gray-400 flex items-center gap-0.5"><Clock className="w-3 h-3" />{c.time}</span>
                      </div>
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2.5">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comment input */}
          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">SK</span>
              </div>
              <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <input
                  type="text"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"
                />
                <button
                  className="text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-40"
                  disabled={!comment.trim()}
                  aria-label="Send comment"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.aside>
      </div>
    </AnimatePresence>
  );
}
