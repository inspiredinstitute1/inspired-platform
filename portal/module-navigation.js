'use strict';
const portalModuleKeys=['library','practice','videos','programmes','teaching','premium'];
const moduleRouteKeys={notes:'library',material:'library',pdf:'library',tests:'practice',test:'practice',videos:'videos','my-programmes':'programmes',teaching:'teaching',premium:'premium'};
let portalModules={},moduleAvailabilityLoad=0;
function setModuleAvailability(data){const next={};if(data&&Array.isArray(data.modules))for(const item of data.modules)if(portalModuleKeys.includes(item.key)&&typeof item.enabled==='boolean'&&typeof item.showNavigation==='boolean')next[item.key]={enabled:item.enabled,showNavigation:item.showNavigation};portalModules=next;}
setModuleAvailability(window.__PORTAL_BOOT__?.modules);
function moduleEnabled(key){return portalModules[key]?.enabled===true;}
function moduleRouteEnabled(path){const key=moduleRouteKeys[path.split('/')[0]];return!key||moduleEnabled(key);}
function moduleNavigationVisible(path){const key=moduleRouteKeys[path.split('/')[0]];return!key||moduleEnabled(key)&&portalModules[key]?.showNavigation===true;}
function pausedModulePage(){return intro('This learning section is paused','Your saved history is retained. Please return to the overview or check again later.')+link('home','Return to overview');}
function applyModulePresentation(){const main=document.getElementById('main');if(!main)return;for(const a of document.querySelectorAll('a[href^="#/"]')){const path=a.getAttribute('href').slice(2);if(a.closest?.('#main')&&route().split('/')[0]==='admin')continue;const visible=moduleRouteEnabled(path)&&(!(a.closest?.('#nav')||a.closest?.('#mobile-nav')||route().split('/')[0]==='home')||moduleNavigationVisible(path));a.hidden=!visible;}
 const premium=document.querySelector('.premium-link');if(premium)premium.hidden=!moduleNavigationVisible('premium');}
async function refreshModuleAvailability(redraw=true){const generation=++moduleAvailabilityLoad;try{const response=await fetch('/api/modules',{credentials:'omit',cache:'no-store'});if(!response.ok)throw Error('Unavailable');const data=await response.json();if(generation!==moduleAvailabilityLoad)return;setModuleAvailability(data);}catch{if(generation!==moduleAvailabilityLoad)return;setModuleAvailability(null);}if(!redraw){applyModulePresentation();return;}if(!document.querySelector('#main form'))render(true,false);else applyModulePresentation();}
window.addEventListener('focus',()=>refreshModuleAvailability());
window.addEventListener('online',()=>refreshModuleAvailability());
