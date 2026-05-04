import frappe

@frappe.whitelist()
def check_pending_requests():
    """Hedef kullanıcı için bekleyen remote session isteklerini kontrol et"""
    user = frappe.session.user
    
    # Son 1 dakikada oluşturulan, bu kullanıcıya gönderilen Requested durumundaki session'ları bul
    sessions = frappe.get_all(
        'Remote Session',
        filters={
            'target_user': user,
            'status': 'Requested',
            'creation': ['>=', frappe.utils.add_to_date(frappe.utils.now(), minutes=-1)]
        },
        fields=['name', 'requester', 'session_id', 'creation'],
        order_by='creation desc',
        limit=1
    )
    
    if sessions:
        return sessions[0]
    
    return None
