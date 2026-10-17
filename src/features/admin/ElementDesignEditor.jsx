import React from 'react';
import {ArrowRight,Layers,Code2} from 'lucide-react';

export default function ElementDesignEditor({view,element,feature,custom,values,device,busy,onEdit,onPatch,onButton,onSource,onRemove,colorField}){
  const label=element?.label || 'Всё приложение';
  const numeric=(key,title,min,max)=><label className="admin-field" key={key}><span>{title}</span><input type="number" min={min} max={max} value={values[key]??''} placeholder="Как в приложении" onChange={event=>onEdit(key,event.target.value===''?undefined:Number(event.target.value))}/></label>;
  if(view==='layout'&&!element)return <section className="studio-element-design"><h3>Общая структура календаря</h3><p className="admin-hint">Для всего экрана нет одного размера или порядка внутри ряда. Выберите конкретный элемент на полотне. Структура экрана меняется в связанных компонентах.</p><button onClick={onSource}>Где это в проекте</button></section>;
  return <section className="studio-element-design" key={view} aria-label={view==='layout'?'Расположение элемента':view==='style'?'Стиль темы':'Назначение элемента'}>
    {view==='design'&&<><div className="studio-element-summary"><Layers size={20}/><div><h3>{label}</h3><p>{feature.description}</p></div></div><ol className="studio-action-chain">{feature.steps.map(step=><li key={step}>{step}<ArrowRight size={12}/></li>)}</ol>
      {custom?<label className="admin-field"><span>Название кнопки</span><input disabled={busy} maxLength={80} value={custom.label} onChange={e=>onButton('label',e.target.value)}/></label>:<p className="admin-hint">Подпись и иконка этого штатного элемента задаются компонентом и переводами. Их исходник доступен ниже.</p>}
      {element&&<label className="admin-check"><input disabled={busy} type="checkbox" checked={values.hidden===true} onChange={e=>onEdit('hidden',e.target.checked)}/>Скрыть элемент на {device==='mobile'?'телефоне':'ПК'}</label>}
      <button onClick={onSource}><Code2 size={16}/> Где это в проекте</button>{custom&&<button className="studio-remove-element" onClick={onRemove}>Удалить кнопку из черновика</button>}
    </>}
    {view==='layout'&&<><h3>Расположение · {device==='mobile'?'телефон':'ПК'}</h3><p className="admin-hint">Меняется положение элемента внутри приложения, а не положение окна в песочнице.</p>
      {custom&&<label className="admin-field"><span>Расположение кнопки</span><select disabled={busy} value={custom.placement} onChange={e=>onButton('placement',e.target.value)}><option value="header">Под шапкой календаря</option><option value="bottom">Закрепить внизу экрана</option></select></label>}
      <fieldset disabled={busy}><legend>Размер и выравнивание</legend><div className="studio-field-grid">{numeric('width','Ширина',32,1200)}{numeric('height','Высота',32,500)}{numeric('x','Сдвиг вправо / влево',-200,200)}{numeric('y','Сдвиг вниз / вверх',-200,200)}</div>{numeric('order','Порядок внутри ряда',-20,20)}<button onClick={()=>onPatch({width:undefined,height:undefined,x:undefined,y:undefined,order:undefined})}>Вернуть штатное расположение</button></fieldset><p className="admin-hint">Порядок действует внутри своего ряда. Перенос штатного React-элемента в другой раздел требует изменения компонента.</p>
    </>}
    {view==='style'&&<><h3>Стиль от темы приложения</h3><p className="admin-hint">По умолчанию сохраняется родное оформление. Варианты используют акцент текущей темы, не задают новый цвет всему календарю.</p>
      {element?<div className="studio-style-options" role="group" aria-label="Вариант оформления">{[['','Родной стиль','Ничего не переопределять'],['accent','Акцент темы','Выделить важное действие'],['quiet','Спокойный','Убрать собственную заливку']].map(([id,title,hint])=><button key={id} disabled={busy} aria-pressed={(values.emphasis||'')===id} onClick={()=>onPatch({emphasis:id||undefined,color:undefined,background:undefined,fontSize:undefined,radius:undefined})}><strong>{title}</strong><small>{hint}</small></button>)}</div>:<p>Общая тема управляется в настройках календаря. Для своего сезонного оформления используйте «Тема и CSS».</p>}
      <details className="studio-advanced"><summary>Дополнительно · точные параметры</summary><fieldset disabled={busy}>{element?<>{colorField('color','Цвет текста и иконки')}{colorField('background','Цвет элемента')}{numeric('fontSize','Размер текста',10,64)}{numeric('radius','Скругление',0,100)}</>:<>{colorField('background','Цвет фона')}{colorField('accent','Акцент PRO')}</>}</fieldset></details>
    </>}
  </section>;
}
