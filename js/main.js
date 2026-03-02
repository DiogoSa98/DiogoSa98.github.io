// minimal nav/panel logic + small helpers
const panelButtons = Array.from(document.querySelectorAll('.nav-btn'));
const panels = Array.from(document.querySelectorAll('.panel'));

// hide all at start except about
function hideAll(){ panels.forEach(p => p.setAttribute('hidden',''))}
function show(id){
  hideAll();
  const el = document.getElementById(id);
  if(!el) return;
  el.removeAttribute('hidden');
  // small focus for accessibility
  el.setAttribute('tabindex','-1');
  el.focus({preventScroll:true});
}

panelButtons.forEach(btn=>{
  btn.addEventListener('click', ()=> {
    const id = btn.getAttribute('data-panel');
    show(id);
  });
});

// load default
show('about');

// Page Visibility API: pause heavy work (shader) when not visible
document.addEventListener('visibilitychange', ()=> {
  const visible = document.visibilityState === 'visible';
  window.dispatchEvent(new CustomEvent('app-visibility', {detail:{visible}}));
});