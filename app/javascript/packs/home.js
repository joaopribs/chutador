const UNCOMMON_LETTERS = {
  EN: "JQXZ", 
  PT: "JKWXYZ"
}

const COMMON_LETTERS = {
  EN: "AEIOURNSTLCD", 
  PT: "AEIOURTNCSLD"
}

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

function search() {
  let language = $("select[name=language]").val();
  let lettersInPosition = $("input[name=letters_in_position").val();
  let lettersToExclude = $("input[name=letters_to_exclude").val();
  
  let lettersNotInPositions = [];

  let lettersNotInPositionsElements = $('input[name="letters_not_in_positions[]"]');
  for (let i = 0; i < lettersNotInPositionsElements.length; i++) {
    let lettersNotInPosition = $(lettersNotInPositionsElements.get(i)).val();
    lettersNotInPositions.push(lettersNotInPosition);
  }

  let payload = {
    language: language, 
    letters_in_position: lettersInPosition, 
    letters_to_exclude: lettersToExclude, 
    letters_not_in_positions: lettersNotInPositions,
    length: 5
  }

  $.post("/api/v1/find", payload, function (data) {
    $("#count").html(data.count);

    let elements = [];

    let uncommonLetters = UNCOMMON_LETTERS[language];
    let commonLetters = COMMON_LETTERS[language];

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

      elements.push("<span class=\"" + cssClass + "\" data-commoncount=\"" + commonLettersQuantity + "\">" + word + "</span>");
    }

    $("#words").html(elements.join("<br/>"));

    $("#result").css("display", "table-cell");

    $('*[data-commoncount="' + maxCommonQuantity + '"]').addClass("common_letters");
  });
}

function resetLetters() {
  $("input[name=letters_input]").val("");
  updateLetters();
  resetColors();
  $("input[name=letters_input]").focus();
}

function reset() {
  $("input").val("");
  $("#letters_not_in_position_wrapper").empty();
  updateLetters();
  resetColors();
  $("input[name=letters_input]").focus();
  $("#result").hide();
}

function updateLast() {
  let value = $("input[name=letters_input]").val();

  let lastPosition = 1;

  if (value.length < 5) {
    lastPosition = value.length + 1;
  }
  else {
    lastPosition = 5;
  }

  $("#letter_" + lastPosition).addClass("last");
  $(".letter_input:not(#letter_" + lastPosition + ")").removeClass("last");
}

function updateLetters() {
  let value = $("input[name=letters_input]").val();

  for (let i = 0; i < 5; i++) {
    if (i < value.length) {
      $("#letter_" + (i + 1)).html(value.charAt(i));
    }
    else {
      $("#letter_" + (i + 1)).html("");
    }
  }

  updateLast();
}

function clearColors(letterNumber) {
  let colors = ["grey", "yellow", "green"];
  for (let i = 0; i < colors.length; i++) {
    let color = colors[i];
    $("#letter_" + letterNumber).removeClass(color);
  }
}

function resetColors() {
  for (let i = 1; i <= 5; i++) {
    clearColors(i);
    $("#letter_" + i).addClass("grey");
  }

}

$(document).ready(function () {
  $("input[name=letters_input]").on("input", function () {
    updateLetters();
  });

  $(".colors > div").click(function (event) {
    event.preventDefault();
    
    let letterNumber = $(this).parent().attr("id").split("_")[1];
    clearColors(letterNumber);
    let colorToSet = $(this).attr("class").split("_")[0];
    $("#letter_" + letterNumber).addClass(colorToSet);

    $("input[name=letters_input]").focus();
  });

  $("#reset").click(function () {
    reset();
  });

  $("#search").click(function () {
    $("#results").html("Loading...");

    let lettersInPosition = "*****";
    let lettersNotInPositionToAdd = "*****";

    for (let i = 0; i < 5; i++) {
      let $element = $("#letter_" + (i + 1));
      let letter = $element.html().toUpperCase();

      if ($element.hasClass("green")) {
        lettersInPosition = lettersInPosition.substr(0, i) + letter + lettersInPosition.substr(i + 1);
      }

      if ($element.hasClass("yellow")) {
        lettersNotInPositionToAdd = lettersNotInPositionToAdd.substr(0, i) + letter + lettersNotInPositionToAdd.substr(i + 1);
      }

      if ($element.hasClass("grey")) {
        let lettersToExclude = $("input[name=letters_to_exclude]").val();
        if (!lettersToExclude.includes(letter)) {
          $("input[name=letters_to_exclude]").val(lettersToExclude + letter);
        }
      }
    }
    $("input[name=letters_in_position]").val(lettersInPosition.toUpperCase());

    if (lettersNotInPositionToAdd != "*****") {
      $("#letters_not_in_position_wrapper").append('<div><input type="text" name="letters_not_in_positions[]" value="' + lettersNotInPositionToAdd + '"/><a href="#" class="delete_letters_not_in_position">X</a></div>');

      $(".delete_letters_not_in_position").on("click", function (event) {
        event.preventDefault();
        $(this).parent().remove();
      });
    }

    search();
    resetLetters();
  });

  $("input[name=letters_input]").on("focusin", function () {
    updateLast();
  });

  $(".letter_input, #container").click(function () {
    $("input[name=letters_input]").focus();
  });

  $("input[name=letters_input]").focus();

  $("input[name=letters_input]").on("focusout", function () {
    $(".last").removeClass("last");
  });

  $("#refresh").click(function () {
    search();
  });
});