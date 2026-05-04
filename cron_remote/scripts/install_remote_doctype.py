def install():
    import json
    import frappe
    p = frappe.get_app_path('cron_remote', 'doctype', 'remote_session', 'remote_session.json')
    with open(p) as f:
        data = json.load(f)
    if data.get('doctype') != 'DocType':
        print('JSON not a DocType:', data.get('doctype'))
        return
    try:
        doc = frappe.get_doc(data)
        doc.insert(ignore_permissions=True)
        frappe.db.commit()
        print('Inserted:', doc.name)
    except Exception as e:
        print('ERROR:', e)
