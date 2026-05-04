console.log("cron_remote: connection listener loaded (REMOTE CONNECTION LISTENER ACTIVE)");

let LISTENER_INIT = false;
// MY_TAB_ID'yi global olarak tanımla (mirror_sync.js ile paylaşmak için)
if (typeof window.CRON_REMOTE_TAB_ID === 'undefined') {
    window.CRON_REMOTE_TAB_ID = Math.random().toString(36).substring(7);
}
const MY_TAB_ID = window.CRON_REMOTE_TAB_ID; // Unique ID for this tab

function initImpersonationListener() {
    if (LISTENER_INIT) return;
    LISTENER_INIT = true;

    console.log("cron_remote: impersonation listener init (✔ aktif) | Tab ID:", MY_TAB_ID);
    console.log("cron_remote: impersonation listener init (✔ aktif) | Tab ID:", MY_TAB_ID);
    console.log("cron_remote: impersonation listener init (✔ aktif) | Tab ID:", MY_TAB_ID);
    console.log("cron_remote: version 1.0.26 loaded");

    // Session kontrolü
    const user = frappe.session?.user || frappe.boot?.user?.name || "Guest";

    // Socket Bağlantı Kontrolü
    if (!frappe.realtime || !frappe.realtime.socket) {
        setTimeout(() => {
            LISTENER_INIT = false;
            initImpersonationListener();
        }, 1000);
        return;
    }

    if (user === "Guest" || user === "undefined" || !user) {
        setTimeout(() => {
            LISTENER_INIT = false;
            initImpersonationListener();
        }, 1000);
        return;
    }

    // =====================================================
    // 🖱️ CURSOR SHARING LOGIC
    // =====================================================
    initCursorSharing();

    // =====================================================
    // 🔗 URL SHARING LOGIC
    // =====================================================
    initUrlSharing();

    // =====================================================
    // 📜 SCROLL SHARING LOGIC
    // =====================================================
    initScrollSharing();

    // =====================================================
    // 🔔 INTERACTION SHARING LOGIC (Sidebar, Search)
    // =====================================================
    initInteractionSharing();

    // =====================================================
    // 🔔 EXISTING LISTENERS (Trojan Horse & Modal)
    // =====================================================

    // Ping Listener (TROJAN HORSE STRATEGY)
    frappe.realtime.on("cron_remote_ping", (data) => {
        if (data.type === "acceptance") {
            if (frappe.session.user === data.target_admin) {
                frappe.show_alert(`✅ ${data.impersonate_user} kabul etti! Yönlendiriliyor...`);
                setTimeout(() => {
                    window.location.href = "/api/method/cron_remote.api.impersonate_redirect?user=" + encodeURIComponent(data.impersonate_user);
                }, 1000);
            }
        }
    });

    // Rejection Listener (Admin Notification)
    frappe.realtime.on("impersonation_request_rejected", (data) => {
        frappe.msgprint({
            title: "İstek Reddedildi",
            message: "Kullanıcı bağlantı isteğini reddetti.",
            indicator: "red"
        });
    });

    // Main Listener (Modal)
    frappe.realtime.on("impersonation_request_received", (data) => {
        if (!data || !data.from_user) return;

        try {
            frappe.msgprint({
                title: "Bağlantı İsteği",
                message: `${data.from_user} hesabına bağlanmak istiyor.`,
                indicator: "blue",
                primary_action: {
                    label: "Kabul Et",
                    action() {
                        acceptImpersonation(data.from_user, data.request_id);
                    }
                },
                secondary_action: {
                    label: "Reddet",
                    action() {
                        rejectImpersonation(data.from_user, data.request_id);
                    }
                }
            });
        } catch (e) {
            showFallbackModal(data);
        }
    });
}

// =====================================================
// 🖱️ CURSOR FUNCTIONS
// =====================================================
function getContentElement() {
    const selectors = [".layout-main-section", ".page-container", ".main-section", "#page-desktop"];
    for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                return el;
            }
        }
    }
    return null;
}

