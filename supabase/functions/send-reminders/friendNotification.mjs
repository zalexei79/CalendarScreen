export function friendNotificationPayload(job){
 const uuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value||'');
 if(!uuid(job.sender_id)||!uuid(job.message_id)||typeof job.push_body!=='string'||!job.push_body.trim())return null;
 return {type:'friend_message',friendId:job.sender_id,friendMessageId:job.message_id,deliveryId:job.delivery_id,title:typeof job.push_title==='string'&&job.push_title.trim()?job.push_title.slice(0,80):'DAYRIS',body:job.push_body.slice(0,160)};
}
