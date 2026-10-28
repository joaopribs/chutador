let currentString = "";

let popupIsOpen = false;

const UNCOMMON_LETTERS = {
  EN: "JQXZ", 
  PT: "JKWXYZ"
}

const COMMON_LETTERS = {
  EN: "AEIOURNSTLCD", 
  PT: "AEIOURTNCSLD"
}

const CAPITAL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Best guess: how many dictionary words get fully scored, and how many answers to score them against
const BEST_GUESS_SHORTLIST = 200;
const BEST_GUESS_CANDIDATES_SHORTLIST = 50;
const BEST_GUESS_MAX_ANSWERS = 1000;
const ALL_GREEN_PATTERN = 242; // 3^5 - 1

let dictionaries = {};
let searchId = 0;

function wordHasRepeatedLetters(word) {
  for (let i = 0; i < word.length; i++) {
    let letter = word.charAt(i);
    for (let j = i + 1; j < word.length; j++) {
      if (letter == word.charAt(j)) {
        return true;
      }
    }
  }

  return false;
}

function countCommonLetters(word, commonLetters) {
  let count = 0;

  for (let i = 0; i < commonLetters.length; i++) {
    let letter = commonLetters[i];
    if (word.includes(letter)) {
      count++;
    }
  }

  return count;
}

function wordHasUncommonLetters(word, uncommonLetters) {
  for (let i = 0; i < uncommonLetters.length; i++) {
    let letter = uncommonLetters[i];
    if (word.includes(letter)) {
      return true;
    }
  }

  return false;
}

function getLettersToExclude() {
  let lettersToExclude = "";
  $(".grid_cell.black").each(function () {
    const letter = $(this).html();
    if (!lettersToExclude.includes(letter)) {
      lettersToExclude += letter;
    }
  });

  return lettersToExclude;
}

function getLanguage() {
  return $(".language.selected").data("language");
}

function getLettersInPositionsAndNot() {
  let lettersNotInPositions = [];
  let lettersInPositions = [];

  for (let i = 0; i < 5; i++) {
    let lettersNotInPosition = "";
    let lettersInPosition = "";

    for (let j = 0; j < 5; j++) {
      let index = (i * 5) + j;
      let $element = $(".grid_cell:eq(" + index + ")");

      if ($element.hasClass("yellow")) {
        lettersNotInPosition += $element.html();
      }
      else {
        lettersNotInPosition += "*";
      }

      if ($element.hasClass("green")) {
        lettersInPosition += $element.html();
      }
      else {
        lettersInPosition += "*";
      }
    }

    if (lettersNotInPosition != "*****") {
      lettersNotInPositions.push(lettersNotInPosition);
    }

    if (lettersInPosition != "*****") {
      lettersInPositions.push(lettersInPosition);
    }
  }

  return {
    lettersNotInPositions: lettersNotInPositions,
    lettersInPositions: lettersInPositions
  };
}

function countPoints(word, pointsPerLetter) {
  let points = 0;
  let lettersChecked = "";
  for (let i = 0; i < word.length; i++) {
    let letter = word.charAt(i);
    if (!lettersChecked.includes(letter)) {
      points += pointsPerLetter[letter];
      lettersChecked += letter;
    }
  }
  return points;
}

function getDictionary(language, callback) {
  if (dictionaries[language]) {
    callback(dictionaries[language]);
    return;
  }

  $.get("/api/v1/words", { language: language, length: 5 }, function (data) {
    dictionaries[language] = data.words;
    callback(data.words);
  });
}

// Colors that guessing a word would show if answer was the solution, encoded in base 3 (0 black, 1 yellow, 2 green)
function getPattern(guess, answer) {
  let colors = [0, 0, 0, 0, 0];
  let unmatchedLetters = {};

  for (let i = 0; i < 5; i++) {
    if (guess.charAt(i) == answer.charAt(i)) {
      colors[i] = 2;
    }
    else {
      const letter = answer.charAt(i);
      unmatchedLetters[letter] = (unmatchedLetters[letter] || 0) + 1;
    }
  }

  let pattern = 0;
  for (let i = 0; i < 5; i++) {
    const letter = guess.charAt(i);
    if (colors[i] == 0 && unmatchedLetters[letter] > 0) {
      colors[i] = 1;
      unmatchedLetters[letter]--;
    }
    pattern = pattern * 3 + colors[i];
  }

  return pattern;
}