function initCursorSharing() {
    console.log(" Cursor Sharing Initialized for Tab:", MY_TAB_ID);

    let lastSent = 0;

    // Mouse Move Listener - window'a ekle ki tüm ekranda çalışsın
    window.addEventListener("mousemove", (e) => {
        const now = Date.now();
        if (now - lastSent > 40) { // 40ms = 25fps
            lastSent = now;

            // Content element bazlı normalize etme - en doğru çözüm
            const viewportW = window.innerWidth;
            const viewportH = window.innerHeight;
            const contentEl = getContentElement();
            
            let x_data = 0;
            let y_data = 0;
            let is_header = false;
            let is_sidebar = false;
            let is_content = false;
            let contentRect = null;
            
            if (contentEl) {
                const rect = contentEl.getBoundingClientRect();
                
                // Content element bilgilerini normalize et ve gönder
                contentRect = {
                    left: rect.left / viewportW,
                    top: rect.top / viewportH,
                    width: rect.width / viewportW,
                    height: rect.height / viewportH,
                    right: rect.right / viewportW,
                    bottom: rect.bottom / viewportH
                };
                
                // Header detection (üst 70px)
                if (e.clientY < 70) {
                    is_header = true;
                    // Header için header element'ini bul ve ona göre normalize et
                    const headerEl = document.querySelector(".navbar, .desk-navbar, header, .header");
                    if (headerEl) {
                        const headerRect = headerEl.getBoundingClientRect();
                        // Header içindeki pozisyonu normalize et (0-1 arası)
                        const headerLeft = headerRect.left;
                        const headerWidth = headerRect.width;
                        const headerTop = headerRect.top;
                        const headerHeight = headerRect.height;
                        
                        if (headerWidth > 0) {
                            x_data = (e.clientX - headerLeft) / headerWidth;
                        } else {
                            x_data = e.clientX / viewportW;
                        }
                        
                        if (headerHeight > 0) {
                            y_data = (e.clientY - headerTop) / headerHeight;
                        } else {
                            y_data = e.clientY / 70;
                        }
                    } else {
                        // Fallback: viewport normalize
                        x_data = e.clientX / viewportW;
                        y_data = e.clientY / 70;
                    }
                } 
                // Sidebar detection (content'in solunda)
                else if (e.clientX < rect.left) {
                    is_sidebar = true;
                    // Sidebar için sidebar element'ini bul ve ona göre normalize et
                    const sidebarEl = document.querySelector(".sidebar, .desk-sidebar, .app-sidebar, [class*='sidebar']");
                    if (sidebarEl) {
                        const sidebarRect = sidebarEl.getBoundingClientRect();
                        // Sidebar içindeki pozisyonu normalize et (0-1 arası)
                        const sidebarLeft = sidebarRect.left;
                        const sidebarWidth = sidebarRect.width;
                        const sidebarTop = sidebarRect.top;
                        const sidebarHeight = sidebarRect.height;
                        
                        if (sidebarWidth > 0) {
                            x_data = (e.clientX - sidebarLeft) / sidebarWidth;
                        } else {
                            x_data = e.clientX / viewportW;
                        }
                        
                        if (sidebarHeight > 0) {
                            y_data = (e.clientY - sidebarTop) / sidebarHeight;
                        } else {
                            y_data = e.clientY / viewportH;
                        }
                    } else {
                        // Fallback: viewport normalize
                        x_data = e.clientX / viewportW;
                        y_data = e.clientY / viewportH;
                    }
                } 
                // Content area - content element'e göre normalize
                else {
                    is_content = true;
                    // Content için content element'e göre normalize (0-1 arası)
                    const contentLeft = rect.left;
                    const contentTop = rect.top;
                    const contentWidth = rect.width;
                    const contentHeight = rect.height;
                    
                    if (contentWidth > 0) {
                        x_data = (e.clientX - contentLeft) / contentWidth;
                    } else {
                        x_data = e.clientX / viewportW;
                    }
                    
                    if (contentHeight > 0) {
                        y_data = (e.clientY - contentTop) / contentHeight;
                    } else {
                        y_data = e.clientY / viewportH;
                    }
                }
            } else {
                // Fallback: viewport normalize
                is_content = true;
                x_data = e.clientX / viewportW;
                y_data = e.clientY / viewportH;
            }
            
            // NaN Safety
            if (isNaN(x_data)) x_data = 0;
            if (isNaN(y_data)) y_data = 0;

            frappe.call({
                method: "cron_remote.api.relay_cursor_event",
                args: {
                    x: x_data,
                    y: y_data,
                    is_sidebar: is_sidebar,
                    is_header: is_header,
                    is_content: is_content,
                    content_rect: contentRect,  // Content element bilgisi
                    screen_w: viewportW,
                    screen_h: viewportH,
                    tab_id: MY_TAB_ID
                },
                type: "POST",
                silent: true,
                callback: function (r) { },
                error: function (e) { console.warn("❌ Cursor send error:", e); }
            });
        }
    });

    // Click Listener (CLICK SYNC)
    document.addEventListener("click", (e) => {
        if (e.isTrusted === false || e.detail === 0) return; // Ignore simulated clicks

        // Content element bazlı normalize etme
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        const contentEl = getContentElement();
        
        let x_data = 0;
        let y_data = 0;
        let is_header = false;
        let is_sidebar = false;
        let is_content = false;
        
        if (contentEl) {
            const rect = contentEl.getBoundingClientRect();
            
            if (e.clientY < 70) {
                is_header = true;
                // Header için header element'ini bul ve ona göre normalize et
                const headerEl = document.querySelector(".navbar, .desk-navbar, header, .header");
                if (headerEl) {
                    const headerRect = headerEl.getBoundingClientRect();
                    const headerLeft = headerRect.left;
                    const headerWidth = headerRect.width;
                    const headerTop = headerRect.top;
                    const headerHeight = headerRect.height;
                    
                    if (headerWidth > 0) {
                        x_data = (e.clientX - headerLeft) / headerWidth;
                    } else {
                        x_data = e.clientX / viewportW;
                    }
                    
                    if (headerHeight > 0) {
                        y_data = (e.clientY - headerTop) / headerHeight;
                    } else {
                        y_data = e.clientY / 70;
                    }
                } else {
                    x_data = e.clientX / viewportW;
                    y_data = e.clientY / 70;
                }
            } else if (e.clientX < rect.left) {
                is_sidebar = true;
                // Sidebar için sidebar element'ini bul ve ona göre normalize et
                const sidebarEl = document.querySelector(".sidebar, .desk-sidebar, .app-sidebar, [class*='sidebar']");
                if (sidebarEl) {
                    const sidebarRect = sidebarEl.getBoundingClientRect();
                    const sidebarLeft = sidebarRect.left;
                    const sidebarWidth = sidebarRect.width;
                    const sidebarTop = sidebarRect.top;
                    const sidebarHeight = sidebarRect.height;
                    
                    if (sidebarWidth > 0) {
                        x_data = (e.clientX - sidebarLeft) / sidebarWidth;
                    } else {
                        x_data = e.clientX / viewportW;
                    }
                    
                    if (sidebarHeight > 0) {
                        y_data = (e.clientY - sidebarTop) / sidebarHeight;
                    } else {
                        y_data = e.clientY / viewportH;
                    }
                } else {
                    x_data = e.clientX / viewportW;
                    y_data = e.clientY / viewportH;
                }
            } else {
                is_content = true;
                const contentLeft = rect.left;
                const contentTop = rect.top;
                const contentWidth = rect.width;
                const contentHeight = rect.height;
                
                if (contentWidth > 0) {
                    x_data = (e.clientX - contentLeft) / contentWidth;
                } else {
                    x_data = e.clientX / viewportW;
                }
                
                if (contentHeight > 0) {
                    y_data = (e.clientY - contentTop) / contentHeight;
                } else {
                    y_data = e.clientY / viewportH;
                }
            }
        } else {
            is_content = true;
            x_data = e.clientX / viewportW;
            y_data = e.clientY / viewportH;
        }
        
        if (isNaN(x_data)) x_data = 0;
        if (isNaN(y_data)) y_data = 0;

        frappe.call({
            method: "cron_remote.api.relay_interaction_event",
            args: {
                event_type: "click",
                payload: {
                    x: x_data,
                    y: y_data,
                    is_sidebar: is_sidebar,
                    is_header: is_header
                },
                tab_id: MY_TAB_ID
            },
            type: "POST",
            silent: true
        });
    });

    frappe.realtime.on("cron_remote_cursor", (data) => {
        if (data.source_tab_id === MY_TAB_ID) return;
        renderGhostCursor(data);
    });
}

