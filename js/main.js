// minimal nav/panel logic + small helpers
const panelButtons = Array.from(document.querySelectorAll('.site-header nav > *'));
const panels = Array.from(document.querySelectorAll('.panel'));

// hide all at start except about
function hideAll(){ panels.forEach(p => p.setAttribute('hidden',''))}
function showPanel(el) {
  hideAll();
  el.removeAttribute('hidden');
  // small focus for accessibility
  el.setAttribute('tabindex','-1');
  el.focus({preventScroll:true});

  toggleActiveNavItem(panelButtons.find(btn => btn.getAttribute('data-panel') === el.id));

  // TODO only dispatch if panel changed!!
  // Dispatch event for Three.js to resize
  document.dispatchEvent(new CustomEvent('panelShown', { detail: el.id }));

  animateText(el.querySelector('.cormorant-garamond-body'));
}
function show(id){
  const el = document.getElementById(id);
  // update showingPanelIndex for scroll logic
  showingPanelIndex = panels.findIndex(p => p.id === id);
  if(!el) return;
  showPanel(el);
}

panelButtons.forEach(btn=>{
  btn.addEventListener('click', ()=> {
    const id = btn.getAttribute('data-panel');
    show(id);
  });
});

// load default, nothing will be breaker game
hideAll();
let showingPanelIndex = -1;

///////////////////////////////////
// scroll to change panels
///////////////////////////////////
let s = 0;
let scrollY = 0;
let scrollX = 0;
let scrolling = false;
function ScrollSwipe(right) {
    if (!right && showingPanelIndex > 0 && !scrolling) // scrolling left/up and didnt reach first card (about)
    {
        scrollY = 0;
        scrollX = 0;
        s = 0;

        showingPanelIndex -= 1;
        console.log('scrolling up', showingPanelIndex);
        showPanel(panels[showingPanelIndex]);
    }
    
    if (right && showingPanelIndex < panels.length - 1 && !scrolling) // scrolling right/down and didnt reach last card (personal)
    {
        scrollY = 0;
        scrollX = 0;
        s = 0;

        showingPanelIndex += 1;
        console.log('scrolling down', showingPanelIndex);
        showPanel(panels[showingPanelIndex]);
    }
}
window.addEventListener('wheel', (event) => {
    if (!scrolling)
    {
        scrollY = event.deltaY;
        scrollX = event.deltaX;

        s = 0;
        if (Math.abs(scrollX) > Math.abs(scrollY))
        {
            s = scrollX;
        }else{
            s = scrollY;
        }
        
        if (s > 20)
        {
            ScrollSwipe(true);
        }
        if (s < -20)
        {
            ScrollSwipe(false);
        }
    }
});
let touchStartX = 0;
let touchStartY = 0;
window.addEventListener('touchstart', (event) => {
    touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
});
let touchEndX = 0;
let touchEndY = 0;
addEventListener('touchmove', (event) => {
    touches = event.touches;
    lastTouch = touches[touches.length - 1];
    touchEndX = lastTouch.clientX;
    touchEndY = lastTouch.clientY;
});
window.addEventListener('touchend', (event) => {
    if (!scrolling)
    {
        dX = touchEndX - touchStartX;
        dY = touchEndY - touchStartY;
        s = 0;
        if (Math.abs(dX) > Math.abs(dY))
        {
            s = dX;
        }else{
            s = dY;
        }
        if (s > 20)
        {
            ScrollSwipe(false);
        }
        if (s < -20)
        {
            ScrollSwipe(true);
        }
        console.log("touch " + s );
    }
});

///////////////////////////////////
///////////////////////////////////

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

        toggleActiveNavItem(item);
        /*// reset all
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
        item.classList.add("nav-active");*/
      });

    });
  }

  animate();

});

function toggleActiveNavItem(item) {
    // reset all
  panelButtons.forEach(n => {
    n.classList.remove("nav-active");
    n.classList.remove("nav-hover");
  });

  // set active
  item.classList.add("nav-active");
}

function scramble(originalText) {
  function replacer(match, p1, offset, string) {
    return Math.random() > 0.92 ? "\u00A0" : p1;
  }

  return originalText.replaceAll(/(\S)/gm, replacer);
}


///////////////////////////////////
// video overlay logic
///////////////////////////////////
const overlay = document.querySelector('.videos-overlay');
const overlayVideo = document.getElementById('overlay-video');
const overlayDescription = document.querySelector('.overlay-description');
const closeOverlayBtn = document.querySelector('.close-overlay-btn');
const projectVideoButtons = document.querySelectorAll('.grid img');

projectVideoButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const videoSrc = btn.getAttribute('data-video-src');
    const description = btn.getAttribute('data-description');

    openVideoOverlay(videoSrc, description);
  });
});

overlay.setAttribute('hidden','');

closeOverlayBtn.addEventListener('click', () => {
  overlayVideo.pause();
  overlay.setAttribute('hidden', '');
  overlayVideo.removeAttribute('src');
  overlayVideo.load();
});

function openVideoOverlay(videoSrc, description) {
  const source = overlayVideo.querySelector('source');
  source.src = videoSrc;
  overlayVideo.load();
  overlayDescription.textContent = description;
  overlay.removeAttribute('hidden');
}


///////////////////////////////////
// text animation logic
///////////////////////////////////
function easeOutExpo(x) {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}
function easeInOutExpo(x) {
  return x === 0
    ? 0
    : x === 1
    ? 1
    : x < 0.5
    ? Math.pow(2, 20 * x - 10) / 2
    : (2 - Math.pow(2, -20 * x + 10)) / 2;
}
function easeInOutSine(x) {
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

async function scrambleInPlace(element, duration = 2400, stepTime = 50) {
  const originalText = element.textContent;

  const rect = element.getBoundingClientRect();
  element.style.width = rect.width + "px"; // lock width
  element.style.height = rect.height + "px";
  element.style.minWidth = rect.width + "px";
  element.style.maxWidth = rect.width + "px";
  element.style.minHeight = rect.height + "px";
  element.style.maxHeight = rect.height + "px";

  const startTime = performance.now();

  let t = 0.1;
  while (t < 0.99) {
    t = easeInOutSine((performance.now() - startTime) / duration);

    function replacer(match, p1, offset, string) {
      return Math.random() > t ? "\u00A0" : p1; // \u00A0
    }

    const scrambled = originalText.replaceAll(/(\S)/gm, replacer);
    // const scrambled = originalText
    //   .split(" ")
    //   .map((word) => {
    //     return Math.random() > t ? "\u00A0".repeat(word.length) : word;
    //   })
    //   .join(" ");

    element.textContent = scrambled;
    await new Promise((resolve) => setTimeout(resolve, stepTime));
  }

  element.textContent = originalText;
}

function animateText(textElement) {
  scrambleInPlace(textElement, 500, 80); // TODO FIX ME SCRAMBLE IS LOOSING STUFF....
}