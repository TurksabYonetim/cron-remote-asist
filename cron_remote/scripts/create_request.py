def run():
    import frappe
    print('Creating Remote Session for ali.bal@turksab.com')
    name = frappe.get_attr('cron_remote.api.request_remote_session')('ali.bal@turksab.com', 0)
    print('Created:', name)
    return name
