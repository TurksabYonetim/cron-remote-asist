import frappe
from frappe import _
from frappe.utils import now_datetime, add_to_date


# ============================================================
# 🔥 BOOTINFO EXPANDER (JS'ın doğru host/socket verisini alması için)
# ============================================================
def extend_bootinfo(bootinfo):
    """
    cron_remote JS tarafının doğru socket URL'sini kurabilmesi için
    host_name ve socketio_port bilgilerini boot'a ekliyoruz.
    """
    bootinfo["remote_host_name"] = frappe.conf.host_name
    bootinfo["remote_socketio_port"] = frappe.conf.socketio_port
    bootinfo["remote_webserver_port"] = frappe.conf.webserver_port
    return bootinfo


# ============================================================
# 🔥 IMPERSONATION REQUEST OLUŞTUR (User → User)
# ============================================================
@frappe.whitelist()
def create_impersonation_request(to_user, message=None, expires_in_minutes=60):
    """Yeni impersonation isteği oluşturur."""
    from_user = frappe.session.user

    if from_user == to_user:
        frappe.throw(_("Kendine istek gönderemezsin."))

    if to_user == "Administrator":
        frappe.throw(_("Administrator için istek gönderilemez."))

    # Check if doctype exists
    if not frappe.db.exists("DocType", "Impersonation Request"):
        frappe.throw(_("Impersonation Request doctype bulunamadı. Lütfen modülü yeniden yükleyin."))

    # Yeni kayıt oluştur - frappe.get_doc kullan ama import sorununu önlemek için try-except
    expires_at = add_to_date(now_datetime(), minutes=expires_in_minutes)
    
    try:
        # Normal yöntem - doctype import edilebilirse
        doc = frappe.get_doc({
            "doctype": "Impersonation Request",
            "from_user": from_user,
            "to_user": to_user,
            "status": "Pending",
            "requested_at": now_datetime(),
            "expires_at": expires_at,
            "message": message or ""
        })
        doc.insert(ignore_permissions=True)
        request_id = doc.name
        frappe.db.commit()
    except Exception as e:
        # Fallback: SQL ile direkt insert
        from frappe.utils import random_string
        request_id = random_string(10)
        expires_at_str = expires_at.strftime('%Y-%m-%d %H:%M:%S') if hasattr(expires_at, 'strftime') else str(expires_at)
        requested_at_str = now_datetime().strftime('%Y-%m-%d %H:%M:%S') if hasattr(now_datetime(), 'strftime') else str(now_datetime())
        
        frappe.db.sql("""
            INSERT INTO `tabImpersonation Request` 
            (name, from_user, to_user, status, requested_at, expires_at, message, creation, modified, owner, modified_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW(), %s, %s)
        """, (
            request_id, from_user, to_user, "Pending", 
            requested_at_str, expires_at_str,
            message or "", from_user, from_user
        ))
        frappe.db.commit()

    # 🔥 Hedef kullanıcıya realtime popup gönderiyoruz
    frappe.publish_realtime(
        "impersonation_request_received",
        {
            "from_user": from_user,
            "to_user": to_user,
            "request_id": request_id,
            "message": message or "",
        },
        user=to_user
    )

    return {
        "message": "Impersonation request created",
        "request_id": request_id
    }


# ============================================================
# 🔥 ACCEPT REQUEST → Hedef kullanıcı kabul ederse admin'e geri düşer
# ============================================================
@frappe.whitelist()
def accept_impersonation_request(request_id):
    """Kullanıcı popup üzerinden 'Kabul Et' basınca çalışır."""
    
    if not request_id:
        frappe.throw(_("Request ID gerekli."))
    
    # Check if doctype exists
    if not frappe.db.exists("DocType", "Impersonation Request"):
        frappe.throw(_("Impersonation Request doctype bulunamadı."))
    
    # Check if request exists
    if not frappe.db.exists("Impersonation Request", request_id):
        frappe.throw(_("İstek bulunamadı veya süresi dolmuş."))
    
    try:
        doc = frappe.get_doc("Impersonation Request", request_id)
    except Exception as e:
        frappe.log_error(f"Error getting Impersonation Request {request_id}: {str(e)}")
        frappe.throw(_("İstek alınırken hata oluştu: {0}").format(str(e)))

    if frappe.session.user != doc.to_user:
        frappe.throw(_("Yetkin olmayan isteği kabul edemezsin."))
    
    if doc.status != "Pending":
        frappe.throw(_("Bu istek zaten işlenmiş."))

    try:
        doc.status = "Approved"
        doc.save(ignore_permissions=True)
        frappe.db.commit()
    except Exception as e:
        frappe.log_error(f"Error saving Impersonation Request {request_id}: {str(e)}")
        frappe.db.rollback()
        frappe.throw(_("İstek kaydedilirken hata oluştu: {0}").format(str(e)))

    # 🔥 Admin'e realtime göndermemiz lazım
    try:
        frappe.publish_realtime(
            "cron_remote_ping", 
            {
                "type": "acceptance",
                "target_admin": doc.from_user,
                "impersonate_user": doc.to_user,
                "request_id": request_id
            }, 
            user=None # Broadcast
        )
    except Exception as e:
        frappe.log_error(f"Error publishing realtime event for request {request_id}: {str(e)}")
        # Don't fail the whole request if realtime fails
    
    return {"message": "Impersonation request accepted", "status": "success"}