// Rough score of how much a word splits the candidates: letters in about half of them are the most useful
function getInformationScore(word, lettersCount, candidatesCount) {
  let score = 0;
  let lettersChecked = "";
  for (let i = 0; i < word.length; i++) {
    let letter = word.charAt(i);
    if (!lettersChecked.includes(letter)) {
      const count = lettersCount[letter] || 0;
      score += Math.min(count, candidatesCount - count);
      lettersChecked += letter;
    }
  }
  return score;
}

// Finds the word, even if it can't be the solution, that leaves the fewest candidates on average after guessing it
function findBestGuess(candidates, dictionary) {
  let lettersCount = {};
  candidates.forEach(function (word) {
    let lettersCounted = "";
    for (let i = 0; i < word.length; i++) {
      const letter = word.charAt(i);
      if (!lettersCounted.includes(letter)) {
        lettersCount[letter] = (lettersCount[letter] || 0) + 1;
        lettersCounted += letter;
      }
    }
  });

  const byInformationScore = function (words) {
    return words
      .map(function (word) { return [word, getInformationScore(word, lettersCount, candidates.length)]; })
      .sort(function (a, b) { return b[1] - a[1]; })
      .map(function (pair) { return pair[0]; });
  };

  const guesses = new Set(byInformationScore(dictionary).slice(0, BEST_GUESS_SHORTLIST)
    .concat(byInformationScore(candidates).slice(0, BEST_GUESS_CANDIDATES_SHORTLIST)));

  let answers = candidates;
  if (candidates.length > BEST_GUESS_MAX_ANSWERS) {
    const step = candidates.length / BEST_GUESS_MAX_ANSWERS;
    answers = [];
    for (let i = 0; i < BEST_GUESS_MAX_ANSWERS; i++) {
      answers.push(candidates[Math.floor(i * step)]);
    }
  }

  const candidatesSet = new Set(candidates);
  let best = null;

  guesses.forEach(function (guess) {
    let groups = {};
    answers.forEach(function (answer) {
      const pattern = getPattern(guess, answer);
      groups[pattern] = (groups[pattern] || 0) + 1;
    });

    // Each answer leaves the words that share its pattern, except when the guess is the answer itself
    let wordsLeft = 0;
    for (const pattern in groups) {
      if (pattern != ALL_GREEN_PATTERN) {
        wordsLeft += groups[pattern] * groups[pattern];
      }
    }
    const expectedRemaining = wordsLeft / answers.length * (candidates.length / answers.length);
    const isCandidate = candidatesSet.has(guess);

    if (best == null || expectedRemaining < best.expectedRemaining ||
        (expectedRemaining == best.expectedRemaining && isCandidate && !best.isCandidate)) {
      best = { word: guess, expectedRemaining: expectedRemaining, isCandidate: isCandidate };
    }
  });

  return best;
}

function showBestGuess(candidates, language, currentSearchId) {
  if (candidates.length <= 2) {
    return;
  }

  getDictionary(language, function (dictionary) {
    if (currentSearchId != searchId) {
      return;
    }

    const best = findBestGuess(candidates, dictionary);
    $("#best_guess_word").html(best.word);
    $("#best_guess_remaining").html(best.expectedRemaining.toFixed(1));
    $("#best_guess").show();
  });
}