let ghostCursor = null;
function renderGhostCursor(data) {
    if (!ghostCursor) {
        ghostCursor = document.createElement("div");
        ghostCursor.id = "cron-ghost-cursor";
        ghostCursor.style.position = "fixed";
        ghostCursor.style.width = "20px";
        ghostCursor.style.height = "20px";
        ghostCursor.style.backgroundImage = "url('https://img.icons8.com/ios-filled/50/4a90e2/cursor.png')";
        ghostCursor.style.backgroundSize = "contain";
        ghostCursor.style.pointerEvents = "none";
        ghostCursor.style.zIndex = "999999999";
        ghostCursor.style.transition = "top 0.08s linear, left 0.08s linear";
        document.body.appendChild(ghostCursor);

        const label = document.createElement("div");
        label.innerText = "Admin";
        label.style.position = "absolute";
        label.style.top = "20px";
        label.style.left = "10px";
        label.style.backgroundColor = "#4a90e2";
        label.style.color = "white";
        label.style.padding = "2px 6px";
        label.style.borderRadius = "4px";
        label.style.fontSize = "10px";
        ghostCursor.appendChild(label);
    }

    // Content element bazlı normalize edilmiş koordinatları çevir
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const contentEl = getContentElement();
    
    let targetX = 0;
    let targetY = 0;
    
    const isHeader = (data.is_header === true || data.is_header === "true" || data.is_header === 1);
    const isSidebar = (data.is_sidebar === true || data.is_sidebar === "true" || data.is_sidebar === 1);
    const isContent = (data.is_content === true || data.is_content === "true" || data.is_content === 1);
    
    if (isHeader) {
        // Header için header element'ini bul ve ona göre çevir
        const headerEl = document.querySelector(".navbar, .desk-navbar, header, .header");
        if (headerEl) {
            const headerRect = headerEl.getBoundingClientRect();
            const headerLeft = headerRect.left;
            const headerWidth = headerRect.width;
            const headerTop = headerRect.top;
            const headerHeight = headerRect.height;
            
            // Normalize edilmiş koordinatları header element'e göre çevir
            targetX = headerLeft + (data.x * headerWidth);
            targetY = headerTop + (data.y * headerHeight);
        } else {
            // Fallback: viewport normalize
            targetX = data.x * viewportW;
            targetY = data.y * 70;
        }
    } else if (isSidebar) {
        // Sidebar için sidebar element'ini bul ve ona göre çevir
        const sidebarEl = document.querySelector(".sidebar, .desk-sidebar, .app-sidebar, [class*='sidebar']");
        if (sidebarEl) {
            const sidebarRect = sidebarEl.getBoundingClientRect();
            const sidebarLeft = sidebarRect.left;
            const sidebarWidth = sidebarRect.width;
            const sidebarTop = sidebarRect.top;
            const sidebarHeight = sidebarRect.height;
            
            // Normalize edilmiş koordinatları sidebar element'e göre çevir
            targetX = sidebarLeft + (data.x * sidebarWidth);
            targetY = sidebarTop + (data.y * sidebarHeight);
        } else {
            // Fallback: viewport normalize
            targetX = data.x * viewportW;
            targetY = data.y * viewportH;
        }
    } else if (isContent && contentEl && data.content_rect) {
        // Content için content element'e göre çevir
        const rect = contentEl.getBoundingClientRect();
        
        // Source content element bilgileri (normalize edilmiş)
        const sourceRect = data.content_rect;
        
        // Alıcı content element'in gerçek boyutları
        const targetContentLeft = rect.left;
        const targetContentTop = rect.top;
        const targetContentWidth = rect.width;
        const targetContentHeight = rect.height;
        
        // Normalize edilmiş koordinatları (0-1) content element'e göre çevir
        targetX = targetContentLeft + (data.x * targetContentWidth);
        targetY = targetContentTop + (data.y * targetContentHeight);
    } else {
        // Fallback: viewport normalize
        targetX = data.x * viewportW;
        targetY = data.y * viewportH;
    }
    
    // NaN Safety
    if (isNaN(targetX)) targetX = 0;
    if (isNaN(targetY)) targetY = 0;

    ghostCursor.style.left = targetX + "px";
    ghostCursor.style.top = targetY + "px";
}

