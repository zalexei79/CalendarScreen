export function creatorNotificationPayload(job){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(job.message_id||'')||typeof job.push_title!=='string'||!job.push_title.trim()||typeof job.push_body!=='string'||!job.push_body.trim())return null;
 return {type:'creator_message',creatorMessageId:job.message_id,deliveryId:job.delivery_id,title:job.push_title.slice(0,80),body:job.push_body.slice(0,160)};
}