function search() {
  searchId++;
  const currentSearchId = searchId;

  popupIsOpen = true;
  
  $("#popup").css("display", "flex");

  $("#suggestions_title").show();

  $("#helper_title").hide();
  $("#helper_content").hide();

  $("#results").hide();
  $("#best_guess").hide();
  $("#loading").show();

  const language = getLanguage();

  const lettersInPositionAndNot = getLettersInPositionsAndNot();
  const lettersInPositions = lettersInPositionAndNot['lettersInPositions'];
  const lettersNotInPositions = lettersInPositionAndNot['lettersNotInPositions'];

  let correctLetters = lettersInPositions.join("");
  correctLetters += lettersNotInPositions.join("");

  let lettersToExclude = "";
  let lettersToExcludeBeforeFiltering = getLettersToExclude();
  for (let i = 0; i < lettersToExcludeBeforeFiltering.length; i++) {
    let letter = lettersToExcludeBeforeFiltering.charAt(i);
    if (!correctLetters.includes(letter)) {
      lettersToExclude += letter;
    }
  }

  const payload = {
    language: language, 
    letters_in_positions: lettersInPositions, 
    letters_to_exclude: lettersToExclude, 
    letters_not_in_positions: lettersNotInPositions,
    length: 5
  }

  $.post("/api/v1/find", payload, function (data) {
    $("#count").html(data.count);

    let html = "";

    let uncommonLetters = UNCOMMON_LETTERS[language];
    let commonLetters = COMMON_LETTERS[language];

    const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let letterPoints = {};
    for (let i = 0; i < 26; i++) {
      letterPoints[allLetters.charAt(i)] = 0;
    }

    let maxCommonQuantity = 0;

    for (let i = 0; i < data.count; i++) {
      let word = data.words[i].toUpperCase();
      let hasUncommonLetters = wordHasUncommonLetters(word, uncommonLetters);
      let commonLettersQuantity = countCommonLetters(word, commonLetters);

      let cssClass = "";

      if (commonLettersQuantity > maxCommonQuantity) {
        maxCommonQuantity = commonLettersQuantity;
      }

      if (hasUncommonLetters) {
        cssClass = "uncommon_letters";
      }
      else {
        if (wordHasRepeatedLetters(word)) {
          cssClass = "repeated_letters";
        }
      }

      if (data.count > 10) {
        let lettersCounted = "";
        for (let j = 0; j < word.length; j++) {
          const letter = word.charAt(j);
          if (!lettersCounted.includes(letter)) {
            letterPoints[letter]++;
            lettersCounted += letter;
          }
        }
      }

      html += "<span class=\"" + cssClass + "\" data-commoncount=\"" + commonLettersQuantity + "\" data-wordindex=" + i + ">" + word + "</span>";
    }

    $("#words").html(html);

    if (data.count > 10) {
      let pointsPerWord = [];
      $("#words span").each(function () {
        let word = $(this).html();
        pointsPerWord.push([$(this).data("wordindex"), countPoints(word, letterPoints)]);
      });

      pointsPerWord = pointsPerWord.sort(function (a, b) {
        return b[1] - a[1];
      });

      for (let i = 0; i < 10 && i < pointsPerWord.length; i++) {
        $("span[data-wordindex=" + pointsPerWord[i][0] + "]").addClass("most_points");
      }
    }

    $('*[data-commoncount="' + maxCommonQuantity + '"]').addClass("common_letters");
    $("#results").show();
    $("#loading").hide();

    showBestGuess(data.words.map(function (word) { return word.toUpperCase(); }), language, currentSearchId);
  });
}

function enableOrDisableSearchButton() {
  if (currentString.length > 0 && currentString.length % 5 == 0) {
    $("#search").removeClass("disabled");
  }
  else {
    $("#search").addClass("disabled");
  }
}

function enableOrDisableClearButton() {
  if (currentString.length > 0) {
    $("#clear").removeClass("disabled");
  }
  else {
    $("#clear").addClass("disabled");
  }
}

function updateCaret() {
  $(".grid_cell").removeClass("caret");

  let caretPosition = 0;

  if (currentString.length == 25) {
    caretPosition = 24;
  }
  else if (currentString.length > 0) {
    caretPosition = currentString.length;
  }

  if (currentString.length < 25) {
    $(".grid_cell:eq(" + caretPosition + ")").removeClass("transparent black yellow green");
  }
  $(".grid_cell:eq(" + caretPosition + ")").addClass("caret");

  enableOrDisableSearchButton();
  enableOrDisableClearButton();
}

function updateLetters() {
  if (currentString.length == 0) {
    $(".grid_cell").html("&nbsp;");
    $(".grid_cell").removeClass("black yellow green");
    $(".grid_cell").addClass("transparent");
  }
  else {
    for (let i = 0; i < currentString.length; i++) {
      $element = $(".grid_cell:eq(" + i + ")");
      $element.html(currentString.charAt(i));

      if (!$element.hasClass("yellow") && !$element.hasClass("green")) {
        $element.addClass("black");
      }
    }
    $(".grid_cell:gt(" + (currentString.length - 1) + ")").addClass("transparent");
    $(".grid_cell:gt(" + (currentString.length - 1) + ")").html("&nbsp;");
  }
  
  updateCaret();
}

