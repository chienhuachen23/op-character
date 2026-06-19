import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import type { WsConnectionStatus } from '../ws/useRoomWebSocket';
import { useToast } from './Toast';

export function ConnectionBanner({ status }: { status: WsConnectionStatus }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const prevRef = useRef<WsConnectionStatus>(status);

  useEffect(() => {
    const prev = prevRef.current;
    if (prev === status) return;
    if (status === 'reconnecting') {
      toast(t('toast_reconnecting'), 'info');
    } else if (status === 'connected' && (prev === 'reconnecting' || prev === 'disconnected')) {
      toast(t('toast_reconnected'), 'success');
    }
    prevRef.current = status;
  }, [status, toast, t]);

  const visible = status === 'reconnecting' || status === 'disconnected';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div
            className={`text-center text-xs py-1.5 font-medium ${
              status === 'disconnected'
                ? 'bg-red-600/90 text-white'
                : 'bg-amber-500/90 text-wood'
            }`}
          >
            {status === 'disconnected' ? t('toast_disconnected') : t('toast_reconnecting')}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
