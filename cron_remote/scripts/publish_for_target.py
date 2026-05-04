def run():
    import frappe
    target_user = 'ali.bal@turksab.com'
    docs = frappe.get_all('Remote Session', filters={'target_user': target_user, 'status': 'Requested'}, order_by='modified desc', limit_page_length=1)
    if not docs:
        print('No requested Remote Session found for', target_user)
        return
    name = docs[0].name
    doc = frappe.get_doc('Remote Session', name)
    frappe.publish_realtime('remote_session_request', {'session': doc.name, 'from': doc.requester, 'session_id': doc.session_id}, user=target_user)
    print('Published remote_session_request for', name, 'to', target_user)
