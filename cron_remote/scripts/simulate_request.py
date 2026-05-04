def run():
    import frappe, uuid
    session_id = str(uuid.uuid4())
    doc = frappe.get_doc({
        'doctype': 'Remote Session',
        'requester': 'Administrator',
        'target_user': 'ali.bal@turksab.com',
        'status': 'Requested',
        'allow_control': 0,
        'session_id': session_id,
    }).insert(ignore_permissions=True)
    frappe.db.commit()
    print('Inserted doc:', doc.name)
    frappe.publish_realtime('remote_session_request', {'session': doc.name, 'from': 'Administrator', 'session_id': session_id}, user='ali.bal@turksab.com')
    frappe.publish_realtime('remote_session_requested', {'session': doc.name, 'to': 'ali.bal@turksab.com', 'session_id': session_id}, user='Administrator')
    print('Published realtime to target and requester')
