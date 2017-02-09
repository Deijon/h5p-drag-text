/**
 * Drag Text module
 * @external {jQuery} $ H5P.jQuery
 */
H5P.DragText = (function ($, Question, Draggable, Droppable, TextParser, Controls) {
  //CSS Main Containers:
  var MAIN_CONTAINER = "h5p-drag";
  var INNER_CONTAINER = "h5p-drag-inner";
  var TASK_CONTAINER = "h5p-drag-task";
  var WORDS_CONTAINER = "h5p-drag-droppable-words";
  var DROPZONE_CONTAINER = "h5p-drag-dropzone-container";
  var DRAGGABLES_CONTAINER = "h5p-drag-draggables-container";

  //Special Sub-containers:
  var DROPZONE = "h5p-drag-dropzone";
  var SHOW_SOLUTION_CONTAINER = "h5p-drag-show-solution-container";
  var DRAGGABLES_WIDE_SCREEN = 'h5p-drag-wide-screen';
  var DRAGGABLE_ELEMENT_WIDE_SCREEN = 'h5p-drag-draggable-wide-screen';

  /**
   * Initialize module.
   *
   * @class H5P.DragText
   * @extends H5P.Question
   * @param {Object} params Behavior settings
   * @param {Number} contentId Content identification
   * @param {Object} contentData Object containing task specific content data
   *
   * @returns {Object} DragText Drag Text instance
   */
  function DragText(params, contentId, contentData) {
    this.$ = $(this);
    this.contentId = contentId;
    Question.call(this, 'drag-text');

    // Set default behavior.
    this.params = $.extend({}, {
      taskDescription: "Set in adjectives in the following sentence",
      textField: "This is a *nice*, *flexible* content type, which allows you to highlight all the *wonderful* words in this *exciting* sentence.\n" +
        "This is another line of *fantastic* text.",
      checkAnswer: "Check",
      tryAgain: "Retry",
      behaviour: {
        enableRetry: true,
        enableSolutionsButton: true,
        instantFeedback: false
      },
      score: "You got @score of @total points",
      showSolution : "Show solution"
    }, params);

    this.contentData = contentData;
    if (this.contentData !== undefined && this.contentData.previousState !== undefined && this.contentData.previousState.length !== undefined) {
      this.previousState = this.contentData.previousState;
    }

    // Keeps track of if Question has been answered
    this.answered = false;

    // Convert line breaks to HTML
    this.textFieldHtml = this.params.textField.replace(/(\r\n|\n|\r)/gm, "<br/>");

    // Init keyboard navigation
    this.ariaDragControls = new Controls.AriaDrag();
    this.ariaDropControls = new Controls.AriaDrop();
    this.dragControls = new Controls([new Controls.UIKeyboard(), this.ariaDragControls]);
    this.dropControls = new Controls([new Controls.UIKeyboard(), this.ariaDropControls]);
    this.dragControls.on('select', this.dragableSelected, this);
    this.dropControls.on('select', this.droppableSelected, this);

    /**
     * @type {HTMLElement} selectedElement
     */
    this.selectedElement = undefined;

    // add text parser
    this.textParser = new TextParser();

    // Init drag text task
    this.initDragText();

    this.on('resize', this.resize, this);
  }

  DragText.prototype = Object.create(Question.prototype);
  DragText.prototype.constructor = DragText;

  /**
   * Handle selected dragable
   *
   * @param {ControlsEvent} event
   */
  DragText.prototype.dragableSelected = function (event) {
    this.selectedElement = event.element;
    this.ariaDropControls.setAllToMove();
  };

  /**
   * Handle selected droppable
   *
   * @param {ControlsEvent} event
   */
  DragText.prototype.droppableSelected = function (event) {
    // if something selected
    if(this.selectedElement){
      var draggable = this.getDraggableByElement(this.selectedElement);
      var droppable = this.getDroppableByElement(event.element);

      // initiate drop
      this.moveDraggableToDroppable(draggable, droppable);
      this.ariaDropControls.setAllToNone();
      this.ariaDragControls.setAllGrabbedToFalse();

      this.selectedElement = undefined;
    }
  };

  /**
   * Registers this question type's DOM elements before they are attached.
   * Called from H5P.Question.
   */
  DragText.prototype.registerDomElements = function () {
    // Register task introduction text
    this.setIntroduction('<p>' + this.params.taskDescription + '</p>');

    // Register task content area
    this.setContent(this.$inner);

    // Register buttons
    this.addButtons();
  };

  /**
   * Initialize drag text task
   */
  DragText.prototype.initDragText = function () {
    this.$inner = $('<div/>', {
      class: INNER_CONTAINER
    });

    // Create task
    this.addTaskTo(this.$inner);

    // Set stored user state
    this.setH5PUserState();

    return this.$inner;
  };

  /**
   * Changes layout responsively when resized.
   * @public
   */
  DragText.prototype.resize = function () {
    this.changeLayoutToFitWidth();
  };

  /**
  * Adds the draggables on the right side of the screen if widescreen is detected.
  * @public
  */
  DragText.prototype.changeLayoutToFitWidth = function () {
    var self = this;
    self.addDropzoneWidth();

    //Find ratio of width to em, and make sure it is less than the predefined ratio, make sure widest draggable is less than a third of parent width.
    if ((self.$inner.width() / parseFloat(self.$inner.css("font-size"), 10) > 43) && (self.widestDraggable <= (self.$inner.width() / 3))) {
      // Adds a class that floats the draggables to the right.
      self.$draggables.addClass(DRAGGABLES_WIDE_SCREEN);
      // Detach and reappend the wordContainer so it will fill up the remaining space left by draggables.
      self.$wordContainer.detach().prependTo(self.$taskContainer);
      // Set margin so the wordContainer does not expand when there are no more draggables left.
      self.$wordContainer.css({'margin-right': self.widestDraggable});
      // Set all draggables to be blocks
      self.draggables.forEach(function (draggable) {
        draggable.getDraggableElement().addClass(DRAGGABLE_ELEMENT_WIDE_SCREEN);
      });
    } else {
      // Remove the specific wide screen settings.
      self.$wordContainer.css({'margin-right': 0});
      self.$draggables.removeClass(DRAGGABLES_WIDE_SCREEN);
      self.$draggables.detach().appendTo(self.$taskContainer);
      self.draggables.forEach(function (draggable) {
        draggable.getDraggableElement().removeClass(DRAGGABLE_ELEMENT_WIDE_SCREEN);
      });
    }
  };

  /**
   * Add check solution, show solution and retry buttons, and their functionality.
   * @public
   */
  DragText.prototype.addButtons = function () {
    var self = this;

    // Checking answer button
    self.addButton('check-answer', self.params.checkAnswer, function () {
      self.answered = true;
      if (!self.showEvaluation()) {
        if (self.params.behaviour.enableRetry) {
          self.showButton('try-again');
        }
        if (self.params.behaviour.enableSolutionsButton) {
          self.showButton('show-solution');
        }
        self.hideButton('check-answer');
        self.disableDraggables();
      } else {
        self.hideButton('show-solution');
        self.hideButton('try-again');
        self.hideButton('check-answer');
      }
    }, !self.params.behaviour.instantFeedback);

    //Retry button
    self.addButton('try-again', self.params.tryAgain, function () {
      // Reset and shuffle draggables if Question is answered
      if (self.answered) {
        self.resetDraggables();
        self.addDraggablesRandomly(self.$draggables);
      }
      self.answered = false;

      self.hideEvaluation();

      self.hideButton('try-again');
      self.hideButton('show-solution');

      if (self.params.behaviour.instantFeedback) {
        self.enableAllDropzonesAndDraggables();
      } else {
        self.showButton('check-answer');
        self.enableDraggables();
      }
      self.hideAllSolutions();
    }, self.initShowTryAgainButton || false);

    //Show Solution button
    self.addButton('show-solution', self.params.showSolution, function () {
      self.droppables.forEach(function (droppable) {
        droppable.showSolution();
      });
      self.disableDraggables();
      self.hideButton('show-solution');
    }, self.initShowShowSolutionButton || false);
  };

  /**
   * Shows feedback for dropzones.
   * @public
   */
  DragText.prototype.showDropzoneFeedback = function () {
    this.droppables.forEach(function (droppable) {
      droppable.addFeedback();
    });
  };

  /**
   * Evaluate task and display score text for word markings.
   *
   * @param {boolean} [skipXapi] Skip sending xAPI event answered
   * @return {Boolean} Returns true if maxScore was achieved.
   */
  DragText.prototype.showEvaluation = function (skipXapi) {
    this.hideEvaluation();
    this.calculateScore();
    this.showDropzoneFeedback();

    var score = this.correctAnswers;
    var maxScore = this.droppables.length;

    if (!skipXapi) {
      var xAPIEvent = this.createXAPIEventTemplate('answered');
      this.addQuestionToXAPI(xAPIEvent);
      this.addResponseToXAPI(xAPIEvent);
      this.trigger(xAPIEvent);
    }

    var scoreText = this.params.score.replace(/@score/g, score.toString())
      .replace(/@total/g, maxScore.toString());

    if (score === maxScore) {
      //Hide buttons and disable task
      this.hideButton('check-answer');
      this.hideButton('show-solution');
      this.hideButton('try-again');
      this.disableDraggables();
    }
    this.trigger('resize');

    // Set feedback score
    this.setFeedback(scoreText, score, maxScore);

    return score === maxScore;
  };

  /**
   * Calculate score and store them in class variables.
   * @public
   */
  DragText.prototype.calculateScore = function () {
    var self = this;
    self.correctAnswers = 0;
    self.droppables.forEach(function (entry) {
      if (entry.isCorrect()) {
        self.correctAnswers += 1;
      }
    });
  };

  /**
   * Clear the evaluation text.
   */
  DragText.prototype.hideEvaluation = function () {
    this.setFeedback();
    this.trigger('resize');
  };

  /**
   * Hides solution text for all dropzones.
   */
  DragText.prototype.hideAllSolutions = function () {
    this.droppables.forEach(function (droppable) {
      droppable.hideSolution();
    });
    this.trigger('resize');
  };

  /**
   * Handle task and add it to container.
   * @public
   * @param {jQuery} $container The object which our task will attach to.
   */
  DragText.prototype.addTaskTo = function ($container) {
    var self = this;
    self.widest = 0;
    self.widestDraggable = 0;
    self.droppables = [];
    self.draggables = [];

    self.$taskContainer = $('<div/>', {
      'class': TASK_CONTAINER
    });

    self.$draggables = $('<div/>', {
      'class': DRAGGABLES_CONTAINER
    });

    self.$wordContainer = $('<div/>', {'class': WORDS_CONTAINER});

    self.textParser.parse(self.textFieldHtml)
      .forEach(function(part) {
        if(self.startsWith('*', part) && self.endsWith('*', part)) {
          var tip;
          var answer = self.cleanAsterisk(part);
          var answersAndTip = answer.split(':');

          if (answersAndTip.length > 0) {
            answer = answersAndTip[0];
            tip = answersAndTip[1];
          }

          var draggable = self.createDraggable(answer);
          var droppable = self.createDroppable(answer, tip);

          // trigger instant feedback
          if (self.params.behaviour.instantFeedback) {
            draggable.getDraggableElement().on('dragstop', function() {
              if (droppable !== null) {
                droppable.addFeedback();
              }

              self.instantFeedbackEvaluation();
            });
          }
        }
        else {
          var el = self.createElementWithTextPart(part);
          self.$wordContainer.append(el);
          self.dropControls.addElement(el);
        }
      });

    self.addDraggablesRandomly(self.$draggables);
    self.$wordContainer.prependTo(self.$taskContainer);
    self.$draggables.appendTo(self.$taskContainer);
    self.$taskContainer.appendTo($container);
    self.addDropzoneWidth();
  };

  /**
   * Creates a span HTMLElement containing a text part
   *
   * @param {string} part
   * @private
   * @return {HTMLElement}
   */
  DragText.prototype.createElementWithTextPart = function(part) {
    var el = document.createElement('span');
    el.innerHTML = part;
    return  el;
  };

  /**
   * Checks if a string starts with a symbol
   *
   * @param {string} symbol
   * @param {string} str
   * @private
   * @return {boolean}
   */
  DragText.prototype.startsWith = function(symbol, str) {
    return str.substr(0,1) === symbol;
  };

  /**
   * Checks if a ends with a symbol
   *
   * @param {string} symbol
   * @param {string} str
   * @private
   * @return {boolean}
   */
  DragText.prototype.endsWith = function(symbol, str) {
    return str.substr(-1) === symbol;
  };

  /**
   * Removes asterisk in the beginning and end of a string
   *
   * @param {string} str
   * @private
   * @return {string}
   */
  DragText.prototype.cleanAsterisk = function(str) {
    if(this.startsWith('*', str)) {
      str = str.slice(1);
    }

    if(this.endsWith('*', str)) {
      str = str.slice(0, -1);
    }

    return str;
  };

  /**
   * Matches the width of all dropzones to the widest draggable, and sets widest class variable.
   * @public
   */
  DragText.prototype.addDropzoneWidth = function () {
    var self = this;
    var widest = 0;
    var widestDragagble = 0;
    var fontSize = parseInt(this.$inner.css('font-size'), 10);
    var staticMinimumWidth = 3 * fontSize;
    var staticPadding = fontSize; // Needed to make room for feedback icons

    //Find widest draggable
    this.draggables.forEach(function (draggable) {
      var $draggableElement = draggable.getDraggableElement();

      //Find the initial natural width of the draggable.
      var $tmp = $draggableElement.clone().css({
        'position': 'absolute',
        'white-space': 'nowrap',
        'width': 'auto',
        'padding': 0,
        'margin': 0
      }).html(draggable.getAnswerText())
        .appendTo($draggableElement.parent());
      var width = $tmp.width();

      widestDragagble = width > widestDragagble ? width : widestDragagble;

      // Measure how big truncated draggable should be
      if ($tmp.text().length >= 20) {
        $tmp.html(draggable.getShortFormat());
        width = $tmp.width();
      }

      if (width + staticPadding > widest) {
        widest = width + staticPadding;
      }
      $tmp.remove();
    });
    // Set min size
    if (widest < staticMinimumWidth) {
      widest = staticMinimumWidth;
    }
    this.widestDraggable = widestDragagble;
    this.widest = widest;

    //Adjust all droppable to widest size.
    this.droppables.forEach(function (droppable) {
      droppable.getDropzone().width(self.widest);
    });
  };

  /**
   * Makes a drag n drop from the specified text.
   * @public
   * @param {String} answer Text for the drag n drop.
   *
   * @return {H5P.TextDraggable}
   */
  DragText.prototype.createDraggable = function(answer){
    var self = this;

    //Make the draggable
    var $draggable = $('<div/>', {
      html: answer,
      'aria-grabbed': 'false'
    }).draggable({
      revert: function (isValidDrop) {
        // If not valid drop
        if (!isValidDrop) {
          if (!self.$draggables.children().length) {
            // Show draggables container
            self.$draggables.removeClass('hide');
          }

          self.moveDraggableToDroppable(draggable, null);
        }

        return false;
      },
      containment: self.$taskContainer
    });

    // add keyboard navigation to draggable
    var draggableEl = $draggable.get(0);
    self.dragControls.addElement(draggableEl);

    var draggable = new Draggable(answer, $draggable);
    draggable.on('addedToZone', function (event) {
      self.triggerXAPI('interacted');
    });

    self.draggables.push(draggable);

    return draggable;
  };

  /**
   *
   * @param {string} answer
   * @param {string} [tip]
   *
   * @return {H5P.TextDroppable}
   */
  DragText.prototype.createDroppable = function(answer, tip){
    var self = this;

    //Make the dropzone
    var $dropzoneContainer = $('<div/>', {
      'class': DROPZONE_CONTAINER
    });
    var $dropzone = $('<div/>', {
      'aria-dropeffect': "none",
      'aria-label': 'blank' // TODO another aria word?
    }).appendTo($dropzoneContainer)
      .droppable({
        tolerance: 'pointer',
        drop: function (event, ui) {
          self.draggables.forEach(function (draggable) {
            if (draggable.getDraggableElement().is(ui.draggable)) {
              self.moveDraggableToDroppable(draggable, droppable);
            }
          });

          if (self.params.behaviour.instantFeedback) {
            droppable.addFeedback();
            if (!self.params.behaviour.enableRetry) {
              droppable.disableDropzoneAndContainedDraggable();
            }
            if (droppable.isCorrect()) {
              droppable.disableDropzoneAndContainedDraggable();
            }
          }

          // Hide draggables container if it is empty
          self.$draggables.toggleClass('hide', !self.$draggables.children().length);
        }
      });

    var droppableEl = $dropzone.get(0);
    self.dropControls.addElement(droppableEl);

    var droppable = new Droppable(answer, tip, $dropzone, $dropzoneContainer);
    droppable.appendDroppableTo(self.$wordContainer);

    self.droppables.push(droppable);

    return droppable;
  };

  /**
   * Moves a draggable onto a droppable, and updates all parameters in the objects.
   * @public
   * @param {H5P.TextDraggable} draggable Draggable instance.
   * @param {H5P.TextDroppable} droppable The droppable instance the draggable is put on.
   */
  DragText.prototype.moveDraggableToDroppable = function (draggable, droppable) {
    draggable.removeFromZone();
    if (droppable !== null) {
      this.answered = true;
      droppable.appendInsideDroppableTo(this.$draggables);
      droppable.setDraggable(draggable);
      draggable.appendDraggableTo(droppable.getDropzone());
    } else {
      draggable.revertDraggableTo(this.$draggables);
    }
    this.trigger('resize');
  };

  /**
   * Adds the draggable words to the provided container in random order.
   * @public
   * @param {jQuery} $container Container the draggables will be added to.
   */
  DragText.prototype.addDraggablesRandomly = function ($container) {
    var tempArray = this.draggables.slice();
    var randIndex = 0;
    while (tempArray.length >= 1) {
      randIndex = parseInt(Math.random() * tempArray.length, 10);
      tempArray[randIndex].appendDraggableTo($container);
      tempArray.splice(randIndex, 1);
    }
  };

  /**
   * Feedback function for checking if all fields are filled, and show evaluation if that is the case.
   */
  DragText.prototype.instantFeedbackEvaluation = function () {
    var self = this;
    var allFilled = self.isAllAnswersFilled();

    if (allFilled) {
      //Shows "retry" and "show solution" buttons.
      if (self.params.behaviour.enableSolutionsButton) {
        self.showButton('show-solution');
      }
      if (self.params.behaviour.enableRetry) {
        self.showButton('try-again');
      }

      // Shows evaluation text
      self.showEvaluation();
    } else {
      //Hides "retry" and "show solution" buttons.
      self.hideButton('try-again');
      self.hideButton('show-solution');

      //Hides evaluation text.
      self.hideEvaluation();
    }
  };

  /**
   * Check if all answers are filled
   * @returns {boolean} allFilled Returns true if all answers are answered
   */
  DragText.prototype.isAllAnswersFilled = function () {
    var self = this;
    var allFilled = true;
    self.draggables.forEach(function (entry) {
      if (entry.insideDropzone === null) {
        allFilled = false;
      }
    });

    return allFilled;
  };

  /**
   * Enables all dropzones and all draggables.
   */
  DragText.prototype.enableAllDropzonesAndDraggables = function () {
    this.enableDraggables();
    this.droppables.forEach(function (droppable) {
      droppable.enableDropzone();
    });
  };

  /**
   * Disables all draggables, user will not be able to interact with them any more.
   * @public
   */
  DragText.prototype.disableDraggables = function () {
    this.draggables.forEach(function (entry) {
      entry.disableDraggable();
    });
  };

  /**
   * Enables all draggables, user will be able to interact with them again.
   * @public
   */
  DragText.prototype.enableDraggables = function () {
    this.draggables.forEach(function (entry) {
      entry.enableDraggable();
    });
  };

  /**
   * Used for contracts.
   * Checks if the parent program can proceed. Always true.
   * @public
   * @returns {Boolean} true
   */
  DragText.prototype.getAnswerGiven = function () {
    return this.answered;
  };

  /**
   * Used for contracts.
   * Checks the current score for this task.
   * @public
   * @returns {Number} The current score.
   */
  DragText.prototype.getScore = function () {
    this.calculateScore();
    return this.correctAnswers;
  };

  /**
   * Used for contracts.
   * Checks the maximum score for this task.
   * @public
   * @returns {Number} The maximum score.
   */
  DragText.prototype.getMaxScore = function () {
    return this.droppables.length;
  };

  /**
   * Get title of task
   * @return {string} title
   */
  DragText.prototype.getTitle = function () {
    return H5P.createTitle(this.params.taskDescription);
  };

  /**
   * Returns the Draggable by element
   *
   * @param {HTMLElement} el
   *
   * @return {H5P.TextDraggable}
   */
  DragText.prototype.getDraggableByElement = function (el) {
    return this.draggables.filter(function(draggable){
      return draggable.$draggable.get(0) === el;
    }, this)[0];
  };

  /**
   * Returns the Droppable by element
   *
   * @param {HTMLElement} el
   *
   * @return {H5P.TextDraggable}
   */
  DragText.prototype.getDroppableByElement = function (el) {
    return this.droppables.filter(function(droppable){
      return droppable.$dropzone.get(0) === el;
    }, this)[0];
  };

  /**
   * Used for contracts.
   * Sets feedback on the dropzones.
   * @public
   */
  DragText.prototype.showSolutions = function () {
    this.showEvaluation(true);
    this.droppables.forEach(function (droppable) {
      droppable.addFeedback();
      droppable.showSolution();
    });
    this.disableDraggables();
    //Remove all buttons in "show solution" mode.
    this.hideButton('try-again');
    this.hideButton('show-solution');
    this.hideButton('check-answer');
    this.trigger('resize');
  };

  /**
   * Used for contracts.
   * Resets the complete task back to its' initial state.
   * @public
   */
  DragText.prototype.resetTask = function () {
    var self = this;
    // Reset task answer
    self.answered = false;
    //Reset draggables parameters and position
    self.resetDraggables();
    //Hides solution text and re-enable draggables
    self.hideEvaluation();
    self.enableAllDropzonesAndDraggables();
    //Show and hide buttons
    self.hideButton('try-again');
    self.hideButton('show-solution');

    if (!self.params.behaviour.instantFeedback) {
      self.showButton('check-answer');
    }
    self.hideAllSolutions();
    this.trigger('resize');
  };

  /**
   * Resets the position of all draggables.
   */
  DragText.prototype.resetDraggables = function () {
    var self = this;
    // Show draggables container
    self.$draggables.removeClass('hide');
    self.draggables.forEach(function (entry) {
      self.moveDraggableToDroppable(entry, null);
    });
    this.trigger('resize');
  };

  /**
   * Returns an object containing the dropped words
   * @returns {object} containing indexes of dropped words
   */
  DragText.prototype.getCurrentState = function () {
    var self = this;
    var draggedDraggablesIndexes = [];

    // Return undefined if task is not initialized
    if (this.draggables === undefined) {
      return undefined;
    }

    // Find draggables that has been dropped
    this.draggables.forEach(function (draggable, draggableIndex) {
      if (draggable.getInsideDropzone() !== null) {
        draggedDraggablesIndexes.push({draggable: draggableIndex, droppable: self.droppables.indexOf(draggable.getInsideDropzone())});
      }
    });
    return draggedDraggablesIndexes;
  };

  /**
   * Sets answers to current user state
   */
  DragText.prototype.setH5PUserState = function () {
    var self = this;

    // Do nothing if user state is undefined
    if (this.previousState === undefined) {
      return;
    }

    // Select words from user state
    this.previousState.forEach(function (draggedDraggableIndexes) {
      var draggableIndexIsInvalid = isNaN(draggedDraggableIndexes.draggable) ||
        draggedDraggableIndexes.draggable >= self.draggables.length ||
        draggedDraggableIndexes.draggable < 0;

      var droppableIndexIsInvalid = isNaN(draggedDraggableIndexes.droppable) ||
        draggedDraggableIndexes.droppable >= self.droppables.length ||
        draggedDraggableIndexes.droppable < 0;

      if (draggableIndexIsInvalid || droppableIndexIsInvalid) {
        throw new Error('Stored user state is invalid');
      }

      var moveDraggable = self.draggables[draggedDraggableIndexes.draggable];
      var moveToDroppable = self.droppables[draggedDraggableIndexes.droppable];
      self.moveDraggableToDroppable(moveDraggable, moveToDroppable);

      if (self.params.behaviour.instantFeedback) {
        // Add feedback to dropzone
        if (moveToDroppable !== null) {
          moveToDroppable.addFeedback();
        }

        // Add feedback to draggable
        if (moveToDroppable.isCorrect()) {
          moveToDroppable.disableDropzoneAndContainedDraggable();
        }
      }
    });

    // Show evaluation if task is finished
    if (self.params.behaviour.instantFeedback) {

      // Show buttons if not max score and all answers filled
      if (self.isAllAnswersFilled() && !self.showEvaluation()) {

        //Shows "retry" and "show solution" buttons.
        if (self.params.behaviour.enableSolutionsButton) {
          self.initShowShowSolutionButton = true;
        }
        if (self.params.behaviour.enableRetry) {
          self.initShowTryAgainButton = true;
        }
      }
    }
  };

  /**
   * getXAPIData
   * Contract used by report rendering engine.
   *
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-6}
	 *
   * @returns {Object} xAPI data
   */
  DragText.prototype.getXAPIData = function () {
    var xAPIEvent = this.createXAPIEventTemplate('answered');
    this.addQuestionToXAPI(xAPIEvent);
    this.addResponseToXAPI(xAPIEvent);
    return {
      statement: xAPIEvent.data.statement
    };
  };

  /**
   * addQuestionToXAPI
   * Add the question itself to the definition part of an xAPIEvent
   *
   * @param xAPIEvent
   */
  DragText.prototype.addQuestionToXAPI = function (xAPIEvent) {
    var definition = xAPIEvent.getVerifiedStatementValue(['object','definition']);
    $.extend(definition, this.getxAPIDefinition());
  };

  /**
   * Generate xAPI object definition used in xAPI statements.
   * @return {Object}
   */
  DragText.prototype.getxAPIDefinition = function () {
    var definition = {};
    definition.interactionType = 'fill-in';
    definition.type = 'http://adlnet.gov/expapi/activities/cmi.interaction';

    var question = this.textFieldHtml;
    var taskDescription = this.params.taskDescription + '<br/>';

    // Create the description
    definition.description = {
      'en-US': taskDescription + this.replaceSolutionsWithBlanks(question)
    };

    //Create the correct responses pattern
    definition.correctResponsesPattern = [this.getSolutionsFromQuestion(question)];

    return definition;
  };

  /**
   * Add the response part to an xAPI event
   *
   * @param {H5P.XAPIEvent} xAPIEvent
   *  The xAPI event we will add a response to
   */
  DragText.prototype.addResponseToXAPI = function (xAPIEvent) {
    var self = this;
    var currentScore = self.getScore();
    var maxScore = self.droppables.length;

    xAPIEvent.setScoredResult(currentScore, maxScore, self);

    var score = {
      min: 0,
      raw: currentScore,
      max: maxScore,
      scaled: Math.round(currentScore / maxScore * 10000) / 10000
    };

    xAPIEvent.data.statement.result = {
      response: self.getXAPIResponse(),
      score: score
    };
  };

  /**
   * Generate xAPI user response, used in xAPI statements.
   * @return {string} User answers separated by the "[,]" pattern
   */
  DragText.prototype.getXAPIResponse = function () {
    var self = this;

    // Create an array to hold the answers
    var answers = Array(self.droppables.length).fill("");

    // Add answers to the answer array
    var droppable;
    var draggable;
    self.getCurrentState().forEach(function (stateObject) {
        draggable = self.draggables[stateObject.draggable].text;
        answers[stateObject.droppable] = draggable;
    });

    return answers.join('[,]');
  };

	/**
	 * replaceSolutionsWithBlanks
	 *
	 * @param question
	 * @returns {string}
	 */
  DragText.prototype.replaceSolutionsWithBlanks = function (question) {
    return this.handleBlanks(question, function() {
      return '__________';
    });
  };

	/**
	 * getSolutionsFromQuestion
	 *
	 * @param question
	 * @returns {array} Array with a string containing solutions of a question
	 */
  DragText.prototype.getSolutionsFromQuestion = function (question) {
    var solutions = [];
    this.handleBlanks(question, function(solution) {
      solutions.push(solution.solutions[0]);
      return '__________';
    });
    return solutions.join('[,]');
  };

  /**
   * Find blanks in a string and run a handler on those blanks
   *
   * @param {string} question
   *   Question text containing blanks enclosed in asterisks.
   * @param {function} handler
   *   Replaces the blanks text with an input field.
   * @returns {string}
   *   The question with blanks replaced by the given handler.
   */
   DragText.prototype.handleBlanks = function (question, handler) {
    // Go through the text and run handler on all asterisk
    var clozeEnd, clozeStart = question.indexOf('*');
    var self = this;
    while (clozeStart !== -1 && clozeEnd !== -1) {
      clozeStart++;
      clozeEnd = question.indexOf('*', clozeStart);
      if (clozeEnd === -1) {
        continue; // No end
      }
      var clozeContent = question.substring(clozeStart, clozeEnd);
      var replacer = '';
      if (clozeContent.length) {
        replacer = handler(self.parseSolution(clozeContent));
        clozeEnd++;
      }
      else {
        clozeStart += 1;
      }
      question = question.slice(0, clozeStart - 1) + replacer + question.slice(clozeEnd);
      clozeEnd -= clozeEnd - clozeStart - replacer.length;

      // Find the next cloze
      clozeStart = question.indexOf('*', clozeEnd);
    }
    return question;
  };


  /**
   * Parse the solution text (text between the asterisks)
   *
   * @param {string} solutionText
   * @returns {object} with the following properties
   *  - tip: the tip text for this solution, undefined if no tip
   *  - solutions: array of solution words
   */
  DragText.prototype.parseSolution = function (solutionText) {
    var tip, solution;

    var tipStart = solutionText.indexOf(':');
    if (tipStart !== -1) {
      // Found tip, now extract
      tip = solutionText.slice(tipStart + 1);
      solution = solutionText.slice(0, tipStart);
    }
    else {
      solution = solutionText;
    }

    // Split up alternatives
    var solutions = solution.split('/');

    // Trim solutions
    for (var i = 0; i < solutions.length; i++) {
      solutions[i] = H5P.trim(solutions[i]);

      //decodes html entities
      var elem = document.createElement('textarea');
      elem.innerHTML = solutions[i];
      solutions[i] = elem.value;
    }

    return {
      tip: tip,
      solutions: solutions
    };
  };

  return DragText;

}(H5P.jQuery, H5P.Question, H5P.TextDraggable, H5P.TextDroppable, H5P.DragTextTextParser, H5P.Controls));