// =====================================================
// 📜 SCROLL SHARING FUNCTIONS
// =====================================================
function initScrollSharing() {
    console.log("📜 Scroll Sharing Initialized");

    let lastScrollSent = 0;
    window.addEventListener("scroll", () => {
        const now = Date.now();
        if (now - lastScrollSent > 100) {
            lastScrollSent = now;

            frappe.call({
                method: "cron_remote.api.relay_scroll_event",
                args: {
                    scroll_top: window.scrollY,
                    scroll_left: window.scrollX,
                    tab_id: MY_TAB_ID
                },
                type: "POST",
                silent: true
            });
        }
    });

    frappe.realtime.on("cron_remote_scroll", (data) => {
        if (data.source_tab_id === MY_TAB_ID) return;

        window.scrollTo({
            top: data.scroll_top,
            left: data.scroll_left,
            behavior: 'auto'
        });
    });
}

// =====================================================
// 🔔 INTERACTION SHARING FUNCTIONS (Sidebar, Search)
// =====================================================
function initInteractionSharing() {
    console.log("🔔 Interaction Sharing Initialized");

    // --- 1. SIDEBAR SYNC (MutationObserver) ---
    const body = document.body;
    let lastSidebarState = body.classList.contains("sidebar-collapsed");

    const observer = new MutationObserver(() => {
        const currentState = body.classList.contains("sidebar-collapsed");
        if (currentState !== lastSidebarState) {
            lastSidebarState = currentState;
            console.log("Sidebar Toggled:", currentState);

            frappe.call({
                method: "cron_remote.api.relay_interaction_event",
                args: {
                    event_type: "sidebar_toggle",
                    payload: { collapsed: currentState },
                    tab_id: MY_TAB_ID
                },
                type: "POST",
                silent: true
            });
        }
    });

    observer.observe(body, { attributes: true, attributeFilter: ["class"] });

    // --- 2. SEARCH BAR SYNC (Event Delegation) ---
    // Navbar dinamik yüklenebileceği için body üzerinden dinliyoruz
    document.body.addEventListener("input", (e) => {
        if (e.target && (e.target.id === "navbar-search" || e.target.classList.contains("navbar-search"))) {
            frappe.call({
                method: "cron_remote.api.relay_interaction_event",
                args: {
                    event_type: "search_input",
                    payload: { value: e.target.value },
                    tab_id: MY_TAB_ID
                },
                type: "POST",
                silent: true
            });
        }
    });

    // Search Focus (Modalı açmak için)
    document.body.addEventListener("focusin", (e) => {
        if (e.target && (e.target.id === "navbar-search" || e.target.classList.contains("navbar-search"))) {
            frappe.call({
                method: "cron_remote.api.relay_interaction_event",
                args: {
                    event_type: "search_focus",
                    payload: {},
                    tab_id: MY_TAB_ID
                },
                type: "POST",
                silent: true
            });
        }
    });

    // Search Blur (Modalı kapatmak için)
    document.body.addEventListener("focusout", (e) => {
        if (e.target && (e.target.id === "navbar-search" || e.target.classList.contains("navbar-search"))) {
            frappe.call({
                method: "cron_remote.api.relay_interaction_event",
                args: {
                    event_type: "search_blur",
                    payload: {},
                    tab_id: MY_TAB_ID
                },
                type: "POST",
                silent: true
            });
        }
    });

    // --- 3. LISTEN FOR REMOTE EVENTS ---
    frappe.realtime.on("cron_remote_interaction", (data) => {
        if (data.source_tab_id === MY_TAB_ID) return;

        if (data.event_type === "sidebar_toggle") {
            console.log("🔄 Syncing Sidebar:", data.payload.collapsed);
            if (data.payload.collapsed) {
                if (!document.body.classList.contains("sidebar-collapsed")) {
                    frappe.app.sidebar.toggle();
                }
            } else {
                if (document.body.classList.contains("sidebar-collapsed")) {
                    frappe.app.sidebar.toggle();
                }
            }
        } else if (data.event_type === "search_input") {
            const search = document.querySelector("#navbar-search");
            if (search) {
                search.value = data.payload.value;
                search.dispatchEvent(new Event('input', { bubbles: true }));
            }
        } else if (data.event_type === "search_focus") {
            const search = document.querySelector("#navbar-search");
            if (search) {
                search.focus();
                // Frappe Awesomebar'ı tetikle (varsa)
                if (frappe.search && frappe.search.setup) {
                    // Bazen focus yetmez, manuel tetik gerekebilir
                    // Ancak focus genellikle yeterlidir.
                }
            }
        } else if (data.event_type === "search_blur") {
            const search = document.querySelector("#navbar-search");
            if (search) {
                search.blur();
            }
        }
    });
}

