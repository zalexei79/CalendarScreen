import { useCallback, useReducer } from 'react';
export function editorHistory(state, action) {
  if (action.type === 'reset') return { value:action.value,past:[],future:[] };
  if (action.type === 'undo' && state.past.length) return { value:state.past.at(-1),past:state.past.slice(0,-1),future:[state.value,...state.future].slice(0,50) };
  if (action.type === 'redo' && state.future.length) return { value:state.future[0],past:[...state.past,state.value].slice(-50),future:state.future.slice(1) };
  if (action.type === 'set') {
    const value = typeof action.value === 'function' ? action.value(state.value) : action.value;
    if (JSON.stringify(value) === JSON.stringify(state.value)) return state;
    return { value,past:[...state.past,state.value].slice(-50),future:[] };
  }
  return state;
}
export default function useEditorHistory(initial) {
  const [state, dispatch] = useReducer(editorHistory, initial, value => ({value:typeof value === 'function' ? value() : value,past:[],future:[]}));
  const set = useCallback(value=>dispatch({type:'set',value}),[]);
  const reset = useCallback(value=>dispatch({type:'reset',value}),[]);
  return [state.value,set,{ undo:()=>dispatch({type:'undo'}),redo:()=>dispatch({type:'redo'}),reset,canUndo:state.past.length>0,canRedo:state.future.length>0 }];
}
