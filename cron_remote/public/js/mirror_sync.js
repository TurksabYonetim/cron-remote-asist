// =====================================================
// 🪞 MIRROR SYNC - Ayna gibi senkronizasyon
// Admin ne yaparsa kullanıcı tarafında da aynısı olsun
// =====================================================

console.log("🪞 Mirror Sync Initialized");

// Remote event'lerden gelen click'leri ignore etmek için flag
let isProcessingRemoteClick = false;

// MY_TAB_ID'yi remote_connection.js'den al (const yerine function kullan)
function getTabId() {
    if (typeof window.CRON_REMOTE_TAB_ID !== 'undefined') {
        return window.CRON_REMOTE_TAB_ID;
    }
    // Eğer henüz tanımlı değilse, oluştur
    window.CRON_REMOTE_TAB_ID = Math.random().toString(36).substring(7);
    return window.CRON_REMOTE_TAB_ID;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

// Event gönder
function sendMirrorEvent(eventType, payload) {
    const tabId = getTabId();
    console.log("🪞 Sending event:", eventType, "tab_id:", tabId, "payload:", payload);
    
    frappe.call({
        method: "cron_remote.api.relay_interaction_event",
        args: {
            event_type: eventType,
            payload: payload,
            tab_id: tabId
        },
        type: "POST",
        silent: true,
        callback: function(r) {
            console.log("🪞 Event sent successfully:", eventType);
        },
        error: function(e) { 
            console.warn("🪞 Mirror sync error:", e); 
        }
    });
}

// Element path'i oluştur (selector için)
function getElementPath(element) {
    if (!element || !element.tagName) return null;
    
    const path = [];
    let current = element;
    
    while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();
        
        if (current.id) {
            selector += `#${current.id}`;
            path.unshift(selector);
            break;
        } else {
            if (current.className && typeof current.className === 'string') {
                const classes = current.className.split(' ').filter(c => c).slice(0, 2).join('.');
                if (classes) selector += `.${classes}`;
            }
            
            // Index ekle
            const parent = current.parentElement;
            if (parent) {
                const siblings = Array.from(parent.children).filter(
                    el => el.tagName === current.tagName
                );
                if (siblings.length > 1) {
                    const index = siblings.indexOf(current);
                    selector += `:nth-of-type(${index + 1})`;
                }
            }
        }
        
        path.unshift(selector);
        current = current.parentElement;
    }
    
    return path.join(' > ');
}

// Element'i path'den bul
function findElementByPath(path) {
    if (!path) return null;
    
    try {
        // Önce tam path'i dene
        const element = document.querySelector(path);
        if (element) {
            console.log("🪞 Found element by full path:", path);
            return element;
        }
    } catch (e) {
        console.warn("🪞 Full path query failed:", e);
    }
    
    // Path bulunamazsa, selector'ları parçala ve sırayla dene
    const selectors = path.split(' > ');
    
    // En spesifik'ten en genel'e doğru dene
    for (let i = selectors.length - 1; i >= 0; i--) {
        try {
            const selector = selectors[i].trim();
            if (!selector) continue;
            
            // Önce tam selector'ı dene
            let element = document.querySelector(selector);
            if (element) {
                console.log("🪞 Found element by partial path:", selector);
                return element;
            }
            
            // Eğer selector'da nth-of-type varsa, onu kaldırıp dene
            if (selector.includes(':nth-of-type')) {
                const selectorWithoutNth = selector.replace(/:\d+\)/g, ')').replace(/:nth-of-type\(\d+\)/g, '');
                element = document.querySelector(selectorWithoutNth);
                if (element) {
                    console.log("🪞 Found element by path without nth-of-type:", selectorWithoutNth);
                    return element;
                }
            }
            
            // Sadece tag ve class'ı al
            const match = selector.match(/^(\w+)(\.[\w-]+)+/);
            if (match) {
                const simpleSelector = match[0];
                const elements = document.querySelectorAll(simpleSelector);
                if (elements.length === 1) {
                    console.log("🪞 Found unique element by simple selector:", simpleSelector);
                    return elements[0];
                }
            }
        } catch (e2) {
            continue;
        }
    }
    
    console.warn("🪞 Could not find element by path:", path);
    return null;
}

