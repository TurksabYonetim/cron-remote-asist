def run():
    import frappe
    print('Sending broadcast test_event to ALL users')
    frappe.publish_realtime('test_event', {'message': 'hello from broadcast'}, after_commit=True)
    print('Broadcast event sent successfully')
