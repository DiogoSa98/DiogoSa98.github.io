document.addEventListener('touchmove', function(e) {
    console.log('touchmove', e.target, e.target.closest('.videos-overlay'), e.target.closest('.videos-overlay') === null);
    if (!e.target.closest('.videos-overlay')) {
        e.preventDefault(); // TESTING
    }
});

let isGameVisible = true;
let gameFinishedLoading = false;
const hideGameCameraAnimTime = 1000;

const panelButtons = Array.from(document.querySelectorAll('.site-header nav > *'));
const panels = Array.from(document.querySelectorAll('.panel'));
let currentlyShownPanel = null;

function hideAll() { panels.forEach(p => p.setAttribute('hidden', '')); currentlyShownPanel = null; toggleActiveNavItem(null); }
function showPanel(el) {
  if (currentlyShownPanel === el) return;

  let showDelay = 0.;
  if (isGameVisible) {
    document.dispatchEvent(new CustomEvent('hide-game', { detail: { shouldHide: true, delay: hideGameCameraAnimTime } } ));
    showDelay = hideGameCameraAnimTime; // time for three-main.js to hide the game, i dont like this hardcoded but whatever
  }

  async function waitShowPanel() {
    await new Promise(resolve => setTimeout(resolve, showDelay));
    if (isGameVisible) {
      isGameVisible = false;
    }

    hideAll();
    el.removeAttribute('hidden');
    el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });

    toggleActiveNavItem(panelButtons.find(btn => btn.getAttribute('data-panel') === el.id));

    // TODO only dispatch if panel changed!!
    // Dispatch event for Three.js to resize
    document.dispatchEvent(new CustomEvent('panelShown', { detail: el.id }));

    animateText(el.querySelector('.cormorant-garamond-body'));

    currentlyShownPanel = el;
  }

  waitShowPanel();
  hideTutorialText();
}
function show(id) {
  if (!gameFinishedLoading) {
    console.warn('trying to show some panel but game hasnt finished animating showing');
    return;
  }
  const el = document.getElementById(id);
  // update showingPanelIndex for scroll logic
  showingPanelIndex = panels.findIndex(p => p.id === id);
  if (!el) return;
  showPanel(el);
}

