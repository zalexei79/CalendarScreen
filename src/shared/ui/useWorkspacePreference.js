import { useEffect, useState } from 'react';
import { readWorkspace, writeWorkspace } from '../lib/sessionWorkspace.js';
export default function useWorkspacePreference(owner,name,fallback,allowed){
  const [value,setValue]=useState(()=>{const saved=readWorkspace(owner,name);return allowed.includes(saved)?saved:fallback;});
  useEffect(()=>{writeWorkspace(owner,name,value);},[owner,name,value]);
  return [value,setValue];
}
