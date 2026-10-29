import {useCallback,useEffect,useState} from 'react';
import {supabase} from '../../supabaseClient';
export function socialProfileChanged(userId){window.dispatchEvent(new CustomEvent('dayris:social-profile',{detail:{userId}}));}
export default function useSocialProfile(userId){
 const [state,setState]=useState({owner:null,data:null,error:false}),[revision,setRevision]=useState(0);
 const refresh=useCallback(()=>setRevision(n=>n+1),[]);
 useEffect(()=>{if(!userId)return;let alive=true;supabase.rpc('social_own_profile').then(({data,error})=>{if(alive)setState({owner:userId,data:data?.user_id===userId?data:null,error:Boolean(error)||data?.user_id!==userId});}).catch(()=>{if(alive)setState({owner:userId,data:null,error:true});});return()=>{alive=false;};},[userId,revision]);
 useEffect(()=>{const changed=e=>{if(e.detail?.userId===userId)refresh();};window.addEventListener('dayris:social-profile',changed);return()=>window.removeEventListener('dayris:social-profile',changed);},[userId,refresh]);
 return {...(state.owner===userId?state:{data:null,error:false}),refresh};
}
