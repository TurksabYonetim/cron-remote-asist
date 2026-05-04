frappe.ui.form.on("User", {
    refresh(frm) {
        // Kullanıcı yoksa veya kendine istek göndermesin
        if (!frm.doc.name || frm.doc.name === frappe.session.user) {
            return;
        }

        // Buton ekle
        frm.add_custom_button("Impersonate Request", () => {
            frappe.call({
                method: "cron_remote.api.create_impersonation_request",
                args: {
                    to_user: frm.doc.name
                },
                callback(r) {
                    if (r && !r.exc) {
                        frappe.msgprint("İstek başarıyla gönderildi.");
                    } else {
                        frappe.msgprint("İstek gönderilirken bir hata oluştu.");
                    }
                }
            });
        });
    }
});
