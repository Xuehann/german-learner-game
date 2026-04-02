import { AnimatePresence, motion } from 'framer-motion';
import type { GamePhase } from '../types';

interface SausageDisplayProps {
  phase: GamePhase;
}

export const SausageDisplay = ({ phase }: SausageDisplayProps) => {
  const isCut = phase === 'show_order_feedback';

  return (
    <div className="relative flex min-h-36 items-center justify-center rounded-3xl border-4 border-butcher-wood/30 bg-butcher-cream/70 px-6 py-8">
      <AnimatePresence mode="wait">
        {isCut ? (
          <motion.div
            key="cut"
            className="flex items-center gap-4 text-6xl"
            initial={{ opacity: 0.5, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.span
              initial={{ x: 0, rotate: 0 }}
              animate={{ x: -44, rotate: -16 }}
              transition={{ duration: 1.2, ease: 'easeInOut' }}
            >
              🌭
            </motion.span>
            <motion.span
              className="text-5xl"
              initial={{ y: -60, x: -60, rotate: -35, opacity: 0 }}
              animate={{ y: -8, x: 8, rotate: 18, opacity: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              🔪
            </motion.span>
            <motion.span
              initial={{ x: 0, rotate: 0 }}
              animate={{ x: 44, rotate: 16 }}
              transition={{ duration: 1.2, ease: 'easeInOut' }}
            >
              🌭
            </motion.span>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            className="text-7xl"
            initial={{ scale: 0.95, rotate: -1 }}
            animate={{ scale: 1, rotate: [0, 1.5, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            🌭
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
