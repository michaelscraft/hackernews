/*eslint-disable*/
$(async function() {
  // cache some selectors we'll be using quite a bit
  const $allStoriesList = $("#all-articles-list");
  const $submitForm = $("#submit-form");
  const $filteredArticles = $("#filtered-articles");
  const $loginForm = $("#login-form");
  const $createAccountForm = $("#create-account-form");
  const $ownStories = $("#my-articles");
  const $navLogin = $("#nav-login");
  const $navLogOut = $("#nav-logout");
  const $navFavorites = $("#nav-favorites");
  const $loggedInNav = $(".nav-logged-in");
  const $navSubmit = $("#nav-submit");
  const $navOwnStories = $("#nav-my-stories");
  const $navUserProfile = $("#nav-user-profile");
  const $createStoryForm = $("#createStoryForm");
  const $favoritedArticles = $("#favorited-articles");
  const $articleContainer  = $(".articles-container");
  const $notification = $('#notification');
  const $userProfile = $("#user-profile");


  // global storyList variable
  let storyList = null;

  // global currentUser variable
  let currentUser = null;

  await checkIfLoggedIn();

  /**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */

  $loginForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page-refresh on submit

    // grab the username and password
    const username = $("#login-username").val();
    const password = $("#login-password").val();

    // call the login static method to build a user instance
    const userInstance = await User.login(username, password)
      .then((userInstanceRes) => {
         // set the global user to the user instance
        currentUser = userInstanceRes;
        syncCurrentUserToLocalStorage();
        loginAndSubmitForm()
        printMessage(`Welcome back ${currentUser.username}`,'success');

      }).catch((e) => {
        const { data } = e.response;
        const { message } = data.error;
        printMessage(`${message}`,'warning')
      });

    return userInstance
  });

  /**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */

  $createAccountForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page refresh

    // grab the required fields
    let name = $("#create-account-name").val();
    let username = $("#create-account-username").val();
    let password = $("#create-account-password").val();

    // call the create method, which calls the API and then builds a new user instance
    const newUser = await User.create(username, password, name)
    .then((newUserRes) => {
      currentUser = newUserRes;
      syncCurrentUserToLocalStorage();
      loginAndSubmitForm();
      printMessage(`Welcome to Hack or Snooze ${currentUser.username}`,'success');
    }).catch((e) => {
      const { data } = e.response;
      const { message } = data.error;
      printMessage(`${message}`,'warning');
    });

    return newUser
  });

  /**
   * Event listener for creating New Story.
   *  If successfully we will add new story to the list
   */
  $createStoryForm.on("submit", async (e) => {
    e.preventDefault();
     // getting required fields
    const author = $("#author").val();
    const title = $("#title").val();
    const url = $("#url").val();
    const payload = {author, title, url};

    // call the addStory method, which calls the API and adds new story to the list

    await StoryList.addStory(currentUser,payload)
    printMessage(`${currentUser.name}, your story \"${title}\" has been added`, 'success')
    $createStoryForm.slideUp().trigger("reset");
    generateStories()
  })
  
  /**
   * Log Out Functionality
   */

  $navLogOut.on("click", function() {
    $loggedInNav.hide();
    $navUserProfile.text();
    // empty out local storage
    localStorage.clear();
    // refresh the page, clearing memory
    location.reload();
  });

  /**
   * Event Handler for Clicking Login
   */

  $navLogin.on("click", function() {
    // Show the Login and Create Account Forms
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();
    $allStoriesList.toggle();
  });

  /**
   * Event Handler for Clicking "submit" link
   */
  $navSubmit.on("click", () =>{
    hideElements($createStoryForm);
    $createStoryForm.slideToggle();
    $allStoriesList.show();
  })

  $navFavorites.on("click", () => {
    hideElements();
    generateFavoriteStories();
    $favoritedArticles.show();
  })
  
  $navOwnStories.on("click", () => {
    hideElements();
    generateOwnStories();
    $ownStories.show();
  })
  
  $navUserProfile.on("click", async () => {
    hideElements();
    await checkIfLoggedIn();
    $userProfile.html(generateUserProfile());
    $userProfile.show();
  })

  /**
   * Event handler for Navigation to Homepage
   */

  $("body").on("click", "#nav-all", async function() {
    hideElements();
    await generateStories();
    $allStoriesList.show();
  });

  /**
   * Show notification 
   * @param {string} message notification message
   * @param {string} type success, warning
   */
  const printMessage = (message, type) => {
    $notification.text('');
    $notification.removeClass();

    if (type === "success") $notification.addClass('success');
    if (type === "warning") $notification.addClass('warning');

    $notification.stop().slideDown(() => {
      $notification.text(message).delay(1500).slideUp();
    });
  }
  
  /**
   * Adding/removing favorites event handler
   *
   */
  $articleContainer.on("click", ".star", async function (e) {
    const $this = $(this);
    const icon = $this.children('i');
    const username = currentUser.username || null;
    const token = currentUser.loginToken || null;
    const storyId = $(e.target).closest('li').attr("id");
    const payload = {username, storyId, token};

    // toggle "fas" "far" classes and adding removing favorite call
    if(icon.hasClass('far')){
      await User.addFavorite(payload).then(({ data })=>{
        icon.toggleClass('far fas');
        printMessage(data.message, 'success')
      }).catch((e) => {
        printMessage(e, 'error')
      });

    }else {
      await User.removeFavorite(payload).then(({ data })=>{
        icon.toggleClass('far fas');
        printMessage(data.message, 'success')
      }).catch((e) => {
        printMessage(e, 'error')
      });
    }
  })

  /**
   *  Delete own story event handler
   *
   */
  $articleContainer.on("click", ".trash-can", async function (e) {
    const $currLi = $(e.target).closest('li')
    const token = currentUser.loginToken || null;
    const storyId = $currLi.attr("id");
    const payload = {storyId, token};

    await StoryList.deleteStory(payload).then(({ data }) => {
      $currLi.remove();
      printMessage("Story deleted", 'success')
    }).catch((e) => {
      printMessage(e, 'error')
    });
  })

 /**
   *  Edit user's name event handler
   *
   */
  $userProfile.on("click", ".fa-pencil-alt", function (e) {
    const $this = $(this);
    const $parentSpan = $this.parent();
    const $editable = $parentSpan.siblings(".editable")
    const token = currentUser.loginToken || null;
    const payload = { token };
    const formHtml = $(`
      <form class="edit">
        <span>
          <input type="text" required>
          <a href="#"><i class="fas fa-check"></i></a>
          <a href="#"><i class="fas fa-times"></i></a>
        <span>
      </form>
    `)
    $parentSpan.remove();
    $editable.html(formHtml)
  })

  /*
  *  Handle click on name change cancel
  */
  $userProfile.on("click", ".fa-times", function (e) {
    const $this = $(this);
    const $parentDiv = $this.closest('div');
    const htmlMarkup = $(`
        <span>Name: </span>
        <span class="editable"><b>${currentUser.name}</b></span> 
        <span><i class="fas fa-pencil-alt"></i></span>
      `)

    $parentDiv.html(htmlMarkup)
  })
  /*
  *  Handle click on name change
  */
  $userProfile.on("click", ".fa-check", function (e) {
    const $this = $(this);
    const $parent = $this.parent();
    const $parentDiv = $this.closest('div');
    const newValue = $parent.siblings("input").val();
    const username = currentUser.username; 
    const token = currentUser.loginToken || null;
    const payload = { 
      token, 
      user: { 
        name: newValue
      } 
    };

    User.update(payload, username).then(({ data }) => {
      const { name } = data.user;
      currentUser.name = name;

      const htmlMarkup = $(`
        <span>Name: </span>
        <span class="editable"><b>${name}</b></span> 
        <span><i class="fas fa-pencil-alt"></i></span>
      `)
      printMessage(`Your name is updated to "${name}"`,'success')
      $parentDiv.html(htmlMarkup)
      $navUserProfile.text(`${name}`)
    }).catch((e) => {
      const { data } = e.response;
      const { message } = data.error;
      printMessage(`${message}`,'warning')
    })
  })

  /**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */

  async function checkIfLoggedIn() {
    // let's see if we're logged in
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    currentUser = await User.getLoggedInUser(token, username);
    await generateStories();

    if (currentUser) {
      showNavForLoggedInUser();
    }
  }

  /**
   * A rendering function to run to reset the forms and hide the login info
   */

  function loginAndSubmitForm() {
    // hide the forms for logging in and signing up
    $loginForm.hide();
    $createAccountForm.hide();

    // reset those forms
    $loginForm.trigger("reset");
    $createAccountForm.trigger("reset");

    // show the stories
    $allStoriesList.show();

    // update the navigation bar
    showNavForLoggedInUser();

    // generateStoriesWithStars
    generateStories();
  };

  /**
   * generateUserProfile,
   * 
   */
  function generateUserProfile() {
    if(!currentUser) printMessage('Something went wrong', 'warning');

    const { name, username, createdAt, favorites, ownStories } = currentUser;
    const accCreatedDate = new Date(createdAt).toLocaleDateString();

    const htmlMarkup = $(`

    <h4>User Profile Info</h4>
      <section>
        <div id="profile-name">
          <span>Name: </span>
          <span class="editable"><b>${name}</b></span> 
          <span><i class="fas fa-pencil-alt"></i></span>
        </div>
        <div id="profile-username">Username: <b>${username}</b></div>
        <div>Favorite articles: <b>${favorites.length}</b></div>
        <div>Articles posted: <b>${ownStories.length}</b></div>
        <div id="profile-account-date">Account Created: <b>${accCreatedDate}</b></div>
      </section>
    `)
    return htmlMarkup;
  }

 
  /**
   * generateOwnStories,
   * 
   */
  async function generateOwnStories() {
    $ownStories.empty();
    // update currentUser
    await checkIfLoggedIn()
    if(!currentUser) printMessage("Something went wrong", 'warning'); 
    if(currentUser.ownStories.length === 0){
      const defaultMsg = generateDefaultHTML('stories');
      return $ownStories.append(defaultMsg);
    } 
    // empty out that part of the page

    // loop through all of our fav stories and generate HTML for them
    for (let story of currentUser.ownStories) {
      const result = generateStoryHTML(story);
      $ownStories.append(result);
    }
  }

  /**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */

  async function generateStories() {
    // get an instance of StoryList
    const storyListInstance = await StoryList.getStories();
    // update our global variable
    storyList = storyListInstance;
    // empty out that part of the page
    $allStoriesList.empty();

    // loop through all of our stories and generate HTML for them
    for (let story of storyList.stories) {
      const result = generateStoryHTML(story);
      $allStoriesList.append(result);
    }
  }

   /**
   * generateFavoriteStories,
   * 
   */
  async function generateFavoriteStories() {
    $favoritedArticles.empty();
    // update currentUser
    await checkIfLoggedIn()
    if(!currentUser) printMessage("Something went wrong", 'warning'); 
    if(currentUser.favorites.length === 0){
      const defaultMsg = generateDefaultHTML('favorites');
      return $favoritedArticles.append(defaultMsg);
    } 
    // empty out that part of the page

    // loop through all of our fav stories and generate HTML for them
    for (let fav of currentUser.favorites) {
      const result = generateStoryHTML(fav);
      $favoritedArticles.append(result);
    }
  }
  /**
   * A function to render HTML if there are no stories;
   * @param {string} str message "No ${str} yet!"
   */
  function generateDefaultHTML(str) {
    const { name } = currentUser;
    const defaultMarkup = $(`
      <li>Sorry, ${name}. No ${str} yet...</li>
    `);

    return defaultMarkup;
  }
  /**
   * A function to render HTML for an individual Story instance
   */
  function generateStoryHTML(story) {
    const { url, storyId, title, author, username } = story;
    const { favorites, ownStories } = currentUser || [];
    const hostName = getHostName(url);
    let favStatus = false;
    let ownStatus = false;

    if (favorites)favStatus = favorites.some((fav)=> fav.storyId === storyId);
    if (ownStories)ownStatus = ownStories.some((story)=> story.storyId === storyId);
    
    // stars/trash-can
    // render story markup
    const storyMarkup = $(`
      <li id="${storyId}">
        <span class="${ownStatus ? "trash-can" : "star" } ${currentUser ? 'show' : 'hidden'}">
          <i class="${ownStatus || favStatus ? 'fas' : 'far' } ${ownStatus ?  "fa-trash-alt" : "fa-star" }"></i>
        </span>
        <a class="article-link" href="${url}" target="a_blank">
          <strong>${title}</strong>
        </a>
        <small class="article-author">by ${author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${username}</small>
      </li>
    `);
    return storyMarkup;
  }

  /* hide all elements in elementsArr */

  function hideElements(curr) {
    const elementsArr = [
      $submitForm,
      $allStoriesList,
      $filteredArticles,
      $ownStories,
      $loginForm,
      $createAccountForm,
      $allStoriesList,
      $createStoryForm,
      $favoritedArticles,
      $userProfile
    ];
    elementsArr.forEach($elem => {
      if($elem !== curr) $elem.hide()
    });
  }

  function showNavForLoggedInUser() {
    $navLogin.hide();
    $navLogOut.show();
    $loggedInNav.show();
    $navUserProfile.text(`${currentUser.name}`)
  }

  /* simple function to pull the hostname from a URL */

  function getHostName(url) {
    let hostName;

    if (url.indexOf("://") > -1) {
      hostName = url.split("/")[2];
    } else {
      hostName = url.split("/")[0];
    }
    if (hostName.slice(0, 4) === "www.") {
      hostName = hostName.slice(4);
    }
    return hostName;
  }

  /* sync current user information to localStorage */

  function syncCurrentUserToLocalStorage() {
    if (currentUser) {
      localStorage.setItem("token", currentUser.loginToken);
      localStorage.setItem("username", currentUser.username);
    }
  }
});