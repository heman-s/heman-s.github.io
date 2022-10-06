// STICKY HEADER
window.onscroll = function() {stickyHeader()};

var header = document.getElementById("header");
var header2 = document.getElementById("header2");
var sticky = header.offsetTop;

function stickyHeader() {
  if (window.pageYOffset > sticky) {
    header.classList.add("sticky");
  } else {
    header.classList.remove("sticky");
  }
}

// DARK MODE
function darkMode() {
  var element = document.body;
  element.classList.toggle("darkMode");
}

// MENU BUTTONS
function myWork(){
  var slideshow = document.getElementById("slideshow");
  document.documentElement.scrollTop = slideshow.offsetTop;
  document.body.scrollTop = slideshow.offsetTop;
}

// SHOW MORE BUTTON
const showMoreButton = document.querySelector('.showMoreButton');
const text = document.querySelector('.profileSummaryContent');
const retract = document.querySelector('.fade');

showMoreButton.addEventListener('click', (e)=>{
    let visible = text.querySelector('.moreText');
    text.classList.toggle('showMore');
    retract.classList.toggle('retract');
    if(showMoreButton.value == "Show More >"){
        showMoreButton.value = "Show Less >";
    }
    else if(showMoreButton.value == "Voir Plus >"){
      showMoreButton.value = "Voir Moins >";
    }
    else if(showMoreButton.value == "Show Less >"){
        showMoreButton.value= "Show More >";
    }
    else if(showMoreButton.value == "Voir Moins >"){
      showMoreButton.value= "Voir Plus >";
  }
})

// AUTOMATIC SLIDESHOW
var counter = 1;
var i;
let dots = document.getElementsByClassName("manual-btn");
function auto(){
  for (i = 0; i < dots.length; i++) {
    dots[i].className = dots[i].className.replace(" active", "");
    var image = document.getElementById("slide"+(i+1));
    image.classList.remove("opaque");
  }
  document.getElementById('radio' + counter).checked = true;
  dots[counter-1].className += " active";
  var image = document.getElementById("slide"+(counter));
  image.classList.add("opaque");
  counter++;
  if(counter > 4){
    counter = 1;
  }
  myTimeout = setTimeout(auto, 4000);
}
auto();

// ACTIVE DOTS
function makeActive(index){
  clearTimeout(myTimeout);
  for (i = 0; i < dots.length; i++) {
    dots[i].className = dots[i].className.replace(" active", "");
    var image = document.getElementById("slide"+(i+1));
    image.classList.remove("opaque");
  }
  document.getElementById('radio' + index).checked = true;
  dots[index-1].className += " active";
  var image = document.getElementById("slide"+(index));
  image.classList.add("opaque");
  counter = index;
  if(pauseButton.classList.contains('active')){
    auto();
  }
}

// PAUSE BUTTON
var pauseButton = document.getElementById('pauseBtnDiv');

function pauseAndStartSlideshow(){
  if(pauseButton.classList.contains('active')){
    clearTimeout(myTimeout);
  }
  else{
    auto();
  }
  pauseButton.classList.toggle('active')
}

// FIND OUT MORE BUTTON
function on() {
  document.getElementById("overlay").style.display = "block";
  if(pauseButton.classList.contains('active')){
    pauseAndStartSlideshow();
  }
  var popupHeader = document.getElementsByClassName("popupHeader");

  for (i = 0; i < popupHeader.length; i++) {
    popupHeader[i].style.display = "none";
  }

  var popupDesc = document.getElementsByClassName("popupDescription");

  for (i = 0; i < popupDesc.length; i++) {
    popupDesc[i].style.display = "none";
  }

  var popupCounter;
  if(counter == 1){
    popupCounter = 3;
  }
  else {
    popupCounter = counter-2;
  }
  popupHeader[popupCounter].style.display = "block";
  popupDesc[popupCounter].style.display = "block";  
}

function off() {
  document.getElementById("overlay").style.display = "none";
  if(!(pauseButton.classList.contains('active'))){
    pauseAndStartSlideshow();
  }
}