// =====================================================
// CLICK SYNC - Tüm tıklamaları yakala
// =====================================================
function initClickSync() {
    // LOCAL: Tüm click event'lerini yakala
    document.body.addEventListener("click", (e) => {
        // Remote event'lerden gelen click'leri ignore et
        if (isProcessingRemoteClick) {
            return;
        }
        
        const target = e.target;
        
        // Kendi event'lerimizi ignore et
        if (target.closest('.cron-remote-ghost-cursor')) return;
        
        // Element bilgilerini topla
        const elementPath = getElementPath(target);
        
        // className'i string'e çevir (SVG element'leri için)
        let classNameStr = null;
        if (target.className) {
            if (typeof target.className === 'string') {
                classNameStr = target.className;
            } else if (target.className.baseVal) {
                // SVG element'leri için
                classNameStr = target.className.baseVal;
            } else if (target.className.toString) {
                classNameStr = target.className.toString();
            }
        }
        
        const elementInfo = {
            tag: target.tagName.toLowerCase(),
            id: target.id || null,
            classes: classNameStr,
            text: target.textContent ? target.textContent.trim().substring(0, 50) : null,
            path: elementPath
        };
        
        // Koordinat bilgisi
        const rect = target.getBoundingClientRect();
        const clickInfo = {
            x: e.clientX,
            y: e.clientY,
            elementX: e.clientX - rect.left,
            elementY: e.clientY - rect.top,
            elementWidth: rect.width,
            elementHeight: rect.height
        };
        
        console.log("🪞 Click Detected:", elementInfo);
        console.log("🪞 Sending click event, tab_id:", getTabId());
        
        sendMirrorEvent("mirror_click", {
            element: elementInfo,
            click: clickInfo
        });
        
        console.log("🪞 Click event sent");
    }, true); // Capture phase'de dinle
}

// =====================================================
// INPUT SYNC - Tüm input değişikliklerini yakala
// =====================================================
function initInputSync() {
    // LOCAL: Tüm input event'lerini yakala
    document.body.addEventListener("input", (e) => {
        const target = e.target;
        
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
            const elementPath = getElementPath(target);
            const elementInfo = {
                tag: target.tagName.toLowerCase(),
                id: target.id || null,
                classes: target.className || null,
                type: target.type || null,
                path: elementPath
            };
            
            console.log("🪞 Input Detected:", elementInfo, target.value);
            
            sendMirrorEvent("mirror_input", {
                element: elementInfo,
                value: target.value
            });
        }
    }, true);
    
    // LOCAL: Change event'leri (select, checkbox, radio)
    document.body.addEventListener("change", (e) => {
        const target = e.target;
        
        if (target.tagName === "SELECT" || 
            target.tagName === "INPUT" && 
            (target.type === "checkbox" || target.type === "radio")) {
            
            const elementPath = getElementPath(target);
            const elementInfo = {
                tag: target.tagName.toLowerCase(),
                id: target.id || null,
                classes: target.className || null,
                type: target.type || null,
                path: elementPath
            };
            
            let value = target.value;
            if (target.type === "checkbox") {
                value = target.checked;
            }
            
            console.log("🪞 Change Detected:", elementInfo, value);
            
            sendMirrorEvent("mirror_change", {
                element: elementInfo,
                value: value
            });
        }
    }, true);
}

// =====================================================
// FOCUS/BLUR SYNC
// =====================================================
function initFocusSync() {
    // LOCAL: Focus event'leri
    document.body.addEventListener("focusin", (e) => {
        const target = e.target;
        
        if (target.tagName === "INPUT" || 
            target.tagName === "TEXTAREA" || 
            target.tagName === "SELECT" ||
            target.isContentEditable) {
            
            const elementPath = getElementPath(target);
            const elementInfo = {
                tag: target.tagName.toLowerCase(),
                id: target.id || null,
                classes: target.className || null,
                path: elementPath
            };
            
            console.log("🪞 Focus Detected:", elementInfo);
            
            sendMirrorEvent("mirror_focus", {
                element: elementInfo
            });
        }
    }, true);
    
    // LOCAL: Blur event'leri
    document.body.addEventListener("focusout", (e) => {
        const target = e.target;
        
        if (target.tagName === "INPUT" || 
            target.tagName === "TEXTAREA" || 
            target.tagName === "SELECT" ||
            target.isContentEditable) {
            
            const elementPath = getElementPath(target);
            const elementInfo = {
                tag: target.tagName.toLowerCase(),
                id: target.id || null,
                classes: target.className || null,
                path: elementPath
            };
            
            console.log("🪞 Blur Detected:", elementInfo);
            
            sendMirrorEvent("mirror_blur", {
                element: elementInfo
            });
        }
    }, true);
}

// =====================================================
// KEYBOARD SYNC - Önemli tuşlar
// =====================================================
function initKeyboardSync() {
    // LOCAL: Keyboard event'leri (Enter, Escape, Tab)
    document.body.addEventListener("keydown", (e) => {
        const target = e.target;
        
        // Sadece önemli tuşları yakala
        if (e.key === "Enter" || e.key === "Escape" || e.key === "Tab") {
            const elementPath = getElementPath(target);
            const elementInfo = {
                tag: target.tagName.toLowerCase(),
                id: target.id || null,
                classes: target.className || null,
                path: elementPath
            };
            
            console.log("🪞 Key Pressed:", e.key, elementInfo);
            
            sendMirrorEvent("mirror_keydown", {
                element: elementInfo,
                key: e.key,
                keyCode: e.keyCode,
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                altKey: e.altKey
            });
        }
    }, true);
}

