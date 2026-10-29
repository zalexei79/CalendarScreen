export function cardLabels(message,t){
 const c=message?.card||{};
 return {
  sender:c.sender??t.from,button:c.button??t.ok,giftButton:c.giftButton??t.read,
  replyButton:c.replyButton??t.reply,footer:c.footer??t.saved,giftLine:c.giftLine??`${t.gift} {date}`,
  foreverLine:c.foreverLine??t.forever,closeLabel:c.closeLabel??t.close,historyLabel:c.historyLabel??t.history,
  replyTitle:c.replyTitle??t.replyTitle,replyPlaceholder:c.replyPlaceholder??t.replyPlaceholder,
  sendReplyLabel:c.sendReplyLabel??t.sendReply,replySentLabel:c.replySentLabel??t.replySent,
  replyErrorLabel:c.replyErrorLabel??t.replyError,backLabel:c.backLabel??t.back,savingLabel:c.savingLabel??t.saving,
  icon:c.icon||'auto',theme:c.theme||'auto',accent:c.accent||'neutral',allowReply:c.allowReply!==false,showExpiry:c.showExpiry!==false,
 };
}
export function cardHeading(message,t){
 if(message?.card?.version===1)return message.title;
 if(message?.pro_until)return t.giftTitle;
 return ['Сообщение от создателя','Сообщения от создателя','От создателя DAYRIS',t.from,t.inbox].includes(message?.title)?t.messageTitle:message?.title||t.messageTitle;
}
export function cardTheme(message,isLight){const theme=message?.card?.theme;return theme==='light'||(theme!=='dark'&&isLight);}