panelButtons.forEach(btn => {
  btn.addEventListener('click', () => {
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
let scrolling = false;
const swipeThreshold = 200;
function ScrollSwipe(right) {
  if (!gameFinishedLoading) {
    console.warn('trying to show some panel but game hasnt finished animating showing');
    return;
  }

  if (!overlay.hasAttribute('hidden')) return; // prevent scrolling if video overlay is showing!!

  if (!right && showingPanelIndex == 0 && !scrolling) // scrolling left/up and in first card (about) => Show Game!
  {
    hideAll();
    showingPanelIndex = -1;
    document.dispatchEvent(new CustomEvent('panelShown', { detail: null })); // signal images to disappear

    document.dispatchEvent(new CustomEvent('hide-game', { detail: { shouldHide: false, delay: hideGameCameraAnimTime } } ));
    isGameVisible = true;
  }

  if (!right && showingPanelIndex > 0 && !scrolling) // scrolling left/up and didnt reach first card (about)
  {
    showingPanelIndex -= 1;
    showPanel(panels[showingPanelIndex]);
  }

  if (right && showingPanelIndex < panels.length - 1 && !scrolling) // scrolling right/down and didnt reach last card (personal)
  {
    showingPanelIndex += 1;
    showPanel(panels[showingPanelIndex]);
  }
}
function DetectScrollSwipe()
{
  const dX = touchEndX - touchStartX;
  const dY = touchEndY - touchStartY;
  let s = 0;
  if (Math.abs(dX) > Math.abs(dY)) {
    s = dX;
  } else {
    s = dY;
  }
  if (s > swipeThreshold) {
    ScrollSwipe(true);
  }
  if (s < -swipeThreshold) {
    ScrollSwipe(false);
  }
  // console.log('touchEndX', touchEndX, 'touchStartX', touchStartX, ' s ', s);
  // console.log('touchEndY', touchEndY, 'touchStartY', touchStartY, ' s ', s);
}
// DISABLED SCROLL CAUSE WAS GIVING TOO MUCH HEADACHES ON MOBILE, conflict with game drag etc...
/*
let wheelEventEndTimeout = null;
window.addEventListener('wheel', (event) => {
  if (!scrolling)
  {
    touchStartX = 0;
    touchStartY = 0;
  }
  clearTimeout(wheelEventEndTimeout);
  scrolling = true;
  touchEndX += event.deltaX;
  touchEndY += event.deltaY;
  wheelEventEndTimeout = setTimeout(() => {
      scrolling = false;
      DetectScrollSwipe();
      touchEndX = 0;
      touchEndY = 0;
  }, 100);
});

let touchStartX = 0;
let touchStartY = 0;
window.addEventListener('touchstart', (event) => {
  const touch = event.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  scrolling = true;
});
let touchEndX = 0;
let touchEndY = 0;
addEventListener('touchmove', (event) => {
  const touches = event.touches;
  const lastTouch = touches[touches.length - 1];
  touchEndX = lastTouch.clientX;
  touchEndY = lastTouch.clientY;
});
window.addEventListener('touchend', (event) => {
  scrolling = false;
  DetectScrollSwipe();
  // if (!scrolling) {
  //   dX = touchEndX - touchStartX;
  //   dY = touchEndY - touchStartY;
  //   s = 0;
  //   if (Math.abs(dX) > Math.abs(dY)) {
  //     s = dX;
  //   } else {
  //     s = dY;
  //   }
  //   if (s > swipeThreshold) {
  //     ScrollSwipe(false);
  //   }
  //   if (s < -swipeThreshold) {
  //     ScrollSwipe(true);
  //   }
  // }
});
*/

//////////////////
// TODO FIND A NAME FOR THIS SECTION.... ENTER STUFF NAV BAR ANIMATION...
//////////////////

const scrambleChars =
  "\u2596\u2597\u2598\u2599\u259A\u259B\u259C\u259D\u259E\u259F\u258B\u2590\u2580\u2584";

gsap.registerPlugin(ScrambleTextPlugin, SplitText);
const navItems = gsap.utils.toArray(".site-header nav > *, #palette-toggle");
gsap.set(navItems, { x: -20, autoAlpha: 0 }); // initial hidden state

document.addEventListener("DOMContentLoaded", (event) => {
  navItems.forEach((el) => {
    el.dataset.originalText = el.textContent;
    el.dataset.baseText = el.textContent;
    // Only lock size if the element has actual dimensions (skip mobile nav items initially)
    if (el.offsetWidth > 0 && el.offsetHeight > 0) {
      el.style.minWidth = el.offsetWidth + "px";
      el.style.maxWidth = el.offsetWidth + "px";
      el.style.minHeight = el.offsetHeight + "px";
      el.style.maxHeight = el.offsetHeight + "px";
    }
  });
});
function animateNavItems() {
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

      // toggleActiveNavItem(item);
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

function toggleActiveNavItem(item) {
  // reset all
  panelButtons.forEach(n => {
    n.classList.remove("nav-active");
    n.classList.remove("nav-hover");
  });

  // set active
  if (item) item.classList.add("nav-active");
}

function scramble(originalText, prob = 0.92) {
  function replacer(match, p1, offset, string) {
    return Math.random() > prob ? "\u00A0" : p1;
  }

  return originalText.replaceAll(/(\S)/gm, replacer);
}


// for hamburger menu on mobile its slightly different, need to reset stuff before animating
function animateNavItemsIn(items = navItems) {
  items.forEach((item) => {
    gsap.killTweensOf(item);
    item.classList.remove("split-active");
    item.dataset.textTop = "";
    item.dataset.textBot = "";
  });


  gsap.set(items, { x: -20, autoAlpha: 0 }); // initial hidden state

  items.forEach((item, index) => {
    const originalText = item.dataset.originalText || item.textContent;
    gsap.to(item, {
      x: 0,
      autoAlpha: 1,
      scrambleText: {
        text: originalText,
        chars: scrambleChars,
        tween: true
      },
      duration: 0.5,
      delay: (index * 0.15),
      ease: "power2.inOut",
      onComplete: () => {
        item.classList.add("split-active");
        item.dataset.textTop = originalText;
        item.dataset.textBot = originalText;
      }
    });
  });
}

const navOverlay = document.querySelector('.nav-overlay');

// hamburger menu toggle for mobile header nav
document.querySelector('.menu-toggle').addEventListener('click', function () {
  const nav = document.querySelector('.site-header nav');
  const open = nav.classList.toggle('open');
  this.setAttribute('aria-expanded', open);
  this.textContent = open ? '✕' : '☰';
  navOverlay.classList.toggle('open', open);

  if (open) {
    animateNavItemsIn(nav.querySelectorAll('.nav-btn'));
  }
});
// Close mobile menu when clicking nav items
document.querySelectorAll('.site-header nav .nav-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    const nav = document.querySelector('.site-header nav');
    nav.classList.remove('open');
    const menuToggle = document.querySelector('.menu-toggle');
    menuToggle.setAttribute('aria-expanded', false);
    menuToggle.textContent = '☰';
    navOverlay.classList.toggle('open', false);
  });
});


///////////////////////////////////
// ENTRY TUTORIAL TEXT
///////////////////////////////////
const tutorialText = gsap.utils.toArray(".site-tutorial-text > p");
gsap.set(tutorialText, {
  autoAlpha: 0
});
function animateTutorialText() {
  tutorialText.forEach((item, index) => {
    const originalText = item.textContent;
    gsap.to(item, {
      x: 0,
      autoAlpha: 1,
      scrambleText: {
        text: originalText,
        chars: scrambleChars,
        tween: true,
        speed: 0.4,
      },
      duration: 0.8,
      delay: (index * 0.8) + 1.,
      // ease: "power2.inOut",
    });
  });
}

function hideTutorialText() {
  tutorialText.forEach((item, index) => {
    if (item.textContent === "") return; // skip if already not visible
    gsap.to(item, {
      x: 0,
      autoAlpha: 1,
      scrambleText: {
        text: "",
        chars: scrambleChars,
        tween: true,
        speed: 0.4,
      },
      duration: 0.5,
      delay: 0.,
      // ease: "power2.inOut",
    });
  });
}

document.addEventListener('game-appeared', () => {
  animateTutorialText();
  animateNavItems();
  async function waitEnableScroll() {
    await new Promise(resolve => setTimeout(resolve, 2000));
    gameFinishedLoading = true;
  }
  waitEnableScroll();
});
document.addEventListener('game-launch', () => {
  hideTutorialText();
});
///////////////////////////////////
///////////////////////////////////

///////////////////////////////////
// video overlay logic
///////////////////////////////////
const overlay = document.querySelector('.videos-overlay');
const overlayVideo = document.getElementById('overlay-video');
const overlayDescription = document.querySelector('.overlay-description');
const closeOverlayBtn = document.querySelector('.close-overlay-btn');
const projectVideoButtons = document.querySelectorAll('.grid img');
import descriptions from '/assets/descriptions/project-descriptions.json';

const projectVideosUrls = {
  'devils-purge': new URL('../assets/videos/DevilsPurge_trailer.mp4', import.meta.url).href,
  'new-fantasy': new URL('../assets/videos/NewFantasy_trailer.mp4', import.meta.url).href,
  'cyberload': new URL('../assets/videos/Cyberload_trailer.mp4', import.meta.url).href,
};
projectVideoButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const videoSrc = projectVideosUrls[btn.getAttribute('data-description-key')];
    const description = descriptions[btn.getAttribute('data-description-key')];
    openVideoOverlay(videoSrc, description);
  });
});

