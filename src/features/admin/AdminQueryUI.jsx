import React from 'react';
export function Pagination({ offset, limit, total, onChange, disabled }) {
  return <div className="admin-pagination"><button disabled={disabled || offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>Назад</button><span>{total ? `${offset + 1}–${Math.min(offset + limit, total)} из ${total}` : 'Нет записей'}</span><button disabled={disabled || offset + limit >= total} onClick={() => onChange(offset + limit)}>Далее</button></div>;
}
export function QueryStatus({ query }) {
  return query.loading ? <p role="status">Загрузка…</p> : query.error ? <p role="alert" className="admin-error">{query.error}</p> : null;
}
