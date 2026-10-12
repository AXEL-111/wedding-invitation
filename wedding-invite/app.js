document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();

    // Default image paths for code-managed dress guide pictures.
    // Add files under assets/dress-code/ and update these paths when publishing.
    const DRESS_GUIDE_IMAGES = {
        bridesmaids: 'assets/dress-code/Bridesmaid.jpg',
        groomsmen: 'assets/dress-code/groomsmen.jpg',
        'secondary-sponsors-women': 'assets/dress-code/secondary-sponsors-women.jpg',
        'secondary-sponsors-men': 'assets/dress-code/secondary-sponsors-men.jpg',
        guests: 'assets/dress-code/guest.jpg',
        'parents-of-bride': 'assets/dress-code/motherfather.jpg',
        'parents-of-groom': 'assets/dress-code/motherfather.jpg',
        'ninong-and-ninang': 'assets/dress-code/nong.jpg'
    };

    function initializeDressGuideGallery() {
        let browserImages = {};
        try {
            browserImages = JSON.parse(localStorage.getItem('wedding_dress_guide_images') || '{}');
        } catch (error) {
            console.warn('Could not load dress guide images saved in this browser.', error);
        }

        const roleSelect = document.getElementById('dress-guide-role');
        const image = document.getElementById('dress-guide-image');
        const title = document.getElementById('dress-guide-title');
        const placeholder = document.getElementById('dress-guide-placeholder');
        if (!roleSelect || !image || !title || !placeholder) return;

        const roleNames = Object.fromEntries(Array.from(roleSelect.options, option => [option.value, option.textContent]));
        const showRole = key => {
            title.textContent = roleNames[key] || 'Attire Guide';
            placeholder.textContent = `Add ${roleNames[key] || 'role'} image`;
            image.alt = `${roleNames[key] || 'Selected role'} attire example`;
            image.classList.remove('is-loaded');
            placeholder.hidden = false;
            image.removeAttribute('src');

            const source = browserImages[key] || DRESS_GUIDE_IMAGES[key];
            image.onload = () => {
                image.classList.add('is-loaded');
                placeholder.hidden = true;
            };
            image.onerror = () => {
                image.removeAttribute('src');
                image.classList.remove('is-loaded');
                placeholder.hidden = false;
            };
            image.src = source;
        };

        roleSelect.addEventListener('change', () => showRole(roleSelect.value));
        showRole(roleSelect.value);
    }

    initializeDressGuideGallery();

    function initializeCoupleGallery() {
        const viewport = document.getElementById('gallery-viewport');
        const leavesContainer = document.getElementById('book-leaves-container');
        const pageDotsContainer = document.getElementById('book-page-dots');
        const restartBtn = document.getElementById('book-restart-btn');

        if (!viewport || !leavesContainer) return;

        const leaves = Array.from(leavesContainer.querySelectorAll('.book-leaf'));
        const totalLeaves = leaves.length;
        let currentLeaf = 0;
        let isAnimating = false;

        // Pointer drag & swipe tracking
        let isPointerDown = false;
        let pointerStartX = 0;
        let pointerStartY = 0;
        let pointerStartTime = 0;
        let activeDragLeaf = null;
        let dragDirection = null; // 'forward' | 'backward'
        let dragProgress = 0;
        let isSwiping = false;

        function setLeafOverlay(leaf, shadeOpacity, shineOpacity = 0) {
            if (!leaf) return;
            const shades = leaf.querySelectorAll('.page-shade-overlay');
            const shines = leaf.querySelectorAll('.page-shine-overlay');
            shades.forEach(el => {
                el.style.opacity = Math.max(0, Math.min(0.55, shadeOpacity));
            });
            shines.forEach(el => {
                el.style.opacity = Math.max(0, Math.min(0.45, shineOpacity));
            });
        }

        function updateBookState() {
            leaves.forEach((leaf, idx) => {
                leaf.classList.remove('is-turning');
                leaf.style.transition = '';

                if (idx < currentLeaf) {
                    // Turned to the left stack
                    leaf.style.transform = 'rotateY(-180deg)';
                    leaf.style.zIndex = idx + 1;
                    leaf.setAttribute('aria-hidden', idx === currentLeaf - 1 ? 'false' : 'true');
                    setLeafOverlay(leaf, 0);
                } else if (idx === currentLeaf) {
                    // Current active leaf facing viewer
                    leaf.style.transform = 'rotateY(0deg)';
                    leaf.style.zIndex = totalLeaves + 10;
                    leaf.setAttribute('aria-hidden', 'false');
                    setLeafOverlay(leaf, 0);
                } else {
                    // Unturned leaves stacked underneath on the right
                    leaf.style.transform = 'rotateY(0deg)';
                    leaf.style.zIndex = totalLeaves - idx;
                    leaf.setAttribute('aria-hidden', 'true');
                    setLeafOverlay(leaf, 0);
                }
            });

            // Update page dots
            if (pageDotsContainer) {
                const dots = pageDotsContainer.querySelectorAll('.page-dot');
                dots.forEach((dot, idx) => {
                    const isActive = idx === currentLeaf;
                    dot.classList.toggle('is-active', isActive);
                    dot.setAttribute('aria-selected', isActive ? 'true' : 'false');
                });
            }
        }

        // Build clean pagination dots
        if (pageDotsContainer) {
            pageDotsContainer.innerHTML = '';
            leaves.forEach((_, idx) => {
                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = `page-dot ${idx === 0 ? 'is-active' : ''}`;
                dot.setAttribute('role', 'tab');
                dot.setAttribute('aria-label', idx === 0 ? 'Cover' : idx === totalLeaves - 1 ? 'End' : `Photo ${idx}`);
                dot.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    goToPage(idx);
                });
                pageDotsContainer.appendChild(dot);
            });
        }

        // Failsafe transition completion helper
        function finishTransition(targetLeaf, onComplete) {
            let finished = false;
            const cleanup = () => {
                if (finished) return;
                finished = true;
                if (targetLeaf) {
                    targetLeaf.removeEventListener('transitionend', cleanup);
                }
                try {
                    if (onComplete) onComplete();
                } catch (err) {
                    console.error('Page turn transition error:', err);
                } finally {
                    isAnimating = false;
                }
            };

            if (targetLeaf) {
                targetLeaf.addEventListener('transitionend', cleanup, { once: true });
            }
            // Safety timeout ensuring isAnimating is NEVER stuck true!
            setTimeout(cleanup, 560);
        }

        // Silky smooth page turn transition
        function turnPage(direction) {
            if (isAnimating) return;

            if (direction > 0 && currentLeaf < totalLeaves - 1) {
                isAnimating = true;
                const leaf = leaves[currentLeaf];
                leaf.classList.add('is-turning');
                leaf.style.zIndex = 200;
                leaf.style.transition = 'transform 500ms cubic-bezier(0.25, 1, 0.35, 1)';

                requestAnimationFrame(() => {
                    leaf.style.transform = 'rotateY(-180deg)';
                    setLeafOverlay(leaf, 0.3);
                });

                finishTransition(leaf, () => {
                    currentLeaf++;
                    updateBookState();
                });

            } else if (direction < 0 && currentLeaf > 0) {
                isAnimating = true;
                const leaf = leaves[currentLeaf - 1];
                leaf.classList.add('is-turning');
                leaf.style.zIndex = 200;
                leaf.style.transition = 'transform 500ms cubic-bezier(0.25, 1, 0.35, 1)';

                requestAnimationFrame(() => {
                    leaf.style.transform = 'rotateY(0deg)';
                    setLeafOverlay(leaf, 0.3);
                });

                finishTransition(leaf, () => {
                    currentLeaf--;
                    updateBookState();
                });
            }
        }

        // Jump to target page
        function goToPage(target) {
            if (isAnimating || target === currentLeaf || target < 0 || target >= totalLeaves) return;

            if (Math.abs(target - currentLeaf) === 1) {
                turnPage(target - currentLeaf);
                return;
            }

            isAnimating = true;
            currentLeaf = target;
            updateBookState();
            isAnimating = false;
        }

        // Pointer event listeners for tactile drag & swipe
        function handlePointerDown(e) {
            if (isAnimating) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            if (e.target.closest('button')) return;

            isPointerDown = true;
            pointerStartX = e.clientX;
            pointerStartY = e.clientY;
            pointerStartTime = Date.now();
            activeDragLeaf = null;
            dragDirection = null;
            dragProgress = 0;
            isSwiping = false;

            // For mouse, prevent browser default text/image drag
            if (e.pointerType === 'mouse') {
                e.preventDefault();
            }

            try {
                viewport.setPointerCapture(e.pointerId);
            } catch (err) {}
        }

        function handlePointerMove(e) {
            if (!isPointerDown || isAnimating) return;

            const dx = e.clientX - pointerStartX;
            const dy = e.clientY - pointerStartY;

            if (!isSwiping) {
                if (e.pointerType === 'mouse') {
                    // On PC mouse: small horizontal movement initiates drag, do not abort on vertical drift
                    if (Math.abs(dx) > 6) {
                        isSwiping = true;
                        viewport.classList.add('is-dragging');
                    }
                } else {
                    // On touch: check horizontal intent vs page scroll
                    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
                        isSwiping = true;
                        viewport.classList.add('is-dragging');
                    } else if (Math.abs(dy) > 16 && Math.abs(dy) > Math.abs(dx)) {
                        isPointerDown = false;
                        return;
                    }
                }
            }

            if (!isSwiping) return;
            e.preventDefault();

            const viewportWidth = viewport.clientWidth || 380;

            if (dx < 0 && currentLeaf < totalLeaves - 1) {
                // Dragging forward (turning currentLeaf left)
                if (dragDirection !== 'forward') {
                    if (activeDragLeaf) {
                        activeDragLeaf.style.transition = '';
                        activeDragLeaf.style.transform = dragDirection === 'backward' ? 'rotateY(-180deg)' : 'rotateY(0deg)';
                    }
                    dragDirection = 'forward';
                    activeDragLeaf = leaves[currentLeaf];
                    activeDragLeaf.classList.add('is-turning');
                    activeDragLeaf.style.zIndex = 200;
                    activeDragLeaf.style.transition = 'none';
                }

                dragProgress = Math.min(1, Math.max(0, -dx / (viewportWidth * 0.75)));
                const angle = -dragProgress * 180;
                const curl = -Math.sin(dragProgress * Math.PI) * 4;
                activeDragLeaf.style.transform = `rotateY(${angle}deg) skewY(${curl}deg)`;
                setLeafOverlay(activeDragLeaf, Math.sin(dragProgress * Math.PI) * 0.4);

            } else if (dx > 0 && currentLeaf > 0) {
                // Dragging backward (pulling previous leaf back)
                if (dragDirection !== 'backward') {
                    if (activeDragLeaf) {
                        activeDragLeaf.style.transition = '';
                        activeDragLeaf.style.transform = dragDirection === 'forward' ? 'rotateY(0deg)' : 'rotateY(-180deg)';
                    }
                    dragDirection = 'backward';
                    activeDragLeaf = leaves[currentLeaf - 1];
                    activeDragLeaf.classList.add('is-turning');
                    activeDragLeaf.style.zIndex = 200;
                    activeDragLeaf.style.transition = 'none';
                }

                dragProgress = Math.min(1, Math.max(0, dx / (viewportWidth * 0.75)));
                const angle = -180 + (dragProgress * 180);
                const curl = Math.sin(dragProgress * Math.PI) * 4;
                activeDragLeaf.style.transform = `rotateY(${angle}deg) skewY(${curl}deg)`;
                setLeafOverlay(activeDragLeaf, Math.sin(dragProgress * Math.PI) * 0.4);
            }
        }

        function handlePointerUp(e) {
            if (!isPointerDown) return;
            isPointerDown = false;
            viewport.classList.remove('is-dragging');

            if (e && viewport.hasPointerCapture && viewport.hasPointerCapture(e.pointerId)) {
                try {
                    viewport.releasePointerCapture(e.pointerId);
                } catch (err) {}
            }

            const leafToAnimate = activeDragLeaf;
            const currentDir = dragDirection;
            const progress = dragProgress;
            activeDragLeaf = null;
            dragDirection = null;

            if (!isSwiping || !leafToAnimate) {
                // Tap detection: clicking cover turns forward, clicking right half turns forward, clicking left half turns backward
                const rect = viewport.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                if (currentLeaf === 0) {
                    turnPage(1);
                } else if (clickX > rect.width * 0.45 && currentLeaf < totalLeaves - 1) {
                    turnPage(1);
                } else if (clickX <= rect.width * 0.45 && currentLeaf > 0) {
                    turnPage(-1);
                }
                return;
            }

            isSwiping = false;
            const dx = e.clientX - pointerStartX;
            const dt = Math.max(1, Date.now() - pointerStartTime);
            const velocity = Math.abs(dx) / dt;

            const shouldComplete = progress > 0.16 || velocity > 0.22;
            isAnimating = true;

            leafToAnimate.style.transition = 'transform 480ms cubic-bezier(0.25, 1, 0.35, 1)';

            if (currentDir === 'forward') {
                if (shouldComplete) {
                    leafToAnimate.style.transform = 'rotateY(-180deg)';
                    setLeafOverlay(leafToAnimate, 0);
                    finishTransition(leafToAnimate, () => {
                        currentLeaf++;
                        updateBookState();
                    });
                } else {
                    leafToAnimate.style.transform = 'rotateY(0deg)';
                    setLeafOverlay(leafToAnimate, 0);
                    finishTransition(leafToAnimate, () => {
                        updateBookState();
                    });
                }
            } else if (currentDir === 'backward') {
                if (shouldComplete) {
                    leafToAnimate.style.transform = 'rotateY(0deg)';
                    setLeafOverlay(leafToAnimate, 0);
                    finishTransition(leafToAnimate, () => {
                        currentLeaf--;
                        updateBookState();
                    });
                } else {
                    leafToAnimate.style.transform = 'rotateY(-180deg)';
                    setLeafOverlay(leafToAnimate, 0);
                    finishTransition(leafToAnimate, () => {
                        updateBookState();
                    });
                }
            } else {
                isAnimating = false;
                updateBookState();
            }
        }

        viewport.addEventListener('pointerdown', handlePointerDown);
        viewport.addEventListener('pointermove', handlePointerMove);
        viewport.addEventListener('pointerup', handlePointerUp);
        viewport.addEventListener('pointercancel', handlePointerUp);

        // Cover "Swipe to Open" pill button
        const coverPill = viewport.querySelector('.cover-swipe-pill');
        if (coverPill) {
            coverPill.addEventListener('click', (e) => {
                e.stopPropagation();
                turnPage(1);
            });
        }

        // Keepsake Restart button
        if (restartBtn) {
            restartBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                goToPage(0);
            });
        }

        // Image load handlers
        leaves.forEach(leaf => {
            const img = leaf.querySelector('img');
            const placeholder = leaf.querySelector('.gallery-placeholder');
            if (img) {
                if (img.complete && img.naturalWidth > 0) {
                    img.classList.add('is-loaded');
                    if (placeholder) placeholder.hidden = true;
                } else {
                    img.addEventListener('load', () => {
                        img.classList.add('is-loaded');
                        if (placeholder) placeholder.hidden = true;
                    });
                    img.addEventListener('error', () => {
                        img.classList.remove('is-loaded');
                        if (placeholder) placeholder.hidden = false;
                    });
                }
            }
        });

        // Initialize Lucide icons if available
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }

        // Set initial state
        updateBookState();
    }

    initializeCoupleGallery();

    // Elements
    const preloader = document.getElementById('preloader');
    const envelopeContainer = document.getElementById('envelope-container');
    const waxSeal = document.getElementById('wax-seal');
    const bgMusic = document.getElementById('bg-music');
    const musicToggle = document.getElementById('music-toggle');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const navLinks = document.getElementById('nav-links');
    const navLinksArray = document.querySelectorAll('.nav-link');
    const navbar = document.querySelector('.navbar');

    // Calendar Elements
    const calendarDropdownBtn = document.getElementById('calendar-dropdown-btn');
    const calendarDropdown = document.getElementById('calendar-dropdown');
    const calGoogle = document.getElementById('cal-google');
    const calIcal = document.getElementById('cal-ical');
    const calOutlook = document.getElementById('cal-outlook');

    // RSVP Elements
    const rsvpForm = document.getElementById('rsvp-form');
    const rsvpSuccess = document.getElementById('rsvp-success');
    const rsvpEditBtn = document.getElementById('rsvp-edit-btn');
    const successTitle = document.getElementById('success-title');
    const successMessage = document.getElementById('success-message');
    const toast = document.getElementById('toast');
    const rsvpBtnAccept = document.getElementById('rsvp-btn-accept');
    const rsvpBtnDecline = document.getElementById('rsvp-btn-decline');
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwPIo6PqFNiWrSAVsCw9ln4xZZBOM_X9bzTxZhr0hN0csUViD5EzEwV2fqlQq6w4ZOH/exec";

    // Personalized Welcome & Guest parameters
    const rsvpNameInput = document.getElementById('rsvp-name');

    // Helper to merge GUEST_DATABASE with custom guests created in dashboard
    function getMergedGuestDatabase() {
        let customGuests = {};
        try {
            customGuests = JSON.parse(localStorage.getItem('wedding_custom_guests') || '{}');
        } catch (e) {
            console.error("Error reading custom guests from localStorage", e);
        }
        return typeof GUEST_DATABASE !== 'undefined' ? { ...GUEST_DATABASE, ...customGuests } : customGuests;
    }

    // Check URL parameters for Guest ID (e.g. ?g=jane-doe)
    const urlParams = new URLSearchParams(window.location.search);
    const guestId = urlParams.get('g') || urlParams.get('guest');
    const inviteName = urlParams.get('name');
    let currentGuest = null;

    const guestDb = getMergedGuestDatabase();
    if (guestId && guestDb[guestId]) {
        currentGuest = guestDb[guestId];
    } else if (guestId && inviteName) {
        // Dashboard-created guests are browser-local, so carry their display
        // name in the invitation URL for personalization on other devices.
        currentGuest = { name: inviteName, group: 'Guests' };
    }

    const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);

    if (currentGuest) {
        // Personalize envelope cover address label
        const envelopeAddress = document.getElementById('envelope-address');
        if (envelopeAddress) {
            envelopeAddress.innerText = currentGuest.name;
        }

        // Personalize envelope greeting card
        const letterSalutation = document.getElementById('letter-salutation');
        if (letterSalutation) {
            letterSalutation.innerText = `Dear ${currentGuest.name},`;
        }

        // Pre-fill RSVP Name input
        if (rsvpNameInput) {
            rsvpNameInput.value = currentGuest.name;
        }

        // Hide name input field group since we recognize the guest
        const rsvpNameGroup = document.getElementById('rsvp-name-group');
        if (rsvpNameGroup) {
            rsvpNameGroup.style.display = 'none';
        }

        // Personalize RSVP greeting text
        const rsvpGreeting = document.getElementById('rsvp-greeting');
        if (rsvpGreeting) {
            rsvpGreeting.innerHTML = `Dear <strong>${escapeHtml(currentGuest.name)}</strong>,<br>We have reserved a seat especially for you.<br>Kindly confirm your attendance and join us as we begin our happily ever after.<br><span class="rsvp-guest-only-note">With love and appreciation, we kindly ask that invitations be limited to the named guest only.</span>`;
        }
    } else {
        // Generic guest (unrecognized URL link)
        const rsvpGreeting = document.getElementById('rsvp-greeting');
        if (rsvpGreeting) {
            rsvpGreeting.innerHTML = `Please enter your name and confirm your attendance as we begin our happily ever after.<br>We have reserved a seat especially for you.<br><span class="rsvp-guest-only-note">With love and appreciation, we kindly ask that invitations be limited to the named guest only.</span>`;
        }

        // Disable action buttons until they type their name
        const rsvpBtnActions = document.querySelectorAll('.rsvp-btn-action');
        rsvpBtnActions.forEach(btn => btn.disabled = true);

        if (rsvpNameInput) {
            rsvpNameInput.addEventListener('input', () => {
                const nameTyped = rsvpNameInput.value.trim();
                rsvpBtnActions.forEach(btn => btn.disabled = (nameTyped === ""));
            });
        }
    }

    // ==========================================
    // 1. Preloader / Envelope Opening & Music
    // ==========================================
    // Lock scrolling on page load
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';

    if (waxSeal && envelopeContainer) {
        waxSeal.addEventListener('click', (e) => {
            e.stopPropagation();

            // Add 'open' class: opens the top flap and slides the card up
            envelopeContainer.classList.add('open');

            // Show music toggle and attempt playing audio
            musicToggle.classList.remove('hidden');
            bgMusic.play().then(() => {
                musicToggle.classList.add('playing');
            }).catch(err => {
                console.log("Autoplay blocked by browser. Audio will play on first manual toggle click.", err);
            });

            // After flap and card animation, zoom-in card to fill viewport
            setTimeout(() => {
                envelopeContainer.classList.add('expand');

                // Once expansion transitions, fade out the preloader
                setTimeout(() => {
                    preloader.classList.add('fade-out');

                    // Restore page scrolling
                    document.body.style.overflow = '';
                    document.body.style.height = '';

                    // Trigger scroll reveals
                    document.querySelectorAll('.scroll-reveal').forEach(el => revealObserver.observe(el));
                }, 1000);
            }, 1200);
        });
    }

    // Music Control
    musicToggle.addEventListener('click', () => {
        if (bgMusic.paused) {
            bgMusic.play();
            musicToggle.classList.add('playing');
            showToast("Music Playing");
        } else {
            bgMusic.pause();
            musicToggle.classList.remove('playing');
            showToast("Music Paused");
        }
    });

    // ==========================================
    // 2. Countdown Timer (Target: December 9, 2026 3:00 PM)
    // ==========================================
    const weddingDate = new Date('December 09, 2026 15:00:00').getTime();

    function updateCountdown() {
        const now = new Date().getTime();
        const difference = weddingDate - now;

        if (difference < 0) {
            document.getElementById('days').innerText = "00";
            document.getElementById('hours').innerText = "00";
            document.getElementById('minutes').innerText = "00";
            document.getElementById('seconds').innerText = "00";
            return;
        }

        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        document.getElementById('days').innerText = days < 10 ? '0' + days : days;
        document.getElementById('hours').innerText = hours < 10 ? '0' + hours : hours;
        document.getElementById('minutes').innerText = minutes < 10 ? '0' + minutes : minutes;
        document.getElementById('seconds').innerText = seconds < 10 ? '0' + seconds : seconds;
    }

    setInterval(updateCountdown, 1000);
    updateCountdown();

    // ==========================================
    // 3. Navigation & Scroll Effects
    // ==========================================
    window.addEventListener('scroll', () => {
        // Sticky Header transition
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // Active navigation link styling
        let currentSection = "";
        const sections = document.querySelectorAll('section');

        sections.forEach(section => {
            const sectionTop = section.offsetTop - 120;
            if (window.scrollY >= sectionTop) {
                currentSection = section.getAttribute('id');
            }
        });

        navLinksArray.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSection}`) {
                link.classList.add('active');
            }
        });
    });

    // Mobile menu toggle
    mobileMenuBtn.addEventListener('click', () => {
        navLinks.classList.toggle('open');
        const icon = mobileMenuBtn.querySelector('i');
        if (navLinks.classList.contains('open')) {
            icon.setAttribute('data-lucide', 'x');
        } else {
            icon.setAttribute('data-lucide', 'menu');
        }
        lucide.createIcons();
    });

    // Close mobile menu on click
    navLinksArray.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('open');
            const icon = mobileMenuBtn.querySelector('i');
            icon.setAttribute('data-lucide', 'menu');
            lucide.createIcons();
        });
    });

    // ==========================================
    // 4. Scroll Reveal Intersection Observer
    // ==========================================
    const revealOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, revealOptions);

    // ==========================================
    // 5. Add to Calendar Dropdown
    // ==========================================
    if (calendarDropdownBtn) {
        calendarDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            calendarDropdown.classList.toggle('show');
        });
    }

    // Close calendar dropdown when clicking outside
    document.addEventListener('click', () => {
        if (calendarDropdown) {
            calendarDropdown.classList.remove('show');
        }
    });

    // Calendar Link Actions
    const eventDetails = {
        title: "Christian & Lovely's Wedding",
        desc: "Join Christian and Lovely on Wednesday, December 9, 2026, at 3:00 PM. The reception follows at Fernwood Gardens Tagaytay.",
        loc: "Our Lady of Lourdes Parish Tagaytay, Nasugbu Highway, Silang Junction North, Brgy. Silang Crossing West, Tagaytay City; reception at Fernwood Gardens Tagaytay, Neogan, Tagaytay City",
        start: "20261209T150000",
        end: "20261209T220000"
    };

    if (calGoogle) {
        calGoogle.addEventListener('click', (e) => {
            e.preventDefault();
            const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventDetails.title)}&dates=${eventDetails.start}Z/${eventDetails.end}Z&details=${encodeURIComponent(eventDetails.desc)}&location=${encodeURIComponent(eventDetails.loc)}`;
            window.open(googleUrl, '_blank');
        });
    }

    function triggerICSFile() {
        const icsContent =
            `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Wedding Invitation//EN
BEGIN:VEVENT
UID:${Date.now()}@weddinginvite.com
DTSTART:${eventDetails.start}
DTEND:${eventDetails.end}
SUMMARY:${eventDetails.title}
DESCRIPTION:${eventDetails.desc}
LOCATION:${eventDetails.loc}
SEQUENCE:0
STATUS:CONFIRMED
TRANSP:OPAQUE
END:VEVENT
END:VCALENDAR`;

        const blob = new Blob([icsContent.trim()], { type: 'text/calendar;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'lovely-christian-wedding.ics');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    if (calIcal) {
        calIcal.addEventListener('click', (e) => {
            e.preventDefault();
            triggerICSFile();
        });
    }

    if (calOutlook) {
        calOutlook.addEventListener('click', (e) => {
            e.preventDefault();
            triggerICSFile();
        });
    }

    // ==========================================
    // 6. RSVP Form Handler (One-Click Confirmation Buttons)
    // ==========================================
    // Check if THIS specific guest has already responded on this browser
    const currentSlug = guestId || (currentGuest ? currentGuest.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-') : null);
    const allRsvps = JSON.parse(localStorage.getItem('wedding_rsvps') || '{}');
    const savedRSVP = currentSlug ? allRsvps[currentSlug] : null;

    function showSavedRSVP(response) {
        if (!response || !successTitle || !successMessage || !rsvpForm || !rsvpSuccess) return;
        if (rsvpNameInput && response.name) rsvpNameInput.value = response.name;

        if (response.attendance === 'accepts') {
            successTitle.innerText = "Joyfully Accepted!";
            successMessage.innerHTML = `Dear <strong>${response.name}</strong>, we are so excited to celebrate with you! See you at Our Lady of Lourdes Parish & Fernwood Gardens Tagaytay!`;
        } else {
            successTitle.innerText = "We'll Miss You!";
            successMessage.innerHTML = `Dear <strong>${response.name}</strong>, thank you for letting us know. We are sad that you won't be able to make it, but we appreciate your warm wishes!`;
        }
        rsvpForm.classList.add('hidden');
        rsvpSuccess.classList.remove('hidden');
    }

    if (savedRSVP) {
        try {
            showSavedRSVP(savedRSVP);
        } catch (err) {
            console.error("Error loading saved RSVP", err);
        }
    }

    // Read the latest answer from the shared sheet so this guest sees the same
    // RSVP on every device. Local storage remains a fast cache/fallback.
    if (currentGuest && currentSlug && GOOGLE_SCRIPT_URL) {
        const lookup = new URLSearchParams({
            action: 'lookup',
            guestId: currentSlug,
            name: currentGuest.name
        });
        fetch(`${GOOGLE_SCRIPT_URL}?${lookup.toString()}&_=${Date.now()}`, { cache: 'no-store' })
            .then(response => response.json())
            .then(result => {
                const all = JSON.parse(localStorage.getItem('wedding_rsvps') || '{}');
                if (result && result.found && result.rsvp) {
                    all[currentSlug] = result.rsvp;
                    localStorage.setItem('wedding_rsvps', JSON.stringify(all));
                    showSavedRSVP(result.rsvp);
                } else if (result && result.found === false) {
                    delete all[currentSlug];
                    localStorage.setItem('wedding_rsvps', JSON.stringify(all));
                    if (rsvpSuccess) rsvpSuccess.classList.add('hidden');
                    if (rsvpForm) rsvpForm.classList.remove('hidden');
                    if (rsvpBtnAccept) rsvpBtnAccept.disabled = false;
                    if (rsvpBtnDecline) rsvpBtnDecline.disabled = false;
                }
            })
            .catch(error => console.warn('Could not check the shared RSVP yet; using this device’s saved response.', error));
    }

    function submitRSVP(attendanceValue) {
        const guestName = rsvpNameInput.value.trim();
        if (!guestName) {
            showToast("Please enter your name first.");
            return;
        }

        const clickedBtn = attendanceValue === 'accepts' ? rsvpBtnAccept : rsvpBtnDecline;

        // Show loader inside the clicked button
        const btnText = clickedBtn.querySelector('span');

        // Create loader element
        const loader = document.createElement('div');
        loader.className = 'loader';

        btnText.style.display = 'none';
        clickedBtn.appendChild(loader);

        // Disable buttons
        rsvpBtnAccept.disabled = true;
        rsvpBtnDecline.disabled = true;

        const responseData = {
            name: guestName,
            guestId: currentSlug || guestName.toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/^-+|-+$/g, ''),
            attendance: attendanceValue,
            date: new Date().toISOString()
        };

        const handleSuccess = () => {
            // 1. Save response in local user browser
            localStorage.setItem('wedding_rsvp', JSON.stringify(responseData));

            // 2. Save response in shared localStorage database (for Admin Dashboard check)
            const slug = guestId || responseData.name.toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/^-+|-+$/g, '');

            let allRsvps = JSON.parse(localStorage.getItem('wedding_rsvps') || '{}');
            allRsvps[slug] = {
                name: responseData.name,
                attendance: responseData.attendance,
                date: responseData.date
            };
            localStorage.setItem('wedding_rsvps', JSON.stringify(allRsvps));

            // Customize Success Screen message
            if (responseData.attendance === 'accepts') {
                successTitle.innerText = "Joyfully Accepted!";
                successMessage.innerHTML = `Dear <strong>${responseData.name}</strong>, we are so excited to celebrate with you! See you at Our Lady of Lourdes Parish & Fernwood Gardens Tagaytay!`;
            } else {
                successTitle.innerText = "We'll Miss You!";
                successMessage.innerHTML = `Dear <strong>${responseData.name}</strong>, thank you for letting us know. We are sad that you won't be able to make it, but we appreciate your warm wishes!`;
            }

            // Transition from form to success panel
            rsvpForm.classList.add('hidden');
            rsvpSuccess.classList.remove('hidden');

            // Reset button states
            loader.remove();
            btnText.style.display = '';

            // Enable buttons but reset disabled state based on current guest
            if (currentGuest) {
                rsvpBtnAccept.disabled = false;
                rsvpBtnDecline.disabled = false;
            } else {
                rsvpBtnAccept.disabled = (rsvpNameInput.value.trim() === "");
                rsvpBtnDecline.disabled = (rsvpNameInput.value.trim() === "");
            }

            showToast("Response submitted successfully!");
        };

        if (GOOGLE_SCRIPT_URL) {
            fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(responseData)
            })
                .then(() => {
                    handleSuccess();
                })
                .catch(err => {
                    console.error("Error submitting RSVP to Google Sheets", err);
                    handleSuccess(); // Fallback so user doesn't get blocked
                });
        } else {
            // Simulate networking delay
            setTimeout(() => {
                handleSuccess();
            }, 1000);
        }
    }

    if (rsvpBtnAccept) {
        rsvpBtnAccept.addEventListener('click', () => submitRSVP('accepts'));
    }
    if (rsvpBtnDecline) {
        rsvpBtnDecline.addEventListener('click', () => submitRSVP('declines'));
    }

    // Edit RSVP Response
    rsvpEditBtn.addEventListener('click', () => {
        rsvpSuccess.classList.add('hidden');
        rsvpForm.classList.remove('hidden');
    });

    // ==========================================
    // Helper Toast Notification
    // ==========================================
    let toastTimeout;
    function showToast(message) {
        toast.innerText = message;
        toast.classList.remove('hidden');

        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }

    // ==========================================
    // 7. Ambient Stardust & Sparkle Particle System
    // ==========================================
    function initAmbientCanvas() {
        const canvas = document.getElementById('ambient-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        window.addEventListener('resize', () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        });

        const particles = [];
        const PARTICLE_COUNT = 60;
        const colors = [
            { r: 255, g: 243, b: 209 }, // warm gold
            { r: 242, g: 212, b: 142 }, // champagne gold
            { r: 197, g: 160, b: 89 },  // classic gold
            { r: 144, g: 202, b: 249 }  // sapphire starlight
        ];

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: Math.random() * 1.8 + 0.6,
                color: colors[Math.floor(Math.random() * colors.length)],
                vx: (Math.random() - 0.5) * 0.25,
                vy: -(Math.random() * 0.35 + 0.15),
                alpha: Math.random() * 0.7 + 0.2,
                targetAlpha: Math.random() * 0.7 + 0.2,
                pulseSpeed: Math.random() * 0.02 + 0.008,
                sparkle: Math.random() > 0.82
            });
        }

        let isVisible = true;
        document.addEventListener('visibilitychange', () => {
            isVisible = !document.hidden;
        });

        function render() {
            if (!isVisible) {
                requestAnimationFrame(render);
                return;
            }

            ctx.clearRect(0, 0, width, height);

            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];

                p.alpha += (p.targetAlpha - p.alpha) * p.pulseSpeed;
                if (Math.abs(p.targetAlpha - p.alpha) < 0.05) {
                    p.targetAlpha = Math.random() * 0.7 + 0.2;
                }

                p.x += p.vx;
                p.y += p.vy;

                if (p.y < -10) {
                    p.y = height + 10;
                    p.x = Math.random() * width;
                }
                if (p.x < -10) p.x = width + 10;
                if (p.x > width + 10) p.x = -10;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.alpha})`;
                ctx.fill();

                if (p.sparkle) {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.radius * 3.5, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.alpha * 0.18})`;
                    ctx.fill();
                }
            }

            requestAnimationFrame(render);
        }

        requestAnimationFrame(render);
    }

    initAmbientCanvas();
});
