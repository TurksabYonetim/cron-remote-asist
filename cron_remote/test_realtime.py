import frappe

@frappe.whitelist()
def send_test_broadcast():
    """Test broadcast event"""
    frappe.publish_realtime('test_broadcast', {'message': 'hello from API', 'user': frappe.session.user})
    return "Event sent"
