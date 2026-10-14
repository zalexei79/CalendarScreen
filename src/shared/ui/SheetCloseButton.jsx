import React from 'react';
import { X } from 'lucide-react';
export default function SheetCloseButton({ language = 'ru', onClick, disabled = false }) {
  const label = String(language).startsWith('zh') ? '关闭窗口' : language === 'en' ? 'Close window' : ['ro','md'].includes(language) ? 'Închide fereastra' : 'Закрыть окно';
  return <button type="button" className="dayris-sheet-close" aria-label={label} disabled={disabled} onClick={onClick}><X size={20} aria-hidden="true"/></button>;
}
