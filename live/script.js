(function () {
  'use strict';

  function each(selector, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), fn);
  }

  /* Tabs ---------------------------------------------------------- */
  each('.wb-tabs', function (root) {
    var buttons = root.querySelectorAll('.wb-tabs__tab');
    var panels = root.querySelectorAll('.wb-tabs__panel');
    Array.prototype.forEach.call(buttons, function (btn, index) {
      btn.addEventListener('click', function () {
        Array.prototype.forEach.call(buttons, function (b) { b.classList.remove('is-active'); });
        Array.prototype.forEach.call(panels, function (p) { p.classList.remove('is-active'); });
        btn.classList.add('is-active');
        if (panels[index]) panels[index].classList.add('is-active');
      });
    });
  });

  /* Accordion ----------------------------------------------------- */
  each('.wb-accordion', function (root) {
    Array.prototype.forEach.call(root.querySelectorAll('.wb-accordion__header'), function (header) {
      header.addEventListener('click', function () {
        header.parentElement.classList.toggle('is-open');
      });
    });
  });

  /* Carousel ------------------------------------------------------ */
  each('.wb-carousel__track', function (track) {
    var prev = track.parentElement.querySelector('.wb-carousel__btn--prev');
    var next = track.parentElement.querySelector('.wb-carousel__btn--next');
    function step(dir) {
      var slide = track.firstElementChild;
      var width = slide ? slide.getBoundingClientRect().width + 16 : track.clientWidth;
      track.scrollBy({ left: dir * width, behavior: 'smooth' });
    }
    if (prev) prev.addEventListener('click', function () { step(-1); });
    if (next) next.addEventListener('click', function () { step(1); });
  });

  /* Countdown ----------------------------------------------------- */
  each('.wb-countdown[data-due-date]', function (root) {
    var due = new Date(root.getAttribute('data-due-date')).getTime();
    if (isNaN(due)) return;
    var fields = {
      days: root.querySelector('[data-unit="days"]'),
      hours: root.querySelector('[data-unit="hours"]'),
      minutes: root.querySelector('[data-unit="minutes"]'),
      seconds: root.querySelector('[data-unit="seconds"]')
    };
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function tick() {
      var diff = Math.max(0, due - Date.now());
      var total = Math.floor(diff / 1000);
      var days = Math.floor(total / 86400);
      var hours = Math.floor((total % 86400) / 3600);
      var minutes = Math.floor((total % 3600) / 60);
      var seconds = total % 60;
      if (fields.days) fields.days.textContent = pad(days);
      if (fields.hours) fields.hours.textContent = pad(hours);
      if (fields.minutes) fields.minutes.textContent = pad(minutes);
      if (fields.seconds) fields.seconds.textContent = pad(seconds);
      if (diff > 0) setTimeout(tick, 1000);
    }
    tick();
  });

  /* Counter ------------------------------------------------------- */
  each('.wb-counter', function (root) {
    var target = parseFloat(String(root.textContent).replace(/[^0-9.-]/g, ''));
    if (!isFinite(target) || target === 0) return;
    var raw = String(root.textContent);
    var suffix = raw.replace(/[0-9.,\s]/g, '');
    var started = false;
    function run() {
      if (started) return;
      started = true;
      var start = performance.now();
      var duration = 1600;
      function frame(now) {
        var t = Math.min(1, (now - start) / duration);
        var eased = 1 - Math.pow(1 - t, 3);
        var value = target * eased;
        var decimals = (raw.split('.')[1] || '').length;
        root.textContent = (decimals ? value.toFixed(decimals) : Math.round(value).toLocaleString()) + suffix;
        if (t < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { if (entry.isIntersecting) { run(); observer.disconnect(); } });
      }, { threshold: 0.4 });
      observer.observe(root);
    } else {
      run();
    }
  });

  /* Animated headline --------------------------------------------- */
  each('.wb-animated-headline[data-animation="typing"] .wb-animated-headline__static', function (root) {
    var text = root.textContent;
    var i = 0;
    var deleting = false;
    function tick() {
      root.textContent = text.slice(0, i);
      if (!deleting && i < text.length) { i++; setTimeout(tick, 90); }
      else if (!deleting) { deleting = true; setTimeout(tick, 1400); }
      else if (i > 0) { i--; setTimeout(tick, 45); }
      else { deleting = false; setTimeout(tick, 500); }
    }
    tick();
  });

  each('.wb-animated-headline__rotating[data-words]', function (root) {
    var words = root.getAttribute('data-words').split('|').map(function (w) { return w.trim(); }).filter(Boolean);
    if (!words.length) return;
    var index = 0;
    root.textContent = words[0];
    setInterval(function () {
      index = (index + 1) % words.length;
      root.textContent = words[index];
    }, 2200);
  });

  /* Authentication widget ---------------------------------------- */
  function readCookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : '';
  }

  function showNotice(container, text, kind) {
    if (!container) return false;
    container.textContent = text;
    container.className = 'wb-login__notice' + (kind ? ' ' + kind : '');
    return true;
  }

  /* A page without an auth widget still needs to confirm a contact form. */
  function globalToast(text, kind) {
    var toast = document.createElement('div');
    toast.className = 'wb-login__notice ' + kind;
    toast.setAttribute('role', 'status');
    toast.textContent = text;
    toast.style.cssText =
      'position:fixed;left:50%;top:20px;transform:translateX(-50%);z-index:9999;' +
      'padding:10px 18px;font-size:14px;box-shadow:0 10px 30px rgba(0,0,0,.25)';
    document.body.appendChild(toast);
    window.setTimeout(function () { toast.remove(); }, 6000);
  }

  var params = new URLSearchParams(window.location.search);
  if (params.has('sent')) {
    if (!showNotice(document.querySelector('[data-auth-notice]'), 'Thanks! Your message has been sent.', 'is-success')) {
      globalToast('Thanks! Your message has been sent.', 'is-success');
    }
  }

  /* Prefill the search box from ?s= (or ?q=) so a results page still shows
     what was searched for, exactly like WordPress. */
  each('.wb-search__input', function (input) {
    var name = input.getAttribute('name') || 's';
    var value = params.get(name) || params.get('s') || params.get('q') || '';
    if (value && !input.value) input.value = value;
  });

  /* Clicking a result should not leave the visitor stranded: if the target
     element is not on this page, go back to the top instead of doing nothing. */
  each('.wb-search__results a[href^="#"]', function (link) {
    link.addEventListener('click', function () {
      var target = document.getElementById(decodeURIComponent(link.getAttribute('href').slice(1)));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  each('.wb-login-form', function (form) {
    var modeInput = form.querySelector('[data-auth-mode-value]');
    var csrfInput = form.querySelector('[data-webcraft-csrf]');
    var notice = form.querySelector('[data-auth-notice]');
    var panels = form.querySelectorAll('[data-auth-panel]');

    // Double-submit CSRF: mirror the cookie the server set. Servers that render
    // the page (PHP/WordPress/Node) inline the token instead — keep it if set.
    if (csrfInput && !csrfInput.value) {
      csrfInput.value = readCookie('wb_csrf');
    }

    function setMode(mode) {
      if (modeInput) modeInput.value = mode;
      Array.prototype.forEach.call(panels, function (panel) {
        panel.hidden = panel.getAttribute('data-auth-panel') !== mode;
      });
      if (notice) { notice.textContent = ''; notice.className = 'wb-login__notice'; }
    }

    Array.prototype.forEach.call(form.querySelectorAll('[data-auth-switch]'), function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        setMode(button.getAttribute('data-auth-switch'));
      });
    });

    // Client-side checks for the register panel (the server re-validates all).
    form.addEventListener('submit', function (event) {
      var mode = modeInput ? modeInput.value : 'login';
      var email = form.querySelector('[data-auth-panel="register"] [name="_wc_email"]');
      if (mode === 'register') {
        var pass = form.querySelector('[name="_wc_pass"]');
        var pass2 = form.querySelector('[name="_wc_pass2"]');
        if (pass && pass2 && pass.value !== pass2.value) {
          event.preventDefault();
          if (notice) {
            notice.textContent = 'The two passwords do not match.';
            notice.className = 'wb-login__notice is-error';
          }
          return;
        }
        if (pass && pass.value.length < 8) {
          event.preventDefault();
          if (notice) {
            notice.textContent = 'Password must be at least 8 characters.';
            notice.className = 'wb-login__notice is-error';
          }
          return;
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.value)) {
          event.preventDefault();
          if (notice) {
            notice.textContent = 'Enter a valid email address.';
            notice.className = 'wb-login__notice is-error';
          }
          return;
        }
      }
      if (mode === 'forgot' && email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.value)) {
        event.preventDefault();
        if (notice) {
          notice.textContent = 'Enter a valid email address.';
          notice.className = 'wb-login__notice is-error';
        }
        return;
      }
      // Contact forms can post without JavaScript; auth needs the CSRF token.
      if (csrfInput && !csrfInput.value) {
        event.preventDefault();
        if (notice) {
          notice.textContent = 'Your session expired — reload the page and try again.';
          notice.className = 'wb-login__notice is-error';
        }
      }
    });

    if (params.has('auth')) {
      var state = params.get('auth');
      var messages = {
        loggedin: ['You are signed in.', 'is-success'],
        loggedout: ['You have been signed out.', 'is-success'],
        registered: ['Your account is ready — you are signed in.', 'is-success'],
        forgot: [params.get('msg') || 'If that address has an account, a reset link is on its way.', 'is-success'],
        error: [params.get('msg') || 'Something went wrong. Please try again.', 'is-error']
      };
      var message = messages[state];
      if (message && showNotice(notice, message[0], message[1])) {
        if (state === 'register' || state === 'login' || state === 'forgot') setMode(state);
      }
    }
  });

  if (params.has('sent') || params.has('auth') || params.has('msg') || params.has('error')) {
    ['sent', 'auth', 'msg', 'error'].forEach(function (key) { params.delete(key); });
    if (window.history && window.history.replaceState) {
      var query = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);
    }
  }
})();


