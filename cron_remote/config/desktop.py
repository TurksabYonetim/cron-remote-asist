from frappe import _

def get_data():
    return [
        {
            "module_name": "Cron Remote",
            "label": _("Cron Remote"),
            "type": "module",
            "icon": "octicon octicon-device-desktop",
            "description": "Remote Admin Tools"
        }
    ]