// =====================================================
// REMOTE EVENT HANDLERS - Kullanıcı tarafında çalışır
// =====================================================
function initRemoteHandlers() {
    console.log("🪞 Setting up remote handlers, my tab_id:", getTabId());
    
    frappe.realtime.on("cron_remote_interaction", (data) => {
        console.log("🪞 Remote event received:", data.event_type, "from tab:", data.source_tab_id, "my tab:", getTabId());
        
        if (data.source_tab_id === getTabId()) {
            console.log("🪞 Ignoring own event");
            return; // Kendi event'imizi ignore et
        }
        
        if (!data || !data.payload) {
            console.warn("🪞 Invalid remote event data:", data);
            return;
        }
        
        console.log("🪞 Processing event:", data.event_type, "payload:", data.payload);
        console.log("🪞 Payload type:", typeof data.payload);
        console.log("🪞 Payload keys:", data.payload ? Object.keys(data.payload) : "no payload");
        console.log("🪞 Event type check:", typeof data.event_type, data.event_type, "=== 'mirror_click':", data.event_type === "mirror_click");
        
        // CLICK HANDLER
        if (data.event_type === "mirror_click") {
            console.log("🪞 ✅ Remote Click Received - Processing...");
            
            // Remote click işlemi başladı - flag'i set et
            isProcessingRemoteClick = true;
            
            // Payload'ı parse et (eğer string ise)
            let payload = data.payload;
            if (typeof payload === 'string') {
                try {
                    payload = JSON.parse(payload);
                } catch (e) {
                    console.warn("🪞 Failed to parse payload:", e);
                    isProcessingRemoteClick = false;
                    return;
                }
            }
            
            const elementInfo = payload?.element;
            const clickInfo = payload?.click;
            
            console.log("🪞 ElementInfo:", elementInfo);
            console.log("🪞 ClickInfo:", clickInfo);
            console.log("🪞 ClickInfo.x:", clickInfo?.x, "ClickInfo.y:", clickInfo?.y);
            
            // Eğer hiçbir bilgi yoksa skip
            if (!elementInfo && (!clickInfo || typeof clickInfo?.x === 'undefined' || typeof clickInfo?.y === 'undefined')) {
                console.warn("🪞 ❌ No valid element or click info, skipping");
                isProcessingRemoteClick = false;
                return;
            }
            
            // ÖNCE PATH İLE ELEMENT BUL (daha güvenilir - ekran boyutundan bağımsız)
            let element = null;
            
            // Önce ID ile dene
            if (elementInfo && elementInfo.id) {
                element = document.getElementById(elementInfo.id);
                if (element) console.log("🪞 Found by ID:", elementInfo.id);
            }
            
            // Sonra path ile dene (en güvenilir yöntem)
            if (!element && elementInfo && elementInfo.path) {
                element = findElementByPath(elementInfo.path);
                if (element) console.log("🪞 ✅ Found by path:", elementInfo.path);
            }
            
            // Sonra class ve tag ile dene
            if (!element && elementInfo && elementInfo.classes) {
                const classes = typeof elementInfo.classes === 'string' 
                    ? elementInfo.classes.split(' ').filter(c => c)
                    : (Array.isArray(elementInfo.classes) ? elementInfo.classes : []);
                if (classes.length > 0) {
                    const selector = `${elementInfo.tag || 'div'}.${classes[0]}`;
                    try {
                        element = document.querySelector(selector);
                        if (element) console.log("🪞 Found by selector:", selector);
                    } catch (e) {
                        console.warn("🪞 Selector error:", selector, e);
                    }
                }
            }
            
            // Eğer path ile element bulunduysa, direkt tıkla
            if (element) {
                try {
                    // Element bulunduysa, tıklanabilir bir parent bul
                    let clickableElement = element;
                    let depth = 0;
                    const maxDepth = 20; // Artırıldı
                    
                    // Helper function to check if element is clickable
                    function isClickable(el) {
                        if (!el || el === document.body) return false;
                        
                        const tagName = el.tagName;
                        if (tagName === 'BUTTON' || tagName === 'A' || tagName === 'INPUT') {
                            return true;
                        }
                        
                        // Check onclick
                        if (el.onclick || el.getAttribute('onclick')) {
                            return true;
                        }
                        
                        // Check data attributes
                        if (el.getAttribute('data-toggle') || el.getAttribute('data-target')) {
                            return true;
                        }
                        
                        // Check classes (handle SVG elements)
                        let className = '';
                        if (el.className) {
                            if (typeof el.className === 'string') {
                                className = el.className;
                            } else if (el.className.baseVal) {
                                className = el.className.baseVal;
                            } else if (el.classList && el.classList.toString) {
                                className = el.classList.toString();
                            }
                        }
                        
                        if (className.includes('btn') || 
                            className.includes('nav-link') || 
                            className.includes('dropdown-toggle') ||
                            className.includes('sidebar-toggle-btn') ||
                            className.includes('btn-reset') ||
                            className.includes('dropdown-item')) {
                            return true;
                        }
                        
                        // Check role
                        if (el.hasAttribute('role') && el.getAttribute('role') === 'button') {
                            return true;
                        }
                        
                        return false;
                    }
                    
                    // Find clickable parent
                    while (clickableElement && clickableElement !== document.body && depth < maxDepth) {
                        if (isClickable(clickableElement)) {
                            console.log("🪞 Found clickable parent for path element:", clickableElement, "at depth:", depth);
                            break;
                        }
                        clickableElement = clickableElement.parentElement;
                        depth++;
                    }
                    
                    let finalElement = clickableElement || element;
                    
                    // Dropdown kontrolü - parent element'te de kontrol et
                    let classNameStr = '';
                    if (finalElement.className) {
                        if (typeof finalElement.className === 'string') {
                            classNameStr = finalElement.className;
                        } else if (finalElement.className.baseVal) {
                            classNameStr = finalElement.className.baseVal;
                        } else if (finalElement.classList && finalElement.classList.toString) {
                            classNameStr = finalElement.classList.toString();
                        }
                    }
                    
                    // Parent element'te dropdown kontrolü
                    let parentElement = finalElement.parentElement;
                    let isDropdown = finalElement.getAttribute('data-toggle') === 'dropdown' || 
                                     classNameStr.includes('dropdown-toggle') ||
                                     classNameStr.includes('nav-link');
                    
                    // Parent'ta dropdown button ara
                    if (!isDropdown && parentElement) {
                        let parentClassName = '';
                        if (parentElement.className) {
                            if (typeof parentElement.className === 'string') {
                                parentClassName = parentElement.className;
                            } else if (parentElement.className.baseVal) {
                                parentClassName = parentElement.className.baseVal;
                            } else if (parentElement.classList && parentElement.classList.toString) {
                                parentClassName = parentElement.classList.toString();
                            }
                        }
                        if (parentElement.getAttribute('data-toggle') === 'dropdown' ||
                            parentClassName.includes('dropdown-toggle') ||
                            parentClassName.includes('nav-link')) {
                            isDropdown = true;
                            // Parent element'i kullan
                            if (parentElement.tagName === 'BUTTON' || parentElement.tagName === 'A') {
                                finalElement = parentElement;
                            }
                        }
                    }
                    
                    // Dropdown menu'yu önceden bul
                    let dropdownMenu = null;
                    let isDropdownOpen = false;
                    if (isDropdown) {
                        // Daha kapsamlı dropdown menu bulma
                        const ariaControls = finalElement.getAttribute('aria-controls');
                        if (ariaControls) {
                            dropdownMenu = document.getElementById(ariaControls);
                        }
                        
                        if (!dropdownMenu) {
                            dropdownMenu = finalElement.nextElementSibling;
                        }
                        
                        if (!dropdownMenu || !dropdownMenu.classList.contains('dropdown-menu')) {
                            dropdownMenu = finalElement.parentElement?.querySelector('.dropdown-menu');
                        }
                        
                        if (!dropdownMenu || !dropdownMenu.classList.contains('dropdown-menu')) {
                            dropdownMenu = finalElement.closest('.nav-item')?.querySelector('.dropdown-menu');
                        }
                        
                        if (!dropdownMenu || !dropdownMenu.classList.contains('dropdown-menu')) {
                            dropdownMenu = finalElement.closest('.dropdown')?.querySelector('.dropdown-menu');
                        }
                        
                        // Dropdown'ın mevcut durumunu kontrol et
                        if (dropdownMenu) {
                            isDropdownOpen = dropdownMenu.classList.contains('show');
                            console.log("🪞 Dropdown menu found:", dropdownMenu, "isOpen:", isDropdownOpen);
                        } else {
                            console.warn("🪞 Dropdown menu not found for:", finalElement);
                        }
                    }
                    
                    // Basit click - sadece click() metodunu çağır (en güvenilir)
                    try {
                        // Önce focus et (input'lar için)
                        if (finalElement.focus && (finalElement.tagName === 'INPUT' || finalElement.tagName === 'TEXTAREA')) {
                            finalElement.focus();
                        }
                        
                        // Dropdown için: Önce click() çağır, sonra toggle yap
                        // Bootstrap'in kendi dropdown handling'i çalışsın
                        if (finalElement.click) {
                            finalElement.click();
                        } else {
                            // Fallback: MouseEvent dispatch et
                            const rect = finalElement.getBoundingClientRect();
                            const centerX = rect.left + rect.width / 2;
                            const centerY = rect.top + rect.height / 2;
                            
                            const clickEvent = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                clientX: centerX,
                                clientY: centerY,
                                view: window,
                                button: 0
                            });
                            finalElement.dispatchEvent(clickEvent);
                        }
                        
                        // Dropdown için: Click'ten sonra dropdown'ı kontrol et ve toggle yap
                        if (isDropdown) {
                            setTimeout(() => {
                                // Dropdown menu'yu tekrar bul (DOM değişmiş olabilir)
                                let currentMenu = dropdownMenu;
                                if (!currentMenu) {
                                    const ariaControls = finalElement.getAttribute('aria-controls');
                                    if (ariaControls) {
                                        currentMenu = document.getElementById(ariaControls);
                                    }
                                    if (!currentMenu) {
                                        currentMenu = finalElement.closest('.nav-item')?.querySelector('.dropdown-menu') ||
                                                    finalElement.closest('.dropdown')?.querySelector('.dropdown-menu');
                                    }
                                }
                                
                                if (currentMenu) {
                                    const currentlyOpen = currentMenu.classList.contains('show');
                                    
                                    // Eğer beklenen durumla mevcut durum farklıysa, toggle yap
                                    if (isDropdownOpen !== currentlyOpen) {
                                        // Bootstrap dropdown API varsa kullan
                                        if (typeof $ !== 'undefined' && $(finalElement).dropdown) {
                                            try {
                                                $(finalElement).dropdown('toggle');
                                            } catch (e) {
                                                console.warn("🪞 Bootstrap dropdown toggle error:", e);
                                                // Fallback: Manuel toggle
                                                if (currentlyOpen) {
                                                    currentMenu.classList.remove('show');
                                                    finalElement.setAttribute('aria-expanded', 'false');
                                                } else {
                                                    currentMenu.classList.add('show');
                                                    finalElement.setAttribute('aria-expanded', 'true');
                                                }
                                            }
                                        } else {
                                            // Fallback: Manuel toggle
                                            if (currentlyOpen) {
                                                currentMenu.classList.remove('show');
                                                finalElement.setAttribute('aria-expanded', 'false');
                                            } else {
                                                currentMenu.classList.add('show');
                                                finalElement.setAttribute('aria-expanded', 'true');
                                            }
                                        }
                                    }
                                }
                            }, 50);
                        }
                        
                        console.log("🪞 ✅ Clicked element by path:", finalElement, isDropdown ? `(dropdown - ${isDropdownOpen ? 'closing' : 'opening'})` : "");
                        
                        // Flag'i temizle (dropdown'lar için daha uzun süre)
                        setTimeout(() => {
                            isProcessingRemoteClick = false;
                        }, isDropdown ? 300 : 200);
                    } catch (e) {
                        console.warn("🪞 Element click error:", e);
                        isProcessingRemoteClick = false;
                    }
                    return;
                } catch (e) {
                    console.warn("🪞 Element click error:", e);
                }
            }
            
            // FALLBACK: KOORDINAT İLE TIKLA (path bulunamazsa)
            if (clickInfo && typeof clickInfo.x !== 'undefined' && typeof clickInfo.y !== 'undefined') {
                console.log("🪞 Path failed, trying coordinate click at:", clickInfo.x, clickInfo.y);
                try {
                    const targetElement = document.elementFromPoint(clickInfo.x, clickInfo.y);
                    console.log("🪞 elementFromPoint result:", targetElement);
                    if (targetElement) {
                        console.log("🪞 ✅ Found element at coordinates:", clickInfo.x, clickInfo.y, targetElement);
                        
                        // Tıklanabilir bir parent bul (button, a, input vb.)
                        let clickableElement = targetElement;
                        let depth = 0;
                        const maxDepth = 20;
                        
                        // Helper function to check if element is clickable
                        function isClickableCoord(el) {
                            if (!el || el === document.body) return false;
                            
                            const tagName = el.tagName;
                            if (tagName === 'BUTTON' || tagName === 'A' || tagName === 'INPUT') {
                                return true;
                            }
                            
                            // Check onclick
                            if (el.onclick || el.getAttribute('onclick')) {
                                return true;
                            }
                            
                            // Check data attributes
                            if (el.getAttribute('data-toggle') || el.getAttribute('data-target')) {
                                return true;
                            }
                            
                            // Check classes (handle SVG elements)
                            let className = '';
                            if (el.className) {
                                if (typeof el.className === 'string') {
                                    className = el.className;
                                } else if (el.className.baseVal) {
                                    className = el.className.baseVal;
                                } else if (el.classList && el.classList.toString) {
                                    className = el.classList.toString();
                                }
                            }
                            
                            if (className.includes('btn') || 
                                className.includes('nav-link') || 
                                className.includes('dropdown-toggle') ||
                                className.includes('sidebar-toggle-btn') ||
                                className.includes('btn-reset') ||
                                className.includes('dropdown-item')) {
                                return true;
                            }
                            
                            // Check role
                            if (el.hasAttribute('role') && el.getAttribute('role') === 'button') {
                                return true;
                            }
                            
                            return false;
                        }
                        
                        while (clickableElement && clickableElement !== document.body && depth < maxDepth) {
                            if (isClickableCoord(clickableElement)) {
                                console.log("🪞 Found clickable parent:", clickableElement, "at depth:", depth);
                                break;
                            }
                            clickableElement = clickableElement.parentElement;
                            depth++;
                        }
                        
                        let finalElementCoord = clickableElement || targetElement;
                        
                        // Dropdown kontrolü - parent element'te de kontrol et
                        let classNameStrCoord = '';
                        if (finalElementCoord.className) {
                            if (typeof finalElementCoord.className === 'string') {
                                classNameStrCoord = finalElementCoord.className;
                            } else if (finalElementCoord.className.baseVal) {
                                classNameStrCoord = finalElementCoord.className.baseVal;
                            } else if (finalElementCoord.classList && finalElementCoord.classList.toString) {
                                classNameStrCoord = finalElementCoord.classList.toString();
                            }
                        }
                        
                        // Parent element'te dropdown kontrolü
                        let parentElementCoord = finalElementCoord.parentElement;
                        let isDropdownCoord = finalElementCoord.getAttribute('data-toggle') === 'dropdown' || 
                                             classNameStrCoord.includes('dropdown-toggle') ||
                                             classNameStrCoord.includes('nav-link');
                        
                        // Parent'ta dropdown button ara
                        if (!isDropdownCoord && parentElementCoord) {
                            let parentClassNameCoord = '';
                            if (parentElementCoord.className) {
                                if (typeof parentElementCoord.className === 'string') {
                                    parentClassNameCoord = parentElementCoord.className;
                                } else if (parentElementCoord.className.baseVal) {
                                    parentClassNameCoord = parentElementCoord.className.baseVal;
                                } else if (parentElementCoord.classList && parentElementCoord.classList.toString) {
                                    parentClassNameCoord = parentElementCoord.classList.toString();
                                }
                            }
                            if (parentElementCoord.getAttribute('data-toggle') === 'dropdown' ||
                                parentClassNameCoord.includes('dropdown-toggle') ||
                                parentClassNameCoord.includes('nav-link')) {
                                isDropdownCoord = true;
                                // Parent element'i kullan
                                if (parentElementCoord.tagName === 'BUTTON' || parentElementCoord.tagName === 'A') {
                                    finalElementCoord = parentElementCoord;
                                }
                            }
                        }
                        
                        // Dropdown menu'yu önceden bul
                        let dropdownMenuCoord = null;
                        let isDropdownOpenCoord = false;
                        if (isDropdownCoord) {
                            // Daha kapsamlı dropdown menu bulma
                            const ariaControlsCoord = finalElementCoord.getAttribute('aria-controls');
                            if (ariaControlsCoord) {
                                dropdownMenuCoord = document.getElementById(ariaControlsCoord);
                            }
                            
                            if (!dropdownMenuCoord) {
                                dropdownMenuCoord = finalElementCoord.nextElementSibling;
                            }
                            
                            if (!dropdownMenuCoord || !dropdownMenuCoord.classList.contains('dropdown-menu')) {
                                dropdownMenuCoord = finalElementCoord.parentElement?.querySelector('.dropdown-menu');
                            }
                            
                            if (!dropdownMenuCoord || !dropdownMenuCoord.classList.contains('dropdown-menu')) {
                                dropdownMenuCoord = finalElementCoord.closest('.nav-item')?.querySelector('.dropdown-menu');
                            }
                            
                            if (!dropdownMenuCoord || !dropdownMenuCoord.classList.contains('dropdown-menu')) {
                                dropdownMenuCoord = finalElementCoord.closest('.dropdown')?.querySelector('.dropdown-menu');
                            }
                            
                            // Dropdown'ın mevcut durumunu kontrol et
                            if (dropdownMenuCoord) {
                                isDropdownOpenCoord = dropdownMenuCoord.classList.contains('show');
                                console.log("🪞 Dropdown menu found (coord):", dropdownMenuCoord, "isOpen:", isDropdownOpenCoord);
                            } else {
                                console.warn("🪞 Dropdown menu not found (coord) for:", finalElementCoord);
                            }
                        }
                        
                        // Basit click - sadece click() metodunu çağır
                        try {
                            // Önce focus et (input'lar için)
                            if (finalElementCoord.focus && (finalElementCoord.tagName === 'INPUT' || finalElementCoord.tagName === 'TEXTAREA')) {
                                finalElementCoord.focus();
                            }
                            
                            // Dropdown için: Önce click() çağır, sonra toggle yap
                            // Bootstrap'in kendi dropdown handling'i çalışsın
                            if (finalElementCoord.click) {
                                finalElementCoord.click();
                            } else {
                                // Fallback: MouseEvent dispatch et
                                const clickEvent = new MouseEvent('click', {
                                    bubbles: true,
                                    cancelable: true,
                                    clientX: clickInfo.x,
                                    clientY: clickInfo.y,
                                    view: window,
                                    button: 0
                                });
                                finalElementCoord.dispatchEvent(clickEvent);
                            }
                            
                            // Dropdown için: Click'ten sonra dropdown'ı kontrol et ve toggle yap
                            if (isDropdownCoord) {
                                setTimeout(() => {
                                    // Dropdown menu'yu tekrar bul (DOM değişmiş olabilir)
                                    let currentMenuCoord = dropdownMenuCoord;
                                    if (!currentMenuCoord) {
                                        const ariaControlsCoord = finalElementCoord.getAttribute('aria-controls');
                                        if (ariaControlsCoord) {
                                            currentMenuCoord = document.getElementById(ariaControlsCoord);
                                        }
                                        if (!currentMenuCoord) {
                                            currentMenuCoord = finalElementCoord.closest('.nav-item')?.querySelector('.dropdown-menu') ||
                                                            finalElementCoord.closest('.dropdown')?.querySelector('.dropdown-menu');
                                        }
                                    }
                                    
                                    if (currentMenuCoord) {
                                        const currentlyOpenCoord = currentMenuCoord.classList.contains('show');
                                        
                                        // Eğer beklenen durumla mevcut durum farklıysa, toggle yap
                                        if (isDropdownOpenCoord !== currentlyOpenCoord) {
                                            // Bootstrap dropdown API varsa kullan
                                            if (typeof $ !== 'undefined' && $(finalElementCoord).dropdown) {
                                                try {
                                                    $(finalElementCoord).dropdown('toggle');
                                                } catch (e) {
                                                    console.warn("🪞 Bootstrap dropdown toggle error (coord):", e);
                                                    // Fallback: Manuel toggle
                                                    if (currentlyOpenCoord) {
                                                        currentMenuCoord.classList.remove('show');
                                                        finalElementCoord.setAttribute('aria-expanded', 'false');
                                                    } else {
                                                        currentMenuCoord.classList.add('show');
                                                        finalElementCoord.setAttribute('aria-expanded', 'true');
                                                    }
                                                }
                                            } else {
                                                // Fallback: Manuel toggle
                                                if (currentlyOpenCoord) {
                                                    currentMenuCoord.classList.remove('show');
                                                    finalElementCoord.setAttribute('aria-expanded', 'false');
                                                } else {
                                                    currentMenuCoord.classList.add('show');
                                                    finalElementCoord.setAttribute('aria-expanded', 'true');
                                                }
                                            }
                                        }
                                    }
                                }, 50);
                            }
                            
                            console.log("🪞 ✅ Clicked by coordinates (fallback):", clickInfo.x, clickInfo.y, finalElementCoord, isDropdownCoord ? `(dropdown - ${isDropdownOpenCoord ? 'closing' : 'opening'})` : "");
                            
                            // Flag'i temizle (dropdown'lar için daha uzun süre)
                            setTimeout(() => {
                                isProcessingRemoteClick = false;
                            }, isDropdownCoord ? 300 : 200);
                        } catch (e) {
                            console.warn("🪞 Coordinate click error:", e);
                            isProcessingRemoteClick = false;
                        }
                        return;
                    } else {
                        console.warn("🪞 ❌ No element found at coordinates:", clickInfo.x, clickInfo.y);
                    }
                } catch (e) {
                    console.error("🪞 ❌ Coordinate click error:", e);
                }
            }
            
            // Hiçbir yöntemle element bulunamadı
            console.warn("🪞 ❌ Element bulunamadı (path ve koordinat ile tıklama başarısız):", elementInfo, clickInfo);
            isProcessingRemoteClick = false;
        }
        
        // INPUT HANDLER
        else if (data.event_type === "mirror_input") {
            let payload = data.payload;
            if (typeof payload === 'string') {
                try {
                    payload = JSON.parse(payload);
                } catch (e) {
                    console.warn("🪞 Failed to parse payload:", e);
                }
            }
            
            const elementInfo = payload?.element;
            
            if (!elementInfo) {
                console.warn("🪞 Invalid input payload:", payload);
                return;
            }
            
            const value = payload.value;
            
            console.log("🪞 Remote Input:", elementInfo, value);
            
            let element = null;
            
            if (elementInfo && elementInfo.id) {
                element = document.getElementById(elementInfo.id);
            }
            
            if (!element && elementInfo && elementInfo.path) {
                element = findElementByPath(elementInfo.path);
            }
            
            if (element && (element.tagName === "INPUT" || element.tagName === "TEXTAREA")) {
                element.value = value || '';
                
                // Event'leri tetikle
                element.dispatchEvent(new Event('input', { bubbles: true }));
                if (typeof $ !== 'undefined') {
                    $(element).trigger('input');
                }
            }
        }
        
        // CHANGE HANDLER
        else if (data.event_type === "mirror_change") {
            let payload = data.payload;
            if (typeof payload === 'string') {
                try {
                    payload = JSON.parse(payload);
                } catch (e) {
                    console.warn("🪞 Failed to parse payload:", e);
                }
            }
            
            const elementInfo = payload?.element;
            
            if (!elementInfo) {
                console.warn("🪞 Invalid change payload:", payload);
                return;
            }
            
            const value = payload.value;
            
            console.log("🪞 Remote Change:", elementInfo, value);
            
            let element = null;
            
            if (elementInfo && elementInfo.id) {
                element = document.getElementById(elementInfo.id);
            }
            
            if (!element && elementInfo && elementInfo.path) {
                element = findElementByPath(elementInfo.path);
            }
            
            if (element) {
                if (element.type === "checkbox") {
                    element.checked = value;
                } else {
                    element.value = value || '';
                }
                
                element.dispatchEvent(new Event('change', { bubbles: true }));
                if (typeof $ !== 'undefined') {
                    $(element).trigger('change');
                }
            }
        }
        
        // FOCUS HANDLER
        else if (data.event_type === "mirror_focus") {
            let payload = data.payload;
            if (typeof payload === 'string') {
                try {
                    payload = JSON.parse(payload);
                } catch (e) {
                    console.warn("🪞 Failed to parse payload:", e);
                }
            }
            
            const elementInfo = payload?.element;
            
            if (!elementInfo) {
                return; // Sessizce skip et
            }
            
            
            let element = null;
            
            if (elementInfo && elementInfo.id) {
                element = document.getElementById(elementInfo.id);
            }
            
            if (!element && elementInfo && elementInfo.path) {
                element = findElementByPath(elementInfo.path);
            }
            
            if (element) {
                element.focus();
                if (typeof $ !== 'undefined') {
                    $(element).trigger('focus');
                }
            }
        }
        
        // BLUR HANDLER
        else if (data.event_type === "mirror_blur") {
            let payload = data.payload;
            if (typeof payload === 'string') {
                try {
                    payload = JSON.parse(payload);
                } catch (e) {
                    console.warn("🪞 Failed to parse payload:", e);
                }
            }
            
            const elementInfo = payload?.element;
            
            if (!elementInfo) {
                return; // Sessizce skip et
            }
            
            
            let element = null;
            
            if (elementInfo && elementInfo.id) {
                element = document.getElementById(elementInfo.id);
            }
            
            if (!element && elementInfo && elementInfo.path) {
                element = findElementByPath(elementInfo.path);
            }
            
            if (element) {
                element.blur();
                if (typeof $ !== 'undefined') {
                    $(element).trigger('blur');
                }
            }
        }
        
        // KEYDOWN HANDLER
        else if (data.event_type === "mirror_keydown") {
            let payload = data.payload;
            if (typeof payload === 'string') {
                try {
                    payload = JSON.parse(payload);
                } catch (e) {
                    console.warn("🪞 Failed to parse payload:", e);
                }
            }
            
            const elementInfo = payload?.element;
            
            if (!elementInfo) {
                console.warn("🪞 Invalid keydown payload:", payload);
                return;
            }
            
            const keyInfo = payload;
            
            let element = null;
            
            if (elementInfo && elementInfo.id) {
                element = document.getElementById(elementInfo.id);
            }
            
            if (!element && elementInfo && elementInfo.path) {
                element = findElementByPath(elementInfo.path);
            }
            
            if (element && keyInfo) {
                const keyEvent = new KeyboardEvent('keydown', {
                    bubbles: true,
                    cancelable: true,
                    key: keyInfo.key,
                    keyCode: keyInfo.keyCode,
                    ctrlKey: keyInfo.ctrlKey || false,
                    shiftKey: keyInfo.shiftKey || false,
                    altKey: keyInfo.altKey || false
                });
                element.dispatchEvent(keyEvent);
            }
        }
    });
}

// =====================================================
// INITIALIZATION
// =====================================================
function initMirrorSync() {
    // Frappe hazır olana kadar bekle
    if (typeof frappe === 'undefined' || !frappe.realtime) {
        setTimeout(initMirrorSync, 500);
        return;
    }
    
    console.log("🪞 Initializing Mirror Sync...");
    
    initClickSync();
    initInputSync();
    initFocusSync();
    initKeyboardSync();
    initRemoteHandlers();
    
    console.log("✅ Mirror Sync Initialized");
}

// Frappe ready'de başlat
if (typeof frappe !== 'undefined' && frappe.ready) {
    frappe.ready(initMirrorSync);
} else {
    document.addEventListener("DOMContentLoaded", initMirrorSync);
    window.addEventListener("load", initMirrorSync);
}

