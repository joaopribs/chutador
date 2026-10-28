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

// Filter word: how many dictionary words get fully scored, and how many answers to score them against
const FILTER_WORD_SHORTLIST = 200;
const FILTER_WORD_CANDIDATES_SHORTLIST = 50;
const FILTER_WORD_MAX_ANSWERS = 1000;
const ALL_GREEN_PATTERN = 242; // 3^5 - 1

let dictionaries = {};
let searchId = 0;

let lastInputWasKeyboard = false;

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

// Finds the filter word: the word, usually not a possible solution, that leaves the fewest candidates on average after playing it
function findFilterWord(candidates, dictionary) {
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

  const options = new Set(byInformationScore(dictionary).slice(0, FILTER_WORD_SHORTLIST)
    .concat(byInformationScore(candidates).slice(0, FILTER_WORD_CANDIDATES_SHORTLIST)));

  let answers = candidates;
  if (candidates.length > FILTER_WORD_MAX_ANSWERS) {
    const step = candidates.length / FILTER_WORD_MAX_ANSWERS;
    answers = [];
    for (let i = 0; i < FILTER_WORD_MAX_ANSWERS; i++) {
      answers.push(candidates[Math.floor(i * step)]);
    }
  }

  const candidatesSet = new Set(candidates);
  let best = null;

  options.forEach(function (option) {
    let groups = {};
    answers.forEach(function (answer) {
      const pattern = getPattern(option, answer);
      groups[pattern] = (groups[pattern] || 0) + 1;
    });

    // Each answer leaves the words that share its pattern, except when the option is the answer itself
    let wordsLeft = 0;
    for (const pattern in groups) {
      if (pattern != ALL_GREEN_PATTERN) {
        wordsLeft += groups[pattern] * groups[pattern];
      }
    }
    const expectedRemaining = wordsLeft / answers.length * (candidates.length / answers.length);
    const isCandidate = candidatesSet.has(option);

    if (best == null || expectedRemaining < best.expectedRemaining ||
        (expectedRemaining == best.expectedRemaining && isCandidate && !best.isCandidate)) {
      best = { word: option, expectedRemaining: expectedRemaining, isCandidate: isCandidate };
    }
  });

  return best;
}

function showFilterWord(candidates, language, currentSearchId) {
  if (candidates.length <= 2) {
    return;
  }

  getDictionary(language, function (dictionary) {
    if (currentSearchId != searchId) {
      return;
    }

    const filterWord = findFilterWord(candidates, dictionary);
    $("#filter_word_button").html(filterWord.word);
    $("#filter_word_remaining").html(filterWord.expectedRemaining.toFixed(1));
    $("#filter_word").show();
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
  $("#filter_word").hide();
  $("#loading").show();

  focusPopup();

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

      html += "<button type=\"button\" class=\"" + cssClass + "\" data-commoncount=\"" + commonLettersQuantity + "\" data-wordindex=" + i + ">" + word + "</button>";
    }

    $("#words").html(html);

    if (data.count > 10) {
      let pointsPerWord = [];
      $("#words button").each(function () {
        let word = $(this).html();
        pointsPerWord.push([$(this).data("wordindex"), countPoints(word, letterPoints)]);
      });

      pointsPerWord = pointsPerWord.sort(function (a, b) {
        return b[1] - a[1];
      });

      for (let i = 0; i < 10 && i < pointsPerWord.length; i++) {
        $("#words button[data-wordindex=" + pointsPerWord[i][0] + "]").addClass("most_points");
      }
    }

    $('*[data-commoncount="' + maxCommonQuantity + '"]').addClass("common_letters");
    $("#results").show();
    $("#loading").hide();

    showFilterWord(data.words.map(function (word) { return word.toUpperCase(); }), language, currentSearchId);
  });
}

function enableOrDisableSearchButton() {
  if (currentString.length > 0 && currentString.length % 5 == 0) {
    $("#search").removeClass("disabled").attr("aria-disabled", "false");
  }
  else {
    $("#search").addClass("disabled").attr("aria-disabled", "true");
  }
}

