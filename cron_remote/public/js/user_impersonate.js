// cron_remote: override User doctype impersonate popup
// Adds a custom prompt and logs to console so we can verify the override loaded

console.log('cron_remote: user_impersonate.js loaded');

frappe.ui.form.on('User', {
    setup_impersonation: function (frm) {
        // remove existing button to avoid duplicates
        try {
            frm.remove_custom_button(__('Impersonate'));
        } catch (e) { }

        if (frappe.session.user === 'Administrator' && frm.doc.name !== 'Administrator') {
            frm.add_custom_button(__('Impersonate'), function () {
                if (frm.doc.restrict_ip) {
                    frappe.msgprint({
                        message: "There's IP restriction for this user, you can not impersonate as this user.",
                        title: 'IP restriction is enabled'
                    });
                    return;
                }

                // Block impersonate action on client-side: show an alert instead
                // This prevents the client from calling the impersonate API.

            });

            // Add Request Remote Session button for System Manager
            frm.add_custom_button(__('Request Remote Session'), function () {
                console.log('ADMIN: Request Remote Session clicked for:', frm.doc.name);
                frappe.confirm(
                    __('Request remote viewing session for {0}?', [frm.doc.name]),
                    function () {
                        console.log('ADMIN: Confirmed, calling API...');
                        frappe.call('cron_remote.api.request_remote_session', { target_user: frm.doc.name, allow_control: 0 })
                            .then(function (r) {
                                console.log('ADMIN: API response:', r);

                                // Hedef kullanıcıya direkt event gönder
                                if (r.message) {
                                    console.log('ADMIN: Publishing event to target...');
                                    frappe.publish_realtime('remote_session_request', {
                                        session: r.message,
                                        from: frappe.session.user,
                                        target_user: frm.doc.name,
                                        session_id: r.message
                                    }, frm.doc.name);  // hedef kullanıcıya direkt gönder
                                }

                                frappe.msgprint({ message: __('Remote session requested.'), title: __('Requested') });
                            })
                            .catch(function (e) {
                                console.error('ADMIN: API error:', e);
                            });
                    },
                    function () {
                        // cancelled
                    }
                );
            }); // end Request Remote Session button

            // Add a debug button to force impersonation via full-page redirect (for testing)
            frm.add_custom_button(__('Force Impersonate (debug)'), function () {
                frappe.confirm(
                    __('Force impersonate {0} now? This will navigate the browser.', [frm.doc.name]),
                    function () {
                        console.log('ADMIN: Forcing impersonation redirect to', frm.doc.name);
                        var url = '/api/method/cron_remote.api.impersonate_redirect?user=' + encodeURIComponent(frm.doc.name);
                        window.location.href = url;
                    }
                );
            });
        }
    }
});

// Listen for confirmation that a remote session request was sent
frappe.realtime.on('remote_session_requested', function (data) {
    try {
        frappe.msgprint({
            message: __('Remote session request sent to {0}.', [data.to]),
            title: __('Remote Session Requested'),
        });
    } catch (e) {
        console.warn('remote_session_requested handler error', e);
    }
});