// Inject resume PDF URL
const resumeUrl = new URL('../assets/diogo-sa-cv.pdf', import.meta.url).href;
document.getElementById('nav-resume').href = resumeUrl;

overlay.setAttribute('hidden', '');

closeOverlayBtn.addEventListener('click', () => {
  overlayVideo.pause();
  overlay.setAttribute('hidden', '');
  overlayVideo.removeAttribute('src');
  overlayVideo.load();
});

function openVideoOverlay(videoSrc, description) {
  const source = overlayVideo.querySelector('source');
  overlayVideo.pause();
  overlayVideo.currentTime = 0;
  source.src = videoSrc;
  overlayVideo.load();
  overlayDescription.innerHTML = description;
  overlay.removeAttribute('hidden');
}


///////////////////////////////////
// text animation logic
///////////////////////////////////
function easeOutExpo(x) {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}
function easeInExpo(x) {
  return x === 0 ? 0 : Math.pow(2, 10 * x - 10);
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
function easeInSine(x) {
  return 1 - Math.cos((x * Math.PI) / 2);

}

// async function scrambleInPlace(element, duration = 2400, stepTime = 50) {
//   const originalText = element.textContent;

//   const rect = element.getBoundingClientRect();
//   element.style.width = rect.width + "px"; // lock width
//   element.style.height = rect.height + "px";
//   element.style.minWidth = rect.width + "px";
//   element.style.maxWidth = rect.width + "px";
//   element.style.minHeight = rect.height + "px";
//   element.style.maxHeight = rect.height + "px";

//   const startTime = performance.now();

//   let t = 0.1;
//   while (t < 0.99) {
//     t = easeInOutSine((performance.now() - startTime) / duration);

//     function replacer(match, p1, offset, string) {
//       return Math.random() > t ? "\u00A0" : p1; // \u00A0
//     }

//     const scrambled = originalText.replaceAll(/(\S)/gm, replacer);

//     element.textContent = scrambled;
//     await new Promise((resolve) => setTimeout(resolve, stepTime));
//   }

//   element.textContent = originalText;
// }

// async function scrambleInPlace2(element, duration = 2400, stepTime = 50) {
//   const originalText = element.innerHTML;

//   const matches = [...originalText.matchAll(/(?:<[^>]*>)|(\b\w+[^\w\s<>]*)/gm)]

//   const rect = element.getBoundingClientRect();
//   element.style.width = rect.width + "px"; // lock width
//   element.style.height = rect.height + "px";
//   element.style.minWidth = rect.width + "px";
//   element.style.maxWidth = rect.width + "px";
//   element.style.minHeight = rect.height + "px";
//   element.style.maxHeight = rect.height + "px";

//   const startTime = performance.now();

//   let t = 0.1;
//   while (t < 0.99) {
//     t = easeInOutSine((performance.now() - startTime) / duration);
//     t = 0.8; // TESTING

//     let scrambled = originalText;
//     matches.forEach(m => {
//       if (m[1] && Math.random() > t) { // if match word and decide to scramble
//         // const scrambledWord = m[1].replace(/./g, '\u00A0'); // replace each char with non-breaking space
//         const scrambledWord = m[1].replace(/./g, 'X'); // replace each char with non-breaking space
//         scrambled = scrambled.substring(0, m.index) + scrambledWord + scrambled.substring(m.index + scrambledWord.length);
//       }
//     });

//     element.innerHTML = scrambled;
//     await new Promise((resolve) => setTimeout(resolve, stepTime));
//   }

//   element.innerHTML = originalText;
// }

async function scrambleInPlace3(element, duration = 2400, stepTime = 50) {
  const originalText = element.innerHTML;
  element.innerHTML = originalText.replace(
    /(?:<[^>]*>)|(\b\w+[^\w\s<>]*)/gm,
    (match, word) => word ? `<span class="sw">${word}</span>` : match
  );
  const spans = element.querySelectorAll('.sw');

  // start everything invisible
  spans.forEach(span => span.style.visibility = 'hidden');
  await new Promise(resolve => setTimeout(resolve, stepTime));

  const startTime = performance.now();
  let t = 0;
  while (t < 1) {
    t = easeInSine(Math.min((performance.now() - startTime) / duration, 1));
    spans.forEach(span => {
      // span.style.visibility = Math.random() > t ? 'hidden' : 'visible';
      if (Math.random() <= t && span.style.visibility === 'hidden') span.style.visibility = 'visible';;
    });
    await new Promise(resolve => setTimeout(resolve, stepTime));
  }

  element.innerHTML = originalText; // unwraps spans, restores original
}

function animateText(textElement) {
  scrambleInPlace3(textElement, 500, 60); // TODO FIX ME SCRAMBLE IS LOOSING STUFF....
}