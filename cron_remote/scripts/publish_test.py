def run():
    import frappe
    frappe.publish_realtime('remote_session_request', {'session':'SIM-1','from':'Administrator','session_id':'sim123'}, user='ali.bal@turksab.com')
    frappe.publish_realtime('remote_session_requested', {'session':'SIM-1','to':'ali.bal@turksab.com','session_id':'sim123'}, user='Administrator')
    print('Published simulated realtime events')