// =====================================================
// 🔗 URL SHARING FUNCTIONS
// =====================================================
function initUrlSharing() {
    console.log("🔗 URL Sharing Initialized");

    // 1. Route değişimini dinle (Frappe Router)

    // Yöntem A: Frappe Router Hook (Tıklamalar için)
    const original_set_route = frappe.set_route;
    frappe.set_route = function (...args) {
        const result = original_set_route.apply(this, args);
        setTimeout(() => {
            const current_route = frappe.get_route_str();
            broadcastUrlChange(current_route);
        }, 500);
        return result;
    };

    // Yöntem B: Hash Change (Eski tip routing)
    window.addEventListener("hashchange", () => {
        const current_route = frappe.get_route_str();
        broadcastUrlChange(current_route);
    });

    // Yöntem C: Popstate (Geri/İleri tuşları için)
    window.addEventListener("popstate", () => {
        setTimeout(() => {
            const current_route = frappe.get_route_str();
            console.log("🔙 Back/Forward detected:", current_route);
            broadcastUrlChange(current_route);
        }, 200);
    });

    // 2. Diğerlerinden gelen URL verisini dinle
    frappe.realtime.on("cron_remote_url", (data) => {
        if (data.source_tab_id === MY_TAB_ID) return; // Kendimizden geldiyse yoksay

        console.log("🔗 Remote URL Change received:", data.route);

        const current = frappe.get_route_str();
        if (current !== data.route) {
            console.log("🔄 Syncing route to:", data.route);
            frappe.set_route(data.route);
        }
    });
}