# ============================================================
# 🔥 REDDET
# ============================================================
@frappe.whitelist()
def reject_impersonation_request(request_id):
    """Kullanıcı popup üzerinden 'Reddet' basınca çalışır."""
    
    if not request_id:
        frappe.throw(_("Request ID gerekli."))
    
    # Check if doctype exists
    if not frappe.db.exists("DocType", "Impersonation Request"):
        frappe.throw(_("Impersonation Request doctype bulunamadı."))
    
    # Check if request exists
    if not frappe.db.exists("Impersonation Request", request_id):
        frappe.throw(_("İstek bulunamadı veya süresi dolmuş."))
    
    try:
        doc = frappe.get_doc("Impersonation Request", request_id)
    except Exception as e:
        frappe.log_error(f"Error getting Impersonation Request {request_id}: {str(e)}")
        frappe.throw(_("İstek alınırken hata oluştu: {0}").format(str(e)))

    if frappe.session.user != doc.to_user:
        frappe.throw(_("Bu isteği reddetmeye yetkin yok."))
    
    if doc.status != "Pending":
        frappe.throw(_("Bu istek zaten işlenmiş."))

    try:
        doc.status = "Rejected"
        doc.save(ignore_permissions=True)
        frappe.db.commit()
    except Exception as e:
        frappe.log_error(f"Error saving Impersonation Request {request_id}: {str(e)}")
        frappe.db.rollback()
        frappe.throw(_("İstek kaydedilirken hata oluştu: {0}").format(str(e)))

    try:
        frappe.publish_realtime(
            "impersonation_request_rejected",
            {"request_id": request_id},
            user=doc.from_user
        )
    except Exception as e:
        frappe.log_error(f"Error publishing realtime event for request {request_id}: {str(e)}")
        # Don't fail the whole request if realtime fails

    return {"message": "Impersonation request rejected", "status": "success"}


# ============================================================
# 🔥 İMPERSONATE LOGIN REDIRECT
# ============================================================
@frappe.whitelist()
def impersonate_redirect(user: str):
    """Popup'ta 'Kabul Et' → admin'e redirect login."""

    session = frappe.local.session_obj

    # 🔥 Güvenlik
    roles = frappe.get_roles(frappe.session.user)
    if "System Manager" not in roles and "Administrator" not in roles:
        frappe.throw(_("Yetkin yok."))

    # 🔥 Impersonate
    frappe.local.login_manager.impersonate(user)

    # 🔥 Desk'e yönlendir
    frappe.local.response["type"] = "redirect"
    frappe.local.response["location"] = "/desk"

    return {"message": "redirecting"}


# ============================================================
# 🔥 SESSION ENDER (Remote kontrol)
# ============================================================
@frappe.whitelist()
def end_remote_session(session_name: str):
    """rrweb kontrolünde admin session sonlandırma işlemi."""

    # Socket server gibi gerçek session kapatma opsiyonları burada implement edilebilir.

# ============================================================
# 🔥 CURSOR SHARING RELAY
# ============================================================
@frappe.whitelist()
def relay_cursor_event(x, y, screen_w, screen_h, tab_id, is_sidebar=False, is_header=False, is_content=False, content_rect=None):
    """
    Kullanıcının fare hareketini alır ve aynı kullanıcıya (diğer sekmelere) geri yansıtır.
    Content area için content element bazlı normalize edilmiş (0-1 arası).
    Header/Sidebar için viewport'a göre normalize edilmiş (0-1 arası).
    """
    user = frappe.session.user
    
    if user == "Guest":
        return

    # Sadece aynı kullanıcıya yayınla
    frappe.publish_realtime(
        "cron_remote_cursor",
        {
            "x": x,
            "y": y,
            "is_sidebar": is_sidebar,
            "is_header": is_header,
            "is_content": is_content,
            "content_rect": content_rect,  # Normalize edilmiş content element bilgisi
            "screen_w": screen_w,
            "screen_h": screen_h,
            "source_user": user,
            "source_tab_id": tab_id
        },
        user=user
    )


# ============================================================
# 🔥 SCROLL SHARING RELAY
# ============================================================
@frappe.whitelist()
def relay_scroll_event(scroll_top, scroll_left, tab_id):
    """
    Scroll pozisyonunu diğer sekmelere yansıtır.
    """
    user = frappe.session.user
    if user == "Guest":
        return

    frappe.publish_realtime(
        "cron_remote_scroll",
        {
            "scroll_top": scroll_top,
            "scroll_left": scroll_left,
            "source_user": user,
            "source_tab_id": tab_id
        },
        user=user
    )

# ============================================================
# 🔥 URL SHARING RELAY
# ============================================================
@frappe.whitelist()
def relay_url_event(route, tab_id):
    """
    Sayfa değişimini diğer sekmelere yansıtır.
    """
    user = frappe.session.user
    if user == "Guest":
        return

    frappe.publish_realtime(
        "cron_remote_url",
        {
            "route": route,
            "source_user": user,
            "source_tab_id": tab_id
        },
        user=user
    )


# ============================================================
# 🔥 INTERACTION SHARING RELAY (Sidebar, Search, etc.)
# ============================================================
@frappe.whitelist()
def relay_interaction_event(event_type, payload, tab_id):
    """
    Genel etkileşim olaylarını (sidebar, search vb.) diğer sekmelere yansıtır.
    """
    user = frappe.session.user
    if user == "Guest":
        return

    frappe.publish_realtime(
        "cron_remote_interaction",
        {
            "event_type": event_type,
            "payload": payload,
            "source_user": user,
            "source_tab_id": tab_id
        },
        user=user
    )
