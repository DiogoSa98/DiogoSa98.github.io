// minimal nav/panel logic + small helpers
const panelButtons = Array.from(document.querySelectorAll('.site-header nav > *'));
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


// hamburger menu toggle for mobile header nav
document.querySelector('.menu-toggle').addEventListener('click', function () {
  const nav = document.querySelector('.site-header nav');
  const open = nav.classList.toggle('open');
  this.setAttribute('aria-expanded', open);
});


//////////////////
// TODO FIND A NAME FOR THIS SECTION.... ENTER STUFF NAV BAR ANIMATION...
//////////////////

document.addEventListener("DOMContentLoaded", (event) => {
  gsap.registerPlugin(ScrambleTextPlugin,SplitText);

  const navItems = gsap.utils.toArray(".site-header nav > *, #palette-toggle");

  navItems.forEach((el) => {
    el.dataset.originalText = el.textContent;
    el.dataset.baseText = el.textContent;
    // Lock the width to its current size, prevent layout shifting during text scramble
    el.style.minWidth = el.offsetWidth + "px";
    el.style.maxWidth = el.offsetWidth + "px";
    el.style.minHeight = el.offsetHeight + "px";
    el.style.maxHeight = el.offsetHeight + "px";
  });

  const scrambleChars =
    "\u2596\u2597\u2598\u2599\u259A\u259B\u259C\u259D\u259E\u259F\u258B\u2590\u2580\u2584";

  function animate() {
    gsap.set(navItems, { x: -20, autoAlpha: 0 }); // initial hidden state

    navItems.forEach((item, index) => {
      const originalText = item.dataset.originalText; // we stored it earlier

      gsap.to(item, {
        x: 0,
        autoAlpha: 1,
        scrambleText: {
          text: originalText, // final text
          chars: scrambleChars, // custom character set
          tween: true // makes the scramble progress over the duration
        },
        duration: 0.5, // total time for each item (adjust for speed)
        delay: (index * 0.15) + 0.1,
        ease: "power2.inOut",

        onComplete: () => {
          item.classList.add("split-active");
          item.dataset.textTop = originalText;
          item.dataset.textBot = originalText;
        }
      });

      item.dataset.text = originalText;

      let hoverScrableIntervalTop, hoverScrableIntervalBot;
      item.addEventListener("mouseenter", () => {
        item.classList.add("nav-hover");

        const currentText = item.dataset.originalText;
        // fire once immediately, then repeat
        item.dataset.textTop = scramble(currentText);
        item.dataset.textBot = scramble(currentText);
        
        hoverScrableIntervalTop = setInterval(() => {
          item.dataset.textTop = scramble(currentText);
        }, 350);
        hoverScrableIntervalBot = setInterval(() => {
          item.dataset.textBot = scramble(currentText);
        }, 370);

        item.addEventListener(
          "mouseleave",
          () => {
            clearInterval(hoverScrableIntervalTop);
            clearInterval(hoverScrableIntervalBot);
            item.dataset.textTop = currentText;
            item.dataset.textBot = currentText;
            item.classList.remove("nav-hover");
          },
          { once: true }
        );
      });

      item.addEventListener("click", () => {
        if (item.nodeName !== "BUTTON") return; // only for buttons, not links

        // stop scrambling
        clearInterval(hoverScrableIntervalTop);
        clearInterval(hoverScrableIntervalBot);
        item.dataset.textTop = item.dataset.baseText;
        item.dataset.textBot = item.dataset.baseText;

        // reset all
        navItems.forEach(n => {
          // n.dataset.originalText = n.dataset.baseText;
          // n.dataset.textTop = n.dataset.baseText;
          // n.dataset.textBot = n.dataset.baseText;
          n.classList.remove("nav-active");
          n.classList.remove("nav-hover");
        });

        // set active
        // const withArrow = "►" + item.dataset.baseText;
        // item.dataset.originalText = withArrow;
        // item.dataset.textTop = withArrow;
        // item.dataset.textBot = withArrow;
        item.classList.add("nav-active");
      });

    });
  }

  animate();

});

function scramble(originalText) {
  function replacer(match, p1, offset, string) {
    return Math.random() > 0.92 ? "\u00A0" : p1;
  }

  return originalText.replaceAll(/(\S)/gm, replacer);
}
