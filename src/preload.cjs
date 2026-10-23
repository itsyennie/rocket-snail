const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('pet',{
  state:()=>ipcRenderer.invoke('state'),save:x=>ipcRenderer.invoke('save',x),probe:()=>ipcRenderer.invoke('probe'),
  open:id=>ipcRenderer.invoke('open-message',id),restore:id=>ipcRenderer.invoke('restore',id),confirm:id=>ipcRenderer.invoke('confirm',id),refresh:()=>ipcRenderer.invoke('refresh'),
  interactive:on=>ipcRenderer.invoke('interactive',on),setMotion:enabled=>ipcRenderer.invoke('set-motion',enabled),setAppearance:appearance=>ipcRenderer.invoke('set-appearance',appearance),quit:()=>ipcRenderer.invoke('quit'),
  beginDrag:()=>ipcRenderer.invoke('drag-start'),endDrag:()=>ipcRenderer.invoke('drag-end'),
  hover:hovered=>ipcRenderer.invoke('hover',hovered),
  setPlacement:placement=>ipcRenderer.invoke('set-placement',placement),
  setStartup:enabled=>ipcRenderer.invoke('set-startup',enabled),
  onState:f=>ipcRenderer.on('state',(_e,v)=>f(v)),onGeometry:f=>ipcRenderer.on('geometry',(_e,v)=>f(v))
});
