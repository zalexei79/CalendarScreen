import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import CreatorMessages,{CreatorMessagesButton,CreatorGiftNote} from '../src/features/messages/CreatorMessages.jsx';
function Fixture(){const [user,setUser]=useState('user-a');window.changeMessageAccount=setUser;return <main><h1>DAYRIS · тест сообщений</h1><CreatorMessagesButton userId={user} language="ru"/><CreatorGiftNote userId={user} language="ru"/><CreatorMessages userId={user} language="ru"/></main>;}
createRoot(document.getElementById('root')).render(<Fixture/>);