function enableOrDisableClearButton() {
  if (currentString.length > 0) {
    $("#clear").removeClass("disabled").attr("aria-disabled", "false");
  }
  else {
    $("#clear").addClass("disabled").attr("aria-disabled", "true");
  }
}

// Screen reader label for each grid cell, like "Row 2, position 3: E, yellow"
function updateCellLabels() {
  const $grid = $("#grid");

  $(".grid_cell").each(function (index) {
    const $element = $(this);
    let description = $grid.data("empty");

    if (index < currentString.length) {
      description = currentString.charAt(index);
      ["black", "yellow", "green"].forEach(function (color) {
        if ($element.hasClass(color)) {
          description += ", " + $grid.data(color);
        }
      });
    }

    $element.attr("aria-label", $element.data("label") + ": " + description);
  });
}

function colorHintWasDismissed() {
  try {
    return localStorage.getItem("colorHintDismissed") == "true";
  }
  catch (e) {
    return false;
  }
}

function dismissColorHint() {
  try {
    localStorage.setItem("colorHintDismissed", "true");
  }
  catch (e) {
    // Without storage, the hint just shows again on the next visit
  }
  $("#color_hint").hide();
}

// Shown once a row is complete, until the first time a color is changed
function updateColorHint() {
  if (currentString.length >= 5 && !colorHintWasDismissed()) {
    $("#color_hint").show();
  }
  else {
    $("#color_hint").hide();
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
  updateCellLabels();
  updateColorHint();
}

function updateLetters() {
  if (currentString.length == 0) {
    $(".grid_cell").html("&nbsp;");
    $(".grid_cell").removeClass("black yellow green");
    $(".grid_cell").addClass("transparent");
  }
  else {
    for (let i = 0; i < currentString.length; i++) {
      let $element = $(".grid_cell:eq(" + i + ")");
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
  // Don't leave focus on a hidden button, it would swallow the next enter
  if ($.contains($("#popup")[0], document.activeElement)) {
    document.activeElement.blur();
  }

  $("#popup").hide();
  popupIsOpen = false;
}

// Only for keyboard users: on a tap, focusing would draw a focus ring around the close button
function focusPopup() {
  if (lastInputWasKeyboard) {
    $("#close_popup").trigger("focus");
  }
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

      // Restart the flip animation, even if it is still running from a previous click
      $element.removeClass("flip");
      $element[0].offsetWidth;
      $element.addClass("flip");

      updateCellLabels();
      dismissColorHint();

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

  focusPopup();
}

$(document).ready(function () {
  // Clicking a button shouldn't focus it, otherwise enter would click it again instead of searching.
  // Buttons can still be focused with tab.
  $(document).on("mousedown", "button", function (event) {
    event.preventDefault();
  });

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
    $(".language").removeClass("selected").attr("aria-pressed", "false");
    $(".language[data-language=" + $(this).data("language") + "]").addClass("selected").attr("aria-pressed", "true");
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

  $("#words").on("click", "button", function () {
    fillWord($(this).html());
  });

  $("#filter_word_button").on("click", function () {
    fillWord($(this).html());
  });

  updateCaret();
});

window.addEventListener("pointerdown", function () {
  lastInputWasKeyboard = false;
}, true);

window.addEventListener("keydown", function(event) {
  lastInputWasKeyboard = true;

  let letter = "";

  let keynum = event.keyCode;

  // Enter or space on a button focused with tab: let the button handle it
  if ($(event.target).is("button") && (keynum == 13 || keynum == 32)) {
    return;
  }

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

    $(".keyboard_cell[data-letter=\"" + letter + "\"]").addClass("clicked");

    setTimeout(function() {
      $(".keyboard_cell[data-letter=\"" + letter + "\"]").removeClass("clicked");
    }, 200);
  }
}, false);
