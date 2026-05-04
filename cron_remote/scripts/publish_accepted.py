def run():
    import frappe
    target_user = 'ali.bal@turksab.com'
    docs = frappe.get_all('Remote Session', filters={'target_user': target_user, 'status': 'Accepted'}, order_by='modified desc', limit_page_length=1)
    if not docs:
        print('No accepted Remote Session found for', target_user)
        return
    name = docs[0].name
    doc = frappe.get_doc('Remote Session', name)
    # publish accepted event to the requester (admin)
    frappe.publish_realtime('remote_session_accepted', {
        'session': doc.name,
        'by': doc.target_user,
        'session_id': doc.session_id,
        'token': getattr(doc, 'token', None),
        'allow_control': getattr(doc, 'allow_control', 0),
        'target_user': getattr(doc, 'target_user', None)
    }, user=doc.requester)
    print('Published remote_session_accepted for', name, 'to', doc.requester)