function addLetter(letter) {
  if (currentString.length < 25) {
    currentString += letter;
  }
  updateLetters();
}

function removeLetter() {
  currentString = currentString.slice(0, -1);
  updateLetters();
}

function closePopup() {
  $("#popup").hide();
  popupIsOpen = false;
}

function changeColor($element, direction) {
  const colorSequence = ["black", "yellow", "green"];
  
  for (let colorIndex = 0; colorIndex < colorSequence.length; colorIndex++) {
    const color = colorSequence[colorIndex];
    if ($element.hasClass(color)) {
      let nextColorIndex = colorIndex + (direction == "up" ? 1 : -1);

      if (nextColorIndex < 0) {
        nextColorIndex = colorSequence.length - 1;
      }
      else if (nextColorIndex >= colorSequence.length) {
        nextColorIndex = 0;
      }

      const nextColor = colorSequence[nextColorIndex];
      $element.removeClass(colorSequence.join(" "));
      $element.addClass(nextColor);
      
      break;
    }
  }
}

function clear() {
  currentString = "";
  updateLetters();
}

function fillWord(word) {
  for (let i = 0; i < word.length; i++) {
    addLetter(word.charAt(i));
  }
  closePopup();
}

function showHelper() {
  popupIsOpen = true;
    
  $("#popup").show();

  $("#suggestions_title").hide();
  $("#loading").hide();
  $("#results").hide();

  $("#helper_title").show();
  $("#helper_content").show();
}

$(document).ready(function () {
  $("#keyboard > .keyboard_row > .keyboard_cell").on("click", function () {
    let $element = $(this);
    $element.addClass("clicked");

    setTimeout(function() {
      $element.removeClass("clicked");
    }, 200);

    let symbol = $element.html();
    if (symbol == "⌫") {
      removeLetter();
    }
    else {
      addLetter($element.html());
    }
  });

  $(".grid_cell").on("click", function () {
    changeColor($(this), "up");
  });

  $(".language").on("click", function () {
    $(".language").removeClass("selected");
    $(".language[data-language=" + $(this).data("language") + "]").addClass("selected");
  });

  $("#search").on("click", function () {
    if (!$(this).hasClass("disabled")) {
      search();
    }
  });

  $("#clear").on("click", function () {
    if (!$(this).hasClass("disabled")) {
      clear();
    }
  });

  $("#close_popup").on("click", function () {
    closePopup();
  });

  $("#helper_link").on("click", function () {
    showHelper();
  });

  $("#words").on("click", "span", function () {
    fillWord($(this).html());
  });

  $("#best_guess_word").on("click", function () {
    fillWord($(this).html());
  });

  updateCaret();
});

window.addEventListener("keydown", function(event) {
  let letter = "";

  let keynum = event.keyCode;

  if (popupIsOpen) {
    if (keynum == 27 || keynum == 88) { // esc or X
      closePopup();
    }
  }
  else {
    if (keynum == 46 || keynum == 8) {
      event.preventDefault();
      letter = "delete";
      removeLetter();
    }
    else if (keynum == 13) { // enter
      if (!$("#search").hasClass("disabled")) {
        search();
      }
    }
    else if (keynum == 38 || keynum == 40) { // arrow up or down
      if (currentString.length > 0) {
        changeColor($(`.grid_cell:eq(${currentString.length - 1})`), keynum == 38 ? "up" : "down");
      }
    }
    else if (keynum == 27) { // esc
      clear();
    }
    else if (keynum == 191) { // ?
      showHelper();
    }
    else {
      let char = String.fromCharCode(keynum).toUpperCase();
      if (CAPITAL_LETTERS.includes(char)) {
        event.preventDefault();
        letter = char;
        addLetter(char);
      }
    }

    $("div[data-letter=\"" + letter + "\"]").addClass("clicked");

    setTimeout(function() {
      $("div[data-letter=\"" + letter + "\"]").removeClass("clicked");
    }, 200);
  }
}, false);