let lastBroadcastRoute = "";
function broadcastUrlChange(route) {
    if (!route) return;
    if (route === lastBroadcastRoute) return; // Tekrarı önle
    lastBroadcastRoute = route;

    console.log("📤 Broadcasting URL:", route);

    frappe.call({
        method: "cron_remote.api.relay_url_event",
        args: {
            route: route,
            tab_id: MY_TAB_ID
        },
        type: "POST",
        silent: true
    });
}

// =====================================================
// 🛠️ HELPER FUNCTIONS
// =====================================================
function acceptImpersonation(user, request_id) {
    frappe.call({
        method: "cron_remote.api.accept_impersonation_request",
        args: { request_id: request_id },
        callback() {
            frappe.hide_msgprint(true);
            frappe.show_alert("Bağlantı kabul edildi. Admin yönlendiriliyor...");
        }
    });
}

function rejectImpersonation(user, request_id) {
    frappe.hide_msgprint(true);
    frappe.call({
        method: "cron_remote.api.reject_impersonation_request",
        args: { request_id: request_id },
        callback() {
            frappe.show_alert("Bağlantı reddedildi.");
        }
    });
}

function showFallbackModal(data) {
    // ... (Fallback modal code same as before) ...
    const modal = document.createElement("div");
    modal.id = "impersonation-modal-wrapper";
    modal.innerHTML = `
        <div style="position: fixed; z-index: 99999; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 22px; border-radius: 8px; width: 360px; text-align: center; box-shadow: 0 4px 18px rgba(0,0,0,0.25);">
                <h3 style="margin-bottom:12px;">Bağlantı İsteği</h3>
                <p style="margin-bottom:20px;"><strong>${data.from_user}</strong> hesabına bağlanmak istiyor.</p>
                <button id="imp-accept" style="background:#2490ef; color:white; padding:8px 20px; border:none; border-radius:4px; margin-right:8px;">Kabul Et</button>
                <button id="imp-deny" style="background:#888; color:white; padding:8px 18px; border:none; border-radius:4px;">Reddet</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    document.getElementById("imp-accept").onclick = () => { acceptImpersonation(data.from_user, data.request_id); modal.remove(); };
    document.getElementById("imp-deny").onclick = () => { rejectImpersonation(data.from_user, data.request_id); modal.remove(); };
}

if (typeof frappe.ready === "function") {
    frappe.ready(initImpersonationListener);
} else {
    document.addEventListener("DOMContentLoaded", initImpersonationListener);
}
