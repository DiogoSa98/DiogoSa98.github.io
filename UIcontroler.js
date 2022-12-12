currentCardId = "card-about";

var form;

window.addEventListener('load',() => {
    currentCard = document.getElementById(currentCardId);
    currentCard.classList.remove("disabled");
    currentCard.classList.add("active");

    SetupCards();

    form = document.getElementById("contact-form");
    form.addEventListener("submit", handleSubmit);

    SetupNavbar();
});

let newNavPos = 0.0;
let scrollY = 0;
let scrolling = false;

function ScrollSwipe(event) {
    if (!scrolling)
    {
        scrollY = event.deltaY;
        console.log(scrollY, " scrollY ");
        console.log(event.deltaY);
    }

    if (scrollY < -20 && currentCardId != "card-about" && !scrolling)
    {
        scrollY = 0;

        newCard = currentCard.previousElementSibling;
        currentCardId = newCard.id;
        console.log('scrolling up', currentCardId);

        Scroll(newCard);

        if (newCard.classList.contains("skipNav"))
            newNavPos += .095;
        else
            newNavPos += .666;
    }
    
    if (scrollY > 20 && currentCardId != "card-contact"  && !scrolling)
    {
        scrollY = 0;

        newCard = currentCard.nextElementSibling;
        currentCardId = newCard.id;
        console.log('scrolling down', currentCardId);

        Scroll(newCard);

        if (currentCard.classList.contains("skipNav"))
            newNavPos -= .095;
        else
            newNavPos -= .666;
    }
}
window.addEventListener('wheel', ScrollSwipe);

window.addEventListener('keydown', (event) => {
    if (event.key == "ArrowLeft")
    {
        if (currentCardId != "card-about" && !scrolling) //) && currentCard.previousElementSibling.id != currentCardId)
        {
            newCard = currentCard.previousElementSibling;
            currentCardId = newCard.id;
            console.log('scrolling up', currentCardId);

            Scroll(newCard);

            if (newCard.classList.contains("skipNav"))
                newNavPos += .095;
            else
                newNavPos += .666;
        }
    }
    if (event.key == "ArrowRight")
    {
        if (currentCardId != "card-contact"  && !scrolling)// && currentCard.nextElementSibling.id != currentCardId)
        {
            newCard = currentCard.nextElementSibling;
            currentCardId = newCard.id;
            console.log('scrolling down', currentCardId);

            Scroll(newCard);

            if (currentCard.classList.contains("skipNav"))
                newNavPos -= .095;
            else
                newNavPos -= .666;
        }
    }
});

function Scroll(newCard) 
{
    scrolling = true;

    let video = currentCard.getElementsByTagName("video")[0];
    if (video)
    {
        video.pause();
    }

    // current elements animation
    // translate image left and fade opacity
    // translate text down and fade opacity
    currentCard.classList.remove("active");
    currentCard.classList.add("disabled");

    setTimeout(()=> {
        currentCard.style.top = "-100%";
    }, 900);

        // new elements animation
    // translate image right and fade opacity
    // translate text up and fade opacity
    setTimeout(()=> {
        newCard.classList.remove("disabled");
        newCard.style.top = "auto";
        newCard.classList.add("active");
        currentCard = newCard;
        
        scrolling = false;
    }, 900);
}

function SetupCards()
{
    document.querySelectorAll('.card').forEach(function callback(element, id) {
        if (element.id != currentCardId)
        {
            element.style.top = "-100%";
        }
    });
}

function SetupNavbar()
{
    document.querySelectorAll('#navbar > h6').forEach(function callback(element, id) {
        element.addEventListener('click', event => {
            console.log(`${id}: ${element}`);

            let cardId = `card-${element.textContent}`;
            if (currentCardId != cardId && !scrolling) {
                newNavPos = -.666 * id;
                currentCardId = cardId;
                currentNavId = id;
                Scroll(document.getElementById(cardId));
            }

        });
    });
}


async function handleSubmit(event) {
    event.preventDefault();
    var status = document.getElementById("contact-send");
    var data = new FormData(event.target);
    fetch(event.target.action, {
      method: form.method,
      body: data,
      headers: {
          'Accept': 'application/json'
      }
    }).then(response => {
        if (response.ok) {
        status.innerHTML = "Your email was sent!";
        form.reset();
        form.removeEventListener("submit", handleSubmit);
        } else {
        response.json().then(data => {
            if (Object.hasOwn(data, 'errors')) {
            status.innerHTML = data["errors"].map(error => error["message"]).join(", ")
            } else {
            status.innerHTML = "Oops! There was a problem submitting your email"
            }
        })
        form.removeEventListener("submit", handleSubmit);
        }
    }).catch(error => {
      status.innerHTML = "Oops! There was a problem submitting your email"
      form.removeEventListener("submit", handleSubmit);
    });
  }

 
